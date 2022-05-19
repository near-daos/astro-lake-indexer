import S3Fetcher from './s3-fetcher';
import config from './config';

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
    setImmediate(this.poll.bind(this));
  }

  stop() {
    this.running = false;
  }

  private async poll() {
    while (this.running) {
      const blocks = await this.fetcher.listBlocks(this.lastBlockHeight);
      if (blocks.length) {
        for (const blockHeight of blocks) {
          console.log(blockHeight);
          this.lastBlockHeight = blockHeight + 1;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, config.WAIT_FOR_NEW_BLOCKS));
      }
    }
  }
}
