import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GoogleAdsAccountEntity } from '../database/entities/google-ads-account.entity';
import { SyncRunEntity } from '../database/entities/sync-run.entity';
import { GoogleAdsSyncService } from './google-ads-sync.service';

@Injectable()
export class GoogleAdsPeriodicSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GoogleAdsPeriodicSyncService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly intervalMs = this.duration(
    process.env.GOOGLE_ADS_PERIODIC_SYNC_MS,
    30 * 60 * 1000,
  );

  constructor(
    private readonly dataSource: DataSource,
    private readonly syncService: GoogleAdsSyncService,
  ) {}

  onModuleInit() {
    if (process.env.GOOGLE_ADS_PERIODIC_SYNC_DISABLED === 'true') return;
    this.timer = setInterval(() => void this.runDueAccounts(), this.intervalMs);
    // Give startup and migrations time to settle; web reads the existing snapshot meanwhile.
    setTimeout(() => void this.runDueAccounts(), 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runDueAccounts(now = new Date()) {
    if (this.running || !this.dataSource.isInitialized) return;
    this.running = true;
    try {
      const cutoff = new Date(now.getTime() - this.intervalMs);
      const accounts = await this.dataSource.getRepository(GoogleAdsAccountEntity)
        .createQueryBuilder('account')
        .where('account.status = :status', { status: 'ACTIVE' })
        .andWhere('(account.last_synced_at IS NULL OR account.last_synced_at <= :cutoff)', { cutoff })
        .orderBy('account.last_synced_at', 'ASC', 'NULLS FIRST')
        .getMany();

      for (const account of accounts) {
        const activeRun = await this.dataSource.getRepository(SyncRunEntity)
          .findOneBy({ accountId: account.id, status: 'RUNNING' });
        if (activeRun) continue;
        try {
          const timeRange = await this.timeRangeFor(account.id, now);
          await this.syncService.syncAccount(account.customerId, timeRange);
        } catch (error) {
          this.logger.error(
            `Periodic Google Ads sync failed for ${account.customerId}: ${error instanceof Error ? error.message : String(error)}`,
          );
          if (/RESOURCE_(?:TEMPORARILY_)?EXHAUSTED|quota|too many requests|\b429\b/i.test(String(error))) {
            break;
          }
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async timeRangeFor(accountId: string, now: Date) {
    const rows: Array<{ lastBackfillAt: Date | string | null }> = await this.dataSource.query(`
      SELECT MAX(completed_at) AS "lastBackfillAt"
      FROM sync_runs
      WHERE account_id = $1
        AND status = 'COMPLETED'
        AND metadata->>'mode' = 'ACCOUNT_FULL'
        AND metadata->>'timeRange' LIKE '%,%'
    `, [accountId]);
    const lastBackfill = rows[0]?.lastBackfillAt
      ? new Date(rows[0].lastBackfillAt).getTime()
      : 0;
    if (lastBackfill && now.getTime() - lastBackfill < 24 * 60 * 60 * 1000) {
      return 'LAST_7_DAYS';
    }
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 29);
    const format = (value: Date) => value.toISOString().slice(0, 10);
    return `${format(start)},${format(now)}`;
  }

  private duration(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : fallback;
  }
}
