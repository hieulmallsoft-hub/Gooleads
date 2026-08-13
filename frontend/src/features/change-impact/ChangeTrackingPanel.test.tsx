import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeImpactPanel } from './ChangeImpactPanel';

const emptyImpact = {
  account: { customerId: '1234567890', displayName: 'Test', currencyCode: 'VND' },
  windowDays: 14,
  methodology: '',
  totals: { changes: 0, improved: 0, declined: 0, mixed: 0, collecting: 0 },
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
  changes: [],
};

const history = {
  items: [{
    id: 'change-1',
    origin: 'MANUAL',
    status: 'APPLIED',
    requestedAt: '2026-07-20T08:00:00Z',
    completedAt: '2026-07-20T08:01:00Z',
    errorMessage: null,
    campaign: { id: '100', name: 'AC Search' },
    adGroup: { id: '200', name: 'AC Brand' },
    changeTypes: ['TEXT_REPLACE'],
    replacementCount: 1,
  }],
  pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
};

const detail = {
  id: 'change-1',
  items: [{
    id: 'item-1',
    changeType: 'TEXT_REPLACE',
    mediaType: null,
    before: { changes: [{ oldText: 'Nội dung cũ', newText: 'Nội dung mới' }] },
    after: {},
    oldAssetResourceName: null,
    newAssetResourceName: null,
    oldAdResourceName: 'customers/1/ads/10',
    newAdResourceName: 'customers/1/ads/11',
    replacementCount: 1,
    status: 'APPLIED',
    errorMessage: null,
  }],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Theo dõi thay đổi', () => {
  it('hiển thị giá trị chuyển đổi trên chi phí theo phần trăm như Google Ads', async () => {
    const response = {
      ...emptyImpact,
      totals: { changes: 1, improved: 1, declined: 0, mixed: 0, collecting: 0 },
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      changes: [{
        id: 'change-percent',
        source: 'MANUAL',
        origin: 'MANUAL',
        appliedAt: '2026-07-01T00:00:00Z',
        changeTypes: ['TEXT_REPLACE'],
        replacementCount: 1,
        campaign: { id: '1', name: 'Chiến dịch thử nghiệm' },
        adGroup: { id: '2', name: 'Nhóm thử nghiệm' },
        coverage: { requestedDays: 14, beforeDays: 14, afterDays: 14 },
        before: { impressions: 100, clicks: 10, cost: 50, conversions: 2, conversionValue: 100, ctr: .1, conversionRate: .2, cpa: 25, roas: 2 },
        after: { impressions: 120, clicks: 15, cost: 50, conversions: 3, conversionValue: 125, ctr: .125, conversionRate: .2, cpa: 16.67, roas: 2.5 },
        verdict: 'IMPROVED',
      }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));
    render(<ChangeImpactPanel customerId="1234567890" />);
    expect(await screen.findByText('200.00%')).toBeInTheDocument();
    expect(screen.getByText('250.00%')).toBeInTheDocument();
    expect(screen.queryByText('2.00x')).not.toBeInTheDocument();
  });

  it('gửi tìm kiếm hiệu quả lên backend thay vì chỉ lọc dữ liệu đang tải', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(emptyImpact), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ChangeImpactPanel customerId="1234567890" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/tìm tên hoặc id/i), {
      target: { value: 'AC' },
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('q=AC'))).toBe(true);
    });
  });

  it('mở lịch sử và hiển thị nội dung cũ, nội dung mới khi bấm một dòng', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/change-history/change-1') ? detail : history;
      return Promise.resolve(new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ChangeImpactPanel customerId="1234567890" />);

    fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử thay đổi' }));
    expect(await screen.findByText('AC Search')).toBeInTheDocument();
    fireEvent.click(screen.getByText('AC Search'));

    expect((await screen.findAllByText('Trước khi thay đổi')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sau khi thay đổi').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Xem dữ liệu kỹ thuật đầy đủ')).not.toBeInTheDocument();
  });
});
