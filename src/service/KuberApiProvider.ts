import axios, { AxiosInstance } from "axios";
import { CommonProtocolParameters } from "libcardano-wallet/utils/types";
import { get, post } from "../utils/http";
import { cborBackend } from "cbor-rpc";
import { RetryConfig } from "../utils/type";
import { UTxO } from "libcardano/cardano/serialization/txinout";
import { toUTxO } from "../utils/typeConverters";
import { HexString } from "libcardano/cardano/serialization";
import { KuberProvider } from "./KuberProvider";

export class KuberApiProvider extends KuberProvider {
  axios: AxiosInstance;
  retry?: RetryConfig;

  constructor(kuberApiUrl: string, apiKey?: string, retry?: RetryConfig) {
    super();
    const config: any = { baseURL: kuberApiUrl };
    if (apiKey) {
      config.headers = { "api-key": apiKey };
    }
    this.axios = axios.create(config);
    this.retry = retry;
  }

  async queryUTxOByAddress(address: string): Promise<UTxO[]> {
    const request = `/api/v3/utxo?address=${address}`;
    const response = await get(this.axios, "KuberApiProvider.queryUTxOByAddress", request, this.retry);
    return toUTxO(response);
  }

  async queryUTxOByTxIn(txIn: string): Promise<UTxO[]> {
    const request = `/api/v3/utxo?txin=${encodeURIComponent(txIn)}`;
    const response = await get(this.axios, "KuberApiProvider.queryUTxOByTxIn", request, this.retry);
    return toUTxO(response);
  }

  async queryProtocolParameters(): Promise<CommonProtocolParameters> {
    const request = `/api/v3/protocol-params`;
    const response = await get(this.axios, "KuberApiProvider.queryProtocolParameters", request, this.retry);
    return response;
  }

  async querySystemStart() {
    const request = `/api/v3/genesis-params`;
    return await get(this.axios, "KuberApiProvider.querySystemStart", request, this.retry);
  }

  async queryChainTip() {
    const request = `/api/v3/chain-point`;
    return await get(this.axios, "KuberApiProvider.queryChainTip", request, this.retry);
  }

  /**
   * Build a transaction with kuber.
   * The built transaction will already have exact min-fee, exact execution-units and extra change output if necessary.
   * The transaction will be ready to be signed and submitted.
   * **Note** It important to remember that the transaction returned by kuber api
   *  and the transaction returned by kuber-client might be different due to reason mentioned here
   * <a href="https://github.com/Emurgo/cardano-serialization-lib/issues/429">cardano-serialization-lib/issues</a>
   * @param cip30Instance Browser cip30 provider instance obtained with enable()
   * @param buildRequest  Object following Kuber's transaction builder JSON spec
   * @param autoAddCollateral Add collateral from provider. Kuber automatically picks collateral.
   *  set this to true if you want to specify exact collateral utxo.
   * @returns A new rejected Promise.
   */
  async buildTx(txBuilder: any, submit: boolean = false) {
    const request = `/api/v1/tx?submit=${submit}`;
    return await post(this.axios, `KuberApiProvider.buildTx_&_submit=${submit}`, request, txBuilder, this.retry);
  }

  /**
   * Submit a transaction with kuber's submit API. Note that kuber's submit api is limted to current era transaction only
   * @param tx Browser Transaction to be submitted
   * @param buildRequest  Object following Kuber's transaction builder JSON spec
   * @returns A new rejected Promise.
   */
  async submitTx(cborString: HexString) {
    const request = `/api/v1/tx/submit`;
    const hasWitness = Object.keys(cborBackend.decode(Buffer.from(cborString, "hex"))[1]).length != 0;
    const parsedKuberSubmitObject = {
      tx: {
        cborHex: cborString,
        type: hasWitness ? "Witnessed Tx ConwayEra" : "Unwitnessed Tx ConwayEra",
        description: "",
      },
    };
    return await post(this.axios, "KuberApiProvider.submitTx", request, parsedKuberSubmitObject, this.retry);
  }
  async calculateMinFee(tx: string): Promise<BigInt> {
    return post(this.axios, "KuberApiProvider.calculateMinFee", "api/v1/tx/fee", tx, this.retry).then((res) => {
      return res.text().then((txt: any) => {
        return BigInt(txt);
      });
    });
  }
}
