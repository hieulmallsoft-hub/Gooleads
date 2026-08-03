import { useEffect, useEffectEvent, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Clock3, RefreshCw, Search } from 'lucide-react';
import { apiFetch, extractApiError, parseJsonSafe } from '../../api/client';

type HistoryItem = {
  id: string;
  origin: 'MANUAL' | 'AI_APPROVED' | 'AI_AUTOMATION';
  status: string;
  requestedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  campaign: { id: string; name: string } | null;
  adGroup: { id: string; name: string } | null;
  changeTypes: string[];
  replacementCount: number;
};

type HistoryResponse = {
  items: HistoryItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type HistoryDetailItem = {
  id: string;
  changeType: string;
  mediaType: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  oldAssetResourceName: string | null;
  newAssetResourceName: string | null;
  oldAdResourceName: string | null;
  newAdResourceName: string | null;
  replacementCount: number;
  status: string;
  errorMessage: string | null;
};

type HistoryDetail = {
  id: string;
  items: HistoryDetailItem[];
};

const originLabels = {
  MANUAL: 'Thay đổi thủ công',
  AI_APPROVED: 'Đề xuất AI đã duyệt',
  AI_AUTOMATION: 'AI tự động thay đổi',
} as const;

const statusLabels: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPLYING: 'Đang áp dụng',
  APPLIED: 'Đã áp dụng',
  PARTIAL: 'Áp dụng một phần',
  FAILED: 'Thất bại',
};

const changeTypeLabels: Record<string, string> = {
  TEXT_REPLACE: 'Nội dung văn bản',
  TEXT_REPLACEMENT: 'Nội dung văn bản',
  MEDIA_REPLACE: 'Hình ảnh/video',
  MEDIA_REPLACEMENT: 'Hình ảnh/video',
  ASSET_REPLACEMENT: 'Tài nguyên quảng cáo',
};

type TextReplacement = { oldText: string; newText: string };

function findTextReplacements(value: unknown, found: TextReplacement[] = []): TextReplacement[] {
  if (Array.isArray(value)) {
    value.forEach((item) => findTextReplacements(item, found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  const record = value as Record<string, unknown>;
  if (typeof record.oldText === 'string' && typeof record.newText === 'string') {
    if (!found.some((item) => item.oldText === record.oldText && item.newText === record.newText)) {
      found.push({ oldText: record.oldText, newText: record.newText });
    }
  }
  Object.values(record).forEach((item) => findTextReplacements(item, found));
  return found;
}

function findPreviewUrl(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findPreviewUrl(item);
      if (result) return result;
    }
    return '';
  }
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const key of ['previewUrl', 'imageUrl', 'url']) {
    const candidate = record[key];
    if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) return candidate;
  }
  for (const item of Object.values(record)) {
    const result = findPreviewUrl(item);
    if (result) return result;
  }
  return '';
}

function resourceLabel(value: string | null) {
  if (!value) return '—';
  return value.split('/').filter(Boolean).at(-1) ?? value;
}

export function ChangeHistoryPanel({
  customerId,
  focusedChangeRequestId = '',
}: {
  customerId: string;
  focusedChangeRequestId?: string;
}) {
  const [query, setQuery] = useState(focusedChangeRequestId);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [source, setSource] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (focusedChangeRequestId) {
      setQuery(focusedChangeRequestId);
      setSource('ALL');
      setStatus('ALL');
      setPage(1);
    }
  }, [focusedChangeRequestId]);

  async function load() {
    if (!customerId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        customerId,
        q: debouncedQuery,
        source,
        status,
        page: String(page),
        pageSize: '25',
      });
      const response = await apiFetch(`/creative-operations/change-history?${params}`);
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể tải lịch sử thay đổi'));
      }
      setData(body as HistoryResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử thay đổi');
    } finally {
      setLoading(false);
    }
  }

  const loadEffect = useEffectEvent(load);

  useEffect(() => {
    void loadEffect();
  }, [customerId, debouncedQuery, source, status, page]);

  async function toggleDetail(changeId: string) {
    if (expandedId === changeId) {
      setExpandedId('');
      setDetail(null);
      return;
    }
    setExpandedId(changeId);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const response = await apiFetch(
        `/creative-operations/change-history/${changeId}?${new URLSearchParams({ customerId })}`,
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Không thể tải chi tiết thay đổi'));
      setDetail(body as HistoryDetail);
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Không thể tải chi tiết thay đổi');
    } finally {
      setDetailLoading(false);
    }
  }

  const openFocusedDetail = useEffectEvent((changeId: string) => {
    void toggleDetail(changeId);
  });

  useEffect(() => {
    if (
      focusedChangeRequestId &&
      data?.items.some((item) => item.id === focusedChangeRequestId) &&
      expandedId !== focusedChangeRequestId
    ) {
      openFocusedDetail(focusedChangeRequestId);
    }
  }, [data, expandedId, focusedChangeRequestId]);

  return (
    <section className="changeImpactPage">
      <div className="impactHeader">
        <div>
          <span className="eyebrow">Nhật ký</span>
          <h1>Lịch sử thay đổi chiến dịch</h1>
          <p>Tìm lại chiến dịch hoặc nhóm quảng cáo đã được bạn hay AI thay đổi.</p>
        </div>
        <button className="primaryButton" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Làm mới
        </button>
      </div>

      <div className="impactToolbar">
        <label className="impactSearch">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên hoặc ID chiến dịch/nhóm quảng cáo"
          />
        </label>
        <select
          aria-label="Nguồn thay đổi"
          value={source}
          onChange={(event) => { setSource(event.target.value); setPage(1); }}
        >
          <option value="ALL">Tất cả nguồn</option>
          <option value="MANUAL">Thay đổi thủ công</option>
          <option value="AI_APPROVED">Đề xuất AI đã duyệt</option>
          <option value="AI_AUTOMATION">AI tự động thay đổi</option>
        </select>
        <select
          aria-label="Trạng thái thay đổi"
          value={status}
          onChange={(event) => { setStatus(event.target.value); setPage(1); }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPLYING">Đang áp dụng</option>
          <option value="APPLIED">Đã áp dụng</option>
          <option value="PARTIAL">Áp dụng một phần</option>
          <option value="FAILED">Thất bại</option>
        </select>
        <span className="impactResultCount">{data?.pagination.total ?? 0} kết quả</span>
      </div>

      {error ? <div className="error"><AlertCircle size={18} /><span>{error}</span></div> : null}

      <div className="historyTableWrap">
        <table className="historyTable">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Chiến dịch / Nhóm quảng cáo</th>
              <th>Nguồn</th>
              <th>Nội dung thay đổi</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((item) => {
              const isExpanded = expandedId === item.id;
              return [
              <tr
                key={item.id}
                className="historyClickableRow"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => void toggleDetail(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void toggleDetail(item.id);
                  }
                }}
              >
                  <td data-label="Thời gian">
                  <strong>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(item.requestedAt))}</strong>
                  <small>{new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(new Date(item.requestedAt))}</small>
                </td>
                  <td data-label="Chiến dịch">
                  <strong>{item.campaign?.name ?? 'Không xác định'}</strong>
                  <span>{item.adGroup?.name ?? 'Không có nhóm quảng cáo'}</span>
                  <small>ID: {item.campaign?.id ?? '—'} / {item.adGroup?.id ?? '—'}</small>
                </td>
                  <td data-label="Nguồn">{originLabels[item.origin]}</td>
                  <td data-label="Nội dung thay đổi">
                  <strong>{item.changeTypes.map((type) => changeTypeLabels[type] ?? type).join(', ')}</strong>
                  <small>{item.replacementCount} tài nguyên · {isExpanded ? 'Ẩn chi tiết' : 'Bấm để xem chi tiết'}</small>
                </td>
                  <td data-label="Trạng thái">
                  <span className={`historyStatus ${item.status.toLowerCase()}`}>
                    {statusLabels[item.status] ?? item.status}
                  </span>
                  {item.errorMessage ? <small className="historyError">{item.errorMessage}</small> : null}
                </td>
              </tr>,
              isExpanded ? (
                <tr className="historyDetailRow" key={`${item.id}-detail`}>
                  <td colSpan={5}>
                    {detailLoading ? <div className="historyDetailLoading"><RefreshCw size={16} className="spin" /> Đang tải chi tiết...</div> : null}
                    {detailError ? <div className="historyError">{detailError}</div> : null}
                    {detail?.id === item.id ? (
                      <div className="historyDetails">
                        {detail.items.length ? detail.items.map((detailItem, index) => {
                          const replacements = findTextReplacements(detailItem.before);
                          const beforePreview = findPreviewUrl(detailItem.before);
                          const afterPreview = findPreviewUrl(detailItem.after);
                          return (
                            <article className="historyDetailCard" key={detailItem.id}>
                              <header>
                                <strong>Thay đổi #{index + 1}: {changeTypeLabels[detailItem.changeType] ?? detailItem.changeType}</strong>
                                <span className={`historyStatus ${detailItem.status.toLowerCase()}`}>
                                  {statusLabels[detailItem.status] ?? detailItem.status}
                                </span>
                              </header>
                              <p>Đã thay tại {detailItem.replacementCount} vị trí{detailItem.mediaType ? ` · Loại ${detailItem.mediaType}` : ''}</p>
                              {replacements.map((replacement, replacementIndex) => (
                                <div className="historyReplacement" key={`${replacement.oldText}-${replacementIndex}`}>
                                  <div><span>Nội dung cũ</span><strong>{replacement.oldText || '—'}</strong></div>
                                  <div><span>Nội dung mới</span><strong>{replacement.newText || '—'}</strong></div>
                                </div>
                              ))}
                              {detailItem.oldAssetResourceName || detailItem.newAssetResourceName ? (
                                <div className="historyReplacement">
                                  <div>
                                    <span>Tài nguyên cũ</span>
                                    {beforePreview ? <img className="historyMediaPreview" src={beforePreview} alt="Tài nguyên trước thay đổi" /> : null}
                                    <strong>{resourceLabel(detailItem.oldAssetResourceName)}</strong>
                                  </div>
                                  <div>
                                    <span>Tài nguyên mới</span>
                                    {afterPreview ? <img className="historyMediaPreview" src={afterPreview} alt="Tài nguyên sau thay đổi" /> : null}
                                    <strong>{resourceLabel(detailItem.newAssetResourceName)}</strong>
                                  </div>
                                </div>
                              ) : null}
                              {detailItem.oldAdResourceName || detailItem.newAdResourceName ? (
                                <div className="historyAffectedAd">
                                  <span>Quảng cáo chịu ảnh hưởng</span>
                                  <strong>{resourceLabel(detailItem.newAdResourceName ?? detailItem.oldAdResourceName)}</strong>
                                </div>
                              ) : null}
                              {detailItem.errorMessage ? <div className="historyError">{detailItem.errorMessage}</div> : null}
                            </article>
                          );
                        }) : <div className="impactEmpty"><span>Lần thay đổi này chưa có dữ liệu chi tiết.</span></div>}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ) : null,
              ];
            })}
            {!loading && !data?.items.length ? (
              <tr><td colSpan={5}>
                <div className="impactEmpty">
                  <Clock3 size={26} />
                  <strong>Không tìm thấy lịch sử phù hợp</strong>
                  <span>Thử tên chiến dịch khác hoặc bỏ bớt bộ lọc.</span>
                </div>
              </td></tr>
            ) : null}
          </tbody>
        </table>
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
