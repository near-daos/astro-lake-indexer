import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Block } from './Block';
import * as transformers from '../transformers';

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

  @Column('numeric', { precision: 20, transformer: transformers.bigInt })
  gas_limit: BigInt;

  @Column('numeric', { precision: 20, transformer: transformers.bigInt })
  gas_used: BigInt;

  @Column('text')
  author_account_id: string;
}
