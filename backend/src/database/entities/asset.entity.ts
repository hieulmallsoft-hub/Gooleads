import { Column, Entity, Index } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'assets' })
@Index('assets_account_google_id_unique', ['accountId', 'googleAssetId'], {
  unique: true,
})
export class AssetEntity extends UuidTimestampEntity {
  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ name: 'media_file_id', type: 'uuid', nullable: true })
  mediaFileId!: string | null;

  @Column({ name: 'google_asset_id', type: 'varchar', length: 32 })
  googleAssetId!: string;

  @Column({ name: 'resource_name', type: 'text' })
  resourceName!: string;

  @Column({ name: 'asset_type', type: 'varchar', length: 100 })
  assetType!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  name!: string | null;

  @Column({ name: 'text_content', type: 'text', nullable: true })
  textContent!: string | null;

  @Column({ name: 'language_code', type: 'varchar', length: 35, nullable: true })
  languageCode!: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ name: 'image_width', type: 'integer', nullable: true })
  imageWidth!: number | null;

  @Column({ name: 'image_height', type: 'integer', nullable: true })
  imageHeight!: number | null;

  @Column({ name: 'youtube_video_id', type: 'varchar', length: 100, nullable: true })
  youtubeVideoId!: string | null;

  @Column({ name: 'content_hash', type: 'varchar', length: 128, nullable: true })
  contentHash!: string | null;

  @Column({ type: 'varchar', length: 30 })
  source!: string;

  @Column({ type: 'varchar', length: 50 })
  status!: string;

  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;
}
