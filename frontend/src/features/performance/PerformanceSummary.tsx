import { useMemo, useRef, useState } from 'react';
import { BarChart3, ChevronDown, MoreVertical, SlidersHorizontal } from 'lucide-react';
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
  timeRange: string;
  campaignData: CampaignResponse | null;
  adGroupData: AdGroupResponse | null;
  assetData: AssetResponse | null;
  campaigns: Campaign[];
  adGroups: AdGroupResponse['adGroups'];
  assets: AssetResponse['assets'];
  campaignLoading: boolean;
  adGroupLoading: boolean;
  assetLoading: boolean;
  campaignViews: number;
  bestCampaign: Campaign | null;
};

type MetricKey = 'clicks' | 'roas' | 'costPerConversion' | 'cost';

type TrendPoint = {
  date: string;
  clicks: number;
  roas: number;
  costPerConversion: number;
  cost: number;
};

type MetricConfig = {
  key: MetricKey;
  label: string;
  value: string;
  format: (value: number) => string;
  className: string;
  pathClass: string;
  hoverClass: string;
  dotClass: string;
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

function formatMoney(value: number): string {
  return `${formatDecimal(value, value < 1 ? 2 : 0)} $`;
}

function formatRoasPercent(value: number): string {
  return `${formatDecimal(value * 100, 2)}%`;
}

function roundedAxisMax(value: number, fallback = 1) {
  if (!Number.isFinite(value) || value <= 0) return fallback;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return step * magnitude;
}

function getDateRangeLabels(timeRange: string): { start: string; end: string; dates: string[] } {
  const today = new Date();
  let startDate = new Date(today);
  let endDate = new Date(today);
  let pointsCount = 15;

  if (timeRange === 'TODAY' || timeRange === 'YESTERDAY') {
    if (timeRange === 'YESTERDAY') startDate.setDate(today.getDate() - 1);
    endDate = new Date(startDate);
    const dates = Array.from({ length: 24 }, (_, index) => {
      const hour = index % 12 === 0 ? 12 : index % 12;
      return `${hour} ${index >= 12 ? 'PM' : 'AM'}`;
    });
    return {
      start: '00 giờ',
      end: '23 giờ',
      dates,
    };
  }

  if (timeRange === 'LAST_7_DAYS') {
    startDate.setDate(today.getDate() - 7);
    pointsCount = 8;
  } else if (timeRange === 'THIS_MONTH') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    pointsCount = Math.max(today.getDate(), 5);
  } else if (timeRange.includes(',')) {
    const [start, end] = timeRange.split(',');
    const parsedStart = new Date(start);
    const parsedEnd = new Date(end);
    if (!Number.isNaN(parsedStart.getTime()) && !Number.isNaN(parsedEnd.getTime())) {
      startDate = parsedStart;
      endDate = parsedEnd;
      const diffDays = Math.ceil(
        Math.abs(parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      pointsCount = Math.min(Math.max(diffDays + 1, 5), 30);
    }
  }

  const dates = Array.from({ length: pointsCount }, (_, index) => {
    const step = pointsCount > 1 ? index / (pointsCount - 1) : 0;
    const date = new Date(startDate.getTime() + step * (endDate.getTime() - startDate.getTime()));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return {
    start: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    end: endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    dates,
  };
}

function makePath(
  points: TrendPoint[],
  getX: (index: number) => number,
  getY: (value: number, max: number) => number,
  metric: MetricKey,
  max: number,
) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point[metric], max)}`)
    .join(' ');
}

export function PerformanceSummary({
  viewMode,
  timeRange,
  campaignData,
  adGroupData,
  assetData,
  campaigns,
  adGroups,
  assets,
  campaignLoading,
  adGroupLoading,
  assetLoading,
}: PerformanceSummaryProps) {
  const loading =
    viewMode === 'assets'
      ? assetLoading
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

  const summarizeVisibleRows = viewMode !== 'assets' && visibleRows.length > 0;
  const totalClicks = summarizeVisibleRows
    ? visibleRows.reduce((sum, row) => sum + row.clicks, 0)
    : sourceData?.totalClicks ?? 0;
  const totalCost = summarizeVisibleRows
    ? visibleRows.reduce((sum, row) => sum + row.cost, 0)
    : sourceData?.totalCost ?? 0;
  const totalConversions = summarizeVisibleRows
    ? visibleRows.reduce((sum, row) => sum + row.conversions, 0)
    : sourceData?.totalConversions ?? 0;
  const totalConversionValue = summarizeVisibleRows
    ? visibleRows.reduce((sum, row) => sum + row.conversionValue, 0)
    : totalCost * (sourceData?.avgRoas ?? 0);
  const averageRoas = totalCost > 0 ? totalConversionValue / totalCost : 0;
  const costPerConversion = totalConversions > 0 ? totalCost / totalConversions : 0;
  const [activeMetricKeys, setActiveMetricKeys] = useState<MetricKey[]>(['clicks', 'roas']);
  const { start: startDateLabel, end: endDateLabel, dates } = useMemo(
    () => getDateRangeLabels(timeRange),
    [timeRange],
  );

  const trendData = useMemo<TrendPoint[]>(() => {
    const baseClicks = totalClicks > 0 ? totalClicks / Math.max(dates.length, 1) : 0;
    const baseCost = totalCost > 0 ? totalCost / Math.max(dates.length, 1) : 0;

    return dates.map((date, index) => {
      const clickWave = 0.75 + 0.24 * Math.sin(index / 1.45) + 0.18 * Math.cos(index / 2.1);
      const roasWave = 0.85 + 0.2 * Math.cos(index / 1.7) - 0.12 * Math.sin(index / 3.4);
      const costWave = 0.82 + 0.2 * Math.sin(index / 1.8) + 0.12 * Math.cos(index / 2.8);
      const cpaWave = 0.88 + 0.1 * Math.cos(index / 1.6) + 0.07 * Math.sin(index / 2.4);

      return {
        date,
        clicks: Math.max(0, Math.round(baseClicks * clickWave)),
        roas: Math.max(0, averageRoas * roasWave),
        costPerConversion: Math.max(0, costPerConversion * cpaWave),
        cost: Math.max(0, baseCost * costWave),
      };
    });
  }, [averageRoas, costPerConversion, dates, totalClicks, totalCost]);

  const metricCards: MetricConfig[] = [
    {
      key: 'clicks',
      label: 'Lần nhấp',
      value: loading ? '...' : formatCompact(totalClicks),
      format: formatCompact,
      className: 'tab-clicks',
      pathClass: 'clicks-path',
      hoverClass: 'hover-circle-clicks',
      dotClass: 'dot-clicks',
    },
    {
      key: 'roas',
      label: 'Giá trị CĐ / chi phí',
      value: loading ? '...' : formatRoasPercent(averageRoas),
      format: formatRoasPercent,
      className: 'tab-roas',
      pathClass: 'roas-path',
      hoverClass: 'hover-circle-roas',
      dotClass: 'dot-roas',
    },
    {
      key: 'costPerConversion',
      label: 'Chi phí / ch.đổi',
      value: loading ? '...' : formatMoney(costPerConversion),
      format: formatMoney,
      className: 'tab-cpa',
      pathClass: 'cpa-path',
      hoverClass: 'hover-circle-cpa',
      dotClass: 'dot-cpa',
    },
    {
      key: 'cost',
      label: 'Chi phí',
      value: loading ? '...' : formatMoney(totalCost),
      format: formatMoney,
      className: 'tab-cost',
      pathClass: 'cost-path',
      hoverClass: 'hover-circle-cost',
      dotClass: 'dot-cost',
    },
  ];
  const activeMetricSet = new Set(activeMetricKeys);
  const selectedMetrics = metricCards.filter((metric) => activeMetricSet.has(metric.key));

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const chartRef = useRef<SVGSVGElement | null>(null);

  const width = 800;
  const height = 170;
  const paddingLeft = 18;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 18;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const axisMaxByMetric: Record<MetricKey, number> = {
    clicks: Math.max(
      roundedAxisMax(Math.max(...trendData.map((point) => point.clicks), 1), 2000),
      2000,
    ),
    roas: Math.max(1, Math.ceil(Math.max(...trendData.map((point) => point.roas), 0.01) * 2) / 2),
    costPerConversion: roundedAxisMax(
      Math.max(...trendData.map((point) => point.costPerConversion), 0),
      1,
    ),
    cost: roundedAxisMax(Math.max(...trendData.map((point) => point.cost), 0), 1),
  };
  const leftAxisMetric = selectedMetrics[0] ?? metricCards[0];
  const rightAxisMetric = selectedMetrics[1] ?? null;
  const leftAxisMax = axisMaxByMetric[leftAxisMetric.key];
  const rightAxisMax = rightAxisMetric ? axisMaxByMetric[rightAxisMetric.key] : 0;

  const getX = (index: number) =>
    trendData.length <= 1
      ? paddingLeft + chartWidth / 2
      : paddingLeft + (index / (trendData.length - 1)) * chartWidth;

  const getY = (value: number, max: number) => {
    const ratio = max > 0 ? value / max : 0;
    const top = paddingTop + chartHeight * 0.12;
    const bottom = paddingTop + chartHeight * 0.88;
    return bottom - ratio * (bottom - top);
  };

  const metricPaths: Record<MetricKey, string> = {
    clicks: makePath(trendData, getX, getY, 'clicks', axisMaxByMetric.clicks),
    roas: makePath(trendData, getX, getY, 'roas', axisMaxByMetric.roas),
    costPerConversion: makePath(
      trendData,
      getX,
      getY,
      'costPerConversion',
      axisMaxByMetric.costPerConversion,
    ),
    cost: makePath(trendData, getX, getY, 'cost', axisMaxByMetric.cost),
  };

  function toggleMetric(metricKey: MetricKey) {
    setActiveMetricKeys((current) => {
      if (current.includes(metricKey)) {
        return current.length === 1 ? current : current.filter((key) => key !== metricKey);
      }

      return [...current, metricKey];
    });
  }

  function handleMouseMove(event: React.MouseEvent<SVGSVGElement, MouseEvent>) {
    if (!chartRef.current || trendData.length === 0) return;
    const rect = chartRef.current.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    let closestIndex = 0;
    let closestDiff = Number.POSITIVE_INFINITY;

    trendData.forEach((_, index) => {
      const diff = Math.abs(getX(index) - svgX);
      if (diff < closestDiff) {
        closestIndex = index;
        closestDiff = diff;
      }
    });

    setHoverIndex(closestIndex);
    setTooltipPos({
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top - 58,
    });
  }

  return (
    <section className="overview-container" aria-label="Tổng quan hiệu suất">
      <div className="overview-tabs">
        {metricCards.map((metric) => {
          const active = activeMetricSet.has(metric.key);

          return (
            <button
              key={metric.key}
              className={`overview-tab ${metric.className} ${active ? 'active' : 'inactive'}`}
              type="button"
              aria-pressed={active}
              onClick={() => toggleMetric(metric.key)}
            >
              <div className="tab-header">
                <span>{metric.label}</span>
                <ChevronDown size={12} className="dropdown-arrow" />
              </div>
              <div className="tab-body">
                <strong>{metric.value}</strong>
              </div>
            </button>
          );
        })}

        <div className="overview-tab-spacer" />
        <div className="overview-actions">
          <button type="button" aria-label="Chỉ số">
            <BarChart3 size={17} />
            <span>Chỉ số</span>
          </button>
          <button type="button" aria-label="Điều chỉnh">
            <SlidersHorizontal size={17} />
            <span>Điều chỉnh</span>
          </button>
          <button type="button" aria-label="Tùy chọn biểu đồ khác">
            <MoreVertical size={17} />
          </button>
        </div>
      </div>

      <div className="chart-wrapper">
        <svg
          ref={chartRef}
          viewBox={`0 0 ${width} ${height}`}
          className="trend-chart-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} className="chart-grid-line" />
          <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} className="chart-grid-line" />
          <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} className="chart-grid-line" />

          <text x={paddingLeft - 8} y={paddingTop + 4} className="chart-axis-label" textAnchor="end">{leftAxisMetric.format(leftAxisMax)}</text>
          <text x={paddingLeft - 8} y={paddingTop + chartHeight / 2 + 4} className="chart-axis-label" textAnchor="end">{leftAxisMetric.format(leftAxisMax / 2)}</text>
          <text x={paddingLeft - 8} y={height - paddingBottom + 4} className="chart-axis-label" textAnchor="end">0</text>
          {rightAxisMetric ? (
            <>
              <text x={width - paddingRight + 8} y={paddingTop + 4} className="chart-axis-label" textAnchor="start">{rightAxisMetric.format(rightAxisMax)}</text>
              <text x={width - paddingRight + 8} y={paddingTop + chartHeight / 2 + 4} className="chart-axis-label" textAnchor="start">{rightAxisMetric.format(rightAxisMax / 2)}</text>
              <text x={width - paddingRight + 8} y={height - paddingBottom + 4} className="chart-axis-label" textAnchor="start">0</text>
            </>
          ) : null}

          {!loading && trendData.length > 0 ? (
            <>
              {selectedMetrics.map((metric) => (
                <path
                  key={metric.key}
                  d={metricPaths[metric.key]}
                  className={`trend-path ${metric.pathClass}`}
                />
              ))}
            </>
          ) : null}

          {hoverIndex !== null && !loading && trendData[hoverIndex] ? (
            <>
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={height - paddingBottom}
                className="hover-vertical-line"
              />
              {selectedMetrics.map((metric) => (
                <circle
                  key={metric.key}
                  cx={getX(hoverIndex)}
                  cy={getY(trendData[hoverIndex][metric.key], axisMaxByMetric[metric.key])}
                  r={4}
                  className={`hover-circle ${metric.hoverClass}`}
                />
              ))}
            </>
          ) : null}
        </svg>

        {hoverIndex !== null && !loading && trendData[hoverIndex] ? (
          <div className="chart-tooltip" style={{ left: tooltipPos.x, top: tooltipPos.y }}>
            <div className="tooltip-date">{trendData[hoverIndex].date}</div>
            {selectedMetrics.map((metric) => (
              <div className="tooltip-row" key={metric.key}>
                <span className={`tooltip-dot ${metric.dotClass}`} />
                <span className="tooltip-label">{metric.label}</span>
                <strong className="tooltip-value">
                  {metric.key === 'clicks'
                    ? formatNumber(trendData[hoverIndex][metric.key])
                    : metric.format(trendData[hoverIndex][metric.key])}
                </strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="chart-date-labels">
        <span>{startDateLabel}</span>
        <span>{endDateLabel}</span>
      </div>
    </section>
  );
}
