import { KuberHydraService } from "../service/kuberHydraService";
import { HydraWallet } from "../wallet/hydraWallet";
import { ShelleyWallet } from "libcardano/cardano/primitives/address";
import { Ed25519Key } from "libcardano/cardano/primitives/keys";
import { setup } from "libcardano/lib/cardano/crypto";
import { txWithMergedSignature } from "..";
import { respondWithError } from "../service/utils/errorHandler";
import path from "path";

await setup();

const testWalletSigningKey = await Ed25519Key.fromCardanoCliFile(
  path.join("src", "example", "example.sk")
);

const testWalletAddress = new ShelleyWallet(testWalletSigningKey).addressBech32(
  0
);

async function createHydraWallet(
  service: KuberHydraService,
  ed25519Key: Ed25519Key,
  network: 0 | 1
): Promise<HydraWallet> {
  try {
    const shelleyWallet = new ShelleyWallet(ed25519Key);
    const hydraWallet = new HydraWallet(service, shelleyWallet, network);
    return hydraWallet;
  } catch (error: any) {
    return respondWithError(error);
  }
}

// By this point, the hydra network should be open and ready for transactions
// Also, the testWalletAddress must be funded within the hydra network

const createSampleOutputTx = (
  selectionAddress: string,
  outputAddress: string
) => {
  return {
    selections: [selectionAddress],
    outputs: [
      {
        address: outputAddress,
        value: 2000000,
        datum: {
          fields: [],
          constructor: 1,
        },
      },
      {
        address: outputAddress,
        value: 2000000,
        datum: {
          fields: [],
          constructor: 2,
        },
      },
    ],
    signatures: [selectionAddress],
  };
};

const signAndSubmitHydra = async (txBody: any) => {
  const hydraService = new KuberHydraService("http://localhost:8081");
  const buildTxResponse = await hydraService.buildTx(txBody, false);
  console.log("Tx: ", buildTxResponse, "\n");
  const myWallet = await createHydraWallet(
    hydraService,
    testWalletSigningKey,
    0
  );
  const txCborHex = buildTxResponse.cborHex;
  const signature: string = await myWallet.signTx(txCborHex);
  const signedTxHex = txWithMergedSignature(txCborHex, signature);
  const submissionResult = await myWallet.submitTx(signedTxHex);
  console.log("Tx Submitted: ", submissionResult, "\n");
  return submissionResult;
};

await signAndSubmitHydra(
  createSampleOutputTx(testWalletAddress, testWalletAddress)
);
