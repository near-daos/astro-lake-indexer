import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AppDataSource } from '../data-source';
import { ActionReceiptInputData } from '../entities';

export class ActionReceiptInputDataService {
  private readonly repository: Repository<ActionReceiptInputData>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(ActionReceiptInputData);
  }

  fromJSON(receiptId: string, dataId: string) {
    return this.repository.create({
      input_to_receipt_id: receiptId,
      input_data_id: dataId,
    });
  }

  async insert(entities: ActionReceiptInputData[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<ActionReceiptInputData>[])
      .orIgnore()
      .execute();
  }
}
