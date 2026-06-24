import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from '../../../database/entities/base.entity';

@Entity({ name: 'workspaces' })
export class WorkspaceEntity extends UuidTimestampEntity {
  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 100 })
  timezone!: string;
}
