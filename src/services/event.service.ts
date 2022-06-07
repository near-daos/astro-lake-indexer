import { Repository } from 'typeorm';
import config from '../config';
import { AppDataSource } from '../data-source';
import { Event } from '../entities';
import * as Near from '../near';
import { jsonMatchAccounts } from '../utils';

export class EventService {
  private readonly repository: Repository<Event>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(Event);
  }

  fromJSON(
    blockTimestamp: bigint,
    shardId: number,
    eventsWithOutcomes: {
      event: Near.UnknownEvent;
      outcome: Near.ExecutionOutcomeWithReceipt;
    }[],
  ) {
    const entities: Event[] = [];

    eventsWithOutcomes.forEach(({ event, outcome }) => {
      entities.push(
        this.repository.create({
          emitted_for_receipt_id: outcome.execution_outcome.id,
          emitted_at_block_timestamp: blockTimestamp,
          emitted_in_shard_id: shardId,
          emitted_index_of_event_entry_in_shard: entities.length,
          emitted_by_contract_id: outcome.receipt.receiver_id,
          event_json: event,
        }),
      );
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
              .filter(Near.isEvent)
              .filter(this.shouldStore)
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

  shouldStore(event: Near.Event) {
    return jsonMatchAccounts(event, config.TRACK_ACCOUNTS);
  }
}
