import { ChevronRight, FileText, Image, Video, X } from 'lucide-react';
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
      <button className="contextCrumb" type="button" onClick={onOpenCampaigns}>
        Chiến dịch
      </button>
      {viewMode !== 'campaigns' ? <ChevronRight size={14} /> : null}
      {viewMode !== 'campaigns' ? (
        <button className="contextCrumb contextCampaign" type="button" onClick={onOpenAdGroups}>
          <span>Chiến dịch</span>
          {selectedCampaign?.name || 'Tất cả nhóm quảng cáo'}
        </button>
      ) : null}
      {viewMode === 'assets' ? <ChevronRight size={14} /> : null}
      {viewMode === 'assets' ? (
        <strong className="contextAsset" title={adGroupId ? adGroupLabel : 'Chọn nhóm quảng cáo'}>
          <AssetContextIcon size={14} />
          <span>{assetContext.label}</span>
          {adGroupId ? adGroupLabel : 'Chọn nhóm quảng cáo'}
        </strong>
      ) : null}
      {selectedCampaign && viewMode === 'adGroups' ? (
        <button
          className="clearContext"
          type="button"
          onClick={onClearCampaign}
          title="Xem tất cả nhóm quảng cáo"
        >
          <X size={13} />
          Bỏ chọn chiến dịch
        </button>
      ) : null}
    </div>
  );
}
