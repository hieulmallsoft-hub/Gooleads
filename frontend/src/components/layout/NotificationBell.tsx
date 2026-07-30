import { AlertTriangle, Bell, CheckCircle2, Info, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';

export type AppNotification = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  targetLabel: string;
  recommendations: string[];
  createdAtLabel: string;
};

type NotificationBellProps = {
  notifications: AppNotification[];
};

const severityIcon = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

export function NotificationBell({ notifications }: NotificationBellProps) {
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
        aria-label="Notifications"
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
              <strong>Giám sát chiến dịch bằng AI</strong>
              <span>{notifications.length} alerts from loaded data</span>
            </div>
            <button className="iconButton" type="button" aria-label="Close notifications" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          {notifications.length > 0 ? (
            <div className="notificationList">
              {notifications.map((notification) => {
                const Icon = severityIcon[notification.severity];

                return (
                  <article className={`notificationItem ${notification.severity}`} key={notification.id}>
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
                    </div>
                  </article>
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
            <span>Cảnh báo dựa trên số liệu hiện tại của chiến dịch, nhóm quảng cáo và tài nguyên.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
