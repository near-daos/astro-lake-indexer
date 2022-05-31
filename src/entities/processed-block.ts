import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import * as transformers from '../transformers';

@Entity('processed_blocks')
export class ProcessedBlock {
  @PrimaryColumn('bigint', { transformer: transformers.int })
  block_height: number;

  @CreateDateColumn()
  createdDate: Date;
}
