import { Amount } from './types';
import { PermissionKindType } from './permission-kind';

export enum ActionKind {
  CreateAccount = 'CreateAccount',
  DeployContract = 'DeployContract',
  FunctionCall = 'FunctionCall',
  Transfer = 'Transfer',
  Stake = 'Stake',
  AddKey = 'AddKey',
  DeleteKey = 'DeleteKey',
  DeleteAccount = 'DeleteAccount',
}

export interface ActionKindDeployContract {
  [ActionKind.DeployContract]: {
    code: string;
  };
}

export interface ActionKindFunctionCall {
  [ActionKind.FunctionCall]: {
    method_name: string;
    args: string;
    gas: Amount;
    deposit: string;
  };
}

export interface ActionKindTransfer {
  [ActionKind.Transfer]: {
    deposit: Amount;
  };
}

export interface ActionKindStake {
  [ActionKind.Stake]: {
    stake: string;
    public_key: string;
  };
}

export interface ActionKindAddKey {
  [ActionKind.AddKey]: {
    public_key: string;
    access_key: {
      nonce: number;
      permission: PermissionKindType;
    };
  };
}

export interface ActionKindDeleteKey {
  [ActionKind.DeleteKey]: {
    public_key: string;
  };
}

export interface ActionKindDeleteAccount {
  [ActionKind.DeleteAccount]: {
    beneficiary_id: string;
  };
}

export type ActionKindType =
  | ActionKind.CreateAccount
  | ActionKindDeployContract
  | ActionKindFunctionCall
  | ActionKindTransfer
  | ActionKindStake
  | ActionKindAddKey
  | ActionKindDeleteKey
  | ActionKindDeleteAccount;
