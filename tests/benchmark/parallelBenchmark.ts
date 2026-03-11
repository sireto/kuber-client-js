import {
  createHydraWallet,
  createSampleOutputTx,
  RUNS,
  testWalletAddress,
  testWalletSigningKey,
  timeAsync,
  writeBenchmarkResults,
} from "./utils";
import { KuberHydraApiProvider } from "../../src/service/KuberHydraApiProvider";
import { Cip30ShelleyWallet, ShelleyWallet } from "libcardano-wallet";
import type { TxSignResult } from "libcardano-wallet";

const runParallelSubmitBenchmarks = async () => {
  const kuberHydra = new KuberHydraApiProvider("http://172.31.6.1:8082");
  const hydraFundKeys = testWalletSigningKey;
  const shelleyWallet = new ShelleyWallet(hydraFundKeys, undefined);
  const cip30Wallet = new Cip30ShelleyWallet(kuberHydra, kuberHydra, shelleyWallet, 1);

  const prepResults: Record<string, number>[] = [];
  const submitLog: Record<string, number> = {};
  const signedTxHexes: string[] = [];

  for (let i = 0; i < RUNS; i++) {
    const log: Record<string, number> = {};

    try {
      const sampleOutputTx = createSampleOutputTx(testWalletAddress, testWalletAddress);
      const buildTxResponse = await timeAsync(`buildTx`, () => kuberHydra.buildTx(sampleOutputTx, false), log);

      const txCborHex = buildTxResponse.cborHex;
      const myWallet = await createHydraWallet(kuberHydra, testWalletSigningKey, 0);

      const signature: TxSignResult = await timeAsync(`signTx`, () => myWallet.signTx(txCborHex), log);

      signedTxHexes.push(signature.transaction.toBytes().toString("hex"));
      prepResults.push(log);
    } catch (error: any) {
      console.error(`Prep Run ${i + 1} failed:`, error.message);
      prepResults.push(log);
    }
  }

  // Submit all transactions in parallel
  try {
    await timeAsync(
      "submitTxBulk",
      async () => {
        await Promise.all(signedTxHexes.map((tx) => kuberHydra.l1Api.submitTx(tx)));
      },
      submitLog,
    );
  } catch (error: any) {
    console.error("Bulk submit failed:", error.message);
  }

  writeBenchmarkResults(prepResults, "parallel", submitLog);
};

await runParallelSubmitBenchmarks();
