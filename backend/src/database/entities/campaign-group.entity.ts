import { Column, Entity, Index } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'campaign_groups' })
@Index('campaign_groups_account_name_unique', ['accountId', 'name'], { unique: true })
export class CampaignGroupEntity extends UuidTimestampEntity {
  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: '#1a73e8' })
  color!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
