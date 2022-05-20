import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import config from './config';
import { Block, Chunk, Transaction } from './entities';

export const AppDataSource = new DataSource({
  type: config.DATABASE_TYPE,
  host: config.DATABASE_HOST,
  port: config.DATABASE_PORT,
  username: config.DATABASE_USERNAME,
  password: config.DATABASE_PASSWORD,
  database: config.DATABASE_NAME,
  synchronize: true,
  logging: false,
  entities: [Block, Chunk, Transaction],
  migrations: [],
  subscribers: [],
  namingStrategy: new SnakeNamingStrategy(),
});
