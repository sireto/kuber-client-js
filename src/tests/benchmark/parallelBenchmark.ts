import { hydraService } from "../service";
import {
  createHydraWallet,
  createSampleOutputTx,
  RUNS,
  testWalletAddress,
  testWalletSigningKey,
  timeAsync,
  writeBenchmarkResults,
} from "./utils";
import { txWithMergedSignature } from "../..";

const runParallelSubmitBenchmarks = async () => {
  const prepResults: Record<string, number>[] = [];
  const submitLog: Record<string, number> = {};
  const signedTxHexes: string[] = [];
  const myWallet = await createHydraWallet(
    hydraService,
    testWalletSigningKey,
    0
  );
  for (let i = 0; i < RUNS; i++) {
    const log: Record<string, number> = {};

    try {
      const sampleOutputTx = createSampleOutputTx(
        testWalletAddress,
        testWalletAddress
      );
      const buildTxResponse = await timeAsync(
        `buildTx`,
        () => hydraService.buildTx(sampleOutputTx, false),
        log
      );

      const txCborHex = buildTxResponse.cborHex;

      const signature = await timeAsync(
        `signTx`,
        () => myWallet.signTx(txCborHex),
        log
      );

      const signedTxHex = txWithMergedSignature(txCborHex, signature);
      signedTxHexes.push(signedTxHex);
      prepResults.push(log);
    } catch (error: any) {
      console.error(`Prep Run ${i + 1} failed:`, error.message);
      prepResults.push(log);
    }
  }

  // Submit all transactions in parallel
  try {
    const myWallet = await createHydraWallet(
      hydraService,
      testWalletSigningKey,
      0
    );
    await timeAsync(
      "submitTxBulk",
      async () => {
        await Promise.all(signedTxHexes.map((tx) => myWallet.submitTx(tx)));
      },
      submitLog
    );
  } catch (error: any) {
    console.error("Bulk submit failed:", error.message);
  }

  writeBenchmarkResults(prepResults, "parallel", submitLog);
};

await runParallelSubmitBenchmarks();
