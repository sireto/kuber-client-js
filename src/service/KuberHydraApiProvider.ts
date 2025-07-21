import axios, { AxiosInstance } from "axios";
import {
  CommonProtocolParameters,
  CommonTxObject,
} from "libcardano-wallet/utils/types";
import { Commit, RetryConfig } from "../utils/type";
import { get, post } from "../utils/http";
import { toUTxO } from "../utils/typeConverters";
import { HexString, UTxO } from "libcardano/cardano/serialization";
import { cborBackend } from "cbor-rpc";
import { KuberProvider } from "./KuberProvider";

export class KuberHydraApiProvider extends KuberProvider {
  axios: AxiosInstance;
  retry?: RetryConfig;

  constructor(kuberHydraBaseURL: string, retry?: RetryConfig) {
    super()
    this.axios = axios.create({
      baseURL: kuberHydraBaseURL,
    });
    if (retry) {
      this.retry = retry;
    }
  }

  async queryUTxOByAddress(address: string): Promise<UTxO[]> {
    const request = `/hydra/query/utxo?address=${address}`;
    const response = await get(
      this.axios,
      "KuberHydraService.queryUTxOByAddress",
      request,
      this.retry
    );
    return toUTxO(response);
  }

  async queryUTxOByTxIn(txIn: string): Promise<UTxO[]> {
    const request = `/hydra/query/utxo?txin=${txIn}`;
    const response = await get(
      this.axios, "  KuberHydraService.queryUTxOByTxIn", request, this.retry
    );
    return toUTxO(response);
  }

  async queryProtocolParameters(): Promise<CommonProtocolParameters> {
    const request = `/hydra/query/protocol-parameters`;
    return await get(
      this.axios, "KuberHydraService.queryProtocolParameters", request, this.retry
    );
  }

  async queryHeadState(): Promise<{ state: string }> {
    const request = `/hydra/query/state`;
    return await get(
      this.axios, "KuberHydraService.queryHeadState", request, this.retry
    );
  }

  async initialize(wait: boolean = false) {
    const request = `/hydra/init?wait=${wait}`;
    return await post(
      this.axios, "KuberHydraService.initialize", request, null, this.retry
    );
  }

  async close(wait: boolean = false) {
    const request = `/hydra/close?wait=${wait}`;
    return await post(
      this.axios, "KuberHydraService.close", request, null, this.retry
    );
  }

  async fanout(wait: boolean = false) {
    const request = `/hydra/fanout?wait=${wait}`;
    return await post(
      this.axios, "KuberHydraService.fanout", request, null, this.retry
    );
  }

  async abort(wait: boolean = false) {
    const request = `/hydra/abort?wait=${wait}`;
    return await post(
      this.axios, "KuberHydraService.abort", request, null, this.retry
    );
  }

  async contest(wait: boolean = false) {
    const request = `/hydra/contest?wait=${wait}`;
    return await post(
      this.axios, "KuberHydraService.contest", request, null,this.retry
    );
  }

  async commit(
    utxos: Commit,
    submit: boolean = false
  ): Promise<CommonTxObject> {
    const request = `/hydra/commit?submit=${submit}`;
    return await post(
      this.axios,
      "KuberHydraService.commit", request, utxos, this.retry
    );
  }

  async decommit(
    utxos: Commit,
    wait: boolean = false,
    submit: boolean = false
  ) {
    const request = `/hydra/decommit?wait=${wait}&&submit=${submit}`;
    return await post(
      this.axios,
      "KuberHydraService.decommit", request, utxos, this.retry
    );
  }

  async buildTx(tx: any, submit: boolean = false): Promise<CommonTxObject> {
    const request = `/hydra/tx?submit=${submit}`;
    return await post(
      this.axios,
      "KuberHydraService.buildTx", request, tx, this.retry
    );
  }

  async submitTx(cborString: HexString): Promise<CommonTxObject> {
  const request = `/api/v1/tx/submit`;
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
      this.axios,
      "KuberApiProvider.submitTx",
      request,
      parsedKuberSubmitObject,
      this.retry
    );
  }
}
