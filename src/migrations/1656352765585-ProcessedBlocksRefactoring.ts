import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProcessedBlocksRefactoring1656352765585
  implements MigrationInterface
{
  name = 'ProcessedBlocksRefactoring1656352765585';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('processed_blocks')) {
      await queryRunner.query(
        `insert into last_block (block_height)
         select block_height
         from processed_blocks
         order by block_height desc
         limit 1;`,
      );
      await queryRunner.dropTable('processed_blocks');
    }
  }

  // eslint-disable-next-line
  public async down(queryRunner: QueryRunner): Promise<void> {}
}
