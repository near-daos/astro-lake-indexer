import * as Near from './near';

export interface TransactionData {
  block: Near.Block;
  shard: Near.Shard;
  indexInChunk: number;
  transaction: Near.TransactionWithOutcome;
}

export interface ReceiptData {
  block: Near.Block;
  shard: Near.Shard;
  indexInChunk: number;
  transactionHash: string;
  receipt: Near.Receipt;
}

export interface ExecutionOutcomeData {
  block: Near.Block;
  shard: Near.Shard;
  indexInChunk: number;
  executionOutcome: Near.ExecutionOutcomeWithReceipt;
}
