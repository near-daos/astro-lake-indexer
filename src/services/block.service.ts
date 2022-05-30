import { Repository } from 'typeorm';
import { AccountChangeService } from './account-change.service';
import { ChunkService } from './chunk.service';
import { ExecutionOutcomeService } from './execution-outcome.service';
import { FtEventService } from './ft-event.service';
import { NftEventService } from './nft-event.service';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Block } from '../entities';

export class BlockService {
  private readonly repository: Repository<Block>;
  private readonly chunkService: ChunkService;
  private readonly executionOutcomeService: ExecutionOutcomeService;
  private readonly accountChangeService: AccountChangeService;
  private readonly ftEventService: FtEventService;
  private readonly nftEventService: NftEventService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(Block);
    this.chunkService = new ChunkService(manager);
    this.executionOutcomeService = new ExecutionOutcomeService(manager);
    this.accountChangeService = new AccountChangeService(manager);
    this.ftEventService = new FtEventService(manager);
    this.nftEventService = new NftEventService(manager);
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
    // check if we have chunks to store
    // Chunk -> Block
    if (shards.some((shard) => this.chunkService.shouldStore(shard))) {
      return true;
    }

    return shards.some((shard) => {
      // check if we have execution outcomes to store
      // ExecutionOutcome -> Block
      if (
        shard.receipt_execution_outcomes.some((outcome) =>
          this.executionOutcomeService.shouldStore(outcome),
        )
      ) {
        return true;
      }

      // Check if we have account changes to store
      // AccountChange => Block
      if (
        shard.state_changes.some((stateChange) =>
          this.accountChangeService.shouldStore(stateChange),
        )
      ) {
        return true;
      }

      return false;
    });
  }
}
