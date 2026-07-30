import assert from 'node:assert/strict';
import test from 'node:test';
import { GoogleAdsService } from './google-ads.service';

test('campaign performance includes paused campaigns and returns their Google Ads status', async () => {
  let capturedQuery = '';
  const queryService = {
    searchAll: async (_customerId: string, query: string) => {
      capturedQuery = query;
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

  assert.match(capturedQuery, /campaign\.status != REMOVED/);
  assert.doesNotMatch(capturedQuery, /campaign\.status = ENABLED/);
  assert.equal(result.campaigns[0].status, 'PAUSED');
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
