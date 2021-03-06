export enum ActionKind {
  CreateAccount = 'CREATE_ACCOUNT',
  DeployContract = 'DEPLOY_CONTRACT',
  FunctionCall = 'FUNCTION_CALL',
  Transfer = 'TRANSFER',
  Stake = 'STAKE',
  AddKey = 'ADD_KEY',
  DeleteKey = 'DELETE_KEY',
  DeleteAccount = 'DELETE_ACCOUNT',
}

export enum PermissionType {
  FullAccess = 'FULL_ACCESS',
  FunctionCall = 'FUNCTION_CALL',
}

export enum ReceiptKind {
  Action = 'ACTION',
  Data = 'DATA',
}

export enum ExecutionStatus {
  Unknown = 'UNKNOWN',
  Failure = 'FAILURE',
  SuccessValue = 'SUCCESS_VALUE',
  SuccessReceiptId = 'SUCCESS_RECEIPT_ID',
}

export enum AccountChangeReason {
  TransactionProcessing = 'TRANSACTION_PROCESSING',
  ActionReceiptProcessingStarted = 'ACTION_RECEIPT_PROCESSING_STARTED',
  ActionReceiptGasReward = 'ACTION_RECEIPT_GAS_REWARD',
  ReceiptProcessing = 'RECEIPT_PROCESSING',
  PostponedReceipt = 'POSTPONED_RECEIPT',
  UpdatedDelayedReceipts = 'UPDATED_DELAYED_RECEIPTS',
  ValidatorAccountsUpdate = 'VALIDATOR_ACCOUNTS_UPDATE',
  Migration = 'MIGRATION',
}

export enum TransactionStatus {
  Unknown = 'UNKNOWN',
  Failure = 'FAILURE',
  SuccessValue = 'SUCCESS_VALUE',
  SuccessReceiptId = 'SUCCESS_RECEIPT_ID',
}

export enum FtEventKind {
  Mint = 'MINT',
  Transfer = 'TRANSFER',
  Burn = 'BURN',
}

export enum NftEventKind {
  Mint = 'MINT',
  Transfer = 'TRANSFER',
  Burn = 'BURN',
}
