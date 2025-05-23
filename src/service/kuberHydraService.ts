import axios, { AxiosInstance } from "axios";
import {
  QueryAPIProvider,
  SubmitAPIProvider,
} from "libcardano/libcardano-wallet/providers/serviceInterface";
import {
  Commit,
  RetryConfig,
  TxModal,
} from "libcardano/libcardano-wallet/types";
import { get, post } from "libcardano/libcardano-wallet/utils/serviceUtils";

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

  async queryUTxOByAddress(address: string) {
    const request = `/hydra/query/utxo?address=${address}`;
    return await get(
      this.kuberHydraServiceInstance,
      "KuberHydraService.queryUTxOByAddress",
      request,
      this.retry
    );
  }

  async queryUTxOByTxIn(txIn: string) {
    const request = `/hydra/query/utxo?txin=${txIn}`;
    return await get(
      this.kuberHydraServiceInstance,
      "KuberHydraService.queryUTxOByTxIn",
      request,
      this.retry
    );
  }

  async queryProtocolParameters() {
    const request = `/hydra/query/protocol-parameters`;
    return await get(
      this.kuberHydraServiceInstance,
      "KuberHydraService.queryProtocolParameters",
      request,
      this.retry
    );
  }

  async queryHeadState() {
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

  async commit(utxos: Commit) {
    const request = `/hydra/commit`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.commit",
      request,
      utxos,
      this.retry
    );
  }

  async decommit(utxos: Commit, wait: boolean = false) {
    const request = `/hydra/decommit?wait=${wait}`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.decommit",
      request,
      utxos,
      this.retry
    );
  }

  async buildTx(tx: any) {
    const request = `/hydra/tx`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.buildTx",
      request,
      tx,
      this.retry
    );
  }

  async submitTx(txModal: TxModal) {
    const request = `/hydra/submit`;
    return await post(
      this.kuberHydraServiceInstance,
      "KuberHydraService.submitTx",
      request,
      txModal,
      this.retry
    );
  }
}
