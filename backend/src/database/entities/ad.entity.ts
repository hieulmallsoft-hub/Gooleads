import { Column, Entity, Index } from 'typeorm';
import { GoogleResourceEntity } from './google-resource.entity';

@Entity({ name: 'ads' })
@Index('ads_ad_group_google_id_unique', ['adGroupId', 'googleAdId'], {
  unique: true,
})
export class AdEntity extends GoogleResourceEntity {
  @Column({ name: 'ad_group_id', type: 'uuid' })
  adGroupId!: string;

  @Column({ name: 'google_ad_id', type: 'varchar', length: 32 })
  googleAdId!: string;

  @Column({ name: 'ad_type', type: 'varchar', length: 100 })
  adType!: string;
}
