import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import {
  PermissionTypeEnum,
  TransactionAction,
  TransactionActionEnum,
} from '../entities';

class TransactionActionService {
  constructor(
    private readonly repository: Repository<TransactionAction> = AppDataSource.getRepository(
      TransactionAction,
    ),
  ) {}

  fromJSON(
    transactionHash: string,
    indexInTransaction: number,
    action: Near.ActionKindType,
  ) {
    const actionKind = Near.parseKind<Near.ActionKind>(action);

    let actionArgs: Record<string, unknown> | undefined;

    switch (actionKind) {
      case Near.ActionKind.CreateAccount: {
        actionArgs = {};
        break;
      }

      case Near.ActionKind.DeployContract: {
        const {
          DeployContract: { code },
        } = action as Near.ActionKindDeployContract;
        actionArgs = {
          code_sha256: Buffer.from(code, 'base64').toString('hex'),
        };
        break;
      }

      case Near.ActionKind.FunctionCall: {
        const {
          FunctionCall: { method_name, args, gas, deposit },
        } = action as Near.ActionKindFunctionCall;
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

      case Near.ActionKind.Transfer: {
        const {
          Transfer: { deposit },
        } = action as Near.ActionKindTransfer;
        actionArgs = {
          deposit,
        };
        break;
      }

      case Near.ActionKind.Stake: {
        const {
          Stake: { stake, public_key },
        } = action as Near.ActionKindStake;
        actionArgs = {
          stake,
          public_key,
        };
        break;
      }

      case Near.ActionKind.AddKey: {
        const {
          AddKey: {
            public_key,
            access_key: { nonce, permission },
          },
        } = action as Near.ActionKindAddKey;

        const permissionKind = Near.parseKind<Near.PermissionKind>(permission);

        switch (permissionKind) {
          case Near.PermissionKind.FullAccess: {
            actionArgs = {
              public_key,
              access_key: {
                nonce,
                permission: {
                  permission_type: PermissionTypeEnum.FullAccess,
                },
              },
            };
            break;
          }

          case Near.PermissionKind.FunctionCall: {
            const {
              FunctionCall: { allowance, method_names, receiver_id },
            } = permission as Near.PermissionKindFunctionCall;
            actionArgs = {
              public_key,
              access_key: {
                nonce,
                permission: {
                  permission_type: PermissionTypeEnum.FunctionCall,
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

      case Near.ActionKind.DeleteKey: {
        const {
          DeleteKey: { public_key },
        } = action as Near.ActionKindDeleteKey;
        actionArgs = {
          public_key,
        };
        break;
      }

      case Near.ActionKind.DeleteAccount: {
        const {
          DeleteAccount: { beneficiary_id },
        } = action as Near.ActionKindDeleteAccount;
        actionArgs = {
          beneficiary_id,
        };
        break;
      }
    }

    return this.repository.create({
      transaction_hash: transactionHash,
      index_in_transaction: indexInTransaction,
      action_kind: TransactionActionEnum[actionKind],
      args: actionArgs,
    });
  }
}

export const transactionActionService = new TransactionActionService();
