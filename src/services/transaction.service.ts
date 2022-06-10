import { Inject, Service } from 'typedi';
import { EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TransactionActionService } from './transaction-action.service';
import { Config } from '../config';
import { InjectRepository } from '../decorators';
import { Transaction, TransactionStatus } from '../entities';
import { jsonMatchAccounts, matchAccounts } from '../utils';
import * as Near from '../near';

@Service()
export class TransactionService {
  constructor(
    @Inject()
    private readonly config: Config,
    @InjectRepository(Transaction)
    private readonly repository: Repository<Transaction>,
    @Inject()
    private readonly transactionActionService: TransactionActionService,
  ) {}

  fromJSON(
    blockHash: string,
    blockTimestamp: bigint,
    chunkHash: string,
    indexInChunk: number,
    transaction: Near.TransactionWithOutcome,
  ) {
    const status = Near.parseKind<Near.ExecutionStatuses>(
      transaction.outcome.execution_outcome.outcome.status,
    );

    return this.repository.create({
      transaction_hash: transaction.transaction.hash,
      included_in_block_hash: blockHash,
      included_in_chunk_hash: chunkHash,
      index_in_chunk: indexInChunk,
      block_timestamp: blockTimestamp,
      signer_account_id: transaction.transaction.signer_id,
      signer_public_key: transaction.transaction.public_key,
      nonce: transaction.transaction.nonce,
      receiver_account_id: transaction.transaction.receiver_id,
      signature: transaction.transaction.signature,
      status: TransactionStatus[status],
      converted_into_receipt_id:
        transaction.outcome.execution_outcome.outcome.receipt_ids[0],
      receipt_conversion_gas_burnt:
        transaction.outcome.execution_outcome.outcome.gas_burnt,
      receipt_conversion_tokens_burnt: BigInt(
        transaction.outcome.execution_outcome.outcome.tokens_burnt,
      ),
      actions: transaction.transaction.actions.map((action, index) =>
        this.transactionActionService.fromJSON(
          transaction.transaction.hash,
          index,
          action,
        ),
      ),
    });
  }

  async insert(manager: EntityManager, entities: Transaction[]) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(Transaction)
      .values(entities as QueryDeepPartialEntity<Transaction>[])
      .orIgnore()
      .execute();

    const actions = entities.map((entity) => entity.actions).flat();

    await this.transactionActionService.insert(manager, actions);
  }

  shouldStore(tx: Near.TransactionWithOutcome) {
    // store if receiver or signer is tracked account
    if (
      matchAccounts(tx.transaction.receiver_id, this.config.TRACK_ACCOUNTS) ||
      matchAccounts(tx.transaction.signer_id, this.config.TRACK_ACCOUNTS)
    ) {
      return true;
    }

    // store if some action args contains tracked account
    return tx.transaction.actions.some((action) => {
      const { actionArgs } = Near.parseAction(action);
      return jsonMatchAccounts(actionArgs, this.config.TRACK_ACCOUNTS);
    });
  }
}
