import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'creative_examples' })
export class CreativeExampleEntity extends UuidTimestampEntity {
  @Column({ name: 'policy_id', type: 'uuid', nullable: true }) policyId!: string | null;
  @Column({ name: 'ad_asset_link_id', type: 'uuid', nullable: true }) adAssetLinkId!: string | null;
  @Column({ name: 'example_type', type: 'varchar', length: 40 }) exampleType!: string;
  @Column({ name: 'field_type', type: 'varchar', length: 100, nullable: true }) fieldType!: string | null;
  @Column({ name: 'language_code', type: 'varchar', length: 35, nullable: true }) languageCode!: string | null;
  @Column({ type: 'text' }) content!: string;
  @Column({ name: 'performance_snapshot', type: 'jsonb' }) performanceSnapshot!: Record<string, unknown>;
  @Column({ type: 'boolean' }) active!: boolean;
}
