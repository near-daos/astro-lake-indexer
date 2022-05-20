import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Chunk } from '../entities';

class ChunkService {
  constructor(
    private readonly repository: Repository<Chunk> = AppDataSource.getRepository(
      Chunk,
    ),
  ) {}

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

  store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .map((shard) => shard.chunk)
      .filter((chunk) => chunk)
      .map((chunk) => this.fromJSON(block.header.hash, chunk));

    return this.repository.save(entities);
  }
}

export const chunkService = new ChunkService();
