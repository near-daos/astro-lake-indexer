import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { ExecutionOutcome, ExecutionStatus } from '../entities';
import * as Near from '../near';
import * as services from '../services';

class ExecutionOutcomeService {
  constructor(
    private readonly repository: Repository<ExecutionOutcome> = AppDataSource.getRepository(
      ExecutionOutcome,
    ),
  ) {}

  fromJSON(
    blockHash: string,
    blockTimestamp: number,
    shardId: number,
    indexInChunk: number,
    outcome: Near.ReceiptExecutionOutcome,
  ) {
    const status = Near.parseKind<Near.ExecutionStatuses>(
      outcome.execution_outcome.outcome.status,
    );
    return this.repository.create({
      receipt_id: outcome.execution_outcome.id,
      executed_in_block_hash: blockHash,
      executed_in_block_timestamp: BigInt(blockTimestamp),
      index_in_chunk: indexInChunk,
      gas_burnt: BigInt(outcome.execution_outcome.outcome.gas_burnt),
      tokens_burnt: BigInt(outcome.execution_outcome.outcome.tokens_burnt),
      executor_account_id: outcome.execution_outcome.outcome.executor_id,
      status: ExecutionStatus[status],
      shard_id: shardId,
      receipts: outcome.execution_outcome.outcome.receipt_ids.map(
        (receiptId, index) =>
          services.executionOutcomeReceiptService.fromJSON(
            outcome.execution_outcome.id,
            index,
            receiptId,
          ),
      ),
    });
  }

  // cache parent transaction hash for the produced receipts
  cacheTransactionHashesForReceipts(shards: Near.Shard[]) {
    shards.forEach((shard) => {
      shard.receipt_execution_outcomes.forEach((outcome) => {
        const transactionHash = services.receiptsCacheService.get(
          outcome.execution_outcome.id,
        );

        if (!transactionHash) {
          return;
        }

        outcome.execution_outcome.outcome.receipt_ids.forEach((receiptId) => {
          services.receiptsCacheService.set(receiptId, transactionHash);
        });
      });
    });
  }

  store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .map((shard, shardIndex) =>
        shard.receipt_execution_outcomes.map((outcome, outcomeIndex) =>
          this.fromJSON(
            block.header.hash,
            block.header.timestamp,
            shardIndex,
            outcomeIndex,
            outcome,
          ),
        ),
      )
      .flat();

    return this.repository.save(entities);
  }
}

export const executionOutcomeService = new ExecutionOutcomeService();
