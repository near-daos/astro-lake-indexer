import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { DeepPartial, Repository } from 'typeorm';
import { ExecutionOutcomeService } from './execution-outcome.service';
import { Config } from '../config';
import { InjectLogger, InjectRepository } from '../decorators';
import { AccessKey, PermissionType } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

@Service()
export class AccessKeyService {
  constructor(
    @InjectLogger('access-key-service')
    private readonly logger: Logger,
    @Inject()
    private readonly config: Config,
    @InjectRepository(AccessKey)
    private readonly repository: Repository<AccessKey>,
    @Inject()
    private readonly executionOutcomeService: ExecutionOutcomeService,
  ) {}

  private async createOrUpdateAccessKey(accessKey: DeepPartial<AccessKey>) {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .insert()
        .values({
          public_key: accessKey.public_key,
          account_id: accessKey.account_id,
          permission_kind: accessKey.permission_kind,
          created_by_receipt_id: accessKey.created_by_receipt_id,
          last_update_block_height: accessKey.last_update_block_height,
        })
        .execute();

      this.logger.info(
        `Created access key: %s for account: %s (%s)`,
        accessKey.public_key,
        accessKey.account_id,
        accessKey.created_by_receipt_id,
      );

      return result;
    } catch (err) {
      // Update deleted access key
      const result = await this.repository
        .createQueryBuilder()
        .update()
        .set({
          permission_kind: accessKey.permission_kind,
          created_by_receipt_id: accessKey.created_by_receipt_id,
          deleted_by_receipt_id: null,
          last_update_block_height: accessKey.last_update_block_height,
        })
        .where('public_key = :publicKey', {
          public_key: accessKey.public_key,
        })
        .where('account_id = :accountId', {
          accountId: accessKey.account_id,
        })
        .andWhere('deleted_by_receipt_id is not null')
        .andWhere('last_update_block_height < :height', {
          height: accessKey.last_update_block_height,
        })
        .execute();

      this.logger.info(
        `Updated access key: %s for account: %s (%s)`,
        accessKey.public_key,
        accessKey.account_id,
        accessKey.created_by_receipt_id,
      );

      return result;
    }
  }

  private async deleteAccessKey(accessKey: DeepPartial<AccessKey>) {
    const result = await this.repository
      .createQueryBuilder()
      .update()
      .set({
        deleted_by_receipt_id: accessKey.deleted_by_receipt_id,
        last_update_block_height: accessKey.last_update_block_height,
      })
      .where('public_key = :publicKey', {
        public_key: accessKey.public_key,
      })
      .where('account_id = :accountId', {
        accountId: accessKey.account_id,
      })
      .andWhere('deleted_by_receipt_id is null')
      .andWhere('last_update_block_height < :height', {
        height: accessKey.last_update_block_height,
      })
      .execute();

    this.logger.info(
      `Deleted access key: %s for account: %s (%s)`,
      accessKey.public_key,
      accessKey.account_id,
      accessKey.deleted_by_receipt_id,
    );

    return result;
  }

  private async deleteAccessKeys(accessKey: DeepPartial<AccessKey>) {
    const result = await this.repository
      .createQueryBuilder()
      .update()
      .set({
        deleted_by_receipt_id: accessKey.deleted_by_receipt_id,
        last_update_block_height: accessKey.last_update_block_height,
      })
      .where('account_id = :accountId', {
        accountId: accessKey.account_id,
      })
      .andWhere('deleted_by_receipt_id is null')
      .andWhere('last_update_block_height < :height', {
        height: accessKey.last_update_block_height,
      })
      .execute();

    this.logger.info(
      `Deleted access keys for account: %s (%s)`,
      accessKey.account_id,
      accessKey.deleted_by_receipt_id,
    );

    return result;
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const receipts = this.executionOutcomeService
      .getSuccessfulReceiptActions(
        shards.flatMap((shard) => shard.receipt_execution_outcomes),
      )
      .filter((receipt) => this.shouldStore(receipt));

    const deleteAccessKeys = receipts.flatMap((receipt) => {
      const { actions } = (receipt.receipt as Near.ActionReceipt).Action;

      return actions.map(async (action) => {
        const actionKind = Near.parseKind<Near.Actions>(action);

        switch (actionKind) {
          case Near.Actions.DeleteKey: {
            const {
              DeleteKey: { public_key },
            } = action as Near.ActionDeleteKey;
            return this.deleteAccessKey({
              public_key,
              account_id: receipt.receiver_id,
              deleted_by_receipt_id: receipt.receipt_id,
              last_update_block_height: block.header.height,
            });
          }

          case Near.Actions.DeleteAccount: {
            return this.deleteAccessKeys({
              account_id: receipt.receiver_id,
              deleted_by_receipt_id: receipt.receipt_id,
              last_update_block_height: block.header.height,
            });
          }
        }
      });
    });

    const createOrUpdateAccessKeys = receipts.flatMap((receipt) => {
      const { actions } = (receipt.receipt as Near.ActionReceipt).Action;

      return actions.map(async (action) => {
        const actionKind = Near.parseKind<Near.Actions>(action);

        switch (actionKind) {
          case Near.Actions.AddKey: {
            const {
              AddKey: { public_key, access_key },
            } = action as Near.ActionAddKey;
            const permission = Near.parseKind<Near.Permissions>(
              access_key.permission,
            );
            return this.createOrUpdateAccessKey({
              public_key,
              account_id: receipt.receiver_id,
              created_by_receipt_id: receipt.receipt_id,
              permission_kind: PermissionType[permission],
              last_update_block_height: block.header.height,
            });
          }

          case Near.Actions.Transfer: {
            // check for implicit account ID
            if (receipt.receipt_id.length !== 64) {
              return;
            }
            const publicKey = Buffer.from(receipt.receiver_id, 'hex');
            if (publicKey.length !== 32) {
              return;
            }
            const publicKeyB64 = `ed25519:${publicKey.toString('base64')}`;
            return this.createOrUpdateAccessKey({
              public_key: publicKeyB64,
              account_id: receipt.receiver_id,
              created_by_receipt_id: receipt.receipt_id,
              permission_kind: PermissionType.FullAccess,
              last_update_block_height: block.header.height,
            });
          }
        }
      });
    });

    const deleteResults = await Promise.all(deleteAccessKeys);
    const createOrUpdateResults = await Promise.all(createOrUpdateAccessKeys);

    return { deleteResults, createOrUpdateResults };
  }

  shouldStore(receipt: Near.Receipt) {
    return matchAccounts(receipt.receiver_id, this.config.TRACK_ACCOUNTS);
  }
}
