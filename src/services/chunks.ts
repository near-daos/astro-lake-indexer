import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Chunk } from '../entities';

export class ChunksService {
  static async storeChunks(blockHash: string, chunks: Near.Chunk[]) {
    const repository = AppDataSource.getRepository(Chunk);
    const entities = chunks.map((chunk) =>
      repository.create({
        included_in_block_hash: blockHash,
        chunk_hash: chunk.header.chunk_hash,
        shard_id: chunk.header.shard_id,
        signature: chunk.header.signature,
        gas_limit: chunk.header.gas_limit,
        gas_used: chunk.header.gas_used,
        author_account_id: chunk.author,
      }),
    );
    return repository.save(entities);
  }
}
