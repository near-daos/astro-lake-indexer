import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountChangesIndices1653480961354 implements MigrationInterface {
  name = 'AccountChangesIndices1653480961354';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create unique index account_changes_transaction_uni_idx
            on account_changes (affected_account_id, changed_in_block_hash, caused_by_transaction_hash, update_reason, affected_account_nonstaked_balance, affected_account_staked_balance, affected_account_storage_usage)
            where ((caused_by_transaction_hash IS NOT NULL) AND (caused_by_receipt_id IS NULL))`);
    await queryRunner.query(`create unique index account_changes_receipt_uni_idx
            on account_changes (affected_account_id, changed_in_block_hash, caused_by_receipt_id, update_reason, affected_account_nonstaked_balance, affected_account_staked_balance, affected_account_storage_usage)
            where ((caused_by_transaction_hash IS NULL) AND (caused_by_receipt_id IS NOT NULL))`);
    await queryRunner.query(`create unique index account_changes_null_uni_idx
            on account_changes (affected_account_id, changed_in_block_hash, update_reason, affected_account_nonstaked_balance, affected_account_staked_balance, affected_account_storage_usage)
            where ((caused_by_transaction_hash IS NULL) AND (caused_by_receipt_id IS NULL))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX account_changes_transaction_uni_idx`);
    await queryRunner.query(`DROP INDEX account_changes_receipt_uni_idx`);
    await queryRunner.query(`DROP INDEX account_changes_null_uni_idx`);
  }
}
