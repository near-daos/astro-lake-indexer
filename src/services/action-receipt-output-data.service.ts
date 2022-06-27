import { Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { InjectRepository } from '../decorators';
import { ActionReceiptOutputData } from '../entities';

@Service()
export class ActionReceiptOutputDataService {
  constructor(
    @InjectRepository(ActionReceiptOutputData)
    private readonly repository: Repository<ActionReceiptOutputData>,
  ) {}

  fromJSON(receiptId: string, dataId: string, receiverAccountId: string) {
    return this.repository.create({
      output_from_receipt_id: receiptId,
      output_data_id: dataId,
      receiver_account_id: receiverAccountId,
    });
  }

  async insertIgnore(entities: ActionReceiptOutputData[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<ActionReceiptOutputData>[])
      .orIgnore()
      .execute();
  }
}
