import { Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import * as transformers from '../transformers';

@Entity('last_block')
export class LastBlock {
  @PrimaryColumn('bigint', { transformer: transformers.int })
  block_height: number;

  @UpdateDateColumn()
  updated_date: Date;
}
