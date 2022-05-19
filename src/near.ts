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
  shard_id: number;
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

export interface ExecutionOutcome {
  block_hash: string;
  id: string;
  outcome: {
    executor_id: string;
    receipt_ids: string[];
  };
}

export interface ReceiptExecutionOutcome {
  execution_outcome: ExecutionOutcome;
  receipt: Receipt | null;
}

export interface Transaction {
  outcome: ReceiptExecutionOutcome;
  transaction: {
    actions: object[];
    hash: string;
    nonce: number;
    public_key: string;
    receiver_id: string;
    signature: string;
    signer_id: string;
  };
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

export interface Shard {
  chunk: {
    header: ChunkHeader;
    receipts: Receipt[];
    transactions: Transaction[];
  };
  receipt_execution_outcomes: ReceiptExecutionOutcome[];
  shard_id: number;
  state_changes: StateChange[];
}
