import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Languages,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react';
import {
  formatNumber,
  formatPercent,
  roasClass,
} from '../../utils/format';
import { assetTitle } from '../../utils/assets';
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
  rowsPerPage: number;
  activeLoading: boolean;
  onCampaignSort: (key: SortKey) => void;
  onAdGroupSort: (key: AdGroupSortKey) => void;
  onAssetSort: (key: AssetSortKey) => void;
  onOpenCampaign: (campaign: Campaign) => void;
  onOpenAdGroup: (adGroup: AdGroup) => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onOpenTextAssistant: (asset: Asset, translateOnly?: boolean) => void;
};

type AssetStaticColumnKey = 'ctr' | 'label' | 'action';
type AssetVisibleColumnKey = AssetSortKey | AssetStaticColumnKey;

const rowsPerPageOptions = [10, 25, 50, 100];

function formatMoney(value: number, currencyCode: string) {
  const amount = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
  return `${amount} ${currencyCode}`;
}

const campaignColumns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Chiến dịch' },
  { key: 'id', label: 'ID' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'impressions', label: 'Lượt hiển thị' },
  { key: 'clicks', label: 'Lượt nhấp' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cost', label: 'Chi phí' },
  { key: 'conversionValue', label: 'Giá trị chuyển đổi' },
  { key: 'roas', label: 'ROAS' },
];

const googleStatusLabel: Record<string, string> = {
  ENABLED: 'Đang hoạt động',
  PAUSED: 'Đã tạm dừng',
  REMOVED: 'Đã xóa',
  UNKNOWN: 'Không xác định',
};

const adGroupColumns: { key: AdGroupSortKey; label: string }[] = [
  { key: 'name', label: 'Nhóm quảng cáo' },
  { key: 'campaignName', label: 'Chiến dịch' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'impressions', label: 'Lượt hiển thị' },
  { key: 'clicks', label: 'Lượt nhấp' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cost', label: 'Chi phí' },
  { key: 'conversionValue', label: 'Giá trị chuyển đổi' },
  { key: 'roas', label: 'ROAS' },
];

const assetColumns: { key: AssetSortKey; label: string }[] = [
  { key: 'fieldType', label: 'Vị trí' },
  { key: 'type', label: 'Loại' },
  { key: 'impressions', label: 'Lượt hiển thị' },
  { key: 'clicks', label: 'Lượt nhấp' },
  { key: 'cost', label: 'Chi phí' },
  { key: 'conversions', label: 'Chuyển đổi' },
  { key: 'conversionValue', label: 'Giá trị chuyển đổi' },
  { key: 'roas', label: 'ROAS' },
  { key: 'score', label: 'Điểm' },
];

const assetStaticColumns: { key: AssetStaticColumnKey; label: string }[] = [
  { key: 'ctr', label: 'CTR' },
  { key: 'label', label: 'Nhãn' },
  { key: 'action', label: 'Hành động' },
];

const defaultAssetColumnKeys: AssetVisibleColumnKey[] = [
  'fieldType',
  'impressions',
  'clicks',
  'cost',
  'roas',
  'label',
  'action',
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
      className={`sortableHeader${activeKey === column.key ? ' sorted' : ''}`}
      aria-sort={activeKey === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        className="sort-indicator sort-header-button"
        type="button"
        onClick={() => onSort(column.key)}
        aria-label={`Sắp xếp theo ${column.label}`}
      >
        {column.label}
        {activeKey === column.key && direction === 'asc'
          ? <ArrowUp size={12} className="sort-icon" />
          : <ArrowDown size={12} className="sort-icon" />}
      </button>
    </th>
  );
}

function EmptyTableState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="tableEmptyState">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function renderAssetSortableCell(asset: Asset, key: AssetSortKey, currencyCode: string) {
  switch (key) {
    case 'fieldType':
      return asset.fieldType || '-';
    case 'type':
      return asset.type || '-';
    case 'impressions':
      return formatNumber(asset.impressions);
    case 'clicks':
      return formatNumber(asset.clicks);
    case 'cost':
      return formatMoney(asset.cost, currencyCode);
    case 'conversions':
      return formatNumber(asset.conversions);
    case 'conversionValue':
      return formatMoney(asset.conversionValue, currencyCode);
    case 'roas':
      return <span className={`roas ${roasClass(asset.roas)}`}>{formatPercent(asset.roas)}</span>;
    case 'score':
      return asset.score;
    default:
      return '-';
  }
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
    rowsPerPage,
    activeLoading,
    onCampaignSort,
    onAdGroupSort,
    onAssetSort,
    onOpenCampaign,
    onOpenAdGroup,
    onPageChange,
    onRowsPerPageChange,
    onOpenTextAssistant,
  } = props;
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const currencyCode = (
    viewMode === 'assets'
      ? assetData?.currencyCode
      : viewMode === 'adGroups'
        ? adGroupData?.currencyCode
        : campaignData?.currencyCode
  ) || 'USD';
  const columnLabel = (column: { key: string; label: string }) => {
    if (column.key === 'cost') return `Chi phí (${currencyCode})`;
    if (column.key === 'conversionValue') return `Giá trị chuyển đổi (${currencyCode})`;
    return column.label;
  };
  const [visibleAssetColumnKeys, setVisibleAssetColumnKeys] = useState<AssetVisibleColumnKey[]>(
    defaultAssetColumnKeys,
  );
  const visibleAssetColumnSet = useMemo(
    () => new Set(visibleAssetColumnKeys),
    [visibleAssetColumnKeys],
  );
  const visibleSortableAssetColumns = assetColumns.filter((column) =>
    visibleAssetColumnSet.has(column.key),
  );
  const visibleStaticAssetColumns = assetStaticColumns.filter((column) =>
    visibleAssetColumnSet.has(column.key),
  );
  const assetTableColSpan =
    1 + visibleSortableAssetColumns.length + visibleStaticAssetColumns.length;

  function toggleAssetColumn(key: AssetVisibleColumnKey) {
    setVisibleAssetColumnKeys((current) =>
      current.includes(key)
        ? current.filter((columnKey) => columnKey !== key)
        : [...current, key],
    );
  }

  function renderAssetStaticCell(asset: Asset, key: AssetStaticColumnKey) {
    switch (key) {
      case 'ctr':
        return formatPercent(asset.ctr);
      case 'label': {
        const label = (asset.performanceLabel || 'UNKNOWN').toUpperCase();
        return <span className={`performanceLabel ${label === 'LOW' ? 'low' : ''}`}>{label}</span>;
      }
      case 'action':
        return asset.action || '-';
      default:
        return '-';
    }
  }

  return (
    <section className="tableWrap">
      <div className="tableHeader">
        <div>
          <h2>
            {viewMode === 'assets'
              ? 'Tài nguyên trong nhóm quảng cáo'
              : viewMode === 'adGroups'
                ? selectedCampaign ? `Nhóm quảng cáo trong ${selectedCampaign.name}` : 'Nhóm quảng cáo'
                : 'Chiến dịch'}
          </h2>
          <p>
            {viewMode === 'assets'
              ? assetData
                ? `Đang hiển thị ${filteredAssetCount}/${assetData.assets.length} tài nguyên`
                : 'Chọn nhóm quảng cáo để tải tài nguyên'
              : viewMode === 'adGroups'
                ? adGroupData
                  ? `Đang hiển thị ${filteredAdGroupCount}/${adGroupData.adGroups.length} nhóm quảng cáo`
                  : 'Tải nhóm quảng cáo để chọn tài nguyên'
                : campaignData
                  ? `Đang hiển thị ${filteredCampaignCount}/${campaignData.campaigns.length} chiến dịch`
                  : 'Chưa có dữ liệu'}
          </p>
        </div>
        <div className="tableHeaderActions">
          {viewMode === 'assets' ? (
            <div className="columnSelector">
              <button
                className="tableActionButton columnSelectorButton"
                type="button"
                onClick={() => setColumnMenuOpen((open) => !open)}
                aria-expanded={columnMenuOpen}
              >
                <SlidersHorizontal size={14} />
                Cột
              </button>
              {columnMenuOpen ? (
                <div className="columnMenu">
                  <label className="columnOption disabled">
                    <input type="checkbox" checked disabled />
                    Tài nguyên
                  </label>
                  {[...assetColumns, ...assetStaticColumns].map((column) => (
                    <label className="columnOption" key={column.key}>
                      <input
                        type="checkbox"
                        checked={visibleAssetColumnSet.has(column.key)}
                        onChange={() => toggleAssetColumn(column.key)}
                      />
                      {columnLabel(column)}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <span className="pill">
            {viewMode === 'assets' && assetData ? `Nhóm quảng cáo ${assetData.adGroupId}` : timeRange}
          </span>
        </div>
      </div>

      <div className="tableScroll">
        {viewMode === 'assets' ? (
          <table>
            <thead>
              <tr>
                <th>Tài nguyên</th>
                {visibleSortableAssetColumns.map((column) => (
                  <SortHeader
                    key={column.key}
                    column={{ ...column, label: columnLabel(column) }}
                    activeKey={assetSortKey}
                    direction={assetSortDir}
                    onSort={onAssetSort}
                  />
                ))}
                {visibleStaticAssetColumns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                return (
                  <tr key={`${asset.resourceName || asset.id}-${asset.fieldType}`}>
                    <td>
                      <div className="assetCell">
                        <span className="assetName">{assetTitle(asset)}</span>
                        {asset.type === 'TEXT' && asset.text ? (
                          <span className="assetInlineActions">
                            <button type="button" className="assetMiniButton" onClick={() => onOpenTextAssistant(asset, true)} title="Dịch nghĩa"><Languages size={13} /></button>
                            <button type="button" className="assetMiniButton edit" onClick={() => onOpenTextAssistant(asset)} title={asset.performanceLabel === 'LOW' ? 'Sửa nội dung hoặc dùng gợi ý AI' : 'Sửa nội dung thủ công'}><Pencil size={13} /></button>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {visibleSortableAssetColumns.map((column) => (
                      <td key={column.key}>{renderAssetSortableCell(asset, column.key, currencyCode)}</td>
                    ))}
                    {visibleStaticAssetColumns.map((column) => (
                      <td key={column.key} title={column.key === 'action' ? asset.reason : undefined}>
                        {renderAssetStaticCell(asset, column.key)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {assetLoading ? Array.from({ length: 6 }).map((_, index) => (
                <tr key={`asset-sk-${index}`} className="skeleton-row">
                  {Array.from({ length: assetTableColSpan }).map((__, cell) => (
                    <td key={cell}><div className={`skeleton ${cell > 1 ? 'xs' : cell === 1 ? 'sm' : ''}`} /></td>
                  ))}
                </tr>
              )) : null}
              {!assetLoading && !assetData ? (
                <tr>
                  <td colSpan={assetTableColSpan} className="empty">
                    <EmptyTableState
                      title="Chưa chọn nhóm quảng cáo"
                      description="Chọn chiến dịch và nhóm quảng cáo ở phía trên, sau đó bấm Tải dữ liệu để xem tài nguyên."
                    />
                  </td>
                </tr>
              ) : null}
              {!assetLoading && assetData && filteredAssetCount === 0 ? (
                <tr>
                  <td colSpan={assetTableColSpan} className="empty">
                    <EmptyTableState
                      title="Không có tài nguyên phù hợp"
                      description="Thử đổi từ khóa, bộ lọc nhãn, loại tài nguyên hoặc khoảng ngày đang chọn."
                    />
                  </td>
                </tr>
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
                    column={{ ...column, label: columnLabel(column) }}
                    activeKey={adGroupSortKey}
                    direction={adGroupSortDir}
                    onSort={onAdGroupSort}
                  />
                ))}
                <th>Tài nguyên</th>
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
                      <span className="assetName">{adGroup.name || `Nhóm quảng cáo ${adGroup.id}`}</span>
                      <span className="rowSubtext">{adGroup.id}</span>
                    </div>
                  </td>
                  <td>
                    <div className="assetCell">
                      <span>{adGroup.campaignName || '-'}</span>
                      <span className="rowSubtext">{adGroup.campaignId}</span>
                    </div>
                  </td>
                  <td>{googleStatusLabel[adGroup.status || ''] ?? adGroup.status ?? '-'}</td>
                  <td>{formatNumber(adGroup.impressions ?? 0)}</td>
                  <td>{formatNumber(adGroup.clicks ?? 0)}</td>
                  <td>{formatPercent(adGroup.ctr ?? 0)}</td>
                  <td>{formatMoney(adGroup.cost, currencyCode)}</td>
                  <td>{formatMoney(adGroup.conversionValue, currencyCode)}</td>
                  <td title={`Mỗi 1 ${currencyCode} chi phí tạo ra ${formatNumber(adGroup.roas)} ${currencyCode} giá trị chuyển đổi`}><span className={`roas ${roasClass(adGroup.roas)}`}>{formatPercent(adGroup.roas)}</span></td>
                  <td>
                    <button
                      className="tableActionButton"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenAdGroup(adGroup);
                      }}
                    >
                      Mở tài nguyên
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
                <tr>
                  <td colSpan={10} className="empty">
                    <EmptyTableState
                      title="Chưa tải nhóm quảng cáo"
                      description="Bấm Tải dữ liệu để lấy danh sách nhóm quảng cáo theo chiến dịch và khoảng ngày hiện tại."
                    />
                  </td>
                </tr>
              ) : null}
              {!adGroupLoading && adGroupData && filteredAdGroupCount === 0 ? (
                <tr>
                  <td colSpan={10} className="empty">
                    <EmptyTableState
                      title="Không có nhóm quảng cáo phù hợp"
                      description="Thử đổi từ khóa, chiến dịch hoặc khoảng ngày đang chọn."
                    />
                  </td>
                </tr>
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
                    column={{ ...column, label: columnLabel(column) }}
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
                    <td><span className={`entityStatus ${String(campaign.status ?? 'UNKNOWN').toLowerCase()}`}>{googleStatusLabel[campaign.status ?? 'UNKNOWN'] ?? campaign.status}</span></td>
                    <td>{formatNumber(campaign.impressions ?? 0)}</td>
                    <td>{formatNumber(campaign.clicks ?? 0)}</td>
                    <td>{formatPercent(campaign.ctr ?? 0)}</td>
                    <td>{formatMoney(campaign.cost, currencyCode)}</td>
                    <td>{formatMoney(campaign.conversionValue, currencyCode)}</td>
                    <td>
                      <div className="roas-cell">
                        <span className={`roas ${className}`} title={`Mỗi 1 ${currencyCode} chi phí tạo ra ${formatNumber(campaign.roas)} ${currencyCode} giá trị chuyển đổi`}>{formatPercent(campaign.roas)}</span>
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
                  {Array.from({ length: campaignColumns.length }).map((__, cell) => (
                    <td key={cell}><div className={`skeleton ${cell > 1 ? 'xs' : cell === 1 ? 'sm' : ''}`} /></td>
                  ))}
                </tr>
              )) : null}
              {!campaignLoading && !campaignData ? (
                <tr>
                  <td colSpan={campaignColumns.length} className="empty">
                    <EmptyTableState
                      title="Chưa có dữ liệu campaign"
                      description="Chọn ID khách hàng rồi bấm Tải dữ liệu để tải chiến dịch."
                    />
                  </td>
                </tr>
              ) : null}
              {!campaignLoading && campaignData && filteredCampaignCount === 0 ? (
                <tr>
                  <td colSpan={campaignColumns.length} className="empty">
                    <EmptyTableState
                      title="Không có campaign phù hợp"
                      description="Thử đổi tìm kiếm, campaign group hoặc khoảng ngày đang chọn."
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {activeListLength > 0 ? (
        <div className="pagination">
          <div className="paginationMeta">
            <span>Đang hiển thị {pageStart + 1}-{pageEnd} / {activeListLength}</span>
            <label>
              Số dòng mỗi trang
              <select
                value={rowsPerPage}
                onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
                disabled={activeLoading}
              >
                {rowsPerPageOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
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
