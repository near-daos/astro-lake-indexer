import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Receipt } from './receipt';

@Entity('action_receipt_output_data')
export class ActionReceiptOutputData {
  @PrimaryColumn('text')
  @Index()
  output_data_id: string;

  @PrimaryColumn('text')
  @Index()
  output_from_receipt_id: string;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'output_from_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  receipt: Receipt;

  @Column('text')
  @Index()
  receiver_account_id: string;
}
