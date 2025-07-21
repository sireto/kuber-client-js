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
import { ShelleyWalletCip30Provider } from "libcardano-wallet/cip30";
import { ShelleyWallet } from "libcardano-wallet";

const runParallelSubmitBenchmarks = async () => {
  const kuberHydra =  new KuberHydraApiProvider("http://localhost:8081");
  const hydraFundKeys = testWalletSigningKey
  const shelleyWallet= new ShelleyWallet(hydraFundKeys,undefined)
  const cip30Wallet =new  ShelleyWalletCip30Provider(kuberHydra,kuberHydra,shelleyWallet,1)



  kuberHydra.buildWithWallet(cip30Wallet,{
    outputs:{
      address: shelleyWallet.addressBech32,
      value: "2A"
    }
  })
  const prepResults: Record<string, number>[] = [];
  const submitLog: Record<string, number> = {};
  const signedTxHexes: string[] = [];

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
