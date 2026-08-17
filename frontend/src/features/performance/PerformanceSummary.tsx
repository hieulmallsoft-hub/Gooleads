import type {
  AdGroupResponse,
  AssetResponse,
  Campaign,
  CampaignResponse,
  ViewMode,
} from '../../types/googleAds';

type PerformanceSummaryProps = {
  viewMode: ViewMode;
  timeRange: string;
  campaignData: CampaignResponse | null;
  adGroupData: AdGroupResponse | null;
  assetData: AssetResponse | null;
  campaigns: Campaign[];
  adGroups: AdGroupResponse['adGroups'];
  assets: AssetResponse['assets'];
  selectedCampaign: Campaign | null;
  campaignLoading: boolean;
  adGroupLoading: boolean;
  assetLoading: boolean;
  campaignViews: number;
  bestCampaign: Campaign | null;
};

type MetricConfig = {
  key: string;
  label: string;
  value: string;
  className: string;
  help: string;
};

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${formatDecimal(value / 1_000_000, 1)} Tr`;
  if (value >= 1_000) return `${formatDecimal(value / 1_000, 1)} N`;
  return formatDecimal(value, 1);
}

function formatDecimal(value: number, digits = 2): string {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number, currencyCode = 'USD'): string {
  return `${formatDecimal(value, value < 1 ? 2 : 0)} ${currencyCode}`;
}

function formatRoasPercent(value: number): string {
  return `${formatDecimal(value * 100, 2)}%`;
}

export function PerformanceSummary({
  viewMode,
  campaignData,
  adGroupData,
  assetData,
  campaigns,
  adGroups,
  assets,
  selectedCampaign,
  campaignLoading,
  adGroupLoading,
  assetLoading,
}: PerformanceSummaryProps) {
  const selectedCampaignMetrics = selectedCampaign
    ? campaignData?.campaigns.find((campaign) => campaign.id === selectedCampaign.id) ?? selectedCampaign
    : null;
  const showingCampaignFallback = viewMode === 'assets' && !assetData && Boolean(selectedCampaignMetrics);
  const loading =
    viewMode === 'assets'
      ? showingCampaignFallback ? campaignLoading : assetLoading
      : viewMode === 'adGroups'
        ? adGroupLoading
        : campaignLoading;

  const sourceData =
    viewMode === 'assets'
      ? assetData
      : viewMode === 'adGroups'
        ? adGroupData
        : campaignData;
  const visibleRows =
    viewMode === 'assets'
      ? assets
      : viewMode === 'adGroups'
        ? adGroups
        : campaigns;
  const currencyCode = sourceData?.currencyCode || campaignData?.currencyCode || 'USD';
  const lastSyncedAt = sourceData?.lastSyncedAt ?? campaignData?.lastSyncedAt;
  const snapshotLabel = lastSyncedAt
    ? new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(lastSyncedAt))
    : null;
  const databaseRange = sourceData?.dataRangeStart && sourceData?.dataRangeEnd
    ? `${sourceData.dataRangeStart.split('-').reverse().join('/')} – ${sourceData.dataRangeEnd.split('-').reverse().join('/')}`
    : null;

  const summarizeVisibleRows = viewMode !== 'assets' && visibleRows.length > 0;
  const totalClicks = showingCampaignFallback && selectedCampaignMetrics
    ? selectedCampaignMetrics.clicks
    : summarizeVisibleRows
    ? visibleRows.reduce((sum, row) => sum + row.clicks, 0)
    : sourceData?.totalClicks ?? 0;
  const totalCost = showingCampaignFallback && selectedCampaignMetrics
    ? selectedCampaignMetrics.cost
    : summarizeVisibleRows
    ? visibleRows.reduce((sum, row) => sum + row.cost, 0)
    : sourceData?.totalCost ?? 0;
  const totalConversions = showingCampaignFallback && selectedCampaignMetrics
    ? selectedCampaignMetrics.conversions
    : summarizeVisibleRows
    ? visibleRows.reduce((sum, row) => sum + row.conversions, 0)
    : sourceData?.totalConversions ?? 0;
  const totalConversionValue = showingCampaignFallback && selectedCampaignMetrics
    ? selectedCampaignMetrics.conversionValue
    : summarizeVisibleRows
    ? visibleRows.reduce((sum, row) => sum + row.conversionValue, 0)
    : totalCost * (sourceData?.avgRoas ?? 0);
  const averageRoas = totalCost > 0 ? totalConversionValue / totalCost : 0;
  const costPerConversion = totalConversions > 0 ? totalCost / totalConversions : 0;
  const metricCards: MetricConfig[] = [
    {
      key: 'clicks',
      label: 'Lần nhấp',
      value: loading ? '...' : formatCompact(totalClicks),
      className: 'tab-clicks',
      help: 'Tổng số lần người dùng nhấp vào quảng cáo.',
    },
    {
      key: 'roas',
      label: 'ROAS',
      value: loading ? '...' : formatRoasPercent(averageRoas),
      className: 'tab-roas',
      help: 'Giá trị chuyển đổi thu về chia cho chi phí quảng cáo. Ví dụ 52% nghĩa là chi 1 đơn vị tiền thu về 0,52 đơn vị giá trị chuyển đổi.',
    },
    {
      key: 'costPerConversion',
      label: 'Chi phí mỗi chuyển đổi',
      value: loading ? '...' : formatMoney(costPerConversion, currencyCode),
      className: 'tab-cpa',
      help: 'Chi phí quảng cáo trung bình để tạo ra một lượt chuyển đổi.',
    },
    {
      key: 'cost',
      label: 'Tổng chi phí',
      value: loading ? '...' : formatMoney(totalCost, currencyCode),
      className: 'tab-cost',
      help: `Tổng số tiền quảng cáo đã chi trong khoảng thời gian đã chọn (${currencyCode}).`,
    },
  ];
  return (
    <section className="overview-container" aria-label="Tổng quan hiệu suất">
      <div className="overview-tabs">
        {metricCards.map((metric) => (
            <div
              key={metric.key}
              className={`overview-tab ${metric.className} active`}
              title={metric.help}
            >
              <div className="tab-header">
                <span>{metric.label}</span>
              </div>
              <div className="tab-body">
                <strong>{metric.value}</strong>
              </div>
            </div>
        ))}
      </div>

      {sourceData?.dataSource === 'DATABASE_SNAPSHOT' ? (
        <div className="snapshotFreshness" role="status">
          <span>{databaseRange ? `Dữ liệu hiện có trong DB: ${databaseRange}` : 'Database chưa có chỉ số cho khoảng ngày này'}</span>
          <strong>{snapshotLabel ? `Cập nhật gần nhất ${snapshotLabel}` : 'Chưa có lần đồng bộ thành công'}</strong>
        </div>
      ) : null}

      {showingCampaignFallback ? (
        <div className="summaryContextNotice">
          Đang hiển thị số liệu tổng của chiến dịch <strong>{selectedCampaignMetrics?.name}</strong>. Chọn nhóm quảng cáo để xem riêng tài nguyên của nhóm.
        </div>
      ) : null}

    </section>
  );
}
