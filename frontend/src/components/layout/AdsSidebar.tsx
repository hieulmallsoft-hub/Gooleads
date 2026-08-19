import {
  BarChart3,
  Bot,
  ChartNoAxesCombined,
  Eye,
  FileText,
  BookOpen,
  MousePointerClick,
  Settings,
  Sparkles,
  Zap,
  X,
} from 'lucide-react';
import type { OperationsSection } from '../OperationsPanel';
import type { ViewMode } from '../../types/googleAds';

type AdsSidebarProps = {
  open: boolean;
  viewMode: ViewMode;
  operationsSection: OperationsSection | null;
  onClose: () => void;
  onOpenOperations: (section: OperationsSection) => void;
  onOpenCampaigns: () => void;
  onOpenAdGroups: () => void;
};

export function AdsSidebar({
  open,
  viewMode,
  operationsSection,
  onClose,
  onOpenOperations,
  onOpenCampaigns,
  onOpenAdGroups,
}: AdsSidebarProps) {
  const navAction = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <>
      {open ? (
        <button
          className="navBackdrop visible"
          type="button"
          aria-label="Đóng menu"
          onClick={onClose}
        />
      ) : null}
      <aside className={`adsNav ${open ? 'open' : ''}`} aria-label="Điều hướng Google Ads">
        <div className="navHeader">
          <div className="navHeaderTitle">
            <Zap size={14} className="navHeaderIcon" />
            <span>Bàn Làm Việc</span>
          </div>
          <button className="iconButton navClose" type="button" aria-label="Đóng menu" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <nav>
          <div className="navSectionLabel">Trực Quan & AI</div>
          <button
            type="button"
            className={operationsSection === 'overview' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('overview'))}
          >
            <div className="navIconBox navIcon-overview"><Eye size={15} /></div>
            <span>Tổng quan tài khoản</span>
          </button>
          <button
            type="button"
            className={operationsSection === 'impact' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('impact'))}
          >
            <div className="navIconBox navIcon-impact"><ChartNoAxesCombined size={15} /></div>
            <span>Theo dõi tác động ROI</span>
            <span className="navPillBadge">New</span>
          </button>
          <button
            type="button"
            className={operationsSection === 'automation' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('automation'))}
          >
            <div className="navIconBox navIcon-auto"><Bot size={15} /></div>
            <span>Tự động hóa AI</span>
            <Sparkles size={12} className="navSparkle" />
          </button>

          <div className="navSectionLabel">Quản Lý Quảng Cáo</div>
          <button
            type="button"
            className={!operationsSection && viewMode === 'campaigns' ? 'active' : ''}
            onClick={navAction(onOpenCampaigns)}
          >
            <div className="navIconBox navIcon-campaigns"><BarChart3 size={15} /></div>
            <span>Chiến dịch</span>
          </button>
          <button
            type="button"
            className={!operationsSection && viewMode === 'adGroups' ? 'active' : ''}
            onClick={navAction(onOpenAdGroups)}
          >
            <div className="navIconBox navIcon-adgroups"><MousePointerClick size={15} /></div>
            <span>Nhóm quảng cáo</span>
          </button>

          <div className="navSectionLabel">Hệ Thống</div>
          <button
            type="button"
            className={operationsSection === 'settings' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('settings'))}
          >
            <div className="navIconBox navIcon-settings"><Settings size={15} /></div>
            <span>Cài đặt & Chính sách</span>
          </button>
          <button
            type="button"
            className={operationsSection === 'guide' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('guide'))}
          >
            <div className="navIconBox navIcon-guide"><BookOpen size={15} /></div>
            <span>Sổ tay hướng dẫn</span>
          </button>
        </nav>

        <div className="navFootnote">
          <div className="securityShieldDot" />
          <span>Chế độ an toàn: Phê duyệt trước khi áp dụng</span>
        </div>
      </aside>
    </>
  );
}
