import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ExecutionOutcomeReceiptService } from './execution-outcome-receipt.service';
import { ReceiptService } from './receipt.service';
import { Config } from '../config';
import { InjectRepository } from '../decorators';
import { ExecutionOutcome, ExecutionStatus } from '../entities';
import * as Near from '../near';
import { matchAccounts } from '../utils';

@Service()
export class ExecutionOutcomeService {
  constructor(
    @Inject()
    private readonly config: Config,
    @InjectRepository(ExecutionOutcome)
    private readonly repository: Repository<ExecutionOutcome>,
    @Inject()
    private readonly receiptService: ReceiptService,
    @Inject()
    private readonly executionOutcomeReceiptService: ExecutionOutcomeReceiptService,
  ) {}

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

  async insertIgnore(entities: ExecutionOutcome[]) {
    await this.repository
      .createQueryBuilder()
      .insert()
      .values(entities as QueryDeepPartialEntity<ExecutionOutcome>[])
      .orIgnore()
      .execute();

    const receipts = entities.flatMap((entity) => entity.receipts);

    return this.executionOutcomeReceiptService.insertIgnore(receipts);
  }

  shouldStore(outcome: Near.ExecutionOutcomeWithReceipt) {
    // store execution outcome for previous receipt
    if (this.receiptService.shouldStore(outcome.receipt)) {
      return true;
    }

    // store if some log entry contains tracked account
    return outcome.execution_outcome.outcome.logs.some((log) =>
      matchAccounts(log, this.config.TRACK_ACCOUNTS),
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
