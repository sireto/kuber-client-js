import {
  QueryAPIProvider,
  SubmitAPIProvider,
} from "libcardano-wallet";
import { 
  CommonProtocolParameters,
  CommonTxObject,} from "libcardano-wallet/utils/types";
import { Output,HexString, TxWitnessSet  } from "libcardano/cardano/serialization";
import { TxInput, UTxO } from "libcardano/cardano/serialization/txinout";
import { Cip30, Cip30Provider, Cip30ProviderWrapper } from "libcardano-wallet/cip30";
import {cborBackend} from "cbor-rpc"

export abstract class KuberProvider implements SubmitAPIProvider, QueryAPIProvider {
  abstract submitTx(tx: HexString): Promise<any>;
  abstract queryUTxOByAddress(addresss: string): Promise<UTxO[]>;
  abstract queryUTxOByTxIn(txIn: string):  Promise<UTxO[]>;
  abstract queryProtocolParameters(): Promise<CommonProtocolParameters>;


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
  abstract  buildTx (txBuilder: any, submit: boolean): Promise<CommonTxObject> ;


    /**
   * Build a transaction with kuber. This function adds the available Utxos in the wallet to selection
   * @param cip30Instance Browser cip30 provider instance obtained with enable()
   * @param buildRequest  Object following Kuber's transaction builder JSON spec
   * @param autoAddCollateral Add collateral from provider. Kuber automatically picks collateral.
   *  set this to true if you want to specify exact collateral utxo.
   * minimumLovelace
   * @returns A new rejected Promise.
   */
  async buildWithWallet(
    cip30OrProvider: Cip30 | Cip30Provider,
    buildRequest: Record<string, any>,
    autoAddCollateral = false,
    estimatedSpending?: number|bigint
  ): Promise<CommonTxObject> {
    const cip30:Cip30 = (cip30OrProvider as Cip30Provider).toProtableCip30? (cip30OrProvider as Cip30Provider).toProtableCip30(): cip30OrProvider as Cip30;
    const walletUtxos = await cip30.getUtxos();
    let selectedUtxos = walletUtxos;
    
    if (estimatedSpending) {
      let toBigInt = (x: number | bigint) => {
        if (typeof x == "number") return BigInt(x);
        else return x;
      };
      estimatedSpending=toBigInt(estimatedSpending)
      let adaValue = BigInt(0);

      let minimumSelections: number = 1;
      walletUtxos.forEach((utxo) => {
        const utxoDecoded=cborBackend.decode(Buffer.from(utxo,"hex"))
        const txOut=Output.fromCborObject(utxoDecoded[1])
        adaValue +=txOut.value.lovelace
        if (adaValue >= (estimatedSpending as bigint)) {
            selectedUtxos = walletUtxos.slice(0, minimumSelections);
            return;
        }
        minimumSelections++;
      });
    }
    function concat(source: any, target: string[]) {
      if (source) {
        if (Array.isArray(source)) {
          return target.concat(source);
        } else {
          target.push(source);
          return target;
        }
      } else {
        return target;
      }
    }
    if (buildRequest.selection) {
      buildRequest.selection = concat(buildRequest.selection, selectedUtxos);
    } else {
      buildRequest.selections = concat(buildRequest.selections, selectedUtxos);
    }
    if(!buildRequest.changeAddress){
      buildRequest.changeAddress= await cip30.getChangeAddress()
    }

    if (!buildRequest.inputs && !buildRequest.selections) {
      throw Error(
        "Expectation Failed : No Utxos available as `input` or `selection`"
      );
    }
    if (autoAddCollateral && cip30.getCollateral) {
      if (!buildRequest.collateral && !buildRequest.collaterals) {
        buildRequest.collaterals = await cip30.getCollateral();
      }
    }
    return this.buildTx(buildRequest,false);
  }
  async buildAndSignWithWallet(
    cip30OrProvider: Cip30 | Cip30Provider,
    buildRequest: Record<string, any>,
    autoAddCollateral = false,
    estimatedSpending?: number|bigint
  ):Promise<{
    newWitnesses: TxWitnessSet;
    newWitnessesBytes: Buffer;
    updatedTx: any[];
}>{
    const cip30:Cip30Provider = 
      (cip30OrProvider as Cip30Provider).toProtableCip30
        ? (cip30OrProvider as Cip30Provider)
        : new Cip30ProviderWrapper(cip30OrProvider as Cip30);

    const built = await this.buildWithWallet(cip30OrProvider,buildRequest,autoAddCollateral,estimatedSpending)
    return cip30.signTx(built.cborHex,true)

  }
  async buildAndSubmitWithWallet(
    cip30OrProvider: Cip30 | Cip30Provider,
    buildRequest: Record<string, any>,
    autoAddCollateral = false,
    estimatedSpending?: number|bigint
  ):Promise<any>{
    const signed = await this.buildAndSignWithWallet(cip30OrProvider,buildRequest,autoAddCollateral,estimatedSpending)
    return cip30OrProvider.submitTx(cborBackend.encode(signed.updatedTx).toString('hex'))
  }

  /**
   * Waits for a transaction output to vanish.
   * @param utxo The transaction ID or UTxO identifier.
   * @param pollIntervalMs The interval in milliseconds to poll for the UTxO.
   * @param timeoutMs The maximum time in milliseconds to wait.
   * @returns A promise that resolves with the total time spent waiting in milliseconds when the UTxO vanishes.
   */
  async waitForUtxoConsumption(
    txin: TxInput,
    timeoutMs: number = 80000,
    logPoll: boolean = false,
    pollIntervalMs: number = 5000,
  ): Promise<number> {
    const startTime = Date.now();
    const txHash=txin.txHash.toString('hex')
    const utxo = txHash+'#' + txin.index
    while (Date.now() - startTime < timeoutMs) {
      const utxos = await this.queryUTxOByTxIn(utxo);
      // UTxO type has txIn which contains txHash (Buffer) and index.
      // We need to check for both to uniquely identify a UTxO.
      const txExists = utxos.some(utxo =>
        
        utxo.txIn.txHash.compare(txin.txHash) === 0 &&
        utxo.txIn.index === txin.index
      );

      if (logPoll) {
        console.log(`Checking UTxO: ${utxo}. Is not spent.`);
      }

      if (!txExists) {
        return Date.now() - startTime; // UTxO has vanished
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error(`Timeout waiting for UTxO ${utxo} to be spent.`);
  }

  /**
   * Waits for a transaction to be confirmed by querying UTxO by TxIn.
   * Confirmation is determined by checking if the query returns more than one UTxO.
   *
   * @param txHash - The transaction hash (without the #0).
   * @param timeoutMs - Timeout in milliseconds.
   * @param pollIntervalMs - Polling interval in milliseconds (default: 3000ms).
   * @param logPoll - If true, logs the polling status.
   * @returns A Promise that resolves with the total time spent waiting in milliseconds if confirmed, or rejects on timeout.
   */
  async waitForTxConfirmation(
    txHash: string,
    timeoutMs: number =80000,
    logPoll: boolean = false,
    pollIntervalMs: number = 5000,
  ): Promise<number> {
    const txIn = `${txHash}#0`;
    const start = Date.now();

    while ((Date.now() - start) < timeoutMs) {
      try {
        const result = await this.queryUTxOByTxIn(txIn);

        if (logPoll) {
          console.log(`Polling for confirmation of tx: ${txHash}. Result length: ${result.length}`);
        }

        if (Array.isArray(result) && result.length > 1) {
          return Date.now() - start; // Transaction confirmed
        }
      } catch (err: any) {
        console.warn(`Error while querying UTxO for tx ${txHash}:`, err.message);
        // Optional: continue retrying even if one call fails
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Timeout waiting for transaction ${txHash} confirmation.`);
  }
}
