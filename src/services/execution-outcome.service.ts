import { Repository } from 'typeorm';
import { ExecutionOutcomeReceiptService } from './execution-outcome-receipt.service';
import { FtEventService } from './ft-event.service';
import { NftEventService } from './nft-event.service';
import { ReceiptService } from './receipt.service';
import { AppDataSource } from '../data-source';
import { ExecutionOutcome, ExecutionStatus } from '../entities';
import * as Near from '../near';

export class ExecutionOutcomeService {
  private readonly repository: Repository<ExecutionOutcome>;
  private readonly receiptService: ReceiptService;
  private readonly executionOutcomeReceiptService: ExecutionOutcomeReceiptService;
  private readonly ftEventService: FtEventService;
  private readonly nftEventService: NftEventService;

  constructor(private readonly manager = AppDataSource.manager) {
    this.repository = manager.getRepository(ExecutionOutcome);
    this.receiptService = new ReceiptService(manager);
    this.executionOutcomeReceiptService = new ExecutionOutcomeReceiptService(
      manager,
    );
    this.ftEventService = new FtEventService(manager);
    this.nftEventService = new NftEventService(manager);
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

  async save(entity: ExecutionOutcome[]) {
    return this.repository.save(entity);
  }

  shouldStore(outcome: Near.ExecutionOutcomeWithReceipt) {
    const events = outcome.execution_outcome.outcome.logs.map(
      Near.parseLogEvent,
    );
    return events.some(Near.isNEP141Event) || events.some(Near.isNEP171Event);
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
