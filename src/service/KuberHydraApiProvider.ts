import axios, { AxiosInstance } from "axios";
import { CommonProtocolParameters, CommonTxObject } from "libcardano-wallet/utils/types";
import { Commit, RetryConfig } from "../utils/type";
import { get, post } from "../utils/http";
import { toUTxO } from "../utils/typeConverters";
import { HexString, UTxO } from "libcardano/cardano/serialization";
import { cborBackend } from "cbor-rpc";
import { KuberProvider } from "./KuberProvider";
import { KuberApiProvider } from "./KuberApiProvider";
import {HydraHeadState,HydraHead, DecommitResult} from "../utils/hydraTypes"

export class KuberHydraApiProvider extends KuberProvider {
  axios: AxiosInstance;
  retry?: RetryConfig;
  public readonly l1Api: KuberApiProvider;

  constructor(kuberHydraBaseURL: string, retry?: RetryConfig) {
    super();
    this.axios = axios.create({
      baseURL: kuberHydraBaseURL,
    });
    if (retry) {
      this.retry = retry;
    }
    this.l1Api = new KuberApiProvider(kuberHydraBaseURL);
  }

  async queryUTxOByAddress(address: string): Promise<UTxO[]> {
    const request = `/hydra/query/utxo?address=${address}`;
    const response = await get(this.axios, "KuberHydraService.queryUTxOByAddress", request, this.retry);
    return toUTxO(response);
  }

  async queryUTxOByTxIn(txIn: string): Promise<UTxO[]> {
    const request = `/hydra/query/utxo?txin=${txIn.replace("#", encodeURIComponent("#"))}`;
    const response = await get(this.axios, "  KuberHydraService.queryUTxOByTxIn", request, this.retry);
    return toUTxO(response);
  }
  async queryUtxos() {
    const response = await get(this.axios, "  KuberHydraService.queryUTxOByTxIn", `/hydra/query/utxo`, this.retry);
    return toUTxO(response);
  }

  async queryProtocolParameters(): Promise<CommonProtocolParameters> {
    const request = `/hydra/query/protocol-parameters`;
    return await get(this.axios, "KuberHydraService.queryProtocolParameters", request, this.retry);
  }
  async queryHead(): Promise<HydraHead>{
    const request = `/hydra/query/head`;
    return await get(this.axios, "KuberHydraService.queryHead", request, this.retry);
  }

  async queryHeadState(): Promise<{ state: HydraHeadState }> {
    const request = `/hydra/query/state`;
    return await get(this.axios, "KuberHydraService.queryHeadState", request, this.retry);
  }

  async initialize(wait: boolean = false) {
    const request = `/hydra/init?wait=${wait}`;
    return await post(this.axios, "KuberHydraService.initialize", request, null, this.retry);
  }

  async close(wait: boolean = false) {
    const request = `/hydra/close?wait=${wait}`;
    return await post(this.axios, "KuberHydraService.close", request, null, this.retry);
  }

  async fanout(wait: boolean = false) {
    const request = `/hydra/fanout?wait=${wait}`;
    return await post(this.axios, "KuberHydraService.fanout", request, null, this.retry);
  }

  async abort(wait: boolean = false) {
    const request = `/hydra/abort?wait=${wait}`;
    return await post(this.axios, "KuberHydraService.abort", request, null, this.retry);
  }

  async contest(wait: boolean = false) {
    const request = `/hydra/contest?wait=${wait}`;
    return await post(this.axios, "KuberHydraService.contest", request, null, this.retry);
  }

  async commit(utxos: Commit, submit: boolean = false): Promise<CommonTxObject> {
    const request = `/hydra/commit?submit=${submit}`;
    return await post(this.axios, "KuberHydraService.commit", request, utxos, this.retry);
  }
  async queryCommits(): Promise<Record<string, any>[]> {
    const request = `/hydra/query/commits`;
    return await get(this.axios, "KuberHydraService.getCommits", request, this.retry);
  }

  async decommit(tx:HexString, wait: boolean = false): Promise<DecommitResult> {
    const request = `/hydra/decommit?wait=${wait}`;
    const response = await post(this.axios, "KuberHydraService.decommit", request, {
      cborHex: tx,
      type: "Witnessed Tx ConwayEra",
      description: ""
    }, this.retry);
    return {
      ...response,
      decommitTx: {
        ...response.decommitTx,
        hash: response.decommitTx.txId,
      }
    };
  }

  async createDecommitTx(txIn: string): Promise<CommonTxObject> {
    const request = `/hydra/decommit?txin=${txIn.replace("#", encodeURIComponent("#"))}`;
    return await get(this.axios, "KuberHydraService.createDecommitTx", request, this.retry);
  }

  async buildTx(tx: any, submit: boolean = false): Promise<CommonTxObject> {
    const request = `/hydra/tx?submit=${submit}`;
    return await post(this.axios, "KuberHydraService.buildTx", request, tx, this.retry);
  }

  async submitTx(cborString: HexString): Promise<CommonTxObject> {
    const request = `/hydra/submit`;
    const hasWitness = Object.keys(cborBackend.decode(Buffer.from(cborString, "hex"))[1]).length != 0;
    const parsedKuberSubmitObject = {
        cborHex: cborString,
        type: hasWitness ? "Witnessed Tx ConwayEra" : "Unwitnessed Tx ConwayEra",
        description: "",
    };
    return await post(this.axios, "KuberApiProvider.submitTx", request, parsedKuberSubmitObject, this.retry);
  }

  /**
   * Waits for the head state to reach a specific state.
   *
   * @param expectedState - The expected head state (e.g., "Initializing", "Open").
   * @param timeoutMs - Timeout in milliseconds.
   * @param pollIntervalMs - Polling interval in milliseconds (default: 4000ms).
   * @param logPoll - If true, logs the polling status.
   * @returns A Promise that resolves with the total time spent waiting in milliseconds if the head state matches, or rejects on timeout.
   */
  async waitForHeadState(
    expectedState: HydraHeadState,
    timeoutMs: number = 80000,
    logPoll: boolean = false,
    pollIntervalMs: number = 4000,
  ): Promise<number> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const headState = await this.queryHeadState();

        if (logPoll) {
          console.log(`Polling head state: Expected "${expectedState}", Current "${headState.state}".`);
        }

        if (headState.state === expectedState) {
          return Date.now() - start;
        }
      } catch (err: any) {
        console.warn(`Error while querying head state:`, err.message);
        // Optional: continue retrying even if one call fails
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    const headState = await this.queryHeadState();
    if (headState.state === expectedState) {
      return Date.now() - start;
    }
    throw new Error(
      `Timeout: Head state did not reach "${expectedState}" within ${timeoutMs / 1000} seconds, current state is ${headState.state}.`,
    );
  }

  /**
   * Waits until a condition is met by repeatedly polling the HydraHead.
   *
   * @param predicate - A function that takes a HydraHead and returns true if the condition is met.
   * @param timeoutMs - Timeout in milliseconds (default: 80000ms).
   * @param pollIntervalMs - Polling interval in milliseconds (default: 4000ms).
   * @returns A Promise that resolves when the predicate returns true, or rejects on timeout.
   */
  async waitWhile(
    predicate: (head: HydraHead) => (boolean | Promise<boolean>),
    timeoutMs: number = 80000,
    pollIntervalMs: number = 4000,
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const head = await this.queryHead();
        if (await Promise.resolve(predicate(head)) === true) {
          return;
        }
      } catch (err: any) {
        console.warn(`Error while querying HydraHead:`, err.message);
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error(`Timeout: Condition not met within ${timeoutMs / 1000} seconds.`);
  }
}
