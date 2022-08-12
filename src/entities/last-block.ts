import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import * as transformers from '../transformers';

@Entity('last_block')
export class LastBlock {
  @PrimaryColumn('bigint', { transformer: transformers.int })
  block_height: number;

  @Column('numeric', {
    precision: 20,
    transformer: transformers.bigint,
    default: 0,
  })
  block_timestamp: bigint;

  @UpdateDateColumn()
  updated_date: Date;
}
