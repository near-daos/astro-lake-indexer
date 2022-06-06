import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AppDataSource } from '../data-source';
import { ActionReceiptOutputData } from '../entities';

export class ActionReceiptOutputDataService {
  private readonly repository: Repository<ActionReceiptOutputData>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(ActionReceiptOutputData);
  }

  fromJSON(receiptId: string, dataId: string, receiverAccountId: string) {
    return this.repository.create({
      output_from_receipt_id: receiptId,
      output_data_id: dataId,
      receiver_account_id: receiverAccountId,
    });
  }

  async insert(entities: ActionReceiptOutputData[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<ActionReceiptOutputData>[])
      .orIgnore()
      .execute();
  }
}
