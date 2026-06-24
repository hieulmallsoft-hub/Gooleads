import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Image,
  Video,
} from 'lucide-react';
import {
  assessmentClass,
  formatNumber,
  formatPercent,
  roasClass,
} from '../../utils/format';
import {
  assetTitle,
  getMediaReplacementType,
} from '../../utils/assets';
import type {
  AdGroup,
  AdGroupResponse,
  AdGroupSortKey,
  Asset,
  AssetResponse,
  AssetSortKey,
  Campaign,
  CampaignResponse,
  SortDir,
  SortKey,
  ViewMode,
} from '../../types/googleAds';

type PerformanceTableProps = {
  viewMode: ViewMode;
  timeRange: string;
  selectedCampaign: Campaign | null;
  campaignData: CampaignResponse | null;
  adGroupData: AdGroupResponse | null;
  assetData: AssetResponse | null;
  filteredCampaignCount: number;
  filteredAdGroupCount: number;
  filteredAssetCount: number;
  campaigns: Campaign[];
  adGroups: AdGroup[];
  assets: Asset[];
  campaignLoading: boolean;
  adGroupLoading: boolean;
  assetLoading: boolean;
  campaignSortKey: SortKey;
  adGroupSortKey: AdGroupSortKey;
  assetSortKey: AssetSortKey;
  campaignSortDir: SortDir;
  adGroupSortDir: SortDir;
  assetSortDir: SortDir;
  maxRoas: number;
  activeListLength: number;
  pageStart: number;
  pageEnd: number;
  currentPage: number;
  totalPages: number;
  activeLoading: boolean;
  onCampaignSort: (key: SortKey) => void;
  onAdGroupSort: (key: AdGroupSortKey) => void;
  onAssetSort: (key: AssetSortKey) => void;
  onOpenCampaign: (campaign: Campaign) => void;
  onOpenAdGroup: (adGroup: AdGroup) => void;
  onSelectMedia: (asset: Asset) => void;
  onPageChange: (page: number) => void;
};

const campaignColumns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Campaign' },
  { key: 'id', label: 'ID' },
  { key: 'impressions', label: 'Views' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cost', label: 'Cost' },
  { key: 'conversionValue', label: 'Conv. Value' },
  { key: 'roas', label: 'ROAS' },
];

const adGroupColumns: { key: AdGroupSortKey; label: string }[] = [
  { key: 'name', label: 'Ad group' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'status', label: 'Status' },
  { key: 'impressions', label: 'Views' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cost', label: 'Cost' },
  { key: 'conversionValue', label: 'Conv. Value' },
  { key: 'roas', label: 'ROAS' },
];

const assetColumns: { key: AssetSortKey; label: string }[] = [
  { key: 'fieldType', label: 'Placement' },
  { key: 'type', label: 'Type' },
  { key: 'impressions', label: 'Impr.' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'cost', label: 'Cost' },
  { key: 'conversions', label: 'Conv.' },
  { key: 'conversionValue', label: 'Conv. Value' },
  { key: 'roas', label: 'ROAS' },
  { key: 'score', label: 'Score' },
];

function SortHeader<T extends string>({
  column,
  activeKey,
  direction,
  onSort,
}: {
  column: { key: T; label: string };
  activeKey: T;
  direction: SortDir;
  onSort: (key: T) => void;
}) {
  return (
    <th
      className={activeKey === column.key ? 'sorted' : ''}
      onClick={() => onSort(column.key)}
    >
      <span className="sort-indicator">
        {column.label}
        {activeKey === column.key && direction === 'asc'
          ? <ArrowUp size={12} className="sort-icon" />
          : <ArrowDown size={12} className="sort-icon" />}
      </span>
    </th>
  );
}

export function PerformanceTable(props: PerformanceTableProps) {
  const {
    viewMode,
    timeRange,
    selectedCampaign,
    campaignData,
    adGroupData,
    assetData,
    filteredCampaignCount,
    filteredAdGroupCount,
    filteredAssetCount,
    campaigns,
    adGroups,
    assets,
    campaignLoading,
    adGroupLoading,
    assetLoading,
    campaignSortKey,
    adGroupSortKey,
    assetSortKey,
    campaignSortDir,
    adGroupSortDir,
    assetSortDir,
    maxRoas,
    activeListLength,
    pageStart,
    pageEnd,
    currentPage,
    totalPages,
    activeLoading,
    onCampaignSort,
    onAdGroupSort,
    onAssetSort,
    onOpenCampaign,
    onOpenAdGroup,
    onSelectMedia,
    onPageChange,
  } = props;

  return (
    <section className="tableWrap">
      <div className="tableHeader">
        <div>
          <h2>
            {viewMode === 'assets'
              ? 'Assets in ad group'
              : viewMode === 'adGroups'
                ? selectedCampaign ? `Ad groups in ${selectedCampaign.name}` : 'Ad groups'
                : 'Campaigns'}
          </h2>
          <p>
            {viewMode === 'assets'
              ? assetData
                ? `${filteredAssetCount}/${assetData.assets.length} assets visible`
                : 'Enter an ad group ID to load assets'
              : viewMode === 'adGroups'
                ? adGroupData
                  ? `${filteredAdGroupCount}/${adGroupData.adGroups.length} ad groups visible`
                  : 'Load ad groups to choose an ad group'
                : campaignData
                  ? `${filteredCampaignCount}/${campaignData.campaigns.length} campaigns visible`
                  : 'No data loaded'}
          </p>
        </div>
        <span className="pill">
          {viewMode === 'assets' && assetData ? `Ad group ${assetData.adGroupId}` : timeRange}
        </span>
      </div>

      <div className="tableScroll">
        {viewMode === 'assets' ? (
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                {assetColumns.map((column) => (
                  <SortHeader
                    key={column.key}
                    column={column}
                    activeKey={assetSortKey}
                    direction={assetSortDir}
                    onSort={onAssetSort}
                  />
                ))}
                <th>CTR</th>
                <th>Label</th>
                <th>Assessment</th>
                <th>Action</th>
                <th>Replace</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const mediaType = getMediaReplacementType(asset);
                const MediaIcon = mediaType === 'VIDEO' ? Video : Image;
                return (
                  <tr key={`${asset.resourceName || asset.id}-${asset.fieldType}`}>
                    <td>
                      <div className="assetCell">
                        <span className="assetName">{assetTitle(asset)}</span>
                        {mediaType ? (
                          <button
                            className="tableActionButton inlineReplaceButton"
                            type="button"
                            onClick={() => onSelectMedia(asset)}
                          >
                            <MediaIcon size={13} />
                            Replace {mediaType.toLowerCase()}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>{asset.fieldType || '-'}</td>
                    <td>{asset.type || '-'}</td>
                    <td>{formatNumber(asset.impressions)}</td>
                    <td>{formatNumber(asset.clicks)}</td>
                    <td>{formatNumber(asset.cost)}</td>
                    <td>{formatNumber(asset.conversions)}</td>
                    <td>{formatNumber(asset.conversionValue)}</td>
                    <td><span className={`roas ${roasClass(asset.roas)}`}>{asset.roas.toFixed(2)}</span></td>
                    <td>{asset.score}</td>
                    <td>{formatPercent(asset.ctr)}</td>
                    <td>{asset.performanceLabel || '-'}</td>
                    <td title={asset.reason}>
                      <span className={`assessment ${assessmentClass(asset.assessment)}`}>
                        {asset.assessment || '-'}
                      </span>
                    </td>
                    <td title={asset.reason}>{asset.action || '-'}</td>
                    <td>
                      {mediaType
                        ? <button className="tableActionButton" type="button" onClick={() => onSelectMedia(asset)}>Select</button>
                        : '-'}
                    </td>
                  </tr>
                );
              })}
              {assetLoading ? Array.from({ length: 6 }).map((_, index) => (
                <tr key={`asset-sk-${index}`} className="skeleton-row">
                  {Array.from({ length: 15 }).map((__, cell) => (
                    <td key={cell}><div className={`skeleton ${cell > 1 ? 'xs' : cell === 1 ? 'sm' : ''}`} /></td>
                  ))}
                </tr>
              )) : null}
              {!assetLoading && !assetData ? (
                <tr><td colSpan={15} className="empty">Enter an ad group ID and load asset data.</td></tr>
              ) : null}
              {!assetLoading && assetData && filteredAssetCount === 0 ? (
                <tr><td colSpan={15} className="empty">No matching assets found.</td></tr>
              ) : null}
            </tbody>
          </table>
        ) : viewMode === 'adGroups' ? (
          <table>
            <thead>
              <tr>
                {adGroupColumns.map((column) => (
                  <SortHeader
                    key={column.key}
                    column={column}
                    activeKey={adGroupSortKey}
                    direction={adGroupSortDir}
                    onSort={onAdGroupSort}
                  />
                ))}
                <th>Assets</th>
              </tr>
            </thead>
            <tbody>
              {adGroups.map((adGroup) => (
                <tr
                  key={adGroup.id}
                  className="clickableRow"
                  role="link"
                  tabIndex={0}
                  onClick={() => onOpenAdGroup(adGroup)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenAdGroup(adGroup);
                    }
                  }}
                >
                  <td>
                    <div className="assetCell">
                      <span className="assetName">{adGroup.name || `Ad group ${adGroup.id}`}</span>
                      <span className="rowSubtext">{adGroup.id}</span>
                    </div>
                  </td>
                  <td>
                    <div className="assetCell">
                      <span>{adGroup.campaignName || '-'}</span>
                      <span className="rowSubtext">{adGroup.campaignId}</span>
                    </div>
                  </td>
                  <td>{adGroup.status || '-'}</td>
                  <td>{formatNumber(adGroup.impressions ?? 0)}</td>
                  <td>{formatNumber(adGroup.clicks ?? 0)}</td>
                  <td>{formatPercent(adGroup.ctr ?? 0)}</td>
                  <td>{formatNumber(adGroup.cost)}</td>
                  <td>{formatNumber(adGroup.conversionValue)}</td>
                  <td><span className={`roas ${roasClass(adGroup.roas)}`}>{adGroup.roas.toFixed(2)}</span></td>
                  <td>
                    <button
                      className="tableActionButton"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenAdGroup(adGroup);
                      }}
                    >
                      Open assets
                    </button>
                  </td>
                </tr>
              ))}
              {adGroupLoading ? Array.from({ length: 6 }).map((_, index) => (
                <tr key={`ad-group-sk-${index}`} className="skeleton-row">
                  {Array.from({ length: 10 }).map((__, cell) => (
                    <td key={cell}><div className={`skeleton ${cell > 1 ? 'xs' : cell === 1 ? 'sm' : ''}`} /></td>
                  ))}
                </tr>
              )) : null}
              {!adGroupLoading && !adGroupData ? (
                <tr><td colSpan={10} className="empty">Load ad groups to choose an ad group.</td></tr>
              ) : null}
              {!adGroupLoading && adGroupData && filteredAdGroupCount === 0 ? (
                <tr><td colSpan={10} className="empty">No matching ad groups found.</td></tr>
              ) : null}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                {campaignColumns.map((column) => (
                  <SortHeader
                    key={column.key}
                    column={column}
                    activeKey={campaignSortKey}
                    direction={campaignSortDir}
                    onSort={onCampaignSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const barWidth = Math.min((campaign.roas / maxRoas) * 100, 100);
                const className = roasClass(campaign.roas);
                return (
                  <tr
                    key={campaign.id}
                    className="clickableRow"
                    role="link"
                    tabIndex={0}
                    onClick={() => onOpenCampaign(campaign)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenCampaign(campaign);
                      }
                    }}
                  >
                    <td>{campaign.name}</td>
                    <td>{campaign.id}</td>
                    <td>{formatNumber(campaign.impressions ?? 0)}</td>
                    <td>{formatNumber(campaign.clicks ?? 0)}</td>
                    <td>{formatPercent(campaign.ctr ?? 0)}</td>
                    <td>{formatNumber(campaign.cost)}</td>
                    <td>{formatNumber(campaign.conversionValue)}</td>
                    <td>
                      <div className="roas-cell">
                        <span className={`roas ${className}`}>{campaign.roas.toFixed(2)}</span>
                        <span className="roas-bar-wrap">
                          <span className={`roas-bar ${className}`} style={{ width: `${barWidth}%` }} />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {campaignLoading ? Array.from({ length: 6 }).map((_, index) => (
                <tr key={`campaign-sk-${index}`} className="skeleton-row">
                  {Array.from({ length: 8 }).map((__, cell) => (
                    <td key={cell}><div className={`skeleton ${cell > 1 ? 'xs' : cell === 1 ? 'sm' : ''}`} /></td>
                  ))}
                </tr>
              )) : null}
              {!campaignLoading && !campaignData ? (
                <tr><td colSpan={8} className="empty">Enter a customer ID and load data.</td></tr>
              ) : null}
              {!campaignLoading && campaignData && filteredCampaignCount === 0 ? (
                <tr><td colSpan={8} className="empty">No matching campaigns found.</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {activeListLength > 0 ? (
        <div className="pagination">
          <span>Showing {pageStart + 1}-{pageEnd} / {activeListLength}</span>
          <div className="paginationControls">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1 || activeLoading}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <strong>{currentPage} / {totalPages}</strong>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages || activeLoading}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
