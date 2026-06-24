import { Column } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

export abstract class GoogleResourceEntity extends UuidTimestampEntity {
  @Column({ name: 'resource_name', type: 'text' })
  resourceName!: string;

  @Column({ type: 'varchar', length: 50 })
  status!: string;

  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;
}
