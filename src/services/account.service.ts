import { Inject, Service } from 'typedi';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
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

  private async createOrUpdateAccount(
    repository: Repository<Account>,
    account: DeepPartial<Account>,
  ) {
    const result = await repository
      .createQueryBuilder()
      .insert()
      .values({
        account_id: account.account_id,
        created_by_receipt_id: account.created_by_receipt_id,
        last_update_block_height: account.last_update_block_height,
      })
      .orIgnore()
      .execute();

    if (result.identifiers.every((id) => id === undefined)) {
      // re-create deleted account
      const result = await repository
        .createQueryBuilder()
        .update()
        .set({
          created_by_receipt_id: account.created_by_receipt_id,
          deleted_by_receipt_id: null,
          last_update_block_height: account.last_update_block_height,
        })
        .where('account_id = :accountId', {
          accountId: account.account_id,
        })
        .andWhere('deleted_by_receipt_id is not null')
        .andWhere('last_update_block_height < :height', {
          height: account.last_update_block_height,
        })
        .execute();

      if (!result.affected) {
        throw new Error(`Account ${account.account_id} was not updated`);
      }

      return result;
    }

    return result;
  }

  private async deleteAccount(
    repository: Repository<Account>,
    account: DeepPartial<Account>,
  ) {
    const result = await repository
      .createQueryBuilder()
      .update()
      .set({
        account_id: account.account_id,
        deleted_by_receipt_id: account.deleted_by_receipt_id,
        last_update_block_height: account.last_update_block_height,
      })
      .where('account_id = :accountId', {
        accountId: account.account_id,
      })
      .andWhere('deleted_by_receipt_id is null')
      .andWhere('last_update_block_height < :height', {
        height: account.last_update_block_height,
      })
      .execute();

    if (!result.affected) {
      throw new Error(`Account ${account.account_id} was not updated`);
    }

    return result;
  }

  async store(manager: EntityManager, block: Near.Block, shards: Near.Shard[]) {
    const repository = manager.getRepository(Account);

    const receipts = this.executionOutcomeService
      .getSuccessfulReceiptActions(
        shards.flatMap((shard) => shard.receipt_execution_outcomes),
      )
      .filter((receipt) => this.shouldStore(receipt));

    const createOrUpdateAccounts = receipts.map(async (receipt) => {
      const { actions } = (receipt.receipt as Near.ActionReceipt).Action;

      for (const action of actions) {
        const actionKind = Near.parseKind<Near.Actions>(action);

        switch (actionKind) {
          case Near.Actions.CreateAccount:
            return this.createOrUpdateAccount(repository, {
              account_id: receipt.receiver_id,
              created_by_receipt_id: receipt.receipt_id,
              last_update_block_height: block.header.height,
            });

          case Near.Actions.Transfer:
            // check for implicit account ID
            if (
              receipt.receipt_id.length !== 64 ||
              Buffer.from(receipt.receiver_id, 'hex').length !== 32
            ) {
              return;
            }

            return this.createOrUpdateAccount(repository, {
              account_id: receipt.receiver_id,
              created_by_receipt_id: receipt.receipt_id,
              last_update_block_height: block.header.height,
            });
        }
      }
    });

    const deleteAccounts = receipts.map(async (receipt) => {
      const { actions } = (receipt.receipt as Near.ActionReceipt).Action;

      for (const action of actions) {
        const actionKind = Near.parseKind<Near.Actions>(action);

        switch (actionKind) {
          case Near.Actions.DeleteAccount:
            return this.deleteAccount(repository, {
              account_id: receipt.receiver_id,
              deleted_by_receipt_id: receipt.receipt_id,
              last_update_block_height: block.header.height,
            });
        }
      }
    });

    await Promise.all(createOrUpdateAccounts);
    await Promise.all(deleteAccounts);
  }

  shouldStore(receipt: Near.Receipt) {
    return matchAccounts(receipt.receiver_id, this.config.TRACK_ACCOUNTS);
  }
}
