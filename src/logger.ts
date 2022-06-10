import { Container } from 'typedi';
import { Logger, getLogger } from 'log4js';
import { Config } from './config';

export const createLogger = (category: string): Logger => {
  const config = Container.get(Config);
  const logger = getLogger(category);
  logger.level = config.LOG_LEVEL;
  return logger;
};
