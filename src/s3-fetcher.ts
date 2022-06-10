import { Inject, Service } from 'typedi';
import * as AWS from 'aws-sdk';
import { Logger } from 'log4js';
import JSONbig from 'json-bigint';
import { Config } from './config';
import { InjectLogger } from './decorators';
import { formatBlockHeight } from './utils';
import * as Near from './near';

@Service()
export class S3Fetcher {
  constructor(
    @Inject()
    private readonly config: Config,
    @InjectLogger('s3-fetcher')
    private readonly logger: Logger,
    private readonly s3 = new AWS.S3(),
    private readonly jsonParser = JSONbig({ useNativeBigInt: true }),
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

    const result = await this.s3
      .getObject({
        Bucket: this.config.AWS_BUCKET,
        Key: key,
        RequestPayer: 'requester',
      })
      .promise();

    return this.jsonParser.parse(result?.Body?.toString() || '') as Near.Block;
  }

  async getShard(blockHeight: number, shardId: number) {
    const key = `${formatBlockHeight(blockHeight)}/shard_${shardId}.json`;

    this.logger.debug(`Fetching shard ${key}`);

    const result = await this.s3
      .getObject({
        Bucket: this.config.AWS_BUCKET,
        Key: key,
        RequestPayer: 'requester',
      })
      .promise();

    return this.jsonParser.parse(result?.Body?.toString() || '') as Near.Shard;
  }
}
