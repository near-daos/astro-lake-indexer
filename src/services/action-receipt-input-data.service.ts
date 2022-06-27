import { Service } from 'typedi';
import { Repository } from 'typeorm';
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

  async insertIgnore(entities: ActionReceiptInputData[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<ActionReceiptInputData>[])
      .orIgnore()
      .execute();
  }
}
