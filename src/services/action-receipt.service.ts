import { Inject, Service } from 'typedi';
import { EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ActionReceiptActionService } from './action-receipt-action.service';
import { ActionReceiptInputDataService } from './action-receipt-input-data.service';
import { ActionReceiptOutputDataService } from './action-receipt-output-data.service';
import { InjectRepository } from '../decorators';
import { ActionReceipt } from '../entities';
import * as Near from '../near';

@Service()
export class ActionReceiptService {
  constructor(
    @InjectRepository(ActionReceipt)
    private readonly repository: Repository<ActionReceipt>,
    @Inject()
    private readonly actionReceiptActionService: ActionReceiptActionService,
    @Inject()
    private readonly actionReceiptInputDataService: ActionReceiptInputDataService,
    @Inject()
    private readonly actionReceiptOutputDataService: ActionReceiptOutputDataService,
  ) {}

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

  async insert(manager: EntityManager, entities: ActionReceipt[]) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(ActionReceipt)
      .values(entities as QueryDeepPartialEntity<ActionReceipt>[])
      .orIgnore()
      .execute();

    const actions = entities.flatMap((entity) => entity.actions);
    const inputDatas = entities.flatMap((entity) => entity.inputData);
    const outputDatas = entities.flatMap((entity) => entity.outputData);

    await Promise.all([
      this.actionReceiptActionService.insert(manager, actions),
      this.actionReceiptInputDataService.insert(manager, inputDatas),
      this.actionReceiptOutputDataService.insert(manager, outputDatas),
    ]);
  }
}
