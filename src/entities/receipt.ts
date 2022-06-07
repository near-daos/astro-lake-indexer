import {
  Column,
  Entity,
  JoinColumn,
  Index,
  ManyToOne,
  PrimaryColumn,
  OneToOne,
} from 'typeorm';
import { ActionReceipt } from './action-receipt';
import { Block } from './block';
import { Chunk } from './chunk';
import { DataReceipt } from './data-receipt';
import { Transaction } from './transaction';
import { ReceiptKind } from './types';
import * as transformers from '../transformers';

@Entity('receipts')
export class Receipt {
  @PrimaryColumn('text')
  receipt_id: string;

  @Column('text')
  @Index()
  included_in_block_hash: string;

  @Column('text')
  @Index()
  included_in_chunk_hash: string;

  @Column('int')
  index_in_chunk: number;

  @Column('numeric', { precision: 20, transformer: transformers.bigint })
  @Index()
  included_in_block_timestamp: bigint;

  @Column('text')
  @Index()
  predecessor_account_id: string;

  @Column('text')
  @Index()
  receiver_account_id: string;

  @Column('enum', { enum: ReceiptKind })
  receipt_kind: ReceiptKind;

  @Column('text', { nullable: true })
  @Index()
  originated_from_transaction_hash: string;

  @ManyToOne(() => Block)
  @JoinColumn({
    name: 'included_in_block_hash',
    referencedColumnName: 'block_hash',
  })
  block: Block;

  @ManyToOne(() => Chunk)
  @JoinColumn({
    name: 'included_in_chunk_hash',
    referencedColumnName: 'chunk_hash',
  })
  chunk: Chunk;

  @ManyToOne(() => Transaction)
  @JoinColumn({
    name: 'originated_from_transaction_hash',
    referencedColumnName: 'transaction_hash',
  })
  transaction: Transaction;

  @OneToOne(() => ActionReceipt, (actionReceipt) => actionReceipt.receipt, {
    nullable: true,
    cascade: true,
  })
  action: ActionReceipt | null;

  @OneToOne(() => DataReceipt, (dataReceipt) => dataReceipt.receipt, {
    nullable: true,
    cascade: true,
  })
  data: DataReceipt | null;
}
