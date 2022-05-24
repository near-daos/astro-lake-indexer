import { Account } from './types';

export enum StateChangeCauseTypes {
  TransactionProcessing = 'transaction_processing',
  ActionReceiptProcessingStarted = 'action_receipt_processing_started',
  ActionReceiptGasReward = 'action_receipt_gas_reward',
  ReceiptProcessing = 'receipt_processing',
  PostponedReceipt = 'postponed_receipt',
  UpdatedDelayedReceipts = 'updated_delayed_receipts',
  ValidatorAccountsUpdate = 'validator_accounts_update',
  Migration = 'migration',
}

export interface StateChangeCauseTransactionProcessing {
  tx_hash: string;
  type: StateChangeCauseTypes.TransactionProcessing;
}

export interface StateChangeCauseActionReceiptProcessingStarted {
  receipt_hash: string;
  type: StateChangeCauseTypes.ActionReceiptProcessingStarted;
}

export interface StateChangeCauseActionReceiptGasReward {
  receipt_hash: string;
  type: StateChangeCauseTypes.ActionReceiptGasReward;
}

export interface StateChangeCauseReceiptProcessing {
  receipt_hash: string;
  type: StateChangeCauseTypes.ReceiptProcessing;
}

export interface StateChangeCausePostponedReceipt {
  receipt_hash: string;
  type: StateChangeCauseTypes.PostponedReceipt;
}

export interface StateChangeCauseUpdatedDelayedReceipts {
  type: StateChangeCauseTypes.UpdatedDelayedReceipts;
}

export interface StateChangeCauseValidatorAccountsUpdate {
  type: StateChangeCauseTypes.ValidatorAccountsUpdate;
}

export interface StateChangeCauseValidatorMigration {
  type: StateChangeCauseTypes.Migration;
}

export type StateChangeCause =
  | StateChangeCauseTransactionProcessing
  | StateChangeCauseActionReceiptProcessingStarted
  | StateChangeCauseActionReceiptGasReward
  | StateChangeCauseReceiptProcessing
  | StateChangeCausePostponedReceipt
  | StateChangeCauseUpdatedDelayedReceipts
  | StateChangeCauseValidatorAccountsUpdate
  | StateChangeCauseValidatorMigration;

export enum StateChangeTypes {
  AccountUpdate = 'account_update',
  AccountDeletion = 'account_deletion',
  AccessKeyUpdate = 'access_key_update',
  AccessKeyDeletion = 'access_key_deletion',
  DataUpdate = 'data_update',
  DataDeletion = 'data_deletion',
  ContractCodeUpdate = 'contract_code_update',
  ContractCodeDeletion = 'contract_code_deletion',
}

export interface StateChangeChangeAccountUpdate extends Account {
  account_id: string;
}

export interface StateChangeChangeAccountDeletion {
  account_id: string;
}

export interface StateChangeChangeAccessKeyUpdate {
  account_id: string;
  public_key: string;
  access_key: string;
}

export interface StateChangeChangeAccessKeyDeletion {
  account_id: string;
  public_key: string;
}

export interface StateChangeChangeDataUpdate {
  account_id: string;
  key_base64: string;
  value_base64: string;
}

export interface StateChangeChangeDataDeletion {
  account_id: string;
  key_base64: string;
}

export interface StateChangeChangeContractCodeUpdate {
  account_id: string;
  code: string;
}

export interface StateChangeChangeContractCodeDeletion {
  account_id: string;
}

export type StateChangeChange =
  | StateChangeChangeAccountUpdate
  | StateChangeChangeAccountDeletion
  | StateChangeChangeAccessKeyUpdate
  | StateChangeChangeAccessKeyDeletion
  | StateChangeChangeDataUpdate
  | StateChangeChangeDataDeletion
  | StateChangeChangeContractCodeUpdate
  | StateChangeChangeContractCodeDeletion;

export interface StateChange {
  cause: StateChangeCause;
  change: StateChangeChange;
  type: StateChangeTypes;
}
