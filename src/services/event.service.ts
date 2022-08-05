import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Config } from '../config';
import { InjectLogger, InjectRepository } from '../decorators';
import { Event } from '../entities';
import * as Near from '../near';
import { jsonMatchAccounts } from '../utils';

@Service()
export class EventService {
  constructor(
    @InjectLogger('event-service')
    private readonly logger: Logger,
    @Inject()
    private readonly config: Config,
    @InjectRepository(Event)
    private readonly repository: Repository<Event>,
  ) {}

  fromJSON(
    blockTimestamp: bigint,
    shardId: number,
    indexInShard: number,
    event: Near.UnknownEvent,
    outcome: Near.ExecutionOutcomeWithReceipt,
  ) {
    return this.repository.create({
      emitted_for_receipt_id: outcome.execution_outcome.id,
      emitted_at_block_timestamp: blockTimestamp,
      emitted_in_shard_id: shardId,
      emitted_index_of_event_entry_in_shard: indexInShard,
      emitted_by_contract_account_id: outcome.receipt.receiver_id,
      event_json: event,
    });
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
    const entities = shards
      .flatMap((shard, shardId) => {
        const eventsWithOutcomes = shard.receipt_execution_outcomes.flatMap(
          (outcome) =>
            outcome.execution_outcome.outcome.logs
              .map(Near.parseLogEvent)
              .filter(Near.isEvent)
              .map((event) => ({ event, outcome })),
        );

        return eventsWithOutcomes.map(({ event, outcome }, indexInShard) =>
          this.fromJSON(
            block.header.timestamp,
            shardId,
            indexInShard,
            event,
            outcome,
          ),
        );
      })
      .filter((event) => this.shouldStore(event));

    if (!entities.length) {
      return;
    }

    const result = await this.insertIgnore(entities);

    this.logger.info(
      'Stored events: %d (%s)',
      entities.length,
      entities.map((event) => event.emitted_for_receipt_id).join(', '),
    );

    return result;
  }

  shouldStore(event: Event) {
    return jsonMatchAccounts(event.event_json, this.config.TRACK_ACCOUNTS);
  }
}
