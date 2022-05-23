import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { ExecutionOutcomeReceipt } from '../entities';

class ExecutionOutcomeReceiptService {
  constructor(
    private readonly repository: Repository<ExecutionOutcomeReceipt> = AppDataSource.getRepository(
      ExecutionOutcomeReceipt,
    ),
  ) {}

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

export const executionOutcomeReceiptService =
  new ExecutionOutcomeReceiptService();
