import {
  Address,
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
  Vkeywitness
} from '@emurgo/cardano-serialization-lib-asmjs';
import {Buffer} from 'buffer'
import { AssetMap, CIP30Instance, CIP30Provider, NativeAsset, NativeAssetUtf8, TxResponseModal, AssetMapUtf8, HexString, VkeyWitnessCcdl, Network } from './types';
//@ts-ignor
import Encoder  from './cbor/encoder'
import Decoder  from './cbor/decoder'
import { kuberBuilder, txHex_Kuber } from './kuberBuilder';

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
    static async fromProvider(provider:CIP30Instance): Promise<WalletBalance>{
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

function txOrStringToString(txOrStr : HexString|Transaction): string{
  return typeof txOrStr === "string" ? ((Transaction.from_hex(txOrStr)) as Transaction).to_hex() :(txOrStr as Transaction).to_hex()
}
function txOrStringToTx(txOrStr : HexString|Transaction):Transaction{
  return typeof txOrStr === "string" ? Transaction.from_hex(txOrStr) : txOrStr 
}


export async function submitTx(provider: CIP30Instance, txOrStr : Transaction|HexString):Promise<unknown> {
  return provider.submitTx(txOrStringToString(txOrStr))
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
export const fromBytes = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

export const toBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 === 0 && /^[0-9A-F]*$/i.test(hex))
    return Buffer.from(hex, 'hex');

  return Buffer.from(hex, 'utf-8');
};
export const deserializeTx = (tx: string) => Transaction
  .from_bytes(toBytes(tx));

export const deserializeTxWitnessSet = (txWitnessSet: string) => TransactionWitnessSet
  .from_bytes(toBytes(txWitnessSet));

export function mergeTxAndWitnessHexWithCborlib(_tx:Transaction|string,witnessesRaw: HexString):string{
  function updateSource(source:VkeyWitnessCcdl[],target : VkeyWitnessCcdl[]){
    const existing = new Set(source.map(x => x[0])) 
    target.forEach(vkeyWitness=>{
      if(!existing.has(vkeyWitness[0])){
        source.push(vkeyWitness)
      }
    })
  }
  const newWitnessSet = Decoder.decodeFirstSync(Buffer.from(witnessesRaw,'hex'))
  const txHex = txOrStringToString(_tx)
  const tx = Decoder.decodeFirstSync(Buffer.from(txHex,'hex'))
  console.log(tx)
  const oldWitnessSet:Map<number,any>=tx[1]
  const newVkeys:any=newWitnessSet.get(0)
  if(newVkeys){
    if(oldWitnessSet){
      const oldVkeys=oldWitnessSet.get(1)
      if(oldVkeys){
        updateSource(oldVkeys,newVkeys)
      }else{
        // try to insert the vkeyList at the beginning
        // without reordering other keys
        const mp = new Map()
        mp.set(0,newVkeys)
        Array.from(oldWitnessSet.keys()).forEach(key=>{
          mp.set(key,oldWitnessSet.get(key))
        }) 
        tx[1] = mp
      }
    }else{
      tx[1]=newWitnessSet
    }
    
  }else{
    console.warn("mergeTxAndWitness","New Witness set is empty",newWitnessSet)
    return txHex
  }
  console.log(tx)
  return Encoder.encode(tx).toString('hex')
}
export function mergeTxAndWitnessHexWithSerializationLib(_tx:Transaction,witnessesRaw: HexString):HexString{
  const walletWitnesses = TransactionWitnessSet.from_hex(witnessesRaw)
  console.log("witnessRaw:",{
    wit: walletWitnesses.to_js_value(),
    tx: _tx.to_js_value(),
    vKeys: walletWitnesses.vkeys()?.to_js_value()
  });
  return mergeTxAndWitness(_tx,walletWitnesses)
}

export function mergeSignatures( txWitnessSet: TransactionWitnessSet, newSignatures: Vkeywitnesses): Vkeywitnesses 
{
  const txSignatures = txWitnessSet.vkeys();

  if (txSignatures !== undefined) {
    const signatures = new Set<string>();

    for (let index = 0; index < txSignatures.len(); index += 1) {
      signatures.add(txSignatures.get(index).to_hex());
    }

    for (let index = 0; index < newSignatures.len(); index += 1) {
      signatures.add(newSignatures.get(index).to_hex());
    }

    const allSignatures = Vkeywitnesses.new();
    signatures.forEach((witness) => {
      allSignatures.add(Vkeywitness.from_hex(witness));
    });

    return allSignatures;
  }
  return newSignatures;
};

export function mergeTxAndWitness(tx:Transaction,walletWitnesses: TransactionWitnessSet):HexString{
  const newWitnessSet = TransactionWitnessSet.new();
  const oldTX= TransactionWitnessSet.from_json(tx.witness_set().to_json())
  oldTX.set_vkeys(mergeSignatures(TransactionWitnessSet.new(),walletWitnesses.vkeys()!))  
  const transaction = Transaction.new(tx.body(), oldTX).to_hex();  
  return transaction
}

export  function parseCardanoTransaction(_tx: string) : Transaction{
  let tx:Transaction;
  try {
      // const txArray=Uint8Array.from(Buffer.from(_tx, 'hex'))
      tx = Transaction.from_hex(_tx)      
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
    console.log(e)
    throw new Error("Invalid transaction string :"+ e.message)
  }

    const transaction= Transaction.new(tx.body(), tx.witness_set(), tx.auxiliary_data())    
    return transaction;
}




export  class Kuber{
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
      return this.call("POST", "api/v1/tx/submit", Buffer.from(tx.to_bytes()), {
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
    async build(buildRequest:any): Promise<string> {
        const txFromKuber= await kuberBuilder(buildRequest)
        const txHexKuber = txHex_Kuber(txFromKuber.tx)
        return txHexKuber
      }
    /**
     * Build a transaction with kuber. This function adds the available Utxos in the wallet to selection
     * @param cip30Instance Browser cip30 provider instance obtained with enable()
     * @param buildRequest  Object following Kuber's transaction builder JSON spec
     * @param autoAddCollateral Add collateral from provider. Kuber automatically picks collateral.
     *  set this to true if you want to specify exact collateral utxo.
     * @returns A new rejected Promise.
     */
    async buildWithProvider(cip30Instance:CIP30Instance|CIP30Wallet,buildRequest: Record<string, any>,autoAddCollateral=false): Promise<string>{
        const instance = (cip30Instance as CIP30Wallet).instance || cip30Instance
        const walletUtxos = await instance.getUtxos()        
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
        }
        else{
            buildRequest.selections=concat(buildRequest.selections,walletUtxos)
        }

        if(!buildRequest.inputs && !buildRequest.selections){
            throw Error("Expectation Failed : No Utxos available as `input` or `selection`")
        }
        //@ts-ignore
        if(autoAddCollateral && instance.getCollateral){
            if(!buildRequest.collateral && !buildRequest.collaterals){
                buildRequest.collaterals=await instance.getCollateral()
            }
        }
        console.log("provider buildrequest post-concat: "+ JSON.stringify(buildRequest));
        const builtTransaction= await this.build(buildRequest)
        return builtTransaction
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
        } 
        else {
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

export class CIP30Wallet {
  static usedAddresses() {
      throw new Error("Method not implemented.");
  }
  apiVersion: string ;
  icon: string;
  name: string;
  instance: CIP30Instance

  constructor(provider:CIP30Provider,instance:CIP30Instance){
    this.apiVersion=provider.apiVersion
    this.name=provider.apiVersion
    this.icon=provider.icon
    this.instance=instance
  }
  submitTx(txStr: string):Promise<unknown>{
    console.info('CIP30Wallet.submitTx',{
      tx: txStr
    })
    return this.instance.submitTx(txStr);
  }
  async signTx (txOrStr: string,partial?: Boolean) : Promise<string>{
    try{
      const tx= deserializeTx(txOrStr)
      const txWitnessSet= tx.witness_set();
      const newWitnessSet= await this.instance.signTx(txOrStr, partial);
      const newSignature= deserializeTxWitnessSet (newWitnessSet)
                      .vkeys() ?? Vkeywitnesses.new();
      const txSignatures= mergeSignatures(txWitnessSet, newSignature);
      txWitnessSet.set_vkeys(txSignatures);

      const signedTx= fromBytes(
        Transaction.new(
          tx.body(),
          txWitnessSet,
          tx.auxiliary_data()
        ).to_bytes()
      )

      return signedTx
    }
    catch (error){
      throw new Error(`An error occurred during signing: ${error}`)
    }
  } 
  
  changeAddress (): Promise<Address>{
    return this.instance.getChangeAddress().then(address=>{
      return Address.from_hex(address)
    })
  }
  networkId ():Promise<Network>{
    return this.instance.getNetworkId().then(id=>{
      if(id==0){
        return Network.Mainnet
      }else{
        return Network.Testnet
      }
    })
  }
  networkIdNumber ():Promise<Network>{
    return this.instance.getNetworkId()
  }
  rewardAddresses ():Promise<Address[]>{
    return this.instance.getRewardAddresses().then((result) =>{
      return result.map(r => Address.from_hex(r) )
     })
  }
  unusedAddresses() : Promise<Address[]>{
    return this.instance.getUnusedAddresses().then((result) =>{
      return result.map(r => Address.from_hex(r) )
     })  
  }
  usedAddresses() : Promise<Address[]>{
    return this.instance.getUsedAddresses().then((result) =>{
      return result.map(r => Address.from_hex(r) )
     })  
  }
  utxos() : Promise<TransactionUnspentOutput[]>{
    return this.instance.getUtxos().then((result) =>{
      return result.map(r => TransactionUnspentOutput.from_hex(r) )
     })  
  }
  collaterals() : Promise<TransactionUnspentOutput[]>{
    return this.instance.getUtxos().then((result) =>{
      return result.map(r => TransactionUnspentOutput.from_hex(r) )
     })  
  }
  calculateBalance():Promise<WalletBalance>{
      return WalletBalance.fromProvider(this.instance)
  }
  static  listProviders() :CIP30ProviderProxy[] {
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
    console.info("Provides",providers)
    // yoroi doesn't work (remove this after yoroi works)
    return providers.filter(x => x.name !="yoroi").map(p=>new CIP30ProviderProxy(p))
  }
}

export class CIP30ProviderProxy{
    apiVersion: string ;
    enable():Promise<CIP30Wallet>{
        return this.__provider.enable().then(instance=>new CIP30Wallet(this.__provider,instance))
    }
    icon: string;
    isEnabled():Promise<Boolean>{
        return this.__provider.isEnabled()
    }
    name: string;
    __provider: CIP30Provider
    constructor(provider :CIP30Provider){
        this.__provider=provider
        this.apiVersion=provider.apiVersion
        this.icon=provider.icon
        this.name=provider.name
        
    }
}

function to_bytes(): Uint8Array {
  throw new Error('Function not implemented.');
}
