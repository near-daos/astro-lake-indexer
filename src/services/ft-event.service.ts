import { Repository } from 'typeorm';
import { ExecutionOutcomeService } from './execution-outcome.service';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { FtEvent, FtEventKind } from '../entities';

export class FtEventService {
  private readonly repository: Repository<FtEvent>;
  private readonly executionOutcomeService: ExecutionOutcomeService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(FtEvent);
    this.executionOutcomeService = new ExecutionOutcomeService(manager);
  }

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

  async store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .map((shard, shardId) =>
        shard.receipt_execution_outcomes
          .map((outcome) => {
            const eventsWithOutcomes = outcome.execution_outcome.outcome.logs
              .map(Near.parseLogEvent)
              .filter(Near.isNEP141Event)
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
