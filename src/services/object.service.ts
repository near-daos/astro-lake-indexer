import { Logger } from 'log4js';
import { uniqWith } from 'lodash';
import { Inject, Service } from 'typedi';
import { BlockService } from './block.service';
import { CacheService } from './cache.service';
import { ChunkService } from './chunk.service';
import { TransactionService } from './transaction.service';
import { ReceiptService } from './receipt.service';
import { ExecutionOutcomeService } from './execution-outcome.service';
import { InjectLogger } from '../decorators';
import * as Near from '../near';
import {
  ExecutionOutcomeData,
  ReceiptDataWithTransactionHash,
  TransactionData,
} from '../types';

@Service()
export class ObjectService {
  constructor(
    @InjectLogger('object-service')
    private readonly logger: Logger,
    @Inject()
    private readonly cacheService: CacheService,
    @Inject()
    private readonly blockService: BlockService,
    @Inject()
    private readonly chunkService: ChunkService,
    @Inject()
    private readonly transactionService: TransactionService,
    @Inject()
    private readonly receiptService: ReceiptService,
    @Inject()
    private readonly executionOutcomeService: ExecutionOutcomeService,
  ) {}

  async store(block: Near.Block, shards: Near.Shard[]) {
    let transactions: TransactionData[] = [];
    let receipts: ReceiptDataWithTransactionHash[] = [];
    let executionOutcomes: ExecutionOutcomeData[] = [];

    shards.forEach((shard) => {
      if (shard.chunk) {
        // get transaction to store
        shard.chunk.transactions.forEach((transaction, indexInChunk) => {
          if (this.transactionService.shouldStore(transaction)) {
            // mark the whole transaction as always to store for future receipts & execution outcomes
            this.cacheService.alwaysStoreTransaction(
              transaction.transaction.hash,
            );

            transactions.push({ block, shard, indexInChunk, transaction });
          }
        });

        // get receipts to store
        shard.chunk.receipts.forEach((receipt, indexInChunk) => {
          const transactionHash = this.cacheService.getTransactionHash(
            Near.getReceiptOrDataId(receipt),
          );

          if (!transactionHash) {
            this.logger.warn(
              `Not found parent tx hash for receipt ${receipt.receipt_id}`,
            );
          }

          if (
            transactionHash &&
            this.cacheService.isAlwaysStoreTransaction(transactionHash)
          ) {
            // store the whole transaction
            receipts.push({
              block,
              shard,
              indexInChunk,
              transactionHash,
              receipt,
            });
          }

          if (this.receiptService.shouldStore(receipt)) {
            // transaction hash is mandatory
            if (!transactionHash) {
              throw new Error(
                `Not found parent tx hash for receipt ${receipt.receipt_id}`,
              );
            }

            // mark the whole transaction as always to store for future receipts & execution outcomes
            this.cacheService.alwaysStoreTransaction(transactionHash);

            // find all objects in transaction
            const results =
              this.cacheService.findObjectsByTransactionHash(transactionHash);

            transactions = transactions.concat(results.transactions);
            receipts = receipts.concat(
              results.receipts.map((receipt) => ({
                ...receipt,
                transactionHash,
              })),
            );
            executionOutcomes = executionOutcomes.concat(
              results.executionOutcomes,
            );
          }
        });
      }

      // check if we should save execution outcome
      shard.receipt_execution_outcomes.forEach(
        (executionOutcome, indexInChunk) => {
          const transactionHash = this.cacheService.getTransactionHash(
            executionOutcome.execution_outcome.id,
          );

          if (!transactionHash) {
            this.logger.warn(
              `Not found parent tx hash for execution outcome ${executionOutcome.execution_outcome.id}`,
            );
          }

          if (
            transactionHash &&
            this.cacheService.isAlwaysStoreTransaction(transactionHash)
          ) {
            // store the whole transaction
            executionOutcomes.push({
              block,
              shard,
              indexInChunk,
              executionOutcome,
            });
          }

          if (this.executionOutcomeService.shouldStore(executionOutcome)) {
            // transaction hash is mandatory
            if (!transactionHash) {
              throw new Error(
                `Not found parent tx hash for execution outcome ${executionOutcome.execution_outcome.id}`,
              );
            }

            // mark transaction as always to store for future receipts & execution outcomes
            this.cacheService.alwaysStoreTransaction(transactionHash);

            // find all objects in transaction
            const results =
              this.cacheService.findObjectsByTransactionHash(transactionHash);

            transactions = transactions.concat(results.transactions);
            receipts = receipts.concat(
              results.receipts.map((receipt) => ({
                ...receipt,
                transactionHash,
              })),
            );
            executionOutcomes = executionOutcomes.concat(
              results.executionOutcomes,
            );
          }
        },
      );
    });

    if (!transactions.length && !receipts.length && !executionOutcomes.length) {
      return;
    }

    // extract blocks to store
    let blocks = [
      ...transactions.map(({ block }) => block),
      ...receipts.map(({ block }) => block),
      ...executionOutcomes.map(({ block }) => block),
    ];

    // extract shards to store
    let blockShards = [
      ...transactions.map(({ block, shard }) => ({ block, shard })),
      ...receipts.map(({ block, shard }) => ({ block, shard })),
      ...executionOutcomes.map(({ block, shard }) => ({ block, shard })),
    ];

    // find unique blocks
    blocks = uniqWith(blocks, (a, b) => a.header.height === b.header.height);

    // find unique shards
    blockShards = uniqWith(
      blockShards,
      (a, b) =>
        a.block.header.height === b.block.header.height &&
        a.shard.shard_id === b.shard.shard_id,
    );

    // find unique transactions
    transactions = uniqWith(
      transactions,
      (a, b) =>
        a.transaction.transaction.hash === b.transaction.transaction.hash,
    );

    // find unique receipts
    receipts = uniqWith(
      receipts,
      (a, b) => a.receipt.receipt_id === b.receipt.receipt_id,
    );

    // find unique execution outcomes
    executionOutcomes = uniqWith(
      executionOutcomes,
      (a, b) =>
        a.executionOutcome.execution_outcome.id ===
        b.executionOutcome.execution_outcome.id,
    );

    const blockEntities = blocks.map((block) =>
      this.blockService.fromJSON(block),
    );

    const chunkEntities = blockShards.map(({ block, shard }) =>
      this.chunkService.fromJSON(block.header.hash, shard.chunk as Near.Chunk),
    );

    const transactionEntities = transactions.map(
      ({ block, shard, indexInChunk, transaction }) =>
        this.transactionService.fromJSON(
          block.header.hash,
          block.header.timestamp,
          (shard.chunk as Near.Chunk).header.chunk_hash,
          indexInChunk,
          transaction,
        ),
    );

    const receiptEntities = receipts.map(
      ({ block, shard, indexInChunk, transactionHash, receipt }) =>
        this.receiptService.fromJSON(
          block.header.hash,
          block.header.timestamp,
          (shard.chunk as Near.Chunk).header.chunk_hash,
          indexInChunk,
          transactionHash,
          receipt,
        ),
    );

    const executionOutcomeEntities = executionOutcomes.map(
      ({ block, shard, indexInChunk, executionOutcome }) =>
        this.executionOutcomeService.fromJSON(
          block.header.hash,
          block.header.timestamp,
          shard.shard_id,
          indexInChunk,
          executionOutcome,
        ),
    );

    if (blockEntities.length) {
      await this.blockService.insertIgnore(blockEntities);
      this.logger.info(
        'Stored blocks: %d (%s)',
        blockEntities.length,
        blockEntities.map((block) => block.block_hash).join(', '),
      );
    }

    if (chunkEntities.length) {
      await this.chunkService.insertIgnore(chunkEntities);
      this.logger.info(
        'Stored chunks: %d (%s)',
        chunkEntities.length,
        chunkEntities.map((chunk) => chunk.chunk_hash).join(', '),
      );
    }

    if (transactionEntities.length) {
      await this.transactionService.insertIgnore(transactionEntities);
      this.logger.info(
        'Stored transactions: %d (%s)',
        transactionEntities.length,
        transactionEntities
          .map((transaction) => transaction.transaction_hash)
          .join(', '),
      );
    }

    if (receiptEntities.length) {
      await this.receiptService.insertIgnore(receiptEntities);
      this.logger.info(
        'Stored receipts: %d (%s)',
        receiptEntities.length,
        receiptEntities.map((receipt) => receipt.receipt_id).join(', '),
      );
    }

    if (executionOutcomeEntities.length) {
      await this.executionOutcomeService.insertIgnore(executionOutcomeEntities);
      this.logger.info(
        'Stored execution outcomes: %d (%s)',
        executionOutcomeEntities.length,
        executionOutcomeEntities
          .map((executionOutcome) => executionOutcome.receipt_id)
          .join(', '),
      );
    }
  }
}
