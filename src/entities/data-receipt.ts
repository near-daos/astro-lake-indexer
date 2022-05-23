import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Receipt } from './receipt';

@Entity('data_receipts')
export class DataReceipt {
  @PrimaryColumn('text')
  data_id: string;

  @Column('text')
  @Index()
  receipt_id: string;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'receipt_id',
    referencedColumnName: 'receipt_id',
  })
  receipt: Receipt;

  @Column('bytea', { nullable: true })
  data: Buffer | null;
}
