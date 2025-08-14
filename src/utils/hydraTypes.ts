export type HydraHeadState = "Initial" | "Idle" | "Closed" | "Contested" | "Open";

export type ScriptData =
  | DatumInt
  | DatumBytes
  | DatumList
  | DatumConstructor
  | DatumMap;

export interface DatumInt {
  int: number;
}

export interface DatumBytes {
  bytes: string;
}

export interface DatumList {
  list: ScriptData[];
}

export interface DatumMap {
  map: { k: ScriptData; v: ScriptData }[];
}

export interface DatumConstructor {
  constructor: number;
  fields: ScriptData[];
}

export interface Value {
  lovelace: number;
  [policyId: string]: number | Record<string, number>;
}

export interface UTxOEntry {
  address: string;
  datum: null|string;
  datumhash: null | string;
  inlineDatum: null | ScriptData;
  inlineDatumRaw: null | string;
  referenceScript: null;
  value: Value;
}

export interface RecordedAt {
  blockHash: string;
  slot: number;
  tag: string;
}

export interface ChainState {
  recordedAt: RecordedAt;
  spendableUTxO: Record<string, UTxOEntry>;
}

export interface ConfirmedSnapshot {
  headId: string;
  initialUTxO: Record<string, UTxOEntry>;
  tag: string;
}

export interface Party {
  vkey: string;
}

export interface ContentParameters {
  contestationPeriod: number;
  parties: Party[];
}

export interface Contents {
  chainState: ChainState;
  confirmedSnapshot: ConfirmedSnapshot;
  contestationDeadline: string;
  headId: string;
  headSeed: string;
  parameters: ContentParameters;
  readyToFanoutSent: boolean;
  version: number;
}

export interface HydraHead {
  contents?: Contents;
  tag: HydraHeadState;
}