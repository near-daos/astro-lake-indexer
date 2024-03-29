import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { DeepPartial, Repository } from 'typeorm';
import { ExecutionOutcomeService } from './execution-outcome.service';
import { Config } from '../config';
import { InjectLogger, InjectRepository } from '../decorators';
import { Account } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

@Service()
export class AccountService {
  constructor(
    @InjectLogger('account-service')
    private readonly logger: Logger,
    @Inject()
    private readonly config: Config,
    @InjectRepository(Account)
    private readonly repository: Repository<Account>,
    @Inject()
    private readonly executionOutcomeService: ExecutionOutcomeService,
  ) {}

  private async createOrUpdateAccount(account: DeepPartial<Account>) {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .insert()
        .values({
          account_id: account.account_id,
          created_by_receipt_id: account.created_by_receipt_id,
          last_update_block_height: account.last_update_block_height,
        })
        .execute();

      this.logger.info(
        `Created account: %s (%s)`,
        account.account_id,
        account.created_by_receipt_id,
      );

      return result;
    } catch (err) {
      // Update deleted account
      const result = await this.repository
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

      this.logger.info(
        `Updated account: %s (%s)`,
        account.account_id,
        account.created_by_receipt_id,
      );

      return result;
    }
  }

  private async deleteAccount(account: DeepPartial<Account>) {
    const result = await this.repository
      .createQueryBuilder()
      .update()
      .set({
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

    this.logger.info(
      `Deleted account: %s (%s)`,
      account.account_id,
      account.deleted_by_receipt_id,
    );

    return result;
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const receipts = this.executionOutcomeService
      .getSuccessfulReceiptActions(
        shards.flatMap((shard) => shard.receipt_execution_outcomes),
      )
      .filter((receipt) => this.shouldStore(receipt));

    const createOrUpdateAccounts = receipts.flatMap(async (receipt) => {
      const { actions } = (receipt.receipt as Near.ActionReceipt).Action;

      return actions.map((action) => {
        const actionKind = Near.parseKind<Near.Actions>(action);

        switch (actionKind) {
          case Near.Actions.CreateAccount:
            return this.createOrUpdateAccount({
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

            return this.createOrUpdateAccount({
              account_id: receipt.receiver_id,
              created_by_receipt_id: receipt.receipt_id,
              last_update_block_height: block.header.height,
            });
        }
      });
    });

    const deleteAccounts = receipts.flatMap(async (receipt) => {
      const { actions } = (receipt.receipt as Near.ActionReceipt).Action;

      return actions.map((action) => {
        const actionKind = Near.parseKind<Near.Actions>(action);

        switch (actionKind) {
          case Near.Actions.DeleteAccount:
            return this.deleteAccount({
              account_id: receipt.receiver_id,
              deleted_by_receipt_id: receipt.receipt_id,
              last_update_block_height: block.header.height,
            });
        }
      });
    });

    const deleteResults = await Promise.all(deleteAccounts);
    const createOrUpdateResults = await Promise.all(createOrUpdateAccounts);

    return { deleteResults, createOrUpdateResults };
  }

  shouldStore(receipt: Near.Receipt) {
    return matchAccounts(receipt.receiver_id, this.config.TRACK_ACCOUNTS);
  }
}
