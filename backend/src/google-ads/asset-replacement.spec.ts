import assert from 'node:assert/strict';
import test from 'node:test';
import { AssetReplacementService } from './asset-replacement.service';

const user = { id: 'u1', role: 'EDITOR', accountAccess: [] } as any;

function setup() {
  const calls: string[] = [];
  const sync = {
    sync: async () => calls.push('sync'),
    markTextReplacementsApplied: async () => calls.push('mark'),
  };
  const ads = {
    previewLowTextReplacement: async () => {
      calls.push('preview');
      return { changes: [] };
    },
    replaceLowTextAssets: async () => {
      calls.push('replace');
      return { replacedAds: [{ oldResourceName: 'old/ad/1' }] };
    },
    replaceMediaAsset: async () => {
      calls.push('replace-media');
      return { ok: true };
    },
  };
  const persistence = { saveMediaChange: async () => calls.push('save-media') };
  const changes = {
    createTextChangeRequest: async () => {
      calls.push('create-request');
      return { id: 'cr1' };
    },
    getTextChangeRequestForApply: async () => ({
      customerId: '1234567890',
      adGroupId: 'ag1',
      timeRange: 'TODAY',
      input: {},
    }),
    completeTextChangeRequest: async () => {
      calls.push('complete');
      return { id: 'cr1', status: 'APPLIED' };
    },
    failChangeRequest: async () => calls.push('fail'),
  };
  const access = {
    assertCanEditAdGroup: async () => calls.push('access'),
    assertCanApplyChangeRequest: async () => calls.push('access-apply'),
  };
  return {
    calls,
    service: new AssetReplacementService(sync as any, ads as any, persistence as any, changes as any, access as any),
    ads,
  };
}

test('text preview syncs and authorizes before creating a change request', async () => {
  const { service, calls } = setup();
  await service.createTextChangeRequest('1234567890', 'ag1', 'TODAY', {}, user);
  assert.deepEqual(calls, ['sync', 'access', 'preview', 'create-request']);
});

test('applying text marks local state and completes the request', async () => {
  const { service, calls } = setup();
  const result = await service.applyTextChangeRequest('cr1', user);
  assert.equal(result.changeRequest.status, 'APPLIED');
  assert.deepEqual(calls, ['access-apply', 'replace', 'mark', 'complete']);
});

test('failed Google mutation marks the change request failed', async () => {
  const { service, calls, ads } = setup();
  ads.replaceLowTextAssets = async () => {
    calls.push('replace');
    throw new Error('mutation failed');
  };
  await assert.rejects(() => service.applyTextChangeRequest('cr1', user), /mutation failed/);
  assert.deepEqual(calls, ['access-apply', 'replace', 'fail']);
});

test('media replacement persists an audit record after mutation', async () => {
  const { service, calls } = setup();
  await service.replaceMedia(
    '1234567890',
    'ag1',
    'TODAY',
    { mediaType: 'IMAGE', oldAssetResourceName: 'assets/1', imageFile: { originalname: 'new.png' } },
    user,
  );
  assert.deepEqual(calls, ['sync', 'access', 'replace-media', 'save-media']);
});
