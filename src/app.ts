import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { wait } from 'ts-retry-promise';
import { PromisePool } from '@supercharge/promise-pool';
import { S3Fetcher } from './s3-fetcher';
import { Config } from './config';
import { InjectLogger } from './decorators';
import {
  AccessKeyService,
  AccountChangeService,
  AccountService,
  CacheService,
  EventService,
  FtEventService,
  LastBlockService,
  NftEventService,
  ObjectService,
  StatsDService,
} from './services';
import tracer from './tracing';
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

  constructor(
    @InjectLogger('app')
    private readonly logger: Logger,
    @Inject()
    private readonly config: Config,
    @Inject()
    private readonly fetcher: S3Fetcher,
    @Inject()
    private readonly statsDService: StatsDService,
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
    private readonly lastBlockService: LastBlockService,
  ) {
    this.startBlockHeight = config.START_BLOCK_HEIGHT;
  }

  async start() {
    this.running = true;
    this.processedBlocksCounter = 0;

    await this.cacheService.loadAlwaysStoreTransactions();

    const latestBlockHeight =
      await this.lastBlockService.getLatestBlockHeight();

    if (latestBlockHeight && latestBlockHeight >= this.startBlockHeight) {
      this.startBlockHeight = latestBlockHeight + 1;
    }

    this.logger.info(`Start block height: ${this.startBlockHeight}`);

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
      const blocks = await this.fetcher.listBlocksWithRetry(
        this.currentBlockHeight,
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
        .process(async (blockHeight) =>
          tracer.trace('block.download', async (span) => {
            span?.setTag('height', blockHeight);

            return this.fetcher.getFullBlockWithRetry(blockHeight);
          }),
        );

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
      await tracer.trace('block.process', async (span) => {
        await this.processBlock(result);
        span?.setTag('height', result.blockHeight);
      });
      this.processedBlocksCounter++;
    }
  }

  private async processBlock({ blockHeight, block, shards }: BlockResult) {
    this.log(blockHeight, block, shards);

    this.cacheService.cacheBlock(block, shards);

    if (blockHeight < this.startBlockHeight) {
      this.logger.info(
        `Caching block ${blockHeight} (txs: ${this.cacheService.getTransactionsCount()}, hashes: ${this.cacheService.getTransactionHashesCount()})...`,
      );
      return;
    } else {
      this.logger.debug(`Processing block ${blockHeight}...`);
    }

    await this.objectService.store(block, shards);

    await Promise.all([
      this.accountService.store(block, shards),
      this.accessKeyService.store(block, shards),
      this.accountChangeService.store(block, shards),
      this.eventService.store(block, shards),
      this.ftEventService.store(block, shards),
      this.nftEventService.store(block, shards),
    ]);

    await this.lastBlockService.store(block);
  }

  private reportStats() {
    const speed = this.processedBlocksCounter / this.reportStatsInterval;
    const memUsage = process.memoryUsage();
    const heapUsedMb = memUsage.heapUsed / 1024 / 1024;

    this.logger.info(
      `Current block: ${
        this.currentBlockHeight
      }, speed: ${speed} blocks/sec, memory usage: ${
        Math.round(heapUsedMb * 100) / 100
      } MB`,
    );

    // send stats to datadog
    this.statsDService.client.gauge('block.current', this.currentBlockHeight);
    this.statsDService.client.gauge('block.rate', speed);
    this.statsDService.client.gauge('memory.rss', memUsage.rss);
    this.statsDService.client.gauge('memory.heapTotal', memUsage.heapTotal);
    this.statsDService.client.gauge('memory.heapUsed', memUsage.heapUsed);

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
