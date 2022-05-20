import { Repository } from 'typeorm';
import * as Near from '../near';
import { AppDataSource } from '../data-source';
import { Transaction } from '../entities';
import { ExecutionOutcomeStatus, ExecutionOutcomeStatusKey } from '../near';

class TransactionService {
  constructor(
    private readonly repository: Repository<Transaction> = AppDataSource.getRepository(
      Transaction,
    ),
  ) {}

  fromJSON(
    blockHash: string,
    blockTimestamp: number,
    chunkHash: string,
    indexInChunk: number,
    transaction: Near.TransactionWithOutcome,
  ) {
    const status = Object.keys(
      transaction.outcome.execution_outcome.outcome.status,
    )
      .map(
        (status) => ExecutionOutcomeStatus[status as ExecutionOutcomeStatusKey],
      )
      .shift();

    return this.repository.create({
      transaction_hash: transaction.transaction.hash,
      block: { block_hash: blockHash },
      chunk: { chunk_hash: chunkHash },
      index_in_chunk: indexInChunk,
      block_timestamp: BigInt(blockTimestamp),
      signer_account_id: transaction.transaction.signer_id,
      signer_public_key: transaction.transaction.public_key,
      nonce: transaction.transaction.nonce,
      receiver_account_id: transaction.transaction.receiver_id,
      signature: transaction.transaction.signature,
      status,
      converted_into_receipt_id:
        transaction.outcome.execution_outcome.outcome.receipt_ids[0],
      receipt_conversion_gas_burnt: BigInt(
        transaction.outcome.execution_outcome.outcome.gas_burnt,
      ),
      receipt_conversion_tokens_burnt: BigInt(
        transaction.outcome.execution_outcome.outcome.tokens_burnt,
      ),
    });
  }

  store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .map((shard) => shard.chunk)
      .filter((chunk) => chunk)
      .map((chunk, chunkIndex) =>
        chunk.transactions.map((transaction) =>
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
}

export const transactionsService = new TransactionService();
