import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

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

  @Column('numeric', { precision: 20 })
  @Index()
  block_timestamp: string;

  @Column('numeric', { precision: 45 })
  total_supply: string;

  @Column('numeric', { precision: 45 })
  gas_price: string;

  @Column('text')
  author_account_id: string;
}
