import {
  Column,
  Entity,
  JoinColumn,
  Index,
  ManyToOne,
  PrimaryColumn,
  OneToMany,
} from 'typeorm';
import { Chunk } from './chunk';
import { Block } from './block';
import { TransactionAction } from './transaction-action';
import { TransactionStatus } from './types';
import * as transformers from '../transformers';

@Entity('transactions')
@Index(['block_timestamp', 'index_in_chunk'])
export class Transaction {
  @PrimaryColumn('text')
  transaction_hash: string;

  @Column('text')
  @Index()
  included_in_block_hash: string;

  @Column('text')
  @Index()
  included_in_chunk_hash: string;

  @Column('int')
  index_in_chunk: number;

  @Column('numeric', { precision: 20, transformer: transformers.bigint })
  @Index()
  block_timestamp: bigint;

  @Column('text')
  @Index()
  signer_account_id: string;

  @Column('text')
  @Index()
  signer_public_key: string;

  @Column('numeric', { precision: 20, transformer: transformers.int })
  nonce: number;

  @Column('text')
  @Index()
  receiver_account_id: string;

  @Column('text')
  signature: string;

  @Column('enum', { enum: TransactionStatus })
  status: TransactionStatus;

  @Column('text')
  @Index()
  converted_into_receipt_id: string;

  @Column('numeric', { precision: 20, transformer: transformers.int })
  receipt_conversion_gas_burnt: number;

  @Column('numeric', { precision: 45, transformer: transformers.bigint })
  receipt_conversion_tokens_burnt: bigint;

  @ManyToOne(() => Block)
  @JoinColumn({
    name: 'included_in_block_hash',
    referencedColumnName: 'block_hash',
  })
  block: Block;

  @ManyToOne(() => Chunk)
  @JoinColumn({
    name: 'included_in_chunk_hash',
    referencedColumnName: 'chunk_hash',
  })
  chunk: Chunk;

  @OneToMany(() => TransactionAction, (action) => action.transaction, {
    cascade: true,
  })
  actions: TransactionAction[];
}
