import { DeepPartial, Repository } from 'typeorm';
import { ActionReceiptService } from './action-receipt.service';
import { DataReceiptService } from './data-receipt.service';
import { FtEventService } from './ft-event.service';
import { NftEventService } from './nft-event.service';
import { receiptsCacheService } from './receipts-cache.service';
import { TransactionService } from './transaction.service';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { ActionReceipt, DataReceipt, Receipt, ReceiptKind } from '../entities';
import { createLogger } from '../logger';

export class ReceiptService {
  private readonly repository: Repository<Receipt>;
  private readonly actionReceiptService: ActionReceiptService;
  private readonly dataReceiptService: DataReceiptService;
  private readonly transactionService: TransactionService;
  private readonly ftEventService: FtEventService;
  private readonly nftEventService: NftEventService;

  constructor(
    private readonly manager = AppDataSource.manager,
    private readonly logger = createLogger('receipt-service'),
  ) {
    this.repository = manager.getRepository(Receipt);
    this.actionReceiptService = new ActionReceiptService(manager);
    this.dataReceiptService = new DataReceiptService(manager);
    this.transactionService = new TransactionService(manager);
    this.ftEventService = new FtEventService(manager);
    this.nftEventService = new NftEventService(manager);
  }

  fromJSON(
    blockHash: string,
    blockTimestamp: bigint,
    chunkHash: string,
    indexInChunk: number,
    transactionHash: string | undefined,
    receipt: Near.Receipt,
  ) {
    const receiptKind = Near.parseKind<Near.ReceiptTypes>(receipt.receipt);

    let actionReceipt: DeepPartial<ActionReceipt> | undefined;
    let dataReceipt: DeepPartial<DataReceipt> | undefined;

    switch (receiptKind) {
      case Near.ReceiptTypes.Action:
        actionReceipt = this.actionReceiptService.fromJSON(
          blockTimestamp,
          receipt.predecessor_id,
          receipt.receiver_id,
          receipt.receipt_id,
          receipt.receipt as Near.ActionReceipt,
        );
        break;

      case Near.ReceiptTypes.Data:
        dataReceipt = this.dataReceiptService.fromJSON(
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
      included_in_block_timestamp: blockTimestamp,
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

          if (receiptType !== Near.ReceiptTypes.Action) {
            return;
          }

          const transactionHash = receiptsCacheService.get(receipt.receipt_id);

          if (!transactionHash) {
            return;
          }

          const actionReceipt = (receipt.receipt as Near.ActionReceipt).Action;

          // store transaction hash for the future data receipts
          actionReceipt.output_data_receivers.forEach(({ data_id }) => {
            receiptsCacheService.set(data_id, transactionHash);
          });
        });
      });
  }

  async getTransactionHash(receipt: Near.Receipt) {
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

    let transactionHash = receiptsCacheService.get(receiptOrDataId);

    if (!transactionHash) {
      transactionHash =
        await this.transactionService.findTransactionHashByReceiptId(
          receiptOrDataId,
        );
    }

    if (!transactionHash) {
      // TODO: handle not found transaction hash
      this.logger.warn(
        `Not found parent tx hash for ${receiptType}Receipt Id: ${receiptOrDataId}`,
      );
    }

    return transactionHash;
  }

  async save(entity: Receipt[]) {
    return this.repository.save(entity);
  }

  shouldStore(receipt: Near.Receipt) {
    return false;
    return (
      receipt.receipt_id === 'DctUW1xPH2UXxUMtWmiyqmJrvKX4pkccsJmMCc2mCE3o'
    );

    /*    return (
      matchAccounts(receipt.predecessor_id, config.TRACK_ACCOUNTS) ||
      matchAccounts(receipt.receiver_id, config.TRACK_ACCOUNTS) ||
      // contains ft call
      this.ftEventService.shouldStoreReceipt(receipt) ||
      // contains nft call
      this.nftEventService.shouldStoreReceipt(receipt)
    ); */
  }
}
