import LRUCache from 'lru-cache';
import { ExecutionOutcomeData, ReceiptData, TransactionData } from '../types';
import * as Near from '../near';

export class CacheService {
  constructor(
    private readonly transactionsCache = new LRUCache<string, TransactionData>({
      max: 500,
    }),
    private readonly receiptsCache = new LRUCache<string, ReceiptData>({
      max: 2000,
    }),
    private readonly executionOutcomesCache = new LRUCache<
      string,
      ExecutionOutcomeData
    >({
      max: 2000,
    }),
    private readonly transactionHashesCache = new LRUCache<string, string>({
      max: 2000,
    }),
  ) {}

  cacheBlock(block: Near.Block, shards: Near.Shard[]) {
    shards.forEach((shard) => {
      if (shard.chunk) {
        // cache transactions
        shard.chunk.transactions.forEach((transaction, indexInChunk) => {
          this.transactionsCache.set(transaction.transaction.hash, {
            block,
            shard,
            indexInChunk,
            transaction,
          });

          // store transaction hash for future receipts
          this.transactionHashesCache.set(
            transaction.outcome.execution_outcome.outcome.receipt_ids[0],
            transaction.transaction.hash,
          );
        });

        // cache receipts
        shard.chunk.receipts.forEach((receipt, indexInChunk) => {
          const receiptOrDataId = Near.getReceiptOrDataId(receipt);

          this.receiptsCache.set(receiptOrDataId, {
            block,
            shard,
            indexInChunk,
            receipt,
          });

          const receiptType = Near.parseKind<Near.ReceiptTypes>(
            receipt.receipt,
          );

          if (receiptType !== Near.ReceiptTypes.Action) {
            return;
          }

          const transactionHash =
            this.transactionHashesCache.get(receiptOrDataId);

          if (!transactionHash) {
            return;
          }

          const actionReceipt = (receipt.receipt as Near.ActionReceipt).Action;

          // store transaction hash for the future data receipts
          actionReceipt.output_data_receivers.forEach(({ data_id }) => {
            this.transactionHashesCache.set(data_id, transactionHash);
          });
        });
      }

      // cache execution outcomes
      shard.receipt_execution_outcomes.forEach(
        (executionOutcome, indexInChunk) => {
          this.executionOutcomesCache.set(
            executionOutcome.execution_outcome.id,
            {
              block,
              shard,
              indexInChunk,
              executionOutcome,
            },
          );

          const transactionHash = this.transactionHashesCache.get(
            executionOutcome.execution_outcome.id,
          );

          if (!transactionHash) {
            return;
          }

          // store transaction hash for future receipts
          executionOutcome.execution_outcome.outcome.receipt_ids.forEach(
            (receiptId) => {
              this.transactionHashesCache.set(receiptId, transactionHash);
            },
          );
        },
      );
    });
  }

  getTransactionHash(receiptOrDataId: string) {
    return this.transactionHashesCache.get(receiptOrDataId);
  }

  findObjectsByTransactionHash(transactionHash: string) {
    const transactions: TransactionData[] = [];
    let receipts: ReceiptData[] = [];
    let executionOutcomes: ExecutionOutcomeData[] = [];

    // find transaction data
    const transactionData = this.transactionsCache.get(transactionHash);

    if (transactionData) {
      transactions.push(transactionData);
    } else {
      return { transactions, receipts, executionOutcomes };
    }

    const [convertedIntoReceiptId] =
      transactionData.transaction.outcome.execution_outcome.outcome.receipt_ids;

    // find child receipts
    const childReceipts = this.findChildReceipts(convertedIntoReceiptId);

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

  findChildReceipts(receiptId: string) {
    let receipts: ReceiptData[] = [];
    let executionOutcomes: ExecutionOutcomeData[] = [];

    // find current receipt
    const receiptData = this.receiptsCache.get(receiptId);

    if (receiptData) {
      receipts.push(receiptData);
    } else {
      return { receipts, executionOutcomes };
    }

    const receiptType = Near.parseKind<Near.ReceiptTypes>(
      receiptData.receipt.receipt,
    );

    if (receiptType === Near.ReceiptTypes.Action) {
      const actionReceipt = receiptData.receipt.receipt as Near.ActionReceipt;

      // include data receipts in results
      actionReceipt.Action.output_data_receivers.forEach(({ data_id }) => {
        const dataReceiptData = this.receiptsCache.get(data_id);

        if (dataReceiptData) {
          receipts.push(dataReceiptData);
        }
      });
    } else {
      // data receipts dont have execution outcomes
      return { receipts, executionOutcomes };
    }

    // find execution outcome for receipt
    const executionOutcomeData = this.executionOutcomesCache.get(
      receiptData.receipt.receipt_id,
    );

    if (executionOutcomeData) {
      executionOutcomes.push(executionOutcomeData);
    } else {
      return { receipts, executionOutcomes };
    }

    // find child receipts and execution outcomes
    executionOutcomeData.executionOutcome.execution_outcome.outcome.receipt_ids.forEach(
      (receiptId) => {
        const childExecutionOutcomeData = this.findChildReceipts(receiptId);

        if (childExecutionOutcomeData) {
          receipts = receipts.concat(childExecutionOutcomeData.receipts);
          executionOutcomes = executionOutcomes.concat(
            childExecutionOutcomeData.executionOutcomes,
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
