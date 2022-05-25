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
    this.log(blockHeight, block, shards);

    services.transactionService.cacheTransactionHashesForReceipts(shards);
    services.receiptService.cacheTransactionHashForReceipts(shards);
    services.executionOutcomeService.cacheTransactionHashesForReceipts(shards);

    this.logger.info(`Processing block ${blockHeight}...`);

    await AppDataSource.transaction(async () => {
      await services.blockService.store(block, shards);

      await services.chunkService.store(block, shards);

      await services.transactionService.store(block, shards);

      await services.receiptService.store(block, shards);

      await services.executionOutcomeService.store(block, shards);

      await services.accountService.handle(block, shards);

      await services.accessKeyService.handle(block, shards);

      await services.accountChangeService.store(block, shards);
    });
  }

  private log(blockHeight: number, block: Near.Block, shards: Near.Shard[]) {
    this.logger.trace(`Block ${block.header.hash} (${blockHeight}):`);

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
