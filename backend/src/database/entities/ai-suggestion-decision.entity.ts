import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'ai_suggestion_decisions' })
export class AiSuggestionDecisionEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'suggestion_id', type: 'uuid' }) suggestionId!: string;
  @Column({ name: 'variant_id', type: 'uuid', nullable: true }) variantId!: string | null;
  @Column({ name: 'decided_by', type: 'uuid', nullable: true }) decidedBy!: string | null;
  @Column({ type: 'varchar', length: 30 }) action!: string;
  @Column({ name: 'edited_content', type: 'jsonb', nullable: true }) editedContent!: Record<string, unknown> | null;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
