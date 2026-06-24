import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'change_requests' })
export class ChangeRequestEntity extends UuidTimestampEntity {
  @Column({ name: 'workspace_id', type: 'uuid' }) workspaceId!: string;
  @Column({ name: 'account_id', type: 'uuid' }) accountId!: string;
  @Column({ name: 'ad_group_id', type: 'uuid', nullable: true }) adGroupId!: string | null;
  @Column({ name: 'requested_by', type: 'uuid', nullable: true }) requestedBy!: string | null;
  @Column({ type: 'varchar', length: 30 }) source!: string;
  @Column({ name: 'idempotency_key', type: 'varchar', length: 200 }) idempotencyKey!: string;
  @Column({ type: 'varchar', length: 30 }) status!: string;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage!: string | null;
  @Column({ name: 'requested_at', type: 'timestamptz' }) requestedAt!: Date;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt!: Date | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt!: Date | null;
}
