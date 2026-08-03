import { AlertTriangle, Bell, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';

export type AppNotification = {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  targetLabel: string;
  recommendations: string[];
  createdAtLabel: string;
  action?: string;
  actionLabel?: string;
  changeRequestId?: string | null;
};

type NotificationBellProps = {
  notifications: AppNotification[];
  onOpenNotification?: (notification: AppNotification) => void;
};

const severityIcon = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

export function NotificationBell({ notifications, onOpenNotification }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !seenIds.includes(notification.id)).length,
    [notifications, seenIds],
  );

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      if (next) {
        setSeenIds((ids) =>
          Array.from(new Set([...ids, ...notifications.map((notification) => notification.id)])),
        );
      }
      return next;
    });
  }

  return (
    <div className="notificationRoot">
      <button
        className="iconButton notificationButton"
        type="button"
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 ? <span className="notificationBadge">{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notificationPanel" role="dialog" aria-label="Thông báo chiến dịch">
          <div className="notificationHeader">
            <div>
              <strong>Thông báo hoạt động</strong>
              <span>{notifications.length} thông báo gần đây</span>
            </div>
            <button className="iconButton" type="button" aria-label="Đóng thông báo" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          {notifications.length > 0 ? (
            <div className="notificationList">
              {notifications.map((notification) => {
                const Icon = severityIcon[notification.severity];

                return (
                  <button
                    type="button"
                    className={`notificationItem ${notification.severity}${notification.actionLabel && onOpenNotification ? ' clickable' : ''}`}
                    key={notification.id}
                    disabled={!notification.actionLabel || !onOpenNotification}
                    onClick={() => {
                      if (!notification.actionLabel || !onOpenNotification) return;
                      setOpen(false);
                      onOpenNotification(notification);
                    }}
                  >
                    <span className="notificationIcon">
                      <Icon size={16} />
                    </span>
                    <div>
                      <div className="notificationMeta">
                        <span>{notification.targetLabel}</span>
                        <span>{notification.createdAtLabel}</span>
                      </div>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <ul>
                        {notification.recommendations.map((recommendation) => (
                          <li key={recommendation}>{recommendation}</li>
                        ))}
                      </ul>
                      {notification.actionLabel && onOpenNotification ? (
                        <span className="notificationAction">
                          {notification.actionLabel}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="notificationEmpty">
              <CheckCircle2 size={22} />
              <strong>Không có cảnh báo khẩn cấp</strong>
              <span>Tải dữ liệu chiến dịch hoặc tài nguyên để hệ thống kiểm tra hiệu quả.</span>
            </div>
          )}

          <div className="notificationFooter">
            <Sparkles size={14} />
            <span>Nhấn “Xem chi tiết thay đổi” để xem nội dung trước và sau khi AI áp dụng.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
