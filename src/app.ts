import { Logger } from 'log4js';
import { EntityManager } from 'typeorm';
import { Inject, Service } from 'typedi';
import { PromisePool } from '@supercharge/promise-pool';
import { retry, RetryConfig, wait } from 'ts-retry-promise';
import { S3Fetcher } from './s3-fetcher';
import { Config } from './config';
import { InjectEntityManager, InjectLogger } from './decorators';
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
import * as Near from './near';

@Service()
export class App {
  private running = false;

  private startBlockHeight = 0;
  private currentBlockHeight: number;
  private processedBlocksCounter = 0;

  private reportStatsTimer: NodeJS.Timer;
  private readonly reportStatsInterval = 10;

  private readonly retryConfig: Partial<RetryConfig<unknown>> = {
    retries: 10,
    delay: 1000,
    logger: (msg: string) => this.logger.warn(msg),
  };

  constructor(
    @InjectLogger('app')
    private readonly logger: Logger,
    @Inject()
    private readonly config: Config,
    @Inject()
    private readonly fetcher: S3Fetcher,
    @Inject()
    private readonly cacheService: CacheService,
    @Inject()
    private readonly objectService: ObjectService,
    @Inject()
    private readonly accountService: AccountService,
    @Inject()
    private readonly accessKeyService: AccessKeyService,
    @Inject()
    private readonly accountChangeService: AccountChangeService,
    @Inject()
    private readonly eventService: EventService,
    @Inject()
    private readonly ftEventService: FtEventService,
    @Inject()
    private readonly nftEventService: NftEventService,
    @Inject()
    private readonly processedBlockService: ProcessedBlockService,
    @InjectEntityManager()
    private readonly manager: EntityManager,
  ) {
    this.startBlockHeight = config.START_BLOCK_HEIGHT;
  }

  async start() {
    this.running = true;
    this.processedBlocksCounter = 0;

    const latestBlockHeight =
      await this.processedBlockService.getLatestBlockHeight();

    if (latestBlockHeight && latestBlockHeight >= this.startBlockHeight) {
      this.startBlockHeight = latestBlockHeight + 1;
    }

    this.logger.info(`Start block height ${this.startBlockHeight}`);

    this.currentBlockHeight = Math.max(
      this.startBlockHeight - this.config.LOOK_BACK_BLOCKS,
      1,
    );

    process.nextTick(() => this.download());
    this.reportStatsTimer = setInterval(
      () => this.reportStats(),
      this.reportStatsInterval * 1000,
    );
    this.reportStats();
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.reportStatsTimer && clearInterval(this.reportStatsTimer);
    this.reportStats();
  }

  private async download() {
    let processPromise;

    while (this.running) {
      const blocks = await retry(
        () => this.fetcher.listBlocks(this.currentBlockHeight),
        this.retryConfig,
      );

      if (!blocks.length) {
        this.logger.info('Waiting for new blocks...');
        await wait(this.config.WAIT_FOR_NEW_BLOCKS);
        continue;
      }

      const { results } = await PromisePool.for(blocks)
        .withConcurrency(this.config.BLOCKS_DL_CONCURRENCY)
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

      this.currentBlockHeight = results[results.length - 1].blockHeight + 1;

      if (processPromise) {
        await processPromise;
      }

      processPromise = this.process(results);
    }
  }

  private async process(results: BlockResult[]) {
    for (const result of results) {
      await this.processBlock(result);
      this.processedBlocksCounter++;
    }
  }

  private async processBlock({ blockHeight, block, shards }: BlockResult) {
    this.log(blockHeight, block, shards);

    this.cacheService.cacheBlock(block, shards);

    if (blockHeight < this.startBlockHeight) {
      this.logger.info(`Caching block ${blockHeight}...`);
      return;
    } else {
      this.logger.debug(`Processing block ${blockHeight}...`);
    }

    await this.manager.transaction(async (manager) => {
      await this.objectService.store(manager, block, shards);

      await Promise.all([
        this.accountService.store(manager, block, shards),
        this.accessKeyService.store(manager, block, shards),
        this.accountChangeService.store(manager, block, shards),
        this.eventService.store(manager, block, shards),
        this.ftEventService.store(manager, block, shards),
        this.nftEventService.store(manager, block, shards),
      ]);

      await this.processedBlockService.store(manager, block);
    });
  }

  private reportStats() {
    const speed = this.processedBlocksCounter / this.reportStatsInterval;
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;

    this.logger.info(
      `Current block: ${
        this.currentBlockHeight
      }, speed: ${speed} blocks/sec, memory usage: ${
        Math.round(memUsage * 100) / 100
      } MB`,
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
