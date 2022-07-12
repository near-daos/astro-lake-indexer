import * as Near from './near';

export interface BlockResult {
  blockHeight: number;
  block: Near.Block;
  shards: Near.Shard[];
}

export interface TransactionData {
  block: Near.Block;
  chunk: Near.Chunk;
  indexInChunk: number;
  transaction: Near.TransactionWithOutcome;
}

export interface ReceiptData {
  block: Near.Block;
  chunk: Near.Chunk;
  indexInChunk: number;
  transactionHash: string;
  receipt: Near.Receipt;
}

export interface ExecutionOutcomeData {
  block: Near.Block;
  shardId: number;
  indexInChunk: number;
  executionOutcome: Near.ExecutionOutcomeWithReceipt;
}

export interface FullTransaction {
  transaction: TransactionData;
  receipts: ReceiptData[];
  executionOutcomes: ExecutionOutcomeData[];
}
