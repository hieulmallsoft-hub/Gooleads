import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'creative_policy_scopes' })
export class CreativePolicyScopeEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'policy_id', type: 'uuid' }) policyId!: string;
  @Column({ name: 'account_id', type: 'uuid', nullable: true }) accountId!: string | null;
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true }) campaignId!: string | null;
  @Column({ name: 'ad_group_id', type: 'uuid', nullable: true }) adGroupId!: string | null;
  @Column({ name: 'include_all_ad_groups', type: 'boolean', default: false })
  includeAllAdGroups!: boolean;
  @Column({ name: 'language_code', type: 'varchar', length: 16, nullable: true })
  languageCode!: string | null;
  @Column({ name: 'ad_group_topic', type: 'varchar', length: 500, nullable: true })
  adGroupTopic!: string | null;
  @Column({ name: 'interval_days', type: 'smallint', nullable: true })
  intervalDays!: number | null;
  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt!: Date | null;
  @Column({ name: 'next_run_at', type: 'timestamptz', nullable: true })
  nextRunAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
