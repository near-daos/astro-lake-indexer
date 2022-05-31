import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { ProcessedBlock } from '../entities';

export class ProcessedBlockService {
  private readonly repository: Repository<ProcessedBlock>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(ProcessedBlock);
  }

  async getLatestBlockHeight() {
    const entity = await this.repository
      .createQueryBuilder()
      .orderBy('block_height', 'DESC')
      .limit(1)
      .getOne();

    return entity?.block_height;
  }

  async store(block: Near.Block) {
    return this.repository.save({ block_height: block.header.height });
  }
}
