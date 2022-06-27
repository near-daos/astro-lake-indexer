import { Service } from 'typedi';
import { Repository } from 'typeorm';
import * as Near from '../near';
import { LastBlock } from '../entities';
import { InjectRepository } from '../decorators';

@Service()
export class LastBlockService {
  constructor(
    @InjectRepository(LastBlock)
    private readonly repository: Repository<LastBlock>,
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
    const result = await this.repository.update(
      {},
      {
        block_height: block.header.height,
      },
    );
    if (!result.affected) {
      return this.repository.insert({ block_height: block.header.height });
    }
    return result;
  }
}
