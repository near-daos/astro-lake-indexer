import AWS from 'aws-sdk';
import App from './app';
import config from './config';
import { createLogger } from './logger';

AWS.config.update({
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
});

const app = new App();
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

app.start();
logger.info('Started');
