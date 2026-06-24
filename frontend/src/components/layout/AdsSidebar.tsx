import {
  BarChart3,
  Eye,
  FileText,
  Image,
  MousePointerClick,
  Search,
  Settings,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import type { OperationsSection } from '../OperationsPanel';
import type { ViewMode } from '../../types/googleAds';

type AssetTypeFilter = 'ALL' | 'VIDEO';

type AdsSidebarProps = {
  open: boolean;
  viewMode: ViewMode;
  operationsSection: OperationsSection | null;
  assetTypeFilter: AssetTypeFilter;
  hasSelectedAdGroup: boolean;
  onClose: () => void;
  onOpenOperations: (section: OperationsSection) => void;
  onOpenCampaigns: () => void;
  onOpenAdGroups: () => void;
  onOpenAssets: (filter?: AssetTypeFilter) => void;
};

export function AdsSidebar({
  open,
  viewMode,
  operationsSection,
  assetTypeFilter,
  hasSelectedAdGroup,
  onClose,
  onOpenOperations,
  onOpenCampaigns,
  onOpenAdGroups,
  onOpenAssets,
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
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside className={`adsNav ${open ? 'open' : ''}`} aria-label="Google Ads navigation">
        <div className="navHeader">
          <span>Workspace</span>
          <button className="iconButton navClose" type="button" aria-label="Close navigation" onClick={onClose}>
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
            Overview
          </button>
          <button
            type="button"
            className={operationsSection === 'recommendations' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('recommendations'))}
          >
            <Sparkles size={16} />
            Recommendations
          </button>
          <div className="navSectionLabel">Google Ads</div>
          <button
            type="button"
            className={!operationsSection && viewMode === 'campaigns' ? 'active' : ''}
            onClick={navAction(onOpenCampaigns)}
          >
            <BarChart3 size={16} />
            Campaigns
          </button>
          <button
            type="button"
            className={!operationsSection && viewMode === 'adGroups' ? 'active' : ''}
            onClick={navAction(onOpenAdGroups)}
          >
            <MousePointerClick size={16} />
            Ad groups
          </button>
          <button
            type="button"
            className={!operationsSection && viewMode === 'assets' && assetTypeFilter === 'ALL' ? 'active' : ''}
            onClick={navAction(() => onOpenAssets('ALL'))}
          >
            <Image size={16} />
            Assets
            {!hasSelectedAdGroup ? <span className="navHint">select group</span> : null}
          </button>
          <button
            type="button"
            className={!operationsSection && viewMode === 'assets' && assetTypeFilter === 'VIDEO' ? 'active' : ''}
            onClick={navAction(() => onOpenAssets('VIDEO'))}
          >
            <Video size={16} />
            Videos
          </button>
          <div className="navSectionLabel">Configuration</div>
          <button
            type="button"
            className={operationsSection === 'keywords' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('keywords'))}
          >
            <Search size={16} />
            Keywords & rules
          </button>
          <button
            type="button"
            className={operationsSection === 'settings' ? 'active' : ''}
            onClick={navAction(() => onOpenOperations('settings'))}
          >
            <Settings size={16} />
            Settings
          </button>
        </nav>
        <div className="navFootnote">
          <FileText size={14} />
          Changes require approval
        </div>
      </aside>
    </>
  );
}
