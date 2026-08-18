import { useEffect, useEffectEvent, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
} from 'lucide-react';
import { apiFetch, extractApiError, parseJsonSafe } from '../../api/client';
import { ChangeHistoryPanel } from './ChangeHistoryPanel';

type Metrics = {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  conversionRate: number;
  cpa: number;
  roas: number;
};

type ImpactChange = {
  id: string;
  source: string;
  origin: 'MANUAL' | 'AI_APPROVED' | 'AI_AUTOMATION';
  appliedAt: string;
  changeTypes: string[];
  replacementCount: number;
  campaign: { id: string; name: string };
  adGroup: { id: string; name: string };
  coverage: { requestedDays: number; beforeDays: number; afterDays: number };
  before: Metrics;
  after: Metrics;
  verdict: 'IMPROVED' | 'DECLINED' | 'MIXED' | 'COLLECTING';
};

type ImpactResponse = {
  account: { customerId: string; displayName: string | null; currencyCode: string | null };
  windowDays: number;
  methodology: string;
  totals: {
    changes: number;
    improved: number;
    declined: number;
    mixed: number;
    collecting: number;
  };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  changes: ImpactChange[];
};

type SyncBatchJob = {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  totalCount: number;
  completedCount: number;
  failedCount: number;
  currentAdGroupId: string | null;
  errorMessage: string | null;
};

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function number(value: number, digits = 0) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
}

function money(value: number, currencyCode: string | null) {
  if (!currencyCode) return number(value, 2);
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return number(value, 2);
  }
}

function delta(before: number, after: number, lowerIsBetter = false) {
  if (before === 0) return after === 0 ? null : { label: 'New', positive: !lowerIsBetter };
  const value = (after - before) / Math.abs(before);
  return {
    label: `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`,
    positive: lowerIsBetter ? value < 0 : value > 0,
  };
}

function MetricComparison({
  label,
  before,
  after,
  format,
  lowerIsBetter = false,
  collecting = false,
}: {
  label: string;
  before: number;
  after: number;
  format: (value: number) => string;
  lowerIsBetter?: boolean;
  collecting?: boolean;
}) {
  const change = collecting ? null : delta(before, after, lowerIsBetter);
  return (
    <div className="impactMetric">
      <span>{label}</span>
      <div><small>Trước</small><strong>{format(before)}</strong></div>
      <ArrowRight size={14} />
      <div><small>Sau</small><strong>{collecting ? 'Đang chờ' : format(after)}</strong></div>
      <em className={change ? (change.positive ? 'positive' : 'negative') : ''}>
        {collecting ? 'Chưa đủ dữ liệu' : change?.label ?? '—'}
      </em>
    </div>
  );
}

const verdictMeta = {
  IMPROVED: { label: 'Hiệu quả tăng', shortLabel: 'Tăng', icon: ArrowUpRight },
  DECLINED: { label: 'Hiệu quả giảm', shortLabel: 'Giảm', icon: ArrowDownRight },
  MIXED: { label: 'Kết quả hỗn hợp', shortLabel: 'Hỗn hợp', icon: ArrowRight },
  COLLECTING: { label: 'Đang chờ thêm dữ liệu', shortLabel: 'Đang chờ', icon: Clock3 },
} as const;

const originLabel = {
  MANUAL: 'Thay đổi thủ công',
  AI_APPROVED: 'Đề xuất AI đã được bạn duyệt',
  AI_AUTOMATION: 'AI tự động thay đổi',
} as const;

const changeTypeLabel: Record<string, string> = {
  TEXT_REPLACE: 'văn bản',
  TEXT_REPLACEMENT: 'văn bản',
  MEDIA_REPLACE: 'hình ảnh/video',
  MEDIA_REPLACEMENT: 'hình ảnh/video',
  ASSET_REPLACEMENT: 'tài nguyên quảng cáo',
};

export function matchesImpactSearch(
  item: Pick<ImpactChange, 'campaign' | 'adGroup'>,
  search: string,
) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;
  return [
    item.campaign.name,
    item.campaign.id,
    item.adGroup.name,
    item.adGroup.id,
  ].some((value) => value.toLowerCase().includes(normalizedSearch));
}

function PerformanceAfterChanges({ customerId }: { customerId: string }) {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [origin, setOrigin] = useState('ALL');
  const [verdict, setVerdict] = useState('ALL');
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncJob, setSyncJob] = useState<SyncBatchJob | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function load() {
    if (!customerId) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(
        `/creative-operations/change-impact?${new URLSearchParams({
          customerId,
          days: String(days),
          q: debouncedSearch,
          source: origin,
          verdict,
          page: String(page),
          pageSize: '25',
        })}`,
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Không thể tải hiệu quả sau thay đổi'));
      setData(body as ImpactResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải hiệu quả sau thay đổi');
    } finally {
      setLoading(false);
    }
  }

  const loadEffect = useEffectEvent(load);

  useEffect(() => {
    void loadEffect();
  }, [customerId, days, debouncedSearch, origin, verdict, page]);

  const currency = data?.account.currencyCode ?? null;
  const visibleChanges = data?.changes ?? [];

  const refreshSyncJob = useEffectEvent(async (jobId?: string) => {
    const params = new URLSearchParams({ customerId });
    if (jobId) params.set('jobId', jobId);
    const response = await apiFetch(`/google-ads/sync/batch/status?${params}`);
    const body = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error(extractApiError(body, 'Không thể kiểm tra tiến độ đồng bộ'));
    }
    if (!body?.id) return;
    const job = body as SyncBatchJob;
    setSyncJob(job);
    const active = job.status === 'PENDING' || job.status === 'RUNNING';
    setSyncing(active);
    if (active) {
      setSyncStatus(
        `Đang đồng bộ ${job.completedCount + job.failedCount}/${job.totalCount} nhóm quảng cáo${
          job.currentAdGroupId ? ` · nhóm ${job.currentAdGroupId}` : ''
        }. Bạn có thể chuyển sang màn khác.`,
      );
      return;
    }
    if (job.status === 'COMPLETED') {
      setSyncStatus(`Đã đồng bộ thành công ${job.completedCount}/${job.totalCount} nhóm quảng cáo.`);
    } else {
      setSyncStatus(
        `Đồng bộ hoàn tất: ${job.completedCount} thành công, ${job.failedCount} lỗi.`,
      );
      if (job.errorMessage) setError(job.errorMessage);
    }
    await loadEffect();
  });

  useEffect(() => {
    if (!customerId) return;
    void refreshSyncJob().catch(() => undefined);
  }, [customerId]);

  useEffect(() => {
    if (!syncJob || !['PENDING', 'RUNNING'].includes(syncJob.status)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshSyncJob(syncJob.id).catch((jobError) => {
          setError(jobError instanceof Error ? jobError.message : 'Không thể kiểm tra tiến độ');
        });
      }
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [syncJob]);

  async function syncVisibleChanges() {
    if (!visibleChanges.length || syncing) {
      await load();
      return;
    }
    setSyncing(true);
    setError('');
    setSyncStatus('');
    try {
      const uniqueAdGroups = [
        ...new Map(visibleChanges.map((item) => [item.adGroup.id, item])).values(),
      ];
      const earliest = uniqueAdGroups.reduce(
        (value, item) => Math.min(value, new Date(item.appliedAt).getTime()),
        Date.now(),
      );
      const start = new Date(earliest);
      start.setDate(start.getDate() - days);
      const end = new Date();
      const datePart = (value: Date) => [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
      ].join('-');
      const time = `${datePart(start)},${datePart(end)}`;

      const response = await apiFetch('/google-ads/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          time,
          targets: uniqueAdGroups.map((item) => ({
            adGroupId: item.adGroup.id,
            adGroupName: item.adGroup.name,
          })),
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể tạo tác vụ đồng bộ Google Ads'));
      }
      const job = body as SyncBatchJob;
      setSyncJob(job);
      setSyncing(job.status === 'PENDING' || job.status === 'RUNNING');
      setSyncStatus(
        `Đã đưa ${job.totalCount} nhóm quảng cáo vào hàng đợi. Bạn có thể chuyển sang màn khác.`,
      );
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Không thể đồng bộ Google Ads');
      setSyncing(false);
    }
  }

  return (
    <section className="changeImpactPage">
      <div className="impactHeader">
        <div>
          <span className="eyebrow">Theo dõi kết quả</span>
          <h1>Hiệu quả sau thay đổi</h1>
          <p>So sánh hiệu suất trước và sau khi nội dung được cập nhật.</p>
        </div>
        <div className="impactActions">
          <label>
            Khoảng thời gian so sánh
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>7 ngày</option>
              <option value={14}>14 ngày</option>
              <option value={30}>30 ngày</option>
            </select>
          </label>
          <button className="primaryButton" type="button" onClick={() => void syncVisibleChanges()} disabled={loading || syncing}>
            <RefreshCw size={15} className={loading || syncing ? 'spin' : ''} />
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ Google Ads'}
          </button>
        </div>
      </div>

      {error ? <div className="error"><AlertCircle size={18} /><span>{error}</span></div> : null}
      {syncStatus ? <div className="inlineSuccess">{syncStatus}</div> : null}

      <div className="impactSummary">
        {([
          ['Đã áp dụng', data?.totals.changes ?? 0, 'neutral', 'ALL'],
          ['Hiệu quả tăng', data?.totals.improved ?? 0, 'positive', 'IMPROVED'],
          ['Hiệu quả giảm', data?.totals.declined ?? 0, 'negative', 'DECLINED'],
          ['Đang chờ dữ liệu', data?.totals.collecting ?? 0, 'collecting', 'COLLECTING'],
        ] as const).map(([label, value, tone, targetVerdict]) => (
          <button
            type="button"
            className={`impactSummaryCard ${tone} ${verdict === targetVerdict ? 'selected' : ''}`}
            key={label}
            onClick={() => { setVerdict(targetVerdict); setPage(1); }}
          >
            <span>{label}</span><strong>{value}</strong>
          </button>
        ))}
      </div>

      <div className="impactToolbar">
        <label className="impactSearch">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tên hoặc ID chiến dịch/nhóm quảng cáo"
          />
        </label>
        <select aria-label="Nguồn thay đổi" value={origin} onChange={(event) => { setOrigin(event.target.value); setPage(1); }}>
          <option value="ALL">Tất cả nguồn thay đổi</option>
          <option value="MANUAL">Thay đổi thủ công</option>
          <option value="AI_APPROVED">Đề xuất AI đã duyệt</option>
          <option value="AI_AUTOMATION">AI tự động thay đổi</option>
        </select>
        <select aria-label="Kết quả hiệu suất" value={verdict} onChange={(event) => { setVerdict(event.target.value); setPage(1); }}>
          <option value="ALL">Tất cả kết quả</option>
          <option value="IMPROVED">Hiệu quả tăng</option>
          <option value="DECLINED">Hiệu quả giảm</option>
          <option value="MIXED">Kết quả hỗn hợp</option>
          <option value="COLLECTING">Đang chờ dữ liệu</option>
        </select>
        <span className="impactResultCount">{data?.pagination.total ?? 0} kết quả</span>
      </div>

      <details className="impactNote">
        <summary>Cách hệ thống tính kết quả</summary>
        <p>
          Hệ thống so sánh cùng số ngày trước và sau thay đổi, không tính ngày thực hiện thay đổi.
          Kết quả còn có thể chịu ảnh hưởng từ ngân sách, giá thầu, đối tượng hoặc tính mùa vụ.
        </p>
      </details>

      {!loading && data?.changes.length === 0 ? (
        <div className="impactEmpty">
          <Clock3 size={28} />
          <strong>Chưa có thay đổi đủ dữ liệu để đo lường</strong>
          <span>Hãy áp dụng thay đổi và đồng bộ dữ liệu hằng ngày để bắt đầu so sánh.</span>
        </div>
      ) : null}

      {!loading && data && data.changes.length > 0 && visibleChanges.length === 0 ? (
        <div className="impactEmpty">
          <Search size={28} />
          <strong>Không có chiến dịch phù hợp</strong>
          <span>Thử tên khác hoặc xóa bớt bộ lọc.</span>
        </div>
      ) : null}

      <div className="impactList">
        {visibleChanges.map((item) => {
          const meta = verdictMeta[item.verdict];
          const VerdictIcon = meta.icon;
          return (
            <article className="impactCard" key={item.id}>
              <header>
                <div>
                  <span className="impactCampaign">{item.campaign.name}</span>
                  <strong>{item.adGroup.name}</strong>
                  <small>
                    {originLabel[item.origin]} · Áp dụng ngày{' '}
                    {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(item.appliedAt))}
                  </small>
                  <span className="impactChangeDetail">
                    Đã thay {item.replacementCount} tài nguyên: {item.changeTypes.map((type) => changeTypeLabel[type] ?? type).join(', ')}
                  </span>
                </div>
                <span className={`impactVerdict ${item.verdict.toLowerCase()}`}>
                  <VerdictIcon size={15} /> {meta.label}
                </span>
              </header>
              <div className="impactMetrics">
                <MetricComparison label="CTR" before={item.before.ctr} after={item.after.ctr} format={percent} collecting={item.verdict === 'COLLECTING'} />
                <MetricComparison label="Tỷ lệ chuyển đổi" before={item.before.conversionRate} after={item.after.conversionRate} format={percent} collecting={item.verdict === 'COLLECTING'} />
                <MetricComparison label="CPA" before={item.before.cpa} after={item.after.cpa} format={(value) => money(value, currency)} lowerIsBetter collecting={item.verdict === 'COLLECTING'} />
                <MetricComparison label="Giá trị chuyển đổi / chi phí" before={item.before.roas} after={item.after.roas} format={percent} collecting={item.verdict === 'COLLECTING'} />
                <MetricComparison label="Lượt chuyển đổi" before={item.before.conversions} after={item.after.conversions} format={(value) => number(value, 2)} collecting={item.verdict === 'COLLECTING'} />
              </div>
              <footer>
                Dữ liệu: {item.coverage.beforeDays}/{item.coverage.requestedDays} ngày trước ·{' '}
                {item.coverage.afterDays}/{item.coverage.requestedDays} ngày sau
              </footer>
            </article>
          );
        })}
      </div>
      {data && data.pagination.totalPages > 1 ? (
        <div className="historyPagination">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>
            <ChevronLeft size={16} /> Trang trước
          </button>
          <span>Trang {data.pagination.page}/{data.pagination.totalPages}</span>
          <button type="button" disabled={page >= data.pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>
            Trang sau <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function ChangeImpactPanel({
  customerId,
  focusedChangeRequestId = '',
}: {
  customerId: string;
  focusedChangeRequestId?: string;
}) {
  const [tab, setTab] = useState<'impact' | 'history'>(focusedChangeRequestId ? 'history' : 'impact');

  useEffect(() => {
    if (focusedChangeRequestId) setTab('history');
  }, [focusedChangeRequestId]);
  return (
    <div className="changeTrackingPage">
      <div className="changeTrackingTabs" role="tablist" aria-label="Theo dõi thay đổi">
        <button
          type="button"
          role="tab"
          id="change-impact-tab"
          aria-controls="change-impact-panel"
          aria-selected={tab === 'impact'}
          className={tab === 'impact' ? 'active' : ''}
          onClick={() => setTab('impact')}
        >
          Hiệu quả sau thay đổi
        </button>
        <button
          type="button"
          role="tab"
          id="change-history-tab"
          aria-controls="change-history-panel"
          aria-selected={tab === 'history'}
          className={tab === 'history' ? 'active' : ''}
          onClick={() => setTab('history')}
        >
          Lịch sử thay đổi
        </button>
      </div>
      {tab === 'impact' ? (
        <div id="change-impact-panel" role="tabpanel" aria-labelledby="change-impact-tab">
          <PerformanceAfterChanges customerId={customerId} />
        </div>
      ) : (
        <div id="change-history-panel" role="tabpanel" aria-labelledby="change-history-tab">
          <ChangeHistoryPanel customerId={customerId} focusedChangeRequestId={focusedChangeRequestId} />
        </div>
      )}
    </div>
  );
}
