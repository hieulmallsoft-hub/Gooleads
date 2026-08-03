import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

describe('NotificationBell', () => {
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

    await user.click(screen.getByRole('button', { name: 'Xem chi tiết thay đổi' }));
    expect(onOpenNotification).toHaveBeenCalledWith(appliedNotification);
  });
});
