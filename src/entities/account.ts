import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Receipt } from './receipt';
import * as transformers from '../transformers';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column('text')
  @Index({ unique: true })
  account_id: string;

  @Column('text', { nullable: true })
  created_by_receipt_id: string | null;

  @Column('text', { nullable: true })
  deleted_by_receipt_id: string | null;

  @Column('numeric', { precision: 20, transformer: transformers.int })
  @Index()
  last_update_block_height: number;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'created_by_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  createdByReceipt: Receipt | null;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'deleted_by_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  deletedByReceipt: Receipt | null;
}
