import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Chunk } from '../entities';
import * as services from '../services';

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
      .filter(this.shouldStore)
      .map((shard) => shard.chunk)
      .filter((chunk) => chunk)
      .map((chunk) => this.fromJSON(block.header.hash, chunk));

    return this.repository.save(entities);
  }

  shouldStore(shard: Near.Shard) {
    if (shard.chunk) {
      // check if we have transactions to store:
      // Transaction -> Block
      // Transaction -> Chunk
      // TransactionAction -> Transaction
      if (
        shard.chunk.transactions.some(services.transactionService.shouldStore)
      ) {
        return true;
      }

      // check if we have receipts to store
      // Receipt -> Block
      // Receipt -> Chunk
      // DataReceipt -> Receipt
      // ActionReceipt -> Receipt
      // ActionReceiptActions -> ActionReceipt
      // ActionReceiptInputData -> ActionReceipt
      // ActionReceiptOutputData -> ActionReceipt
      if (shard.chunk.receipts.some(services.receiptService.shouldStore)) {
        return true;
      }
    }

    // check if we have execution outcomes to store
    // ExecutionOutcome -> Block
    if (
      shard.receipt_execution_outcomes.some(
        services.executionOutcomeService.shouldStore,
      )
    ) {
      return true;
    }

    // Check if we have account changes to store
    // AccountChange => Block
    if (shard.state_changes.some(services.accountChangeService.shouldStore)) {
      return true;
    }

    return false;
  }
}

export const chunkService = new ChunkService();
