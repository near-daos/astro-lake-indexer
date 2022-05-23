import { Amount } from './types';

export interface AccessKey {
  nonce: number;
  permission: Permission;
}

export enum Permissions {
  FullAccess = 'FullAccess',
  FunctionCall = 'FunctionCall',
}

export interface PermissionFunctionCall {
  [Permissions.FunctionCall]: {
    allowance: Amount;
    receiver_id: string;
    method_names: string[];
  };
}

export type Permission = Permissions.FullAccess | PermissionFunctionCall;
