import { DeepPartial, Repository } from 'typeorm';
import * as Near from '../near';
import { ReceiptTypes } from '../near';
import { AppDataSource } from '../data-source';
import { DataReceipt, Receipt, ReceiptKind } from '../entities';
import { matchAccounts } from '../utils';
import * as services from '../services';
import config from '../config';

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

    let dataReceipt: DeepPartial<DataReceipt> | undefined;

    switch (receiptKind) {
      case ReceiptTypes.Data:
        dataReceipt = services.dataReceiptService.fromJSON(
          receipt.receipt_id,
          receipt.receipt as Near.DataReceipt,
        );
        break;
    }

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
      data: dataReceipt,
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

  shouldTrack(receipt: Near.Receipt) {
    return (
      matchAccounts(receipt.predecessor_id, config.TRACK_ACCOUNTS) ||
      matchAccounts(receipt.receiver_id, config.TRACK_ACCOUNTS)
    );
  }
}

export const receiptService = new ReceiptService();
