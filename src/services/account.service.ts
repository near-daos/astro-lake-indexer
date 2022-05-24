import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Account } from '../entities';

class AccountService {
  constructor(
    private readonly repository: Repository<Account> = AppDataSource.getRepository(
      Account,
    ),
  ) {}

  async handle(block: Near.Block, shards: Near.Shard[]) {
    const receipts = shards
      .map((shard) => shard.receipt_execution_outcomes)
      .flat()
      .filter((outcome) => {
        const status = Near.parseKind<Near.ExecutionStatuses>(
          outcome.execution_outcome.outcome.status,
        );
        return [
          Near.ExecutionStatuses.SuccessReceiptId,
          Near.ExecutionStatuses.SuccessValue,
        ].includes(status);
      })
      .map((outcome) => outcome.receipt);

    const actions = receipts
      .filter((receipt) => {
        const kind = Near.parseKind<Near.ReceiptTypes>(receipt.receipt);
        return kind === Near.ReceiptTypes.Action;
      })
      .map(async (receipt) => {
        const actionReceipt = (receipt.receipt as Near.ActionReceipt).Action;

        for (const action of actionReceipt.actions) {
          const actionKind = Near.parseKind<Near.Actions>(action);

          switch (actionKind) {
            case Near.Actions.CreateAccount: {
              return this.repository.save({
                account_id: receipt.receiver_id,
                created_by_receipt_id: receipt.receipt_id,
                last_update_block_height: block.header.height,
              });
            }

            case Near.Actions.Transfer: {
              // check for implicit account ID
              if (
                receipt.receipt_id.length !== 64 ||
                Buffer.from(receipt.receiver_id, 'hex').length !== 32
              ) {
                return;
              }
              return this.repository.save({
                account_id: receipt.receiver_id,
                created_by_receipt_id: receipt.receipt_id,
                last_update_block_height: block.header.height,
              });
            }

            case Near.Actions.DeleteAccount: {
              return this.repository.upsert(
                {
                  account_id: receipt.receiver_id,
                  deleted_by_receipt_id: receipt.receipt_id,
                  last_update_block_height: block.header.height,
                },
                ['account_id'],
              );
            }
          }
        }
      });

    return Promise.all(actions);
  }
}

export const accountService = new AccountService();
