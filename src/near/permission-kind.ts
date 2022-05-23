import { Amount } from './types';

export enum PermissionKind {
  FullAccess = 'FullAccess',
  FunctionCall = 'FunctionCall',
}

export interface PermissionKindFunctionCall {
  [PermissionKind.FunctionCall]: {
    allowance: Amount;
    receiver_id: string;
    method_names: string[];
  };
}

export type PermissionKindType =
  | PermissionKind.FullAccess
  | PermissionKindFunctionCall;
