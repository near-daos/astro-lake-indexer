import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AppDataSource } from '../data-source';
import { ActionKind, TransactionAction } from '../entities';
import * as Near from '../near';

export class TransactionActionService {
  private readonly repository: Repository<TransactionAction>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(TransactionAction);
  }

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

  async insert(entities: TransactionAction[]) {
    return await this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<TransactionAction>[])
      .orIgnore()
      .execute();
  }
}
