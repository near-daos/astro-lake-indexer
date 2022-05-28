import { Repository } from 'typeorm';
import { receiptsCacheService } from './receipts-cache.service';
import { TransactionActionService } from './transaction-action.service';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Transaction, TransactionStatus } from '../entities';
import { matchAccounts } from '../utils';
import config from '../config';

export class TransactionService {
  private readonly repository: Repository<Transaction>;
  private readonly transactionActionService: TransactionActionService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(Transaction);
    this.transactionActionService = new TransactionActionService(manager);
  }

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

  // cache parent transaction hash for the future receipts
  cacheTransactionHashesForReceipts(shards: Near.Shard[]) {
    shards
      .filter((shard) => shard.chunk)
      .forEach((shard) => {
        shard.chunk.transactions.forEach((transaction) => {
          receiptsCacheService.set(
            transaction.outcome.execution_outcome.outcome.receipt_ids[0],
            transaction.transaction.hash,
          );
        });
      });
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .map((shard) => shard.chunk)
      .filter((chunk) => chunk)
      .map((chunk, chunkIndex) =>
        chunk.transactions
          .filter((transaction) => this.shouldStore(transaction))
          .map((transaction) =>
            this.fromJSON(
              block.header.hash,
              block.header.timestamp,
              chunk.header.chunk_hash,
              chunkIndex,
              transaction,
            ),
          ),
      )
      .flat();

    return this.repository.save(entities);
  }

  shouldStore(tx: Near.TransactionWithOutcome) {
    return (
      matchAccounts(tx.transaction.receiver_id, config.TRACK_ACCOUNTS) ||
      matchAccounts(tx.transaction.signer_id, config.TRACK_ACCOUNTS)
    );
  }

  async findTransactionHashByReceiptId(receiptId: string) {
    const transaction = await this.repository.findOneBy({
      converted_into_receipt_id: receiptId,
    });
    return transaction?.transaction_hash;
  }
}
