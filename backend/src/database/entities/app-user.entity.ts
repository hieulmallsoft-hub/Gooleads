import { Column, Entity } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'app_users' })
export class AppUserEntity extends UuidTimestampEntity {
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 200 })
  displayName!: string;

  @Column({ type: 'varchar', length: 30 })
  status!: string;
}
