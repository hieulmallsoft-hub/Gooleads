import { describe, expect, it } from 'vitest';
import { assetTitle, getAssetPreviewUrl, getMediaReplacementType } from './assets';
import {
  countRangeDays,
  formatTimeRangeLabel,
  parseCustomDateRange,
  serializeCustomDateRange,
} from './dateRange';
import { assessmentClass, formatPercent, roasClass } from './format';

describe('date range utilities', () => {
  it('round-trips a custom range and counts inclusively', () => {
    const range = { startDate: '2026-07-01', endDate: '2026-07-07' };
    expect(parseCustomDateRange(serializeCustomDateRange(range))).toEqual(range);
    expect(countRangeDays(range)).toBe(7);
    expect(formatTimeRangeLabel('2026-07-01,2026-07-07')).toContain('Jul');
  });

  it('rejects malformed ranges', () => {
    expect(parseCustomDateRange('TODAY')).toBeNull();
    expect(parseCustomDateRange('2026-7-1,2026-7-2')).toBeNull();
  });
});

describe('asset and display utilities', () => {
  it('detects media types and preview URLs', () => {
    const video = { id: '1', type: 'YOUTUBE_VIDEO', fieldType: '', videoId: 'abc' } as any;
    const image = { id: '2', type: 'IMAGE', fieldType: '', imageUrl: '/image.png' } as any;
    expect(getMediaReplacementType(video)).toBe('VIDEO');
    expect(getAssetPreviewUrl(video)).toContain('/abc/hqdefault.jpg');
    expect(getMediaReplacementType(image)).toBe('IMAGE');
    expect(assetTitle(image)).toBe('/image.png');
  });

  it('classifies performance consistently', () => {
    expect(formatPercent(0.1234)).toBe('12.34%');
    expect(roasClass(1)).toBe('good');
    expect(roasClass(0.7)).toBe('weak');
    expect(roasClass(0.69)).toBe('poor');
    expect(assessmentClass('Need more data')).toBe('weak');
  });
});
