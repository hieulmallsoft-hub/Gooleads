import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'change_items' })
export class ChangeItemEntity extends UuidTimestampEntity {
  @Column({ name: 'change_request_id', type: 'uuid' }) changeRequestId!: string;
  @Column({ name: 'suggestion_id', type: 'uuid', nullable: true }) suggestionId!: string | null;
  @Column({ name: 'variant_id', type: 'uuid', nullable: true }) variantId!: string | null;
  @Column({ name: 'ad_asset_link_id', type: 'uuid', nullable: true }) adAssetLinkId!: string | null;
  @Column({ name: 'change_type', type: 'varchar', length: 40 }) changeType!: string;
  @Column({ name: 'media_type', type: 'varchar', length: 30, nullable: true }) mediaType!: string | null;
  @Column({ name: 'before_payload', type: 'jsonb' }) beforePayload!: Record<string, unknown>;
  @Column({ name: 'after_payload', type: 'jsonb' }) afterPayload!: Record<string, unknown>;
  @Column({ name: 'old_asset_resource_name', type: 'text', nullable: true }) oldAssetResourceName!: string | null;
  @Column({ name: 'new_asset_resource_name', type: 'text', nullable: true }) newAssetResourceName!: string | null;
  @Column({ name: 'old_ad_resource_name', type: 'text', nullable: true }) oldAdResourceName!: string | null;
  @Column({ name: 'new_ad_resource_name', type: 'text', nullable: true }) newAdResourceName!: string | null;
  @Column({ name: 'replacement_count', type: 'integer' }) replacementCount!: number;
  @Column({ type: 'varchar', length: 30 }) status!: string;
  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true }) errorCode!: string | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage!: string | null;
}
