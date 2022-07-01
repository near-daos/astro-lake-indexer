import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
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

  async insertIgnore(
    values:
      | QueryDeepPartialEntity<AccessKey>
      | QueryDeepPartialEntity<AccessKey>[],
  ) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(values)
      .orIgnore()
      .execute();
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const actions = this.executionOutcomeService
      .getSuccessfulReceiptActions(
        shards.flatMap((shard) => shard.receipt_execution_outcomes),
      )
      .filter((receipt) => this.shouldStore(receipt))
      .flatMap((receipt) => {
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
              const result = await this.insertIgnore({
                public_key,
                account_id: receipt.receiver_id,
                created_by_receipt_id: receipt.receipt_id,
                permission_kind: PermissionType[permission],
                last_update_block_height: block.header.height,
              });
              this.logger.info(
                'Added key (%s) for account: %s (%s)',
                public_key,
                receipt.receiver_id,
                receipt.receipt_id,
              );
              return result;
            }

            case Near.Actions.DeleteKey: {
              const {
                DeleteKey: { public_key },
              } = action as Near.ActionDeleteKey;
              const result = await this.repository.upsert(
                {
                  public_key,
                  account_id: receipt.receiver_id,
                  deleted_by_receipt_id: receipt.receipt_id,
                  last_update_block_height: block.header.height,
                },
                ['public_key', 'account_id'],
              );
              this.logger.info(
                'Deleted key (%s) for account: %s (%s)',
                public_key,
                receipt.receiver_id,
                receipt.receipt_id,
              );
              return result;
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
              const result = await this.insertIgnore({
                public_key: publicKeyB64,
                account_id: receipt.receiver_id,
                created_by_receipt_id: receipt.receipt_id,
                permission_kind: PermissionType.FullAccess,
                last_update_block_height: block.header.height,
              });
              this.logger.info(
                'Implicitly created account (%s) with public key: %s (%s)',
                receipt.receiver_id,
                publicKeyB64,
                receipt.receipt_id,
              );
              return result;
            }

            case Near.Actions.DeleteAccount: {
              const result = await this.repository.update(
                {
                  account_id: receipt.receiver_id,
                },
                {
                  deleted_by_receipt_id: receipt.receipt_id,
                  last_update_block_height: block.header.height,
                },
              );
              this.logger.info(
                'Deleted account: %s (%s)',
                receipt.receiver_id,
                receipt.receipt_id,
              );
              return result;
            }
          }
        });
      });

    return Promise.all(actions);
  }

  shouldStore(receipt: Near.Receipt) {
    return matchAccounts(receipt.receiver_id, this.config.TRACK_ACCOUNTS);
  }
}
