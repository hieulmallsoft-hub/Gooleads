import assert from 'node:assert/strict';
import test from 'node:test';
import { AiReviewService } from './ai-review.service';

test('AI text suggestions sync, authorize, generate, then persist', async () => {
  const calls: string[] = [];
  const service = new AiReviewService(
    { sync: async () => calls.push('sync') } as any,
    { generateAiTextSuggestions: async () => (calls.push('generate'), { suggestions: [1] }) } as any,
    { saveTextSuggestions: async () => (calls.push('save'), { reviewRunId: 'r1' }) } as any,
    { assertCanEditAdGroup: async () => calls.push('access') } as any,
  );
  const result = await service.generateTextSuggestions(
    '1234567890',
    'ag1',
    'TODAY',
    { role: 'EDITOR' } as any,
  );
  assert.deepEqual(result, { reviewRunId: 'r1' });
  assert.deepEqual(calls, ['sync', 'access', 'generate', 'save']);
});
