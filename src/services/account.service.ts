import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Account } from '../entities';
import * as services from '../services';
import { matchAccounts } from '../utils';
import config from '../config';

class AccountService {
  constructor(
    private readonly repository: Repository<Account> = AppDataSource.getRepository(
      Account,
    ),
  ) {}

  async handle(block: Near.Block, shards: Near.Shard[]) {
    const actions = services.executionOutcomeService
      .getSuccessfulReceiptActions(
        shards.map((shard) => shard.receipt_execution_outcomes).flat(),
      )
      .filter(this.shouldStore)
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

export const accountService = new AccountService();
