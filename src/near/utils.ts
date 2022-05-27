import * as Near from './index';
import { Event, EventStandards, NEP141Event, NEP171Event } from './event';
import { PermissionType } from '../entities';

export const parseKind = <T extends string>(kind: object | string) => {
  if (typeof kind === 'object') {
    const [actionKind] = Object.keys(kind) as T[];
    return actionKind;
  } else {
    return kind as T;
  }
};

export const parseAction = (action: Near.Action) => {
  const actionKind = parseKind<Near.Actions>(action);
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

  return { actionKind, actionArgs };
};

export const parseLogEvent = (log: string): Event | undefined => {
  if (log.indexOf(Near.EVENT_PREFIX) !== 0) {
    return;
  }

  let data;

  try {
    data = JSON.parse(log.substring(Near.EVENT_PREFIX.length)) as Event;
  } catch (err) {
    return;
  }

  switch (data.standard) {
    case EventStandards.NEP141:
      return data as NEP141Event;

    case EventStandards.NEP171:
      return data as NEP171Event;
  }
};
