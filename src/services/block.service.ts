import { Service } from 'typedi';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '../decorators';
import { Block } from '../entities';
import * as Near from '../near';

@Service()
export class BlockService {
  constructor(
    @InjectRepository(Block) private readonly repository: Repository<Block>,
  ) {}

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

  async insert(manager: EntityManager, entities: Block[]) {
    return manager
      .createQueryBuilder()
      .insert()
      .into(Block)
      .values(entities)
      .orIgnore()
      .execute();
  }
}
