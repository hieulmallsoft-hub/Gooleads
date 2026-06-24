import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'user_preferences' })
export class UserPreferenceEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'selected_account_id', type: 'uuid', nullable: true })
  selectedAccountId!: string | null;

  @Column({ name: 'selected_ad_group_id', type: 'uuid', nullable: true })
  selectedAdGroupId!: string | null;

  @Column({ type: 'jsonb' })
  preferences!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
