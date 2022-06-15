import { Inject, Service } from 'typedi';
import { EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Config } from '../config';
import { InjectRepository } from '../decorators';
import { AccountChange, AccountChangeReason } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

@Service()
export class AccountChangeService {
  constructor(
    @Inject()
    private readonly config: Config,
    @InjectRepository(AccountChange)
    private readonly repository: Repository<AccountChange>,
  ) {}

  fromJSON(
    blockHash: string,
    blockTimestamp: bigint,
    indexInBlock: number,
    stateChange: Near.StateChange,
  ) {
    let account: Near.Account | undefined;
    let transactionHash: string | undefined;
    let receiptId: string | undefined;

    switch (stateChange.cause.type) {
      case Near.StateChangeCauseTypes.TransactionProcessing:
        transactionHash = stateChange.cause.tx_hash;
        break;

      case Near.StateChangeCauseTypes.ActionReceiptProcessingStarted:
      case Near.StateChangeCauseTypes.ActionReceiptGasReward:
      case Near.StateChangeCauseTypes.ReceiptProcessing:
      case Near.StateChangeCauseTypes.PostponedReceipt:
        receiptId = stateChange.cause.receipt_hash;
        break;
    }

    switch (stateChange.type) {
      case Near.StateChangeTypes.AccountUpdate:
        account = stateChange.change as Near.Account;
        break;

      case Near.StateChangeTypes.AccountDeletion:
        break;

      default:
        return;
    }

    const reason = Object.keys(Near.StateChangeCauseTypes)[
      Object.values(Near.StateChangeCauseTypes).indexOf(stateChange.cause.type)
    ];

    return this.repository.create({
      affected_account_id: stateChange.change.account_id,
      changed_in_block_timestamp: blockTimestamp,
      changed_in_block_hash: blockHash,
      caused_by_transaction_hash: transactionHash,
      caused_by_receipt_id: receiptId,
      update_reason:
        AccountChangeReason[reason as keyof typeof AccountChangeReason],
      affected_account_nonstaked_balance: BigInt(account?.amount || 0),
      affected_account_staked_balance: BigInt(account?.locked || 0),
      affected_account_storage_usage: BigInt(account?.storage_usage || 0),
      index_in_block: indexInBlock,
    });
  }

  async insert(manager: EntityManager, entities: AccountChange[]) {
    return manager
      .createQueryBuilder()
      .insert()
      .into(AccountChange)
      .values(entities as QueryDeepPartialEntity<AccountChange>[])
      .orIgnore()
      .execute();
  }

  async store(manager: EntityManager, block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .flatMap((shard) =>
        shard.state_changes
          .filter((stateChange) => this.shouldStore(stateChange))
          .map((stateChange, index) =>
            this.fromJSON(
              block.header.hash,
              block.header.timestamp,
              index,
              stateChange,
            ),
          ),
      )
      .filter(Boolean) as AccountChange[];

    if (!entities.length) {
      return;
    }

    return this.insert(manager, entities);
  }

  shouldStore(stateChange: Near.StateChange) {
    return matchAccounts(
      stateChange.change.account_id,
      this.config.TRACK_ACCOUNTS,
    );
  }
}
