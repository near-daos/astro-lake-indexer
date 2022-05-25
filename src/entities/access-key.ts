import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Receipt } from './receipt';
import { PermissionType } from './types';
import * as transformers from '../transformers';

@Entity('access_keys')
export class AccessKey {
  @PrimaryColumn('text')
  @Index()
  public_key: string;

  @PrimaryColumn('text')
  @Index()
  account_id: string;

  @Column('text', { nullable: true })
  created_by_receipt_id: string | null;

  @Column('text', { nullable: true })
  deleted_by_receipt_id: string | null;

  @Column('enum', { enum: PermissionType })
  permission_kind: PermissionType;

  @Column('numeric', { precision: 20, transformer: transformers.int })
  @Index()
  last_update_block_height: number;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'created_by_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  createdByReceipt: Receipt;

  @ManyToOne(() => Receipt)
  @JoinColumn({
    name: 'deleted_by_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  deletedByReceipt: Receipt;
}
