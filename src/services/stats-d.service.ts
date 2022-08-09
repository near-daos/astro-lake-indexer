import { Logger } from 'log4js';
import { Service } from 'typedi';
import StatsD from 'hot-shots';
import { InjectLogger } from '../decorators';

@Service({ global: true })
export class StatsDService {
  constructor(
    @InjectLogger('stats-d-service')
    private readonly logger: Logger,
    public readonly client = new StatsD({
      prefix: `${process.env.DD_SERVICE || 'astro-lake-indexer'}.`,
      errorHandler: (error) => {
        this.logger.error(error);
      },
    }),
  ) {}
}
