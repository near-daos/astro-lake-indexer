export enum ExecutionStatuses {
  Unknown = 'Unknown',
  Failure = 'Failure',
  SuccessValue = 'SuccessValue',
  SuccessReceiptId = 'SuccessReceiptId',
}

export interface ExecutionStatusSuccessValue {
  [ExecutionStatuses.SuccessValue]: string;
}

export interface ExecutionStatusSuccessReceiptId {
  [ExecutionStatuses.SuccessReceiptId]: string;
}

export type ExecutionStatus =
  | ExecutionStatuses.Unknown
  | ExecutionStatuses.Failure
  | ExecutionStatusSuccessValue
  | ExecutionStatusSuccessReceiptId;
