import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'media_files' })
export class MediaFileEntity extends UuidTimestampEntity {
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  @Column({ name: 'storage_provider', type: 'varchar', length: 50 })
  storageProvider!: string;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 500, nullable: true })
  originalName!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 150 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sha256!: string | null;

  @Column({ name: 'width_pixels', type: 'integer', nullable: true })
  widthPixels!: number | null;

  @Column({ name: 'height_pixels', type: 'integer', nullable: true })
  heightPixels!: number | null;

  @Column({ name: 'duration_seconds', type: 'numeric', precision: 12, scale: 3, nullable: true })
  durationSeconds!: string | null;
}
