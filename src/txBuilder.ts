type Address = string;

type Network = "Testnet" | "Mainnet";

type Value = bigint | number | Record<string, bigint | number | Record<string, bigint | number>>;

type UTxO = { address?: Address; datum?: Data; txin: string; value?: Value };

type PubKeyHash = string;

type BytesDatum = {
  bytes: string;
};

type IntDatum = {
  int: number;
};

type ListDatum = {
  list: Data[];
};

type MapDatum = {
  [key: string]: Data;
};

type ConstructorDatum = {
  constructor: number;
  fields: DatumFields[];
};

type DatumFields = BytesDatum | IntDatum | ListDatum | MapDatum | ConstructorDatum;

type Data = ConstructorDatum;

type TxOutput = {
  address: Address;
  value: Value;
  datum?: Data;
};

type Type = "sig" | "PlutusScriptV1" | "PlutusScriptV2" | "PlutusScriptV3";

type Script =
  | { cborHex: string; description: string; type: Type; keyHash?: never }
  | { cborHex?: never; description?: never; type: "sig"; keyHash: string };

type TxInput =
  | { utxo: string | UTxO; script?: never; redeemer?: never }
  | { utxo: string | UTxO; script: Script; redeemer: Data };

type TxMint = { script: Script; redeemer?: Data; amount: Record<string, bigint | number> };

type TxSelection = { address?: Address; txin: string; value: Value };

type Anchor = { url: string; dataHash: string; hash?: never } | { url: string; dataHash?: never; hash: string };

type Credential = { keyHash: string; scriptHash?: never } | { keyHash?: never; scriptHash: string };

type RefundAccount = string | { network: Network; credential: Credential };

type NewConstitution = { url: string; dataHash: string; scriptHash?: string };

type Withdrawal = Record<string, number | bigint>;

type HardFork = { protocolVersion: { major: number; minor: number } };

type UpdateCommittee = {
  add: Record<string, number>;
  remove: string[];
  quorum: { numerator: number | bigint; denominator: number | bigint };
};

type ParameterUpdate = {
  prevGovAction: string;
  MaxBlockExUnits: { exUnitsMem: number | bigint; exUnitsSteps: number | bigint };
};

type TxProposal =
  | { deposit: number | bigint; refundAccount: RefundAccount; anchor: Anchor }
  | { deposit: number | bigint; refundAccount: RefundAccount; anchor: Anchor; newconstution: NewConstitution }
  | { deposit: number | bigint; refundAccount: RefundAccount; anchor: Anchor; withdraw: Withdrawal }
  | { deposit?: number | bigint; refundAccount: RefundAccount; anchor: Anchor; hardfork: HardFork }
  | { deposit: number | bigint; refundAccount: RefundAccount; anchor: Anchor; updatecommittee: UpdateCommittee }
  | { deposit: number | bigint; refundAccount: RefundAccount; anchor: Anchor; parameterupdate: ParameterUpdate };

type TxVote = { voter: string; role: string; proposal: string; vote: boolean; anchor: Anchor };

type CertType = "registerstake" | "deregisterstake" | "delegate" | "deregisterdrep" | "updatedrep";

type DelegateCert = {
  type: "delegate";
  key: Credential;
} & ({ pool: Buffer } | { drep: Buffer } | { pool: Buffer; drep: Buffer });

type RegCert =
  | { type: "register"; deposit: bigint; drep: Credential; anchor?: Anchor; key?: never }
  | { type: "register"; deposit: bigint; key: Credential; drep?: never; anchor?: never };

type RegDelegCert = {
  type: "reg-deleg";
  key: Credential;
  deposit: BigInt;
} & ({ pool: Buffer } | { drep: Buffer } | { pool: Buffer; drep: Buffer });

type UnRegCert = {
  type: "unregister";
} & ({ drep: string; deposit: BigInt } | { key: string; deposit: BigInt });

type UpdateCert = {
  type: "update";
  drep: string;
  anchor?: Anchor;
};

type TxCertificate = RegCert | UnRegCert | UpdateCert | DelegateCert | RegDelegCert;

export class TxBuilder {
  tx_selections?: (string | TxSelection)[];
  tx_inputs?: (string | TxInput)[];
  tx_outputs?: TxOutput[];
  tx_collaterals?: (string | TxInput)[];
  tx_referenceInputs?: (string | TxInput)[];
  tx_validityStart?: bigint | number | Date;
  tx_validityEnd?: bigint | number | Date;
  tx_mint?: TxMint[];
  tx_signatures?: string[];
  tx_fee?: bigint | number;
  tx_changeAddress?: Address;
  tx_metadata?: Record<number, any>;
  tx_proposals?: TxProposal[];
  tx_certificates?: TxCertificate[];
  tx_votes?: TxVote[];

  selections(tx_selection: TxSelection | (TxSelection | string)[] | string) {
    if (Array.isArray(tx_selection)) {
      if (!this.tx_selections) this.tx_selections = [];
      this.tx_selections.push(...tx_selection);
    } else {
      if (!this.tx_selections) this.tx_selections = [];
      this.tx_selections.push(tx_selection);
    }
    return this;
  }

  inputs(tx_inputs: TxInput | (TxInput | string)[] | string) {
    if (Array.isArray(tx_inputs)) {
      if (!this.tx_inputs) this.tx_inputs = [];
      this.tx_inputs.push(...tx_inputs);
    } else {
      if (!this.tx_inputs) this.tx_inputs = [];
      this.tx_inputs.push(tx_inputs);
    }
    return this;
  }

  outputs(tx_output: TxOutput | TxOutput[]) {
    if (Array.isArray(tx_output)) {
      if (!this.tx_outputs) this.tx_outputs = [];
      this.tx_outputs.push(...tx_output);
    } else {
      if (!this.tx_outputs) this.tx_outputs = [];
      this.tx_outputs.push(tx_output);
    }
    return this;
  }

  collateral(tx_collateral: TxInput | (TxInput | string)[] | string) {
    if (Array.isArray(tx_collateral)) {
      if (!this.tx_collaterals) this.tx_collaterals = [];
      this.tx_collaterals.push(...tx_collateral);
    } else {
      if (!this.tx_collaterals) this.tx_collaterals = [];
      this.tx_collaterals.push(tx_collateral);
    }
    return this;
  }

  referenceInputs(tx_referenceInput: TxInput | (TxInput | string)[] | string) {
    if (Array.isArray(tx_referenceInput)) {
      if (!this.tx_referenceInputs) this.tx_referenceInputs = [];
      this.tx_referenceInputs.push(...tx_referenceInput);
    } else {
      if (!this.tx_referenceInputs) this.tx_referenceInputs = [];
      this.tx_referenceInputs.push(tx_referenceInput);
    }
    return this;
  }
  validFrom(from: bigint | number | Date) {
    this.tx_validityStart = from;
    return this;
  }
  validTo(to: bigint | number | Date) {
    this.tx_validityEnd = to;
    return this;
  }
  mintAssets(tx_mint: TxMint | TxMint[]) {
    if (Array.isArray(tx_mint)) {
      if (!this.tx_mint) this.tx_mint = [];
      this.tx_mint.push(...tx_mint);
    } else {
      if (!this.tx_mint) this.tx_mint = [];
      this.tx_mint.push(tx_mint);
    }
    return this;
  }
  signatures(tx_signature: PubKeyHash | Address | (PubKeyHash | Address)[]) {
    if (Array.isArray(tx_signature)) {
      this.tx_signatures = tx_signature;
    } else {
      if (!this.tx_signatures) this.tx_signatures = [];
      this.tx_signatures.push(tx_signature);
    }
    return this;
  }
  fee(lovelace: bigint | number) {
    this.tx_fee = lovelace;
    return this;
  }
  metadata(tx_metadata: Record<number, any>) {
    this.tx_metadata = tx_metadata;
    return this;
  }
  proposals(tx_proposal: TxProposal | TxProposal[]) {
    if (Array.isArray(tx_proposal)) {
      this.tx_proposals = tx_proposal;
    } else {
      if (!this.tx_proposals) this.tx_proposals = [];
      this.tx_proposals.push(tx_proposal);
    }
    return this;
  }
  certificates(tx_certificates: TxCertificate | TxCertificate[]) {
    if (Array.isArray(tx_certificates)) {
      this.tx_certificates = tx_certificates;
    } else {
      if (!this.tx_certificates) this.tx_certificates = [];
      this.tx_certificates.push(tx_certificates);
    }
    return this;
  }
  votes(tx_votes: TxVote | TxVote[]) {
    if (Array.isArray(tx_votes)) {
      this.tx_votes = tx_votes;
    } else {
      if (!this.tx_votes) this.tx_votes = [];
      this.tx_votes.push(tx_votes);
    }
    return this;
  }
}
