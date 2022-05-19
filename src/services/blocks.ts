import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Block } from '../entities';

export class BlocksService {
  static async storeBlock(block: Near.Block) {
    const repository = AppDataSource.getRepository(Block);
    const entity = repository.create({
      block_height: block.header.height,
      block_hash: block.header.hash,
      prev_block_hash: block.header.prev_hash,
      block_timestamp: block.header.timestamp,
      total_supply: block.header.total_supply,
      gas_price: block.header.gas_price,
      author_account_id: block.author,
    });
    return repository.save(entity);
  }

  static async getLatestBlockHeight() {
    const entity = await AppDataSource.getRepository(Block)
      .createQueryBuilder()
      .select('block_height')
      .orderBy('block_height', 'DESC')
      .limit(1)
      .getOne();

    return entity?.block_height;
  }
}
