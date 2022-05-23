import { Table } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RandomGenerator } from 'typeorm/util/RandomGenerator';

export class CustomNamingStrategy extends SnakeNamingStrategy {
  foreignKeyName(tableOrName: Table | string, columnNames: string[], _referencedTablePath?: string, _referencedColumnNames?: string[]): string {
    const clonedColumnNames = [...columnNames];
    clonedColumnNames.sort();
    const tableName = this.getTableName(tableOrName);
    const replacedTableName = tableName.replace('.', '_');
    // Fix duplicate FK constraint names
    const referencedTableName = (_referencedTablePath || '').replace('.', '_');
    const key = `${replacedTableName}_${referencedTableName}_${clonedColumnNames.join('_')}`;
    return 'FK_' + RandomGenerator.sha1(key).substr(0, 27);
  }
}
