import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  MousePointerClick,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { OperationsPanel, type OperationsSection } from './components/OperationsPanel';
import { ChangeImpactPanel } from './features/change-impact/ChangeImpactPanel';
import { UserGuidePage } from './features/guide/UserGuidePage';
import { LoginPage } from './components/auth/LoginPage';
import { AdsSidebar } from './components/layout/AdsSidebar';
import { AdsTopbar } from './components/layout/AdsTopbar';
import type { AppNotification } from './components/layout/NotificationBell';
import { AssetWorkflow } from './components/workflow/AssetWorkflow';
import { DataContext } from './components/workflow/DataContext';
import { DateRangeFilter } from './components/filters/DateRangeFilter';
import { PerformanceSummary } from './features/performance/PerformanceSummary';
import { PerformanceTable } from './features/performance/PerformanceTable';
import {
  CampaignGroupsPanel,
  type CampaignGroupSelection,
} from './features/campaign-groups/CampaignGroupsPanel';
import { AiCreativeReviewPanel } from './features/assets/AiCreativeReviewPanel';
import { AiTextSuggestionsPanel } from './features/assets/AiTextSuggestionsPanel';
import { TextAssetAssistant } from './features/assets/TextAssetAssistant';
import { MediaReplacementPanel } from './features/assets/MediaReplacementPanel';
import {
  apiFetch,
  AUTH_SESSION_EXPIRED_EVENT,
  extractApiError,
  parseJsonSafe,
} from './api/client';
import {
  AD_GROUP_STORAGE_KEY,
  AUTO_AI_STORAGE_KEY,
  CUSTOMER_STORAGE_KEY,
  DESCRIPTION_MAX_LENGTH,
  HEADLINE_MAX_LENGTH,
  PAGE_SIZE,
  VIEW_STATE_STORAGE_KEY,
} from './config/googleAds';
import {
  assetTitle,
  getAssetPreviewUrl,
  getMediaReplacementType,
} from './utils/assets';
import {
  formatNumber,
} from './utils/format';
import {
  getReplacementImageSpec,
  normalizeImageForGoogleAds,
} from './utils/image';
import {
  getInitialAdGroupOptions,
  getInitialCustomerOptions,
  normalizeNumericId,
} from './utils/storage';
import { formatTimeRangeLabel } from './utils/dateRange';
import type {
  AdGroup,
  AdGroupResponse,
  AdGroupSortKey,
  AuthMeResponse,
  AuthUser,
  AiCreativeRecommendation,
  AiReviewResponse,
  AiTextSuggestionsResponse,
  Asset,
  AssetResponse,
  AssetSortKey,
  Campaign,
  CampaignResponse,
  CustomerOption,
  GoogleAdsAccountResponse,
  LowTextCandidate,
  LowTextSuggestion,
  ReplaceLowAssetsResponse,
  ReplaceMediaResponse,
  ReplacementImageInfo,
  SortDir,
  TextChangeRequest,
  TextChangeRequestApplyResponse,
  SortKey,
  ViewMode,
} from './types/googleAds';

type AssetTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO';
type AssetLabelFilter = 'ALL' | 'LOW' | 'GOOD' | 'BEST' | 'LEARNING' | 'UNKNOWN';

const ASSET_LABEL_FILTERS: Array<{ value: AssetLabelFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả nhãn' },
  { value: 'LOW', label: 'Hiệu quả thấp' },
  { value: 'GOOD', label: 'Hiệu quả tốt' },
  { value: 'BEST', label: 'Tốt nhất' },
  { value: 'LEARNING', label: 'Đang học' },
  { value: 'UNKNOWN', label: 'Chưa xác định' },
];

type StoredViewState = {
  customerId?: string;
  adGroupId?: string;
  assetTypeFilter?: AssetTypeFilter;
  assetLabelFilter?: AssetLabelFilter;
  operationsSection?: OperationsSection | null;
  selectedCampaign?: { id: string; name: string } | null;
  timeRange?: string;
  viewMode?: ViewMode;
};

function readStoredViewState(): StoredViewState {
  try {
    const raw = window.localStorage.getItem(VIEW_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StoredViewState) : {};
  } catch {
    return {};
  }
}

function normalizeStoredNumericId(value: unknown) {
  return normalizeNumericId(String(value ?? ''));
}

function normalizeStoredViewMode(value: unknown): ViewMode {
  if (value === 'adGroups' || value === 'assets') return value;
  return 'campaigns';
}

function normalizeStoredOperationsSection(value: unknown): OperationsSection | null | undefined {
  if (value === null) return null;
  if (
    value === 'overview' ||
    value === 'impact' ||
    value === 'keywords' ||
    value === 'settings'
    || value === 'guide'
  ) {
    return value;
  }
  return undefined;
}

function normalizeStoredAssetLabelFilter(value: unknown): AssetLabelFilter {
  if (
    value === 'LOW' ||
    value === 'GOOD' ||
    value === 'BEST' ||
    value === 'LEARNING' ||
    value === 'UNKNOWN'
  ) {
    return value;
  }
  return 'ALL';
}

function normalizeStoredTimeRange(value: unknown) {
  const stored = String(value ?? '').trim();
  return stored || 'LAST_7_DAYS';
}

function normalizeStoredCampaign(value: unknown): Campaign | null {
  if (!value || typeof value !== 'object') return null;
  const campaign = value as { id?: unknown; name?: unknown };
  const id = normalizeStoredNumericId(campaign.id);
  const name = String(campaign.name ?? '').trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    cost: 0,
    conversions: 0,
    conversionValue: 0,
    roas: 0,
  };
}

function formatAutomationNotificationDate(value: unknown) {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return 'AI định kỳ';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function toAutomationNotification(value: unknown): AppNotification {
  const item = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
  const severity =
    item.severity === 'critical' || item.severity === 'warning' || item.severity === 'info' || item.severity === 'success'
      ? item.severity
      : 'info';
  const recommendations = Array.isArray(item.recommendations)
    ? item.recommendations.map((recommendation) => String(recommendation))
    : [];

  return {
    id: String(item.id ?? `automation-${String(item.createdAtLabel ?? Date.now())}`),
    severity,
    title: String(item.title ?? 'AI định kỳ vừa chạy'),
    message: String(item.message ?? 'AI định kỳ vừa cập nhật Google Ads'),
    targetLabel: String(item.targetLabel ?? 'AI định kỳ'),
    recommendations,
    createdAtLabel: formatAutomationNotificationDate(item.createdAtLabel),
    action: item.action ? String(item.action) : undefined,
    actionLabel: item.actionLabel ? String(item.actionLabel) : undefined,
    changeRequestId: item.changeRequestId ? String(item.changeRequestId) : null,
  };
}

export default function App() {
  const initialViewState = readStoredViewState();
  const initialCustomerOptions = getInitialCustomerOptions();
  const initialStoredCustomerId = normalizeStoredNumericId(initialViewState.customerId);
  const seededCustomerOptions =
    initialStoredCustomerId &&
    !initialCustomerOptions.some((option) => option.value === initialStoredCustomerId)
      ? [...initialCustomerOptions, { value: initialStoredCustomerId, label: initialStoredCustomerId }]
      : initialCustomerOptions;
  const initialAdGroupOptions = getInitialAdGroupOptions();
  const initialStoredAdGroupId = normalizeStoredNumericId(initialViewState.adGroupId);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>(seededCustomerOptions);
  const [customerId, setCustomerId] = useState(
    () => initialStoredCustomerId || seededCustomerOptions[0]?.value || '',
  );
  const [adGroupOptions, setAdGroupOptions] = useState<CustomerOption[]>(initialAdGroupOptions);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [customerInputError, setCustomerInputError] = useState('');
  const [timeRange, setTimeRange] = useState(() => normalizeStoredTimeRange(initialViewState.timeRange));
  const [navOpen, setNavOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => normalizeStoredViewMode(initialViewState.viewMode));
  const [operationsSection, setOperationsSection] = useState<OperationsSection | null>(() => {
    const restored = normalizeStoredOperationsSection(initialViewState.operationsSection);
    return restored === undefined ? 'overview' : restored;
  });
  const [focusedChangeRequestId, setFocusedChangeRequestId] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetTypeFilter>('ALL');
  const [assetLabelFilter, setAssetLabelFilter] = useState<AssetLabelFilter>(() =>
    normalizeStoredAssetLabelFilter(initialViewState.assetLabelFilter),
  );
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(() =>
    normalizeStoredCampaign(initialViewState.selectedCampaign),
  );
  const [campaignGroupFilter, setCampaignGroupFilter] = useState<CampaignGroupSelection | null>(null);
  const [adGroupId, setAdGroupId] = useState(
    () => initialStoredAdGroupId || initialAdGroupOptions[0]?.value || '',
  );
  const activeAssetScopeRef = useRef('');
  const customerResetMountedRef = useRef(false);
  const [searchText, setSearchText] = useState('');
  const [data, setData] = useState<CampaignResponse | null>(null);
  const [adGroupData, setAdGroupData] = useState<AdGroupResponse | null>(null);
  const [assetData, setAssetData] = useState<AssetResponse | null>(null);
  const [assetLoadVersion, setAssetLoadVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [adGroupLoading, setAdGroupLoading] = useState(false);
  const [assetLoading, setAssetLoading] = useState(false);
  const [error, setError] = useState('');
  const [adGroupError, setAdGroupError] = useState('');
  const [assetError, setAssetError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('impressions');
  const [adGroupSortKey, setAdGroupSortKey] = useState<AdGroupSortKey>('impressions');
  const [assetSortKey, setAssetSortKey] = useState<AssetSortKey>('impressions');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [adGroupSortDir, setAdGroupSortDir] = useState<SortDir>('desc');
  const [assetSortDir, setAssetSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE);
  const [replacementHeadline, setReplacementHeadline] = useState('');
  const [replacementDescription, setReplacementDescription] = useState('');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [replaceError, setReplaceError] = useState('');
  const [replaceStatus, setReplaceStatus] = useState('');
  const [textChangeRequest, setTextChangeRequest] = useState<TextChangeRequest | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewResponse | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewError, setAiReviewError] = useState('');
  const [aiTextSuggestions, setAiTextSuggestions] = useState<AiTextSuggestionsResponse | null>(null);
  const [selectedTextSuggestionKeys, setSelectedTextSuggestionKeys] = useState<string[]>([]);
  const [approvedCreativeSuggestionIds, setApprovedCreativeSuggestionIds] = useState<string[]>([]);
  const [decisionLoadingIds, setDecisionLoadingIds] = useState<string[]>([]);
  const [aiTextLoading, setAiTextLoading] = useState(false);
  const [aiTextError, setAiTextError] = useState('');
  const [assistantAsset, setAssistantAsset] = useState<Asset | null>(null);
  const [assetTranslation, setAssetTranslation] = useState('');
  const [assetTranslationLoading, setAssetTranslationLoading] = useState(false);
  const [assetTranslationError, setAssetTranslationError] = useState('');
  const [manualAssetText, setManualAssetText] = useState('');
  const [autoAiRunKey, setAutoAiRunKey] = useState('');
  const [autoAiEnabled, setAutoAiEnabled] = useState(false);
  const [automationNotifications, setAutomationNotifications] = useState<AppNotification[]>([]);
  const aiReviewCacheRef = useRef(new Map<string, AiReviewResponse>());
  const aiTextCacheRef = useRef(new Map<string, AiTextSuggestionsResponse>());
  const [mediaReplacementTarget, setMediaReplacementTarget] = useState<Asset | null>(null);
  const [replacementImageFile, setReplacementImageFile] = useState<File | null>(null);
  const [replacementImageInfo, setReplacementImageInfo] = useState<ReplacementImageInfo | null>(null);
  const [replacementVideoUrl, setReplacementVideoUrl] = useState('');
  const [mediaReplaceConfirmed, setMediaReplaceConfirmed] = useState(false);
  const [mediaReplaceLoading, setMediaReplaceLoading] = useState(false);
  const [mediaReplaceError, setMediaReplaceError] = useState('');
  const [mediaReplaceStatus, setMediaReplaceStatus] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const selectedAdGroup = useMemo(
    () => adGroupData?.adGroups.find((adGroup) => adGroup.id === adGroupId) ?? null,
    [adGroupData, adGroupId],
  );
  const assetCampaignOptions = useMemo(() => {
    const campaignsById = new Map<string, { id: string; name: string }>();

    for (const campaign of data?.campaigns ?? []) {
      campaignsById.set(campaign.id, { id: campaign.id, name: campaign.name });
    }

    for (const adGroup of adGroupData?.adGroups ?? []) {
      if (!campaignsById.has(adGroup.campaignId)) {
        campaignsById.set(adGroup.campaignId, {
          id: adGroup.campaignId,
          name: adGroup.campaignName || `Chiến dịch ${adGroup.campaignId}`,
        });
      }
    }

    return Array.from(campaignsById.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [adGroupData, data]);
  const adGroupSelectOptions = useMemo(() => {
    const optionsById = new Map<
      string,
      { value: string; label: string; campaignId: string; campaignName: string }
    >();
    const activeCampaignId = selectedCampaign?.id ?? selectedAdGroup?.campaignId ?? '';

    for (const adGroup of adGroupData?.adGroups ?? []) {
      if (activeCampaignId && adGroup.campaignId !== activeCampaignId) {
        continue;
      }

      optionsById.set(adGroup.id, {
        value: adGroup.id,
        label: `${adGroup.name || `Nhóm quảng cáo ${adGroup.id}`} (${adGroup.id})`,
        campaignId: adGroup.campaignId,
        campaignName: adGroup.campaignName || `Chiến dịch ${adGroup.campaignId}`,
      });
    }

    for (const option of adGroupOptions) {
      if (activeCampaignId) {
        continue;
      }

      const normalizedId = normalizeNumericId(option.value);
      if (normalizedId && !optionsById.has(normalizedId)) {
        optionsById.set(normalizedId, {
          value: normalizedId,
          label: option.label || normalizedId,
          campaignId: '',
          campaignName: '',
        });
      }
    }

    if (!activeCampaignId && adGroupId && !optionsById.has(adGroupId)) {
      optionsById.set(adGroupId, {
        value: adGroupId,
        label: `Nhóm quảng cáo ${adGroupId}`,
        campaignId: '',
        campaignName: '',
      });
    }

    return Array.from(optionsById.values());
  }, [adGroupData, adGroupId, adGroupOptions, selectedAdGroup, selectedCampaign]);
  const selectedAssetCampaignId = selectedAdGroup?.campaignId ?? selectedCampaign?.id ?? '';
  const selectedAdGroupLabel =
    selectedAdGroup?.name ||
    adGroupSelectOptions.find((option) => option.value === adGroupId)?.label ||
    (adGroupId ? `Nhóm quảng cáo ${adGroupId}` : 'Chọn nhóm quảng cáo');
  const canEditSelectedCampaign =
    authUser?.role === 'ADMIN' ||
    Boolean(
      authUser?.role === 'EDITOR' &&
        authUser.accountAccess.some((access) => access.customerId === customerId),
    );
  const canManageCampaignGroups = Boolean(
    authUser?.permissions.includes('campaign_groups.manage'),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      setAuthLoading(true);
      setAuthError('');
      try {
        const response = await apiFetch('/auth/me');
        const body = await parseJsonSafe(response);
        if (!response.ok) {
          setAuthUser(null);
          return;
        }
        if (!cancelled) {
          setAuthUser((body as AuthMeResponse).user);
        }
      } catch (err) {
        if (!cancelled) {
          setAuthUser(null);
          setAuthError(err instanceof Error ? err.message : 'Không thể kiểm tra phiên đăng nhập');
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    void loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setAuthUser(null);
      setAuthError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  async function handleLogout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      setAuthUser(null);
      setAuthError('');
    }
  }

  useEffect(() => {
    if (!authUser) return;

    let cancelled = false;

    async function loadCustomerAccounts() {
      try {
        const response = await apiFetch('/google-ads/accounts');
      const body = await parseJsonSafe(response);
        if (!response.ok) {
          throw new Error(extractApiError(body, 'Không thể tải tài khoản Google Ads'));
        }

        if (cancelled) return;

        const result = body as GoogleAdsAccountResponse;
        setCustomerOptions((currentOptions) => {
          const optionsById = new Map(
            currentOptions.map((option) => [option.value, option]),
          );

          for (const account of result.accounts) {
            const normalizedId = normalizeNumericId(account.customerId);
            if (!normalizedId) continue;

            optionsById.set(normalizedId, {
              value: normalizedId,
              label: account.displayName
                ? `${account.displayName} (${normalizedId})`
                : normalizedId,
            });
          }

          return Array.from(optionsById.values());
        });
      } catch {
        // Keep configured and locally saved customer IDs if the backend is unavailable.
      }
    }

    void loadCustomerAccounts();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AUTO_AI_STORAGE_KEY);
      const stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      setAutoAiEnabled(Boolean(stored[customerId]));
    } catch {
      setAutoAiEnabled(false);
    }
  }, [customerId]);

  useEffect(() => {
    const state: StoredViewState = {
      customerId,
      adGroupId,
      assetTypeFilter,
      assetLabelFilter,
      operationsSection,
      selectedCampaign: selectedCampaign
        ? { id: selectedCampaign.id, name: selectedCampaign.name }
        : null,
      timeRange,
      viewMode,
    };

    try {
      window.localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore localStorage failures; reload will simply use the default page.
    }
  }, [
    adGroupId,
    assetLabelFilter,
    assetTypeFilter,
    customerId,
    operationsSection,
    selectedCampaign,
    timeRange,
    viewMode,
  ]);

  function updateAutoAiEnabled(enabled: boolean) {
    if (!canEditSelectedCampaign) return;
    setAutoAiEnabled(enabled);
    setAutoAiRunKey('');
    try {
      const raw = window.localStorage.getItem(AUTO_AI_STORAGE_KEY);
      const stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      window.localStorage.setItem(
        AUTO_AI_STORAGE_KEY,
        JSON.stringify({ ...stored, [customerId]: enabled }),
      );
    } catch {
      // Ignore localStorage failures; manual Generate buttons still work.
    }
  }

  const assetFingerprint = useMemo(() => {
    if (!assetData) return '';
    return assetData.assets
      .map((asset) => [
        asset.resourceName,
        asset.adResourceName,
        asset.fieldType,
        asset.type,
        asset.performanceLabel,
        asset.impressions,
        asset.clicks,
        asset.cost,
        asset.conversionValue,
      ].join(':'))
      .join('|');
  }, [assetData]);

  function getAiCacheKey(normalizedAdGroupId: string) {
    if (!assetData || !assetFingerprint) return '';
    return `${customerId}:${normalizedAdGroupId}:${assetData.timeRange}:${assetFingerprint}`;
  }

  async function persistSuggestionDecision(
    suggestionId: string,
    approved: boolean,
    variantId?: string,
  ) {
    setDecisionLoadingIds((current) => [...new Set([...current, suggestionId])]);
    try {
      const response = await apiFetch(
        `/google-ads/assets/ai-suggestions/${suggestionId}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: approved ? 'APPROVE' : 'UNAPPROVE',
            variantId: approved ? variantId : undefined,
          }),
        },
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể lưu phê duyệt AI'));
      }
    } finally {
      setDecisionLoadingIds((current) => current.filter((id) => id !== suggestionId));
    }
  }

  async function toggleTextSuggestionApproval(asset: LowTextSuggestion) {
    if (!canEditSelectedCampaign) {
      setAiTextError('Bạn chỉ có quyền xem, không thể phê duyệt đề xuất AI');
      return;
    }
    const approved = !selectedTextSuggestionKeys.includes(asset.key);
    setAiTextError('');
    try {
      await persistSuggestionDecision(asset.suggestionId, approved, asset.variants[0]?.id);
      setSelectedTextSuggestionKeys((current) =>
        approved
          ? [...new Set([...current, asset.key])]
          : current.filter((item) => item !== asset.key),
      );
      setReplaceError('');
      setReplaceStatus('');
      setTextChangeRequest(null);
      setReplaceConfirmed(false);
    } catch (err) {
      setAiTextError(err instanceof Error ? err.message : 'Không thể lưu phê duyệt AI');
    }
  }

  async function toggleAllTextSuggestionApprovals() {
    if (!canEditSelectedCampaign) {
      setAiTextError('Bạn chỉ có quyền xem, không thể phê duyệt đề xuất AI');
      return;
    }
    const approveAll = selectedLowTextSuggestions.length !== lowTextSuggestions.length;
    const targets = approveAll ? lowTextSuggestions : selectedLowTextSuggestions;
    setAiTextError('');
    try {
      await Promise.all(
        targets.map((asset) =>
          persistSuggestionDecision(
            asset.suggestionId,
            approveAll,
            asset.variants[0]?.id,
          ),
        ),
      );
      setSelectedTextSuggestionKeys(
        approveAll ? lowTextSuggestions.map((asset) => asset.key) : [],
      );
      setReplaceError('');
      setReplaceStatus('');
      setTextChangeRequest(null);
      setReplaceConfirmed(false);
    } catch (err) {
      setAiTextError(err instanceof Error ? err.message : 'Không thể lưu các phê duyệt AI');
    }
  }

  async function toggleCreativeSuggestionApproval(item: AiCreativeRecommendation) {
    if (!canEditSelectedCampaign) {
      setAiReviewError('Bạn chỉ có quyền xem, không thể phê duyệt đề xuất AI');
      return;
    }
    const approved = !approvedCreativeSuggestionIds.includes(item.suggestionId);
    setAiReviewError('');
    try {
      await persistSuggestionDecision(item.suggestionId, approved, item.variants[0]?.id);
      setApprovedCreativeSuggestionIds((current) =>
        approved
          ? [...new Set([...current, item.suggestionId])]
          : current.filter((id) => id !== item.suggestionId),
      );
    } catch (err) {
      setAiReviewError(err instanceof Error ? err.message : 'Không thể lưu phê duyệt AI');
    }
  }

  async function loadCampaigns() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ customerId, time: timeRange });
      const [response, adGroupResponse] = await Promise.all([
        apiFetch(`/google-ads/campaigns?${params}`),
        apiFetch(`/google-ads/ad-groups?${params}`),
      ]);
      const [body, adGroupBody] = await Promise.all([
        parseJsonSafe(response),
        parseJsonSafe(adGroupResponse),
      ]);

      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể tải dữ liệu Google Ads'));
      }
      if (!adGroupResponse.ok) {
        throw new Error(extractApiError(adGroupBody, 'Không thể đồng bộ nhóm quảng cáo cho Automation'));
      }

      setData(body);
      setAdGroupData(adGroupBody);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  async function loadAdGroups() {
    setAdGroupLoading(true);
    setAdGroupError('');

    try {
      const params = new URLSearchParams({ customerId, time: timeRange });
      const response = await apiFetch(`/google-ads/ad-groups?${params}`);
      const body = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể tải nhóm quảng cáo'));
      }

      setAdGroupData(body);
    } catch (err) {
      setAdGroupData(null);
      setAdGroupError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setAdGroupLoading(false);
    }
  }

  function campaignFromId(campaignId: string, fallbackName?: string): Campaign {
    return data?.campaigns.find((campaign) => campaign.id === campaignId) ?? {
      id: campaignId,
      name: fallbackName || `Chiến dịch ${campaignId}`,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cost: 0,
      conversions: 0,
      conversionValue: 0,
      roas: 0,
    };
  }

  function campaignFromAdGroup(adGroup: AdGroup): Campaign {
    return campaignFromId(adGroup.campaignId, adGroup.campaignName);
  }

  async function loadAssets(adGroupOverride?: string) {
    const normalizedAdGroupId = normalizeNumericId(adGroupOverride ?? adGroupId);
    if (!normalizedAdGroupId) {
      setAssetError('Hãy chọn nhóm quảng cáo để xem hiệu quả tài nguyên');
      return;
    }

    const requestScope = `${customerId}:${normalizedAdGroupId}:${timeRange}`;
    activeAssetScopeRef.current = requestScope;
    setAssetLoading(true);
    setAssetError('');
    setAiReview(null);
    setAiTextSuggestions(null);
    setApprovedCreativeSuggestionIds([]);
    setSelectedTextSuggestionKeys([]);
    setTextChangeRequest(null);
    setReplaceConfirmed(false);
    setAiReviewError('');
    setAiTextError('');

    try {
      const params = new URLSearchParams({
        customerId,
        adGroupId: normalizedAdGroupId,
        time: timeRange,
      });
      const response = await apiFetch(`/google-ads/assets?${params}`);
      const body = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể tải dữ liệu tài nguyên'));
      }

      if (activeAssetScopeRef.current !== requestScope) return;

      setAssetData(body);
      setAssetLoadVersion((version) => version + 1);
      setAiReview(null);
      setAiTextSuggestions(null);
      setSelectedTextSuggestionKeys([]);
      setTextChangeRequest(null);
      setReplaceConfirmed(false);
      setAiTextError('');
      setAutoAiRunKey('');
      setMediaReplacementTarget(null);
      setReplacementImageFile(null);
      setReplacementImageInfo(null);
      setReplacementVideoUrl('');
      setMediaReplaceConfirmed(false);
      setMediaReplaceError('');
      setMediaReplaceStatus('');
      setAdGroupId(normalizedAdGroupId);
      const loadedAdGroup = adGroupData?.adGroups.find(
        (adGroup) => adGroup.id === normalizedAdGroupId,
      );
      if (loadedAdGroup) {
        setSelectedCampaign(campaignFromAdGroup(loadedAdGroup));
      }
      setAdGroupOptions((currentOptions) => {
        const matchingAdGroup = adGroupData?.adGroups.find(
          (adGroup) => adGroup.id === normalizedAdGroupId,
        );
        const optionLabel =
          matchingAdGroup?.name
            ? `${matchingAdGroup.name} (${normalizedAdGroupId})`
            : normalizedAdGroupId;
        if (currentOptions.some((option) => option.value === normalizedAdGroupId)) {
          return currentOptions;
        }
        return [...currentOptions, { value: normalizedAdGroupId, label: optionLabel }];
      });
    } catch (err) {
      if (activeAssetScopeRef.current !== requestScope) return;
      setAssetData(null);
      setAssetLoadVersion((version) => version + 1);
      setAssetError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      if (activeAssetScopeRef.current === requestScope) setAssetLoading(false);
    }
  }

  function openAdGroupAssets(adGroup: AdGroup, filter: AssetTypeFilter = 'ALL') {
    setOperationsSection(null);
    setAssetTypeFilter(filter);
    setSelectedCampaign(campaignFromAdGroup(adGroup));
    setAdGroupId(adGroup.id);
    setAdGroupOptions((currentOptions) => {
      if (currentOptions.some((option) => option.value === adGroup.id)) {
        return currentOptions;
      }
      return [...currentOptions, { value: adGroup.id, label: `${adGroup.name} (${adGroup.id})` }];
    });
    setViewMode('assets');
    void loadAssets(adGroup.id);
  }

  function openCampaignAdGroups(campaign: Campaign) {
    setOperationsSection(null);
    setSelectedCampaign(campaign);
    setSearchText('');
    setViewMode('adGroups');
  }

  function openAssetsById(targetAdGroupId: string, filter: AssetTypeFilter = 'ALL') {
    const normalizedAdGroupId = normalizeNumericId(targetAdGroupId);
    if (!normalizedAdGroupId) return;
    setOperationsSection(null);
    setAssetTypeFilter(filter);
    setAdGroupId(normalizedAdGroupId);
    setViewMode('assets');
    void loadAssets(normalizedAdGroupId);
  }

  async function generateAiReview(adGroupOverride?: string, options: { force?: boolean } = {}) {
    if (!canEditSelectedCampaign) {
      setAiReviewError('Bạn chỉ có quyền xem. Hãy nhờ quản trị viên cấp quyền chỉnh sửa để tạo đánh giá AI.');
      return;
    }
    const normalizedAdGroupId = normalizeNumericId(
      typeof adGroupOverride === 'string' ? adGroupOverride : adGroupId,
    );

    if (!normalizedAdGroupId) {
      setAiReviewError('Enter an ad group ID before running AI review');
      return;
    }

    const requestScope = `${customerId}:${normalizedAdGroupId}:${timeRange}`;
    const loadedAssetScope = assetData
      ? `${customerId}:${assetData.adGroupId}:${assetData.timeRange}`
      : '';

    if (loadedAssetScope !== requestScope) {
      setAiReviewError('Hãy tải tài nguyên của nhóm quảng cáo trước khi chạy đánh giá AI');
      return;
    }

    const cacheKey = getAiCacheKey(normalizedAdGroupId);
    if (!options.force && cacheKey) {
      const cached = aiReviewCacheRef.current.get(cacheKey);
      if (cached) {
        setAiReview(cached);
        setApprovedCreativeSuggestionIds([]);
        setAiReviewError('');
        setAdGroupId(normalizedAdGroupId);
        return;
      }
    }

    setAiReviewLoading(true);
    setAiReviewError('');

    try {
      const response = await apiFetch('/google-ads/assets/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          adGroupId: normalizedAdGroupId,
          time: timeRange,
        }),
      });
      const body = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể tạo đánh giá AI'));
      }

      if (activeAssetScopeRef.current !== requestScope) return;

      const result = body as AiReviewResponse;
      setAiReview(result);
      if (cacheKey) {
        aiReviewCacheRef.current.set(cacheKey, result);
      }
      setApprovedCreativeSuggestionIds([]);
      setAdGroupId(normalizedAdGroupId);
    } catch (err) {
      if (activeAssetScopeRef.current !== requestScope) return;
      setAiReview(null);
      setApprovedCreativeSuggestionIds([]);
      setAiReviewError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      if (activeAssetScopeRef.current === requestScope) setAiReviewLoading(false);
    }
  }

  async function generateAiTextSuggestions(adGroupOverride?: string, options: { force?: boolean } = {}) {
    if (!canEditSelectedCampaign) {
      setAiTextError('Bạn chỉ có quyền xem. Hãy nhờ quản trị viên cấp quyền chỉnh sửa để tạo đề xuất AI.');
      return;
    }
    const normalizedAdGroupId = normalizeNumericId(
      typeof adGroupOverride === 'string' ? adGroupOverride : adGroupId,
    );

    if (!normalizedAdGroupId) {
      setAiTextError('Enter an ad group ID before generating AI suggestions');
      return;
    }

    const requestScope = `${customerId}:${normalizedAdGroupId}:${timeRange}`;
    const loadedAssetScope = assetData
      ? `${customerId}:${assetData.adGroupId}:${assetData.timeRange}`
      : '';

    if (loadedAssetScope !== requestScope) {
      setAiTextError('Hãy tải tài nguyên của nhóm quảng cáo trước khi tạo đề xuất AI');
      return;
    }

    const cacheKey = getAiCacheKey(normalizedAdGroupId);
    if (!options.force && cacheKey) {
      const cached = aiTextCacheRef.current.get(cacheKey);
      if (cached) {
        setAiTextSuggestions(cached);
        setSelectedTextSuggestionKeys([]);
        setTextChangeRequest(null);
        setReplaceConfirmed(false);
        setAiTextError('');
        setAdGroupId(normalizedAdGroupId);
        return;
      }
    }

    setAiTextLoading(true);
    setAiTextError('');
    setReplaceError('');
    setReplaceStatus('');
    setTextChangeRequest(null);
    setReplaceConfirmed(false);

    try {
      const response = await apiFetch('/google-ads/assets/ai-text-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          adGroupId: normalizedAdGroupId,
          time: timeRange,
        }),
      });
      const body = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể tạo đề xuất nội dung bằng AI'));
      }

      if (activeAssetScopeRef.current !== requestScope) return;

      const result = body as AiTextSuggestionsResponse;
      setAiTextSuggestions(result);
      if (cacheKey) {
        aiTextCacheRef.current.set(cacheKey, result);
      }
      setSelectedTextSuggestionKeys([]);
      setTextChangeRequest(null);
      setReplaceConfirmed(false);
      setAdGroupId(normalizedAdGroupId);
    } catch (err) {
      if (activeAssetScopeRef.current !== requestScope) return;
      setAiTextSuggestions(null);
      setSelectedTextSuggestionKeys([]);
      setAiTextError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      if (activeAssetScopeRef.current === requestScope) setAiTextLoading(false);
    }
  }

  async function replaceMediaAsset() {
    if (!canEditSelectedCampaign) {
      setMediaReplaceError('Bạn chỉ có quyền xem, không thể thay thế nội dung đa phương tiện');
      return;
    }
    const normalizedAdGroupId = normalizeNumericId(adGroupId);
    const mediaType = mediaReplacementTarget
      ? getMediaReplacementType(mediaReplacementTarget)
      : '';

    if (!normalizedAdGroupId) {
      setMediaReplaceError('Hãy nhập ID nhóm quảng cáo trước khi thay thế');
      return;
    }

    if (!mediaReplacementTarget || !mediaType || !mediaReplacementTarget.resourceName) {
      setMediaReplaceError('Hãy chọn một dòng HÌNH ẢNH hoặc VIDEO trong bảng tài nguyên trước');
      return;
    }

    if (mediaType === 'IMAGE' && !replacementImageFile) {
      setMediaReplaceError('Hãy tải lên hình ảnh thay thế');
      return;
    }

    if (mediaType === 'VIDEO' && !replacementVideoUrl.trim()) {
      setMediaReplaceError('Hãy nhập URL hoặc ID video YouTube thay thế');
      return;
    }

    if (!mediaReplaceConfirmed) {
      setMediaReplaceError('Hãy xác nhận thay thế trước khi cập nhật Google Ads');
      return;
    }

    setMediaReplaceLoading(true);
    setMediaReplaceError('');
    setMediaReplaceStatus('');

    try {
      const formData = new FormData();
      formData.append('customerId', customerId);
      formData.append('adGroupId', normalizedAdGroupId);
      formData.append('time', timeRange);
      formData.append('mediaType', mediaType);
      formData.append('oldAssetResourceName', mediaReplacementTarget.resourceName);

      if (mediaType === 'IMAGE' && replacementImageFile) {
        const normalizedImage = await normalizeImageForGoogleAds(
          replacementImageFile,
          getReplacementImageSpec(mediaReplacementTarget),
        );
        setReplacementImageFile(normalizedImage.file);
        setReplacementImageInfo(normalizedImage.info);
        formData.append('image', normalizedImage.file);
      }

      if (mediaType === 'VIDEO') {
        formData.append('youtubeVideo', replacementVideoUrl.trim());
      }

      const response = await apiFetch('/google-ads/assets/replace-media', {
        method: 'POST',
        body: formData,
      });
      const body = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể thay tài nguyên hình ảnh/video'));
      }

      const result = body as ReplaceMediaResponse;
      const replacements = result.replacedAds.reduce((sum, ad) => sum + ad.replacements, 0);
      setMediaReplaceStatus(
        `${result.message}. Đã thay ${replacements} vị trí tham chiếu bằng ${result.newAssetResourceName}.`,
      );
      setMediaReplaceConfirmed(false);
      setReplacementImageFile(null);
      setReplacementImageInfo(null);
      setReplacementVideoUrl('');
      await loadAssets();
    } catch (err) {
      setMediaReplaceError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setMediaReplaceLoading(false);
    }
  }

  function buildTextReplacementPayload() {
    const normalizedAdGroupId = normalizeNumericId(adGroupId);
    const headline = replacementHeadline.trim();
    const description = replacementDescription.trim();
    const manualReplacement = assistantAsset && manualAssetText.trim()
      ? { oldText: assistantAsset.text.trim(), newText: manualAssetText.trim() }
      : null;
    const headlineReplacements = manualReplacement && assistantAsset?.fieldType === 'HEADLINE'
      ? [manualReplacement]
      : headline
      ? []
      : selectedLowTextSuggestions
          .filter((asset) => asset.fieldType === 'HEADLINE')
          .map((asset) => ({
            oldText: asset.text,
            newText: asset.suggestion,
            suggestionId: asset.suggestionId,
            variantId: asset.variants[0]?.id,
          }));
    const descriptionReplacements = manualReplacement && assistantAsset?.fieldType === 'DESCRIPTION'
      ? [manualReplacement]
      : description
      ? []
      : selectedLowTextSuggestions
          .filter((asset) => asset.fieldType === 'DESCRIPTION')
          .map((asset) => ({
            oldText: asset.text,
            newText: asset.suggestion,
            suggestionId: asset.suggestionId,
            variantId: asset.variants[0]?.id,
          }));

    return {
      normalizedAdGroupId,
      headline: manualReplacement ? '' : headline,
      description: manualReplacement ? '' : description,
      headlineReplacements,
      descriptionReplacements,
    };
  }

  async function createTextChangeRequest() {
    if (!canEditSelectedCampaign) {
      setReplaceError('Bạn chỉ có quyền xem, không thể thay đổi văn bản');
      return;
    }
    const {
      normalizedAdGroupId,
      headline,
      description,
      headlineReplacements,
      descriptionReplacements,
    } = buildTextReplacementPayload();

    if (!normalizedAdGroupId) {
      setReplaceError('Hãy nhập ID nhóm quảng cáo trước khi chuẩn bị yêu cầu thay đổi');
      return;
    }

    if (headline.length > HEADLINE_MAX_LENGTH) {
      setReplaceError(`Tiêu đề thay thế không được vượt quá ${HEADLINE_MAX_LENGTH} ký tự`);
      return;
    }

    if (description.length > DESCRIPTION_MAX_LENGTH) {
      setReplaceError(`Mô tả thay thế không được vượt quá ${DESCRIPTION_MAX_LENGTH} ký tự`);
      return;
    }

    if (
      !headline &&
      !description &&
      headlineReplacements.length === 0 &&
      descriptionReplacements.length === 0
    ) {
      setReplaceError('Hãy chọn ít nhất một đề xuất AI hoặc nhập nội dung thay thế trước khi xem trước');
      return;
    }

    setReplaceLoading(true);
    setReplaceError('');
    setReplaceStatus('');
    setTextChangeRequest(null);
    setReplaceConfirmed(false);

    try {
      const response = await apiFetch('/google-ads/change-requests/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          adGroupId: normalizedAdGroupId,
          time: timeRange,
          headline: headline || undefined,
          description: description || undefined,
          headlineReplacements,
          descriptionReplacements,
        }),
      });
      const body = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể chuẩn bị yêu cầu thay đổi'));
      }

      const request = body as TextChangeRequest;
      const plannedTexts = request.items.reduce((sum, item) => sum + item.replacementCount, 0);
      setTextChangeRequest(request);
      setReplaceStatus(`Bản xem trước đã sẵn sàng: ${request.items.length} quảng cáo và ${plannedTexts} nội dung văn bản. Hãy kiểm tra trước khi áp dụng.`);
      setAdGroupId(normalizedAdGroupId);
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setReplaceLoading(false);
    }
  }

  async function applyTextChangeRequest() {
    if (!canEditSelectedCampaign) {
      setReplaceError('Bạn chỉ có quyền xem, không thể áp dụng thay đổi');
      return;
    }
    if (!textChangeRequest) {
      setReplaceError('Hãy tạo bản xem trước trước khi áp dụng thay đổi');
      return;
    }

    if (!replaceConfirmed) {
      setReplaceError('Hãy xác nhận bản xem trước trước khi áp dụng lên Google Ads');
      return;
    }

    setReplaceLoading(true);
    setReplaceError('');
    setReplaceStatus('');

    try {
      const response = await apiFetch(`/google-ads/change-requests/${textChangeRequest.id}/apply`, {
        method: 'POST',
      });
      const body = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(extractApiError(body, 'Không thể áp dụng yêu cầu thay đổi'));
      }

      const applyResponse = body as TextChangeRequestApplyResponse;
      const result = applyResponse.result as ReplaceLowAssetsResponse;
      const changedTexts = result.replacedAds.reduce(
        (sum, ad) => sum + ad.headlineReplacements + ad.descriptionReplacements,
        0,
      );
      setReplaceStatus(
        `${result.message}. Đã áp dụng ${changedTexts} nội dung văn bản từ yêu cầu ${applyResponse.changeRequest.id}.`,
      );
      setReplaceConfirmed(false);
      setSelectedTextSuggestionKeys([]);
      await loadAssets();
      setTextChangeRequest(applyResponse.changeRequest);
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setReplaceLoading(false);
    }
  }

  const loadCampaignsEffect = useEffectEvent(loadCampaigns);
  const loadAdGroupsEffect = useEffectEvent(loadAdGroups);
  const loadAssetsEffect = useEffectEvent(loadAssets);
  const generateAiReviewEffect = useEffectEvent(generateAiReview);
  const generateAiTextSuggestionsEffect = useEffectEvent(generateAiTextSuggestions);
  const campaignFromAdGroupEffect = useEffectEvent(campaignFromAdGroup);

  useEffect(() => {
    if (authUser) {
      void loadCampaignsEffect();
    }
  }, [authUser, customerId, timeRange]);

  useEffect(() => {
    if (!authUser || !customerId) return;

    const refreshCampaigns = () => void loadCampaignsEffect();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshCampaigns();
    };
    const timer = window.setInterval(refreshCampaigns, 60_000);
    window.addEventListener('focus', refreshCampaigns);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshCampaigns);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [authUser, customerId, timeRange]);

  useEffect(() => {
    if (!authUser || !customerId) {
      setAutomationNotifications([]);
      return;
    }

    let cancelled = false;

    async function loadAutomationNotifications() {
      try {
        const response = await apiFetch(
          `/creative-operations/automation/notifications?${new URLSearchParams({ customerId })}`,
        );
        const body = await parseJsonSafe(response);
        if (!response.ok || cancelled) return;

        const items = Array.isArray(body.notifications) ? body.notifications : [];
        setAutomationNotifications(items.map(toAutomationNotification));
      } catch {
        if (!cancelled) {
          setAutomationNotifications([]);
        }
      }
    }

    void loadAutomationNotifications();
    const timer = window.setInterval(() => void loadAutomationNotifications(), 60_000);
    const refresh = () => void loadAutomationNotifications();
    window.addEventListener('automation-notifications-refresh', refresh);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('automation-notifications-refresh', refresh);
    };
  }, [authUser, customerId]);

  useEffect(() => {
    if (!customerResetMountedRef.current) {
      customerResetMountedRef.current = true;
      return;
    }

    setSelectedCampaign(null);
    setCampaignGroupFilter(null);
  }, [customerId]);

  useEffect(() => {
    if (authUser && viewMode === 'adGroups') {
      void loadAdGroupsEffect();
    }
  }, [authUser, customerId, timeRange, viewMode]);

  useEffect(() => {
    if (authUser && viewMode === 'assets') {
      void loadAdGroupsEffect();
    }
  }, [authUser, customerId, timeRange, viewMode]);

  useEffect(() => {
    if (authUser && viewMode === 'assets' && adGroupId.trim()) {
      void loadAssetsEffect();
    }
  }, [authUser, customerId, timeRange, viewMode, adGroupId]);

  useEffect(() => {
    if (
      viewMode === 'assets' &&
      selectedAdGroup &&
      selectedCampaign?.id !== selectedAdGroup.campaignId
    ) {
      setSelectedCampaign(campaignFromAdGroupEffect(selectedAdGroup));
    }
  }, [data, selectedAdGroup, selectedCampaign, viewMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    data,
    adGroupData,
    assetData,
    searchText,
    sortKey,
    sortDir,
    adGroupSortKey,
    adGroupSortDir,
    assetSortKey,
    assetSortDir,
    assetLabelFilter,
    rowsPerPage,
    viewMode,
    campaignGroupFilter,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CUSTOMER_STORAGE_KEY,
        JSON.stringify(customerOptions.map((customer) => customer.value)),
      );
    } catch {
      // Ignore localStorage failures; the current session still works.
    }
  }, [customerOptions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        AD_GROUP_STORAGE_KEY,
        JSON.stringify(adGroupOptions.map((adGroup) => adGroup.value)),
      );
    } catch {
      // Ignore localStorage failures; the current session still works.
    }
  }, [adGroupOptions]);

  function handleAddCustomerId() {
    const normalizedId = normalizeNumericId(newCustomerId);

    if (!/^\d{10}$/.test(normalizedId)) {
      setCustomerInputError('ID khách hàng phải có 10 chữ số');
      return;
    }

    setCustomerInputError('');
    setCustomerId(normalizedId);
    setNewCustomerId('');
    setCustomerOptions((currentOptions) => {
      if (currentOptions.some((customer) => customer.value === normalizedId)) {
        return currentOptions;
      }
      return [...currentOptions, { value: normalizedId, label: normalizedId }];
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'id' || key === 'status' ? 'asc' : 'desc');
    }
  }

  function handleAdGroupSort(key: AdGroupSortKey) {
    if (adGroupSortKey === key) {
      setAdGroupSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setAdGroupSortKey(key);
      setAdGroupSortDir(
        key === 'name' || key === 'id' || key === 'campaignName' || key === 'status'
          ? 'asc'
          : 'desc',
      );
    }
  }

  function handleAssetSort(key: AssetSortKey) {
    if (assetSortKey === key) {
      setAssetSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setAssetSortKey(key);
      setAssetSortDir(key === 'fieldType' || key === 'type' ? 'asc' : 'desc');
    }
  }

  const filteredCampaigns = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    let list = data?.campaigns ?? [];

    if (campaignGroupFilter) {
      const groupCampaignIds = new Set(campaignGroupFilter.campaignIds);
      list = list.filter((campaign) => groupCampaignIds.has(campaign.id));
    }

    if (keyword) {
      list = list.filter(
        (campaign) =>
          campaign.name.toLowerCase().includes(keyword) ||
          campaign.id.toLowerCase().includes(keyword) ||
          String(campaign.status ?? '').toLowerCase().includes(keyword),
      );
    }

    return [...list].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp =
        typeof aVal === 'string' || typeof bVal === 'string'
          ? String(aVal ?? '').localeCompare(String(bVal ?? ''))
          : Number(aVal ?? 0) - Number(bVal ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, searchText, sortKey, sortDir, campaignGroupFilter]);

  const filteredAdGroups = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    let list = adGroupData?.adGroups ?? [];

    if (selectedCampaign) {
      list = list.filter((adGroup) => adGroup.campaignId === selectedCampaign.id);
    }

    if (keyword) {
      list = list.filter(
        (adGroup) =>
          adGroup.name.toLowerCase().includes(keyword) ||
          adGroup.id.toLowerCase().includes(keyword) ||
          adGroup.campaignName.toLowerCase().includes(keyword) ||
          adGroup.campaignId.toLowerCase().includes(keyword) ||
          adGroup.status.toLowerCase().includes(keyword),
      );
    }

    return [...list].sort((a, b) => {
      const aVal = a[adGroupSortKey];
      const bVal = b[adGroupSortKey];
      const cmp =
        typeof aVal === 'string' || typeof bVal === 'string'
          ? String(aVal ?? '').localeCompare(String(bVal ?? ''))
          : Number(aVal ?? 0) - Number(bVal ?? 0);
      return adGroupSortDir === 'asc' ? cmp : -cmp;
    });
  }, [adGroupData, searchText, adGroupSortKey, adGroupSortDir, selectedCampaign]);

  const filteredAssets = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    let list = (assetData?.assets ?? []).filter(
      (asset) => asset.fieldType === 'HEADLINE' || asset.fieldType === 'DESCRIPTION',
    );

    if (assetLabelFilter !== 'ALL') {
      list = list.filter(
        (asset) => (asset.performanceLabel || 'UNKNOWN').toUpperCase() === assetLabelFilter,
      );
    }

    if (keyword) {
      list = list.filter((asset) =>
        [assetTitle(asset), asset.id, asset.type, asset.fieldType, asset.performanceLabel]
          .join(' ')
          .toLowerCase()
          .includes(keyword),
      );
    }

    return [...list].sort((a, b) => {
      const aVal = a[assetSortKey];
      const bVal = b[assetSortKey];
      const cmp =
        typeof aVal === 'string' || typeof bVal === 'string'
          ? String(aVal ?? '').localeCompare(String(bVal ?? ''))
          : Number(aVal ?? 0) - Number(bVal ?? 0);
      return assetSortDir === 'asc' ? cmp : -cmp;
    });
  }, [assetData, searchText, assetSortKey, assetSortDir, assetLabelFilter]);

  const bestCampaign = useMemo(() => {
    return filteredCampaigns.reduce<Campaign | null>((best, campaign) => {
      if (!best || campaign.roas > best.roas) {
        return campaign;
      }
      return best;
    }, null);
  }, [filteredCampaigns]);

  const campaignViews = data?.totalImpressions ?? 0;
  const aiRecommendations = aiReview?.recommendations ?? [];

  const lowTextCandidates = useMemo<LowTextCandidate[]>(() => {
    const grouped = new Map<
      string,
      LowTextCandidate & { conversionValue: number }
    >();

    for (const asset of assetData?.assets ?? []) {
      if (
        asset.performanceLabel !== 'LOW' ||
        (asset.fieldType !== 'HEADLINE' && asset.fieldType !== 'DESCRIPTION') ||
        !asset.text.trim()
      ) {
        continue;
      }

      const fieldType = asset.fieldType as LowTextSuggestion['fieldType'];
      const text = asset.text.trim();
      const key = `${fieldType}:${text.toLowerCase()}`;
      const current =
        grouped.get(key) ??
        {
          key,
          fieldType,
          text,
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversionValue: 0,
          roas: 0,
        };

      current.impressions += asset.impressions;
      current.clicks += asset.clicks;
      current.cost += asset.cost;
      current.conversionValue += asset.conversionValue;
      current.roas = current.cost > 0 ? current.conversionValue / current.cost : 0;
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.impressions - a.impressions)
      .map(({ conversionValue: _conversionValue, ...row }) => row);
  }, [assetData]);

  const lowTextSuggestions = useMemo(
    () => aiTextSuggestions?.suggestions ?? [],
    [aiTextSuggestions],
  );
  const assistantSuggestion = useMemo(() => {
    if (!assistantAsset) return null;
    const key = `${assistantAsset.fieldType}:${assistantAsset.text.trim().toLowerCase()}`;
    return lowTextSuggestions.find((item) => item.key === key) ?? null;
  }, [assistantAsset, lowTextSuggestions]);
  const selectedTextSuggestionSet = useMemo(
    () => new Set(selectedTextSuggestionKeys),
    [selectedTextSuggestionKeys],
  );
  const selectedLowTextSuggestions = useMemo(
    () => lowTextSuggestions.filter((asset) => selectedTextSuggestionSet.has(asset.key)),
    [lowTextSuggestions, selectedTextSuggestionSet],
  );

  async function translateTextAsset(asset = assistantAsset) {
    if (!asset?.text.trim()) return;
    setAssetTranslationLoading(true);
    setAssetTranslationError('');
    try {
      const response = await apiFetch('/google-ads/assets/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: asset.text }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Không thể dịch nội dung'));
      setAssetTranslation(String(body?.translation ?? ''));
    } catch (error) {
      setAssetTranslationError(error instanceof Error ? error.message : 'Không thể dịch nội dung');
    } finally {
      setAssetTranslationLoading(false);
    }
  }

  function openTextAssistant(asset: Asset, translateOnly = false) {
    setAssistantAsset(asset);
    setAssetTranslation('');
    setAssetTranslationError('');
    setReplaceError('');
    setManualAssetText('');
    setTextChangeRequest(null);
    setReplaceConfirmed(false);
    if (translateOnly) void translateTextAsset(asset);
    if (!translateOnly && asset.performanceLabel === 'LOW') {
      void generateAiTextSuggestions();
    }
  }
  const lowTextAssetCount = lowTextCandidates.length;
  const totalLowTextImpressions = lowTextCandidates.reduce(
    (sum, asset) => sum + asset.impressions,
    0,
  );

  useEffect(() => {
    if (viewMode !== 'assets' || !assetData || !assetFingerprint) return;

    const key = `${customerId}:${assetData.adGroupId}:${assetData.timeRange}:${assetFingerprint}`;
    const cachedReview = aiReviewCacheRef.current.get(key);
    const cachedTextSuggestions = aiTextCacheRef.current.get(key);

    if (cachedReview) {
      setAiReview(cachedReview);
      setAiReviewError('');
    }

    if (cachedTextSuggestions) {
      setAiTextSuggestions(cachedTextSuggestions);
      setAiTextError('');
    }
  }, [assetData, assetFingerprint, customerId, viewMode]);

  const maxRoas = useMemo(() => {
    if (filteredCampaigns.length === 0) return 1;
    return Math.max(...filteredCampaigns.map((campaign) => campaign.roas), 1);
  }, [filteredCampaigns]);

  const activeListLength =
    viewMode === 'assets'
      ? filteredAssets.length
      : viewMode === 'adGroups'
        ? filteredAdGroups.length
        : filteredCampaigns.length;
  const totalPages = Math.max(Math.ceil(activeListLength / rowsPerPage), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * rowsPerPage;
  const pageEnd = Math.min(pageStart + rowsPerPage, activeListLength);
  const paginatedCampaigns = filteredCampaigns.slice(pageStart, pageEnd);
  const paginatedAdGroups = filteredAdGroups.slice(pageStart, pageEnd);
  const paginatedAssets = filteredAssets.slice(pageStart, pageEnd);
  const selectedTimeLabel =
    {
      TODAY: 'Hôm nay',
      YESTERDAY: 'Hôm qua',
      LAST_7_DAYS: '7 ngày gần nhất',
      THIS_MONTH: 'tháng này',
    }[timeRange] ?? formatTimeRangeLabel(timeRange);
  const monitorNotifications = useMemo<AppNotification[]>(() => {
    const notifications: AppNotification[] = [];
    const campaignRows = filteredCampaigns;
    const adGroupRows = filteredAdGroups;
    const assetRows = filteredAssets;
    const avgCampaignRoas = campaignRows.length
      ? campaignRows.reduce((sum, campaign) => sum + campaign.roas, 0) / campaignRows.length
      : 0;
    const avgCampaignCost = campaignRows.length
      ? campaignRows.reduce((sum, campaign) => sum + campaign.cost, 0) / campaignRows.length
      : 0;
    const avgAdGroupRoas = adGroupRows.length
      ? adGroupRows.reduce((sum, adGroup) => sum + adGroup.roas, 0) / adGroupRows.length
      : 0;
    const avgAdGroupCost = adGroupRows.length
      ? adGroupRows.reduce((sum, adGroup) => sum + adGroup.cost, 0) / adGroupRows.length
      : 0;

    campaignRows
      .filter((campaign) =>
        campaign.cost >= Math.max(avgCampaignCost * 0.75, 1) &&
        campaign.roas < Math.max(avgCampaignRoas * 0.7, 0.25),
      )
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3)
      .forEach((campaign) => {
        notifications.push({
          id: `campaign-low-roas-${campaign.id}-${timeRange}`,
          severity: campaign.roas < Math.max(avgCampaignRoas * 0.45, 0.15) ? 'critical' : 'warning',
          title: 'Chiến dịch đang thấp hơn mục tiêu ROAS',
          message: `${campaign.name} có ROAS ${campaign.roas.toFixed(2)} với chi phí ${formatNumber(campaign.cost)} trong ${selectedTimeLabel}.`,
          targetLabel: 'Chiến dịch',
          createdAtLabel: selectedTimeLabel,
          recommendations: [
            'Mở nhóm quảng cáo để tìm phân khúc lưu lượng kém hiệu quả nhất.',
            'Kiểm tra tài nguyên hiệu quả thấp và cải thiện nội dung hoặc hình ảnh trước khi tăng chi phí.',
            'So sánh với chiến dịch có ROAS tốt nhất trong cùng nhóm.',
          ],
        });
      });

    campaignRows
      .filter((campaign) => campaign.conversions === 0 && campaign.cost >= Math.max(avgCampaignCost, 5))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 2)
      .forEach((campaign) => {
        notifications.push({
          id: `campaign-no-conv-${campaign.id}-${timeRange}`,
          severity: 'critical',
          title: 'Có chi phí nhưng chưa có chuyển đổi',
          message: `${campaign.name} đã chi ${formatNumber(campaign.cost)} nhưng chưa có chuyển đổi trong ${selectedTimeLabel}.`,
          targetLabel: 'Chiến dịch',
          createdAtLabel: selectedTimeLabel,
          recommendations: [
            'Kiểm tra cụm từ tìm kiếm, vị trí hiển thị và chất lượng đối tượng.',
            'Cân nhắc tạm dừng nhóm quảng cáo yếu hoặc giảm chi phí cho đến khi có lại chuyển đổi.',
            'Tạo gợi ý AI để thử hướng nội dung mới trước khi thay tài nguyên đang hoạt động.',
          ],
        });
      });

    adGroupRows
      .filter((adGroup) =>
        adGroup.cost >= Math.max(avgAdGroupCost * 0.8, 1) &&
        adGroup.roas < Math.max(avgAdGroupRoas * 0.65, 0.2),
      )
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3)
      .forEach((adGroup) => {
        notifications.push({
          id: `adgroup-low-roas-${adGroup.id}-${timeRange}`,
          severity: adGroup.roas < Math.max(avgAdGroupRoas * 0.4, 0.12) ? 'critical' : 'warning',
          title: 'Nhóm quảng cáo cần được xem lại nội dung',
          message: `${adGroup.name} thuộc ${adGroup.campaignName} có ROAS ${adGroup.roas.toFixed(2)} và ${formatNumber(adGroup.clicks)} lượt nhấp.`,
          targetLabel: 'Nhóm quảng cáo',
          createdAtLabel: selectedTimeLabel,
          recommendations: [
            'Mở tài nguyên của nhóm quảng cáo này và tạo đánh giá AI.',
            'Ưu tiên tiêu đề và mô tả có nhãn hiệu quả THẤP.',
            'Thử một tiêu đề nêu lợi ích rõ hơn trước khi thay toàn bộ nội dung.',
          ],
        });
      });

    if (assetData) {
      const lowAssets = assetRows.filter((asset) => asset.performanceLabel === 'LOW');
      const lowTextAssets = lowAssets.filter(
        (asset) => asset.fieldType === 'HEADLINE' || asset.fieldType === 'DESCRIPTION',
      );

      if (lowAssets.length >= 3) {
        notifications.push({
          id: `assets-many-low-${assetData.adGroupId}-${assetData.timeRange}`,
          severity: lowAssets.length >= 6 ? 'critical' : 'warning',
          title: 'Phát hiện nhiều tài nguyên hiệu quả thấp',
          message: `${selectedAdGroupLabel} có ${lowAssets.length} tài nguyên hiệu quả thấp trên tổng ${formatNumber(assetRows.reduce((sum, asset) => sum + asset.impressions, 0))} lượt hiển thị.`,
          targetLabel: 'Tài nguyên',
          createdAtLabel: selectedTimeLabel,
          recommendations: [
            lowTextAssets.length ? 'Tạo đề xuất AI cho tiêu đề/mô tả hiệu quả THẤP.' : 'Nội dung văn bản đang ổn định.',
            'Chỉ áp dụng thay đổi đã phê duyệt và theo dõi trong giai đoạn tiếp theo.',
          ],
        });
      }
    }

    return [...automationNotifications, ...notifications.slice(0, 8)].slice(0, 10);
  }, [
    assetData,
    automationNotifications,
    filteredAdGroups,
    filteredAssets,
    filteredCampaigns,
    selectedAdGroupLabel,
    selectedTimeLabel,
    timeRange,
  ]);
  const activeError =
    viewMode === 'assets'
      ? assetError
      : viewMode === 'adGroups'
        ? adGroupError
        : error;
  const activeLoading =
    viewMode === 'assets'
      ? assetLoading
      : viewMode === 'adGroups'
        ? adGroupLoading
        : loading;
  const hasTextReplacementInput =
    selectedLowTextSuggestions.length > 0 ||
    Boolean(replacementHeadline.trim()) ||
    Boolean(replacementDescription.trim());
  const aiTextDisabled =
    aiTextLoading ||
    assetLoading ||
    !canEditSelectedCampaign ||
    !assetData ||
    lowTextCandidates.length === 0 ||
    !adGroupId.trim();
  const createTextChangeDisabled =
    replaceLoading ||
    aiTextLoading ||
    assetLoading ||
    !canEditSelectedCampaign ||
    !hasTextReplacementInput ||
    !adGroupId.trim();
  const applyTextChangeDisabled =
    replaceLoading ||
    assetLoading ||
    !canEditSelectedCampaign ||
    !textChangeRequest ||
    textChangeRequest.status !== 'PENDING' ||
    !replaceConfirmed;
  const mediaReplacementType = mediaReplacementTarget
    ? getMediaReplacementType(mediaReplacementTarget)
    : '';
  const mediaReplacementPreviewUrl = getAssetPreviewUrl(mediaReplacementTarget);
  const mediaReplaceDisabled =
    mediaReplaceLoading ||
    assetLoading ||
    !canEditSelectedCampaign ||
    !mediaReplaceConfirmed ||
    !mediaReplacementTarget ||
    !mediaReplacementType ||
    (mediaReplacementType === 'IMAGE' && !replacementImageFile) ||
    (mediaReplacementType === 'VIDEO' && !replacementVideoUrl.trim());
  const searchPlaceholder =
    viewMode === 'assets'
      ? 'Tìm tiêu đề, mô tả, nhãn hoặc ID'
      : viewMode === 'adGroups'
        ? 'Tìm nhóm quảng cáo, chiến dịch hoặc ID'
        : 'Tìm chiến dịch hoặc ID';
  const approvedChangeCount =
    approvedCreativeSuggestionIds.length + selectedLowTextSuggestions.length;

  if (authLoading) {
    return (
      <main className="loginScreen">
        <section className="loginPanel compactLoginPanel">
          <strong>Đang kiểm tra phiên đăng nhập...</strong>
        </section>
      </main>
    );
  }

  if (!authUser) {
    return <LoginPage initialError={authError} onAuthenticated={(user) => {
      setAuthUser(user);
      setAuthError('');
    }} />;
  }

  return (
    <div className="adsApp">
      <AdsTopbar
        customerId={customerId}
        searchText={searchText}
        searchPlaceholder={searchPlaceholder}
        showSearch={!operationsSection}
        notifications={monitorNotifications}
        currentUser={authUser}
        onSearchChange={setSearchText}
        onMenuToggle={() => setNavOpen((current) => !current)}
        onOpenSettings={() => setOperationsSection('settings')}
        onOpenNotification={(notification) => {
          if (notification.changeRequestId) {
            setFocusedChangeRequestId(notification.changeRequestId);
            setOperationsSection('impact');
          } else if (notification.action === 'APPLIED') {
            setOperationsSection('impact');
          } else if (notification.action === 'SUGGESTED') {
            setOperationsSection(null);
            setViewMode('assets');
          } else {
            setOperationsSection('automation');
          }
        }}
        onLogout={handleLogout}
      />

      <div className="adsBody">
        <AdsSidebar
          open={navOpen}
          viewMode={viewMode}
          operationsSection={operationsSection}
          assetTypeFilter={assetTypeFilter}
          hasSelectedAdGroup={Boolean(adGroupId)}
          onClose={() => setNavOpen(false)}
          onOpenOperations={setOperationsSection}
          onOpenCampaigns={() => {
            setOperationsSection(null);
            setSelectedCampaign(null);
            setViewMode('campaigns');
          }}
          onOpenAdGroups={() => {
            setOperationsSection(null);
            setSelectedCampaign(null);
            setViewMode('adGroups');
          }}
          onOpenAssets={(filter = 'ALL') => {
            if (adGroupId) {
              void openAssetsById(adGroupId, filter);
            } else {
              setOperationsSection(null);
              setAssetTypeFilter(filter);
              setViewMode('assets');
              void loadAdGroups();
            }
          }}
        />

        <main className="shell">
        {operationsSection ? (
          operationsSection === 'impact' ? (
            <ChangeImpactPanel
              customerId={customerId}
              focusedChangeRequestId={focusedChangeRequestId}
            />
          ) : operationsSection === 'guide' ? (
            <UserGuidePage />
          ) : (
            <OperationsPanel
              section={operationsSection}
              customerId={customerId}
              request={apiFetch}
              currentUser={authUser}
              campaigns={data?.campaigns ?? []}
              onOpenAssets={(targetAdGroupId) => openAssetsById(targetAdGroupId)}
              onPasswordChanged={() => {
                setAuthUser(null);
                setAuthError('Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.');
              }}
            />
          )
        ) : (
        <>
        <DataContext
          viewMode={viewMode}
          assetTypeFilter={assetTypeFilter}
          selectedCampaign={selectedCampaign}
          adGroupId={adGroupId}
          adGroupLabel={selectedAdGroupLabel}
          onClearCampaign={() => setSelectedCampaign(null)}
          onOpenCampaigns={() => {
            setSelectedCampaign(null);
            setViewMode('campaigns');
          }}
          onOpenAdGroups={() => setViewMode('adGroups')}
        />
        <section className="pageHeader">
          <div className="pageTitleBlock">
            <h1>
              {viewMode === 'assets'
                ? 'Tài nguyên văn bản'
                : viewMode === 'adGroups'
                  ? 'Nhóm quảng cáo'
                  : 'Chiến dịch'}
            </h1>
            <p>
              {viewMode === 'assets'
                ? 'Kiểm tra nội dung văn bản hiệu quả thấp và phê duyệt chính xác nội dung cần thay đổi.'
                : viewMode === 'adGroups'
                  ? 'Chọn nhóm quảng cáo để mở tài nguyên và chạy đánh giá AI.'
                  : 'Review campaigns by views and open ad groups for asset-level work.'}
            </p>
          </div>

          <div className="controls">
            <label className="field">
              <span>ID khách hàng</span>
              <select
                aria-label="ID khách hàng"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                {customerOptions.map((customer) => (
                  <option key={customer.value} value={customer.value}>
                    {customer.label}
                  </option>
                ))}
              </select>
            </label>
            {viewMode === 'campaigns' ? (
              <>
                <label className="field customerAdd">
                  <span>ID khách hàng mới</span>
                  <input
                    aria-label="Add customer ID"
                    value={newCustomerId}
                    onChange={(event) => {
                      setNewCustomerId(event.target.value);
                      setCustomerInputError('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddCustomerId();
                      }
                    }}
                    placeholder="1234567890"
                  />
                  {customerInputError ? <span className="fieldError">{customerInputError}</span> : null}
                </label>
                <button className="secondaryButton" type="button" onClick={handleAddCustomerId}>
                  <Plus size={15} />
                  Add
                </button>
              </>
            ) : null}
            {viewMode === 'assets' ? (
              <>
                <label className="field customerAdd campaignSelectField">
                  <span>Chiến dịch</span>
                  <select
                    aria-label="Chiến dịch"
                    value={selectedAssetCampaignId}
                    onChange={(event) => {
                      const nextCampaignId = event.target.value;
                      const nextCampaign = assetCampaignOptions.find(
                        (campaign) => campaign.id === nextCampaignId,
                      );

                      setSelectedCampaign(
                        nextCampaign
                          ? campaignFromId(nextCampaign.id, nextCampaign.name)
                          : null,
                      );
                      setAdGroupId('');
                      setAssetData(null);
                      setAssetError('');
                    }}
                    disabled={adGroupLoading && assetCampaignOptions.length === 0}
                  >
                    <option value="">
                      {adGroupLoading ? 'Đang tải chiến dịch...' : 'Tất cả chiến dịch'}
                    </option>
                    {assetCampaignOptions.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field customerAdd adGroupSelectField">
                  <span>Nhóm quảng cáo</span>
                  <select
                    aria-label="Nhóm quảng cáo"
                    value={adGroupId}
                    onChange={(event) => {
                      const nextAdGroupId = event.target.value;
                      setAdGroupId(nextAdGroupId);
                      setAssetError('');

                      if (!nextAdGroupId) {
                        setAssetData(null);
                        return;
                      }

                      const selected = adGroupData?.adGroups.find(
                        (adGroup) => adGroup.id === nextAdGroupId,
                      );
                      if (selected) {
                        openAdGroupAssets(selected, assetTypeFilter);
                      } else {
                        openAssetsById(nextAdGroupId, assetTypeFilter);
                      }
                    }}
                    disabled={adGroupLoading && adGroupSelectOptions.length === 0}
                  >
                    <option value="">
                      {adGroupLoading
                        ? 'Đang tải nhóm quảng cáo...'
                        : selectedAssetCampaignId
                          ? 'Chọn nhóm quảng cáo'
                          : 'Chọn chiến dịch hoặc nhóm quảng cáo'}
                    </option>
                    {adGroupSelectOptions.map((adGroup) => (
                      <option key={adGroup.value} value={adGroup.value}>
                        {adGroup.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => {
                    setOperationsSection(null);
                    setSelectedCampaign(null);
                    setViewMode('adGroups');
                    void loadAdGroups();
                  }}
                >
                  <MousePointerClick size={15} />
                  Chọn
                </button>
              </>
            ) : null}
            <button
              className="primaryButton"
              type="button"
              onClick={() => {
                if (viewMode === 'assets') {
                  void loadAssets();
                } else if (viewMode === 'adGroups') {
                  void loadAdGroups();
                } else {
                  void loadCampaigns();
                }
              }}
              disabled={activeLoading || replaceLoading}
            >
              <RefreshCw size={15} className={activeLoading ? 'spin' : ''} />
              {activeLoading ? 'Đang tải...' : 'Tải dữ liệu'}
            </button>
          </div>
        </section>

        <section className="filters">
          <div className="filterGroup">
            <DateRangeFilter value={timeRange} onChange={setTimeRange} />
            {viewMode === 'assets' ? (
              <div className="segment labelSegment" aria-label="Lọc theo nhãn hiệu quả tài nguyên">
                {ASSET_LABEL_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={assetLabelFilter === filter.value ? 'active' : ''}
                    onClick={() => setAssetLabelFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="filterGroup alignRight">
            <span className="filterChip">
              {viewMode === 'assets'
                ? 'Trạng thái tài nguyên: Tất cả trừ đã xóa'
                : viewMode === 'adGroups'
                  ? 'Trạng thái nhóm quảng cáo: Đang bật'
                  : 'Trạng thái chiến dịch: Đang bật'}
            </span>
            {viewMode === 'campaigns' ? (
              <span className="filterChip activeViewChip">
                Chế độ xem: {campaignGroupFilter?.name ?? 'Tất cả chiến dịch'}
              </span>
            ) : null}
            <span className="filterCount">{activeListLength} dòng</span>
          </div>
        </section>

        {viewMode === 'assets' ? (
          <AssetWorkflow
            hasAdGroup={Boolean(adGroupId)}
            hasAssets={Boolean(assetData?.assets.length)}
            hasSuggestions={Boolean(aiRecommendations.length || lowTextSuggestions.length)}
            approvedCount={approvedChangeCount}
          />
        ) : null}

        {activeError ? (
          <div className="error">
            <AlertCircle size={18} />
            <span>{activeError}</span>
          </div>
        ) : null}

        <PerformanceSummary
          viewMode={viewMode}
          timeRange={timeRange}
          campaignData={data}
          adGroupData={adGroupData}
          assetData={assetData}
          campaigns={filteredCampaigns}
          adGroups={filteredAdGroups}
          assets={filteredAssets}
          campaignLoading={loading}
          adGroupLoading={adGroupLoading}
          assetLoading={assetLoading}
          campaignViews={campaignViews}
          bestCampaign={bestCampaign}
        />

        {viewMode === 'campaigns' ? (
          <CampaignGroupsPanel
            customerId={customerId}
            campaigns={data?.campaigns ?? []}
            canEdit={canManageCampaignGroups}
            onFilterChange={setCampaignGroupFilter}
          />
        ) : null}

        {false ? (
          <AiCreativeReviewPanel
            assetData={assetData}
            assetLoading={assetLoading}
            aiReview={aiReview}
            aiRecommendations={aiRecommendations.filter(
              (item) => item.mediaType !== 'Image' && item.mediaType !== 'Video',
            )}
            aiReviewLoading={aiReviewLoading}
            aiReviewError={aiReviewError}
            autoAiEnabled={autoAiEnabled}
            canEdit={canEditSelectedCampaign}
            approvedCreativeSuggestionIds={approvedCreativeSuggestionIds}
            decisionLoadingIds={decisionLoadingIds}
            onAutoAiChange={updateAutoAiEnabled}
            onGenerate={() => generateAiReview(undefined, { force: true })}
            onToggleApproval={(item) => void toggleCreativeSuggestionApproval(item)}
          />
        ) : null}

        {viewMode === 'assets' ? (
          <div hidden aria-hidden="true">
          <MediaReplacementPanel
            target={mediaReplacementTarget}
            mediaType={mediaReplacementType}
            previewUrl={mediaReplacementPreviewUrl}
            replacementImageInfo={replacementImageInfo}
            replacementVideoUrl={replacementVideoUrl}
            confirmed={mediaReplaceConfirmed}
            loading={mediaReplaceLoading}
            disabled={mediaReplaceDisabled}
            canEdit={canEditSelectedCampaign}
            error={mediaReplaceError}
            status={mediaReplaceStatus}
            onImageFileChange={async (file) => {
              setReplacementImageFile(file);
              setReplacementImageInfo(null);
              setMediaReplaceError('');
              setMediaReplaceStatus('');
              if (!file || !mediaReplacementTarget) {
                return;
              }

              try {
                const normalizedImage = await normalizeImageForGoogleAds(
                  file,
                  getReplacementImageSpec(mediaReplacementTarget),
                );
                setReplacementImageFile(normalizedImage.file);
                setReplacementImageInfo(normalizedImage.info);
              } catch (err) {
                setReplacementImageFile(null);
                setMediaReplaceError(
                  err instanceof Error ? err.message : 'Không thể đọc hình ảnh thay thế',
                );
              }
            }}
            onVideoUrlChange={(value) => {
              setReplacementVideoUrl(value);
              setMediaReplaceError('');
              setMediaReplaceStatus('');
            }}
            onConfirmedChange={(confirmed) => {
              setMediaReplaceConfirmed(confirmed);
              setMediaReplaceError('');
            }}
            onReplace={replaceMediaAsset}
          />
          </div>
        ) : null}

        {false ? (
          <AiTextSuggestionsPanel
            assetData={assetData}
            aiTextSuggestions={aiTextSuggestions}
            lowTextAssetCount={lowTextAssetCount}
            totalLowTextImpressions={totalLowTextImpressions}
            lowTextCandidateCount={lowTextCandidates.length}
            lowTextSuggestions={lowTextSuggestions}
            selectedLowTextSuggestions={selectedLowTextSuggestions}
            selectedTextSuggestionSet={selectedTextSuggestionSet}
            decisionLoadingIds={decisionLoadingIds}
            replacementHeadline={replacementHeadline}
            replacementDescription={replacementDescription}
            textChangeRequest={textChangeRequest}
            replaceConfirmed={replaceConfirmed}
            autoAiEnabled={autoAiEnabled}
            canEdit={canEditSelectedCampaign}
            aiTextLoading={aiTextLoading}
            aiTextDisabled={aiTextDisabled}
            replaceLoading={replaceLoading}
            createTextChangeDisabled={createTextChangeDisabled}
            applyTextChangeDisabled={applyTextChangeDisabled}
            replaceError={replaceError}
            aiTextError={aiTextError}
            replaceStatus={replaceStatus}
            onAutoAiChange={updateAutoAiEnabled}
            onGenerate={() => generateAiTextSuggestions(undefined, { force: true })}
            onToggleApproval={(asset) => void toggleTextSuggestionApproval(asset)}
            onToggleAllApprovals={() => void toggleAllTextSuggestionApprovals()}
            onHeadlineChange={(value) => {
              setReplacementHeadline(value.slice(0, HEADLINE_MAX_LENGTH));
              setReplaceError('');
              setReplaceStatus('');
              setTextChangeRequest(null);
              setReplaceConfirmed(false);
            }}
            onDescriptionChange={(value) => {
              setReplacementDescription(value.slice(0, DESCRIPTION_MAX_LENGTH));
              setReplaceError('');
              setReplaceStatus('');
              setTextChangeRequest(null);
              setReplaceConfirmed(false);
            }}
            onReplaceConfirmedChange={(confirmed) => {
              setReplaceConfirmed(confirmed);
              setReplaceError('');
            }}
            onCreatePreview={createTextChangeRequest}
            onApplyPreview={applyTextChangeRequest}
          />
        ) : null}

        <PerformanceTable
          viewMode={viewMode}
          timeRange={selectedTimeLabel}
          selectedCampaign={selectedCampaign}
          campaignData={data}
          adGroupData={adGroupData}
          assetData={assetData}
          filteredCampaignCount={filteredCampaigns.length}
          filteredAdGroupCount={filteredAdGroups.length}
          filteredAssetCount={filteredAssets.length}
          campaigns={paginatedCampaigns}
          adGroups={paginatedAdGroups}
          assets={paginatedAssets}
          campaignLoading={loading}
          adGroupLoading={adGroupLoading}
          assetLoading={assetLoading}
          campaignSortKey={sortKey}
          adGroupSortKey={adGroupSortKey}
          assetSortKey={assetSortKey}
          campaignSortDir={sortDir}
          adGroupSortDir={adGroupSortDir}
          assetSortDir={assetSortDir}
          maxRoas={maxRoas}
          activeListLength={activeListLength}
          pageStart={pageStart}
          pageEnd={pageEnd}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          activeLoading={activeLoading}
          onCampaignSort={handleSort}
          onAdGroupSort={handleAdGroupSort}
          onAssetSort={handleAssetSort}
          onOpenCampaign={openCampaignAdGroups}
          onOpenAdGroup={openAdGroupAssets}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={(nextRowsPerPage) => {
            setRowsPerPage(nextRowsPerPage);
            setCurrentPage(1);
          }}
          onOpenTextAssistant={openTextAssistant}
        />
        <TextAssetAssistant
          asset={assistantAsset}
          suggestion={assistantSuggestion}
          suggestionLoading={aiTextLoading}
          suggestionSelected={Boolean(assistantSuggestion && selectedTextSuggestionSet.has(assistantSuggestion.key))}
          translation={assetTranslation}
          translationLoading={assetTranslationLoading}
          suggestionError={aiTextError || replaceError}
          translationError={assetTranslationError}
          canEdit={canEditSelectedCampaign}
          preview={textChangeRequest}
          confirmed={replaceConfirmed}
          applying={replaceLoading}
          manualText={manualAssetText}
          targetLanguageName={aiTextSuggestions?.targetLanguageName ?? ''}
          languageSource={aiTextSuggestions?.languageSource ?? ''}
          adGroupTopic={aiTextSuggestions?.adGroupTopic ?? ''}
          onClose={() => setAssistantAsset(null)}
          onGenerate={() => void generateAiTextSuggestions(undefined, { force: true })}
          onTranslate={() => void translateTextAsset()}
          onToggleSuggestion={() => {
            if (assistantSuggestion) void toggleTextSuggestionApproval(assistantSuggestion);
          }}
          onManualTextChange={(value) => {
            setManualAssetText(value);
            setReplaceError('');
            setReplaceStatus('');
            setTextChangeRequest(null);
            setReplaceConfirmed(false);
          }}
          onCreatePreview={() => void createTextChangeRequest()}
          onConfirmedChange={setReplaceConfirmed}
          onApply={() => void applyTextChangeRequest()}
        />
        </>
        )}
        </main>
      </div>
    </div>
  );
}
