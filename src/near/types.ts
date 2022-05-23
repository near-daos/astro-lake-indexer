import { Action } from './action';
import { ExecutionStatus } from './execution-status';
import { Receipt } from './receipt';

export type Amount = string | number;

export interface BlockHeader {
  gas_price: Amount;
  hash: string;
  height: number;
  prev_hash: string;
  timestamp: number;
  total_supply: Amount;
}

export interface ChunkHeader {
  chunk_hash: string;
  gas_limit: Amount;
  gas_used: Amount;
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
  gas_burnt: Amount;
  receipt_ids: string[];
  status: ExecutionStatus;
  tokens_burnt: Amount;
}

export interface ExecutionOutcomeWithId {
  block_hash: string;
  id: string;
  outcome: ExecutionOutcome;
}

export interface ReceiptExecutionOutcome {
  execution_outcome: ExecutionOutcomeWithId;
  receipt: Receipt | null;
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
  outcome: ReceiptExecutionOutcome;
  transaction: Transaction;
}

export interface StateChange {
  cause: {
    tx_hash: string;
    type: string;
  };
  change: {
    account_id: string;
    amount: Amount;
  };
  type: string;
}

export interface Chunk {
  author: string;
  header: ChunkHeader;
  receipts: Receipt[];
  transactions: TransactionWithOutcome[];
}

export interface Shard {
  chunk: Chunk;
  receipt_execution_outcomes: ReceiptExecutionOutcome[];
  shard_id: number;
  state_changes: StateChange[];
}
