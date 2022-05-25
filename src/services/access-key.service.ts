import { Repository } from 'typeorm';
import { ExecutionOutcomeService } from './execution-outcome.service';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { AccessKey, PermissionType } from '../entities';
import { matchAccounts } from '../utils';
import config from '../config';

export class AccessKeyService {
  private readonly repository: Repository<AccessKey>;
  private readonly executionOutcomeService: ExecutionOutcomeService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(AccessKey);
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
            case Near.Actions.AddKey: {
              const {
                AddKey: { public_key, access_key },
              } = action as Near.ActionAddKey;
              const permission = Near.parseKind<Near.Permissions>(
                access_key.permission,
              );
              return this.repository.insert({
                public_key,
                account_id: receipt.receiver_id,
                created_by_receipt_id: receipt.receipt_id,
                permission_kind: PermissionType[permission],
                last_update_block_height: block.header.height,
              });
            }

            case Near.Actions.DeleteKey: {
              const {
                DeleteKey: { public_key },
              } = action as Near.ActionDeleteKey;
              return this.repository.upsert(
                {
                  public_key,
                  account_id: receipt.receiver_id,
                  deleted_by_receipt_id: receipt.receipt_id,
                  last_update_block_height: block.header.height,
                },
                ['public_key', 'account_id'],
              );
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
              return this.repository.insert({
                public_key: `ed25519:${publicKey.toString('base64')}`,
                account_id: receipt.receiver_id,
                created_by_receipt_id: receipt.receipt_id,
                permission_kind: PermissionType.FullAccess,
                last_update_block_height: block.header.height,
              });
            }

            case Near.Actions.DeleteAccount: {
              return this.repository.update(
                {
                  account_id: receipt.receiver_id,
                },
                {
                  deleted_by_receipt_id: receipt.receipt_id,
                  last_update_block_height: block.header.height,
                },
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
