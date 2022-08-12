import 'dotenv/config';
import { Provider } from 'nconf';
import { Service } from 'typedi';

@Service({ global: true })
export class Config {
  private provider: Provider;

  constructor() {
    this.provider = new Provider();
    this.provider.env();
    this.provider.defaults({
      LOG_LEVEL: 'info',
      REDIS_PORT: 6379,
      REDIS_DATABASE: 0,
      FETCH_MAX_KEYS: 100,
      LOOK_BACK_BLOCKS: 20,
      TX_CACHE_SIZE: 1000,
      TX_HASHES_CACHE_SIZE: 5000,
      BLOCKS_DL_CONCURRENCY: 10,
      WAIT_FOR_NEW_BLOCKS: 2000,
    });
    this.provider.required([
      'LOG_LEVEL',

      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'AWS_BUCKET',

      'DATABASE_TYPE',
      'DATABASE_HOST',
      'DATABASE_PORT',
      'DATABASE_USERNAME',
      'DATABASE_PASSWORD',
      'DATABASE_NAME',

      'REDIS_HOST',

      'START_BLOCK_HEIGHT',
      'LOOK_BACK_BLOCKS',
      'TX_CACHE_SIZE',
      'TX_HASHES_CACHE_SIZE',

      'FETCH_MAX_KEYS',
      'BLOCKS_DL_CONCURRENCY',
      'WAIT_FOR_NEW_BLOCKS',

      'TRACK_ACCOUNTS',
    ]);
  }

  get LOG_LEVEL(): string {
    return this.provider.get('LOG_LEVEL');
  }

  get AWS_ACCESS_KEY_ID(): string {
    return this.provider.get('AWS_ACCESS_KEY_ID');
  }

  get AWS_SECRET_ACCESS_KEY(): string {
    return this.provider.get('AWS_SECRET_ACCESS_KEY');
  }

  get AWS_REGION(): string {
    return this.provider.get('AWS_REGION');
  }

  get AWS_BUCKET(): string {
    return this.provider.get('AWS_BUCKET');
  }

  get DATABASE_TYPE(): 'postgres' {
    return this.provider.get('DATABASE_TYPE');
  }

  get DATABASE_HOST(): string {
    return this.provider.get('DATABASE_HOST');
  }

  get DATABASE_PORT(): number {
    return parseInt(this.provider.get('DATABASE_PORT'));
  }

  get DATABASE_USERNAME(): string {
    return this.provider.get('DATABASE_USERNAME');
  }

  get DATABASE_PASSWORD(): string {
    return this.provider.get('DATABASE_PASSWORD');
  }

  get DATABASE_NAME(): string {
    return this.provider.get('DATABASE_NAME');
  }

  get REDIS_HOST(): string {
    return this.provider.get('REDIS_HOST');
  }

  get REDIS_PORT(): number {
    return parseInt(this.provider.get('REDIS_PORT'));
  }

  get REDIS_USERNAME(): string {
    return this.provider.get('REDIS_USERNAME');
  }

  get REDIS_PASSWORD(): string {
    return this.provider.get('REDIS_PASSWORD');
  }

  get REDIS_DATABASE(): number {
    return parseInt(this.provider.get('REDIS_DATABASE'));
  }

  get START_BLOCK_HEIGHT(): number {
    return parseInt(this.provider.get('START_BLOCK_HEIGHT'));
  }

  get LOOK_BACK_BLOCKS(): number {
    return parseInt(this.provider.get('LOOK_BACK_BLOCKS'));
  }

  get TX_CACHE_SIZE(): number {
    return parseInt(this.provider.get('TX_CACHE_SIZE'));
  }

  get TX_HASHES_CACHE_SIZE(): number {
    return parseInt(this.provider.get('TX_HASHES_CACHE_SIZE'));
  }

  get FETCH_MAX_KEYS(): number {
    return parseInt(this.provider.get('FETCH_MAX_KEYS'));
  }

  get BLOCKS_DL_CONCURRENCY(): number {
    return parseInt(this.provider.get('BLOCKS_DL_CONCURRENCY'));
  }

  get WAIT_FOR_NEW_BLOCKS(): number {
    return parseInt(this.provider.get('WAIT_FOR_NEW_BLOCKS'));
  }

  get TRACK_ACCOUNTS(): string[] {
    return (this.provider.get('TRACK_ACCOUNTS') as string)
      .split(',')
      .map((account) => account.trim());
  }
}
