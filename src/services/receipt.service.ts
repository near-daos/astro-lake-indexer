import { Inject, Service } from 'typedi';
import { DeepPartial, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ActionReceiptService } from './action-receipt.service';
import { DataReceiptService } from './data-receipt.service';
import { Config } from '../config';
import { InjectRepository } from '../decorators';
import { ActionReceipt, DataReceipt, Receipt, ReceiptKind } from '../entities';
import { jsonMatchAccounts, matchAccounts } from '../utils';
import * as Near from '../near';

@Service()
export class ReceiptService {
  constructor(
    @Inject()
    private readonly config: Config,
    @InjectRepository(Receipt)
    private readonly repository: Repository<Receipt>,
    @Inject()
    private readonly actionReceiptService: ActionReceiptService,
    @Inject()
    private readonly dataReceiptService: DataReceiptService,
  ) {}

  fromJSON(
    blockHash: string,
    blockTimestamp: bigint,
    chunkHash: string,
    indexInChunk: number,
    transactionHash: string,
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

  async insertIgnore(entities: Receipt[]) {
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
      this.actionReceiptService.insertIgnore(actions),
      this.dataReceiptService.insertIgnore(datas),
    ]);
  }

  shouldStore(receipt: Near.Receipt) {
    // store if predecessor or receiver is tracked account
    if (
      matchAccounts(receipt.predecessor_id, this.config.TRACK_ACCOUNTS) ||
      matchAccounts(receipt.receiver_id, this.config.TRACK_ACCOUNTS)
    ) {
      return true;
    }

    const kind = Near.parseKind<Near.ReceiptTypes>(receipt.receipt);

    if (kind !== Near.ReceiptTypes.Action) {
      return false;
    }

    const actionReceipt = receipt.receipt as Near.ActionReceipt;

    // store if some action args contains tracked account
    return actionReceipt.Action.actions.some((action) => {
      const { actionArgs } = Near.parseAction(action);
      return jsonMatchAccounts(actionArgs, this.config.TRACK_ACCOUNTS);
    });
  }
}
