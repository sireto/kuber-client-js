import { BalanceResponse, UtxoDetails2, JsonValue } from "./type";
import { ShelleyAddress } from "libcardano/cardano/ledger-serialization/address";
import {
  Script,
  ScriptJSON,
} from "libcardano/cardano/ledger-serialization/plutusScript";
import {
  Output,
  PostAlonzoOutput,
  PreBabbageOutput,
  TxInput,
  UTxO,
} from "libcardano/cardano/ledger-serialization/txinout";
import {
  Value,
  valuetoObject,
} from "libcardano/cardano/ledger-serialization/value";
import {
  DatumOption,
  PlutusData,
} from "libcardano/cardano/ledger-serialization/plutus";
import { HexString } from "../../types";

export function toUTxO(raw: BalanceResponse): UTxO[] {
  const stringToTxInput = (txInStr: string): TxInput => {
    const splitTxIn = txInStr.split("#");
    return {
      txHash: Buffer.from(splitTxIn[0], "hex"),
      index: parseInt(splitTxIn[1]),
    };
  };
  const valueFromJSON = (jsonValue: JsonValue): Value => {
    return Value.fromCborObject(valuetoObject(jsonValue));
  };
  const datumFromJSON = (datumJson: any): PlutusData => {
    return PlutusData.fromJSON(datumJson);
  };
  const scriptFromJSON = (scriptJSON: ScriptJSON): Script => {
    return Script.fromJSON(scriptJSON);
  };
  const addressFromBech32 = (addr: string): ShelleyAddress => {
    return ShelleyAddress.fromBech32(addr);
  };
  if (Array.isArray(raw)) {
    return raw.map((utxo: UtxoDetails2) => {
      const txIn: TxInput = stringToTxInput(utxo.txin);
      const address = addressFromBech32(utxo.address);
      const value = valueFromJSON(utxo.value);
      const datum = utxo.datum ? datumFromJSON(utxo.datum) : undefined;
      const script = utxo.script
        ? scriptFromJSON(utxo.script.script)
        : undefined;
      const txOut: Output = new PostAlonzoOutput(address, value, datum, script);
      return new UTxO(txIn, txOut);
    });
  } else {
    return Object.entries(raw).map(([txHash, u]) => {
      const txIn: TxInput = stringToTxInput(txHash);
      const { address, value, datum, datumHash, inlineDatum, referenceScript } =
        u;
      const isByron = !datum && !datumHash && !inlineDatum && !referenceScript;
      const parsedAddress = addressFromBech32(address);
      console.log(parsedAddress);
      const parsedValue = valueFromJSON(value);
      console.log(parsedValue);
      const parsedDatum: DatumOption | undefined = datumHash
        ? datumHash
        : (inlineDatum as HexString)
        ? PlutusData.fromJSON(inlineDatum)
        : undefined;
      console.log(parsedDatum);
      const parsedRefScript: Script | undefined = referenceScript
        ? Script.fromJSON(referenceScript.script)
        : undefined;
      console.log(parsedRefScript);
      const txOut = isByron
        ? new PreBabbageOutput(parsedAddress, parsedValue)
        : new PostAlonzoOutput(
            parsedAddress,
            parsedValue,
            parsedDatum,
            parsedRefScript
          );
      return new UTxO(txIn, txOut);
    });
  }
}
