import { PromisePool } from '@supercharge/promise-pool';
import S3Fetcher from './s3-fetcher';
import config from './config';
import { sleep } from './utils';
import * as Near from './near';
import { createLogger } from './logger';
import * as services from './services';
import { AppDataSource } from './data-source';

export default class App {
  private running = false;

  constructor(
    private readonly logger = createLogger('app'),
    private readonly fetcher = new S3Fetcher(),
    private lastBlockHeight = config.START_BLOCK_HEIGHT,
  ) {}

  async start() {
    this.running = true;

    const latestBlockHeight =
      await services.blockService.getLatestBlockHeight();

    if (latestBlockHeight && latestBlockHeight > this.lastBlockHeight) {
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
      const blocks = await this.fetcher.listBlocks(this.lastBlockHeight);

      if (!blocks.length) {
        this.logger.info('Waiting for new blocks...');
        await sleep(config.WAIT_FOR_NEW_BLOCKS);
        continue;
      }

      const { results } = await PromisePool.for(blocks)
        .withConcurrency(10)
        .process(async (blockHeight) => {
          const block = await this.fetcher.getBlock(blockHeight);
          const shards = await Promise.all(
            block.chunks.map((chunk) =>
              this.fetcher.getShard(blockHeight, chunk.shard_id),
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
    if (!this.shouldStore(shards)) {
      this.logger.info(`Skipped block ${blockHeight}`);
      return;
    }

    this.logger.info(`Storing block ${blockHeight}...`);

    await AppDataSource.transaction(async () => {
      await services.blockService.store(block);

      await services.chunkService.store(block, shards);

      await Promise.all([
        services.transactionService.store(block, shards),
        services.receiptService.store(block, shards),
      ]);
    });
  }

  private shouldStore(shards: Near.Shard[]) {
    return true; // TODO

    for (const shard of shards) {
      if (!shard.chunk) continue;

      for (const tx of shard.chunk.transactions) {
        if (services.transactionService.shouldTrack(tx)) {
          return true;
        }
      }
    }
  }
}
