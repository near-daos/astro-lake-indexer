import './tracing';
import 'reflect-metadata';
import * as AWS from 'aws-sdk';
import { Container } from 'typedi';
import { App } from './app';
import { Config } from './config';
import { createLogger } from './logger';
import { AppDataSource } from './data-source';

const config = Container.get(Config);

AWS.config.update({
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
});

const app = Container.get(App);
const logger = createLogger('main');

const stop = (code = 0) => {
  app.stop();
  process.exit(code);
};

process
  .on('SIGTERM', () => {
    logger.info('SIGTERM');
    stop();
  })
  .on('SIGINT', () => {
    logger.info('SIGINT');
    stop();
  })
  .on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err);
    stop(2);
  })
  .on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection', err);
    stop(3);
  });

(async () => {
  await AppDataSource.initialize();

  await app.start();

  logger.info('Started');
})();
