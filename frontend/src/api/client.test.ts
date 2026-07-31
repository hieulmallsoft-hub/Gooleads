import { describe, expect, it } from 'vitest';
import { toVietnameseApiError } from './client';

describe('toVietnameseApiError', () => {
  it('không ghi nhầm lỗi quota Google Ads thành lỗi dịch vụ AI', () => {
    const message = toVietnameseApiError(
      'Too many requests. Retry in 70389 seconds. | quotaError: RESOURCE_EXHAUSTED',
    );

    expect(message).toContain('Google Ads API');
    expect(message).not.toContain('Dịch vụ AI');
  });

  it('vẫn nhận diện lỗi quota riêng của dịch vụ AI', () => {
    expect(toVietnameseApiError('insufficient_quota')).toContain('Dịch vụ AI');
  });
});
