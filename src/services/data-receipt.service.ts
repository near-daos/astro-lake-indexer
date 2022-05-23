import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { DataReceipt } from '../entities';

class DataReceiptService {
  constructor(
    private readonly repository: Repository<DataReceipt> = AppDataSource.getRepository(
      DataReceipt,
    ),
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
}

export const dataReceiptService = new DataReceiptService();
