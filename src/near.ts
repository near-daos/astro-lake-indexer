export type Amount = string;

export interface BlockHeader {
  gas_price: string;
  hash: string;
  height: number;
  prev_hash: string;
  timestamp: number;
  total_supply: string;
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

export interface Receipt {
  predecessor_id: string;
  receipt_id: string;
  receiver_id: string;
}

export enum ExecutionOutcomeStatus {
  Unknown = 'UNKNOWN',
  Failure = 'FAILURE',
  SuccessValue = 'SUCCESS_VALUE',
  SuccessReceiptId = 'SUCCESS_RECEIPT_ID',
}

export type ExecutionOutcomeStatusKey = keyof typeof ExecutionOutcomeStatus;
export type ExecutionOutcomeStatusObject = Record<
  ExecutionOutcomeStatusKey,
  string
>;

export interface Outcome {
  executor_id: string;
  gas_burnt: number;
  receipt_ids: string[];
  status: ExecutionOutcomeStatusObject;
  tokens_burnt: string;
}

export interface ExecutionOutcome {
  block_hash: string;
  id: string;
  outcome: Outcome;
}

export interface ReceiptExecutionOutcome {
  execution_outcome: ExecutionOutcome;
  receipt: Receipt | null;
}

export interface Transaction {
  actions: object[];
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
