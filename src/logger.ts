import { Logger, getLogger } from 'log4js';
import config from './config';

const createLogger = (category: string): Logger => {
  const logger = getLogger(category);
  logger.level = config.LOG_LEVEL;
  return logger;
};

export { Logger, createLogger };
