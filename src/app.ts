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
  CacheService,
  EventService,
  FtEventService,
  NftEventService,
  ObjectService,
  ProcessedBlockService,
} from './services';
import { BlockResult } from './types';

export default class App {
  private running = false;
  private currentBlockHeight: number;
  private processedBlocksCounter: number;
  private reportSpeedTimer: NodeJS.Timer;

  constructor(
    private startBlockHeight = config.START_BLOCK_HEIGHT,
    private readonly logger = createLogger('app'),
    private readonly fetcher = new S3Fetcher(),
    private readonly cacheService = new CacheService(),
    private readonly processedBlockService = new ProcessedBlockService(),
    private blocksQueue: BlockResult[] = [],
    private readonly reportSpeedInterval = 10,
    private readonly retryConfig: Partial<RetryConfig<unknown>> = {
      retries: 10,
      delay: 1000,
      logger: (msg: string) => this.logger.warn(msg),
    },
  ) {}

  async start() {
    this.running = true;
    this.processedBlocksCounter = 0;

    const latestBlockHeight =
      await this.processedBlockService.getLatestBlockHeight();

    if (latestBlockHeight && latestBlockHeight >= this.startBlockHeight) {
      this.startBlockHeight = latestBlockHeight + 1;
    }

    this.logger.info(`Start block height ${this.startBlockHeight}`);

    this.currentBlockHeight = this.startBlockHeight - config.LOOK_BACK_BLOCKS;

    process.nextTick(() => this.download());
    process.nextTick(() => this.process());
    this.reportSpeedTimer = setInterval(
      () => this.reportSpeed(),
      this.reportSpeedInterval * 1000,
    );
  }

  stop() {
    this.running = false;
    this.reportSpeedTimer && clearInterval(this.reportSpeedTimer);
  }

  private async download() {
    while (this.running) {
      const blocks = await retry(
        () => this.fetcher.listBlocks(this.currentBlockHeight),
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

      this.blocksQueue = this.blocksQueue.concat(results);

      this.currentBlockHeight = Math.max(
        ...results.map(({ blockHeight }) => blockHeight),
      );
    }
  }

  private async process() {
    let result: BlockResult | undefined;

    while (this.running && (result = this.blocksQueue.shift())) {
      await this.processBlock(result);
      this.processedBlocksCounter++;
    }

    if (this.running) {
      setImmediate(() => this.process());
    }
  }

  private async processBlock({ blockHeight, block, shards }: BlockResult) {
    this.log(blockHeight, block, shards);

    this.cacheService.cacheBlock(block, shards);

    if (this.currentBlockHeight < this.startBlockHeight) {
      this.logger.info(`Caching block ${blockHeight}...`);
      return;
    } else {
      this.logger.info(`Processing block ${blockHeight}...`);
    }

    await AppDataSource.transaction(async (manager) => {
      await new ObjectService(this.cacheService, manager).store(block, shards);

      await Promise.all([
        new AccountService(manager).store(block, shards),
        new AccessKeyService(manager).store(block, shards),
        new AccountChangeService(manager).store(block, shards),
        new EventService(manager).store(block, shards),
        new FtEventService(manager).store(block, shards),
        new NftEventService(manager).store(block, shards),
      ]);

      await new ProcessedBlockService(manager).store(block);
    });
  }

  private reportSpeed() {
    this.logger.info(
      `Speed: ${
        this.processedBlocksCounter / this.reportSpeedInterval
      } blocks/sec`,
    );
    this.processedBlocksCounter = 0;
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
