import { ChevronRight, FileText, FolderKanban, Image, Layers, Video, X } from 'lucide-react';
import type { Campaign, ViewMode } from '../../types/googleAds';

type AssetTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO';

type DataContextProps = {
  viewMode: ViewMode;
  assetTypeFilter: AssetTypeFilter;
  selectedCampaign: Campaign | null;
  adGroupId: string;
  adGroupLabel: string;
  onClearCampaign: () => void;
  onOpenCampaigns: () => void;
  onOpenAdGroups: () => void;
};

export function DataContext({
  viewMode,
  assetTypeFilter,
  selectedCampaign,
  adGroupId,
  adGroupLabel,
  onClearCampaign,
  onOpenCampaigns,
  onOpenAdGroups,
}: DataContextProps) {
  const assetContext =
    assetTypeFilter === 'VIDEO'
      ? { label: 'Video', icon: Video }
      : assetTypeFilter === 'IMAGE'
        ? { label: 'Hình ảnh', icon: Image }
        : { label: 'Tài nguyên', icon: FileText };
  const AssetContextIcon = assetContext.icon;

  return (
    <div className="dataContext" aria-label="Ngữ cảnh dữ liệu hiện tại">
      <div className="contextCrumbList">
        <button className={`contextCrumb ${viewMode === 'campaigns' ? 'isCurrent' : ''}`} type="button" onClick={onOpenCampaigns}>
          <FolderKanban size={13} className="crumbIcon" />
          <span>Tất cả chiến dịch</span>
        </button>

        {viewMode !== 'campaigns' ? <ChevronRight size={13} className="crumbDivider" /> : null}

        {viewMode !== 'campaigns' ? (
          <button className={`contextCrumb contextCampaign ${viewMode === 'adGroups' && !adGroupId ? 'isCurrent' : ''}`} type="button" onClick={onOpenAdGroups}>
            <Layers size={13} className="crumbIcon" />
            <span>Chiến dịch: <strong>{selectedCampaign?.name || 'Tất cả nhóm'}</strong></span>
          </button>
        ) : null}

        {viewMode === 'assets' ? <ChevronRight size={13} className="crumbDivider" /> : null}

        {viewMode === 'assets' ? (
          <div className="contextAssetBadge" title={adGroupId ? adGroupLabel : 'Chọn nhóm quảng cáo'}>
            <AssetContextIcon size={13} className="crumbIcon" />
            <span>Nhóm: <strong>{adGroupId ? adGroupLabel : 'Chưa chọn nhóm'}</strong></span>
          </div>
        ) : null}
      </div>

      {selectedCampaign && viewMode === 'adGroups' ? (
        <button
          className="clearContext"
          type="button"
          onClick={onClearCampaign}
          title="Xem tất cả nhóm quảng cáo"
        >
          <X size={12} />
          <span>Bỏ lọc chiến dịch</span>
        </button>
      ) : null}
    </div>
  );
}
