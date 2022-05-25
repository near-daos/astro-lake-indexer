import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import * as transformers from '../transformers';

@Entity('blocks')
export class Block {
  @Column('numeric', { precision: 20, transformer: transformers.int })
  @Index()
  block_height: number;

  @PrimaryColumn('text')
  block_hash: string;

  @Column('text')
  @Index()
  prev_block_hash: string;

  @Column('numeric', { precision: 20, transformer: transformers.int })
  @Index()
  block_timestamp: number;

  @Column('numeric', { precision: 45, transformer: transformers.bigint })
  total_supply: bigint;

  @Column('numeric', { precision: 45, transformer: transformers.bigint })
  gas_price: bigint;

  @Column('text')
  author_account_id: string;
}
