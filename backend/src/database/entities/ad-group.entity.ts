import { Column, Entity, Index } from 'typeorm';
import { GoogleResourceEntity } from './google-resource.entity';

@Entity({ name: 'ad_groups' })
@Index('ad_groups_campaign_google_id_unique', ['campaignId', 'googleAdGroupId'], {
  unique: true,
})
export class AdGroupEntity extends GoogleResourceEntity {
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'google_ad_group_id', type: 'varchar', length: 32 })
  googleAdGroupId!: string;

  @Column({ type: 'varchar', length: 500 })
  name!: string;
}
