import { Column, Entity } from 'typeorm';
import { UuidCreatedEntity } from './base.entity';

@Entity({ name: 'sync_runs' })
export class SyncRunEntity extends UuidCreatedEntity {
  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ type: 'varchar', length: 50 })
  scope!: string;

  @Column({ name: 'range_start', type: 'date', nullable: true })
  rangeStart!: string | null;

  @Column({ name: 'range_end', type: 'date', nullable: true })
  rangeEnd!: string | null;

  @Column({ type: 'varchar', length: 30 })
  status!: string;

  @Column({ name: 'rows_read', type: 'integer' })
  rowsRead!: number;

  @Column({ name: 'rows_written', type: 'integer' })
  rowsWritten!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'jsonb' })
  metadata!: Record<string, unknown>;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
