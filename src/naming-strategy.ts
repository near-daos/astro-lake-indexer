import { Table } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RandomGenerator } from 'typeorm/util/RandomGenerator';

export class CustomNamingStrategy extends SnakeNamingStrategy {
  foreignKeyName(
    tableOrName: Table | string,
    columnNames: string[],
    _referencedTablePath?: string,
    _referencedColumnNames?: string[],
  ): string {
    const clonedColumnNames = [...columnNames];
    clonedColumnNames.sort();
    const referencedColumnNames = [...(_referencedColumnNames || [])];
    referencedColumnNames.sort();
    const tableName = this.getTableName(tableOrName);
    const replacedTableName = tableName.replace('.', '_');
    // Fix duplicate FK constraint names
    const referencedTableName = (_referencedTablePath || '').replace('.', '_');
    const key = `${replacedTableName}_${clonedColumnNames.join(
      '_',
    )}_${referencedTableName}_${referencedColumnNames.join('_')}`;
    return 'FK_' + RandomGenerator.sha1(key).substr(0, 27);
  }
}
