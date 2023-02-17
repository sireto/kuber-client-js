export type HexString  = string;

export  interface CIP30Provider {
    apiVersion: string ;
    enable : ()=>Promise<CIP30Instance>;
    icon: string;
    isEnabled: ()=> Promise<Boolean>;
    name: string;
}
export enum Network{
    Mainnet,
    Testnet
}

export  interface CIP30Instance {
    submitTx:(tx:string) =>   Promise <any>
    signTx: (tx: string,partial?: Boolean) => Promise<HexString>
    getChangeAddress: ()=> Promise<HexString>
    getNetworkId: ()=>Promise<number>
    getRewardAddresses: ()=>Promise<HexString[]>
    getUnusedAddresses: ()=>Promise<HexString[]>
    getUsedAddresses: ()=>Promise<Array<HexString>>
    getUtxos: ()=>Promise<Array<HexString>>
    getCollateral: () => Promise<Array<HexString>>
}

export interface TxResponseModal {
    fee : Number,
    tx : HexString,
    txHash: HexString   
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


