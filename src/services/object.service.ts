import { Logger } from 'log4js';
import { uniqWith } from 'lodash';
import { Inject, Service } from 'typedi';
import { BlockService } from './block.service';
import { CacheService } from './cache.service';
import { ChunkService } from './chunk.service';
import { TransactionService } from './transaction.service';
import { ReceiptService } from './receipt.service';
import { RedisService } from './redis.service';
import { ExecutionOutcomeService } from './execution-outcome.service';
import { InjectLogger } from '../decorators';
import * as Near from '../near';
import { ExecutionOutcomeData, ReceiptData, TransactionData } from '../types';

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
    @Inject()
    private readonly redisService: RedisService,
  ) {}

  async store(block: Near.Block, shards: Near.Shard[]) {
    let transactions: TransactionData[] = [];
    let receipts: ReceiptData[] = [];
    let executionOutcomes: ExecutionOutcomeData[] = [];
    const streamReceiptIds: string[] = [];

    shards.forEach((shard) => {
      if (shard.chunk) {
        const chunk = shard.chunk;

        // get transaction to store
        shard.chunk.transactions.forEach((transaction, indexInChunk) => {
          if (this.transactionService.shouldStore(transaction)) {
            // mark the whole transaction as always to store for future receipts & execution outcomes
            this.cacheService.setAlwaysStoreTransaction(
              transaction.transaction.hash,
            );

            transactions.push({ block, chunk, indexInChunk, transaction });
          }
        });

        // get receipts to store
        shard.chunk.receipts.forEach((receipt, indexInChunk) => {
          const transactionHash = this.cacheService.getTransactionHash(
            Near.getReceiptOrDataId(receipt),
          );

          if (!transactionHash) {
            throw new Error(
              `Not found parent tx hash for receipt: ${receipt.receipt_id}`,
            );
          }

          if (this.cacheService.isAlwaysStoreTransaction(transactionHash)) {
            // store the whole transaction
            receipts.push({
              block,
              chunk,
              indexInChunk,
              transactionHash,
              receipt,
            });
          }

          if (this.receiptService.shouldStore(receipt)) {
            // mark the whole transaction as always to store for future receipts & execution outcomes
            this.cacheService.setAlwaysStoreTransaction(transactionHash);

            // get full transaction
            const fullTransaction =
              this.cacheService.getFullTransaction(transactionHash);

            if (!fullTransaction) {
              throw new Error(`Not found full tx for hash: ${transactionHash}`);
            }

            transactions.push(fullTransaction.transaction);
            receipts = receipts.concat(fullTransaction.receipts);
            executionOutcomes = executionOutcomes.concat(
              fullTransaction.executionOutcomes,
            );

            streamReceiptIds.push(receipt.receipt_id);
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
            throw new Error(
              `Not found parent tx hash for execution outcome ${executionOutcome.execution_outcome.id}`,
            );
          }

          if (this.cacheService.isAlwaysStoreTransaction(transactionHash)) {
            // store the whole transaction
            executionOutcomes.push({
              block,
              shardId: shard.shard_id,
              indexInChunk,
              executionOutcome,
            });
          }

          if (this.executionOutcomeService.shouldStore(executionOutcome)) {
            // mark transaction as always to store for future receipts & execution outcomes
            this.cacheService.setAlwaysStoreTransaction(transactionHash);

            // get full transaction
            const fullTransaction =
              this.cacheService.getFullTransaction(transactionHash);

            if (!fullTransaction) {
              throw new Error(`Not found full tx for hash: ${transactionHash}`);
            }

            transactions.push(fullTransaction.transaction);
            receipts = receipts.concat(fullTransaction.receipts);
            executionOutcomes = executionOutcomes.concat(
              fullTransaction.executionOutcomes,
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
    let chunks = [
      ...transactions.map(({ block, chunk }) => ({ block, chunk })),
      ...receipts.map(({ block, chunk }) => ({ block, chunk })),
    ];

    // find unique blocks
    blocks = uniqWith(blocks, (a, b) => a.header.height === b.header.height);

    // find unique chunks
    chunks = uniqWith(
      chunks,
      (a, b) =>
        a.block.header.height === b.block.header.height &&
        a.chunk.header.shard_id === b.chunk.header.shard_id,
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

    const chunkEntities = chunks.map(({ block, chunk }) =>
      this.chunkService.fromJSON(block.header.hash, chunk),
    );

    const transactionEntities = transactions.map(
      ({ block, chunk, indexInChunk, transaction }) =>
        this.transactionService.fromJSON(
          block.header.hash,
          block.header.timestamp,
          chunk.header.chunk_hash,
          indexInChunk,
          transaction,
        ),
    );

    const receiptEntities = receipts.map(
      ({ block, chunk, indexInChunk, transactionHash, receipt }) =>
        this.receiptService.fromJSON(
          block.header.hash,
          block.header.timestamp,
          chunk.header.chunk_hash,
          indexInChunk,
          transactionHash,
          receipt,
        ),
    );

    const executionOutcomeEntities = executionOutcomes.map(
      ({ block, shardId, indexInChunk, executionOutcome }) =>
        this.executionOutcomeService.fromJSON(
          block.header.hash,
          block.header.timestamp,
          shardId,
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

    // stream receipts
    if (receiptEntities.length) {
      streamReceiptIds.forEach((receiptId) => {
        const receipt = receiptEntities.find(
          (receipt) => receipt.receipt_id === receiptId,
        );

        if (!receipt) {
          return;
        }

        this.redisService.streamReceipt(receipt);
      });
    }
  }
}
