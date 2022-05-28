import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from './account';
import { Block } from './block';
import { Receipt } from './receipt';
import { Transaction } from './transaction';
import * as transformers from '../transformers';
import { AccountChangeReason } from './types';

@Entity('account_changes')
@Index(['changed_in_block_timestamp', 'index_in_block'])
@Index('account_changes_transaction_uni_idx', { synchronize: false })
@Index('account_changes_receipt_uni_idx', { synchronize: false })
@Index('account_changes_null_uni_idx', { synchronize: false })
export class AccountChange {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column('text')
  @Index()
  affected_account_id: string;

  @Column('numeric', { precision: 20, transformer: transformers.bigint })
  @Index()
  changed_in_block_timestamp: bigint;

  @Column('text')
  @Index()
  changed_in_block_hash: string;

  @Column('text', { nullable: true })
  @Index()
  caused_by_transaction_hash: string | null;

  @Column('text', { nullable: true })
  @Index()
  caused_by_receipt_id: string | null;

  @Column('enum', { enum: AccountChangeReason })
  update_reason: AccountChangeReason;

  @Column('numeric', { precision: 45, transformer: transformers.bigint })
  affected_account_nonstaked_balance: bigint;

  @Column('numeric', { precision: 45, transformer: transformers.bigint })
  affected_account_staked_balance: bigint;

  @Column('numeric', { precision: 45, transformer: transformers.bigint })
  affected_account_storage_usage: bigint;

  @Column('int')
  index_in_block: number;

  // TODO: add constraint
  @ManyToOne(() => Account, { createForeignKeyConstraints: false })
  @JoinColumn({
    name: 'affected_account_id',
    referencedColumnName: 'account_id',
  })
  account: Account;

  @ManyToOne(() => Block)
  @JoinColumn({
    name: 'changed_in_block_hash',
    referencedColumnName: 'block_hash',
  })
  block: Block;

  @ManyToOne(() => Transaction)
  @JoinColumn({
    name: 'caused_by_transaction_hash',
    referencedColumnName: 'transaction_hash',
  })
  transaction: Transaction;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'caused_by_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  receipt: Receipt;
}
