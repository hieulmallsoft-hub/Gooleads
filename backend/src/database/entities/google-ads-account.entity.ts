import { Column, Entity, Index } from 'typeorm';
import { UuidTimestampEntity } from './base.entity';

@Entity({ name: 'google_ads_accounts' })
@Index('google_ads_accounts_workspace_customer_unique', ['workspaceId', 'customerId'], {
  unique: true,
})
export class GoogleAdsAccountEntity extends UuidTimestampEntity {
  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 32 })
  customerId!: string;

  @Column({ name: 'login_customer_id', type: 'varchar', length: 32, nullable: true })
  loginCustomerId!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 200, nullable: true })
  displayName!: string | null;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, nullable: true })
  currencyCode!: string | null;

  @Column({ name: 'time_zone', type: 'varchar', length: 100, nullable: true })
  timeZone!: string | null;

  @Column({ type: 'varchar', length: 30 })
  status!: string;

  @Column({ name: 'credential_ref', type: 'text', nullable: true })
  credentialRef!: string | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;
}
