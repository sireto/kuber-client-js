import { BigNum } from "@emurgo/cardano-serialization-lib-asmjs";

export type HexString  = string;

export  interface CIP30Provider {
    apiVersion: string ;
    enable : Awaited<Promise<any>>;
    icon: string;
    isEnabled: Awaited<Promise<Boolean>>;
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
    tx : string,
    txHash: string   
}

export interface ValueModal{
    lovelace : BigNum,
    multiassets: {
        [props:string]:{
            [props:string]:BigInt
        }
    }
}
