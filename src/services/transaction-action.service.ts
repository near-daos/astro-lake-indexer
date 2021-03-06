import { Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { InjectRepository } from '../decorators';
import { ActionKind, TransactionAction } from '../entities';
import * as Near from '../near';

@Service()
export class TransactionActionService {
  constructor(
    @InjectRepository(TransactionAction)
    private readonly repository: Repository<TransactionAction>,
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

  async insertIgnore(entities: TransactionAction[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<TransactionAction>[])
      .orIgnore()
      .execute();
  }
}
