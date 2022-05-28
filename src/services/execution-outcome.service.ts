import { Repository } from 'typeorm';
import { ExecutionOutcomeReceiptService } from './execution-outcome-receipt.service';
import { receiptsCacheService } from './receipts-cache.service';
import { AppDataSource } from '../data-source';
import { ExecutionOutcome, ExecutionStatus } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';
import config from '../config';

export class ExecutionOutcomeService {
  private readonly repository: Repository<ExecutionOutcome>;
  private readonly executionOutcomeReceiptService: ExecutionOutcomeReceiptService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(ExecutionOutcome);
    this.executionOutcomeReceiptService = new ExecutionOutcomeReceiptService(
      manager,
    );
  }

  fromJSON(
    blockHash: string,
    blockTimestamp: bigint,
    shardId: number,
    indexInChunk: number,
    outcome: Near.ExecutionOutcomeWithReceipt,
  ) {
    const status = Near.parseKind<Near.ExecutionStatuses>(
      outcome.execution_outcome.outcome.status,
    );
    return this.repository.create({
      receipt_id: outcome.execution_outcome.id,
      executed_in_block_hash: blockHash,
      executed_in_block_timestamp: blockTimestamp,
      index_in_chunk: indexInChunk,
      gas_burnt: outcome.execution_outcome.outcome.gas_burnt,
      tokens_burnt: BigInt(outcome.execution_outcome.outcome.tokens_burnt),
      executor_account_id: outcome.execution_outcome.outcome.executor_id,
      status: ExecutionStatus[status],
      shard_id: shardId,
      receipts: outcome.execution_outcome.outcome.receipt_ids.map(
        (receiptId, index) =>
          this.executionOutcomeReceiptService.fromJSON(
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
        const transactionHash = receiptsCacheService.get(
          outcome.execution_outcome.id,
        );

        if (!transactionHash) {
          return;
        }

        outcome.execution_outcome.outcome.receipt_ids.forEach((receiptId) => {
          receiptsCacheService.set(receiptId, transactionHash);
        });
      });
    });
  }

  async store(block: Near.Block, shards: Near.Shard[]) {
    const entities = shards
      .map((shard, shardIndex) =>
        shard.receipt_execution_outcomes
          .filter((outcome) => this.shouldStore(outcome))
          .map((outcome, outcomeIndex) =>
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

  shouldStore(outcome: Near.ExecutionOutcomeWithReceipt) {
    return matchAccounts(
      outcome.execution_outcome.outcome.executor_id,
      config.TRACK_ACCOUNTS,
    );
  }

  getSuccessfulReceipts(outcomes: Near.ExecutionOutcomeWithReceipt[]) {
    return outcomes
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
  }

  getSuccessfulReceiptActions(outcomes: Near.ExecutionOutcomeWithReceipt[]) {
    return this.getSuccessfulReceipts(outcomes).filter((receipt) => {
      return (
        Near.parseKind<Near.ReceiptTypes>(receipt.receipt) ===
        Near.ReceiptTypes.Action
      );
    });
  }
}
