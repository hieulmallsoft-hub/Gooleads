import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  FileText,
  Image,
  Plus,
  RefreshCw,
  Sparkles,
  Video,
} from 'lucide-react';
import { OperationsPanel, type OperationsSection } from './components/OperationsPanel';
import { AdsSidebar } from './components/layout/AdsSidebar';
import { AdsTopbar } from './components/layout/AdsTopbar';
import { AssetWorkflow } from './components/workflow/AssetWorkflow';
import { DataContext } from './components/workflow/DataContext';
import { DateRangeFilter } from './components/filters/DateRangeFilter';
import { PerformanceSummary } from './features/performance/PerformanceSummary';
import { PerformanceTable } from './features/performance/PerformanceTable';
import { CampaignGroupsPanel } from './features/campaign-groups/CampaignGroupsPanel';
import { apiFetch, extractApiError, parseJsonSafe } from './api/client';
import {
  AD_GROUP_STORAGE_KEY,
  CUSTOMER_STORAGE_KEY,
  DESCRIPTION_MAX_LENGTH,
  HEADLINE_MAX_LENGTH,
  PAGE_SIZE,
} from './config/googleAds';
import {
  assetTitle,
  getAssetPreviewUrl,
  getMediaReplacementType,
} from './utils/assets';
import {
  formatNumber,
  formatPercent,
} from './utils/format';
import {
  getReplacementImageSpec,
  normalizeImageForGoogleAds,
} from './utils/image';
import {
  getInitialAdGroupOptions,
  getInitialCustomerOptions,
  normalizeNumericId,
  toCustomerOptions,
} from './utils/storage';
import { formatTimeRangeLabel } from './utils/dateRange';
import type {
  AdGroup,
  AdGroupResponse,
  AdGroupSortKey,
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
  SortKey,
  ViewMode,
} from './types/googleAds';

export default function App() {
  const initialCustomerOptions = getInitialCustomerOptions();
  const initialAdGroupOptions = getInitialAdGroupOptions();
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>(initialCustomerOptions);
  const [customerId, setCustomerId] = useState(() => initialCustomerOptions[0]?.value ?? '');
  const [adGroupOptions, setAdGroupOptions] = useState<CustomerOption[]>(initialAdGroupOptions);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [customerInputError, setCustomerInputError] = useState('');
  const [timeRange, setTimeRange] = useState('LAST_7_DAYS');
  const [navOpen, setNavOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('campaigns');
  const [operationsSection, setOperationsSection] = useState<OperationsSection | null>('overview');
  const [assetTypeFilter, setAssetTypeFilter] = useState<'ALL' | 'VIDEO'>('ALL');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignGroupFilterIds, setCampaignGroupFilterIds] = useState<string[] | null>(null);
  const [adGroupId, setAdGroupId] = useState(() => initialAdGroupOptions[0]?.value ?? '');
  const activeAssetScopeRef = useRef('');
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
  const [replacementHeadline, setReplacementHeadline] = useState('');
  const [replacementDescription, setReplacementDescription] = useState('');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [replaceError, setReplaceError] = useState('');
  const [replaceStatus, setReplaceStatus] = useState('');
  const [aiReview, setAiReview] = useState<AiReviewResponse | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewError, setAiReviewError] = useState('');
  const [aiTextSuggestions, setAiTextSuggestions] = useState<AiTextSuggestionsResponse | null>(null);
  const [selectedTextSuggestionKeys, setSelectedTextSuggestionKeys] = useState<string[]>([]);
  const [approvedCreativeSuggestionIds, setApprovedCreativeSuggestionIds] = useState<string[]>([]);
  const [decisionLoadingIds, setDecisionLoadingIds] = useState<string[]>([]);
  const [aiTextLoading, setAiTextLoading] = useState(false);
  const [aiTextError, setAiTextError] = useState('');
  const [autoAiRunKey, setAutoAiRunKey] = useState('');
  const [mediaReplacementTarget, setMediaReplacementTarget] = useState<Asset | null>(null);
  const [replacementImageFile, setReplacementImageFile] = useState<File | null>(null);
  const [replacementImageInfo, setReplacementImageInfo] = useState<ReplacementImageInfo | null>(null);
  const [replacementVideoUrl, setReplacementVideoUrl] = useState('');
  const [mediaReplaceConfirmed, setMediaReplaceConfirmed] = useState(false);
  const [mediaReplaceLoading, setMediaReplaceLoading] = useState(false);
  const [mediaReplaceError, setMediaReplaceError] = useState('');
  const [mediaReplaceStatus, setMediaReplaceStatus] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCustomerAccounts() {
      try {
        const response = await apiFetch('/google-ads/accounts');
      const body = await parseJsonSafe(response);
        if (!response.ok) {
          throw new Error(extractApiError(body, 'Could not load Google Ads accounts'));
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
  }, []);

  function selectMediaReplacement(asset: Asset) {
    setMediaReplacementTarget(asset);
    setReplacementImageFile(null);
    setReplacementImageInfo(null);
    setReplacementVideoUrl('');
    setMediaReplaceConfirmed(false);
    setMediaReplaceError('');
    setMediaReplaceStatus('');
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
        throw new Error(extractApiError(body, 'Could not save AI approval'));
      }
    } finally {
      setDecisionLoadingIds((current) => current.filter((id) => id !== suggestionId));
    }
  }

  async function toggleTextSuggestionApproval(asset: LowTextSuggestion) {
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
    } catch (err) {
      setAiTextError(err instanceof Error ? err.message : 'Could not save AI approval');
    }
  }

  async function toggleAllTextSuggestionApprovals() {
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
    } catch (err) {
      setAiTextError(err instanceof Error ? err.message : 'Could not save AI approvals');
    }
  }

  async function toggleCreativeSuggestionApproval(item: AiCreativeRecommendation) {
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
      setAiReviewError(err instanceof Error ? err.message : 'Could not save AI approval');
    }
  }

  async function loadCampaigns() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ customerId, time: timeRange });
      const response = await apiFetch(`/google-ads/campaigns?${params}`);
      const body = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(extractApiError(body, 'Could not load Google Ads data'));
      }

      setData(body);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unknown error');
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
        throw new Error(extractApiError(body, 'Could not load ad groups'));
      }

      setAdGroupData(body);
    } catch (err) {
      setAdGroupData(null);
      setAdGroupError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAdGroupLoading(false);
    }
  }

  async function loadAssets(adGroupOverride?: string) {
    const normalizedAdGroupId = normalizeNumericId(adGroupOverride ?? adGroupId);
    if (!normalizedAdGroupId) {
      setAssetError('Enter an ad group ID to review asset performance');
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
        throw new Error(extractApiError(body, 'Could not load asset data'));
      }

      if (activeAssetScopeRef.current !== requestScope) return;

      setAssetData(body);
      setAssetLoadVersion((version) => version + 1);
      setAiReview(null);
      setAiTextSuggestions(null);
      setSelectedTextSuggestionKeys([]);
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
      setAdGroupOptions((currentOptions) => {
        if (currentOptions.some((option) => option.value === normalizedAdGroupId)) {
          return currentOptions;
        }
        return [...currentOptions, { value: normalizedAdGroupId, label: normalizedAdGroupId }];
      });
    } catch (err) {
      if (activeAssetScopeRef.current !== requestScope) return;
      setAssetData(null);
      setAssetLoadVersion((version) => version + 1);
      setAssetError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (activeAssetScopeRef.current === requestScope) setAssetLoading(false);
    }
  }

  function openAdGroupAssets(adGroup: AdGroup) {
    setOperationsSection(null);
    setAssetTypeFilter('ALL');
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

  function openAssetsById(targetAdGroupId: string, filter: 'ALL' | 'VIDEO' = 'ALL') {
    const normalizedAdGroupId = normalizeNumericId(targetAdGroupId);
    if (!normalizedAdGroupId) return;
    setOperationsSection(null);
    setAssetTypeFilter(filter);
    setAdGroupId(normalizedAdGroupId);
    setViewMode('assets');
    void loadAssets(normalizedAdGroupId);
  }

  async function generateAiReview(adGroupOverride?: string) {
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
      setAiReviewError('Load assets for this ad group before running AI review');
      return;
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
        throw new Error(extractApiError(body, 'Could not generate AI review'));
      }

      if (activeAssetScopeRef.current !== requestScope) return;

      setAiReview(body as AiReviewResponse);
      setApprovedCreativeSuggestionIds([]);
      setAdGroupId(normalizedAdGroupId);
    } catch (err) {
      if (activeAssetScopeRef.current !== requestScope) return;
      setAiReview(null);
      setApprovedCreativeSuggestionIds([]);
      setAiReviewError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (activeAssetScopeRef.current === requestScope) setAiReviewLoading(false);
    }
  }

  async function generateAiTextSuggestions(adGroupOverride?: string) {
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
      setAiTextError('Load assets for this ad group before generating AI suggestions');
      return;
    }

    setAiTextLoading(true);
    setAiTextError('');
    setReplaceError('');
    setReplaceStatus('');

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
        throw new Error(extractApiError(body, 'Could not generate AI text suggestions'));
      }

      if (activeAssetScopeRef.current !== requestScope) return;

      setAiTextSuggestions(body as AiTextSuggestionsResponse);
      setSelectedTextSuggestionKeys([]);
      setAdGroupId(normalizedAdGroupId);
    } catch (err) {
      if (activeAssetScopeRef.current !== requestScope) return;
      setAiTextSuggestions(null);
      setSelectedTextSuggestionKeys([]);
      setAiTextError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (activeAssetScopeRef.current === requestScope) setAiTextLoading(false);
    }
  }

  async function replaceMediaAsset() {
    const normalizedAdGroupId = normalizeNumericId(adGroupId);
    const mediaType = mediaReplacementTarget
      ? getMediaReplacementType(mediaReplacementTarget)
      : '';

    if (!normalizedAdGroupId) {
      setMediaReplaceError('Enter an ad group ID before replacing media');
      return;
    }

    if (!mediaReplacementTarget || !mediaType || !mediaReplacementTarget.resourceName) {
      setMediaReplaceError('Choose an IMAGE or VIDEO row from the asset table first');
      return;
    }

    if (mediaType === 'IMAGE' && !replacementImageFile) {
      setMediaReplaceError('Upload a replacement image file');
      return;
    }

    if (mediaType === 'VIDEO' && !replacementVideoUrl.trim()) {
      setMediaReplaceError('Enter a replacement YouTube video URL or ID');
      return;
    }

    if (!mediaReplaceConfirmed) {
      setMediaReplaceError('Confirm the media replacement before updating Google Ads');
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
        throw new Error(extractApiError(body, 'Could not replace media asset'));
      }

      const result = body as ReplaceMediaResponse;
      const replacements = result.replacedAds.reduce((sum, ad) => sum + ad.replacements, 0);
      setMediaReplaceStatus(
        `${result.message}. Replaced ${replacements} ${mediaType.toLowerCase()} reference${replacements === 1 ? '' : 's'} with ${result.newAssetResourceName}.`,
      );
      setMediaReplaceConfirmed(false);
      setReplacementImageFile(null);
      setReplacementImageInfo(null);
      setReplacementVideoUrl('');
      await loadAssets();
    } catch (err) {
      setMediaReplaceError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setMediaReplaceLoading(false);
    }
  }

  async function replaceLowAssets() {
    const normalizedAdGroupId = normalizeNumericId(adGroupId);
    const headline = replacementHeadline.trim();
    const description = replacementDescription.trim();
    const headlineReplacements = headline
      ? []
      : selectedLowTextSuggestions
          .filter((asset) => asset.fieldType === 'HEADLINE')
          .map((asset) => ({
            oldText: asset.text,
            newText: asset.suggestion,
            suggestionId: asset.suggestionId,
            variantId: asset.variants[0]?.id,
          }));
    const descriptionReplacements = description
      ? []
      : selectedLowTextSuggestions
          .filter((asset) => asset.fieldType === 'DESCRIPTION')
          .map((asset) => ({
            oldText: asset.text,
            newText: asset.suggestion,
            suggestionId: asset.suggestionId,
            variantId: asset.variants[0]?.id,
          }));

    if (!normalizedAdGroupId) {
      setReplaceError('Enter an ad group ID before replacing LOW assets');
      return;
    }

    if (headline.length > HEADLINE_MAX_LENGTH) {
      setReplaceError(`Headline override must be ${HEADLINE_MAX_LENGTH} characters or fewer`);
      return;
    }

    if (description.length > DESCRIPTION_MAX_LENGTH) {
      setReplaceError(`Description override must be ${DESCRIPTION_MAX_LENGTH} characters or fewer`);
      return;
    }

    if (
      !headline &&
      !description &&
      headlineReplacements.length === 0 &&
      descriptionReplacements.length === 0
    ) {
      setReplaceError('Select at least one AI suggestion or enter an override before applying changes');
      return;
    }

    if (!replaceConfirmed) {
      setReplaceError('Confirm the ad replacement before updating');
      return;
    }

    setReplaceLoading(true);
    setReplaceError('');
    setReplaceStatus('');

    try {
      const response = await apiFetch('/google-ads/assets/replace-low', {
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
        throw new Error(extractApiError(body, 'Could not replace LOW text assets'));
      }

      const result = body as ReplaceLowAssetsResponse;
      const changedTexts = result.replacedAds.reduce(
        (sum, ad) => sum + ad.headlineReplacements + ad.descriptionReplacements,
        0,
      );
      setReplaceStatus(
        `${result.message}. Updated ${changedTexts} LOW text asset${changedTexts === 1 ? '' : 's'} from the suggestions.`,
      );
      setReplaceConfirmed(false);
      setSelectedTextSuggestionKeys([]);
      setAdGroupId(normalizedAdGroupId);
      await loadAssets();
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setReplaceLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaigns();
  }, [customerId, timeRange]);

  useEffect(() => {
    setSelectedCampaign(null);
    setCampaignGroupFilterIds(null);
  }, [customerId]);

  useEffect(() => {
    if (viewMode === 'adGroups') {
      void loadAdGroups();
    }
  }, [customerId, timeRange, viewMode]);

  useEffect(() => {
    if (viewMode === 'assets' && adGroupId.trim()) {
      void loadAssets();
    }
  }, [customerId, timeRange]);

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
    viewMode,
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
      setCustomerInputError('Customer ID must have 10 digits');
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
      setSortDir(key === 'name' || key === 'id' ? 'asc' : 'desc');
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

    if (campaignGroupFilterIds) {
      const groupCampaignIds = new Set(campaignGroupFilterIds);
      list = list.filter((campaign) => groupCampaignIds.has(campaign.id));
    }

    if (keyword) {
      list = list.filter(
        (campaign) =>
          campaign.name.toLowerCase().includes(keyword) ||
          campaign.id.toLowerCase().includes(keyword),
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
  }, [data, searchText, sortKey, sortDir, campaignGroupFilterIds]);

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
    let list = assetData?.assets ?? [];

    if (assetTypeFilter === 'VIDEO') {
      list = list.filter((asset) => getMediaReplacementType(asset) === 'VIDEO');
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
  }, [assetData, searchText, assetSortKey, assetSortDir, assetTypeFilter]);

  const bestCampaign = useMemo(() => {
    return filteredCampaigns.reduce<Campaign | null>((best, campaign) => {
      if (!best || campaign.roas > best.roas) {
        return campaign;
      }
      return best;
    }, null);
  }, [filteredCampaigns]);

  const bestAsset = useMemo(() => {
    return filteredAssets.reduce<Asset | null>((best, asset) => {
      if (!best || asset.roas > best.roas) {
        return asset;
      }
      return best;
    }, null);
  }, [filteredAssets]);

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

  const lowTextSuggestions = aiTextSuggestions?.suggestions ?? [];
  const selectedTextSuggestionSet = useMemo(
    () => new Set(selectedTextSuggestionKeys),
    [selectedTextSuggestionKeys],
  );
  const selectedLowTextSuggestions = useMemo(
    () => lowTextSuggestions.filter((asset) => selectedTextSuggestionSet.has(asset.key)),
    [lowTextSuggestions, selectedTextSuggestionSet],
  );
  const lowTextAssetCount = lowTextCandidates.length;
  const totalLowTextImpressions = lowTextCandidates.reduce(
    (sum, asset) => sum + asset.impressions,
    0,
  );

  useEffect(() => {
    if (
      viewMode !== 'assets' ||
      !assetData ||
      assetLoading ||
      assetData.assets.length === 0 ||
      assetLoadVersion === 0
    ) {
      return;
    }

    const key = `${customerId}:${assetData.adGroupId}:${assetData.timeRange}:${assetLoadVersion}`;
    if (autoAiRunKey === key) {
      return;
    }

    setAutoAiRunKey(key);
    void generateAiReview(assetData.adGroupId);

    if (lowTextCandidates.length > 0) {
      void generateAiTextSuggestions(assetData.adGroupId);
    }
  }, [
    assetData,
    assetLoading,
    assetLoadVersion,
    autoAiRunKey,
    customerId,
    lowTextCandidates.length,
    viewMode,
  ]);

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
  const totalPages = Math.max(Math.ceil(activeListLength / PAGE_SIZE), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, activeListLength);
  const paginatedCampaigns = filteredCampaigns.slice(pageStart, pageEnd);
  const paginatedAdGroups = filteredAdGroups.slice(pageStart, pageEnd);
  const paginatedAssets = filteredAssets.slice(pageStart, pageEnd);
  const selectedTimeLabel =
    {
      TODAY: 'Today',
      YESTERDAY: 'Yesterday',
      LAST_7_DAYS: 'Last 7 days',
      THIS_MONTH: 'This month',
    }[timeRange] ?? formatTimeRangeLabel(timeRange);
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
    !assetData ||
    lowTextCandidates.length === 0 ||
    !adGroupId.trim();
  const replaceDisabled =
    replaceLoading ||
    aiTextLoading ||
    assetLoading ||
    !replaceConfirmed ||
    !hasTextReplacementInput ||
    !adGroupId.trim();
  const mediaReplacementType = mediaReplacementTarget
    ? getMediaReplacementType(mediaReplacementTarget)
    : '';
  const mediaReplacementPreviewUrl = getAssetPreviewUrl(mediaReplacementTarget);
  const mediaReplaceDisabled =
    mediaReplaceLoading ||
    assetLoading ||
    !mediaReplaceConfirmed ||
    !mediaReplacementTarget ||
    !mediaReplacementType ||
    (mediaReplacementType === 'IMAGE' && !replacementImageFile) ||
    (mediaReplacementType === 'VIDEO' && !replacementVideoUrl.trim());
  const searchPlaceholder =
    viewMode === 'assets'
      ? assetTypeFilter === 'VIDEO'
        ? 'Search video, label, or ID'
        : 'Search asset, type, label, or ID'
      : viewMode === 'adGroups'
        ? 'Search ad group, campaign, or ID'
        : 'Search campaign or ID';
  const approvedChangeCount =
    approvedCreativeSuggestionIds.length + selectedLowTextSuggestions.length;

  return (
    <div className="adsApp">
      <AdsTopbar
        customerId={customerId}
        searchText={searchText}
        searchPlaceholder={searchPlaceholder}
        showSearch={!operationsSection}
        onSearchChange={setSearchText}
        onMenuToggle={() => setNavOpen((current) => !current)}
        onOpenSettings={() => setOperationsSection('settings')}
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
              setViewMode('adGroups');
            }
          }}
        />

        <main className="shell">
        {operationsSection ? (
          <OperationsPanel
            section={operationsSection}
            customerId={customerId}
            request={apiFetch}
            onOpenAssets={(targetAdGroupId) => openAssetsById(targetAdGroupId)}
          />
        ) : (
        <>
        <DataContext
          viewMode={viewMode}
          selectedCampaign={selectedCampaign}
          adGroupId={adGroupId}
          onClearCampaign={() => setSelectedCampaign(null)}
          onOpenCampaigns={() => {
            setSelectedCampaign(null);
            setViewMode('campaigns');
          }}
          onOpenAdGroups={() => setViewMode('adGroups')}
        />
        <section className="pageHeader">
          <div className="pageTitleBlock">
            <h1>{viewMode === 'assets' ? assetTypeFilter === 'VIDEO' ? 'Videos' : 'Assets' : viewMode === 'adGroups' ? 'Ad groups' : 'Campaigns'}</h1>
            <p>
              {viewMode === 'assets'
                ? assetTypeFilter === 'VIDEO'
                  ? 'Review video performance and open the replacement workflow for the selected ad group.'
                  : 'Review LOW-label text, image, and video assets, then approve exactly what should change.'
                : viewMode === 'adGroups'
                  ? 'Select an ad group to open its assets and run AI review.'
                  : 'Review campaigns by views and open ad groups for asset-level work.'}
            </p>
          </div>

          <div className="controls">
            <label className="field">
              <span>Customer ID</span>
              <select
                aria-label="Customer ID"
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
                  <span>New customer ID</span>
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
              <label className="field customerAdd">
                <span>Ad group ID</span>
                <input
                  aria-label="Ad group ID"
                  list="saved-ad-group-ids"
                  value={adGroupId}
                  onChange={(event) => setAdGroupId(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void loadAssets();
                    }
                  }}
                  placeholder="123456789"
                />
                <datalist id="saved-ad-group-ids">
                  {adGroupOptions.map((adGroup) => (
                    <option key={adGroup.value} value={adGroup.value}>
                      {adGroup.label}
                    </option>
                  ))}
                </datalist>
              </label>
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
              {activeLoading ? 'Loading...' : 'Load data'}
            </button>
          </div>
        </section>

        <section className="filters">
          <div className="filterGroup">
            <DateRangeFilter value={timeRange} onChange={setTimeRange} />
          </div>

          <div className="filterGroup alignRight">
            <span className="filterChip">
              {viewMode === 'assets'
                ? 'Asset status: All but removed'
                : viewMode === 'adGroups'
                  ? 'Ad group status: Enabled'
                  : 'Campaign status: Enabled'}
            </span>
            <span className="filterCount">{activeListLength} rows</span>
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

        {viewMode === 'campaigns' ? (
          <CampaignGroupsPanel
            customerId={customerId}
            campaigns={data?.campaigns ?? []}
            onFilterChange={setCampaignGroupFilterIds}
          />
        ) : null}

        {viewMode === 'assets' ? (
          <section className="creativeReview">
            <div className="editorHeader">
              <div>
                <h2>AI creative review</h2>
                <p>
                  {aiReview
                    ? `${aiRecommendations.length} AI recommendations from ${aiReview.model}`
                    : assetData
                      ? 'Auto-runs after loading assets; use the button to refresh'
                      : 'Load assets first'}
                </p>
              </div>
              <div className="editorTools">
                <span className="pill">Manual approval</span>
                <button
                  className="primaryButton editorAction"
                  type="button"
                  onClick={() => generateAiReview()}
                  disabled={!assetData || assetLoading || aiReviewLoading}
                >
                  {aiReviewLoading ? (
                    <RefreshCw size={15} className="spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  {aiReviewLoading ? 'Asking AI...' : 'Generate AI review'}
                </button>
              </div>
            </div>

            {aiReviewError ? <div className="inlineError">{aiReviewError}</div> : null}

            {aiRecommendations.length > 0 ? (
              <div className="creativeGrid">
                {aiRecommendations.map((item, index) => {
                  const previewUrl = item.asset?.previewUrl ?? '';
                  const reviewAsset = item.asset;
                  const matchingMediaAsset =
                    reviewAsset && assetData
                      ? assetData.assets.find((asset) => {
                          const mediaType = getMediaReplacementType(asset);
                          const sameId = Boolean(asset.id && reviewAsset.id && asset.id === reviewAsset.id);
                          const sameText = Boolean(asset.text && reviewAsset.text && asset.text === reviewAsset.text);
                          const samePlacement =
                            asset.fieldType === reviewAsset.fieldType ||
                            asset.type === reviewAsset.type;

                          return Boolean(mediaType && (sameId || sameText) && samePlacement);
                        }) ?? null
                      : null;
                  const matchingMediaType = matchingMediaAsset
                    ? getMediaReplacementType(matchingMediaAsset)
                    : '';
                  const isApproved = approvedCreativeSuggestionIds.includes(item.suggestionId);
                  const decisionLoading = decisionLoadingIds.includes(item.suggestionId);
                  const MediaIcon =
                    item.mediaType === 'Video'
                      ? Video
                      : item.mediaType === 'Image'
                        ? Image
                        : FileText;

                  return (
                    <article className="creativeCard" key={`${item.assetKey}-${index}`}>
                      <div className="assetPreview">
                        {previewUrl ? (
                          <img src={previewUrl} alt="" loading="lazy" />
                        ) : (
                          <span className="assetPreviewIcon">
                            <MediaIcon size={22} />
                          </span>
                        )}
                        <span className="rankBadge">#{index + 1}</span>
                      </div>
                      <div className="creativeBody">
                        <div className="creativeMeta">
                          <label className="suggestionSelect">
                            <input
                              type="checkbox"
                              checked={isApproved}
                              disabled={decisionLoading}
                              onChange={() => void toggleCreativeSuggestionApproval(item)}
                            />
                            <span>{decisionLoading ? 'Saving...' : 'Approve idea'}</span>
                          </label>
                          <span className="textType">{item.mediaType}</span>
                          <span>{item.priority}</span>
                          <span>{item.confidence} confidence</span>
                        </div>
                        <strong>{item.title}</strong>
                        <div className="ideaList">
                          {item.replacementIdeas.map((idea) => (
                            <span key={idea}>{idea}</span>
                          ))}
                        </div>
                        {matchingMediaAsset && matchingMediaType ? (
                          <div className="creativeActions">
                            <button
                              className="tableActionButton inlineReplaceButton"
                              type="button"
                              onClick={() => selectMediaReplacement(matchingMediaAsset)}
                              title={`Select this ${matchingMediaType.toLowerCase()} for replacement`}
                            >
                              {matchingMediaType === 'VIDEO' ? <Video size={13} /> : <Image size={13} />}
                              Use in Replace panel
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : assetData && !aiReviewLoading && !aiReview ? (
              <div className="emptySuggestions">AI review will run automatically after assets load.</div>
            ) : null}
          </section>
        ) : null}

        {viewMode === 'assets' ? (
          <section className="assetEditor">
            <div className="editorHeader">
              <div>
                <h2>Replace image/video asset</h2>
                <p>
                  {mediaReplacementTarget
                    ? `${mediaReplacementType} selected - ${formatNumber(mediaReplacementTarget.impressions)} views`
                    : 'Choose an IMAGE or VIDEO row from the table'}
                </p>
              </div>
              <span className="pill">Google Ads update</span>
            </div>

            {mediaReplacementTarget ? (
              <div className="mediaReplaceGrid">
                <div className="mediaTarget">
                  <div className="assetPreview compactPreview">
                    {mediaReplacementPreviewUrl ? (
                      <img src={mediaReplacementPreviewUrl} alt="" />
                    ) : (
                      <span className="assetPreviewIcon">
                        {mediaReplacementType === 'VIDEO' ? <Video size={22} /> : <Image size={22} />}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="textType">{mediaReplacementType}</span>
                    <strong>{assetTitle(mediaReplacementTarget)}</strong>
                    <p>
                      {formatPercent(mediaReplacementTarget.ctr)} CTR · {mediaReplacementTarget.roas.toFixed(2)} ROAS · {mediaReplacementTarget.performanceLabel || 'No label'}
                    </p>
                  </div>
                </div>

                {mediaReplacementType === 'IMAGE' ? (
                  <label className="editorField">
                    <span>New image</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={async (event) => {
                        const file = event.target.files?.[0] ?? null;
                        setReplacementImageFile(file);
                        setReplacementImageInfo(null);
                        setMediaReplaceError('');
                        setMediaReplaceStatus('');
                        if (!file) {
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
                            err instanceof Error ? err.message : 'Could not read replacement image',
                          );
                        }
                      }}
                    />
                    {replacementImageInfo ? (
                      <span className="imageSpecNote">
                        {replacementImageInfo.adjusted ? 'Auto-cropped' : 'Ready'} for {replacementImageInfo.specLabel}: {replacementImageInfo.originalWidth}x{replacementImageInfo.originalHeight}{' to '}{replacementImageInfo.outputWidth}x{replacementImageInfo.outputHeight}
                      </span>
                    ) : null}
                  </label>
                ) : (
                  <label className="editorField">
                    <span>New YouTube video</span>
                    <input
                      value={replacementVideoUrl}
                      onChange={(event) => {
                        setReplacementVideoUrl(event.target.value);
                        setMediaReplaceError('');
                        setMediaReplaceStatus('');
                      }}
                      placeholder="https://youtu.be/..."
                    />
                  </label>
                )}
              </div>
            ) : (
              <div className="emptySuggestions">Pick an image or video asset using the Replace button in the table.</div>
            )}

            <div className="editorFooter">
              <label className="confirmRow">
                <input
                  type="checkbox"
                  checked={mediaReplaceConfirmed}
                  onChange={(event) => {
                    setMediaReplaceConfirmed(event.target.checked);
                    setMediaReplaceError('');
                  }}
                />
                <span>Apply this media replacement in Google Ads</span>
              </label>
              <button
                className="primaryButton editorAction"
                type="button"
                onClick={replaceMediaAsset}
                disabled={mediaReplaceDisabled}
              >
                {mediaReplaceLoading ? (
                  <RefreshCw size={15} className="spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {mediaReplaceLoading ? 'Updating...' : 'Replace media'}
              </button>
            </div>

            {mediaReplaceError ? <div className="inlineError">{mediaReplaceError}</div> : null}
            {mediaReplaceStatus ? <div className="inlineSuccess">{mediaReplaceStatus}</div> : null}
          </section>
        ) : null}

        {viewMode === 'assets' ? (
          <section className="assetEditor">
            <div className="editorHeader">
              <div>
                <h2>AI text suggestions</h2>
                <p>
                  {assetData
                    ? `${lowTextAssetCount} LOW text rows - ${formatNumber(totalLowTextImpressions)} views`
                    : 'Load assets first'}
                </p>
              </div>
              <div className="editorTools">
                <span className="pill">Manual approval</span>
                <span className="pill">
                  {aiTextSuggestions
                    ? `${aiTextSuggestions.source.toUpperCase()} ${aiTextSuggestions.model}`
                    : 'AI provider'}
                </span>
                <button
                  className="tableActionButton aiTextButton"
                  type="button"
                  onClick={() => generateAiTextSuggestions()}
                  disabled={aiTextDisabled}
                >
                  {aiTextLoading ? (
                    <RefreshCw size={14} className="spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {aiTextLoading ? 'Asking AI...' : 'Generate AI suggestions'}
                </button>
              </div>
            </div>

            {lowTextSuggestions.length > 0 ? (
              <div className="suggestionList">
                <div className="approvalToolbar">
                  <span>{selectedLowTextSuggestions.length}/{lowTextSuggestions.length} approved for update</span>
                  <button
                    className="tableActionButton"
                    type="button"
                    onClick={() => void toggleAllTextSuggestionApprovals()}
                    disabled={decisionLoadingIds.length > 0}
                  >
                    {selectedLowTextSuggestions.length === lowTextSuggestions.length ? 'Clear selected' : 'Select all'}
                  </button>
                </div>
                {lowTextSuggestions.map((asset) => {
                  const isSelected = selectedTextSuggestionSet.has(asset.key);

                  return (
                    <article className={`suggestionRow${isSelected ? ' selected' : ''}`} key={asset.key}>
                      <div className="suggestionMeta">
                        <label className="suggestionSelect">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => void toggleTextSuggestionApproval(asset)}
                            disabled={decisionLoadingIds.includes(asset.suggestionId)}
                          />
                          <span>Approve</span>
                        </label>
                        <span className="textType">{asset.fieldType}</span>
                        <span>{formatNumber(asset.impressions)} impr.</span>
                        <span>{asset.priority}</span>
                        <span>{asset.confidence} confidence</span>
                      </div>
                      <div className="suggestionCopy">
                        <div>
                          <span>Current</span>
                          <strong>{asset.text}</strong>
                        </div>
                        <div>
                          <span>AI suggestion</span>
                          <strong>{asset.suggestion}</strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : assetData && lowTextCandidates.length > 0 ? (
              <div className="emptySuggestions">AI text suggestions will run automatically after assets load.</div>
            ) : assetData ? (
              <div className="emptySuggestions">No LOW headline/description assets found.</div>
            ) : null}

            <div className="editorGrid">
              <label className="editorField">
                <span>Headline override {replacementHeadline.length}/{HEADLINE_MAX_LENGTH}</span>
                <input
                  value={replacementHeadline}
                  maxLength={HEADLINE_MAX_LENGTH}
                  onChange={(event) => {
                    setReplacementHeadline(event.target.value.slice(0, HEADLINE_MAX_LENGTH));
                    setReplaceError('');
                    setReplaceStatus('');
                  }}
                  placeholder="Optional headline"
                />
              </label>
              <label className="editorField">
                <span>Description override {replacementDescription.length}/{DESCRIPTION_MAX_LENGTH}</span>
                <input
                  value={replacementDescription}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  onChange={(event) => {
                    setReplacementDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH));
                    setReplaceError('');
                    setReplaceStatus('');
                  }}
                  placeholder="Optional description"
                />
              </label>
            </div>

            <div className="editorFooter">
              <label className="confirmRow">
                <input
                  type="checkbox"
                  checked={replaceConfirmed}
                  onChange={(event) => {
                    setReplaceConfirmed(event.target.checked);
                    setReplaceError('');
                  }}
                />
                <span>Apply selected AI suggestions or overrides in Google Ads</span>
              </label>
              <button
                className="primaryButton editorAction"
                type="button"
                onClick={replaceLowAssets}
                disabled={replaceDisabled}
              >
                {replaceLoading ? (
                  <RefreshCw size={15} className="spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {replaceLoading ? 'Updating...' : 'Apply selected changes'}
              </button>
            </div>

            {replaceError ? <div className="inlineError">{replaceError}</div> : null}
            {aiTextError ? <div className="inlineError">{aiTextError}</div> : null}
            {replaceStatus ? <div className="inlineSuccess">{replaceStatus}</div> : null}
          </section>
        ) : null}

        <PerformanceSummary
          viewMode={viewMode}
          campaignData={data}
          adGroupData={adGroupData}
          assetData={assetData}
          campaignLoading={loading}
          adGroupLoading={adGroupLoading}
          assetLoading={assetLoading}
          campaignViews={campaignViews}
          bestCampaign={bestCampaign}
        />

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
          activeLoading={activeLoading}
          onCampaignSort={handleSort}
          onAdGroupSort={handleAdGroupSort}
          onAssetSort={handleAssetSort}
          onOpenCampaign={openCampaignAdGroups}
          onOpenAdGroup={openAdGroupAssets}
          onSelectMedia={selectMediaReplacement}
          onPageChange={setCurrentPage}
        />
        </>
        )}
        </main>
      </div>
    </div>
  );
}
