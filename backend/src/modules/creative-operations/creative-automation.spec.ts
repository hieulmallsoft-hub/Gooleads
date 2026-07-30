import assert from 'node:assert/strict';
import test from 'node:test';
import { CreativeAutomationService } from './creative-automation.service';

function service() {
  return new CreativeAutomationService({} as any, {} as any, {} as any, {} as any, {} as any) as any;
}

test('automation filters invalid/duplicate suggestions and respects max changes', () => {
  const result = service().buildReplacementInput([
    { suggestionId: 's1', fieldType: 'HEADLINE', text: 'Old', variants: [{ id: 'v1', content: { text: 'New' } }] },
    { suggestionId: 's2', fieldType: 'DESCRIPTION', text: 'Same', suggestion: 'Same' },
    { suggestionId: 's3', fieldType: 'UNKNOWN', text: 'A', suggestion: 'B' },
    { suggestionId: 's4', fieldType: 'DESCRIPTION', text: 'Long old', suggestion: 'Long new' },
  ], 1);
  assert.deepEqual(result, {
    headlineReplacements: [{ oldText: 'Old', newText: 'New', suggestionId: 's1', variantId: 'v1' }],
    descriptionReplacements: [],
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
