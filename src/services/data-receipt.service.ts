import { Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { InjectRepository } from '../decorators';
import { DataReceipt } from '../entities';
import * as Near from '../near';

@Service()
export class DataReceiptService {
  constructor(
    @InjectRepository(DataReceipt)
    private readonly repository: Repository<DataReceipt>,
  ) {}

  fromJSON(receiptId: string, dataReceipt: Near.DataReceipt) {
    const {
      Data: { data_id, data },
    } = dataReceipt;

    return this.repository.create({
      receipt_id: receiptId,
      data_id: data_id,
      data: data !== null ? Buffer.from(data, 'base64') : null,
    });
  }

  async insertIgnore(entities: DataReceipt[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<DataReceipt>[])
      .orIgnore()
      .execute();
  }
}
