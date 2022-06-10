import { Service } from 'typedi';
import { EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { InjectRepository } from '../decorators';
import { ActionReceiptInputData } from '../entities';

@Service()
export class ActionReceiptInputDataService {
  constructor(
    @InjectRepository(ActionReceiptInputData)
    private readonly repository: Repository<ActionReceiptInputData>,
  ) {}

  fromJSON(receiptId: string, dataId: string) {
    return this.repository.create({
      input_to_receipt_id: receiptId,
      input_data_id: dataId,
    });
  }

  async insert(manager: EntityManager, entities: ActionReceiptInputData[]) {
    return manager
      .createQueryBuilder()
      .insert()
      .into(ActionReceiptInputData)
      .values(entities as QueryDeepPartialEntity<ActionReceiptInputData>[])
      .orIgnore()
      .execute();
  }
}
