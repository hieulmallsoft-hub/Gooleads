import { Column, Entity, Index } from 'typeorm';
import { GoogleResourceEntity } from './google-resource.entity';

@Entity({ name: 'campaigns' })
@Index('campaigns_account_google_id_unique', ['accountId', 'googleCampaignId'], {
  unique: true,
})
export class CampaignEntity extends GoogleResourceEntity {
  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ name: 'google_campaign_id', type: 'varchar', length: 32 })
  googleCampaignId!: string;

  @Column({ type: 'varchar', length: 500 })
  name!: string;

  @Column({ name: 'channel_type', type: 'varchar', length: 80, nullable: true })
  channelType!: string | null;
}
