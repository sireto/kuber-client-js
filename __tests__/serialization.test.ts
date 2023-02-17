
import * as fs from 'fs'
import * as process from 'process'
import {mergeTxAndWitnessHexWithSerializationLib,mergeTxAndWitnessHexWithCborlib, parseCardanoTransaction} from "../src/index"
import { Transaction } from '@emurgo/cardano-serialization-lib-asmjs';
const kuberTxHex =  fs.readFileSync('./__tests__/assets/kuberTxResponse.txt').toString()
const parsdTxHex = fs.readFileSync('./__tests__/assets/parsedCardanoTx.txt').toString()
const witnessHex = fs.readFileSync('./__tests__/assets/walletSignature.txt').toString()
const finalTxHex = fs.readFileSync('./__tests__/assets/finalSignedTx.txt').toString()

const parsedTx = Transaction.from_hex(parsdTxHex)

describe("Serialization",()=>{

  it('Transaction from kuber is parsed', () => {
    expect (parseCardanoTransaction(kuberTxHex).to_hex()).toBe(parsdTxHex)
  });
  it('Should append signature properly with serialization lib', () => {
    expect (mergeTxAndWitnessHexWithSerializationLib(parsedTx,witnessHex).to_hex()).toBe(finalTxHex)
  });
  it('Should append signature properly with cobor lib', () => {
    expect (mergeTxAndWitnessHexWithCborlib(parsedTx,witnessHex)).toBe(finalTxHex)
  });
})



function sum(a:number,b:number){
    return a + b
}