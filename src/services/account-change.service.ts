import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { AccountChange, AccountChangeReason } from '../entities';
import { matchAccounts } from '../utils';
import config from '../config';

export class AccountChangeService {
  private readonly repository: Repository<AccountChange>;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(AccountChange);
  }

  fromJSON(
    blockHash: string,
    blockTimestamp: number,
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

    return {
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
    };
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const values = shards
      .map((shard) =>
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
      .flat()
      .filter(Boolean) as QueryDeepPartialEntity<AccountChange>;

    return this.repository
      .createQueryBuilder()
      .insert()
      .values(values)
      .orIgnore()
      .execute();
  }

  shouldStore(stateChange: Near.StateChange) {
    return matchAccounts(stateChange.change.account_id, config.TRACK_ACCOUNTS);
  }
}
