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

  it('không ghi nhầm PERMISSION_DENIED của Gemini thành thiếu quyền campaign', () => {
    const message = toVietnameseApiError(
      'Gemini API request failed | Status: PERMISSION_DENIED | Code: 403',
    );

    expect(message).toContain('Dịch vụ AI từ chối yêu cầu');
    expect(message).toContain('API key');
    expect(message).not.toContain('quyền campaign');
  });

  it('vẫn phân loại USER_PERMISSION_DENIED là quyền truy cập Google Ads', () => {
    const message = toVietnameseApiError('USER_PERMISSION_DENIED');

    expect(message).toContain('Tài khoản Google Ads/API');
    expect(message).not.toContain('Dịch vụ AI từ chối');
  });

  it('vẫn hiển thị lỗi phân quyền nội bộ cho ForbiddenException', () => {
    expect(toVietnameseApiError('Forbidden')).toContain('quyền campaign');
  });
});
