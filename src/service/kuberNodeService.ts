import axios, { AxiosInstance } from "axios";
import {
  QueryAPIProvider,
  SubmitAPIProvider,
} from "libcardano-wallet/providers/serviceInterface";
import {
  CommonProtocolParameters,
  CommonTxObject,
} from "libcardano-wallet/utils/types";
import { get, post } from "./utils/http";
import { cborBackend } from "cbor-rpc";
import { RetryConfig } from "./utils/type";
import { UTxO } from "libcardano/cardano/ledger-serialization/txinout";
import { toUTxO } from "./utils/typeConverters";

export class KuberNodeService implements SubmitAPIProvider, QueryAPIProvider {
  kuberNodeServiceInstance: AxiosInstance;
  retry?: RetryConfig;

  constructor(kuberNodeBaseURL: string, retry?: RetryConfig) {
    this.kuberNodeServiceInstance = axios.create({
      baseURL: kuberNodeBaseURL,
    });
    if (retry) {
      this.retry = retry;
    }
  }

  async queryUTxOByAddress(address: string): Promise<UTxO[]> {
    const request = `/api/v3/utxo?address=${address}`;
    const response = await get(
      this.kuberNodeServiceInstance,
      "KuberNodeService.queryUTxOByAddress",
      request,
      this.retry
    );
    return toUTxO(response);
  }

  async queryUTxOByTxIn(txIn: string): Promise<UTxO[]> {
    const request = `/api/v3/utxo?txin=${encodeURIComponent(txIn)}`;
    const response = await get(
      this.kuberNodeServiceInstance,
      "KuberNodeService.queryUTxOByTxIn",
      request,
      this.retry
    );
    return toUTxO(response);
  }

  async queryProtocolParameters(): Promise<CommonProtocolParameters> {
    const request = `/api/v3/protocol-params`;
    const response = await get(
      this.kuberNodeServiceInstance,
      "KuberNodeService.queryProtocolParameters",
      request,
      this.retry
    );
    return response;
  }

  async querySystemStart() {
    const request = `/api/v3/genesis-params`;
    return await get(
      this.kuberNodeServiceInstance,
      "KuberNodeService.querySystemStart",
      request,
      this.retry
    );
  }

  async queryChainTip() {
    const request = `/api/v3/chain-point`;
    return await get(
      this.kuberNodeServiceInstance,
      "KuberNodeService.queryChainTip",
      request,
      this.retry
    );
  }

  async buildTx(txBuilder: any, submit: boolean = false) {
    const request = `/api/v1/tx?submit=${submit}`;
    return await post(
      this.kuberNodeServiceInstance,
      `KuberNodeService.buildTx_&_submit=${submit}`,
      request,
      txBuilder,
      this.retry
    );
  }

  async buildAndSubmit(txBuilder: any) {
    const request = `/api/v1/tx?submit=true`;
    return await post(
      this.kuberNodeServiceInstance,
      `KuberNodeService.buildAndSubmit`,
      request,
      txBuilder,
      this.retry
    );
  }

  async submitTx(tx: CommonTxObject) {
    const request = `/api/v1/tx/submit`;
    const cborString: string = tx.cborHex;
    const hasWitness =
      Object.keys(cborBackend.decode(Buffer.from(cborString, "hex"))[1])
        .length != 0;
    const parsedKuberSubmitObject = {
      tx: {
        cborHex: cborString,
        type: hasWitness
          ? "Witnessed Tx ConwayEra"
          : "Unwitnessed Tx ConwayEra",
        description: "",
      },
    };
    return await post(
      this.kuberNodeServiceInstance,
      "KuberNodeService.submitTx",
      request,
      parsedKuberSubmitObject,
      this.retry
    );
  }
}
