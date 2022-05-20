import {
  Column,
  Entity,
  JoinColumn,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import * as transformers from '../transformers';
import { ExecutionOutcomeStatus } from '../near';
import { Chunk } from './chunk';
import { Block } from './block';

@Entity('transactions')
@Index(['block_timestamp', 'index_in_chunk'])
export class Transaction {
  @PrimaryColumn('text', { primary: true })
  transaction_hash: string;

  @ManyToOne(() => Block)
  @JoinColumn({
    name: 'included_in_block_hash',
    referencedColumnName: 'block_hash',
  })
  @Index()
  block: Block;

  @ManyToOne(() => Chunk)
  @JoinColumn({
    name: 'included_in_chunk_hash',
    referencedColumnName: 'chunk_hash',
  })
  @Index()
  chunk: Chunk;

  @Column('int')
  index_in_chunk: number;

  @Column('numeric', { precision: 20, transformer: transformers.bigInt })
  @Index()
  block_timestamp: bigint;

  @Column('text')
  @Index()
  signer_account_id: string;

  @Column('text')
  @Index()
  signer_public_key: string;

  @Column('numeric', { precision: 20 })
  nonce: number;

  @Column('text')
  @Index()
  receiver_account_id: string;

  @Column('text')
  signature: string;

  @Column('enum', { enum: ExecutionOutcomeStatus })
  status: ExecutionOutcomeStatus;

  @Column('text')
  @Index()
  converted_into_receipt_id: string;

  @Column('numeric', { precision: 20, transformer: transformers.bigInt })
  receipt_conversion_gas_burnt: bigint;

  @Column('numeric', { precision: 45, transformer: transformers.bigInt })
  receipt_conversion_tokens_burnt: bigint;
}
