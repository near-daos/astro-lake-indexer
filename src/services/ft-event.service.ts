import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Config } from '../config';
import { InjectLogger, InjectRepository } from '../decorators';
import { FtEvent, FtEventKind } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

@Service()
export class FtEventService {
  constructor(
    @InjectLogger('ft-event-service')
    private readonly logger: Logger,
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
              if (!amount || !owner_id) {
                return;
              }
              entities.push(
                this.repository.create({
                  emitted_for_receipt_id: outcome.execution_outcome.id,
                  emitted_at_block_timestamp: blockTimestamp,
                  emitted_in_shard_id: shardId,
                  emitted_index_of_event_entry_in_shard: entities.length,
                  emitted_by_contract_account_id: outcome.receipt.receiver_id,
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
              if (!amount || !old_owner_id || !new_owner_id) {
                return;
              }
              entities.push(
                this.repository.create({
                  emitted_for_receipt_id: outcome.execution_outcome.id,
                  emitted_at_block_timestamp: blockTimestamp,
                  emitted_in_shard_id: shardId,
                  emitted_index_of_event_entry_in_shard: entities.length,
                  emitted_by_contract_account_id: outcome.receipt.receiver_id,
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
              if (!amount || !owner_id) {
                return;
              }
              entities.push(
                this.repository.create({
                  emitted_for_receipt_id: outcome.execution_outcome.id,
                  emitted_at_block_timestamp: blockTimestamp,
                  emitted_in_shard_id: shardId,
                  emitted_index_of_event_entry_in_shard: entities.length,
                  emitted_by_contract_account_id: outcome.receipt.receiver_id,
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
    const entities = shards
      .flatMap((shard, shardId) => {
        const eventsWithOutcomes = shard.receipt_execution_outcomes.flatMap(
          (outcome) =>
            outcome.execution_outcome.outcome.logs
              .map(Near.parseLogEvent)
              .filter(Near.isNEP141Event)
              .map((event) => ({ event, outcome })),
        );

        return this.fromJSON(
          block.header.timestamp,
          shardId,
          eventsWithOutcomes,
        );
      })
      .filter((ftEvent) => this.shouldStore(ftEvent));

    if (!entities.length) {
      return;
    }

    const result = await this.insertIgnore(entities);

    this.logger.info(
      'Stored FT events: %d (%s)',
      entities.length,
      entities.map((event) => event.emitted_for_receipt_id).join(', '),
    );

    return result;
  }

  shouldStore(ftEvent: FtEvent) {
    return (
      matchAccounts(
        ftEvent.token_old_owner_account_id,
        this.config.TRACK_ACCOUNTS,
      ) ||
      matchAccounts(
        ftEvent.token_new_owner_account_id,
        this.config.TRACK_ACCOUNTS,
      )
    );
  }
}
