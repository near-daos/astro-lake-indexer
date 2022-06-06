import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { ActionReceiptAction } from './action-receipt-action';
import { ActionReceiptInputData } from './action-receipt-input-data';
import { ActionReceiptOutputData } from './action-receipt-output-data';
import { Receipt } from './receipt';
import * as transformers from '../transformers';

@Entity('action_receipts')
export class ActionReceipt {
  @PrimaryColumn('text')
  @Index()
  receipt_id: string;

  @Column('text')
  @Index()
  signer_account_id: string;

  @Column('text')
  signer_public_key: string;

  @Column('numeric', { precision: 45, transformer: transformers.bigint })
  gas_price: bigint;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'receipt_id',
    referencedColumnName: 'receipt_id',
  })
  receipt: Receipt;

  @OneToMany(() => ActionReceiptAction, (action) => action.receipt, {
    cascade: true,
  })
  actions: ActionReceiptAction[];

  @OneToMany(() => ActionReceiptInputData, (data) => data.receipt, {
    cascade: true,
  })
  inputData: ActionReceiptInputData[];

  @OneToMany(() => ActionReceiptOutputData, (data) => data.receipt, {
    cascade: true,
  })
  outputData: ActionReceiptOutputData[];
}
