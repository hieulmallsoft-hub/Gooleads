import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'prompt_templates' })
export class PromptTemplateEntity extends UuidTimestampEntity {
  @Column({ name: 'workspace_id', type: 'uuid', nullable: true }) workspaceId!: string | null;
  @Column({ name: 'template_key', type: 'varchar', length: 100 }) templateKey!: string;
  @Column({ type: 'varchar', length: 80 }) feature!: string;
  @Column({ type: 'varchar', length: 40 }) provider!: string;
  @Column({ type: 'integer' }) version!: number;
  @Column({ type: 'text' }) template!: string;
  @Column({ name: 'response_schema', type: 'jsonb' }) responseSchema!: Record<string, unknown>;
  @Column({ type: 'boolean' }) active!: boolean;
}
