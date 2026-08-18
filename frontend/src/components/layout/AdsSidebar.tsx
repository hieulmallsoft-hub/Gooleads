import {
  BarChart3,
  Bot,
  ChartNoAxesCombined,
  Eye,
  FileText,
  BookOpen,
  MousePointerClick,
  Settings,
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
      <button
        className={`navBackdrop ${open ? 'visible' : ''}`}
        type="button"
        aria-label="Đóng menu"
        onClick={onClose}
      />
      <aside className={`adsNav ${open ? 'open' : ''}`} aria-label="Điều hướng Google Ads">
        <div className="navHeader">
          <span>Không gian làm việc</span>
          <button className="iconButton navClose" type="button" aria-label="Đóng menu" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <nav>
          <button
            type="button"
            className={operationsSection === 'overview' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('overview'))}
          >
            <Eye size={16} />
            Tổng quan
          </button>
          <button
            type="button"
            className={operationsSection === 'impact' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('impact'))}
          >
            <ChartNoAxesCombined size={16} />
            Theo dõi thay đổi
          </button>
          <button
            type="button"
            className={operationsSection === 'automation' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('automation'))}
          >
            <Bot size={16} />
            Automation
          </button>
          <div className="navSectionLabel">Google Ads</div>
          <button
            type="button"
            className={!operationsSection && viewMode === 'campaigns' ? 'active' : ''}
            onClick={navAction(onOpenCampaigns)}
          >
            <BarChart3 size={16} />
            Chiến dịch
          </button>
          <button
            type="button"
            className={!operationsSection && viewMode === 'adGroups' ? 'active' : ''}
            onClick={navAction(onOpenAdGroups)}
          >
            <MousePointerClick size={16} />
            Nhóm quảng cáo
          </button>
          <div className="navSectionLabel">Cấu hình</div>
          <button
            type="button"
            className={operationsSection === 'settings' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('settings'))}
          >
            <Settings size={16} />
            Cài đặt
          </button>
          <button
            type="button"
            className={operationsSection === 'guide' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('guide'))}
          >
            <BookOpen size={16} />
            Hướng dẫn sử dụng
          </button>
        </nav>
        <div className="navFootnote">
          <FileText size={14} />
          Thay đổi cần được phê duyệt
        </div>
      </aside>
    </>
  );
}
