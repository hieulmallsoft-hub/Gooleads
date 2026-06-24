import { Column, Entity } from 'typeorm';
import { UuidCreatedEntity } from './base.entity';

@Entity({ name: 'automation_runs' })
export class AutomationRunEntity extends UuidCreatedEntity {
  @Column({ name: 'schedule_id', type: 'uuid' }) scheduleId!: string;
  @Column({ name: 'review_run_id', type: 'uuid', nullable: true }) reviewRunId!: string | null;
  @Column({ name: 'change_request_id', type: 'uuid', nullable: true }) changeRequestId!: string | null;
  @Column({ type: 'varchar', length: 30 }) status!: string;
  @Column({ name: 'selected_count', type: 'integer' }) selectedCount!: number;
  @Column({ name: 'applied_count', type: 'integer' }) appliedCount!: number;
  @Column({ name: 'failed_count', type: 'integer' }) failedCount!: number;
  @Column({ name: 'scheduled_for', type: 'timestamptz' }) scheduledFor!: Date;
  @Column({ name: 'started_at', type: 'timestamptz' }) startedAt!: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt!: Date | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage!: string | null;
}
