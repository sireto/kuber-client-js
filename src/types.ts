export type HexString  = string;

export  interface CIP30Provider {
    apiVersion: string ;
    enable : ()=>Promise<any>;
    icon: string;
    isEnabled: ()=> Promise<Boolean>;
    name: string;
}

export  interface CIP30Instace {
    submitTx:(tx:string) =>   Promise <any>
    signTx: (tx: string,partial?: Boolean) => Promise<HexString>
    getChangeAddress: ()=> Promise<HexString>
    getNetworkId: ()=>Promise<number>
    getRewardAddresses: ()=>Promise<HexString>
    getUnusedAddresses: ()=>Promise<Array<HexString>>
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
