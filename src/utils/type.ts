import { ScriptJSON } from "libcardano/cardano/serialization/plutusScript";

export type RetryConfig = {
  maxRetries: number;
  delayInMS?: number;
};

export type Commit = {
  utxos: string[];
  signKey?:
    | {
        type: "PaymentSigningKeyShelley_ed25519";
        description: "Payment Signing Key";
        cborHex: string;
      }
    | string;
};

export type BalanceResponse = Record<string, UtxoDetails1> | UtxoDetails2[];

export type JsonValue = {
  [policyId: string]: Record<string, BigInt | number> | BigInt | number;
};

export type UtxoDetails1 = {
  address: string;
  datum: string | null;
  datumHash: string | null;
  inlineDatum: any;
  referenceScript: { script: ScriptJSON; scriptLanguage: string } | null;
  value: JsonValue;
};

export type UtxoDetails2 = {
  address: string;
  txin: string;
  value: JsonValue;
  datum?: any;
  script?: { script: ScriptJSON; scriptLanguage: string };
};
