import S3Fetcher from './s3-fetcher';
import config from './config';
import { sleep } from './utils';
import * as Near from './near';

export default class App {
  private readonly fetcher: S3Fetcher;
  private running = false;

  private lastBlockHeight: number;

  constructor() {
    this.fetcher = new S3Fetcher();
    this.lastBlockHeight = config.START_BLOCK_HEIGHT;
  }

  start() {
    this.running = true;
    process.nextTick(() => this.poll());
  }

  stop() {
    this.running = false;
  }

  private async poll() {
    while (this.running) {
      const blocks = await this.fetcher.listBlocks(this.lastBlockHeight);

      if (!blocks.length) {
        await sleep(2000);
        continue;
      }

      for (const blockHeight of blocks) {
        const block = await this.fetcher.getBlock(blockHeight);
        const shards = await Promise.all(
          block.chunks.map((chunk) =>
            this.fetcher.getShard(blockHeight, chunk.shard_id),
          ),
        );

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
    console.log(blockHeight, block, shards);
  }
}
