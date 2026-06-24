import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'creative_policies' })
export class CreativePolicyEntity extends UuidTimestampEntity {
  @Column({ name: 'workspace_id', type: 'uuid' }) workspaceId!: string;
  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ name: 'selection_strategy', type: 'varchar', length: 50 }) selectionStrategy!: string;
  @Column({ name: 'selection_criteria', type: 'jsonb' }) selectionCriteria!: Record<string, unknown>;
  @Column({ name: 'language_strategy', type: 'varchar', length: 50 }) languageStrategy!: string;
  @Column({ name: 'target_language', type: 'varchar', length: 35, nullable: true }) targetLanguage!: string | null;
  @Column({ name: 'headline_max_length', type: 'smallint' }) headlineMaxLength!: number;
  @Column({ name: 'description_max_length', type: 'smallint' }) descriptionMaxLength!: number;
  @Column({ name: 'approval_mode', type: 'varchar', length: 30 }) approvalMode!: string;
  @Column({ name: 'review_interval_days', type: 'smallint' }) reviewIntervalDays!: number;
  @Column({ name: 'minimum_impressions', type: 'bigint' }) minimumImpressions!: string;
  @Column({ name: 'minimum_clicks', type: 'bigint' }) minimumClicks!: string;
  @Column({ name: 'cooldown_days', type: 'smallint' }) cooldownDays!: number;
  @Column({ name: 'max_changes_per_run', type: 'smallint' }) maxChangesPerRun!: number;
  @Column({ type: 'integer' }) version!: number;
  @Column({ type: 'boolean' }) enabled!: boolean;
}
