import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'ai_suggestions' })
export class AiSuggestionEntity extends UuidTimestampEntity {
  @Column({ name: 'review_run_id', type: 'uuid' }) reviewRunId!: string;
  @Column({ name: 'ad_asset_link_id', type: 'uuid', nullable: true }) adAssetLinkId!: string | null;
  @Column({ name: 'suggestion_type', type: 'varchar', length: 40 }) suggestionType!: string;
  @Column({ name: 'field_type', type: 'varchar', length: 100, nullable: true }) fieldType!: string | null;
  @Column({ name: 'language_code', type: 'varchar', length: 35, nullable: true }) languageCode!: string | null;
  @Column({ name: 'current_content', type: 'jsonb' }) currentContent!: Record<string, unknown>;
  @Column({ type: 'text' }) rationale!: string;
  @Column({ type: 'jsonb' }) evidence!: unknown[];
  @Column({ type: 'varchar', length: 30 }) priority!: string;
  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true }) confidence!: string | null;
  @Column({ type: 'varchar', length: 30 }) status!: string;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true }) expiresAt!: Date | null;
}
