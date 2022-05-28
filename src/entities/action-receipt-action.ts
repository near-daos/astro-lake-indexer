import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Receipt } from './receipt';
import { ActionKind } from './types';
import * as transformers from '../transformers';

@Entity('action_receipt_actions')
@Index(['receipt_receiver_account_id', 'receipt_included_in_block_timestamp'])
@Index('action_receipt_actions_args_function_call_idx', { synchronize: false })
@Index('action_receipt_actions_args_amount_idx', { synchronize: false })
@Index('action_receipt_actions_args_receiver_id_idx', { synchronize: false })
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

  @Column('numeric', { precision: 20, transformer: transformers.bigint })
  @Index()
  receipt_included_in_block_timestamp: bigint;
}
