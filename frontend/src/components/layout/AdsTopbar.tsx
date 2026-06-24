import { Menu, Search, Settings } from 'lucide-react';
import allsoftLogo from '../../assets/allsoft-logo-cropped.png';

type AdsTopbarProps = {
  customerId: string;
  searchText: string;
  searchPlaceholder: string;
  showSearch: boolean;
  onSearchChange: (value: string) => void;
  onMenuToggle: () => void;
  onOpenSettings: () => void;
};

export function AdsTopbar({
  customerId,
  searchText,
  searchPlaceholder,
  showSearch,
  onSearchChange,
  onMenuToggle,
  onOpenSettings,
}: AdsTopbarProps) {
  return (
    <header className="adsTopbar">
      <div className="topbarBrand">
        <button
          className="iconButton"
          type="button"
          aria-label="Open navigation"
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
        <span>{customerId || 'No customer'}</span>
        <button
          className="iconButton"
          type="button"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
