import AWS from 'aws-sdk';
import config from './config';
import { createLogger } from './logger';
import { Logger } from 'log4js';

export default class S3Fetcher {
  private readonly s3: AWS.S3;
  private readonly logger: Logger;

  constructor() {
    this.s3 = new AWS.S3();
    this.logger = createLogger('s3-fetcher');
  }

  async listBlocks(startBlockHeight: number) {
    const startAfter = String(startBlockHeight).padStart(12, '0');

    this.logger.debug(`Fetching blocks since ${startAfter}`)

    const result: AWS.S3.ListObjectsV2Output = await this.s3.listObjectsV2({
      Bucket: config.AWS_BUCKET,
      MaxKeys: 100,
      Delimiter: '/',
      RequestPayer: 'requester',
      StartAfter: startAfter,
    }).promise();

    return (result.CommonPrefixes || [])
      .filter((prefix) => prefix.Prefix)
      .map((prefix) => {
        return parseInt(prefix.Prefix!.split('/')[0]);
      });
  }
}
