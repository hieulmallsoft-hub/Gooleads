import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'creative_terms' })
export class CreativeTermEntity extends UuidTimestampEntity {
  @Column({ name: 'policy_id', type: 'uuid' }) policyId!: string;
  @Column({ name: 'term_type', type: 'varchar', length: 40 }) termType!: string;
  @Column({ name: 'language_code', type: 'varchar', length: 35 }) languageCode!: string;
  @Column({ name: 'market_code', type: 'varchar', length: 16, nullable: true })
  marketCode!: string | null;

  @Column({ name: 'scope_level', type: 'varchar', length: 20, default: 'ACCOUNT' })
  scopeLevel!: string;

  @Column({ name: 'google_campaign_id', type: 'varchar', length: 32, nullable: true })
  googleCampaignId!: string | null;

  @Column({ name: 'google_ad_group_id', type: 'varchar', length: 32, nullable: true })
  googleAdGroupId!: string | null;

  @Column({ type: 'text' }) term!: string;
  @Column({ type: 'numeric', precision: 8, scale: 4 }) weight!: string;
  @Column({ type: 'boolean' }) active!: boolean;
}
