import { cborBackend } from "cbor-rpc";
import { readFileSync } from "fs";
import { loadCrypto, Ed25519Key, Value } from "libcardano";
import { ShelleyWallet, Cip30ShelleyWallet } from "libcardano-wallet";
import { KuberHydraApiProvider } from "../src/service/KuberHydraApiProvider";
import { CommonProtocolParameters } from "libcardano-wallet/utils/types";
import { UTxO } from "libcardano/cardano/serialization";
import { randomBytes } from "crypto";
import { describe, it, beforeAll, expect, test } from "vitest";

describe("KuberHydraApiProvider Operations", async () => {
  let hydra = new KuberHydraApiProvider("http://172.31.6.1:8082");
  let cip30Wallet: Cip30ShelleyWallet;
  let walletAddress: string = ""; // Initialize with an empty string
  let head = await hydra.queryHeadState();
  let nodeAddr = "";
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
  it("Should query head state", () => {
    expect(head.state).toBeTruthy();
    console.log("Initial Head state is", head.state);
  });

  test.runIf(head.state === "Idle")(
    "should Initialize Head",
    async function () {
      const result = await hydra.initialize(true);
      expect(result).to.exist;
      console.log("Head initialization result", result);
      hydra.waitForHeadState("Initial", 180000);
    },
    2000000,
  );

  test.runIf(head.state === "Final")(
    "should re-Initialize Head",
    async function () {
      const result = await hydra.initialize(true);
      expect(result).to.exist;
      console.log("Head initialization result", result);
      hydra.waitForHeadState("Initial", 180000);
    },
    2000000,
  );

  it("should query Protocol Parameters", async () => {
    const protocolParams: CommonProtocolParameters = await hydra.queryProtocolParameters();
    expect(protocolParams).to.exist;
    expect(protocolParams.txFeeFixed).to.exist;
  });

  it("should query UTxO by Address", async () => {
    console.log('Wallet Address : "' + walletAddress + '"');
    const utxosByAddress: UTxO[] = await hydra.queryUTxOByAddress(walletAddress);
    expect(utxosByAddress).to.be.an("array");
  });

  it("should query UTxO by TxIn if UTxOs are available", async () => {
    const utxosByTxIn = await hydra.queryUTxOByTxIn(randomBytes(32).toString("hex") + "#0");
    expect(utxosByTxIn).to.be.an("array");
  });

  it.runIf(head.state == "Initial")(
    "should attempt to Commit UTxOs",
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

      const waitedDuration = await hydra.l1Api.waitForUtxoConsumption(selectedUtxos[0].txIn, 280000);

      console.log("Transaction Confirmed");
      await hydra.waitForHeadState("Open", 280000 - 30000 - waitedDuration, true);
    },
    320000,
  );

  it("Should query commits", async () => {
    const response = await hydra.queryCommits();
    console.log("Query Commits:", response);
    expect(response).to.be.an("array");
  });

  it.skipIf(head.state != "Open")("When Head is open, attempt to Build and Submit Transaction", async () => {
    const transaction = {
      outputs: [{ address: walletAddress, value: { lovelace: "3A" } }],
      changeAddress: walletAddress,
    };
    try {
      const builtTx = await hydra.buildTx(transaction, true);
      expect(builtTx).to.exist;
      expect(builtTx.cborHex).to.exist;
    } catch (error: unknown) {
      if (error instanceof Error) {
        expect(error.message).to.include("Head is not open"); // Adjust based on actual error message
      } else {
        throw error;
      }
    }
  });

  it("should attempt to Decommit UTxOs (expected to warn if no UTxOs)", async () => {
    const utxosToDecommit = { utxos: [] };
    const commits = await hydra.queryCommits();

    const decommitResult = await hydra.decommit(utxosToDecommit, true, true);
    console.log("decommitResult", decommitResult);
  });

  it.skipIf(["Closed", "Final", "Initial"].includes(head.state))("should Close Head", async () => {
    await hydra.close(true);
    await hydra.waitForHeadState("Closed", 180000, true);
  });

  it.runIf(head.state == "Closed")("should Fanout Head", async () => {
    const fanoutResult = await hydra.fanout(true);
    console.log("Fanout Result", fanoutResult);
    await hydra.waitForHeadState("Final", 180000, true);
  });

  it.skip("should attempt to Abort)", async () => {
    const abortResult = await hydra.abort(true);
    console.log("AbortResult", abortResult);
    await hydra.waitForHeadState("Idle", 180000, true);
  }, 200000);

  it.runIf(head.state === "Closed")("should attempt to Contest", async () => {
    const contestResult = await hydra.contest(true);
    console.log("contestResult", contestResult);
  });
});
