import path from 'path';
import { Container } from 'typedi';
import { DataSource } from 'typeorm';
import { Config } from './config';
import { CustomNamingStrategy } from './naming-strategy';
import {
  AccessKey,
  Account,
  AccountChange,
  ActionReceipt,
  ActionReceiptAction,
  ActionReceiptInputData,
  ActionReceiptOutputData,
  Block,
  Chunk,
  DataReceipt,
  Event,
  ExecutionOutcome,
  ExecutionOutcomeReceipt,
  FtEvent,
  NftEvent,
  ProcessedBlock,
  Receipt,
  Transaction,
  TransactionAction,
} from './entities';

const config = Container.get(Config);

export const AppDataSource = new DataSource({
  type: config.DATABASE_TYPE,
  host: config.DATABASE_HOST,
  port: config.DATABASE_PORT,
  username: config.DATABASE_USERNAME,
  password: config.DATABASE_PASSWORD,
  database: config.DATABASE_NAME,
  synchronize: false,
  logging: false,
  entities: [
    AccessKey,
    Account,
    AccountChange,
    ActionReceipt,
    ActionReceiptAction,
    ActionReceiptInputData,
    ActionReceiptOutputData,
    Block,
    Chunk,
    DataReceipt,
    Event,
    ExecutionOutcome,
    ExecutionOutcomeReceipt,
    FtEvent,
    NftEvent,
    ProcessedBlock,
    Receipt,
    Transaction,
    TransactionAction,
  ],
  migrations: [path.resolve(__dirname, 'migrations/**/*')],
  subscribers: [],
  namingStrategy: new CustomNamingStrategy(),
});
