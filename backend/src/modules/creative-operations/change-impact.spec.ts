import assert from 'node:assert/strict';
import test from 'node:test';
import { CreativeOperationsService } from './creative-operations.service';

function createService(row: Record<string, unknown>) {
  const queries: Array<{ sql: string; parameters: unknown[] }> = [];
  const dataSource = {
    query: async (sql: string, parameters: unknown[]) => {
      queries.push({ sql, parameters });
      return [row];
    },
  };
  const accountRegistry = {
    getOrCreate: async () => ({
      id: 'account-1',
      customerId: '1234567890',
      displayName: 'Test account',
      currencyCode: 'USD',
    }),
  };
  return {
    queries,
    service: new CreativeOperationsService(
      dataSource as any,
      accountRegistry as any,
      {} as any,
    ),
  };
}

const baseRow = {
  change_id: 'change-1',
  source: 'MANUAL',
  completed_at: new Date('2026-07-15T10:00:00Z'),
  change_types: 'TEXT_REPLACEMENT',
  replacement_count: 2,
  automated: false,
  google_campaign_id: '100',
  campaign_name: 'Search campaign',
  google_ad_group_id: '200',
  ad_group_name: 'Brand terms',
  before_days: 14,
  after_days: 14,
  before_impressions: 1000,
  before_clicks: 50,
  before_cost_micros: 100_000_000,
  before_conversions: 5,
  before_conversion_value: 200,
  after_impressions: 1200,
  after_clicks: 84,
  after_cost_micros: 120_000_000,
  after_conversions: 10,
  after_conversion_value: 360,
};

test('change impact calculates metrics and marks an improvement', async () => {
  const { service, queries } = createService(baseRow);
  const result = await service.getChangeImpact('1234567890', '14');
  assert.equal(result.changes[0].verdict, 'IMPROVED');
  assert.equal(result.changes[0].before.ctr, 0.05);
  assert.equal(result.changes[0].after.ctr, 0.07);
  assert.equal(result.changes[0].before.roas, 2);
  assert.equal(result.changes[0].after.roas, 3);
  assert.equal(result.changes[0].origin, 'MANUAL');
  assert.equal(result.totals.improved, 1);
  assert.deepEqual(queries[0].parameters, ['account-1', 14]);
});

test('change impact identifies changes made by automation', async () => {
  const { service } = createService({ ...baseRow, automated: true, source: 'AI_APPROVED' });
  const result = await service.getChangeImpact('1234567890', '14');
  assert.equal(result.changes[0].origin, 'AI_AUTOMATION');
});

test('change impact stays collecting until enough post-change days exist', async () => {
  const { service } = createService({ ...baseRow, after_days: 3 });
  const result = await service.getChangeImpact('1234567890', '30');
  assert.equal(result.changes[0].verdict, 'COLLECTING');
  assert.equal(result.totals.collecting, 1);
  assert.equal(result.windowDays, 30);
});

test('change impact waits for the full selected window before judging performance', async () => {
  const { service } = createService({ ...baseRow, after_days: 13 });
  const result = await service.getChangeImpact('1234567890', '14');
  assert.equal(result.changes[0].verdict, 'COLLECTING');
});

test('change impact falls back to a 14-day window for invalid input', async () => {
  const { service, queries } = createService(baseRow);
  await service.getChangeImpact('1234567890', '365');
  assert.deepEqual(queries[0].parameters, ['account-1', 14]);
});

test('change impact searches and paginates all matching changes on the server', async () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    ...baseRow,
    change_id: `change-${index + 1}`,
    google_campaign_id: `${100 + index}`,
    campaign_name: `AC Campaign ${index + 1}`,
  }));
  const dataSource = { query: async () => rows };
  const accountRegistry = {
    getOrCreate: async () => ({
      id: 'account-1',
      customerId: '1234567890',
      displayName: 'Test account',
      currencyCode: 'USD',
    }),
  };
  const service = new CreativeOperationsService(
    dataSource as any,
    accountRegistry as any,
    {} as any,
  );

  const result = await service.getChangeImpact('1234567890', '14', {
    search: 'AC',
    source: 'MANUAL',
    verdict: 'IMPROVED',
    page: '2',
    pageSize: '10',
  });

  assert.equal(result.changes.length, 10);
  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 10,
    total: 30,
    totalPages: 3,
  });
  assert.equal(result.changes[0].id, 'change-11');
});

test('change history searches all records and returns paginated Vietnamese UI data', async () => {
  const queries: Array<{ sql: string; parameters: unknown[] }> = [];
  const historyRow = {
    id: 'change-2',
    source: 'AI_APPROVED',
    status: 'APPLIED',
    requested_at: new Date('2026-07-20T08:00:00Z'),
    completed_at: new Date('2026-07-20T08:01:00Z'),
    error_message: null,
    google_campaign_id: '300',
    campaign_name: 'AC Search',
    google_ad_group_id: '400',
    ad_group_name: 'AC Brand',
    change_types: 'TEXT_REPLACE',
    replacement_count: 3,
    automated: true,
  };
  let call = 0;
  const dataSource = {
    query: async (sql: string, parameters: unknown[]) => {
      queries.push({ sql, parameters: [...parameters] });
      call += 1;
      return call === 1 ? [{ total: 51 }] : [historyRow];
    },
  };
  const accountRegistry = {
    getOrCreate: async () => ({ id: 'account-1', customerId: '1234567890' }),
  };
  const service = new CreativeOperationsService(
    dataSource as any,
    accountRegistry as any,
    {} as any,
  );

  const result = await service.getChangeHistory('1234567890', {
    search: 'AC',
    source: 'AI_AUTOMATION',
    status: 'APPLIED',
    page: '2',
    pageSize: '25',
  });

  assert.match(queries[0].sql, /c\.name ILIKE \$2/);
  assert.match(queries[0].sql, /automation_runs/);
  assert.deepEqual(queries[0].parameters, ['account-1', '%AC%', 'APPLIED']);
  assert.deepEqual(queries[1].parameters, ['account-1', '%AC%', 'APPLIED', 25, 25]);
  assert.equal(result.items[0].campaign?.name, 'AC Search');
  assert.equal(result.items[0].origin, 'AI_AUTOMATION');
  assert.deepEqual(result.items[0].changeTypes, ['TEXT_REPLACE']);
  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 25,
    total: 51,
    totalPages: 3,
  });
});

test('change history detail is scoped to the selected account and returns before/after payloads', async () => {
  const queries: Array<{ sql: string; parameters: unknown[] }> = [];
  const dataSource = {
    query: async (sql: string, parameters: unknown[]) => {
      queries.push({ sql, parameters });
      return [{
        change_request_id: 'change-3',
        source: 'MANUAL',
        request_status: 'APPLIED',
        requested_at: new Date('2026-07-21T08:00:00Z'),
        completed_at: new Date('2026-07-21T08:01:00Z'),
        request_error_message: null,
        id: 'item-1',
        change_type: 'TEXT_REPLACE',
        media_type: null,
        before_payload: { changes: [{ oldText: 'Cũ', newText: 'Mới' }] },
        after_payload: { adText: { headlines: ['Mới'] } },
        old_asset_resource_name: null,
        new_asset_resource_name: null,
        old_ad_resource_name: 'customers/1/ads/old',
        new_ad_resource_name: 'customers/1/ads/new',
        replacement_count: 1,
        status: 'APPLIED',
        error_code: null,
        error_message: null,
      }];
    },
  };
  const accountRegistry = {
    getOrCreate: async () => ({ id: 'account-1', customerId: '1234567890' }),
  };
  const service = new CreativeOperationsService(
    dataSource as any,
    accountRegistry as any,
    {} as any,
  );

  const result = await service.getChangeHistoryDetail('1234567890', 'change-3');

  assert.match(queries[0].sql, /cr\.id = \$1 AND cr\.account_id = \$2/);
  assert.deepEqual(queries[0].parameters, ['change-3', 'account-1']);
  assert.deepEqual(result.items[0].before, {
    changes: [{ oldText: 'Cũ', newText: 'Mới' }],
  });
  assert.equal(result.items[0].replacementCount, 1);
});
