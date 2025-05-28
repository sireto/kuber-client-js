import { APIError } from "libcardano-wallet/utils/errorHandler";
import { KuberHydraService } from "../service/kuberHydraService";
import { HydraWallet } from "../wallet/hydraWallet";
import { ShelleyWallet } from "libcardano/cardano/primitives/address";
import { Ed25519Key } from "libcardano/cardano/primitives/keys";
import { setup } from "libcardano/lib/cardano/crypto";
import { cborBackend } from "cbor-rpc";
import { RawTx, RawWitnessSet } from "../types";
import { txWithMergedSignature } from "..";
import { KuberNodeService } from "../service/kuberNodeService";

await setup();

const testWalletSigningKey = {
  type: "PaymentSigningKeyShelley_ed25519",
  description: "Payment Signing Key",
  cborHex:
    "582060cf92e6caab015fa7983257800ebed1edd7846bed1faab1a6fafa6b3080de26",
};

const testWalletAddress =
  "addr_test1vprwmf60mgz473sm7d4p2y4tnj84e69gva7eaq2zfgzgu5quhdn2q";

const respondWithError = (error: any) => {
  if (error instanceof APIError) {
    const errorData = error.data ? { data: error.data } : undefined;
    const errorUrl = error.url ? { url: error.url } : undefined;
    throw new Error(
      JSON.stringify({
        message: error.message,
        status: error.status,
        ...errorData,
        ...errorUrl,
      })
    );
  }
  throw new Error(error.message);
};

export async function createHydraWallet(
  service: KuberHydraService,
  sk: string,
  network: 0 | 1
): Promise<HydraWallet> {
  try {
    const pk = sk.slice(-64); // to make sure the `5820` prefix is excluded
    const ed25519Key = await Ed25519Key.fromPrivateKeyHex(pk);
    const shelleyWallet = new ShelleyWallet(ed25519Key);
    const hydraWallet = new HydraWallet(service, shelleyWallet, network);
    return hydraWallet;
  } catch (error: any) {
    return respondWithError(error);
  }
}

// By this point, the hydra network should be open and ready for transactions
// Also, the testWalletAddress must be funded within the hydra network

export const createSampleOutputTx = (
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
  };
};

export const signAndSubmitHydra = async (txBody: any) => {
  const hydraService = new KuberHydraService("http://localhost:8081");
  const buildTxResponse = await hydraService.buildTx(txBody, false);
  const myWallet = await createHydraWallet(
    hydraService,
    testWalletSigningKey.cborHex,
    0
  );
  const txCborHex = buildTxResponse.cborHex;
  const txCborObject: RawTx = cborBackend.decode(Buffer.from(txCborHex, "hex"));
  const signature: RawWitnessSet = cborBackend.decode(
    Buffer.from(await myWallet.signTx(txCborHex), "hex")
  );
  const signedTxHex = cborBackend
    .encode(txWithMergedSignature(txCborObject, signature))
    .toString("hex");
  const submissionResult = await myWallet.submitTx(signedTxHex);
  return submissionResult;
};

// const walletSubmitTxResult = await signAndSubmitHydra(
//   createSampleOutputTx(testWalletAddress, testWalletAddress)
// );

// console.log(walletSubmitTxResult);

