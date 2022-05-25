import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { ActionKind, ActionReceiptAction } from '../entities';

export class ActionReceiptActionService {
  private readonly repository: Repository<ActionReceiptAction>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(ActionReceiptAction);
  }

  fromJSON(
    blockTimestamp: number,
    predecessorAccountId: string,
    receiverAccountId: string,
    receiptId: string,
    indexInActionReceipt: number,
    action: Near.Action,
  ) {
    const { actionKind, actionArgs } = Near.parseAction(action);

    return this.repository.create({
      receipt: { receipt_id: receiptId },
      index_in_action_receipt: indexInActionReceipt,
      action_kind: ActionKind[actionKind],
      args: actionArgs,
      receipt_predecessor_account_id: predecessorAccountId,
      receipt_receiver_account_id: receiverAccountId,
      receipt_included_in_block_timestamp: blockTimestamp,
    });
  }
}
