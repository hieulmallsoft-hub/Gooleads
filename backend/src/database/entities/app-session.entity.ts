import { Column, Entity, Index } from 'typeorm';
import { UuidCreatedEntity } from './base.entity';

@Entity({ name: 'auth_sessions' })
@Index('auth_sessions_token_hash_unique', ['tokenHash'], { unique: true })
export class AppSessionEntity extends UuidCreatedEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 100, nullable: true })
  ipAddress!: string | null;
}
