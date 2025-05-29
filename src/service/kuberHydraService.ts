import axios, { AxiosInstance } from "axios";
import {
  QueryAPIProvider,
  SubmitAPIProvider,
} from "libcardano-wallet/providers/serviceInterface";
import {
  CommonProtocolParameters,
  CommonTxObject,
} from "libcardano-wallet/utils/types";
import { UTxO } from "libcardano/cardano/ledger-serialization/txinout";
import { Commit, RetryConfig } from "./utils/type";
import { get, post } from "./utils/http";
import { toUTxO } from "./utils/typeConverters";

export class KuberHydraService implements SubmitAPIProvider, QueryAPIProvider {
  kuberHydraServiceInstance: AxiosInstance;
  retry?: RetryConfig;

  constructor(kuberHydraBaseURL: string, retry?: RetryConfig) {
    this.kuberHydraServiceInstance = axios.create({
      baseURL: kuberHydraBaseURL,
    });
    if (retry) {
      this.retry = retry;
    }
  }

  async queryUTxOByAddress(address: string): Promise<UTxO[]> {
    const request = `/hydra/query/utxo?address=${address}`;
    const response = await get(
      this.kuberHydraServiceInstance,
      "KuberHydraService.queryUTxOByAddress",
      request,
      this.retry
    );
    return toUTxO(response);
  }

  async queryUTxOByTxIn(txIn: string): Promise<UTxO[]> {
    const request = `/hydra/query/utxo?txin=${txIn}`;
    const response = await get(
      this.kuberHydraServiceInstance,
      "KuberHydraService.queryUTxOByTxIn",
      request,
      this.retry
    );
    return toUTxO(response);
  }

  async queryProtocolParameters(): Promise<CommonProtocolParameters> {
    const request = `/hydra/query/protocol-parameters`;
    return await get(
      this.kuberHydraServiceInstance,
      "KuberHydraService.queryProtocolParameters",
      request,
      this.retry
    );
  }

  async queryHeadState(): Promise<{ state: string }> {
    const request = `/hydra/query/state`;
    return await get(
      this.kuberHydraServiceInstance,
      "KuberHydraService.queryHeadState",
      request,
      this.retry
    );
  }

  async initialize(wait: boolean = false) {
    const request = `/hydra/init?wait=${wait}`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.initialize",
      request,
      null,
      this.retry
    );
  }

  async close(wait: boolean = false) {
    const request = `/hydra/close?wait=${wait}`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.close",
      request,
      null,
      this.retry
    );
  }

  async fanout(wait: boolean = false) {
    const request = `/hydra/fanout?wait=${wait}`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.fanout",
      request,
      null,
      this.retry
    );
  }

  async abort(wait: boolean = false) {
    const request = `/hydra/abort?wait=${wait}`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.abort",
      request,
      null,
      this.retry
    );
  }

  async contest(wait: boolean = false) {
    const request = `/hydra/contest?wait=${wait}`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.contest",
      request,
      null,
      this.retry
    );
  }

  async commit(
    utxos: Commit,
    submit: boolean = false
  ): Promise<CommonTxObject> {
    const request = `/hydra/commit?submit=${submit}`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.commit",
      request,
      utxos,
      this.retry
    );
  }

  async decommit(
    utxos: Commit,
    wait: boolean = false,
    submit: boolean = false
  ) {
    const request = `/hydra/decommit?wait=${wait}&&submit=${submit}`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.decommit",
      request,
      utxos,
      this.retry
    );
  }

  async buildTx(tx: any, submit: boolean = false): Promise<CommonTxObject> {
    const request = `/hydra/tx?submit=${submit}`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.buildTx",
      request,
      tx,
      this.retry
    );
  }

  async submitTx(txModal: CommonTxObject): Promise<CommonTxObject> {
    const request = `/hydra/submit?wait=true`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.submitTx",
      request,
      txModal,
      this.retry
    );
  }
}
