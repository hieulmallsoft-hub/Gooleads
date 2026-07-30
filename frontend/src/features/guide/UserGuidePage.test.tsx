import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UserGuidePage } from './UserGuidePage';

afterEach(cleanup);

describe('Trang hướng dẫn sử dụng', () => {
  it('có mục lục và hướng dẫn các luồng chính', () => {
    render(<UserGuidePage />);
    expect(screen.getByRole('heading', { name: 'Hướng dẫn sử dụng GG Ads' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Mục lục hướng dẫn' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dùng ai/i })).toHaveAttribute('href', '#ai');
    expect(screen.getByRole('heading', { name: 'Kiểm tra thay đổi có hiệu quả không' })).toBeInTheDocument();
    expect(screen.getAllByText(/Đồng bộ Google Ads/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Người chỉnh sửa/)).toBeInTheDocument();
    expect(screen.getByText('Ảnh 1 — Chọn tài khoản và tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Ảnh 3 — Tạo và phê duyệt đề xuất AI')).toBeInTheDocument();
    expect(screen.getByText('Ảnh 4 — Đồng bộ, đo lường và xem lịch sử')).toBeInTheDocument();
  });

  it('giải thích rõ điều kiện đủ dữ liệu trước khi kết luận', () => {
    render(<UserGuidePage />);
    expect(screen.getByText(/đủ toàn bộ 7, 14 hoặc 30 ngày/i)).toBeInTheDocument();
  });
});
