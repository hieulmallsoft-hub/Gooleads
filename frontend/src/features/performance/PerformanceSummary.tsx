import { Eye, Image, MousePointerClick, TrendingUp, WalletCards } from 'lucide-react';
import { formatNumber } from '../../utils/format';
import type {
  AdGroupResponse,
  AssetResponse,
  Campaign,
  CampaignResponse,
  ViewMode,
} from '../../types/googleAds';

type PerformanceSummaryProps = {
  viewMode: ViewMode;
  campaignData: CampaignResponse | null;
  adGroupData: AdGroupResponse | null;
  assetData: AssetResponse | null;
  campaignLoading: boolean;
  adGroupLoading: boolean;
  assetLoading: boolean;
  campaignViews: number;
  bestCampaign: Campaign | null;
};

export function PerformanceSummary({
  viewMode,
  campaignData,
  adGroupData,
  assetData,
  campaignLoading,
  adGroupLoading,
  assetLoading,
  campaignViews,
  bestCampaign,
}: PerformanceSummaryProps) {
  const loading =
    viewMode === 'assets'
      ? assetLoading
      : viewMode === 'adGroups'
        ? adGroupLoading
        : campaignLoading;
  const totalCost =
    viewMode === 'assets'
      ? assetData?.totalCost
      : viewMode === 'adGroups'
        ? adGroupData?.totalCost
        : campaignData?.totalCost;
  const averageRoas =
    viewMode === 'assets'
      ? assetData?.avgRoas
      : viewMode === 'adGroups'
        ? adGroupData?.avgRoas
        : campaignData?.avgRoas;

  return (
    <section className="summary">
      <div className="summary-card">
        <div className="card-icon"><WalletCards size={18} /></div>
        <span className="card-label">Total cost</span>
        <strong className="card-value">
          {loading ? '...' : totalCost === undefined ? '-' : formatNumber(totalCost)}
        </strong>
      </div>
      <div className="summary-card">
        <div className="card-icon"><TrendingUp size={18} /></div>
        <span className="card-label">{viewMode === 'assets' ? 'Asset ROAS' : 'Average ROAS'}</span>
        <strong className="card-value">
          {loading ? '...' : averageRoas === undefined ? '-' : averageRoas.toFixed(2)}
        </strong>
      </div>
      <div className="summary-card">
        <div className="card-icon">
          {viewMode === 'assets' ? <MousePointerClick size={18} /> : <Eye size={18} />}
        </div>
        <span className="card-label">{viewMode === 'assets' ? 'Clicks' : 'Views'}</span>
        <strong className="card-value">
          {loading
            ? '...'
            : viewMode === 'assets'
              ? assetData ? formatNumber(assetData.totalClicks) : '-'
              : viewMode === 'adGroups'
                ? adGroupData ? formatNumber(adGroupData.totalImpressions) : '-'
                : campaignData ? formatNumber(campaignViews) : '-'}
        </strong>
      </div>
      <div className="summary-card">
        <div className="card-icon">
          {viewMode === 'assets'
            ? <Image size={18} />
            : viewMode === 'adGroups'
              ? <MousePointerClick size={18} />
              : <TrendingUp size={18} />}
        </div>
        <span className="card-label">
          {viewMode === 'assets' ? 'Assets' : viewMode === 'adGroups' ? 'Ad groups' : 'Best ROAS'}
        </span>
        <strong className="card-value">
          {viewMode === 'assets'
            ? assetData?.assets.length ?? '-'
            : viewMode === 'adGroups'
              ? adGroupData?.adGroups.length ?? '-'
              : bestCampaign?.roas.toFixed(2) ?? '-'}
        </strong>
      </div>
    </section>
  );
}
