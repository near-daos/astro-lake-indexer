import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActionReceiptActionsIndices1653481681383
  implements MigrationInterface
{
  name = 'ActionReceiptActionsIndices1653481681383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`create index action_receipt_actions_args_function_call_idx
        on action_receipt_actions ((args ->> 'method_name'))
        where action_kind = 'FUNCTION_CALL'`);

    await queryRunner.query(`create index action_receipt_actions_args_amount_idx
        on action_receipt_actions ((args -> 'args_json' ->> 'amount'))
        where action_kind = 'FUNCTION_CALL' AND args ->> 'args_json' IS NOT NULL`);

    await queryRunner.query(`create index action_receipt_actions_args_receiver_id_idx
        on action_receipt_actions ((args -> 'args_json' ->> 'receiver_id'))
        where action_kind = 'FUNCTION_CALL' AND args ->> 'args_json' IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX action_receipt_actions_args_function_call_idx`,
    );
    await queryRunner.query(
      `DROP INDEX action_receipt_actions_args_amount_idx`,
    );
    await queryRunner.query(
      `DROP INDEX action_receipt_actions_args_receiver_id_idx`,
    );
  }
}
