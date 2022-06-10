import { Inject, Service } from 'typedi';
import { EntityManager } from 'typeorm';
import { ExecutionOutcomeService } from './execution-outcome.service';
import { Config } from '../config';
import { Account } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

@Service()
export class AccountService {
  constructor(
    @Inject()
    private readonly config: Config,
    @Inject()
    private readonly executionOutcomeService: ExecutionOutcomeService,
  ) {}

  async store(manager: EntityManager, block: Near.Block, shards: Near.Shard[]) {
    const repository = manager.getRepository(Account);

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
              return repository.insert({
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
              return repository.insert({
                account_id: receipt.receiver_id,
                created_by_receipt_id: receipt.receipt_id,
                last_update_block_height: block.header.height,
              });
            }

            case Near.Actions.DeleteAccount: {
              return repository.upsert(
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
    return matchAccounts(receipt.receiver_id, this.config.TRACK_ACCOUNTS);
  }
}
