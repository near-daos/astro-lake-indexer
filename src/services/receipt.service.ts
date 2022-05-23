import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Receipt, ReceiptKind } from '../entities';

class ReceiptService {
  constructor(
    private readonly repository: Repository<Receipt> = AppDataSource.getRepository(
      Receipt,
    ),
  ) {}

  fromJSON(
    blockHash: string,
    blockTimestamp: number,
    chunkHash: string,
    indexInChunk: number,
    receipt: Near.Receipt,
  ) {
    const receiptKind = Near.parseKind<Near.ReceiptTypes>(receipt.receipt);

    // TODO: populate originated_from_transaction_hash
    return this.repository.create({
      receipt_id: receipt.receipt_id,
      block: { block_hash: blockHash },
      chunk: { chunk_hash: chunkHash },
      index_in_chunk: indexInChunk,
      included_in_block_timestamp: BigInt(blockTimestamp),
      predecessor_account_id: receipt.predecessor_id,
      receiver_account_id: receipt.receiver_id,
      receipt_kind: ReceiptKind[receiptKind],
    });
  }

  store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .map((shard) => shard.chunk)
      .filter((chunk) => chunk)
      .map((chunk, chunkIndex) =>
        chunk.receipts.map((receipt) =>
          this.fromJSON(
            block.header.hash,
            block.header.timestamp,
            chunk.header.chunk_hash,
            chunkIndex,
            receipt,
          ),
        ),
      )
      .flat();

    return this.repository.save(entities);
  }
}

export const receiptService = new ReceiptService();
