import { Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from '../decorators';
import { Chunk } from '../entities';
import { ChunkData } from '../types';

@Service()
export class ChunkService {
  constructor(
    @InjectRepository(Chunk) private readonly repository: Repository<Chunk>,
  ) {}

  fromJSON(blockHash: string, chunk: ChunkData) {
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

  async insertIgnore(entities: Chunk[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities)
      .orIgnore()
      .execute();
  }
}
