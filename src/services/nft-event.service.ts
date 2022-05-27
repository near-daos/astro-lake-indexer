import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { NftEvent, NftEventKind } from '../entities';

export class NftEventService {
  private readonly repository: Repository<NftEvent>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(NftEvent);
  }

  fromJSON(
    blockTimestamp: number,
    shardId: number,
    eventsWithOutcomes: {
      event: Near.NEP171Event;
      outcome: Near.ExecutionOutcomeWithReceipt;
    }[],
  ) {
    const entities: NftEvent[] = [];

    eventsWithOutcomes.forEach(({ event, outcome }) => {
      switch (event.event) {
        case Near.NEP171Events.Mint:
          {
            const { data } = event as Near.NEP171EventMint;
            data.forEach(({ token_ids, owner_id, memo }) => {
              token_ids.forEach((tokenId) => {
                entities.push(
                  this.repository.create({
                    emitted_for_receipt_id: outcome.execution_outcome.id,
                    emitted_at_block_timestamp: blockTimestamp,
                    emitted_in_shard_id: shardId,
                    emitted_index_of_event_entry_in_shard: entities.length,
                    emitted_by_contract_id: outcome.receipt.receiver_id,
                    token_id: tokenId,
                    event_kind: NftEventKind.Mint,
                    token_old_owner_account_id: '',
                    token_new_owner_account_id: owner_id,
                    token_authorized_account_id: '',
                    event_memo: memo || '',
                  }),
                );
              });
            });
          }
          break;

        case Near.NEP171Events.Transfer:
          {
            const { data } = event as Near.NEP171EventTransfer;
            data.forEach(
              ({
                token_ids,
                old_owner_id,
                new_owner_id,
                authorized_id,
                memo,
              }) => {
                token_ids.forEach((tokenId) => {
                  entities.push(
                    this.repository.create({
                      emitted_for_receipt_id: outcome.execution_outcome.id,
                      emitted_at_block_timestamp: blockTimestamp,
                      emitted_in_shard_id: shardId,
                      emitted_index_of_event_entry_in_shard: entities.length,
                      emitted_by_contract_id: outcome.receipt.receiver_id,
                      token_id: tokenId,
                      event_kind: NftEventKind.Transfer,
                      token_old_owner_account_id: old_owner_id,
                      token_new_owner_account_id: new_owner_id,
                      token_authorized_account_id: authorized_id,
                      event_memo: memo || '',
                    }),
                  );
                });
              },
            );
          }
          break;

        case Near.NEP171Events.Burn:
          {
            const { data } = event as Near.NEP171EventBurn;
            data.forEach(({ token_ids, owner_id, authorized_id, memo }) => {
              token_ids.forEach((tokenId) => {
                entities.push(
                  this.repository.create({
                    emitted_for_receipt_id: outcome.execution_outcome.id,
                    emitted_at_block_timestamp: blockTimestamp,
                    emitted_in_shard_id: shardId,
                    emitted_index_of_event_entry_in_shard: entities.length,
                    emitted_by_contract_id: outcome.receipt.receiver_id,
                    token_id: tokenId,
                    event_kind: NftEventKind.Burn,
                    token_old_owner_account_id: owner_id,
                    token_new_owner_account_id: '',
                    token_authorized_account_id: authorized_id,
                    event_memo: memo || '',
                  }),
                );
              });
            });
          }
          break;
      }
    });

    return entities;
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .map((shard, shardId) =>
        shard.receipt_execution_outcomes
          .map((outcome) => {
            const eventsWithOutcomes = outcome.execution_outcome.outcome.logs
              .map(Near.parseLogEvent)
              .filter(Near.isNEP171Event)
              .map((event) => ({ event, outcome }));

            return this.fromJSON(
              block.header.timestamp,
              shardId,
              eventsWithOutcomes,
            );
          })
          .flat(),
      )
      .flat();

    return this.repository.save(entities);
  }
}
