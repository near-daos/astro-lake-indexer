import Redis from 'ioredis';
import JSONbig from 'json-bigint';
import { Inject, Service } from 'typedi';
import { Config } from '../config';
import { Receipt } from '../entities';

@Service({ global: true })
export class RedisService {
  private readonly redis: Redis;

  private readonly STREAM_RECEIPTS = 'receipts';

  constructor(
    @Inject()
    private readonly config: Config,
    private readonly json = JSONbig({ useNativeBigInt: true }),
  ) {
    this.redis = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      username: config.REDIS_USERNAME,
      password: config.REDIS_PASSWORD,
      db: config.REDIS_DATABASE,
    });
  }

  streamReceipt(receipt: Receipt) {
    return this.redis.xadd(
      this.STREAM_RECEIPTS,
      '*',
      'receipt',
      this.json.stringify(receipt),
    );
  }
}
