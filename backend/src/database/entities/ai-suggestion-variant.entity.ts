import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'ai_suggestion_variants' })
export class AiSuggestionVariantEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'suggestion_id', type: 'uuid' }) suggestionId!: string;
  @Column({ type: 'smallint' }) rank!: number;
  @Column({ type: 'jsonb' }) content!: Record<string, unknown>;
  @Column({ name: 'character_count', type: 'integer', nullable: true }) characterCount!: number | null;
  @Column({ type: 'boolean' }) selected!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
