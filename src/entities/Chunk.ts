import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Block } from './Block';

@Entity('chunks')
export class Chunk {
  @Column('text')
  @ManyToOne(() => Block)
  included_in_block_hash: string;

  @PrimaryColumn('text')
  chunk_hash: string;

  @Column('numeric', { precision: 20 })
  shard_id: number;

  @Column('text')
  signature: string;

  @Column('numeric', { precision: 20 })
  gas_limit: number;

  @Column('numeric', { precision: 20 })
  gas_used: number;

  @Column('text')
  author_account_id: string;
}
