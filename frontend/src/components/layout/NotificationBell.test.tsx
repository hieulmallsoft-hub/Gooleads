import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell, type AppNotification } from './NotificationBell';

const appliedNotification: AppNotification = {
  id: 'automation-1',
  severity: 'success',
  title: 'AI định kỳ vừa cập nhật Chiến dịch AC',
  message: 'Nhóm quảng cáo AC 1 · Đã thay 2 nội dung quảng cáo.',
  targetLabel: 'Đã áp dụng tự động',
  recommendations: [],
  createdAtLabel: '03/08/2026, 10:00',
  action: 'APPLIED',
  actionLabel: 'Xem chi tiết thay đổi',
  changeRequestId: 'change-1',
};

afterEach(cleanup);

describe('NotificationBell', () => {
  it('chỉ xóa số chưa đọc khi người dùng chủ động đánh dấu đã đọc', async () => {
    const user = userEvent.setup();
    render(<NotificationBell notifications={[appliedNotification]} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    expect(screen.getByText('1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }));
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('hiển thị thông báo dễ hiểu và mở đúng chi tiết', async () => {
    const user = userEvent.setup();
    const onOpenNotification = vi.fn();
    render(
      <NotificationBell
        notifications={[appliedNotification]}
        onOpenNotification={onOpenNotification}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    expect(screen.getByText('AI định kỳ vừa cập nhật Chiến dịch AC')).toBeInTheDocument();
    expect(screen.queryByText(/RESOURCE_EXHAUSTED/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /AI định kỳ vừa cập nhật Chiến dịch AC/ }));
    expect(onOpenNotification).toHaveBeenCalledWith(appliedNotification);
  });
});
