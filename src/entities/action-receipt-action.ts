import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Receipt } from './receipt';
import * as transformers from '../transformers';
import { ActionKind } from './types';

// TODO: add jsonb indices
@Entity('action_receipt_actions')
@Index(['receipt_receiver_account_id', 'receipt_included_in_block_timestamp'])
export class ActionReceiptAction {
  @PrimaryColumn('text')
  receipt_id: string;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'receipt_id',
    referencedColumnName: 'receipt_id',
  })
  receipt: Receipt;

  @PrimaryColumn('int')
  index_in_action_receipt: number;

  @Column('enum', { enum: ActionKind })
  @Index()
  action_kind: ActionKind;

  @Column('jsonb')
  args: Record<string, unknown>;

  @Column('text')
  @Index()
  receipt_predecessor_account_id: string;

  @Column('text')
  @Index()
  receipt_receiver_account_id: string;

  @Column('numeric', { precision: 20, transformer: transformers.bigInt })
  @Index()
  receipt_included_in_block_timestamp: bigint;
}
