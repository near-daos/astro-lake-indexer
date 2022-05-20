import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import * as transformers from '../transformers';

@Entity('blocks')
export class Block {
  @Column('numeric', { precision: 20 })
  @Index()
  block_height: number;

  @PrimaryColumn('text')
  block_hash: string;

  @Column('text')
  @Index()
  prev_block_hash: string;

  @Column('numeric', { precision: 20, transformer: transformers.bigInt })
  @Index()
  block_timestamp: BigInt;

  @Column('numeric', { precision: 45, transformer: transformers.bigInt })
  total_supply: BigInt;

  @Column('numeric', { precision: 45, transformer: transformers.bigInt })
  gas_price: BigInt;

  @Column('text')
  author_account_id: string;
}
