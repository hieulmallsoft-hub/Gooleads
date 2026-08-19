import { LogOut, Menu, Search, Settings, ShieldCheck } from 'lucide-react';
import allsoftLogo from '../../assets/allsoft-logo-cropped.png';
import { NotificationBell, type AppNotification } from './NotificationBell';
import type { AuthUser } from '../../types/googleAds';

type AdsTopbarProps = {
  customerId: string;
  customerLabel: string;
  searchText: string;
  searchPlaceholder: string;
  showSearch: boolean;
  notifications: AppNotification[];
  currentUser: AuthUser | null;
  onSearchChange: (value: string) => void;
  onMenuToggle: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onOpenNotification: (notification: AppNotification) => void;
};

export function AdsTopbar({
  customerId,
  customerLabel,
  searchText,
  searchPlaceholder,
  showSearch,
  notifications,
  currentUser,
  onSearchChange,
  onMenuToggle,
  onOpenSettings,
  onLogout,
  onOpenNotification,
}: AdsTopbarProps) {
  return (
    <header className="adsTopbar">
      <div className="topbarBrand">
        <button
          className="iconButton brandMenuBtn"
          type="button"
          aria-label="Mở menu"
          onClick={onMenuToggle}
        >
          <Menu size={18} />
        </button>
        <div className="brandLogoWrap">
          <img src={allsoftLogo} alt="ALLSOFT" />
          <div className="brandBadge">
            <span>Google Ads Suite</span>
          </div>
        </div>
      </div>

      {showSearch ? (
        <label className="topSearch">
          <Search size={15} className="topSearchIcon" />
          <input
            aria-label={searchPlaceholder}
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <kbd className="topSearchKbd">Tìm kiếm</kbd>
        </label>
      ) : (
        <span />
      )}

      <div className="topbarMeta">
        <div className="topbarAccount" title={customerLabel || customerId}>
          <div className="accountStatusRow">
            <span className="livePulseDot" />
            <small>Tài khoản Google Ads</small>
          </div>
          <strong>{customerLabel || customerId || 'Chưa chọn tài khoản'}</strong>
        </div>

        {currentUser ? (
          <div className={`roleBadge role-${currentUser.role.toLowerCase()}`} title={`Quyền: ${currentUser.role}`}>
            <ShieldCheck size={13} className="roleIcon" />
            <span>{currentUser.displayName}</span>
            <small>({currentUser.role})</small>
          </div>
        ) : null}

        <div className="topbarActions">
          <NotificationBell notifications={notifications} onOpenNotification={onOpenNotification} />
          <button
            className="iconButton topbarActionBtn"
            type="button"
            aria-label="Cài đặt"
            onClick={onOpenSettings}
            title="Cài đặt hệ thống"
          >
            <Settings size={17} />
          </button>
          <button
            className="iconButton topbarActionBtn logoutBtn"
            type="button"
            aria-label="Đăng xuất"
            onClick={onLogout}
            title="Đăng xuất"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
