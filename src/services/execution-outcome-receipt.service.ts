import { Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { InjectRepository } from '../decorators';
import { ExecutionOutcomeReceipt } from '../entities';

@Service()
export class ExecutionOutcomeReceiptService {
  constructor(
    @InjectRepository(ExecutionOutcomeReceipt)
    private readonly repository: Repository<ExecutionOutcomeReceipt>,
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

  async insertIgnore(entities: ExecutionOutcomeReceipt[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<ExecutionOutcomeReceipt>[])
      .orIgnore()
      .execute();
  }
}
