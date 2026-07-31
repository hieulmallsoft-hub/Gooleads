import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OperationsPanel } from './OperationsPanel';

const settingsResponse = {
  account: {
    customerId: '9920642691',
    displayName: 'Tài khoản thử nghiệm',
    status: 'ACTIVE',
    timeZone: 'Asia/Ho_Chi_Minh',
    lastSyncedAt: null,
  },
  policy: {
    name: 'Chính sách mặc định',
    languageStrategy: 'DETECT_FROM_ASSET',
    targetLanguage: null,
    selectionCriteria: {},
    headlineMaxLength: 30,
    descriptionMaxLength: 90,
    approvalMode: 'MANUAL',
    reviewIntervalDays: 14,
    minimumImpressions: '0',
    minimumClicks: '0',
    cooldownDays: 14,
    maxChangesPerRun: 10,
  },
  schedule: null,
  recentAutomationRuns: [],
  providers: {
    googleAdsConfigured: true,
    geminiConfigured: true,
  },
};

describe('OperationsPanel đổi mật khẩu', () => {
  it('gửi đủ ba trường và yêu cầu đăng nhập lại khi thành công', async () => {
    const user = userEvent.setup();
    const onPasswordChanged = vi.fn();
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/creative-operations/settings')) {
        return new Response(JSON.stringify(settingsResponse), { status: 200 });
      }
      if (path === '/admin/users') {
        return new Response(JSON.stringify({ users: [] }), { status: 200 });
      }
      if (path === '/auth/change-password') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(
      <OperationsPanel
        section="settings"
        customerId="9920642691"
        request={request}
        currentUser={{
          id: 'user-1',
          email: 'admin@allsoft.local',
          displayName: 'Admin',
          status: 'ACTIVE',
          workspaceId: 'workspace-1',
          role: 'ADMIN',
          permissions: ['rules.manage', 'automation.manage', 'users.manage'],
          accountAccess: [],
        }}
        campaigns={[]}
        onOpenAssets={() => undefined}
        onPasswordChanged={onPasswordChanged}
      />,
    );

    await screen.findByRole('heading', { name: 'Đổi mật khẩu' });
    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'Current@123');
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'NewPassword@456');
    await user.type(
      screen.getByLabelText('Nhập lại mật khẩu mới'),
      'NewPassword@456',
    );
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(request).toHaveBeenCalledWith(
      '/auth/change-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'Current@123',
          newPassword: 'NewPassword@456',
          confirmPassword: 'NewPassword@456',
        }),
      }),
    );
    expect(onPasswordChanged).toHaveBeenCalledOnce();
  });
});
