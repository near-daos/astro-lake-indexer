import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropActionReceiptActionsAmountIndex1656660876937
  implements MigrationInterface
{
  name = 'DropActionReceiptActionsAmountIndex1656660876937';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX action_receipt_actions_args_amount_idx`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX action_receipt_actions_args_amount_idx ON action_receipt_actions((args->'args_json'->>'amount')) WHERE action_receipt_actions.action_kind = 'FUNCTION_CALL' AND (action_receipt_actions.args->>'args_json') IS NOT NULL`,
    );
  }
}
