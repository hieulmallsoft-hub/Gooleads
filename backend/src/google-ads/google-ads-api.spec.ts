import assert from 'node:assert/strict';
import test from 'node:test';
import { GoogleAdsApiService } from './google-ads-api.service';

function bareService() {
  return Object.create(GoogleAdsApiService.prototype) as GoogleAdsApiService;
}

test('searchAll follows page tokens and combines every result', async () => {
  const service = bareService() as any;
  const payloads: any[] = [];
  service.requestGoogleAds = async (_customerId: string, _path: string, payload: any) => {
    payloads.push(payload);
    return payload.pageToken
      ? { results: [{ id: 2 }] }
      : { results: [{ id: 1 }], nextPageToken: 'next' };
  };
  assert.deepEqual(await service.searchAll('123-456-7890', 'SELECT x'), {
    results: [{ id: 1 }, { id: 2 }],
  });
  assert.deepEqual(payloads, [
    { query: 'SELECT x' },
    { query: 'SELECT x', pageToken: 'next' },
  ]);
});

test('customer IDs and Google Ads errors are normalized safely', () => {
  const service = bareService() as any;
  assert.equal(service.normalizeCustomerId('123-456-7890'), '1234567890');
  assert.equal(service.normalizeCustomerId('123'), undefined);
  assert.match(
    service.formatGoogleAdsError({
      error: {
        message: 'Invalid request',
        details: [{
          errors: [{
            message: 'Bad field',
            errorCode: { requestError: 'INVALID_INPUT' },
            location: { fieldPathElements: [{ fieldName: 'operations', index: 0 }] },
          }],
        }],
      },
    }),
    /Invalid request: Bad field.*INVALID_INPUT.*operations\[0\]/,
  );
});
