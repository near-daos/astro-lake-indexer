import LRUCache from 'lru-cache';
import { uniqWith } from 'lodash';
import { PromisePool } from '@supercharge/promise-pool';
import { retry, RetryConfig, wait } from 'ts-retry-promise';
import S3Fetcher from './s3-fetcher';
import config from './config';
import * as Near from './near';
import { createLogger } from './logger';
import { AppDataSource } from './data-source';
import {
  BlockService,
  CacheService,
  ChunkService,
  ExecutionOutcomeService,
  ProcessedBlockService,
  ReceiptService,
  TransactionService,
} from './services';
import {
  ExecutionOutcomeData,
  ReceiptDataWithTransactionHash,
  TransactionData,
} from './types';

export default class App {
  private running = false;

  constructor(
    private lastBlockHeight = config.START_BLOCK_HEIGHT,
    private readonly logger = createLogger('app'),
    private readonly fetcher = new S3Fetcher(),
    private readonly blockService = new BlockService(),
    private readonly chunkService = new ChunkService(),
    private readonly transactionService = new TransactionService(),
    private readonly receiptService = new ReceiptService(),
    private readonly executionOutcomeService = new ExecutionOutcomeService(),
    private readonly processedBlockService = new ProcessedBlockService(),
    private readonly cacheService = new CacheService(),

    private readonly retryConfig: Partial<RetryConfig<unknown>> = {
      retries: 10,
      delay: 1000,
      logger: (msg: string) => this.logger.warn(msg),
    },

    private readonly alwaysSaveTransactions = new LRUCache({
      max: 100,
    }),
  ) {}

  async start() {
    this.running = true;

    const latestBlockHeight =
      await this.processedBlockService.getLatestBlockHeight();

    if (latestBlockHeight && latestBlockHeight >= this.lastBlockHeight) {
      this.lastBlockHeight = latestBlockHeight + 1;
    }

    this.logger.info(`Last block height ${this.lastBlockHeight}`);
    process.nextTick(() => this.poll());
  }

  stop() {
    this.running = false;
  }

  private async poll() {
    while (this.running) {
      const blocks = await retry(
        () => this.fetcher.listBlocks(this.lastBlockHeight),
        this.retryConfig,
      );

      if (!blocks.length) {
        this.logger.info('Waiting for new blocks...');
        await wait(config.WAIT_FOR_NEW_BLOCKS);
        continue;
      }

      const { results } = await PromisePool.for(blocks)
        .withConcurrency(config.BLOCKS_DL_CONCURRENCY)
        .handleError((err) => {
          throw err;
        })
        .process(async (blockHeight) => {
          const block = await retry(
            () => this.fetcher.getBlock(blockHeight),
            this.retryConfig,
          );

          const shards = await Promise.all(
            block.chunks.map((chunk) =>
              retry(
                () => this.fetcher.getShard(blockHeight, chunk.shard_id),
                this.retryConfig,
              ),
            ),
          );

          return { blockHeight, block, shards };
        });

      results.sort((a, b) => a.blockHeight - b.blockHeight);

      for (const { blockHeight, block, shards } of results) {
        await this.processBlock(blockHeight, block, shards);

        this.lastBlockHeight = blockHeight + 1;
      }
    }
  }

  private async processBlock(
    blockHeight: number,
    block: Near.Block,
    shards: Near.Shard[],
  ) {
    this.log(blockHeight, block, shards);

    this.logger.info(`Processing block ${blockHeight}...`);

    this.cacheService.cacheBlock(block, shards);

    let transactions: TransactionData[] = [];
    let receipts: ReceiptDataWithTransactionHash[] = [];
    let executionOutcomes: ExecutionOutcomeData[] = [];

    shards.forEach((shard) => {
      if (shard.chunk) {
        // check if we should save transaction
        shard.chunk.transactions.forEach((transaction, indexInChunk) => {
          if (this.transactionService.shouldStore(transaction)) {
            // mark transaction as always save for future receipts & execution outcomes
            this.alwaysSaveTransactions.set(transaction.transaction.hash, true);

            transactions.push({ block, shard, indexInChunk, transaction });
          }
        });

        // check if we should save receipt
        shard.chunk.receipts.forEach((receipt, indexInChunk) => {
          const transactionHash = this.cacheService.getTransactionHash(
            Near.getReceiptOrDataId(receipt),
          );

          if (!transactionHash) {
            // TODO error
            return;
          }

          if (this.alwaysSaveTransactions.has(transactionHash)) {
            receipts.push({
              block,
              shard,
              indexInChunk,
              transactionHash,
              receipt,
            });
          }

          if (this.receiptService.shouldStore(receipt)) {
            // mark transaction as always save for future receipts & execution outcomes
            this.alwaysSaveTransactions.set(transactionHash, true);

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
            // TODO log error
            return;
          }

          if (this.alwaysSaveTransactions.has(transactionHash)) {
            executionOutcomes.push({
              block,
              shard,
              indexInChunk,
              executionOutcome,
            });
          }

          if (this.executionOutcomeService.shouldStore(executionOutcome)) {
            // mark transaction as always save for future receipts & execution outcomes
            this.alwaysSaveTransactions.set(transactionHash, true);

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

    console.log({
      transactions: transactions.map(
        ({ transaction }) => transaction.transaction.hash,
      ),
      receipts: receipts.map(({ receipt }) => receipt.receipt_id),
      executionOutcomes: executionOutcomes.map(
        ({ executionOutcome }) => executionOutcome.execution_outcome.id,
      ),
    });

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

    console.log({
      blockEntities: blockEntities.map((block) => block.block_hash),
      chunkEntities: chunkEntities.map((chunk) => chunk.chunk_hash),
      transactionEntities: transactionEntities.map(
        (transaction) => transaction.transaction_hash,
      ),
      receiptEntities: receiptEntities.map((receipt) => receipt.receipt_id),
      executionOutcomeEntities: executionOutcomeEntities.map(
        (executionOutcome) => executionOutcome.receipt_id,
      ),
    });

    await AppDataSource.transaction(async (manager) => {
      await new BlockService(manager).insert(blockEntities);
      await new ChunkService(manager).insert(chunkEntities);
      await new TransactionService(manager).insert(transactionEntities);
      await new ReceiptService(manager).insert(receiptEntities);
      await new ExecutionOutcomeService(manager).insert(
        executionOutcomeEntities,
      );
    });

    /*await AppDataSource.transaction(async (manager) => {
      await new BlockService(manager).store(block, shards);
      await new ChunkService(manager).store(block, shards);
      await new TransactionService(manager).store(block, shards);
      await new ReceiptService(manager).store(block, shards);

      await Promise.all([
        new ExecutionOutcomeService(manager).store(block, shards),
        new AccountService(manager).handle(block, shards),
      ]);

      await Promise.all([
        new AccessKeyService(manager).handle(block, shards),
        new AccountChangeService(manager).store(block, shards),
        new FtEventService(manager).store(block, shards),
        new NftEventService(manager).store(block, shards),
      ]);

      await new ProcessedBlockService(manager).store(block);
    });*/
  }

  private log(blockHeight: number, block: Near.Block, shards: Near.Shard[]) {
    this.logger.trace(
      `Block #${blockHeight} (${block.header.hash}; ${block.header.timestamp}):`,
    );

    shards.forEach((shard) => {
      if (shard.chunk) {
        this.logger.trace(`  Chunk ${shard.shard_id}:`);

        shard.chunk.transactions.forEach((tx) => {
          this.logger.trace(`    TX ${tx.transaction.hash}:`);

          tx.transaction.actions.forEach((action) => {
            this.logger.trace(`      Action: ${Near.parseKind(action)}`);
          });

          this.logger.trace(
            `      => Receipt: ${tx.outcome.execution_outcome.outcome.receipt_ids[0]}`,
          );
        });

        shard.chunk.receipts.forEach((receipt) => {
          this.logger.trace(`    Receipt ${receipt.receipt_id}:`);

          const kind = Near.parseKind<Near.ReceiptTypes>(receipt.receipt);

          switch (kind) {
            case Near.ReceiptTypes.Data:
              const {
                Data: { data },
              } = receipt.receipt as Near.DataReceipt;
              this.logger.trace(
                `      Data: ${
                  data !== null
                    ? Buffer.from(data, 'base64').toString()
                    : 'null'
                }`,
              );
              break;

            case Near.ReceiptTypes.Action:
              (receipt.receipt as Near.ActionReceipt).Action.actions.forEach(
                (action) => {
                  this.logger.trace(`      Action: ${Near.parseKind(action)}`);
                },
              );
              break;
          }
        });
      }

      shard.receipt_execution_outcomes.forEach((outcome) => {
        this.logger.trace(
          `    Outcome ${outcome.execution_outcome.id} (${Near.parseKind(
            outcome.execution_outcome.outcome.status,
          )}):`,
        );

        outcome.execution_outcome.outcome.receipt_ids.forEach((id) => {
          this.logger.trace(`      => Receipt: ${id}`);
        });
      });
    });
  }
}
