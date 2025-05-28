import { hydraService } from "../service";
import { cborBackend } from "cbor-rpc";
import { txWithMergedSignature } from "../..";
import {
  RUNS,
  testWalletAddress,
  testWalletSigningKey,
  timeAsync,
  writeBenchmarkResults,
} from "./utils";
import { createHydraWallet, createSampleOutputTx } from "../../example/example";

const runSerialBenchmarks = async () => {
  const results: Record<string, number>[] = [];

  for (let i = 0; i < RUNS; i++) {
    const log: Record<string, number> = {};

    try {
      const buildTxResponse = await timeAsync(
        "buildTx",
        () =>
          hydraService.buildTx(
            createSampleOutputTx(testWalletAddress, testWalletAddress),
            false
          ),
        log
      );
      const myWallet = await createHydraWallet(
        hydraService,
        testWalletSigningKey.cborHex
      );

      const txCborHex = buildTxResponse.cborHex;

      const signature = await timeAsync(
        "signTx",
        () => myWallet.signTx(txCborHex),
        log
      );

      const txObject = cborBackend.decode(Buffer.from(txCborHex, "hex"));
      const signatureObject = cborBackend.decode(Buffer.from(signature, "hex"));
      const signedTxHex = cborBackend
        .encode(txWithMergedSignature(txObject, signatureObject))
        .toString("hex");

      await timeAsync("submitTx", () => myWallet.submitTx(signedTxHex), log);

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
