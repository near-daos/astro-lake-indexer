import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
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
    blockTimestamp: bigint,
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

    return {
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
    };
  }

  async insert(entities: ActionReceipt[]) {
    await this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<ActionReceipt>[])
      .orIgnore()
      .execute();

    const actions = entities.map((entity) => entity.actions).flat();
    const inputDatas = entities.map((entity) => entity.inputData).flat();
    const outputDatas = entities.map((entity) => entity.outputData).flat();

    await Promise.all([
      this.actionReceiptActionService.insert(actions),
      this.actionReceiptInputDataService.insert(inputDatas),
      this.actionReceiptOutputDataService.insert(outputDatas),
    ]);
  }
}
