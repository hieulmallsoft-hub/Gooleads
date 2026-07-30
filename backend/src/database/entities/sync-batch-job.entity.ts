import { Column, Entity } from 'typeorm';
import { UuidCreatedEntity } from './base.entity';

export type SyncBatchTarget = {
  adGroupId: string;
  adGroupName?: string;
};

@Entity({ name: 'sync_batch_jobs' })
export class SyncBatchJobEntity extends UuidCreatedEntity {
  @Column({ name: 'account_id', type: 'uuid' }) accountId!: string;
  @Column({ name: 'requested_by', type: 'uuid', nullable: true }) requestedBy!: string | null;
  @Column({ type: 'varchar', length: 30 }) status!: string;
  @Column({ name: 'time_range', type: 'varchar', length: 50 }) timeRange!: string;
  @Column({ type: 'jsonb' }) targets!: SyncBatchTarget[];
  @Column({ name: 'total_count', type: 'integer' }) totalCount!: number;
  @Column({ name: 'completed_count', type: 'integer' }) completedCount!: number;
  @Column({ name: 'failed_count', type: 'integer' }) failedCount!: number;
  @Column({ name: 'current_ad_group_id', type: 'varchar', length: 50, nullable: true })
  currentAdGroupId!: string | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage!: string | null;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt!: Date | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt!: Date | null;
}
