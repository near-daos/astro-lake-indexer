import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Block } from '../entities';
import { ChunkService } from './chunk.service';

export class BlockService {
  private readonly repository: Repository<Block>;
  private readonly chunkService: ChunkService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(Block);
    this.chunkService = new ChunkService(manager);
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
    return shards.some((shard) => this.chunkService.shouldStore(shard));
  }
}
