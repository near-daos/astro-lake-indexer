import { PromisePool } from '@supercharge/promise-pool';
import { retry, RetryConfig, wait } from 'ts-retry-promise';
import S3Fetcher from './s3-fetcher';
import config from './config';
import * as Near from './near';
import { createLogger } from './logger';
import { AppDataSource } from './data-source';
import {
  AccessKeyService,
  AccountChangeService,
  AccountService,
  BlockService,
  ChunkService,
  ExecutionOutcomeService,
  FtEventService,
  NftEventService,
  ProcessedBlockService,
  ReceiptService,
  TransactionService,
} from './services';

export default class App {
  private running = false;

  constructor(
    private lastBlockHeight = config.START_BLOCK_HEIGHT,
    private readonly logger = createLogger('app'),
    private readonly fetcher = new S3Fetcher(),
    private readonly blockService = new BlockService(),
    private readonly transactionService = new TransactionService(),
    private readonly receiptService = new ReceiptService(),
    private readonly executionOutcomeService = new ExecutionOutcomeService(),
    private readonly processedBlockService = new ProcessedBlockService(),
    private readonly retryConfig: Partial<RetryConfig<unknown>> = {
      retries: 10,
      delay: 1000,
      logger: (msg: string) => this.logger.warn(msg),
    },
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

    this.transactionService.cacheTransactionHashesForReceipts(shards);
    this.receiptService.cacheTransactionHashForReceipts(shards);
    this.executionOutcomeService.cacheTransactionHashesForReceipts(shards);

    this.logger.info(`Processing block ${blockHeight}...`);

    await AppDataSource.transaction(async (manager) => {
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
    });
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
