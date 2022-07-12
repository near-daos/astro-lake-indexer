import { Logger } from 'log4js';
import LRUCache from 'lru-cache';
import { Inject, Service } from 'typedi';
import { TransactionService } from './transaction.service';
import { FullTransaction } from '../types';
import * as Near from '../near';
import { InjectLogger } from '../decorators';

@Service({ global: true })
export class CacheService {
  constructor(
    @InjectLogger('cache-service')
    private readonly logger: Logger,
    @Inject()
    private readonly transactionService: TransactionService,
    private readonly fullTransactionsCache = new LRUCache<
      string,
      FullTransaction
    >({ max: 1000 }),
    private readonly transactionHashesCache = new LRUCache<string, string>({
      max: 10000,
    }),
    private readonly alwaysStoreTransactions = new LRUCache<string, boolean>({
      max: 100,
    }),
  ) {}

  cacheBlock(block: Near.Block, shards: Near.Shard[]) {
    shards.forEach((shard) => {
      if (shard.chunk) {
        const chunk = shard.chunk;

        // cache transactions
        shard.chunk.transactions.forEach((transaction, indexInChunk) => {
          const fullTransaction = this.fullTransactionsCache.get(
            transaction.transaction.hash,
          );

          // add transaction to full transaction
          if (!fullTransaction) {
            this.fullTransactionsCache.set(transaction.transaction.hash, {
              transaction: {
                block,
                chunk,
                indexInChunk,
                transaction,
              },
              receipts: [],
              executionOutcomes: [],
            });
          }

          // store transaction hash for future receipts
          this.transactionHashesCache.set(
            transaction.outcome.execution_outcome.outcome.receipt_ids[0],
            transaction.transaction.hash,
          );
        });

        // cache receipts
        shard.chunk.receipts.forEach((receipt, indexInChunk) => {
          const receiptOrDataId = Near.getReceiptOrDataId(receipt);

          const transactionHash =
            this.transactionHashesCache.get(receiptOrDataId);

          if (!transactionHash) {
            this.logger.warn(
              `Not found parent tx hash for receipt: ${receiptOrDataId}`,
            );
            return;
          }

          const fullTransaction =
            this.fullTransactionsCache.get(transactionHash);

          if (!fullTransaction) {
            throw new Error(`Not found full tx for hash: ${fullTransaction}`);
          }

          // add receipt to full transaction
          fullTransaction.receipts.push({
            block,
            chunk,
            indexInChunk,
            transactionHash,
            receipt,
          });

          const receiptType = Near.parseKind<Near.ReceiptTypes>(
            receipt.receipt,
          );

          if (receiptType !== Near.ReceiptTypes.Action) {
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
          const transactionHash = this.transactionHashesCache.get(
            executionOutcome.execution_outcome.id,
          );

          if (!transactionHash) {
            this.logger.warn(
              `Not found parent tx hash for execution outcome: ${executionOutcome.execution_outcome.id}`,
            );
            return;
          }

          const fullTransaction =
            this.fullTransactionsCache.get(transactionHash);

          if (!fullTransaction) {
            throw new Error(`Not found full tx for hash: ${transactionHash}`);
          }

          // add execution outcome to full transaction
          fullTransaction.executionOutcomes.push({
            block,
            shardId: shard.shard_id,
            indexInChunk,
            executionOutcome,
          });

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

  getFullTransaction(transactionHash: string) {
    return this.fullTransactionsCache.get(transactionHash);
  }

  getTransactionHash(receiptOrDataId: string) {
    return this.transactionHashesCache.get(receiptOrDataId);
  }

  setAlwaysStoreTransaction(transactionHash: string) {
    this.alwaysStoreTransactions.set(transactionHash, true);
  }

  isAlwaysStoreTransaction(transactionHash: string) {
    return this.alwaysStoreTransactions.has(transactionHash);
  }

  async loadAlwaysStoreTransactions() {
    const transactionHashes =
      await this.transactionService.getLatestTransactionHashes(
        this.alwaysStoreTransactions.max,
      );

    transactionHashes.forEach((hash) => {
      this.alwaysStoreTransactions.set(hash, true);
    });
  }
}
