import * as Near from './near';

export interface BlockResult {
  blockHeight: number;
  block: Near.Block;
  shards: Near.Shard[];
}

export interface BlockData {
  author: string;
  header: Near.BlockHeader;
}

export interface ChunkData {
  author: string;
  header: Near.ChunkHeader;
}

export interface TransactionData {
  block: BlockData;
  chunk: ChunkData;
  indexInChunk: number;
  transaction: Near.TransactionWithOutcome;
}

export interface ReceiptData {
  block: BlockData;
  chunk: ChunkData;
  indexInChunk: number;
  transactionHash: string;
  receipt: Near.Receipt;
}

export interface ExecutionOutcomeData {
  block: BlockData;
  shardId: number;
  indexInChunk: number;
  executionOutcome: Near.ExecutionOutcomeWithReceipt;
}

export interface FullTransaction {
  transaction: TransactionData;
  receipts: ReceiptData[];
  executionOutcomes: ExecutionOutcomeData[];
}
