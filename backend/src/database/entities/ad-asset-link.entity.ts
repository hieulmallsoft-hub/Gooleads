import { Column, Entity, Index } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'ad_asset_links' })
@Index(
  'ad_asset_links_ad_asset_field_occurrence_unique',
  ['adId', 'assetId', 'fieldType', 'occurrenceIndex'],
  { unique: true },
)
export class AdAssetLinkEntity extends UuidTimestampEntity {
  @Column({ name: 'ad_id', type: 'uuid' })
  adId!: string;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId!: string;

  @Column({ name: 'google_view_resource_name', type: 'text', nullable: true })
  googleViewResourceName!: string | null;

  @Column({ name: 'field_type', type: 'varchar', length: 100 })
  fieldType!: string;

  @Column({ name: 'occurrence_index', type: 'integer' })
  occurrenceIndex!: number;

  @Column({ type: 'boolean' })
  enabled!: boolean;

  @Column({ name: 'performance_label', type: 'varchar', length: 30 })
  performanceLabel!: string;

  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;
}
