import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateRangeFilter } from '../filters/DateRangeFilter';
import { AssetWorkflow } from './AssetWorkflow';

afterEach(cleanup);

describe('Giao diện tiếng Việt và khả năng truy cập', () => {
  it('hiển thị quy trình tài nguyên hoàn toàn bằng tiếng Việt', () => {
    render(
      <AssetWorkflow
        hasAdGroup
        hasAssets
        hasSuggestions={false}
        approvedCount={0}
      />,
    );
    expect(screen.getByRole('region', { name: 'Quy trình tối ưu tài nguyên' })).toBeInTheDocument();
    expect(screen.getByText('Kiểm tra tài nguyên')).toBeInTheDocument();
    expect(screen.getByText('Kiểm tra đề xuất AI')).toBeInTheDocument();
    expect(screen.queryByText('Review assets')).not.toBeInTheDocument();
  });

  it('bộ lọc ngày dùng nhãn tiếng Việt và chỉ áp dụng khoảng hợp lệ', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value="LAST_7_DAYS" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /tùy chỉnh/i }));
    expect(screen.getByText('Khoảng ngày tùy chỉnh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Đóng lịch' })).toHaveAttribute('type', 'button');
  });
});
