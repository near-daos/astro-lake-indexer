import { Service } from 'typedi';
import { Repository } from 'typeorm';
import * as Near from '../near';
import { ProcessedBlock } from '../entities';
import { InjectRepository } from '../decorators';

@Service()
export class ProcessedBlockService {
  constructor(
    @InjectRepository(ProcessedBlock)
    private readonly repository: Repository<ProcessedBlock>,
  ) {}

  async getLatestBlockHeight() {
    const entity = await this.repository
      .createQueryBuilder()
      .orderBy('block_height', 'DESC')
      .limit(1)
      .getOne();

    return entity?.block_height;
  }

  async store(block: Near.Block) {
    return this.repository.insert({
      block_height: block.header.height,
    });
  }
}
