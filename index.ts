import {
  AssetName,
  Assets,
  hash_auxiliary_data,
  ScriptHash,
  ScriptHashes,
  Transaction,
  TransactionBody,
  TransactionUnspentOutput,
  TransactionWitnessSet,
  Value,
  Vkeywitnesses,
  BigNum,  
} from '@emurgo/cardano-serialization-lib-asmjs';
import {Buffer} from 'buffer'
import { AssetMap, CIP30Instace, CIP30Provider, NativeAsset, NativeAssetUtf8, TxResponseModal, AssetMapUtf8 } from './types';

function decodeAssetName(asset:string): string {
    try {
        return Buffer.from(asset, "hex").toString('utf-8')
    } catch (e) {
        return "0x"+asset
    }
}

export class WalletBalance {
    lovelace : bigint;
    multiassets: AssetMap;
    constructor(lovelace:bigint,multiAssets : AssetMap){
        this.lovelace=lovelace
        this.multiassets=multiAssets
    }

    multiAssetsUtf8():AssetMapUtf8{
        const assetMap = {}
        for (let policy in this.multiassets) {
            let tokens = this.multiassets[policy];
            let utf8Tokens:Record<string,bigint> = {}
            for (let token in tokens) {
                utf8Tokens[decodeAssetName(token)]=tokens[token]
              }
        }
        return assetMap
    }   

    multiAssetList():NativeAsset[]{
        const assetList: NativeAsset[] = []
        for (let policy in this.multiassets) {
            const tokens = this.multiassets[policy];
            for (let token in tokens) {
              console.log(policy, token, tokens[token]);
                assetList.push({
                  tokenName: token,
                  policy: policy,
                  quantity: tokens[token]
                });
              }
        }  
        return assetList;
    }
    multiAssetUtf8List():NativeAssetUtf8[]{
        // @ts-ignore
        const list : NativeAssetUtf8[]=this.multiAssetList()
        list.forEach(v => v.utf8Name=decodeAssetName(v.tokenName))
        return list
    }
    static async fromProvider(provider:CIP30Instace): Promise<WalletBalance>{
        const utxos : TransactionUnspentOutput[] = (await provider.getUtxos()).map(u =>
            TransactionUnspentOutput.from_bytes(Buffer.from(u, "hex")),
        );
        const assets: Map<ScriptHash , Map<AssetName,BigNum>> =new Map()
        let adaVal = BigNum.zero()
        
        utxos.forEach( (utxo)=> {
            const value: Value = utxo.output()
            .amount();
            adaVal = adaVal.checked_add(value.coin())
            if (value.multiasset()) {
            const multiAssets: ScriptHashes = value.multiasset()!.keys();
            for (let j = 0; j < multiAssets.len(); j++) {
                const policy: ScriptHash = multiAssets.get(j);
                const policyAssets:Assets = value.multiasset()!.get(policy)!;
                const assetNames = policyAssets.keys();
                let assetNameMap
                assets.get(policy)
                if (!assetNameMap) {
                assets.set(policy, assetNameMap = new Map());
                }
                for (let k = 0; k < assetNames.len(); k++) {
                const policyAsset: AssetName = assetNames.get(k);
                let quantity = policyAssets.get(policyAsset)!;
                const oldQuantity: BigNum = assetNameMap.get(policyAsset)
                if (oldQuantity) {
                    quantity = oldQuantity.checked_add(quantity)
                }
                assetNameMap.set(policyAsset, quantity)
                }
            }
            }
        })
        const assetObj :AssetMap={}
        assets.forEach((k:Map <AssetName,BigNum>,v:ScriptHash,)=>{
            // eslint-disable-next-line no-multi-assign
            const policy:any= assetObj[Buffer.from(v.to_bytes()).toString('hex')]={}
            k.forEach((q:BigNum,a :AssetName)=>{
                    const assetName = Buffer.from(a.name())
                    policy[assetName.toString('hex')]=BigInt(q.to_str())
            })
        })
        return new WalletBalance(BigInt(adaVal.to_str()),assetObj)
    }
    static zero():WalletBalance{
        return new WalletBalance(BigInt(0),{})
    }
}

declare global {
    interface Window {
      cardano: Record<string,CIP30Provider>;
    }
}

function txOrStringToString(txOrStr : string|Transaction): string{
  return typeof txOrStr === "string" ? txOrStr :(txOrStr as Transaction).to_hex()
}
function txOrStringToTx(txOrStr : string|Transaction):Transaction{
  return typeof txOrStr === "string" ? Transaction.from_hex(txOrStr) : txOrStr 
}

export async function signAndSubmit(provider: CIP30Instace,txOrString : Transaction | string):Promise<Transaction> {
  const signedTx= await signTx(provider,txOrString)
  await submitTx(provider,signedTx)
  return signedTx
}

export async function submitTx(provider: CIP30Instace, txOrStr : Transaction|string):Promise<unknown> {
  return provider.submitTx(txOrStringToString(txOrStr))
}

export async function signTx(provider: CIP30Instace,txOrStr : string | Transaction):Promise<Transaction> {
  let tx = txOrStringToTx(txOrStr)
  const witnesesRaw = await provider.signTx(
      tx.to_hex(),
      true
  )
    const walletWitnesses = TransactionWitnessSet.from_bytes(Buffer.from(witnesesRaw, "hex"))
    const newWitnessSet = TransactionWitnessSet.new();
    if (tx.witness_set().bootstraps()){
      newWitnessSet.set_bootstraps(tx.witness_set().bootstraps()!);
    }
    if (tx.witness_set().plutus_data())
      newWitnessSet.set_plutus_data(tx.witness_set().plutus_data()!);
    if (tx.witness_set().plutus_scripts())
      newWitnessSet.set_plutus_scripts(tx.witness_set().plutus_scripts()!)
    if (tx.witness_set().redeemers())
      newWitnessSet.set_redeemers(tx.witness_set().redeemers()!)
    if (tx.witness_set().native_scripts())
      newWitnessSet.set_native_scripts(tx.witness_set().native_scripts()!)
    
      // add the new witness.
    if (tx.witness_set().vkeys() && newWitnessSet.vkeys()) {
      const newVkeySet=Vkeywitnesses.new()

      for (let i=0;i<tx.witness_set().vkeys()!.len();i++) {
        newVkeySet.add(tx.witness_set().vkeys()!.get(i))
      }
      for (let i=0;i<walletWitnesses.vkeys()!.len();i++) {
        newVkeySet.add(walletWitnesses.vkeys()!.get(i))
      }
      newWitnessSet.set_vkeys(newVkeySet)

    } else if(walletWitnesses.vkeys()) {
      newWitnessSet.set_vkeys(walletWitnesses.vkeys()!)
    }
    return Transaction.new(tx.body(), newWitnessSet, tx.auxiliary_data());
}

export  function parseCardanoTransaction(_tx: string) : Transaction{
  let tx:Transaction;
  try {
      const txArray=Uint8Array.from(Buffer.from(_tx, 'hex'))
      tx = Transaction.from_bytes(txArray)
      const _txBody = tx.body()
      const txBody = TransactionBody.new_tx_body(_txBody.inputs(),_txBody.outputs(),_txBody.fee())
      if (_txBody.mint()) {
          txBody.set_mint(_txBody.mint()!)
      }
      if (tx.auxiliary_data()) {
          txBody.set_auxiliary_data_hash(hash_auxiliary_data(tx.auxiliary_data()!))
      }
      if(_txBody.collateral())
      txBody.set_collateral(_txBody.collateral()!)
      if(_txBody.mint())
          txBody.set_mint(_txBody.mint()!)
      if(_txBody.required_signers()) {
          txBody.set_required_signers(_txBody.required_signers()!)
      }
      if (_txBody.ttl_bignum()){
          txBody.set_ttl(_txBody.ttl_bignum()!)
      }
      if(_txBody.validity_start_interval_bignum())
        txBody.set_validity_start_interval_bignum(_txBody.validity_start_interval_bignum()!)
      if(_txBody.network_id && _txBody.network_id()){
          txBody.set_network_id(_txBody.network_id()!)
      }
      if(_txBody.reference_inputs())  {
          txBody.set_reference_inputs(_txBody.reference_inputs()!)
      }
      if(_txBody.script_data_hash()){
          txBody.set_script_data_hash(_txBody.script_data_hash()!)
      }
      if(_txBody.collateral_return()){
          txBody.set_collateral_return(_txBody.collateral_return()!)
      }
      if(_txBody.total_collateral()){
          txBody.set_total_collateral(_txBody.total_collateral()!)
      }
  } catch (e:any) {
    throw new Error("Invalid transaction string :"+ e.message)
  }
    return Transaction.new(tx.body(), tx.witness_set(), tx.auxiliary_data());
}

export function listProviders() :Array<CIP30Provider> {
  const pluginMap = new Map()
  if(!window.cardano){
    return []
  }
  Object.keys(window.cardano).forEach( x =>{
    const plugin:CIP30Provider=window.cardano[x]
    //@ts-ignore
    if (plugin.enable && plugin.name) {
      pluginMap.set(plugin.name, plugin)
    }
  })
  const providers=Array.from(pluginMap.values())
  console.log("Provides",providers)
  // yoroi doesn't work (remove this after yoroi works)
  return providers.filter(x => x.name !="yoroi")
}


export class Kuber{
    providerUrl: string;
    constructor(provierUrl: string){
      if(provierUrl.endsWith('/')){
        this.providerUrl=provierUrl
      }else{
        this.providerUrl=provierUrl+"/"
      }
    }
    /**
     * Submit a transaction with kuber's submit API. Note that kuber's submit api is limted to current era transaction only
     * @param tx Browser Transaction to be submitted
     * @param buildRequest  Object following Kuber's transaction builder JSON spec
     * @returns A new rejected Promise.
     */
    submit(tx: Transaction): Promise<TxResponseModal> {
      return this.call("POST", "api/v1/tx/submit", tx.to_bytes(), {
        "content-type": "application/cbor",
      }).then(
        res =>res.text()
      ).then(str=>{
        return Kuber.parseJson(str).tx
      })
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
    async build(buildRequest: Record<string, any>): Promise<Transaction> {
      return this.call(
        "POST",
        "api/v1/tx",
        JSON.stringify(buildRequest),
        { "content-type": "application/json" }
      ).then(
        res =>res.text()
      ).then(str=>{
        return parseCardanoTransaction(Kuber.parseJson(str).tx)
      })
    }
    /**
     * Build a transaction with kuber. This function adds the available Utxos in the wallet to selection
     * @param cip30Instance Browser cip30 provider instance obtained with enable()
     * @param buildRequest  Object following Kuber's transaction builder JSON spec
     * @param autoAddCollateral Add collateral from provider. Kuber automatically picks collateral.
     *  set this to true if you want to specify exact collateral utxo.
     * @returns A new rejected Promise.
     */
    async buildWithProvider(cip30Instance:CIP30Instace,buildRequest: Record<string, any>,autoAddCollateral=false): Promise<Transaction>{
        const walletUtxos = await cip30Instance.getUtxos()
        function concat(source:any,target:string[]){
            if(source ){
                if(Array.isArray(source)){
                    return target.concat(source)
                }else{
                    target.push(source)
                    return target
                }
            }else{
                return target
            }
        }
        if(buildRequest.selection){
            buildRequest.selection=concat(buildRequest.selection,walletUtxos)
        }else{
            buildRequest.selections=concat(buildRequest.selections,walletUtxos)
        }

        if(!buildRequest.inputs() && !buildRequest.selections){
            throw Error("Expectation Failed : No Utxos available as `input` or `selection`")
        }
        if(autoAddCollateral){
            if(!buildRequest.collateral && !buildRequest.collaterals){
                buildRequest.collaterals=await cip30Instance.getCollateral()
            }
        }
        return this.build(buildRequest)
    }

    async getScriptPolicy(policy: Record<string, any>): Promise<string> {
      return this.call("POST", "api/v1/scriptPolicy", JSON.stringify(policy), {
        "content-type": "application/json",
      }).then(res=>{
        return res.text()
      })
    }

    async calculateMinFee(tx:Transaction):Promise<BigInt>{
    return this.call("POST", "api/v1/tx/fee", tx.to_bytes(), {
        "content-type": "application/json",
      }).then(res=>{
        return res.text().then(txt=>{
            return BigInt(txt)
        })
      })
    }
    private call(method:string,url:string,data:BodyInit,headers?:HeadersInit):Promise<Response>{
      return fetch(
      // eslint-disable-next-line max-len
      `${this.providerUrl}${url}`,
      {
        mode: 'cors',
        method: method,
        body: data,
        headers: headers,
      },
    ).catch(e=>{
      console.error(`${this.providerUrl}${method}`, e)
      throw Error(`Kubær API call : `+e.message)
    }).then(res=>{
        if (res.status===200) {
            return res
        } else {
            return res.text().then(txt=>{
                let json :any
                try {
                    json = JSON.parse(txt)
                }catch(e){
                    return Promise.reject(Error(`KubærApi [Status ${res.status}] : ${txt}`)
                    )
                }
                if (json) {
                    return Promise.reject( Error(`KubærApi [Status ${res.status}] : ${json.message ? json.message : txt}`) )
                } else {
                    return Promise.reject( Error(`KubærApi [Status ${res.status}] : ${txt}`) )
                }
            })
        }
      })
    }
    private static parseJson(str:string):any{
    try{
        return JSON.parse(str);
        }catch(e:any){
            throw (`KubærApi response JSON parse failed : ${e.message||e} : ${str}`)
        }
    }
}
