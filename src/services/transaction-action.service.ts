import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { ActionKind, PermissionType, TransactionAction } from '../entities';

class TransactionActionService {
  constructor(
    private readonly repository: Repository<TransactionAction> = AppDataSource.getRepository(
      TransactionAction,
    ),
  ) {}

  fromJSON(
    transactionHash: string,
    indexInTransaction: number,
    action: Near.Action,
  ) {
    const actionKind = Near.parseKind<Near.Actions>(action);

    let actionArgs: Record<string, unknown> | undefined;

    switch (actionKind) {
      case Near.Actions.CreateAccount: {
        actionArgs = {};
        break;
      }

      case Near.Actions.DeployContract: {
        const {
          DeployContract: { code },
        } = action as Near.ActionDeployContract;
        actionArgs = {
          code_sha256: Buffer.from(code, 'base64').toString('hex'),
        };
        break;
      }

      case Near.Actions.FunctionCall: {
        const {
          FunctionCall: { method_name, args, gas, deposit },
        } = action as Near.ActionFunctionCall;
        actionArgs = {
          method_name,
          args_base64: args,
          gas,
          deposit,
        };
        try {
          actionArgs.args_json = JSON.parse(
            Buffer.from(args, 'base64').toString(),
          );
        } catch (err) {}
        break;
      }

      case Near.Actions.Transfer: {
        const {
          Transfer: { deposit },
        } = action as Near.ActionTransfer;
        actionArgs = {
          deposit,
        };
        break;
      }

      case Near.Actions.Stake: {
        const {
          Stake: { stake, public_key },
        } = action as Near.ActionStake;
        actionArgs = {
          stake,
          public_key,
        };
        break;
      }

      case Near.Actions.AddKey: {
        const {
          AddKey: {
            public_key,
            access_key: { nonce, permission },
          },
        } = action as Near.ActionAddKey;

        const permissionKind = Near.parseKind<Near.Permissions>(permission);

        switch (permissionKind) {
          case Near.Permissions.FullAccess: {
            actionArgs = {
              public_key,
              access_key: {
                nonce,
                permission: {
                  permission_type: PermissionType.FullAccess,
                },
              },
            };
            break;
          }

          case Near.Permissions.FunctionCall: {
            const {
              FunctionCall: { allowance, method_names, receiver_id },
            } = permission as Near.PermissionFunctionCall;
            actionArgs = {
              public_key,
              access_key: {
                nonce,
                permission: {
                  permission_type: PermissionType.FunctionCall,
                  permission_details: {
                    allowance,
                    method_names,
                    receiver_id,
                  },
                },
              },
            };
            break;
          }
        }
        break;
      }

      case Near.Actions.DeleteKey: {
        const {
          DeleteKey: { public_key },
        } = action as Near.ActionDeleteKey;
        actionArgs = {
          public_key,
        };
        break;
      }

      case Near.Actions.DeleteAccount: {
        const {
          DeleteAccount: { beneficiary_id },
        } = action as Near.ActionDeleteAccount;
        actionArgs = {
          beneficiary_id,
        };
        break;
      }
    }

    return this.repository.create({
      transaction_hash: transactionHash,
      index_in_transaction: indexInTransaction,
      action_kind: ActionKind[actionKind],
      args: actionArgs,
    });
  }
}

export const transactionActionService = new TransactionActionService();
