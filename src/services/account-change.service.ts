import { Logger } from 'log4js';
import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Config } from '../config';
import { InjectLogger, InjectRepository } from '../decorators';
import { AccountChange, AccountChangeReason } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

@Service()
export class AccountChangeService {
  constructor(
    @InjectLogger('account-change-service')
    private readonly logger: Logger,
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

  async insertIgnore(entities: AccountChange[]) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<AccountChange>[])
      .orIgnore()
      .execute();
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .flatMap((shard) => shard.state_changes)
      .filter((stateChange) => this.shouldCount(stateChange))
      .map((stateChange, indexInBlock) => ({ stateChange, indexInBlock }))
      .filter(({ stateChange }) => this.shouldStore(stateChange))
      .map(({ stateChange, indexInBlock }) =>
        this.fromJSON(
          block.header.hash,
          block.header.timestamp,
          indexInBlock,
          stateChange,
        ),
      ) as AccountChange[];

    if (!entities.length) {
      return;
    }

    const result = await this.insertIgnore(entities);

    this.logger.info(
      'Stored account changes: %d (%s)',
      entities.length,
      entities.map((event) => event.affected_account_id).join(', '),
    );

    return result;
  }

  shouldCount(stateChange: Near.StateChange) {
    return [
      Near.StateChangeTypes.AccountUpdate,
      Near.StateChangeTypes.AccountDeletion,
    ].includes(stateChange.type);
  }

  shouldStore(stateChange: Near.StateChange) {
    return matchAccounts(
      stateChange.change.account_id,
      this.config.TRACK_ACCOUNTS,
    );
  }
}
