export type HexString  = string;
export type SignatureResponse = {
    signature: string,
    key: string
}
export  interface CIP30Provider {
    apiVersion: string ;
    enable : (option?:{extensions:CipExtension[]})=>Promise<CIP30Instance>;
    icon: string;
    isEnabled: ()=> Promise<Boolean>;
    supportedExtensions?:Record<string,any>[]
    name: string;
}
export enum Network{
    Mainnet,
    Testnet
}

export  interface CIP30Instance {
    submitTx:(tx:string) =>   Promise <any>
    signTx: (tx: string,partial?: Boolean) => Promise<HexString>
    signData: (address: string, message: HexString) => Promise<SignatureResponse>
    getChangeAddress: ()=> Promise<HexString>
    getNetworkId: ()=>Promise<number>
    getRewardAddresses: ()=>Promise<HexString[]>
    getUnusedAddresses: ()=>Promise<HexString[]>
    getUsedAddresses: ()=>Promise<Array<HexString>>
    getUtxos: ()=>Promise<Array<HexString>>
    getCollateral: () => Promise<Array<HexString>>
    cip95?:Cip95
}
export interface Cip95{
    getPubDRepKey:()=>Promise<HexString>
    getRegisteredPubStakeKeys:()=>Promise<HexString[]>

    getUnregisteredPubStakeKeys:()=>Promise<HexString[]>
    signData:(addr:string, sigStructure:string)=>Promise<HexString>
    signTx:(tx:string, partialSign?:boolean)=>Promise<HexString>
}

export interface TxResponseModal {
    cborHex : HexString,
    hash: HexString,
}

export interface AssetMap{
    [props:HexString]:{
        [props:HexString]:bigint
    }
}
export interface AssetMapUtf8{
    [props:HexString]:{
        [props:string]:bigint
    }
}
export interface NativeAsset {
   tokenName: HexString
   policy : HexString 
   quantity: bigint
}
export interface NativeAssetUtf8 {
    utf8Name : string
    tokenName: HexString
    policyId : HexString
    quantity: bigint
 }

export type KeyHashHex = HexString
export type SignatureHex = HexString

export type VkeyWitnessCcdl = [ KeyHashHex,SignatureHex ]


// transaction_witness_set =
//   { ? 0: [* vkeywitness ]
//   , ? 1: [* native_script ]
//   , ? 2: [* bootstrap_witness ]
//   , ? 3: [* plutus_v1_script ]
//   , ? 4: [* plutus_data ]
//   , ? 5: [* redeemer ]
//   , ? 6: [* plutus_v2_script ] ; New
//   }

export interface TransactionWitnessSetCcdl  {
    0? : VkeyWitnessCcdl[];
    1? : any[];
    2? : any[];
    3? : any[];
    4? : any[];
    5? : any[];
    6? : any[];

}

export type Address=any

export type RawMetaDatum =  [RawMetaDatum] | Map<RawMetaDatum,RawMetaDatum> | number | Buffer | string
export type RawTxMetadata = Map<number,RawMetaDatum>
export type RawScript = Buffer
export type RawAuxData = [RawTxMetadata,RawScript[]?] | Map<number,RawTxMetadata|RawScript>

export type RawWitnessSet = Map<number,any>
export type RawTxBody= Map<number, any>;
export type RawTx= [RawTxBody,RawWitnessSet,boolean,RawAuxData]


export interface CipExtension{
    cip: number;
}