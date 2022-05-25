import { DeepPartial, Repository } from 'typeorm';
import * as Near from '../near';
import { ReceiptTypes } from '../near';
import { AppDataSource } from '../data-source';
import { ActionReceipt, DataReceipt, Receipt, ReceiptKind } from '../entities';
import { matchAccounts } from '../utils';
import * as services from '../services';
import config from '../config';
import { createLogger } from '../logger';

class ReceiptService {
  constructor(
    private readonly logger = createLogger('receipt-service'),
    private readonly repository: Repository<Receipt> = AppDataSource.getRepository(
      Receipt,
    ),
  ) {}

  fromJSON(
    blockHash: string,
    blockTimestamp: number,
    chunkHash: string,
    indexInChunk: number,
    transactionHash: string | undefined,
    receipt: Near.Receipt,
  ) {
    const receiptKind = Near.parseKind<Near.ReceiptTypes>(receipt.receipt);

    let actionReceipt: DeepPartial<ActionReceipt> | undefined;
    let dataReceipt: DeepPartial<DataReceipt> | undefined;

    switch (receiptKind) {
      case ReceiptTypes.Action:
        actionReceipt = services.actionReceiptService.fromJSON(
          blockTimestamp,
          receipt.predecessor_id,
          receipt.receiver_id,
          receipt.receipt_id,
          receipt.receipt as Near.ActionReceipt,
        );
        break;

      case ReceiptTypes.Data:
        dataReceipt = services.dataReceiptService.fromJSON(
          receipt.receipt_id,
          receipt.receipt as Near.DataReceipt,
        );
        break;
    }

    return this.repository.create({
      receipt_id: receipt.receipt_id,
      included_in_block_hash: blockHash,
      included_in_chunk_hash: chunkHash,
      index_in_chunk: indexInChunk,
      included_in_block_timestamp: BigInt(blockTimestamp),
      predecessor_account_id: receipt.predecessor_id,
      receiver_account_id: receipt.receiver_id,
      receipt_kind: ReceiptKind[receiptKind],
      originated_from_transaction_hash: transactionHash,
      action: actionReceipt,
      data: dataReceipt,
    });
  }

  cacheTransactionHashForReceipts(shards: Near.Shard[]) {
    shards
      .filter((shard) => shard.chunk)
      .forEach((shard) => {
        shard.chunk.receipts.forEach((receipt) => {
          const receiptType = Near.parseKind<Near.ReceiptTypes>(
            receipt.receipt,
          );

          if (receiptType !== ReceiptTypes.Action) {
            return;
          }

          const transactionHash = services.receiptsCacheService.get(
            receipt.receipt_id,
          );

          if (!transactionHash) {
            return;
          }

          const actionReceipt = (receipt.receipt as Near.ActionReceipt).Action;

          // store transaction hash for the future data receipts
          actionReceipt.output_data_receivers.forEach(({ data_id }) => {
            services.receiptsCacheService.set(data_id, transactionHash);
          });
        });
      });
  }

  getTransactionHash(receipt: Near.Receipt) {
    const receiptType = Near.parseKind(receipt.receipt);
    let receiptOrDataId;

    // We need to search for parent transaction hash in cache differently
    // depending on the receipt kind
    // In case of action receipt we are looking for receipt_id
    // In case of data receipt we are looking for data_id
    switch (receiptType) {
      case Near.ReceiptTypes.Action:
        receiptOrDataId = receipt.receipt_id;
        break;

      case Near.ReceiptTypes.Data:
        receiptOrDataId = (receipt.receipt as Near.DataReceipt).Data.data_id;
        break;

      default:
        return;
    }

    const transactionHash = services.receiptsCacheService.get(receiptOrDataId);

    if (!transactionHash) {
      // TODO: handle not found transaction hash
      this.logger.warn(
        `Not found parent tx hash for ${receiptType}Receipt Id: ${receiptOrDataId}`,
      );
    }

    return transactionHash;
  }

  store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .map((shard) => shard.chunk)
      .filter((chunk) => chunk)
      .map((chunk, chunkIndex) =>
        chunk.receipts
          .filter(this.shouldStore)
          .map((receipt) =>
            this.fromJSON(
              block.header.hash,
              block.header.timestamp,
              chunk.header.chunk_hash,
              chunkIndex,
              this.getTransactionHash(receipt),
              receipt,
            ),
          ),
      )
      .flat();

    return this.repository.save(entities);
  }

  shouldStore(receipt: Near.Receipt) {
    return (
      matchAccounts(receipt.predecessor_id, config.TRACK_ACCOUNTS) ||
      matchAccounts(receipt.receiver_id, config.TRACK_ACCOUNTS)
    );
  }
}

export const receiptService = new ReceiptService();
