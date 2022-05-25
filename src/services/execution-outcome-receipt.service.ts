import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { ExecutionOutcomeReceipt } from '../entities';

export class ExecutionOutcomeReceiptService {
  private readonly repository: Repository<ExecutionOutcomeReceipt>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(ExecutionOutcomeReceipt);
  }

  fromJSON(
    executedReceiptId: string,
    indexInExecutionOutcome: number,
    producedReceiptId: string,
  ) {
    return this.repository.create({
      executed_receipt_id: executedReceiptId,
      index_in_execution_outcome: indexInExecutionOutcome,
      produced_receipt_id: producedReceiptId,
    });
  }
}
