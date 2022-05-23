import { Entity, Index, JoinColumn, PrimaryColumn } from 'typeorm';
import { ExecutionOutcome } from './execution-outcome';

@Entity('execution_outcome_receipts')
export class ExecutionOutcomeReceipt {
  @PrimaryColumn('text')
  executed_receipt_id: string;

  @PrimaryColumn('int')
  index_in_execution_outcome: number;

  @PrimaryColumn('text')
  @Index()
  produced_receipt_id: string;

  /* TODO: @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'executed_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  executedReceipt: Receipt;*/

  @JoinColumn({
    name: 'executed_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  executionOutcome: ExecutionOutcome;
}
