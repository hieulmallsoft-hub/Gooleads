import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'creative_policy_scopes' })
export class CreativePolicyScopeEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'policy_id', type: 'uuid' }) policyId!: string;
  @Column({ name: 'account_id', type: 'uuid', nullable: true }) accountId!: string | null;
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true }) campaignId!: string | null;
  @Column({ name: 'ad_group_id', type: 'uuid', nullable: true }) adGroupId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
