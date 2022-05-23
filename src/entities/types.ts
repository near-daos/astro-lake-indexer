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
