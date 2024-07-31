import { Buffer } from "buffer";
import {
  AssetMap,
  CIP30Instance,
  CIP30Provider,
  NativeAsset,
  NativeAssetUtf8,
  TxResponseModal,
  AssetMapUtf8,
  HexString,
  VkeyWitnessCcdl,
  Network,
  SignatureResponse,
  RawWitnessSet,
  RawTx,
  Address
} from "./types";
import backend from "./cbor";

type Transaction = any

function decodeAssetName(asset: string): string {
  try {
    return Buffer.from(asset, "hex").toString("utf-8");
  } catch (e) {
    return "0x" + asset;
  }
}

export class WalletBalance {
  lovelace: bigint;
  multiassets: AssetMap;
  constructor(lovelace: bigint, multiAssets: AssetMap) {
    this.lovelace = lovelace;
    this.multiassets = multiAssets;
  }

  multiAssetsUtf8(): AssetMapUtf8 {
    const assetMap = {};
    for (let policy in this.multiassets) {
      let tokens = this.multiassets[policy];
      let utf8Tokens: Record<string, bigint> = {};
      for (let token in tokens) {
        utf8Tokens[decodeAssetName(token)] = tokens[token];
      }
    }
    return assetMap;
  }

  multiAssetList(): NativeAsset[] {
    const assetList: NativeAsset[] = [];
    for (let policy in this.multiassets) {
      const tokens = this.multiassets[policy];
      for (let token in tokens) {
        console.log(policy, token, tokens[token]);
        assetList.push({
          tokenName: token,
          policy: policy,
          quantity: tokens[token],
        });
      }
    }
    return assetList;
  }
  multiAssetUtf8List(): NativeAssetUtf8[] {
    // @ts-ignore
    const list: NativeAssetUtf8[] = this.multiAssetList();
    list.forEach((v) => (v.utf8Name = decodeAssetName(v.tokenName)));
    return list;
  }

  static async fromProvider(provider: CIP30Instance): Promise<WalletBalance> {
    const utxos = (await provider.getUtxos()).map((u) =>
      backend.decode(Buffer.from(u, "hex"))
    );
    let adaValue=BigInt(0)
    const maBalance: Record<string, Record<string, bigint>> = {};
    utxos.forEach(utxo=>{
      const value: [bigint, Map<Buffer, Map<Buffer, bigint>>] | bigint = utxo[1][1];
      let adaValue;
      if (Array.isArray(value)) {
        adaValue = utxo[0]
        const map = value[1] as Map<Buffer, Map<Buffer, bigint>>;
        const resultRecord: Record<string, Record<string, bigint>> = {};
  
        for (const [policyBuffer, assetMap] of map.entries()) {
          // Convert the key Buffer to a hex string
          const policyHex = policyBuffer.toString("hex");
          if(maBalance[policyHex]===undefined){
            maBalance[policyHex]={}
          }
          const assetToAmount: Record<string, bigint> =  maBalance[policyHex]
  
          for (const [assetName, quantity] of assetMap.entries()) {
            // Convert the inner key Buffer to a hex string
            const assetNameHex = assetName.toString("hex");
            const existing=assetToAmount[assetNameHex]
            if(existing){
                assetToAmount[assetNameHex]=existing + quantity              
            }else{
              assetToAmount[assetNameHex]=existing
            }
          }  
        }
      } else {
        adaValue =value as BigInt
      }

    })
    return new WalletBalance(adaValue, maBalance);

  }
  static zero(): WalletBalance {
    return new WalletBalance(BigInt(0), {});
  }
}

declare global {
  interface Window {
    cardano: Record<string, CIP30Provider>;
  }
}

function txOrStringToString(txOrStr: HexString | Transaction): string {
  return typeof txOrStr === "string" ? txOrStr : backend.encode(txOrStr).toString('hex');
}
function txOrStringToTx(txOrStr: HexString | Transaction): Transaction {
  return typeof txOrStr === "string" ?backend.decode(Buffer.from(txOrStr,'hex')) : txOrStr;
}

export async function submitTx(
  provider: CIP30Instance,
  txOrStr: Transaction | HexString
): Promise<unknown> {
  return provider.submitTx(txOrStringToString(txOrStr));
}

// vkeywitness = [ $vkey, $signature ]
//
// transaction_witness_set =
//   { ? 0: [* vkeywitness ]
//   , ? 1: [* native_script ]
//   , ? 2: [* bootstrap_witness ]
//   , ? 3: [* plutus_v1_script ]
//   , ? 4: [* plutus_data ]
//   , ? 5: [* redeemer ]
//   , ? 6: [* plutus_v2_script ] ; New
//   }
//
// transaction =
//   [ transaction_body
//   , transaction_witness_set
//   , bool
//   , auxiliary_data / null
//   ]
export const fromBytes = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("hex");

export const toBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 === 0 && /^[0-9A-F]*$/i.test(hex))
    return Buffer.from(hex, "hex");

  return Buffer.from(hex, "utf-8");
};
export const deserializeTx = (tx: string):RawTx =>
  backend.decode(Buffer.from(tx,'hex'));

export const deserializeTxWitnessSet = (txWitnessSet: string):RawWitnessSet =>
  backend.decode(Buffer.from(txWitnessSet,'hex'));

export function mergeTxAndWitnessHexWithCborlib(
  _tx: Transaction | string,
  witnessesRaw: HexString
): string {
  function updateSource(source: VkeyWitnessCcdl[], target: VkeyWitnessCcdl[]) {
    const existing = new Set(source.map((x) => x[0]));
    target.forEach((vkeyWitness) => {
      if (!existing.has(vkeyWitness[0])) {
        source.push(vkeyWitness);
      }
    });
  }
  const newWitnessSet = backend.decode(Buffer.from(witnessesRaw, "hex"));
  const txHex = txOrStringToString(_tx);
  const tx = backend.decode(Buffer.from(txHex, "hex"));
  console.log(tx);
  const oldWitnessSet: Map<number, any> = tx[1];
  const newVkeys: any = newWitnessSet.get(0);
  if (newVkeys) {
    if (oldWitnessSet) {
      const oldVkeys = oldWitnessSet.get(1);
      if (oldVkeys) {
        updateSource(oldVkeys, newVkeys);
      } else {
        // try to insert the vkeyList at the beginning
        // without reordering other keys
        const mp = new Map();
        mp.set(0, newVkeys);
        Array.from(oldWitnessSet.keys()).forEach((key) => {
          mp.set(key, oldWitnessSet.get(key));
        });
        tx[1] = mp;
      }
    } else {
      tx[1] = newWitnessSet;
    }
  } else {
    console.warn(
      "mergeTxAndWitness",
      "New Witness set is empty",
      newWitnessSet
    );
    return txHex;
  }
  console.log(tx);
  return backend.encode(tx).toString("hex");
}


export function mergeSignatures(
  txWitnessSet: RawWitnessSet,
  newSignatures: RawWitnessSet
): RawWitnessSet {

  const newkeyWitnesses =newSignatures.get(0)!;
  if(!txWitnessSet){
    return newSignatures
  }
  const finalWitness= new Map(txWitnessSet)
  const finalVkeyWitness=finalWitness.get(0)
  if(finalVkeyWitness ===undefined){
    finalWitness.set(0,newkeyWitnesses)
  }else{
    finalVkeyWitness.push(...newkeyWitnesses)
  }
  return finalWitness;
}



export class Kuber {
  providerUrl: string;
  constructor(provierUrl: string) {
    if (provierUrl.endsWith("/")) {
      this.providerUrl = provierUrl;
    } else {
      this.providerUrl = provierUrl + "/";
    }
  }
  /**
   * Submit a transaction with kuber's submit API. Note that kuber's submit api is limted to current era transaction only
   * @param tx Browser Transaction to be submitted
   * @param buildRequest  Object following Kuber's transaction builder JSON spec
   * @returns A new rejected Promise.
   */
  submit(tx: Transaction): Promise<TxResponseModal> {
    return this.call("POST", "api/v1/tx/submit", Buffer.from(tx.to_bytes()), {
      "content-type": "application/cbor",
    })
      .then((res) => res.text())
      .then((str) => {
        return Kuber.parseJson(str).tx;
      });
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
  async build(buildRequest: any): Promise<string> {
    const txFromKuber = await this.call('POST','/api/v1/tx',JSON.stringify(buildRequest),{'content-type': 'application/json'});
    return await txFromKuber.json()
  }
  /**
   * Build a transaction with kuber. This function adds the available Utxos in the wallet to selection
   * @param cip30Instance Browser cip30 provider instance obtained with enable()
   * @param buildRequest  Object following Kuber's transaction builder JSON spec
   * @param autoAddCollateral Add collateral from provider. Kuber automatically picks collateral.
   *  set this to true if you want to specify exact collateral utxo.
   * @returns A new rejected Promise.
   */
  async buildWithProvider(
    cip30Instance: CIP30Instance | CIP30Wallet,
    buildRequest: Record<string, any>,
    autoAddCollateral = false
  ): Promise<string> {
    const instance = (cip30Instance as CIP30Wallet).instance || cip30Instance;
    const walletUtxos = await instance.getUtxos();
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
      buildRequest.selection = concat(buildRequest.selection, walletUtxos);
    } else {
      buildRequest.selections = concat(buildRequest.selections, walletUtxos);
    }

    if (!buildRequest.inputs && !buildRequest.selections) {
      throw Error(
        "Expectation Failed : No Utxos available as `input` or `selection`"
      );
    }
    //@ts-ignore
    if (autoAddCollateral && instance.getCollateral) {
      if (!buildRequest.collateral && !buildRequest.collaterals) {
        buildRequest.collaterals = await instance.getCollateral();
      }
    }
    console.log(
      "provider buildrequest post-concat: " + JSON.stringify(buildRequest)
    );
    const builtTransaction = await this.build(buildRequest);
    return builtTransaction;
  }

  async getScriptPolicy(policy: Record<string, any>): Promise<string> {
    return this.call("POST", "api/v1/scriptPolicy", JSON.stringify(policy), {
      "content-type": "application/json",
    }).then((res) => {
      return res.text();
    });
  }

  async calculateMinFee(tx: Transaction): Promise<BigInt> {
    return this.call("POST", "api/v1/tx/fee", tx.to_bytes(), {
      "content-type": "application/json",
    }).then((res) => {
      return res.text().then((txt) => {
        return BigInt(txt);
      });
    });
  }
  private call(
    method: string,
    url: string,
    data: BodyInit,
    headers?: HeadersInit
  ): Promise<Response> {
    return fetch(
      // eslint-disable-next-line max-len
      `${this.providerUrl}${url}`,
      {
        mode: "cors",
        method: method,
        body: data,
        headers: headers,
      }
    )
      .catch((e) => {
        console.error(`${this.providerUrl}${method}`, e);
        throw Error(`Kubær API call : ` + e.message);
      })
      .then((res) => {
        if (res.status === 200) {
          return res;
        } else {
          return res.text().then((txt) => {
            let json: any;
            try {
              json = JSON.parse(txt);
            } catch (e) {
              return Promise.reject(
                Error(`KubærApi [Status ${res.status}] : ${txt}`)
              );
            }
            if (json) {
              return Promise.reject(
                Error(
                  `KubærApi [Status ${res.status}] : ${
                    json.message ? json.message : txt
                  }`
                )
              );
            } else {
              return Promise.reject(
                Error(`KubærApi [Status ${res.status}] : ${txt}`)
              );
            }
          });
        }
      });
  }
  private static parseJson(str: string): any {
    try {
      return JSON.parse(str);
    } catch (e: any) {
      throw `KubærApi response JSON parse failed : ${e.message || e} : ${str}`;
    }
  }
}

export class CIP30Wallet {
  static usedAddresses() {
    throw new Error("Method not implemented.");
  }
  apiVersion: string;
  icon: string;
  name: string;
  instance: CIP30Instance;

  constructor(provider: CIP30Provider, instance: CIP30Instance) {
    this.apiVersion = provider.apiVersion;
    this.name = provider.apiVersion;
    this.icon = provider.icon;
    this.instance = instance;
  }
  submitTx(txStr: string): Promise<unknown> {
    console.info("CIP30Wallet.submitTx", {
      tx: txStr,
    });
    return this.instance.submitTx(txStr);
  }
  async getSignedTx(txOrStr: string, partial?: Boolean): Promise<string> {
    try {
      const tx = deserializeTx(txOrStr);
      const txWitnessSet = tx[1]
      const newWitnessSet = await this.instance.signTx(txOrStr, partial);
      const newSignature = deserializeTxWitnessSet(newWitnessSet)
      
      tx[1] = mergeSignatures(txWitnessSet, newSignature);
      const reEncodedSignedTx= backend.encode(tx)
      const signedHex=reEncodedSignedTx.toString('hex')
      console.log(tx)
      console.log("Cip30Wallet.getSignedTx",{
        unsignedTx:txOrStr,
        signature: newWitnessSet,
        rawSignedTx:  tx,
        signedTx: signedHex
      })
      return signedHex
    } catch (error) {
      console.error("Cip30Wallet.getSignedTx",error)
      throw new Error(`An error occurred during signing: ${error}`);
    }
  }
  async signData(address: string, data: string): Promise<string> {
    return this.instance.signData(address, data).then((response) => {
      return response.signature;
    });
  }
  // changeAddress(): Promise<Address> {
  //   return this.instance.getChangeAddress().then((address) => {
  //     return Address.from_hex(address);
  //   });
  // }
  networkId(): Promise<Network> {
    return this.instance.getNetworkId().then((id) => {
      if (id == 0) {
        return Network.Mainnet;
      } else {
        return Network.Testnet;
      }
    });
  }
  networkIdNumber(): Promise<Network> {
    return this.instance.getNetworkId();
  }
  // rewardAddresses(): Promise<Address[]> {
  //   return this.instance.getRewardAddresses().then((result) => {
  //     return result.map((r) => Address.from_hex(r));
  //   });
  // }
  // unusedAddresses(): Promise<Address[]> {
  //   return this.instance.getUnusedAddresses().then((result) => {
  //     return result.map((r) => Address.from_hex(r));
  //   });
  // }
  // usedAddresses(): Promise<Address[]> {
  //   return this.instance.getUsedAddresses().then((result) => {
  //     return result.map((r) => Address.from_hex(r));
  //   });
  // }
  // utxos(): Promise<TransactionUnspentOutput[]> {
  //   return this.instance.getUtxos().then((result) => {
  //     return result.map((r) => TransactionUnspentOutput.from_hex(r));
  //   });
  // }
  // collaterals(): Promise<TransactionUnspentOutput[]> {
  //   return this.instance.getUtxos().then((result) => {
  //     return result.map((r) => TransactionUnspentOutput.from_hex(r));
  //   });
  // }
  calculateBalance(): Promise<WalletBalance> {
    return WalletBalance.fromProvider(this.instance);
  }
  static listProviders(): CIP30ProviderProxy[] {
    const pluginMap = new Map();
    if (!window.cardano) {
      return [];
    }
    Object.keys(window.cardano).forEach((x) => {
      const plugin: CIP30Provider = window.cardano[x];
      //@ts-ignore
      if (plugin.enable && plugin.name) {
        pluginMap.set(plugin.name, plugin);
      }
    });
    const providers = Array.from(pluginMap.values());
    console.info("Provides", providers);
    // yoroi doesn't work (remove this after yoroi works)
    return providers
      .map((p) => new CIP30ProviderProxy(p));
  }
}

export class CIP30ProviderProxy {
  apiVersion: string;
  enable(): Promise<CIP30Wallet> {
    return this.__provider
      .enable()
      .then((instance) => new CIP30Wallet(this.__provider, instance));
  }
  icon: string;
  isEnabled(): Promise<Boolean> {
    return this.__provider.isEnabled();
  }
  name: string;
  __provider: CIP30Provider;
  supportedExtensions?: Record<string,any>[]
  constructor(provider: CIP30Provider) {
    this.__provider = provider;
    this.apiVersion = provider.apiVersion;
    this.icon = provider.icon;
    this.name = provider.name;
    this.supportedExtensions=provider.supportedExtensions
  }
  
}

function to_bytes(): Uint8Array {
  throw new Error("Function not implemented.");
}
