import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Transaction } from './transaction';
import { ActionKind } from './types';

@Entity('transaction_actions')
export class TransactionAction {
  @ManyToOne(() => Transaction)
  @JoinColumn({
    name: 'transaction_hash',
    referencedColumnName: 'transaction_hash',
  })
  transaction: Transaction;

  @PrimaryColumn('text')
  transaction_hash: string;

  @PrimaryColumn('int')
  index_in_transaction: number;

  @Column('enum', { enum: ActionKind })
  @Index()
  action_kind: ActionKind;

  @Column('jsonb')
  args: Record<string, unknown>;
}
