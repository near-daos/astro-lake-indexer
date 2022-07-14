import { Amount } from './types';
import { AccessKey } from './access-key';

export enum Actions {
  CreateAccount = 'CreateAccount',
  DeployContract = 'DeployContract',
  FunctionCall = 'FunctionCall',
  Transfer = 'Transfer',
  Stake = 'Stake',
  AddKey = 'AddKey',
  DeleteKey = 'DeleteKey',
  DeleteAccount = 'DeleteAccount',
}

export interface ActionDeployContract {
  [Actions.DeployContract]: {
    code: string;
  };
}

export interface ActionFunctionCall {
  [Actions.FunctionCall]: {
    method_name: string;
    args: string;
    gas: Amount;
    deposit: string;
  };
}

export interface ActionTransfer {
  [Actions.Transfer]: {
    deposit: Amount;
  };
}

export interface ActionStake {
  [Actions.Stake]: {
    stake: Amount;
    public_key: string;
  };
}

export interface ActionAddKey {
  [Actions.AddKey]: {
    public_key: string;
    access_key: AccessKey;
  };
}

export interface ActionDeleteKey {
  [Actions.DeleteKey]: {
    public_key: string;
  };
}

export interface ActionDeleteAccount {
  [Actions.DeleteAccount]: {
    beneficiary_id: string;
  };
}

export type Action =
  | Actions.CreateAccount
  | ActionDeployContract
  | ActionFunctionCall
  | ActionTransfer
  | ActionStake
  | ActionAddKey
  | ActionDeleteKey
  | ActionDeleteAccount;
