import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { ActionReceiptOutputData } from '../entities';

class ActionReceiptOutputDataService {
  constructor(
    private readonly repository: Repository<ActionReceiptOutputData> = AppDataSource.getRepository(
      ActionReceiptOutputData,
    ),
  ) {}

  fromJSON(receiptId: string, dataId: string, receiverAccountId: string) {
    return this.repository.create({
      output_from_receipt_id: receiptId,
      output_data_id: dataId,
      receiver_account_id: receiverAccountId,
    });
  }
}

export const actionReceiptOutputDataService =
  new ActionReceiptOutputDataService();
