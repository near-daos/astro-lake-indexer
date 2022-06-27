import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Config } from '../config';
import { InjectRepository } from '../decorators';
import { Event } from '../entities';
import * as Near from '../near';
import { jsonMatchAccounts } from '../utils';

@Service()
export class EventService {
  constructor(
    @Inject()
    private readonly config: Config,
    @InjectRepository(Event)
    private readonly repository: Repository<Event>,
  ) {}

  fromJSON(
    blockTimestamp: bigint,
    shardId: number,
    eventsWithOutcomes: {
      event: Near.UnknownEvent;
      outcome: Near.ExecutionOutcomeWithReceipt;
    }[],
  ) {
    return eventsWithOutcomes.map(({ event, outcome }, index) =>
      this.repository.create({
        emitted_for_receipt_id: outcome.execution_outcome.id,
        emitted_at_block_timestamp: blockTimestamp,
        emitted_in_shard_id: shardId,
        emitted_index_of_event_entry_in_shard: index,
        emitted_by_contract_id: outcome.receipt.receiver_id,
        event_json: event,
      }),
    );
  }

  async insertIgnore(entities: Event[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<Event>[])
      .orIgnore()
      .execute();
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards.flatMap((shard, shardId) =>
      shard.receipt_execution_outcomes.flatMap((outcome) => {
        const eventsWithOutcomes = outcome.execution_outcome.outcome.logs
          .map(Near.parseLogEvent)
          .filter(Near.isEvent)
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

  shouldStore(event: Near.Event) {
    return jsonMatchAccounts(event, this.config.TRACK_ACCOUNTS);
  }
}
