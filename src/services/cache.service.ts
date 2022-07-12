import { Logger } from 'log4js';
import LRUCache from 'lru-cache';
import { Inject, Service } from 'typedi';
import { TransactionService } from './transaction.service';
import { Config } from '../config';
import { InjectLogger } from '../decorators';
import { FullTransaction } from '../types';
import * as Near from '../near';

@Service({ global: true })
export class CacheService {
  private readonly fullTransactionsCache: LRUCache<string, FullTransaction>;
  private readonly transactionHashesCache: LRUCache<string, string>;
  private readonly alwaysStoreTransactions: LRUCache<string, boolean>;

  constructor(
    @InjectLogger('cache-service')
    private readonly logger: Logger,
    @Inject()
    private readonly config: Config,
    @Inject()
    private readonly transactionService: TransactionService,
  ) {
    this.fullTransactionsCache = new LRUCache<string, FullTransaction>({
      max: this.config.TX_CACHE_SIZE,
    });
    this.transactionHashesCache = new LRUCache<string, string>({
      max: this.config.TX_HASHES_CACHE_SIZE,
    });
    this.alwaysStoreTransactions = new LRUCache<string, boolean>({
      max: 100,
    });
  }

  cacheBlock(nearBlock: Near.Block, shards: Near.Shard[]) {
    const block = {
      author: nearBlock.author,
      header: nearBlock.header,
    };

    shards.forEach((shard) => {
      if (shard.chunk) {
        const chunk = {
          author: shard.chunk.author,
          header: shard.chunk.header,
        };

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

  getTransactionsCount() {
    return this.fullTransactionsCache.size;
  }

  getTransactionHashesCount() {
    return this.transactionHashesCache.size;
  }
}
