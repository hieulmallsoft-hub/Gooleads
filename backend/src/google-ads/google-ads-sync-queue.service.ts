import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  SyncBatchJobEntity,
  SyncBatchTarget,
} from '../database/entities/sync-batch-job.entity';
import { GoogleAdsAccountEntity } from '../database/entities/google-ads-account.entity';
import { GoogleAdsSyncService } from './google-ads-sync.service';

@Injectable()
export class GoogleAdsSyncQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GoogleAdsSyncQueueService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly syncService: GoogleAdsSyncService,
  ) {}

  onModuleInit() {
    if (process.env.SYNC_QUEUE_WORKER_DISABLED === 'true') return;
    const interval = Math.min(
      Math.max(Number(process.env.SYNC_QUEUE_POLL_INTERVAL_MS ?? 2_000), 1_000),
      60_000,
    );
    this.timer = setInterval(() => void this.processNext(), interval);
    void this.recoverInterruptedJobs().then(() => this.processNext());
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async enqueue(
    customerId: string,
    timeRange: string,
    targets: SyncBatchTarget[],
    requestedBy?: string | null,
  ) {
    const normalizedTargets = [
      ...new Map(
        targets
          .map((target) => ({
            adGroupId: String(target.adGroupId ?? '').replace(/\D/g, ''),
            adGroupName: String(target.adGroupName ?? '').trim() || undefined,
          }))
          .filter((target) => target.adGroupId)
          .map((target) => [target.adGroupId, target]),
      ).values(),
    ].slice(0, 100);
    if (!normalizedTargets.length) {
      throw new BadRequestException('Không có nhóm quảng cáo hợp lệ để đồng bộ');
    }

    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId });
    if (!account) throw new BadRequestException('Tài khoản Google Ads chưa được đăng ký');

    const repository = this.dataSource.getRepository(SyncBatchJobEntity);
    const existing = await repository.findOne({
      where: { accountId: account.id, status: In(['PENDING', 'RUNNING']) },
      order: { createdAt: 'DESC' },
    });
    if (existing) return this.serialize(existing);

    try {
      const job = await repository.save(repository.create({
        accountId: account.id,
        requestedBy: requestedBy ?? null,
        status: 'PENDING',
        timeRange,
        targets: normalizedTargets,
        totalCount: normalizedTargets.length,
        completedCount: 0,
        failedCount: 0,
        currentAdGroupId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      }));
      void this.processNext();
      return this.serialize(job);
    } catch (error) {
      const active = await repository.findOne({
        where: { accountId: account.id, status: In(['PENDING', 'RUNNING']) },
        order: { createdAt: 'DESC' },
      });
      if (active) return this.serialize(active);
      throw error;
    }
  }

  async getJob(customerId: string, jobId?: string) {
    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId });
    if (!account) return null;
    const repository = this.dataSource.getRepository(SyncBatchJobEntity);
    const job = jobId
      ? await repository.findOneBy({ id: jobId, accountId: account.id })
      : await repository.findOne({
          where: { accountId: account.id },
          order: { createdAt: 'DESC' },
        });
    return job ? this.serialize(job) : null;
  }

  async processNext() {
    if (this.processing) return;
    this.processing = true;
    try {
      const claimed = await this.dataSource.transaction(async (manager) => {
        const rows: SyncBatchJobEntity[] = await manager.query(`
          SELECT
            id,
            account_id AS "accountId",
            time_range AS "timeRange",
            targets
          FROM sync_batch_jobs
          WHERE status = 'PENDING'
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `);
        const job = rows[0];
        if (!job) return null;
        await manager.query(`
          UPDATE sync_batch_jobs
          SET status = 'RUNNING', started_at = COALESCE(started_at, NOW())
          WHERE id = $1
        `, [job.id]);
        return job;
      });
      if (!claimed) return;

      const account = await this.dataSource
        .getRepository(GoogleAdsAccountEntity)
        .findOneBy({ id: claimed.accountId });
      if (!account) {
        await this.finishFailed(claimed.id, 'Không tìm thấy tài khoản Google Ads');
        return;
      }

      const repository = this.dataSource.getRepository(SyncBatchJobEntity);
      const targets = Array.isArray(claimed.targets) ? claimed.targets : [];
      let completed = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const target of targets) {
        await repository.update(claimed.id, { currentAdGroupId: target.adGroupId });
        try {
          await this.syncService.sync(account.customerId, target.adGroupId, claimed.timeRange);
          completed += 1;
        } catch (error) {
          failed += 1;
          errors.push(`${target.adGroupName ?? target.adGroupId}: ${
            error instanceof Error ? error.message : String(error)
          }`);
        }
        await repository.update(claimed.id, {
          completedCount: completed,
          failedCount: failed,
        });
      }
      await repository.update(claimed.id, {
        status: failed === targets.length ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'COMPLETED',
        completedCount: completed,
        failedCount: failed,
        currentAdGroupId: null,
        errorMessage: errors.slice(0, 5).join('\n') || null,
        completedAt: new Date(),
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    } finally {
      this.processing = false;
    }
  }

  private async recoverInterruptedJobs() {
    await this.dataSource.query(`
      UPDATE sync_batch_jobs
      SET status = 'PENDING', current_ad_group_id = NULL
      WHERE status = 'RUNNING'
        AND started_at < NOW() - INTERVAL '30 minutes'
    `);
  }

  private async finishFailed(id: string, message: string) {
    await this.dataSource.getRepository(SyncBatchJobEntity).update(id, {
      status: 'FAILED',
      errorMessage: message,
      currentAdGroupId: null,
      completedAt: new Date(),
    });
  }

  private serialize(job: SyncBatchJobEntity) {
    return {
      id: job.id,
      status: job.status,
      totalCount: job.totalCount,
      completedCount: job.completedCount,
      failedCount: job.failedCount,
      currentAdGroupId: job.currentAdGroupId,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    };
  }
}
