import { readFileSync } from "fs";
import { loadCrypto, Ed25519Key, Value } from "libcardano";
import { ShelleyWallet, Cip30ShelleyWallet } from "libcardano-wallet";
import { KuberHydraApiProvider } from "../src/service/KuberHydraApiProvider";
import { CommonProtocolParameters } from "libcardano-wallet/utils/types";
import { UTxO } from "libcardano/cardano/serialization";
import { randomBytes } from "crypto";
import { describe, beforeAll, expect, test } from "vitest";

describe("KuberHydraApiProvider Operations", async () => {
  let hydra = new KuberHydraApiProvider("http://172.31.6.1:8082");
  let cip30Wallet: Cip30ShelleyWallet;
  let walletAddress: string = ""; // Initialize with an empty string
  let head = await hydra.queryHead();
  let nodeAddr = "";

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
    // load key files

    const node_addr_path = process.env.HOME + "/.cardano/preview/hydra-0/credentials/node.addr";
    nodeAddr = readFileSync(node_addr_path).toString("utf-8").trim();
    const testWalletSigningKey = await Ed25519Key.fromCardanoCliJson(
      JSON.parse(readFileSync(process.env.HOME + "/.cardano/preview/hydra-0/credentials/funds.sk", "utf-8")),
    );

    // setup hydra and wallet
    await loadCrypto();
    const shelleyWallet = new ShelleyWallet(testWalletSigningKey);
    console.log("Wallet", shelleyWallet.toJSON());
    cip30Wallet = new Cip30ShelleyWallet(hydra, hydra, shelleyWallet, 0);
    walletAddress = (await cip30Wallet.getChangeAddress()).toBech32();
  }, 20000);
  afterAll(async()=>{
    head =  await hydra.queryHead();
  })
  
  runTest("query head state", () => {
    expect(head.tag).toBeTruthy();
    console.log("Initial Head state is", head.tag);
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

  runTestWhen(
    head.tag === "Initial" || head.tag === "Open",
    "Commit UTxOs",
    async () => {
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

      const selectedUtxos = l1Utxos.filter((x: UTxO) => x.txOut.value.greaterThan(Value.fromString("4A")));
      if (selectedUtxos.length === 0) {
        throw new Error(`not enough balance on ${walletAddress} in l1Chain`);
      }

      const txIn = selectedUtxos[0].txIn;
      const commitResult = await hydra.commit({
        utxos: [`${txIn.txHash.toString("hex")}#${txIn.index}`],
      });
      console.log("Tx Being commited", commitResult);
      const signResult = await cip30Wallet.signTx(commitResult.cborHex);
      console.log("Signed Tx", signResult.updatedTxBytes.toString("hex"));
      await hydra.l1Api.submitTx(signResult.updatedTxBytes.toString("hex"));

      console.log("Submitted Commit transaction :" + commitResult.hash);
      console.log("Waiting up to  280 secs for confirmation ...");

      await hydra.l1Api.waitForUtxoConsumption(selectedUtxos[0].txIn, 280000);
    },
    { timeout: 320000 },
  );

  runTest("query commits", async () => {
    const response = await hydra.queryCommits();
    console.log("Query Commits:", response);
    expect(response).to.be.an("array");
  });

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
   
  });

  runTestWhen(["Closed", "Initial"].includes(head.tag), "attempt to Decommit UTxOs", async () => {
    const commits = await hydra.queryCommits();

    // Filter the commits of current wallet
    const filteredEntries = Object.entries(commits).filter(
      ([utxoId, commit]: [string, any]) => commit.address === walletAddress
    ).map(x => x[0])


    if (filteredEntries.length === 0) {
      console.warn("No UTxOs found for the given wallet address.");
      return;
    }
    const utxoIdsToDecommit = filteredEntries[0]


    // Decommit first utxo in the commit list.
    const decommitResult = await hydra.decommit({ utxos: [utxoIdsToDecommit] }, true, true);
    console.log("decommitResult", decommitResult);
  });

  runTestWhen(head.tag == "Open", "Close Head", async () => {
    await hydra.close(true);
    await hydra.waitForHeadState("Closed", 180000, true);
  }, { timeout: 200000 });

  runTestWhen((head.tag === "Closed" && !head.contents.readyToFanoutSent), "attempt to Contest", async () => {
    const contestResult = await hydra.contest(true);
    console.log("contestResult", contestResult);
  });

  runTestWhen(head.contents.readyToFanoutSent, "Fanout Head", async () => {
    const fanoutResult = await hydra.fanout(true);
    console.log("Fanout Result", fanoutResult);
    await hydra.waitForHeadState("Idle", 180000, true);
  }, { timeout: 200000 });

  // always skip this
  runTestWhen(false,"attempt to Abort", async () => {
    const abortResult = await hydra.abort(true);
    console.log("AbortResult", abortResult);
    await hydra.waitForHeadState("Idle", 180000, true);
  }, { timeout: 200000 });

});
