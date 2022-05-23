import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Receipt } from './receipt';

@Entity('action_receipt_input_data')
export class ActionReceiptInputData {
  @PrimaryColumn('text')
  @Index()
  input_data_id: string;

  @PrimaryColumn('text')
  @Index()
  input_to_receipt_id: string;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'input_to_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  receipt: Receipt;
}
