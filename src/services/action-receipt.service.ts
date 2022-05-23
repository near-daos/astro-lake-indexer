import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { ActionReceipt } from '../entities';
import * as services from '../services';

class ActionReceiptService {
  constructor(
    private readonly repository: Repository<ActionReceipt> = AppDataSource.getRepository(
      ActionReceipt,
    ),
  ) {}

  fromJSON(
    blockTimestamp: number,
    predecessorAccountId: string,
    receiverAccountId: string,
    receiptId: string,
    actionReceipt: Near.ActionReceipt,
  ) {
    const {
      Action: { actions, gas_price, signer_id, signer_public_key },
    } = actionReceipt;

    return this.repository.create({
      receipt: { receipt_id: receiptId },
      signer_account_id: signer_id,
      signer_public_key: signer_public_key,
      gas_price: BigInt(gas_price),
      actions: actions.map((action, index) =>
        services.actionReceiptActionService.fromJSON(
          blockTimestamp,
          predecessorAccountId,
          receiverAccountId,
          receiptId,
          index,
          action,
        ),
      ),
    });
  }
}

export const actionReceiptService = new ActionReceiptService();
