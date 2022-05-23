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

@Entity('action_receipts')
export class ActionReceipt {
  @PrimaryColumn('text')
  @Index()
  receipt_id: string;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'receipt_id',
    referencedColumnName: 'receipt_id',
  })
  receipt: Receipt;

  @Column('text')
  @Index()
  signer_account_id: string;

  @Column('text')
  signer_public_key: string;

  @Column('numeric', { precision: 45, transformer: transformers.bigInt })
  gas_price: bigint;
}
