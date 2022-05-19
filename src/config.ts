import 'dotenv/config';
import { Provider } from 'nconf';

export class Config {
  private provider: Provider;

  constructor() {
    this.provider = new Provider();
    this.provider.env();
    this.provider.defaults({
      LOG_LEVEL: 'info',
      START_BLOCK_HEIGHT: 1,
    });
    this.provider.required([
      'LOG_LEVEL',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'AWS_BUCKET',
      'START_BLOCK_HEIGHT',
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

  get START_BLOCK_HEIGHT(): number {
    return parseInt(this.provider.get('START_BLOCK_HEIGHT'));
  }
}

export default new Config();
