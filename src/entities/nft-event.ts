import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { NftEventKind } from './types';
import { Receipt } from './receipt';
import * as transformers from '../transformers';

@Entity('assets__non_fungible_token_events')
@Unique(['emitted_for_receipt_id', 'emitted_index_of_event_entry_in_shard'])
@Index([
  'emitted_at_block_timestamp',
  'emitted_in_shard_id',
  'emitted_index_of_event_entry_in_shard',
])
export class NftEvent {
  @PrimaryColumn('text')
  emitted_for_receipt_id: string;

  @PrimaryColumn('numeric', { precision: 20, transformer: transformers.bigint })
  @Index()
  emitted_at_block_timestamp: bigint;

  @PrimaryColumn('numeric', { precision: 20, transformer: transformers.int })
  emitted_in_shard_id: number;

  @PrimaryColumn('int')
  emitted_index_of_event_entry_in_shard: number;

  @PrimaryColumn('text')
  emitted_by_contract_id: string;

  @PrimaryColumn('text')
  token_id: string;

  @PrimaryColumn('enum', { enum: NftEventKind })
  event_kind: NftEventKind;

  @PrimaryColumn('text')
  @Index()
  token_old_owner_account_id: string;

  @PrimaryColumn('text')
  @Index()
  token_new_owner_account_id: string;

  @PrimaryColumn('text')
  token_authorized_account_id: string;

  @PrimaryColumn('text')
  event_memo: string;

  // TODO: add constraint
  @ManyToOne(() => Receipt, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({
    name: 'emitted_for_receipt_id',
    referencedColumnName: 'receipt_id',
  })
  receipt: Receipt | null;
}
