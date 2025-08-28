import { CommonTxObject } from "libcardano-wallet";

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

export interface MultiSignature {
  multiSignature: string[];
}

export interface Snapshot {
  confirmed: unknown[];
  headId: string;
  number: number;
  utxo: Record<string, UTxOEntry>;
  utxoToCommit?:  Record<string, UTxOEntry>;
  utxoToDecommit?:  Record<string, UTxOEntry>;
  version: number;
}

export interface CoordinatedConfirmedSnapshot {
  signatures: MultiSignature;
  snapshot: Snapshot;
  tag: string;
}

export interface SeenSnapshot {
  lastSeen: number;
  tag: string;
}

export interface PendingDeposit {
  created: string;
  deadline: string;
  deposited: Record<string, UTxOEntry>;
  headId: string;
  status: string;
}

export interface CoordinatedHeadState {
  allTxs: Record<string, unknown>;
  confirmedSnapshot: CoordinatedConfirmedSnapshot;
  currentDepositTxId: null | string;
  decommitTx: null | CommonTxObject;
  localTxs: unknown[];
  localUTxO: Record<string, UTxOEntry>;
  pendingDeposits: Record<string, PendingDeposit>;
  seenSnapshot: SeenSnapshot;
  version: number;
}

export interface Contents {
  chainState: ChainState;
  committed?: Record<string, Record<string, UTxOEntry>>;
  confirmedSnapshot?: CoordinatedConfirmedSnapshot; // Changed to CoordinatedConfirmedSnapshot
  contestationDeadline?: string;
  headId: string;
  headSeed: string;
  parameters: ContentParameters;
  pendingCommits?: Party[];
  readyToFanoutSent?: boolean;
  version?: number;
  coordinatedHeadState?: CoordinatedHeadState;
  currentSlot?: number;
}

export interface HydraHead {
  contents?: Contents;
  tag: HydraHeadState;
}
export interface DecommitResult {
  decommitTx: CommonTxObject;
  headId: string;
  seq: number;
  tag: string;
  timestamp: string;
  utxoToDecommit: Record<string, UTxOEntry>;
}
