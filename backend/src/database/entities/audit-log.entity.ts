import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'workspace_id', type: 'uuid' }) workspaceId!: string;
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true }) actorUserId!: string | null;
  @Column({ type: 'varchar', length: 100 }) action!: string;
  @Column({ name: 'entity_type', type: 'varchar', length: 100 }) entityType!: string;
  @Column({ name: 'entity_id', type: 'text', nullable: true }) entityId!: string | null;
  @Column({ name: 'before_payload', type: 'jsonb', nullable: true }) beforePayload!: Record<string, unknown> | null;
  @Column({ name: 'after_payload', type: 'jsonb', nullable: true }) afterPayload!: Record<string, unknown> | null;
  @Column({ name: 'correlation_id', type: 'varchar', length: 200, nullable: true }) correlationId!: string | null;
  @Column({ type: 'jsonb' }) metadata!: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
