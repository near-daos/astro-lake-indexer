import 'reflect-metadata';
import * as AWS from 'aws-sdk';
import JSONbig from 'json-bigint';
import { Config } from './config';
import { S3Fetcher } from './s3-fetcher';
import { Container } from 'typedi';

const [script, blockNumber] = process.argv.slice(1);

if (!blockNumber) {
  console.log(`Usage: ${script} <block number>`);
  process.exit(1);
}

const config = Container.get(Config);
const fetcher = Container.get(S3Fetcher);
const json = JSONbig({ useNativeBigInt: true });

AWS.config.update({
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
});

(async () => {
  const block = await fetcher.getBlock(Number(blockNumber));

  const shards = await Promise.all(
    block.chunks.map(({ shard_id }) =>
      fetcher.getShard(block.header.height, shard_id),
    ),
  );

  console.log(json.stringify({ block, shards }, null, '\t'));
})();
