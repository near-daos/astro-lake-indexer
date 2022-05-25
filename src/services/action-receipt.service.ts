import { Repository } from 'typeorm';
import { ActionReceiptActionService } from './action-receipt-action.service';
import { ActionReceiptInputDataService } from './action-receipt-input-data.service';
import { ActionReceiptOutputDataService } from './action-receipt-output-data.service';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { ActionReceipt } from '../entities';

export class ActionReceiptService {
  private readonly repository: Repository<ActionReceipt>;
  private readonly actionReceiptActionService: ActionReceiptActionService;
  private readonly actionReceiptInputDataService: ActionReceiptInputDataService;
  private readonly actionReceiptOutputDataService: ActionReceiptOutputDataService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(ActionReceipt);
    this.actionReceiptActionService = new ActionReceiptActionService(manager);
    this.actionReceiptInputDataService = new ActionReceiptInputDataService(
      manager,
    );
    this.actionReceiptOutputDataService = new ActionReceiptOutputDataService(
      manager,
    );
  }

  fromJSON(
    blockTimestamp: number,
    predecessorAccountId: string,
    receiverAccountId: string,
    receiptId: string,
    actionReceipt: Near.ActionReceipt,
  ) {
    const {
      Action: {
        actions,
        gas_price,
        signer_id,
        signer_public_key,
        input_data_ids,
        output_data_receivers,
      },
    } = actionReceipt;

    return this.repository.create({
      receipt_id: receiptId,
      signer_account_id: signer_id,
      signer_public_key: signer_public_key,
      gas_price: BigInt(gas_price),
      actions: actions.map((action, index) =>
        this.actionReceiptActionService.fromJSON(
          blockTimestamp,
          predecessorAccountId,
          receiverAccountId,
          receiptId,
          index,
          action,
        ),
      ),
      inputData: input_data_ids.map((dataId) =>
        this.actionReceiptInputDataService.fromJSON(receiptId, dataId),
      ),
      outputData: output_data_receivers.map(({ data_id, receiver_id }) =>
        this.actionReceiptOutputDataService.fromJSON(
          receiptId,
          data_id,
          receiver_id,
        ),
      ),
    });
  }
}
