import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { ActionReceipt } from '../entities';

class ActionReceiptService {
  constructor(
    private readonly repository: Repository<ActionReceipt> = AppDataSource.getRepository(
      ActionReceipt,
    ),
  ) {}

  fromJSON(receiptId: string, actionReceipt: Near.ActionReceipt) {
    const {
      Action: { gas_price, signer_id, signer_public_key },
    } = actionReceipt;

    return this.repository.create({
      receipt: { receipt_id: receiptId },
      signer_account_id: signer_id,
      signer_public_key: signer_public_key,
      gas_price: BigInt(gas_price),
    });
  }
}

export const actionReceiptService = new ActionReceiptService();
