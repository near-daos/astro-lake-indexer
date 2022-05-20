import * as AWS from 'aws-sdk';
import config from './config';
import { createLogger } from './logger';
import { formatBlockHeight, sleep } from './utils';
import * as Near from './near';

export default class S3Fetcher {
  constructor(
    private readonly s3 = new AWS.S3(),
    private readonly logger = createLogger('s3-fetcher'),
  ) {}

  async listBlocks(startBlockHeight: number) {
    const startAfter = formatBlockHeight(startBlockHeight);

    this.logger.debug(`Fetching blocks since ${startAfter}`);

    const result: AWS.S3.ListObjectsV2Output = await this.s3
      .listObjectsV2({
        Bucket: config.AWS_BUCKET,
        MaxKeys: 20,
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

    let result: AWS.S3.GetObjectOutput | undefined;

    try {
      result = await this.s3
        .getObject({
          Bucket: config.AWS_BUCKET,
          Key: key,
          RequestPayer: 'requester',
        })
        .promise();
    } catch (err) {
      this.logger.debug(`Failed to get ${key}, retrying immediately...`);
    }

    return JSON.parse(result?.Body?.toString() || '') as Near.Block;
  }

  async getShard(blockHeight: number, shardId: number) {
    const key = `${formatBlockHeight(blockHeight)}/shard_${shardId}.json`;

    this.logger.debug(`Fetching shard ${key}`);

    let result: AWS.S3.GetObjectOutput | undefined;

    try {
      result = await this.s3
        .getObject({
          Bucket: config.AWS_BUCKET,
          Key: key,
          RequestPayer: 'requester',
        })
        .promise();
    } catch (err) {
      this.logger.debug(`Failed to get ${key}, retrying in 1s...`);
      await sleep(1000);
    }

    return JSON.parse(result?.Body?.toString() || '') as Near.Shard;
  }
}
