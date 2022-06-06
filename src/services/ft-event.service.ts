import { Repository } from 'typeorm';
import config from '../config';
import { AppDataSource } from '../data-source';
import { FtEvent, FtEventKind } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

export class FtEventService {
  private readonly repository: Repository<FtEvent>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(FtEvent);
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

  shouldStore(event: Near.NEP141Event) {
    switch (event.event) {
      case Near.NEP141Events.Mint:
        return event.data.some(({ owner_id }) =>
          matchAccounts(owner_id, config.TRACK_ACCOUNTS),
        );

      case Near.NEP141Events.Transfer:
        return event.data.some(
          ({ old_owner_id, new_owner_id }) =>
            matchAccounts(old_owner_id, config.TRACK_ACCOUNTS) ||
            matchAccounts(new_owner_id, config.TRACK_ACCOUNTS),
        );

      case Near.NEP141Events.Burn:
        return event.data.some(({ owner_id }) =>
          matchAccounts(owner_id, config.TRACK_ACCOUNTS),
        );
    }
  }

  shouldStoreReceipt(receipt: Near.Receipt) {
    const kind = Near.parseKind<Near.ReceiptTypes>(receipt.receipt);

    if (kind !== Near.ReceiptTypes.Action) {
      return false;
    }

    const actionReceipt = receipt.receipt as Near.ActionReceipt;

    return actionReceipt.Action.actions.some((action) => {
      const { actionKind, actionArgs } = Near.parseAction(action);

      if (actionKind !== Near.Actions.FunctionCall) {
        return false;
      }

      const { method_name, args_json } =
        actionArgs as unknown as Near.ActionFunctionCallArgs;

      // received
      if (
        ['ft_transfer', 'ft_transfer_call', 'ft_mint'].includes(method_name) &&
        args_json &&
        matchAccounts(args_json.receiver_id, config.TRACK_ACCOUNTS)
      ) {
        return true;
      }

      // minted with bridge
      if (
        method_name === 'mint' &&
        receipt.predecessor_id === config.BRIDGE_TOKEN_FACTORY &&
        args_json &&
        matchAccounts(args_json.account_id, config.TRACK_ACCOUNTS)
      ) {
        return true;
      }

      // called by used
      if (
        (method_name.indexOf('ft_') === 0 ||
          method_name === 'storage_deposit') &&
        matchAccounts(receipt.predecessor_id, config.TRACK_ACCOUNTS)
      ) {
        return true;
      }

      return false;
    });
  }
}
