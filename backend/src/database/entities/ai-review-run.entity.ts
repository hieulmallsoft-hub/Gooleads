import { Column, Entity } from 'typeorm';
import { UuidCreatedEntity } from './base.entity';

@Entity({ name: 'ai_review_runs' })
export class AiReviewRunEntity extends UuidCreatedEntity {
  @Column({ name: 'workspace_id', type: 'uuid' }) workspaceId!: string;
  @Column({ name: 'account_id', type: 'uuid' }) accountId!: string;
  @Column({ name: 'ad_group_id', type: 'uuid', nullable: true }) adGroupId!: string | null;
  @Column({ name: 'policy_id', type: 'uuid', nullable: true }) policyId!: string | null;
  @Column({ name: 'prompt_template_id', type: 'uuid', nullable: true }) promptTemplateId!: string | null;
  @Column({ name: 'triggered_by', type: 'uuid', nullable: true }) triggeredBy!: string | null;
  @Column({ name: 'trigger_type', type: 'varchar', length: 30 }) triggerType!: string;
  @Column({ type: 'varchar', length: 40 }) provider!: string;
  @Column({ type: 'varchar', length: 100 }) model!: string;
  @Column({ name: 'requested_time_range', type: 'varchar', length: 50, nullable: true }) requestedTimeRange!: string | null;
  @Column({ name: 'range_start', type: 'date', nullable: true }) rangeStart!: string | null;
  @Column({ name: 'range_end', type: 'date', nullable: true }) rangeEnd!: string | null;
  @Column({ type: 'varchar', length: 30 }) status!: string;
  @Column({ name: 'input_context', type: 'jsonb' }) inputContext!: Record<string, unknown>;
  @Column({ name: 'raw_response', type: 'jsonb', nullable: true }) rawResponse!: Record<string, unknown> | null;
  @Column({ name: 'input_tokens', type: 'integer', nullable: true }) inputTokens!: number | null;
  @Column({ name: 'output_tokens', type: 'integer', nullable: true }) outputTokens!: number | null;
  @Column({ name: 'estimated_cost', type: 'numeric', precision: 16, scale: 8, nullable: true }) estimatedCost!: string | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage!: string | null;
  @Column({ name: 'started_at', type: 'timestamptz' }) startedAt!: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt!: Date | null;
}
