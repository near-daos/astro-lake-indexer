import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { ActionKind, TransactionAction } from '../entities';

class TransactionActionService {
  constructor(
    private readonly repository: Repository<TransactionAction> = AppDataSource.getRepository(
      TransactionAction,
    ),
  ) {}

  fromJSON(
    transactionHash: string,
    indexInTransaction: number,
    action: Near.Action,
  ) {
    const { actionKind, actionArgs } = Near.parseAction(action);

    return this.repository.create({
      transaction_hash: transactionHash,
      index_in_transaction: indexInTransaction,
      action_kind: ActionKind[actionKind],
      args: actionArgs,
    });
  }
}

export const transactionActionService = new TransactionActionService();
