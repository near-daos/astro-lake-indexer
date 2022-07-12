import { Service } from 'typedi';
import Cache from '../cache';
import { ExecutionOutcomeData, ReceiptData, TransactionData } from '../types';
import * as Near from '../near';

@Service({ global: true })
export class CacheService {
  constructor(
    private readonly transactionsCache = new Cache<string, TransactionData>(
      5000,
    ),
    private readonly receiptsCache = new Cache<string, ReceiptData>(10000),
    private readonly executionOutcomesCache = new Cache<
      string,
      ExecutionOutcomeData
    >(10000),
    private readonly transactionHashesCache = new Cache<string, string>(5000),
    private readonly alwaysStoreTransactions = new Cache(100),
  ) {}

  cacheBlock(block: Near.Block, shards: Near.Shard[]) {
    shards.forEach((shard) => {
      if (shard.chunk) {
        const chunk = shard.chunk;

        // cache transactions
        shard.chunk.transactions.forEach((transaction, indexInChunk) => {
          this.transactionsCache.set(transaction.transaction.hash, {
            block,
            chunk,
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
            chunk,
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
              shardId: shard.shard_id,
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

  alwaysStoreTransaction(transactionHash: string) {
    this.alwaysStoreTransactions.set(transactionHash, true);
  }

  isAlwaysStoreTransaction(transactionHash: string) {
    return this.alwaysStoreTransactions.has(transactionHash);
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
