import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Block } from './block';
import * as transformers from '../transformers';

@Entity('chunks')
export class Chunk {
  @ManyToOne(() => Block)
  @JoinColumn({
    name: 'included_in_block_hash',
    referencedColumnName: 'block_hash',
  })
  @Index()
  block: Block;

  @PrimaryColumn('text')
  chunk_hash: string;

  @Column('numeric', { precision: 20 })
  shard_id: number;

  @Column('text')
  signature: string;

  @Column('numeric', { precision: 20, transformer: transformers.bigInt })
  gas_limit: bigint;

  @Column('numeric', { precision: 20, transformer: transformers.bigInt })
  gas_used: bigint;

  @Column('text')
  author_account_id: string;
}
