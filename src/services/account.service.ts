import { Repository } from 'typeorm';
import { ExecutionOutcomeService } from './execution-outcome.service';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Account } from '../entities';
import { matchAccounts } from '../utils';
import config from '../config';

export class AccountService {
  private readonly repository: Repository<Account>;
  private readonly executionOutcomeService: ExecutionOutcomeService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(Account);
    this.executionOutcomeService = new ExecutionOutcomeService(manager);
  }

  async handle(block: Near.Block, shards: Near.Shard[]) {
    const actions = this.executionOutcomeService
      .getSuccessfulReceiptActions(
        shards.map((shard) => shard.receipt_execution_outcomes).flat(),
      )
      .filter((receipt) => this.shouldStore(receipt))
      .map(async (receipt) => {
        const { actions } = (receipt.receipt as Near.ActionReceipt).Action;

        for (const action of actions) {
          const actionKind = Near.parseKind<Near.Actions>(action);

          switch (actionKind) {
            case Near.Actions.CreateAccount: {
              return this.repository.insert({
                account_id: receipt.receiver_id,
                created_by_receipt_id: receipt.receipt_id,
                last_update_block_height: block.header.height,
              });
            }

            case Near.Actions.Transfer: {
              // check for implicit account ID
              if (
                receipt.receipt_id.length !== 64 ||
                Buffer.from(receipt.receiver_id, 'hex').length !== 32
              ) {
                return;
              }
              return this.repository.insert({
                account_id: receipt.receiver_id,
                created_by_receipt_id: receipt.receipt_id,
                last_update_block_height: block.header.height,
              });
            }

            case Near.Actions.DeleteAccount: {
              return this.repository.upsert(
                {
                  account_id: receipt.receiver_id,
                  deleted_by_receipt_id: receipt.receipt_id,
                  last_update_block_height: block.header.height,
                },
                ['account_id'],
              );
            }
          }
        }
      });

    return Promise.all(actions);
  }

  shouldStore(receipt: Near.Receipt) {
    return matchAccounts(receipt.receiver_id, config.TRACK_ACCOUNTS);
  }
}
