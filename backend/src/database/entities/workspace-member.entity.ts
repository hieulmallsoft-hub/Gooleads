import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'workspace_members' })
export class WorkspaceMemberEntity {
  @PrimaryColumn({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 30 })
  role!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
