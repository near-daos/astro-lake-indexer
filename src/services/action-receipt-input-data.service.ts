import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { ActionReceiptInputData } from '../entities';

class ActionReceiptInputDataService {
  constructor(
    private readonly repository: Repository<ActionReceiptInputData> = AppDataSource.getRepository(
      ActionReceiptInputData,
    ),
  ) {}

  fromJSON(receiptId: string, dataId: string) {
    return this.repository.create({
      input_to_receipt_id: receiptId,
      input_data_id: dataId,
    });
  }
}

export const actionReceiptInputDataService =
  new ActionReceiptInputDataService();
