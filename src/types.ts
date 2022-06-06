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
  receipt: Near.Receipt;
}
export interface ReceiptDataWithTransactionHash extends ReceiptData{
  transactionHash: string;
}

export interface ExecutionOutcomeData {
  block: Near.Block;
  shard: Near.Shard;
  indexInChunk: number;
  executionOutcome: Near.ExecutionOutcomeWithReceipt;
}
