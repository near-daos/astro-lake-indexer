import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Block } from '../entities';
import * as services from '../services';

class BlockService {
  constructor(
    private readonly repository: Repository<Block> = AppDataSource.getRepository(
      Block,
    ),
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

  async store(block: Near.Block, shards: Near.Shard[]) {
    if (!this.shouldStore(shards)) {
      return;
    }
    const entity = this.fromJSON(block);
    return this.repository.save(entity);
  }

  async getLatestBlockHeight() {
    const entity = await this.repository
      .createQueryBuilder()
      .orderBy('block_height', 'DESC')
      .limit(1)
      .getOne();

    return entity?.block_height;
  }

  shouldStore(shards: Near.Shard[]) {
    return shards.some(services.chunkService.shouldStore);
  }
}

export const blockService = new BlockService();
