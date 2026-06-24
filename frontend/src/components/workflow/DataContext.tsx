import { ChevronRight, X } from 'lucide-react';
import type { Campaign, ViewMode } from '../../types/googleAds';

type DataContextProps = {
  viewMode: ViewMode;
  selectedCampaign: Campaign | null;
  adGroupId: string;
  onClearCampaign: () => void;
  onOpenCampaigns: () => void;
  onOpenAdGroups: () => void;
};

export function DataContext({
  viewMode,
  selectedCampaign,
  adGroupId,
  onClearCampaign,
  onOpenCampaigns,
  onOpenAdGroups,
}: DataContextProps) {
  return (
    <div className="dataContext" aria-label="Current data context">
      <button type="button" onClick={onOpenCampaigns}>Campaigns</button>
      {viewMode !== 'campaigns' ? <ChevronRight size={14} /> : null}
      {viewMode !== 'campaigns' ? (
        <button type="button" onClick={onOpenAdGroups}>
          {selectedCampaign?.name || 'All ad groups'}
        </button>
      ) : null}
      {viewMode === 'assets' ? <ChevronRight size={14} /> : null}
      {viewMode === 'assets' ? <strong>Ad group {adGroupId || 'not selected'}</strong> : null}
      {selectedCampaign && viewMode === 'adGroups' ? (
        <button
          className="clearContext"
          type="button"
          onClick={onClearCampaign}
          title="Show all ad groups"
        >
          <X size={13} />
          Clear campaign
        </button>
      ) : null}
    </div>
  );
}
