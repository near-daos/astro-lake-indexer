import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Block } from '../entities';
import * as Near from '../near';

export class BlockService {
  private readonly repository: Repository<Block>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(Block);
  }

  fromJSON(block: Near.Block) {
    return this.repository.create({
      block_height: block.header.height,
      block_hash: block.header.hash,
      prev_block_hash: block.header.prev_hash,
      block_timestamp: block.header.timestamp,
      total_supply: BigInt(block.header.total_supply),
      gas_price: BigInt(block.header.gas_price),
      author_account_id: block.author,
    });
  }

  async insert(entities: Block[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities)
      .orIgnore()
      .execute();
  }
}
