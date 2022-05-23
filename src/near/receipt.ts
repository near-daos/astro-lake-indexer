import { Amount } from './types';
import { Action } from './action';

export enum ReceiptTypes {
  Action = 'Action',
  Data = 'Data',
}

export interface ActionReceipt {
  [ReceiptTypes.Action]: {
    actions: Action[];
    gas_price: Amount;
    input_data_ids: string[];
    output_data_receivers: { data_id: string; receiver_id: string }[];
    signer_id: string;
    signer_public_key: string;
  };
}

export interface DataReceipt {
  [ReceiptTypes.Data]: {
    data_id: string;
    data: string;
  };
}

export type ActionOrDataReceipt = ActionReceipt | DataReceipt;

export interface Receipt {
  predecessor_id: string;
  receipt: ActionOrDataReceipt;
  receipt_id: string;
  receiver_id: string;
}
