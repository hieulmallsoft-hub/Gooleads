import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'automation_run_items' })
export class AutomationRunItemEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'automation_run_id', type: 'uuid' }) automationRunId!: string;
  @Column({ name: 'ad_asset_link_id', type: 'uuid', nullable: true }) adAssetLinkId!: string | null;
  @Column({ name: 'suggestion_id', type: 'uuid', nullable: true }) suggestionId!: string | null;
  @Column({ type: 'varchar', length: 30 }) action!: string;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
