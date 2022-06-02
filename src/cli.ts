import * as AWS from 'aws-sdk';
import JSONbig from 'json-bigint';
import config from './config';
import S3Fetcher from './s3-fetcher';

const [script, blockNumber] = process.argv.slice(1);

if (!blockNumber) {
  console.log(`Usage: ${script} <block number>`);
  process.exit(1);
}

const JSONParser = JSONbig({ useNativeBigInt: true });

AWS.config.update({
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
});

const fetcher = new S3Fetcher();

(async () => {
  const block = await fetcher.getBlock(Number(blockNumber));

  const shards = await Promise.all(
    block.chunks.map(({ shard_id }) =>
      fetcher.getShard(block.header.height, shard_id),
    ),
  );

  console.log(JSONParser.stringify({ block, shards }, null, '\t'));
})();
