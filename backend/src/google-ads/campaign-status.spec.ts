import assert from 'node:assert/strict';
import test from 'node:test';
import { GoogleAdsService } from './google-ads.service';

test('campaign performance includes paused campaigns and returns their Google Ads status', async () => {
  const capturedQueries: string[] = [];
  const queryService = {
    searchAll: async (_customerId: string, query: string) => {
      capturedQueries.push(query);
      return {
        results: [{
          campaign: { id: '100', name: 'Paused campaign', status: 'PAUSED' },
          metrics: {
            impressions: 50,
            clicks: 5,
            costMicros: 10_000_000,
            conversions: 1,
            conversionsValue: 20,
          },
        }],
      };
    },
  };
  const service = new GoogleAdsService(
    {} as any,
    queryService as any,
    {} as any,
  );

  const result = await service.getCampaignPerformance('1234567890', 'LAST_7_DAYS');

  assert.equal(capturedQueries.length, 2);
  assert.match(capturedQueries[0], /campaign\.status != REMOVED/);
  assert.doesNotMatch(capturedQueries[0], /segments\.date/);
  assert.match(capturedQueries[1], /segments\.date DURING LAST_7_DAYS/);
  assert.doesNotMatch(capturedQueries[0], /campaign\.status = ENABLED/);
  assert.equal(result.campaigns[0].status, 'PAUSED');
});

test('campaign performance uses the current status list and ignores stale metric-only rows', async () => {
  let call = 0;
  const queryService = {
    searchAll: async () => {
      call += 1;
      return call === 1
        ? { results: [{ campaign: { id: '200', name: 'Current', status: 'ENABLED' } }] }
        : { results: [{ campaign: { id: '100', name: 'Deleted', status: 'ENABLED' }, metrics: { impressions: 9 } }] };
    },
  };
  const service = new GoogleAdsService({} as any, queryService as any, {} as any);

  const result = await service.getCampaignPerformance('1234567890', 'TODAY');

  assert.deepEqual(result.campaigns.map((campaign) => campaign.id), ['200']);
});

test('ad group performance includes paused campaigns and paused ad groups', async () => {
  let capturedQuery = '';
  const queryService = {
    searchAll: async (_customerId: string, query: string) => {
      capturedQuery = query;
      return { results: [] };
    },
  };
  const service = new GoogleAdsService(
    {} as any,
    queryService as any,
    {} as any,
  );

  await service.getAdGroupPerformance('1234567890', 'LAST_7_DAYS');

  assert.match(capturedQuery, /campaign\.status != REMOVED/);
  assert.match(capturedQuery, /ad_group\.status != REMOVED/);
});
