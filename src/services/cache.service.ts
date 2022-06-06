import LRUCache from 'lru-cache';
import * as Near from '../near';
import { ExecutionOutcomeData, ReceiptData, TransactionData } from '../types';

export class CacheService {
  constructor(
    private readonly blockCache = new LRUCache<
      string,
      { block: Near.Block; shards: Near.Shard[] }
    >({
      max: 100,
    }),
  ) {}

  cacheBlock(block: Near.Block, shards: Near.Shard[]) {
    this.blockCache.set(block.header.hash, { block, shards });
  }

  findTransactionByHash(hash: string): TransactionData | undefined {
    for (const { block, shards } of this.blockCache.values()) {
      for (const shard of shards) {
        if (!shard.chunk) {
          continue;
        }

        for (const [
          indexInChunk,
          transaction,
        ] of shard.chunk.transactions.entries()) {
          if (transaction.transaction.hash === hash) {
            return { block, shard, indexInChunk, transaction };
          }
        }
      }
    }
  }

  findExecutionOutcomeById(id: string): ExecutionOutcomeData | undefined {
    for (const { block, shards } of this.blockCache.values()) {
      for (const shard of shards) {
        for (const [
          indexInChunk,
          executionOutcome,
        ] of shard.receipt_execution_outcomes.entries()) {
          if (executionOutcome.execution_outcome.id === id) {
            return { block, shard, indexInChunk, executionOutcome };
          }
        }
      }
    }
  }

  findReceiptById(
    transactionHash: string,
    receiptOrDataId: string,
  ): ReceiptData | undefined {
    for (const { block, shards } of this.blockCache.values()) {
      for (const shard of shards) {
        if (!shard.chunk) {
          continue;
        }

        for (const [indexInChunk, receipt] of shard.chunk.receipts.entries()) {
          const receiptType = Near.parseKind<Near.ReceiptTypes>(
            receipt.receipt,
          );

          switch (receiptType) {
            case Near.ReceiptTypes.Action:
              if (receipt.receipt_id === receiptOrDataId) {
                return {
                  block,
                  shard,
                  indexInChunk,
                  transactionHash,
                  receipt,
                };
              }
              break;

            case Near.ReceiptTypes.Data:
              if (
                (receipt.receipt as Near.DataReceipt).Data.data_id ===
                receiptOrDataId
              ) {
                return {
                  block,
                  shard,
                  indexInChunk,
                  transactionHash,
                  receipt,
                };
              }
              break;
          }
        }
      }
    }
  }

  findObjectsByTransactionHash(transactionHash: string) {
    const transactions: TransactionData[] = [];
    let receipts: ReceiptData[] = [];
    let executionOutcomes: ExecutionOutcomeData[] = [];

    const transactionsResults = this.findTransactionByHash(transactionHash);

    if (transactionsResults) {
      transactions.push(transactionsResults);
    } else {
      return { transactions, receipts, executionOutcomes };
    }

    const childReceipts = this.findChildReceipts(
      transactionHash,
      transactionsResults.transaction.outcome.execution_outcome.outcome
        .receipt_ids[0],
    );

    receipts = receipts.concat(childReceipts.receipts);
    executionOutcomes = executionOutcomes.concat(
      childReceipts.executionOutcomes,
    );

    return {
      transactions,
      receipts,
      executionOutcomes,
    };
  }

  findChildReceipts(transactionHash: string, receiptId: string) {
    let receipts: ReceiptData[] = [];
    let executionOutcomes: ExecutionOutcomeData[] = [];

    // find current receipt
    const receiptResults = this.findReceiptById(transactionHash, receiptId);

    if (receiptResults) {
      receipts.push(receiptResults);
    } else {
      return { receipts, executionOutcomes };
    }

    const receiptType = Near.parseKind<Near.ReceiptTypes>(
      receiptResults.receipt.receipt,
    );

    if (receiptType === Near.ReceiptTypes.Action) {
      const actionReceipt = receiptResults.receipt
        .receipt as Near.ActionReceipt;

      // include data receipts in results
      actionReceipt.Action.output_data_receivers.forEach(({ data_id }) => {
        const dataReceiptResults = this.findReceiptById(
          transactionHash,
          data_id,
        );

        if (dataReceiptResults) {
          receipts.push(dataReceiptResults);
        }
      });
    } else {
      // data receipts dont have execution outcomes
      return { receipts, executionOutcomes };
    }

    // find execution outcome for receipt
    const executionOutcomeResults = this.findExecutionOutcomeById(
      receiptResults.receipt.receipt_id,
    );

    if (executionOutcomeResults) {
      executionOutcomes.push(executionOutcomeResults);
    } else {
      return { receipts, executionOutcomes };
    }

    // find child receipts and execution outcomes
    executionOutcomeResults.executionOutcome.execution_outcome.outcome.receipt_ids.forEach(
      (receiptId) => {
        const childExecutionOutcomeResults = this.findChildReceipts(
          transactionHash,
          receiptId,
        );

        if (childExecutionOutcomeResults) {
          receipts = receipts.concat(childExecutionOutcomeResults.receipts);
          executionOutcomes = executionOutcomes.concat(
            childExecutionOutcomeResults.executionOutcomes,
          );
        }
      },
    );

    return {
      receipts,
      executionOutcomes,
    };
  }
}
