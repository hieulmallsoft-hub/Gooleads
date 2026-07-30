import { LogOut, Menu, Search, Settings } from 'lucide-react';
import allsoftLogo from '../../assets/allsoft-logo-cropped.png';
import { NotificationBell, type AppNotification } from './NotificationBell';
import type { AuthUser } from '../../types/googleAds';

type AdsTopbarProps = {
  customerId: string;
  searchText: string;
  searchPlaceholder: string;
  showSearch: boolean;
  notifications: AppNotification[];
  currentUser: AuthUser | null;
  onSearchChange: (value: string) => void;
  onMenuToggle: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function AdsTopbar({
  customerId,
  searchText,
  searchPlaceholder,
  showSearch,
  notifications,
  currentUser,
  onSearchChange,
  onMenuToggle,
  onOpenSettings,
  onLogout,
}: AdsTopbarProps) {
  return (
    <header className="adsTopbar">
      <div className="topbarBrand">
        <button
          className="iconButton"
          type="button"
          aria-label="Mở menu"
          onClick={onMenuToggle}
        >
          <Menu size={20} />
        </button>
        <img src={allsoftLogo} alt="ALLSOFT" />
        <span>Google Ads</span>
      </div>

      {showSearch ? (
        <label className="topSearch">
          <Search size={16} />
          <input
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
      ) : (
        <span />
      )}

      <div className="topbarMeta">
        <span>{customerId || 'Chưa chọn tài khoản'}</span>
        {currentUser ? (
          <span className={`roleBadge role-${currentUser.role.toLowerCase()}`}>
            {currentUser.displayName} · {currentUser.role}
          </span>
        ) : null}
        <NotificationBell notifications={notifications} />
        <button
          className="iconButton"
          type="button"
          aria-label="Cài đặt"
          onClick={onOpenSettings}
        >
          <Settings size={18} />
        </button>
        <button
          className="iconButton"
          type="button"
          aria-label="Đăng xuất"
          onClick={onLogout}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
