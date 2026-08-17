import assert from 'node:assert/strict';
import test from 'node:test';
import { GoogleAdsQueryService } from './google-ads-query.service';

test('identical in-flight and fresh Google Ads queries share one API request', async () => {
  let calls = 0;
  let resolveRequest!: (value: any) => void;
  const pending = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  const api = {
    searchAll: async () => {
      calls += 1;
      return pending;
    },
  } as any;
  const service = new GoogleAdsQueryService(api);

  const first = service.searchAll('123-456-7890', 'SELECT   campaign.id');
  const second = service.searchAll('1234567890', ' SELECT campaign.id ');
  resolveRequest({ results: [{ id: 1 }] });

  assert.deepEqual(await first, { results: [{ id: 1 }] });
  assert.deepEqual(await second, { results: [{ id: 1 }] });
  assert.deepEqual(await service.searchAll('1234567890', 'SELECT campaign.id'), {
    results: [{ id: 1 }],
  });
  assert.equal(calls, 1);
});

test('quota errors use the most recent stale successful response', async () => {
  let calls = 0;
  const api = {
    searchAll: async () => {
      calls += 1;
      if (calls === 1) return { results: [{ id: 1 }] };
      throw new Error('429 RESOURCE_EXHAUSTED');
    },
  } as any;
  const service = new GoogleAdsQueryService(api) as any;
  service.freshCacheMs = 0;
  service.staleCacheMs = 60_000;

  assert.deepEqual(await service.searchAll('1234567890', 'SELECT campaign.id'), {
    results: [{ id: 1 }],
  });
  const cacheEntry = [...service.queryCache.values()][0];
  cacheEntry.cachedAt -= 1;

  assert.deepEqual(await service.searchAll('1234567890', 'SELECT campaign.id'), {
    results: [{ id: 1 }],
  });
  assert.equal(calls, 2);
});
