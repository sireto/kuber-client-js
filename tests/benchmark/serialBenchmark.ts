import { KuberHydraApiProvider } from "../../src/service/KuberHydraApiProvider";
import {
  createHydraWallet,
  createSampleOutputTx,
  RUNS,
  testWalletAddress,
  testWalletSigningKey,
  timeAsync,
  writeBenchmarkResults,
} from "./utils";
import type { TxSignResult } from "libcardano-wallet";

const runSerialBenchmarks = async () => {
  const results: Record<string, number>[] = [];
  const hydra = new KuberHydraApiProvider("http://172.31.6.1:8082");

  for (let i = 0; i < RUNS; i++) {
    const log: Record<string, number> = {};

    try {
      const myWallet = await createHydraWallet(hydra, testWalletSigningKey, 0);

      const buildTxResponse = await timeAsync(
        "buildTx",
        () => hydra.buildTx(createSampleOutputTx(testWalletAddress, testWalletAddress), false),
        log,
      );

      const txCborHex = buildTxResponse.cborHex;

      const signature: TxSignResult = await timeAsync("signTx", () => myWallet.signTx(txCborHex), log);

      await timeAsync(
        "submitTx",
        () => hydra.l1Api.submitTx(signature.transaction.toBytes().toString("hex")),
        log,
      );

      results.push(log);
    } catch (error: any) {
      console.error(`Run ${i + 1} failed:`, error.message);
      results.push(log); // Still push partial logs
    }
  }

  // Write to markdown
  writeBenchmarkResults(results, "serial");
};
await runSerialBenchmarks();
