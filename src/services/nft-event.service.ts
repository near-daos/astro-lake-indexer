import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Config } from '../config';
import { InjectLogger, InjectRepository } from '../decorators';
import { NftEvent, NftEventKind } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

@Service()
export class NftEventService {
  constructor(
    @InjectLogger('nft-event-service')
    private readonly logger: Logger,
    @Inject()
    private readonly config: Config,
    @InjectRepository(NftEvent)
    private readonly repository: Repository<NftEvent>,
  ) {}

  fromJSON(
    blockTimestamp: bigint,
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
              if (!Array.isArray(token_ids) || !owner_id) {
                return;
              }
              token_ids.forEach((tokenId) => {
                entities.push(
                  this.repository.create({
                    emitted_for_receipt_id: outcome.execution_outcome.id,
                    emitted_at_block_timestamp: blockTimestamp,
                    emitted_in_shard_id: shardId,
                    emitted_index_of_event_entry_in_shard: entities.length,
                    emitted_by_contract_account_id: outcome.receipt.receiver_id,
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
                if (
                  !Array.isArray(token_ids) ||
                  !old_owner_id ||
                  !new_owner_id
                ) {
                  return;
                }
                token_ids.forEach((tokenId) => {
                  entities.push(
                    this.repository.create({
                      emitted_for_receipt_id: outcome.execution_outcome.id,
                      emitted_at_block_timestamp: blockTimestamp,
                      emitted_in_shard_id: shardId,
                      emitted_index_of_event_entry_in_shard: entities.length,
                      emitted_by_contract_account_id:
                        outcome.receipt.receiver_id,
                      token_id: tokenId,
                      event_kind: NftEventKind.Transfer,
                      token_old_owner_account_id: old_owner_id,
                      token_new_owner_account_id: new_owner_id,
                      token_authorized_account_id: authorized_id || '',
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
              if (!Array.isArray(token_ids) || !owner_id) {
                return;
              }
              token_ids.forEach((tokenId) => {
                entities.push(
                  this.repository.create({
                    emitted_for_receipt_id: outcome.execution_outcome.id,
                    emitted_at_block_timestamp: blockTimestamp,
                    emitted_in_shard_id: shardId,
                    emitted_index_of_event_entry_in_shard: entities.length,
                    emitted_by_contract_account_id: outcome.receipt.receiver_id,
                    token_id: tokenId,
                    event_kind: NftEventKind.Burn,
                    token_old_owner_account_id: owner_id,
                    token_new_owner_account_id: '',
                    token_authorized_account_id: authorized_id || '',
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

  async insertIgnore(entities: NftEvent[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<NftEvent>[])
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
              .filter(Near.isNEP171Event)
              .map((event) => ({ event, outcome })),
        );

        return this.fromJSON(
          block.header.timestamp,
          shardId,
          eventsWithOutcomes,
        );
      })
      .filter((nftEvent) => this.shouldStore(nftEvent));

    if (!entities.length) {
      return;
    }

    const result = await this.insertIgnore(entities);

    this.logger.info(
      'Stored NFT events: %d (%s)',
      entities.length,
      entities.map((event) => event.emitted_for_receipt_id).join(', '),
    );

    return result;
  }

  shouldStore(nftEvent: NftEvent) {
    return (
      matchAccounts(
        nftEvent.token_old_owner_account_id,
        this.config.TRACK_ACCOUNTS,
      ) ||
      matchAccounts(
        nftEvent.token_new_owner_account_id,
        this.config.TRACK_ACCOUNTS,
      )
    );
  }
}
