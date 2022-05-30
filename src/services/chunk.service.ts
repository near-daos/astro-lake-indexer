import { Repository } from 'typeorm';
import { ReceiptService } from './receipt.service';
import { TransactionService } from './transaction.service';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Chunk } from '../entities';

export class ChunkService {
  private readonly repository: Repository<Chunk>;
  private readonly transactionService: TransactionService;
  private readonly receiptService: ReceiptService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(Chunk);
    this.transactionService = new TransactionService(manager);
    this.receiptService = new ReceiptService(manager);
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

  async store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .filter((shard) => this.shouldStore(shard))
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
        shard.chunk.transactions.some((transaction) =>
          this.transactionService.shouldStore(transaction),
        )
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
      if (
        shard.chunk.receipts.some((receipt) =>
          this.receiptService.shouldStore(receipt),
        )
      ) {
        return true;
      }
    }

    return false;
  }
}
