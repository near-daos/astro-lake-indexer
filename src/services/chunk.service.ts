import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Chunk } from '../entities';
import * as Near from '../near';

export class ChunkService {
  private readonly repository: Repository<Chunk>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(Chunk);
  }

  fromJSON(blockHash: string, chunk: Near.Chunk) {
    return this.repository.create({
      included_in_block_hash: blockHash,
      chunk_hash: chunk.header.chunk_hash,
      shard_id: chunk.header.shard_id,
      signature: chunk.header.signature,
      gas_limit: chunk.header.gas_limit,
      gas_used: chunk.header.gas_used,
      author_account_id: chunk.author,
    });
  }

  async insert(entities: Chunk[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities)
      .orIgnore()
      .execute();
  }
}
