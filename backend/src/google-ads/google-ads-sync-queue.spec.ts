import assert from 'node:assert/strict';
import test from 'node:test';
import { SyncBatchJobEntity } from '../database/entities/sync-batch-job.entity';
import { GoogleAdsAccountEntity } from '../database/entities/google-ads-account.entity';
import { GoogleAdsSyncQueueService } from './google-ads-sync-queue.service';

test('batch sync removes duplicate targets and creates one persisted background job', async () => {
  let saved: any = null;
  const account = { id: 'account-1', customerId: '1234567890' };
  const jobRepository = {
    findOne: async () => null,
    create: (value: any) => ({ id: 'job-1', createdAt: new Date(), ...value }),
    save: async (value: any) => (saved = value),
  };
  const dataSource = {
    getRepository: (entity: unknown) =>
      entity === GoogleAdsAccountEntity
        ? { findOneBy: async () => account }
        : entity === SyncBatchJobEntity
          ? jobRepository
          : null,
  };
  const service = new GoogleAdsSyncQueueService(dataSource as any, {} as any);
  (service as any).processNext = async () => undefined;

  const result = await service.enqueue(
    account.customerId,
    '2026-07-01,2026-07-30',
    [
      { adGroupId: '100', adGroupName: 'Nhóm A' },
      { adGroupId: '100', adGroupName: 'Nhóm A trùng' },
      { adGroupId: '200', adGroupName: 'Nhóm B' },
    ],
    'user-1',
  );

  assert.equal(saved.targets.length, 2);
  assert.equal(saved.totalCount, 2);
  assert.equal(saved.status, 'PENDING');
  assert.equal(result.id, 'job-1');
});

test('batch sync returns the active account job instead of creating a duplicate', async () => {
  const active = {
    id: 'job-active',
    accountId: 'account-1',
    status: 'RUNNING',
    totalCount: 4,
    completedCount: 2,
    failedCount: 0,
    currentAdGroupId: '200',
    errorMessage: null,
    startedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
  };
  const dataSource = {
    getRepository: (entity: unknown) =>
      entity === GoogleAdsAccountEntity
        ? { findOneBy: async () => ({ id: 'account-1', customerId: '1234567890' }) }
        : { findOne: async () => active },
  };
  const service = new GoogleAdsSyncQueueService(dataSource as any, {} as any);

  const result = await service.enqueue(
    '1234567890',
    'LAST_7_DAYS',
    [{ adGroupId: '300' }],
  );

  assert.equal(result.id, 'job-active');
  assert.equal(result.status, 'RUNNING');
  assert.equal(result.completedCount, 2);
});
