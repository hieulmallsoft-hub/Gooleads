import assert from 'node:assert/strict';
import test from 'node:test';
import { CreativeAutomationService } from './creative-automation.service';

function service() {
  return new CreativeAutomationService({} as any, {} as any, {} as any, {} as any, {} as any) as any;
}

test('automation filters invalid suggestions and keeps every usable LOW replacement', () => {
  const result = service().buildReplacementInput([
    { suggestionId: 's1', fieldType: 'HEADLINE', text: 'Old', variants: [{ id: 'v1', content: { text: 'New' } }] },
    { suggestionId: 's2', fieldType: 'DESCRIPTION', text: 'Same', suggestion: 'Same' },
    { suggestionId: 's3', fieldType: 'UNKNOWN', text: 'A', suggestion: 'B' },
    { suggestionId: 's4', fieldType: 'DESCRIPTION', text: 'Long old', suggestion: 'Long new' },
  ]);
  assert.deepEqual(result, {
    headlineReplacements: [{ oldText: 'Old', newText: 'New', suggestionId: 's1', variantId: 'v1' }],
    descriptionReplacements: [{ oldText: 'Long old', newText: 'Long new', suggestionId: 's4' }],
  });
});

test('automation resolves final statuses correctly', () => {
  const instance = service();
  assert.equal(instance.resolveRunStatus({ selectedCount: 0, failedCount: 0 }), 'SKIPPED');
  assert.equal(instance.resolveRunStatus({ selectedCount: 0, failedCount: 1 }), 'FAILED');
  assert.equal(instance.resolveRunStatus({ selectedCount: 2, failedCount: 1 }), 'PARTIAL');
  assert.equal(instance.resolveRunStatus({ selectedCount: 2, failedCount: 0 }), 'COMPLETED');
});

test('automation date range is timezone-aware and inclusive', () => {
  const range = service().buildTrailingDateRange(
    7,
    'Asia/Ho_Chi_Minh',
    new Date('2026-07-29T18:00:00.000Z'),
  );
  assert.equal(range, '2026-07-24,2026-07-30');
});

test('automation uses heartbeat instead of start time when detecting an interrupted run', () => {
  const instance = service();
  const now = new Date('2026-07-30T10:00:00.000Z');
  const activeRun = {
    startedAt: new Date('2026-07-30T08:00:00.000Z'),
    lastHeartbeatAt: new Date('2026-07-30T09:50:00.000Z'),
  };
  const interruptedRun = {
    startedAt: new Date('2026-07-30T08:00:00.000Z'),
    lastHeartbeatAt: new Date('2026-07-30T09:00:00.000Z'),
  };

  assert.equal(instance.isStaleRunningRun(activeRun, now), false);
  assert.equal(instance.isStaleRunningRun(interruptedRun, now), true);
});

test('automation only targets explicitly selected enabled ad groups', async () => {
  const values: Record<string, unknown[]> = {
    CreativePolicyScopeEntity: [
      { policyId: 'policy-1', adGroupId: 'group-db-1', languageCode: 'vi', adGroupTopic: 'Điều khiển điều hòa' },
      { policyId: 'policy-1', adGroupId: 'group-db-paused', languageCode: 'vi', adGroupTopic: 'Điều khiển điều hòa' },
    ],
    AdGroupEntity: [
      {
        id: 'group-db-1',
        campaignId: 'campaign-db-1',
        googleAdGroupId: '1001',
        name: 'Được phép',
        status: 'ENABLED',
      },
      {
        id: 'group-db-paused',
        campaignId: 'campaign-db-1',
        googleAdGroupId: '1002',
        name: 'Đã tạm dừng',
        status: 'PAUSED',
      },
    ],
    CampaignEntity: [
      {
        id: 'campaign-db-1',
        accountId: 'account-1',
        googleCampaignId: '2001',
        name: 'Chiến dịch được phép',
        status: 'ENABLED',
      },
    ],
    GoogleAdsAccountEntity: [
      {
        id: 'account-1',
        customerId: '1234567890',
        status: 'ACTIVE',
      },
    ],
  };
  const dataSource = {
    getRepository(entity: { name: string }) {
      return {
        findBy: async () => values[entity.name] ?? [],
      };
    },
  };
  const instance = new CreativeAutomationService(
    dataSource as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  ) as any;

  const targets = await instance.getAutomationTargets(
    { id: 'policy-1' },
    'LAST_7_DAYS',
  );

  assert.deepEqual(targets, [
    {
      customerId: '1234567890',
      campaignId: '2001',
      campaignName: 'Chiến dịch được phép',
      adGroupId: '1001',
      adGroupName: 'Được phép',
      languageCode: 'vi',
      topic: 'Điều khiển điều hòa',
    },
  ]);
});

test('automation fails closed when no ad group scope is selected', async () => {
  const instance = new CreativeAutomationService(
    {
      getRepository() {
        return { findBy: async () => [] };
      },
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  ) as any;

  assert.deepEqual(
    await instance.getAutomationTargets({ id: 'policy-1' }, 'LAST_7_DAYS'),
    [],
  );
});

test('automation targets every enabled ad group in a full campaign scope', async () => {
  const values: Record<string, unknown[]> = {
    CreativePolicyScopeEntity: [
      {
        policyId: 'policy-1',
        campaignId: 'campaign-db-1',
        adGroupId: null,
        includeAllAdGroups: true,
      },
      { policyId: 'policy-1', campaignId: null, adGroupId: 'group-db-1', includeAllAdGroups: false, languageCode: 'vi', adGroupTopic: 'Điều khiển điều hòa' },
    ],
    AdGroupEntity: [
      {
        id: 'group-db-1',
        campaignId: 'campaign-db-1',
        googleAdGroupId: '1001',
        name: 'Nhóm đang chạy',
        status: 'ENABLED',
      },
      {
        id: 'group-db-2',
        campaignId: 'campaign-db-1',
        googleAdGroupId: '1002',
        name: 'Nhóm tạm dừng',
        status: 'PAUSED',
      },
    ],
    CampaignEntity: [
      {
        id: 'campaign-db-1',
        accountId: 'account-1',
        googleCampaignId: '2001',
        name: 'Chiến dịch toàn bộ',
        status: 'ENABLED',
      },
    ],
    GoogleAdsAccountEntity: [
      { id: 'account-1', customerId: '1234567890', status: 'ACTIVE' },
    ],
  };
  const instance = new CreativeAutomationService(
    {
      getRepository(entity: { name: string }) {
        return { findBy: async () => values[entity.name] ?? [] };
      },
    } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  ) as any;

  const targets = await instance.getAutomationTargets(
    { id: 'policy-1' },
    'LAST_7_DAYS',
  );

  assert.deepEqual(targets.map((target: any) => target.adGroupId), ['1001']);
});
