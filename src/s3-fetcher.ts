import * as AWS from 'aws-sdk';
import JSONbig from 'json-bigint';
import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { retry, RetryConfig } from 'ts-retry-promise';
import { Config } from './config';
import { InjectLogger } from './decorators';
import * as Near from './near';
import { formatBlockHeight } from './utils';

@Service()
export class S3Fetcher {
  constructor(
    @Inject()
    private readonly config: Config,
    @InjectLogger('s3-fetcher')
    private readonly logger: Logger,
    private readonly s3 = new AWS.S3(),
    private readonly json = JSONbig({ useNativeBigInt: true }),
    private readonly retryConfig: Partial<RetryConfig<unknown>> = {
      retries: 20,
      delay: 1000,
      timeout: 'INFINITELY',
      logger: (msg) => this.logger.warn(msg),
    },
  ) {}

  async listBlocks(startBlockHeight: number) {
    const startAfter = formatBlockHeight(startBlockHeight);

    this.logger.debug(`Fetching blocks since ${startAfter}`);

    const result = await this.s3
      .listObjectsV2({
        Bucket: this.config.AWS_BUCKET,
        MaxKeys: this.config.FETCH_MAX_KEYS,
        Delimiter: '/',
        RequestPayer: 'requester',
        StartAfter: startAfter,
      })
      .promise();

    return (result.CommonPrefixes || [])
      .filter((prefix) => prefix.Prefix)
      .map((prefix) => {
        return parseInt((prefix.Prefix || '').split('/')[0]);
      });
  }

  async getBlock(blockHeight: number) {
    const key = `${formatBlockHeight(blockHeight)}/block.json`;

    this.logger.debug(`Fetching block ${key}`);

    try {
      const result = await this.s3
        .getObject({
          Bucket: this.config.AWS_BUCKET,
          Key: key,
          RequestPayer: 'requester',
        })
        .promise();

      return this.json.parse(result?.Body?.toString() || '') as Near.Block;
    } catch (err) {
      throw new Error(`Unable to fetch block ${key} (${err})`);
    }
  }

  async getShard(blockHeight: number, shardId: number) {
    const key = `${formatBlockHeight(blockHeight)}/shard_${shardId}.json`;

    this.logger.debug(`Fetching shard ${key}`);

    try {
      const result = await this.s3
        .getObject({
          Bucket: this.config.AWS_BUCKET,
          Key: key,
          RequestPayer: 'requester',
        })
        .promise();

      return this.json.parse(result?.Body?.toString() || '') as Near.Shard;
    } catch (err) {
      throw new Error(`Unable to fetch shard ${key} (${err})`);
    }
  }

  async getFullBlock(blockHeight: number) {
    const block = await this.getBlock(blockHeight);

    const shards = await Promise.all(
      block.chunks.map((chunk) => this.getShard(blockHeight, chunk.shard_id)),
    );

    return { blockHeight, block, shards };
  }

  async listBlocksWithRetry(startBlockHeight: number) {
    return retry(() => this.listBlocks(startBlockHeight), this.retryConfig);
  }

  async getFullBlockWithRetry(blockHeight: number) {
    return retry(() => this.getFullBlock(blockHeight), this.retryConfig);
  }
}
