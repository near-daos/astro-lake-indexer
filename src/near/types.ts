import { Action } from './action';
import { ExecutionStatus } from './execution-status';
import { Receipt } from './receipt';
import { StateChange } from './state-change';

export type Amount = string;
export type StorageUsage = number;

export interface Account {
  amount: Amount;
  locked: Amount;
  code_hash: string;
  storage_usage: StorageUsage;
  storage_paid_at: number;
}

export interface BlockHeader {
  gas_price: Amount;
  hash: string;
  height: number;
  prev_hash: string;
  timestamp: bigint;
  total_supply: Amount;
}

export interface ChunkHeader {
  chunk_hash: string;
  gas_limit: number;
  gas_used: number;
  shard_id: number;
  signature: string;
}

export interface Block {
  author: string;
  chunks: ChunkHeader[];
  header: BlockHeader;
}

export interface ExecutionOutcome {
  executor_id: string;
  logs: string[];
  gas_burnt: number;
  receipt_ids: string[];
  status: ExecutionStatus;
  tokens_burnt: Amount;
}

export interface ExecutionOutcomeWithId {
  block_hash: string;
  id: string;
  outcome: ExecutionOutcome;
}

export interface ExecutionOutcomeWithReceipt {
  execution_outcome: ExecutionOutcomeWithId;
  receipt: Receipt;
}

export interface ExecutionOutcomeWithoutReceipt {
  execution_outcome: ExecutionOutcomeWithId;
  receipt: null;
}

export interface Transaction {
  actions: Action[];
  hash: string;
  nonce: number;
  public_key: string;
  receiver_id: string;
  signature: string;
  signer_id: string;
}

export interface TransactionWithOutcome {
  outcome: ExecutionOutcomeWithoutReceipt;
  transaction: Transaction;
}

export interface Chunk {
  author: string;
  header: ChunkHeader;
  receipts: Receipt[];
  transactions: TransactionWithOutcome[];
}

export interface Shard {
  chunk: Chunk | null;
  receipt_execution_outcomes: ExecutionOutcomeWithReceipt[];
  shard_id: number;
  state_changes: StateChange[];
}
