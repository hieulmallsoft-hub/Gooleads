import { Column, Entity, Index } from 'typeorm';
import { UuidCreatedEntity } from './base.entity';

@Entity({ name: 'campaign_group_members' })
@Index('campaign_group_members_group_campaign_unique', ['groupId', 'googleCampaignId'], {
  unique: true,
})
export class CampaignGroupMemberEntity extends UuidCreatedEntity {
  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'google_campaign_id', type: 'varchar', length: 32 })
  googleCampaignId!: string;

  @Column({ name: 'campaign_name', type: 'varchar', length: 500 })
  campaignName!: string;
}
