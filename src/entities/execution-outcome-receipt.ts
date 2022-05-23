import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ExecutionOutcome } from './execution-outcome';
import { Receipt } from './receipt';

@Entity('execution_outcome_receipts')
export class ExecutionOutcomeReceipt {
  @PrimaryColumn('text')
  executed_receipt_id: string;

  @PrimaryColumn('int')
  index_in_execution_outcome: number;

  @PrimaryColumn('text')
  @Index()
  produced_receipt_id: string;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'executed_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  executedReceipt: Receipt;

  @ManyToOne(() => ExecutionOutcome)
  @JoinColumn({
    name: 'executed_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  executionOutcome: ExecutionOutcome;
}
