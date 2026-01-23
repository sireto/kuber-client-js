import { readFileSync } from "fs";
import { Value } from "libcardano";
import { Cip30ShelleyWallet } from "libcardano-wallet";
import { KuberHydraApiProvider } from "../src/service/KuberHydraApiProvider";
import { CommonProtocolParameters } from "libcardano-wallet/utils/types";
import { parseRawTransaction, parseTransaction, UTxO } from "libcardano/cardano/serialization";
import { randomBytes } from "crypto";
import { describe, beforeAll, expect, test } from "vitest";
import { HydraTestCluster } from "./HydraTestCluster";
import { APIError, L1TxSubmitError } from "src/utils/errorHandler";

describe("KuberHydraApiProvider Operations", async () => {
    const hydraCluster = new HydraTestCluster();

    hydraCluster.addParticipantConfig(
      "http://localhost:8081",
      process.env.HOME + "/.cardano/preview/hydra-0/credentials/funds.sk",
      process.env.HOME + "/.cardano/preview/hydra-0/credentials/node.sk"
    );
    hydraCluster.addParticipantConfig(
      "http://localhost:8082",
      process.env.HOME + "/.cardano/preview/hydra-1/credentials/funds.sk",
      process.env.HOME + "/.cardano/preview/hydra-1/credentials/node.sk"
    );
    const participant1 = hydraCluster.getParticipant(0)!;


  let hydra: KuberHydraApiProvider;
  let cip30Wallet: Cip30ShelleyWallet;
  let walletAddress: string = ""; // Initialize with an empty string
  let nodeAddr = "";
  await hydraCluster.resetClusterToClosedState()
  let head = await participant1.getKuberHydraApiProvider().queryHead();
  const startHead=head


  function runTestWhen(
    condition: boolean,
    description: string,
    testFn: () => Promise<void> | void,
    options?: { timeout?: number },
  ) {
    const testName = `When head is ${head.tag} then should ${description}`;
    const skippedTestName = `When head is ${head.tag} then should skip ${description}`;

    if (!condition) {
      test.skip(skippedTestName, testFn, options?.timeout);
    } else {
      test(testName, testFn, options?.timeout);
    }
  }

  function runTest(
    description: string,
    testFn: () => Promise<void> | void,
    options?: { timeout?: number },
  ) {
    runTestWhen(true, description, testFn, options);
  }

  beforeAll(async () => {
    hydra = participant1.getKuberHydraApiProvider();
    cip30Wallet = await participant1.getCip30Wallet();
    walletAddress = (await cip30Wallet.getChangeAddress()).toBech32();
    participant1.getNodeKey()
    // Load node address for participant1
    nodeAddr = readFileSync(process.env.HOME + "/.cardano/preview/hydra-0/credentials/node.addr").toString("utf-8").trim();
    head = await hydra.queryHead();

  }, 20000);

  afterEach(async () => {
    hydraCluster.resetCluster(startHead.tag)
  });

  runTest("query head state", () => {
    expect(head.tag).toBeTruthy();
    console.log("Initial Head state is", head.tag);
  });

  runTest("query Protocol Parameters", async () => {
    const protocolParams: CommonProtocolParameters = await hydra.queryProtocolParameters();
    expect(protocolParams).to.exist;
    expect(protocolParams.txFeeFixed).to.exist;
  });

  runTest("query UTxO by Address", async () => {
    console.log('Wallet Address : "' + walletAddress + '"');
    const utxosByAddress: UTxO[] = await hydra.queryUTxOByAddress(walletAddress);
    expect(utxosByAddress).to.be.an("array");
  });

  runTest("query UTxO by TxIn", async () => {
    const utxosByTxIn = await hydra.queryUTxOByTxIn(randomBytes(32).toString("hex") + "#0");
    expect(utxosByTxIn).to.be.an("array");
  });

  runTest("query commits", async () => {
    const response = await hydra.queryCommits();
    console.log("Query Commits:", response);
    expect(response).to.be.an("array");
  });

  runTestWhen(head.tag === "Initial","Abort Head", async () => {
    const abortResult = await hydra.abort(true);
    console.log("AbortResult", abortResult);
    await hydra.waitForHeadState("Idle", 180000, true);
  }, {timeout:200000});


    runTestWhen(head.tag === "Initial" || head.tag === "Open","Commit UTxOs",async () => {
      if (nodeAddr) {
        const nodeUtxos = await hydra.l1Api.queryUTxOByAddress(nodeAddr);
        console.log(
          "Node address",
          nodeAddr,
          "value=",
          nodeUtxos.map((x) => x.txOut.value).reduce((a, b) => a.add(b), new Value(0n)),
        );
        if (nodeUtxos.length < 1) {
          throw new Error(`not enough balance on node Address ${nodeAddr} in l1Chain`);
        }
      }
      // if Initial is not the state of head it should be skipped.
      const l1Utxos = await hydra.l1Api.queryUTxOByAddress(walletAddress);
      if (l1Utxos.length === 0) {
        throw new Error(`not enough balance on ${walletAddress} in l1Chain`);
      }
      const initialHydraUtxos = await hydra.queryUtxos()

      const selectedUtxos = l1Utxos.filter((x: UTxO) => x.txOut.value.greaterThan(Value.fromString("4A")));
      if (selectedUtxos.length === 0) {
        throw new Error(`not enough balance on ${walletAddress} in l1Chain`);
      }

      const txIn = selectedUtxos[0].txIn;
      console.log("Committing",txIn.txHash.toString('hex')+'#'+txIn.index)
      const commitResult = await hydra.commit({
        utxos: [`${txIn.txHash.toString("hex")}#${txIn.index}`],
      });
      console.log("Tx Being commited", commitResult);
      const signResult = await cip30Wallet.signTx(commitResult.cborHex);
      console.log("Signed Tx", signResult.updatedTxBytes.toString("hex"));
      await hydra.l1Api.submitTx(signResult.updatedTxBytes.toString("hex"));

      console.log("Submitted Commit transaction :" + commitResult.hash);
      console.log("Waiting up to  360 secs for confirmation ...");
      
      await hydra.l1Api.waitForUtxoConsumption(selectedUtxos[0].txIn, 360000);
      await hydra.waitWhile(async (head)=>{
          const hydraUtxos = await hydra.queryUtxos()
          return head.contents.coordinatedHeadState.pendingDeposits !=null
                  || (hydraUtxos.length > initialHydraUtxos.length)
      })

    },
    { timeout: 440000 },
  );

    runTestWhen(head.tag === "Open", "build and submit transaction", async () => {
    const transaction = {
      outputs: [
        { address: walletAddress, value: "3A" },
        { address: walletAddress, value: "3A" }
      ],
      changeAddress: walletAddress,
    };

    const builtTx = await hydra.buildAndSignWithWallet(cip30Wallet, transaction);
    expect(builtTx).to.exist;
    await hydra.submitTx(builtTx.updatedTxBytes.toString('hex'))
    const utxo=await hydra.queryUTxOByTxIn(parseTransaction(builtTx.updatedTx).hash.toString('hex')+'#0')
    console.log("utxo : ",utxo)
    expect(utxo.length).toBeGreaterThan(0)
  
  });

  runTestWhen(
    head.tag === "Idle",
    "Initialize Head",
    async function () {
      const result = await hydra.initialize(true);
      expect(result).to.exist;
      console.log("Head initialization result", result);
      hydra.waitForHeadState("Initial", 180000);
    },
    { timeout: 2000000 },
  );


  runTestWhen(["Open"].includes(head.tag), "Decommit UTxOs", async () => {
    const utxos = await hydra.queryUTxOByAddress(walletAddress);
    console.log("Address utxos",Array.from(utxos.keys()))
    // Filter the commits of current wallet


    if (utxos.length === 0) {
      console.warn("No UTxOs found for the given wallet address.");
      return;
    }
    const utxoToDecommit = utxos[0].txIn.txHash.toString('hex')+"#"+utxos[0].txIn.index

    console.log("Decommiting utxo:",utxoToDecommit)

    // Query decommit transaction
    const decommitTx = await hydra.createDecommitTx(utxoToDecommit);
    console.log("Decommit Tx (un-signed):", decommitTx);

    // Sign the decommit transaction
    const signResult = await cip30Wallet.signTx(decommitTx.cborHex);
    console.log("Signed Decommit Tx:", signResult.updatedTxBytes.toString("hex"));

    // Submit the signed decommit transaction
    const decommitResult = await hydra.decommit(signResult.updatedTxBytes.toString('hex'), false);

    console.log("Decommit Result:", decommitResult);
    await hydra.waitForUtxoConsumption(utxos[0].txIn)
    await hydra.waitWhile(async (head) =>{
      return head.contents.coordinatedHeadState.confirmedSnapshot.snapshot.utxoToDecommit != null
    })    
    
  }, { timeout: 240000 });

  runTestWhen(head.tag == "Open", "Close Head", async () => {
    const doTest = async ()=>{
      head=await hydra.queryHead()
      if(head.tag == "Closed"){
        return
      }
      await hydra.close(true);
      await hydra.waitForHeadState("Closed", 180000, true);
    }
    try{
      await doTest()
    }catch(e){
      // retry in case of failure after 60 sec.
      await new Promise(resolve => setTimeout(resolve, 60000));
      await doTest()
    }
  }, { timeout: 460000 });


  // Contestation setup is technically complicated. It requires one of the 2 nodes to sign a snapshot then miss it.
  // Hydra nodes also implement automatic contestation if they have newer state than the one in currently closed state.
  // We only make sure that the contest command is sent.
  runTestWhen((head.tag === "Closed" && !head.contents.readyToFanoutSent), "attempt to Contest", async () => {
    try{
      const contestResult = await hydra.contest(true);
      console.log("contestResult", contestResult);

      }catch( e ){
        if (e instanceof APIError) {
          console.log(e)
          expect(e.parsedData.clientInput.tag).toBe('Contest')
          return 
      } else {
          throw e;
      }
    }
  });

  runTestWhen(head.tag === "Closed", "Fanout Head", async () => {
    await hydraCluster.resetClusterToClosedState({fanoutReady:true}) // this can take 15-20 mins
    
    const fanoutResult = await hydra.fanout(true);
    console.log("Fanout Result", fanoutResult);
    await hydra.waitForHeadState("Idle", 180000, true);
  }, { timeout: 1200000 });

});
