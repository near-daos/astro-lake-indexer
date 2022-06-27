import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Config } from '../config';
import { InjectRepository } from '../decorators';
import { FtEvent, FtEventKind } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

@Service()
export class FtEventService {
  constructor(
    @Inject()
    private readonly config: Config,
    @InjectRepository(FtEvent)
    private readonly repository: Repository<FtEvent>,
  ) {}

  fromJSON(
    blockTimestamp: bigint,
    shardId: number,
    eventsWithOutcomes: {
      event: Near.NEP141Event;
      outcome: Near.ExecutionOutcomeWithReceipt;
    }[],
  ) {
    const entities: FtEvent[] = [];

    eventsWithOutcomes.forEach(({ event, outcome }) => {
      switch (event.event) {
        case Near.NEP141Events.Mint:
          {
            const { data } = event as Near.NEP141EventMint;
            data.forEach(({ amount, owner_id, memo }) => {
              entities.push(
                this.repository.create({
                  emitted_for_receipt_id: outcome.execution_outcome.id,
                  emitted_at_block_timestamp: blockTimestamp,
                  emitted_in_shard_id: shardId,
                  emitted_index_of_event_entry_in_shard: entities.length,
                  emitted_by_contract_id: outcome.receipt.receiver_id,
                  amount: amount,
                  event_kind: FtEventKind.Mint,
                  token_old_owner_account_id: '',
                  token_new_owner_account_id: owner_id,
                  event_memo: memo || '',
                }),
              );
            });
          }
          break;

        case Near.NEP141Events.Transfer:
          {
            const { data } = event as Near.NEP141EventTransfer;
            data.forEach(({ amount, old_owner_id, new_owner_id, memo }) => {
              entities.push(
                this.repository.create({
                  emitted_for_receipt_id: outcome.execution_outcome.id,
                  emitted_at_block_timestamp: blockTimestamp,
                  emitted_in_shard_id: shardId,
                  emitted_index_of_event_entry_in_shard: entities.length,
                  emitted_by_contract_id: outcome.receipt.receiver_id,
                  amount: amount,
                  event_kind: FtEventKind.Transfer,
                  token_old_owner_account_id: old_owner_id,
                  token_new_owner_account_id: new_owner_id,
                  event_memo: memo || '',
                }),
              );
            });
          }
          break;

        case Near.NEP141Events.Burn:
          {
            const { data } = event as Near.NEP141EventBurn;
            data.forEach(({ amount, owner_id, memo }) => {
              entities.push(
                this.repository.create({
                  emitted_for_receipt_id: outcome.execution_outcome.id,
                  emitted_at_block_timestamp: blockTimestamp,
                  emitted_in_shard_id: shardId,
                  emitted_index_of_event_entry_in_shard: entities.length,
                  emitted_by_contract_id: outcome.receipt.receiver_id,
                  amount: amount,
                  event_kind: FtEventKind.Burn,
                  token_old_owner_account_id: owner_id,
                  token_new_owner_account_id: '',
                  event_memo: memo || '',
                }),
              );
            });
          }
          break;
      }
    });

    return entities;
  }

  async insertIgnore(entities: FtEvent[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<FtEvent>[])
      .orIgnore()
      .execute();
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards.flatMap((shard, shardId) =>
      shard.receipt_execution_outcomes.flatMap((outcome) => {
        const eventsWithOutcomes = outcome.execution_outcome.outcome.logs
          .map(Near.parseLogEvent)
          .filter(Near.isNEP141Event)
          .filter((event) => this.shouldStore(event))
          .map((event) => ({ event, outcome }));

        return this.fromJSON(
          block.header.timestamp,
          shardId,
          eventsWithOutcomes,
        );
      }),
    );

    if (!entities.length) {
      return;
    }

    return this.insertIgnore(entities);
  }

  shouldStore(event: Near.NEP141Event) {
    switch (event.event) {
      case Near.NEP141Events.Mint:
        return event.data.some(({ owner_id }) =>
          matchAccounts(owner_id, this.config.TRACK_ACCOUNTS),
        );

      case Near.NEP141Events.Transfer:
        return event.data.some(
          ({ old_owner_id, new_owner_id }) =>
            matchAccounts(old_owner_id, this.config.TRACK_ACCOUNTS) ||
            matchAccounts(new_owner_id, this.config.TRACK_ACCOUNTS),
        );

      case Near.NEP141Events.Burn:
        return event.data.some(({ owner_id }) =>
          matchAccounts(owner_id, this.config.TRACK_ACCOUNTS),
        );
    }
  }
}
