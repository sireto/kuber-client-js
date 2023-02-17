
import * as fs from 'fs'
import {mergeTxAndWitnessHex, parseCardanoTransaction} from "../src/index"
import { Transaction } from '@emurgo/cardano-serialization-lib-asmjs';

const kuberTxHex =  fs.readFileSync('./test/assets/kuberTxResponse.txt').toString()
const parsdTxHex = fs.readFileSync('./test/assets/parsedCardanoTx.txt').toString()
const witnessHex = fs.readFileSync('./test/assets/walletSignature.txt').toString()
const finalTxHex = fs.readFileSync('./test/assets/finalSignedTx.txt').toString()

const parsedTx = Transaction.from_hex(parsdTxHex)

describe("Serialization",()=>{

  it('Transaction from kuber is parsed', () => {
    expect (parseCardanoTransaction(kuberTxHex).to_hex()).toBe(parsdTxHex)
  });
  it('Properly append signature', () => {
    expect (mergeTxAndWitnessHex(parsedTx,witnessHex).to_hex()).toBe(finalTxHex)
  });
  
  it('3+ 5 must be 6', () => {
    expect (sum(3,5)).toBe(6)
  });
})



function sum(a:number,b:number){
    return a + b
}