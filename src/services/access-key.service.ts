import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { AccessKey, PermissionType } from '../entities';

class AccessKeyService {
  constructor(
    private readonly repository: Repository<AccessKey> = AppDataSource.getRepository(
      AccessKey,
    ),
  ) {}

  async handle(block: Near.Block, shards: Near.Shard[]) {
    const receipts = shards
      .map((shard) => shard.receipt_execution_outcomes)
      .flat()
      .filter((outcome) => {
        const status = Near.parseKind<Near.ExecutionStatuses>(
          outcome.execution_outcome.outcome.status,
        );
        return [
          Near.ExecutionStatuses.SuccessReceiptId,
          Near.ExecutionStatuses.SuccessValue,
        ].includes(status);
      })
      .map((outcome) => outcome.receipt);

    const actions = receipts
      .filter((receipt) => {
        const kind = Near.parseKind<Near.ReceiptTypes>(receipt.receipt);
        return kind === Near.ReceiptTypes.Action;
      })
      .map(async (receipt) => {
        const actionReceipt = (receipt.receipt as Near.ActionReceipt).Action;

        for (const action of actionReceipt.actions) {
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
}

export const accessKeyService = new AccessKeyService();
