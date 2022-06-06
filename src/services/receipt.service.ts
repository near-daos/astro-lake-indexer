import { DeepPartial, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ActionReceiptService } from './action-receipt.service';
import { DataReceiptService } from './data-receipt.service';
import { FtEventService } from './ft-event.service';
import { NftEventService } from './nft-event.service';
import { TransactionService } from './transaction.service';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import {
  ActionReceipt,
  DataReceipt,
  Receipt,
  ReceiptKind,
} from '../entities';

export class ReceiptService {
  private readonly repository: Repository<Receipt>;
  private readonly actionReceiptService: ActionReceiptService;
  private readonly dataReceiptService: DataReceiptService;
  private readonly transactionService: TransactionService;
  private readonly ftEventService: FtEventService;
  private readonly nftEventService: NftEventService;

  constructor(private readonly manager = AppDataSource.manager) {
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

  async insert(entities: Receipt[]) {
    await this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<Receipt>[])
      .orIgnore()
      .execute();

    const actions = entities
      .map((entity) => entity.action)
      .filter((action) => action) as ActionReceipt[];

    const datas = entities
      .map((entity) => entity.data)
      .filter((data) => data) as DataReceipt[];

    await Promise.all([
      this.actionReceiptService.insert(actions),
      this.dataReceiptService.insert(datas),
    ]);
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
