import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ExternalLink,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { parseJsonSafe } from '../api/client';
import { getLanguageLabel, LANGUAGE_OPTIONS } from '../config/languages';
import type { AuthUser, Campaign } from '../types/googleAds';

export type OperationsSection = 'overview' | 'recommendations' | 'impact' | 'automation' | 'keywords' | 'settings' | 'guide';

type RequestFn = (path: string, options?: RequestInit) => Promise<Response>;

type OverviewData = {
  account: {
    customerId: string;
    displayName: string | null;
    lastSyncedAt: string | null;
  };
  totals: {
    adGroups: number;
    lowAssets: number;
    recommendations: number;
    pending: number;
    approved: number;
    applied: number;
    rejected: number;
  };
  lastReviewAt: string | null;
  lastSync: { status: string; rowsRead: number; startedAt: string } | null;
  recentChanges: Array<{
    id: string;
    source: string;
    status: string;
    requestedAt: string;
    errorMessage: string | null;
  }>;
  automation: {
    enabled: boolean;
    intervalDays: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastStatus: string | null;
  } | null;
};

type SuggestionVariant = {
  id: string;
  content: { text?: string };
  selected: boolean;
};

type Recommendation = {
  id: string;
  suggestionType: string;
  fieldType: string | null;
  languageCode: string | null;
  currentContent: { text?: string; previewUrl?: string; impressions?: number };
  rationale: string;
  priority: string;
  confidence: string | null;
  status: string;
  createdAt: string;
  adGroup: { id: string; name: string } | null;
  provider: string | null;
  model: string | null;
  variants: SuggestionVariant[];
};

type CreativeTerm = {
  id: string;
  termType: string;
  languageCode: string;
  marketCode: string | null;
  scopeLevel: string;
  googleCampaignId: string | null;
  googleAdGroupId: string | null;
  term: string;
  weight: string;
  active: boolean;
};

type SettingsData = {
  account: {
    customerId: string;
    displayName: string | null;
    status: string;
    timeZone: string | null;
    lastSyncedAt: string | null;
  };
  policy: {
    name: string;
    languageStrategy: string;
    targetLanguage: string | null;
    selectionCriteria: { targetLabels?: string[] };
    headlineMaxLength: number;
    descriptionMaxLength: number;
    approvalMode: string;
    reviewIntervalDays: number;
    minimumImpressions: string;
    minimumClicks: string;
    cooldownDays: number;
    maxChangesPerRun: number;
  };
  schedule: {
    id: string;
    timezone: string;
    intervalDays: number;
    enabled: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
  } | null;
  recentAutomationRuns: Array<{
    id: string;
    status: string;
    selectedCount: number;
    appliedCount: number;
    failedCount: number;
    scheduledFor: string;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  }>;
  providers: {
    googleAdsConfigured: boolean;
    geminiConfigured: boolean;
  };
  automationScope: {
    campaigns: Array<{
      id: string;
      name: string;
      status: string;
      selected: boolean;
      adGroups: Array<{
        id: string;
        name: string;
        status: string;
        selected: boolean;
      }>;
    }>;
    selectedCampaignCount: number;
    selectedAdGroupCount: number;
  };
};

type AccessUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  accountAccess: Array<{
    customerId: string;
  }>;
  lastLoginAt: string | null;
  createdAt: string;
};

type Props = {
  section: OperationsSection;
  customerId: string;
  request: RequestFn;
  currentUser: AuthUser;
  campaigns: Campaign[];
  onOpenAssets: (adGroupId: string) => void;
  onPasswordChanged: () => void;
};

const TERM_TYPES = [
  ['KEYWORD', 'Từ khóa sản phẩm'],
  ['BRAND_TERM', 'Từ khóa thương hiệu'],
  ['CTA', 'Lời kêu gọi hành động'],
  ['NEGATIVE_KEYWORD', 'Từ khóa phủ định'],
  ['PROHIBITED_CLAIM', 'Nội dung bị cấm'],
] as const;

const SCOPE_OPTIONS = [
  ['ACCOUNT', 'Tài khoản'],
  ['CAMPAIGN', 'Chiến dịch'],
  ['AD_GROUP', 'Nhóm quảng cáo'],
] as const;

function errorMessage(body: any, fallback: string) {
  if (typeof body?.message === 'string') return body.message;
  if (Array.isArray(body?.message)) return body.message.join(', ');
  return fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const AUTOMATION_STALE_RUNNING_MINUTES = 30;

function isStaleAutomationRun(
  run: SettingsData['recentAutomationRuns'][number] | null,
) {
  if (run?.status !== 'RUNNING') return false;
  const startedAt = new Date(run.startedAt).getTime();
  if (!Number.isFinite(startedAt)) return false;
  return Date.now() - startedAt > AUTOMATION_STALE_RUNNING_MINUTES * 60_000;
}

export function OperationsPanel({
  section,
  customerId,
  request,
  currentUser,
  onOpenAssets,
  onPasswordChanged,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationStatus, setRecommendationStatus] = useState('PENDING');
  const [decisionId, setDecisionId] = useState('');
  const [terms, setTerms] = useState<CreativeTerm[]>([]);
  const [termType, setTermType] = useState('KEYWORD');
  const [termLanguage, setTermLanguage] = useState('en');
  const [termMarket, setTermMarket] = useState('');
  const [termScope, setTermScope] = useState('ACCOUNT');
  const [termCampaignId, setTermCampaignId] = useState('');
  const [termAdGroupId, setTermAdGroupId] = useState('');
  const [termText, setTermText] = useState('');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [settingsDraft, setSettingsDraft] = useState({
    languageStrategy: 'DETECT_FROM_ASSET',
    targetLanguage: '',
    approvalMode: 'MANUAL',
    minimumImpressions: 0,
    minimumClicks: 0,
    reviewIntervalDays: 14,
    cooldownDays: 14,
    maxChangesPerRun: 10,
    automationEnabled: false,
  });
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationScopeSaving, setAutomationScopeSaving] = useState(false);
  const [selectedAutomationCampaignIds, setSelectedAutomationCampaignIds] =
    useState<string[]>([]);
  const [selectedAutomationAdGroupIds, setSelectedAutomationAdGroupIds] =
    useState<string[]>([]);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [selectedAccessUserId, setSelectedAccessUserId] = useState('');
  const [accountAccessAllowed, setAccountAccessAllowed] = useState(false);
  const [accessSavingId, setAccessSavingId] = useState('');
  const [accessFormError, setAccessFormError] = useState('');
  const [newAccessUser, setNewAccessUser] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'VIEWER',
  });
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const canManageUsers = currentUser.role === 'ADMIN';
  const canManagePolicy = currentUser.permissions.includes('rules.manage');
  const canRunPeriodicAi = currentUser.permissions.includes('automation.manage');
  const canManageAutomationScope = currentUser.permissions.includes('users.manage');
  const selectedAccessUser =
    accessUsers.find((user) => user.id === selectedAccessUserId) ?? null;

  async function loadOverview() {
    const response = await request(
      `/creative-operations/overview?${new URLSearchParams({ customerId })}`,
    );
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Không thể tải tổng quan'));
    setOverview(body as OverviewData);
  }

  async function loadRecommendations() {
    const params = new URLSearchParams({ customerId, status: recommendationStatus });
    const response = await request(`/creative-operations/recommendations?${params}`);
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Không thể tải đề xuất'));
    setRecommendations((body.recommendations ?? []) as Recommendation[]);
  }

  async function loadTerms() {
    const response = await request(
      `/creative-operations/terms?${new URLSearchParams({ customerId })}`,
    );
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Không thể tải quy tắc từ khóa'));
    setTerms((body.terms ?? []) as CreativeTerm[]);
  }

  async function loadSettings() {
    const response = await request(
      `/creative-operations/settings?${new URLSearchParams({ customerId })}`,
    );
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Không thể tải cài đặt'));
    const data = body as SettingsData;
    const scopeCampaigns = data.automationScope?.campaigns ?? [];
    setSettings(data);
    setSelectedAutomationCampaignIds(
      scopeCampaigns.filter((campaign) => campaign.selected).map((campaign) => campaign.id),
    );
    setSelectedAutomationAdGroupIds(
      scopeCampaigns.flatMap((campaign) =>
        campaign.adGroups.filter((adGroup) => adGroup.selected).map((adGroup) => adGroup.id),
      ),
    );
    setSettingsDraft({
      languageStrategy: data.policy.languageStrategy,
      targetLanguage: data.policy.targetLanguage ?? '',
      approvalMode: data.policy.approvalMode,
      minimumImpressions: Number(data.policy.minimumImpressions),
      minimumClicks: Number(data.policy.minimumClicks),
      reviewIntervalDays: data.policy.reviewIntervalDays,
      cooldownDays: data.policy.cooldownDays,
      maxChangesPerRun: data.policy.maxChangesPerRun,
      automationEnabled: Boolean(data.schedule?.enabled),
    });
  }

  async function loadAccessUsers() {
    if (!canManageUsers) return;
    const response = await request('/admin/users');
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(errorMessage(body, 'Không thể tải người dùng'));
    setAccessUsers((body.users ?? []) as AccessUser[]);
  }

  async function changePassword() {
    setError('');
    setNotice('');
    if (
      !passwordDraft.currentPassword ||
      !passwordDraft.newPassword ||
      !passwordDraft.confirmPassword
    ) {
      setError('Vui lòng nhập đầy đủ ba trường mật khẩu.');
      return;
    }
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (passwordDraft.newPassword.length < 10) {
      setError('Mật khẩu mới phải có ít nhất 10 ký tự.');
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await request('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordDraft),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(errorMessage(body, 'Không thể đổi mật khẩu'));
      }
      setPasswordDraft({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      onPasswordChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đổi mật khẩu');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function loadSection() {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (section === 'overview') await loadOverview();
      if (section === 'recommendations') await loadRecommendations();
      if (section === 'keywords') await loadTerms();
      if (section === 'settings' || section === 'automation') {
        await loadSettings();
        if (section === 'settings') await loadAccessUsers();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  const loadSectionEffect = useEffectEvent(loadSection);
  const loadOverviewEffect = useEffectEvent(loadOverview);

  useEffect(() => {
    void loadSectionEffect();
  }, [section, customerId, recommendationStatus]);

  useEffect(() => {
    if (section !== 'overview') return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadOverviewEffect().catch((err) => {
          setError(err instanceof Error ? err.message : 'Không thể làm mới tổng quan');
        });
      }
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [section, customerId]);

  useEffect(() => {
    if (!selectedAccessUserId && accessUsers.length) {
      const firstEditable = accessUsers.find((user) => user.role !== 'ADMIN') ?? accessUsers[0];
      setSelectedAccessUserId(firstEditable.id);
    }
  }, [accessUsers, selectedAccessUserId]);

  useEffect(() => {
    if (!selectedAccessUser) {
      setAccountAccessAllowed(false);
      return;
    }

    setAccountAccessAllowed(
      selectedAccessUser.accountAccess.some((access) => access.customerId === customerId),
    );
  }, [customerId, selectedAccessUser]);

  async function decide(item: Recommendation, action: 'APPROVE' | 'REJECT' | 'UNAPPROVE') {
    setDecisionId(item.id);
    setError('');
    try {
      const response = await request(
        `/google-ads/assets/ai-suggestions/${item.id}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            variantId: action === 'APPROVE' ? item.variants[0]?.id : undefined,
          }),
        },
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể lưu quyết định'));
      setRecommendations((current) =>
        recommendationStatus === 'ALL'
          ? current.map((entry) =>
              entry.id === item.id ? { ...entry, status: body.status } : entry,
            )
          : current.filter((entry) => entry.id !== item.id),
      );
      setNotice(`Đã cập nhật trạng thái đề xuất thành ${body.status}. Google Ads chưa bị thay đổi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu quyết định');
    } finally {
      setDecisionId('');
    }
  }

  async function createTerm() {
    if (!termText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await request('/creative-operations/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          termType,
          languageCode: termLanguage,
          marketCode: termMarket.trim() || null,
          scopeLevel: termScope,
          googleCampaignId: termScope === 'CAMPAIGN' ? termCampaignId : null,
          googleAdGroupId: termScope === 'AD_GROUP' ? termAdGroupId : null,
          term: termText.trim(),
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể tạo quy tắc từ khóa'));
      setTermText('');
      if (termScope === 'ACCOUNT') {
        setTermCampaignId('');
        setTermAdGroupId('');
      }
      setNotice('Đã thêm quy tắc từ khóa. Các lần đánh giá AI mới sẽ sử dụng quy tắc này.');
      await loadTerms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo quy tắc từ khóa');
    } finally {
      setLoading(false);
    }
  }

  async function updateTerm(item: CreativeTerm, update: Partial<CreativeTerm>) {
    setError('');
    try {
      const response = await request(`/creative-operations/terms/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể cập nhật quy tắc từ khóa'));
      setTerms((current) => current.map((term) => (term.id === item.id ? body : term)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật quy tắc từ khóa');
    }
  }

  async function deleteTerm(item: CreativeTerm) {
    setError('');
    try {
      const response = await request(`/creative-operations/terms/${item.id}`, {
        method: 'DELETE',
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể xóa quy tắc từ khóa'));
      setTerms((current) => current.filter((term) => term.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa quy tắc từ khóa');
    }
  }

  async function saveSettings() {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ customerId });
      const response = await request(`/creative-operations/settings?${params}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languageStrategy: settingsDraft.languageStrategy,
          targetLanguage:
            settingsDraft.languageStrategy === 'FIXED'
              ? settingsDraft.targetLanguage
              : null,
          targetLabels: ['LOW'],
          minimumImpressions: settingsDraft.minimumImpressions,
          minimumClicks: settingsDraft.minimumClicks,
          reviewIntervalDays: settingsDraft.reviewIntervalDays,
          cooldownDays: settingsDraft.cooldownDays,
          maxChangesPerRun: settingsDraft.maxChangesPerRun,
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể lưu cài đặt'));
      setNotice('Đã lưu chính sách đánh giá AI.');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu cài đặt');
    } finally {
      setLoading(false);
    }
  }

  async function stopAutomation() {
    if (!canRunPeriodicAi) return;

    setLoading(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ customerId });
      const response = await request(`/creative-operations/automation/settings?${params}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automationEnabled: false,
          reviewIntervalDays: settingsDraft.reviewIntervalDays,
          maxChangesPerRun: settingsDraft.maxChangesPerRun,
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể tắt tự động hóa'));
      setSettingsDraft((current) => ({ ...current, automationEnabled: false, approvalMode: 'MANUAL' }));
      setNotice('Đã tắt AI định kỳ. Hệ thống sẽ không chạy lại cho đến khi bạn bấm Chạy ngay.');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tắt tự động hóa');
    } finally {
      setLoading(false);
    }
  }

  async function saveAutomationLimits() {
    if (!canRunPeriodicAi) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ customerId });
      const response = await request(`/creative-operations/settings?${params}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewIntervalDays: settingsDraft.reviewIntervalDays,
          maxChangesPerRun: settingsDraft.maxChangesPerRun,
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(errorMessage(body, 'Không thể lưu cấu hình Automation'));
      }
      setNotice('Đã lưu chu kỳ và giới hạn thay đổi của Automation.');
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu cấu hình Automation');
    } finally {
      setLoading(false);
    }
  }

  function toggleAutomationCampaign(campaignId: string, selected: boolean) {
    setSelectedAutomationCampaignIds((current) =>
      selected
        ? [...new Set([...current, campaignId])]
        : current.filter((id) => id !== campaignId),
    );
    if (!selected) {
      const adGroupIds = new Set(
        settings?.automationScope?.campaigns
          .find((campaign) => campaign.id === campaignId)
          ?.adGroups.map((adGroup) => adGroup.id) ?? [],
      );
      setSelectedAutomationAdGroupIds((current) =>
        current.filter((id) => !adGroupIds.has(id)),
      );
    }
  }

  function toggleAutomationAdGroup(adGroupId: string, selected: boolean) {
    setSelectedAutomationAdGroupIds((current) =>
      selected
        ? [...new Set([...current, adGroupId])]
        : current.filter((id) => id !== adGroupId),
    );
  }

  async function saveAutomationScope() {
    if (!canManageAutomationScope) return;
    setAutomationScopeSaving(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ customerId });
      const response = await request(`/creative-operations/automation/scope?${params}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignIds: selectedAutomationCampaignIds,
          adGroupIds: selectedAutomationAdGroupIds,
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(errorMessage(body, 'Không thể lưu phạm vi Automation'));
      }
      setNotice(
        `Đã lưu phạm vi: ${selectedAutomationCampaignIds.length} chiến dịch, ${selectedAutomationAdGroupIds.length} nhóm quảng cáo.`,
      );
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu phạm vi Automation');
    } finally {
      setAutomationScopeSaving(false);
    }
  }

  async function runAutomationNow() {
    if (!canRunPeriodicAi) return;

    setAutomationRunning(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ customerId });
      const response = await request(`/creative-operations/automation/run?${params}`, {
        method: 'POST',
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể chạy tự động hóa'));
      setNotice(
        `AI định kỳ đã hoàn tất: chọn ${Number(body.selectedCount ?? 0)} đề xuất, áp dụng ${Number(body.appliedCount ?? 0)} thay đổi.`,
      );
      const selectedCount = Number(body.selectedCount ?? 0);
      const appliedCount = Number(body.appliedCount ?? 0);
      const itemReasons = Array.isArray(body.items)
        ? body.items
            .map((item: { reason?: string | null }) => String(item.reason ?? '').trim())
            .filter(Boolean)
            .slice(0, 3)
        : [];
      const reasonText = itemReasons.length ? ` ${itemReasons.join(' | ')}` : '';
      setNotice(
        appliedCount > 0
          ? `AI định kỳ đã bắt đầu: chọn ${selectedCount} đề xuất và áp dụng ${appliedCount} thay đổi. Hệ thống sẽ tiếp tục chạy theo lịch cho đến khi bạn bấm Tắt.`
          : `AI định kỳ đã bắt đầu nhưng chưa áp dụng nội dung nào trong lần này. Hệ thống vẫn tiếp tục chạy theo lịch cho đến khi bạn bấm Tắt.${reasonText}`,
      );
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể chạy tự động hóa');
    } finally {
      setAutomationRunning(false);
    }
  }

  async function createAccessUser() {
    if (!canManageUsers) return;
    if (!newAccessUser.email.trim() || !newAccessUser.displayName.trim() || !newAccessUser.password) {
      setAccessFormError('Vui lòng nhập đầy đủ email, tên hiển thị và mật khẩu.');
      return;
    }
    if (
      newAccessUser.password.length < 10 ||
      !/[a-z]/.test(newAccessUser.password) ||
      !/[A-Z]/.test(newAccessUser.password) ||
      !/\d/.test(newAccessUser.password) ||
      !/[^A-Za-z0-9]/.test(newAccessUser.password)
    ) {
      setAccessFormError(
        'Mật khẩu phải có ít nhất 10 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.',
      );
      return;
    }

    setAccessSavingId('new');
    setAccessFormError('');
    setError('');
    setNotice('');
    try {
      const response = await request('/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccessUser),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể tạo người dùng'));
      setNewAccessUser({ email: '', displayName: '', password: '', role: 'VIEWER' });
      setNotice('Đã tạo người dùng.');
      await loadAccessUsers();
    } catch (err) {
      setAccessFormError(
        err instanceof Error ? err.message : 'Không thể tạo người dùng',
      );
    } finally {
      setAccessSavingId('');
    }
  }

  async function updateAccessUser(user: AccessUser, update: Partial<AccessUser>) {
    if (!canManageUsers) return;
    setAccessSavingId(user.id);
    setError('');
    setNotice('');
    try {
      const response = await request(`/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể cập nhật quyền người dùng'));
      setNotice('User access updated.');
      await loadAccessUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật quyền người dùng');
    } finally {
      setAccessSavingId('');
    }
  }

  async function saveAccountAccess() {
    if (!canManageUsers || !selectedAccessUser) return;
    setAccessSavingId(`accounts:${selectedAccessUser.id}`);
    setError('');
    setNotice('');
    try {
      const response = await request(
        `/admin/users/${selectedAccessUser.id}/account-access`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId,
            allowed: accountAccessAllowed,
          }),
        },
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể lưu quyền truy cập tài khoản'));
      setAccessUsers((body.users ?? []) as AccessUser[]);
      setNotice('Đã lưu quyền truy cập tài khoản Google Ads.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu quyền truy cập tài khoản');
    } finally {
      setAccessSavingId('');
    }
  }

  const title = {
    overview: 'Tổng quan',
    recommendations: 'Đề xuất',
    impact: 'Theo dõi thay đổi',
    automation: 'Automation',
    keywords: 'Quy tắc từ khóa AI',
    settings: 'Cài đặt',
    guide: 'Hướng dẫn sử dụng',
  }[section];
  const subtitle = {
    overview: 'Trạng thái đánh giá AI, tài nguyên hiệu quả thấp và thay đổi Google Ads gần đây.',
    recommendations: 'Phê duyệt hoặc từ chối đề xuất AI trước khi áp dụng.',
    impact: 'So sánh hiệu quả trước và sau khi thay đổi nội dung quảng cáo.',
    automation: 'Chọn chiến dịch, nhóm quảng cáo và điều khiển AI định kỳ.',
    keywords: 'Từ khóa sản phẩm, thương hiệu, từ khóa phủ định và nội dung bị cấm.',
    settings: 'Trạng thái kết nối Google Ads và chính sách đánh giá nội dung.',
    guide: 'Hướng dẫn sử dụng ứng dụng GG Ads.',
  }[section];
  const groupedTerms = useMemo(
    () =>
      TERM_TYPES.map(([type, label]) => ({
        type,
        label,
        terms: terms.filter((item) => item.termType === type),
      })),
    [terms],
  );
  const canCreateTerm =
    Boolean(termText.trim()) &&
    (termScope === 'ACCOUNT' ||
      (termScope === 'CAMPAIGN' && Boolean(termCampaignId.trim())) ||
      (termScope === 'AD_GROUP' && Boolean(termAdGroupId.trim())));

  function scopeLabel(item: CreativeTerm) {
    if (item.scopeLevel === 'AD_GROUP') return `Nhóm quảng cáo ${item.googleAdGroupId ?? '-'}`;
    if (item.scopeLevel === 'CAMPAIGN') return `Chiến dịch ${item.googleCampaignId ?? '-'}`;
    return 'Tài khoản';
  }
  const latestAutomationRun = settings?.recentAutomationRuns[0] ?? null;
  const automationRunStale = isStaleAutomationRun(latestAutomationRun);
  const automationRunInProgress =
    latestAutomationRun?.status === 'RUNNING' && !automationRunStale;
  const automationActionText = automationRunning || automationRunInProgress
    ? 'Đang chạy...'
    : automationRunStale
      ? 'Retry run'
      : 'Chạy ngay';
  const automationStatusText = latestAutomationRun?.errorMessage
    ?? (automationRunStale
      ? 'Previous run looks stuck. Retry is available.'
      : settingsDraft.automationEnabled
        ? `AI định kỳ đang bật và chạy mỗi ${settingsDraft.reviewIntervalDays} ngày.`
        : 'AI định kỳ đang tắt. Bấm Chạy ngay để bắt đầu và duy trì theo lịch.');

  return (
    <div className="operationsPage">
      <header className="operationsHeader">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button className="iconAction" type="button" onClick={() => void loadSection()} disabled={loading} title="Refresh">
          <RefreshCw size={17} className={loading ? 'spin' : ''} />
        </button>
      </header>

      {error ? <div className="inlineError"><AlertCircle size={16} />{error}</div> : null}
      {notice ? <div className="inlineSuccess"><Check size={16} />{notice}</div> : null}

      {section === 'overview' && overview ? (
        <>
          <div className="operationsMetrics">
            <div><span>Tài nguyên hiệu quả thấp</span><strong>{overview.totals.lowAssets}</strong></div>
            <div><span>Chờ đánh giá</span><strong>{overview.totals.pending}</strong></div>
            <div><span>Đã phê duyệt</span><strong>{overview.totals.approved}</strong></div>
            <div><span>Đã áp dụng</span><strong>{overview.totals.applied}</strong></div>
          </div>
          <section className="operationsSection">
            <div className="sectionTitle"><h2>Hoạt động</h2><span>Khách hàng {overview.account.customerId}</span></div>
            <div className="activityGrid">
              <div><span>Nhóm quảng cáo trong cơ sở dữ liệu</span><strong>{overview.totals.adGroups}</strong></div>
              <div><span>Lần đánh giá AI gần nhất</span><strong>{formatDate(overview.lastReviewAt)}</strong></div>
              <div><span>Lần đồng bộ gần nhất</span><strong>{formatDate(overview.lastSync?.startedAt)}</strong></div>
              <div><span>Trạng thái đồng bộ</span><strong>{overview.lastSync?.status ?? 'Chưa có'}</strong></div>
              <div><span>AI định kỳ</span><strong>{overview.automation?.enabled ? 'Đang bật' : 'Đã tắt'}</strong></div>
              <div><span>Lần chạy AI tiếp theo</span><strong>{formatDate(overview.automation?.nextRunAt)}</strong></div>
            </div>
          </section>
          <section className="operationsSection">
            <div className="sectionTitle"><h2>Thay đổi gần đây</h2><span>{overview.recentChanges.length} bản ghi</span></div>
            <div className="plainTable"><table><thead><tr><th>Thời gian</th><th>Nguồn</th><th>Trạng thái</th><th>Lỗi</th></tr></thead><tbody>
              {overview.recentChanges.map((item) => <tr key={item.id}><td>{formatDate(item.requestedAt)}</td><td>{item.source}</td><td><span className={`statusText ${item.status.toLowerCase()}`}>{item.status}</span></td><td>{item.errorMessage ?? '-'}</td></tr>)}
              {!overview.recentChanges.length ? <tr><td colSpan={4} className="empty">Chưa ghi nhận thay đổi Google Ads.</td></tr> : null}
            </tbody></table></div>
          </section>
        </>
      ) : null}

      {section === 'recommendations' ? (
        <section className="operationsSection flush">
          <div className="recommendationToolbar">
            <div className="statusTabs">
              {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((status) => (
                <button type="button" className={recommendationStatus === status ? 'active' : ''} key={status} onClick={() => setRecommendationStatus(status)}>{status}</button>
              ))}
            </div>
            <span>{recommendations.length} suggestions</span>
          </div>
          <div className="recommendationQueue">
            {recommendations.map((item) => {
              const replacement = item.variants[0]?.content.text ?? 'Ý tưởng nội dung';
              return <article className="queueRow" key={item.id}>
                <div className="queueMeta"><span className="textType">{item.fieldType ?? item.suggestionType}</span><span>{item.priority}</span><span>{item.languageCode?.toUpperCase() ?? '-'}</span><span>{item.adGroup?.name ?? 'Không tìm thấy nhóm quảng cáo'}</span></div>
                <div className="queueCopy"><div><span>Hiện tại</span><strong>{item.currentContent.text ?? item.suggestionType}</strong></div><div><span>Đề xuất AI</span><strong>{replacement}</strong></div></div>
                <p>{item.rationale}</p>
                <div className="queueActions">
                  {item.status !== 'APPROVED' ? <button type="button" className="tableActionButton" disabled={decisionId === item.id} onClick={() => void decide(item, 'APPROVE')}><Check size={14} />Phê duyệt</button> : <button type="button" className="tableActionButton" disabled={decisionId === item.id} onClick={() => void decide(item, 'UNAPPROVE')}><X size={14} />Bỏ phê duyệt</button>}
                  {item.status !== 'REJECTED' ? <button type="button" className="tableActionButton subtleDanger" disabled={decisionId === item.id} onClick={() => void decide(item, 'REJECT')}><X size={14} />Từ chối</button> : null}
                  {item.adGroup ? <button type="button" className="tableActionButton" onClick={() => onOpenAssets(item.adGroup!.id)}><ExternalLink size={14} />Mở nhóm quảng cáo</button> : null}
                </div>
              </article>;
            })}
            {!loading && !recommendations.length ? <div className="emptyState">Không có đề xuất ở trạng thái này.</div> : null}
          </div>
        </section>
      ) : null}

      {section === 'keywords' ? (
        <>
          <section className="termComposer">
            <label><span>Loại</span><select value={termType} onChange={(event) => setTermType(event.target.value)}>{TERM_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>Ngôn ngữ</span><select value={termLanguage} onChange={(event) => setTermLanguage(event.target.value)}>{LANGUAGE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>Thị trường</span><input value={termMarket} onChange={(event) => setTermMarket(event.target.value.toUpperCase())} placeholder="VN" maxLength={16} /></label>
            <label><span>Phạm vi</span><select value={termScope} onChange={(event) => { setTermScope(event.target.value); setTermCampaignId(''); setTermAdGroupId(''); }}>{SCOPE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            {termScope === 'CAMPAIGN' ? <label><span>ID chiến dịch</span><input value={termCampaignId} onChange={(event) => setTermCampaignId(event.target.value.replace(/\D/g, ''))} placeholder="ID chiến dịch" /></label> : null}
            {termScope === 'AD_GROUP' ? <label><span>ID nhóm quảng cáo</span><input value={termAdGroupId} onChange={(event) => setTermAdGroupId(event.target.value.replace(/\D/g, ''))} placeholder="ID nhóm quảng cáo" /></label> : null}
            <label className="termInput"><span>Từ khóa</span><input value={termText} onChange={(event) => setTermText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createTerm(); }} placeholder="Nhập từ khóa hoặc cụm từ" /></label>
            <button className="primaryButton" type="button" disabled={loading || !canCreateTerm} onClick={() => void createTerm()}><Plus size={15} />Thêm</button>
          </section>
          {groupedTerms.map((group) => <section className="operationsSection" key={group.type}><div className="sectionTitle"><h2>{group.label}</h2><span>{group.terms.length}</span></div><div className="plainTable"><table><thead><tr><th>Từ khóa</th><th>Ngôn ngữ</th><th>Thị trường</th><th>Phạm vi</th><th>Trọng số</th><th>Đang bật</th><th></th></tr></thead><tbody>
            {group.terms.map((item) => <tr key={item.id}><td><strong>{item.term}</strong></td><td>{getLanguageLabel(item.languageCode)}</td><td>{item.marketCode ?? '-'}</td><td>{scopeLabel(item)}</td><td>{Number(item.weight).toFixed(1)}</td><td><label className="switchControl"><span className="srOnly">Bật hoặc tắt {item.term}</span><input type="checkbox" checked={item.active} onChange={() => void updateTerm(item, { active: !item.active })} /><span /></label></td><td><button className="iconAction danger" type="button" title="Xóa" aria-label={`Xóa ${item.term}`} onClick={() => void deleteTerm(item)}><Trash2 size={15} /></button></td></tr>)}
            {!group.terms.length ? <tr><td colSpan={7} className="empty">Chưa có từ khóa trong nhóm này.</td></tr> : null}
          </tbody></table></div></section>)}
        </>
      ) : null}

      {(section === 'settings' || section === 'automation') && settings ? (
        <>
          {section === 'settings' ? (
            <section className="operationsSection">
            <div className="sectionTitle">
              <div>
                <h2>Đổi mật khẩu</h2>
                <p>Sau khi đổi thành công, tất cả phiên đăng nhập cũ sẽ bị đăng xuất.</p>
              </div>
              <span>{currentUser.email}</span>
            </div>
            <div className="settingsGrid">
              <label>
                <span>Mật khẩu hiện tại</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordDraft.currentPassword}
                  onChange={(event) => setPasswordDraft((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))}
                />
              </label>
              <label>
                <span>Mật khẩu mới</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordDraft.newPassword}
                  onChange={(event) => setPasswordDraft((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))}
                />
              </label>
              <label>
                <span>Nhập lại mật khẩu mới</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordDraft.confirmPassword}
                  onChange={(event) => setPasswordDraft((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void changePassword();
                  }}
                />
              </label>
            </div>
            <div className="settingsActions">
              <span>Ít nhất 10 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</span>
              <button
                className="primaryButton"
                type="button"
                disabled={passwordSaving}
                onClick={() => void changePassword()}
              >
                <Save size={15} />
                {passwordSaving ? 'Đang đổi...' : 'Đổi mật khẩu'}
              </button>
            </div>
            </section>
          ) : null}
          {section === 'settings' && canManageUsers ? (
            <section className="operationsSection">
              <div className="sectionTitle">
                <div>
                  <h2>Quản lý quyền truy cập</h2>
                  <p>Chỉ định người được chỉnh sửa Google Ads và người chỉ được xem.</p>
                </div>
                <span>{accessUsers.length} người dùng</span>
              </div>
              <div className="settingsGrid">
                <label><span>Email</span><input value={newAccessUser.email} onChange={(event) => setNewAccessUser((current) => ({ ...current, email: event.target.value }))} placeholder="name@company.com" /></label>
                <label><span>Tên hiển thị</span><input value={newAccessUser.displayName} onChange={(event) => setNewAccessUser((current) => ({ ...current, displayName: event.target.value }))} placeholder="Họ và tên" /></label>
                <label><span>Mật khẩu</span><input type="password" value={newAccessUser.password} onChange={(event) => setNewAccessUser((current) => ({ ...current, password: event.target.value }))} placeholder="Mật khẩu tạm thời" /></label>
                <label><span>Vai trò</span><select value={newAccessUser.role} onChange={(event) => setNewAccessUser((current) => ({ ...current, role: event.target.value }))}><option value="VIEWER">Người xem</option><option value="EDITOR">Biên tập viên</option><option value="ADMIN">Quản trị viên</option></select></label>
              </div>
              {accessFormError ? (
                <div className="inlineError">
                  <AlertCircle size={16} />
                  {accessFormError}
                </div>
              ) : null}
              <div className="settingsActions">
                <span>Mật khẩu tối thiểu 10 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.</span>
                <button className="primaryButton" type="button" disabled={accessSavingId === 'new'} onClick={() => void createAccessUser()}><Plus size={15} />Tạo người dùng</button>
              </div>
              <div className="plainTable"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th></tr></thead><tbody>
                {accessUsers.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.displayName}</strong><br /><span>{user.email}</span></td>
                    <td><select value={user.role} disabled={accessSavingId === user.id || user.id === currentUser.id} onChange={(event) => void updateAccessUser(user, { role: event.target.value as AccessUser['role'] })}><option value="VIEWER">Người xem</option><option value="EDITOR">Người chỉnh sửa</option><option value="ADMIN">Quản trị viên</option></select></td>
                    <td><select value={user.status} disabled={accessSavingId === user.id || user.id === currentUser.id} onChange={(event) => void updateAccessUser(user, { status: event.target.value })}><option value="ACTIVE">Đang hoạt động</option><option value="DISABLED">Đã vô hiệu hóa</option></select></td>
                    <td>{formatDate(user.lastLoginAt)}<br /><button className="tableActionButton" type="button" onClick={() => setSelectedAccessUserId(user.id)}>Tài khoản: {user.role === 'ADMIN' ? 'Tất cả' : user.accountAccess.length}</button></td>
                  </tr>
                ))}
                {!accessUsers.length ? <tr><td colSpan={4} className="empty">Chưa tải người dùng.</td></tr> : null}
              </tbody></table></div>
              {selectedAccessUser ? (
                <div className="campaignAccessEditor">
                  <div className="campaignAccessHeader">
                    <div>
                        <strong>Quyền truy cập Google Ads của {selectedAccessUser.displayName}</strong>
                        <span>
                          {selectedAccessUser.role === 'ADMIN'
                          ? 'Quản trị viên có thể truy cập mọi tài khoản Google Ads.'
                          : accountAccessAllowed
                            ? `Đã cấp quyền cho khách hàng ${customerId} và tất cả chiến dịch.`
                            : `Chưa có quyền truy cập khách hàng ${customerId}.`}
                        </span>
                    </div>
                    {selectedAccessUser.role !== 'ADMIN' ? (
                      <div>
                        <button type="button" className="primaryButton" disabled={accessSavingId === `accounts:${selectedAccessUser.id}`} onClick={() => void saveAccountAccess()}><Save size={15} />Lưu quyền truy cập</button>
                      </div>
                    ) : null}
                  </div>
                  {selectedAccessUser.role === 'ADMIN' ? null : (
                    <div className="campaignAccessList">
                      <label><span className="srOnly">Quyền truy cập khách hàng {customerId}</span>
                        <input
                          type="checkbox"
                          checked={accountAccessAllowed}
                          onChange={(event) => setAccountAccessAllowed(event.target.checked)}
                        />
                        <span>
                          <strong>Khách hàng {customerId}</strong>
                          <small>Bao gồm tất cả chiến dịch hiện tại và tương lai trong tài khoản Google Ads này.</small>
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}
          {section === 'settings' ? (
            <section className="operationsSection">
              <div className="sectionTitle"><h2>Kết nối</h2><span>{settings.account.displayName}</span></div>
              <div className="connectionRows"><div><span>Google Ads API</span><strong className={settings.providers.googleAdsConfigured ? 'connected' : 'disconnected'}>{settings.providers.googleAdsConfigured ? 'Đã kết nối' : 'Thiếu cấu hình'}</strong></div><div><span>Gemini API</span><strong className={settings.providers.geminiConfigured ? 'connected' : 'disconnected'}>{settings.providers.geminiConfigured ? 'Đã kết nối' : 'Thiếu cấu hình'}</strong></div><div><span>Khách hàng</span><strong>{settings.account.customerId}</strong></div><div><span>Lần đồng bộ gần nhất</span><strong>{formatDate(settings.account.lastSyncedAt)}</strong></div></div>
            </section>
          ) : null}
          {section === 'automation' ? (
            <>
            <section className="operationsSection">
            <div className="sectionTitle">
              <div>
                <h2>Phạm vi Automation</h2>
                <p>Chỉ những nhóm quảng cáo được tích chọn mới được AI định kỳ xử lý.</p>
              </div>
              <span>
                {selectedAutomationCampaignIds.length} chiến dịch · {selectedAutomationAdGroupIds.length} nhóm quảng cáo
              </span>
            </div>
            {settings.automationScope?.campaigns.length ? (
              <div className="automationScopeTree">
                {settings.automationScope.campaigns.map((campaign) => {
                  const campaignSelected = selectedAutomationCampaignIds.includes(campaign.id);
                  const selectedChildren = campaign.adGroups.filter((adGroup) =>
                    selectedAutomationAdGroupIds.includes(adGroup.id),
                  ).length;
                  return (
                    <details className="automationScopeCampaign" key={campaign.id}>
                      <summary>
                        <label aria-label={`Cho phép Automation trong chiến dịch ${campaign.name}`}>
                          <input
                            type="checkbox"
                            checked={campaignSelected}
                            disabled={!canManageAutomationScope}
                            onChange={(event) =>
                              toggleAutomationCampaign(campaign.id, event.target.checked)
                            }
                          />
                          <span>
                            <strong>{campaign.name}</strong>
                            <small>ID {campaign.id} · {campaign.status} · {selectedChildren}/{campaign.adGroups.length} nhóm đã chọn</small>
                          </span>
                        </label>
                      </summary>
                      <div className="automationScopeAdGroups">
                        {campaign.adGroups.map((adGroup) => (
                          <label
                            key={adGroup.id}
                            aria-label={`Cho phép Automation trong nhóm quảng cáo ${adGroup.name}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedAutomationAdGroupIds.includes(adGroup.id)}
                              disabled={!canManageAutomationScope || !campaignSelected}
                              onChange={(event) =>
                                toggleAutomationAdGroup(adGroup.id, event.target.checked)
                              }
                            />
                            <span>
                              <strong>{adGroup.name}</strong>
                              <small>ID {adGroup.id} · {adGroup.status}</small>
                            </span>
                          </label>
                        ))}
                        {!campaign.adGroups.length ? (
                          <div className="empty">Chiến dịch này chưa có nhóm quảng cáo trong dữ liệu đã đồng bộ.</div>
                        ) : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <div className="empty">
                Chưa có chiến dịch trong PostgreSQL. Hãy đồng bộ dữ liệu Google Ads trước khi cấu hình Automation.
              </div>
            )}
            <div className="settingsActions">
              <span>
                Chọn chiến dịch chỉ để mở phạm vi; bạn vẫn phải tích riêng từng nhóm quảng cáo.
              </span>
              {canManageAutomationScope ? (
                <button
                  className="primaryButton"
                  type="button"
                  disabled={automationScopeSaving}
                  onClick={() => void saveAutomationScope()}
                >
                  <Save size={15} />
                  {automationScopeSaving ? 'Đang lưu...' : 'Lưu phạm vi'}
                </button>
              ) : null}
            </div>
          </section>
          <section className="operationsSection">
            <div className="sectionTitle">
              <div>
                <h2>Lịch và giới hạn</h2>
                <p>Giới hạn số nội dung được thay trong mỗi lượt để kiểm soát rủi ro và quota.</p>
              </div>
            </div>
            <div className="settingsGrid">
              <label><span>Chu kỳ chạy (ngày)</span><input type="number" min="1" max="365" value={settingsDraft.reviewIntervalDays} onChange={(event) => setSettingsDraft((current) => ({ ...current, reviewIntervalDays: Number(event.target.value) }))} /></label>
              <label><span>Số thay đổi tối đa mỗi lượt</span><input type="number" min="1" max="100" value={settingsDraft.maxChangesPerRun} onChange={(event) => setSettingsDraft((current) => ({ ...current, maxChangesPerRun: Number(event.target.value) }))} /></label>
            </div>
            <div className="settingsActions">
              <span>Cấu hình này được áp dụng cho cả Chạy ngay và các lượt chạy theo lịch.</span>
              <button className="primaryButton" type="button" disabled={loading || !canRunPeriodicAi} onClick={() => void saveAutomationLimits()}><Save size={15} />Lưu lịch và giới hạn</button>
            </div>
          </section>
          <section className="operationsSection">
            <div className="sectionTitle"><div><h2>AI định kỳ</h2><p>Bấm Chạy ngay để bắt đầu. Bấm Tắt để dừng các lần chạy sau.</p></div><span>{settingsDraft.automationEnabled ? 'Tự động áp dụng lên Google Ads' : 'Đã tắt'}</span></div>
            <div className="settingsGrid">
              <label><span>AI định kỳ</span><input value={settingsDraft.automationEnabled ? 'Đang bật - theo lịch' : 'Đã tắt'} disabled /></label>
              <label><span>Chế độ áp dụng</span><input value={settingsDraft.automationEnabled ? 'TỰ ĐỘNG - áp dụng trực tiếp lên Google Ads' : 'Đã tắt'} disabled /></label>
              <label><span>Lần chạy gần nhất</span><input value={formatDate(settings.schedule?.lastRunAt)} disabled /></label>
              <label><span>Lần chạy tiếp theo</span><input value={formatDate(settings.schedule?.nextRunAt)} disabled /></label>
              <label><span>Trạng thái gần nhất</span><input value={latestAutomationRun?.status ?? 'Chưa có'} disabled /></label>
              <label><span>Kết quả gần nhất</span><input value={latestAutomationRun ? `${latestAutomationRun.selectedCount} đã chọn / ${latestAutomationRun.appliedCount} đã áp dụng` : 'Chưa chạy'} disabled /></label>
            </div>
            <div className="settingsActions"><span>{automationStatusText}</span><button className="primaryButton" type="button" disabled={automationRunning || automationRunInProgress || loading || !canRunPeriodicAi || selectedAutomationAdGroupIds.length === 0} onClick={() => void runAutomationNow()}><Play size={15} />{automationActionText}</button><button className="secondaryButton dangerButton" type="button" disabled={loading || automationRunning || !settingsDraft.automationEnabled || !canRunPeriodicAi} onClick={() => void stopAutomation()}><X size={15} />Tắt</button></div>
          </section>
          </>
          ) : null}
          {section === 'settings' ? (
            <section className="operationsSection">
            <div className="sectionTitle"><div><h2>Chính sách đánh giá AI</h2><p>{settings.policy.name}</p></div><span>{settingsDraft.automationEnabled ? 'AI định kỳ TỰ ĐỘNG' : 'Đề xuất AI tự động'}</span></div>
            <div className="settingsGrid">
              <label><span>Chiến lược ngôn ngữ</span><select value={settingsDraft.languageStrategy} onChange={(event) => setSettingsDraft((current) => ({ ...current, languageStrategy: event.target.value }))}><option value="DETECT_FROM_ASSET">Tự phát hiện theo từng tài nguyên</option><option value="FIXED">Dùng một ngôn ngữ cố định</option></select></label>
              <label><span>Ngôn ngữ mục tiêu</span><select disabled={settingsDraft.languageStrategy !== 'FIXED'} value={settingsDraft.targetLanguage} onChange={(event) => setSettingsDraft((current) => ({ ...current, targetLanguage: event.target.value }))}><option value="">Chọn ngôn ngữ</option>{LANGUAGE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>Lượt hiển thị tối thiểu</span><input type="number" min="0" value={settingsDraft.minimumImpressions} onChange={(event) => setSettingsDraft((current) => ({ ...current, minimumImpressions: Number(event.target.value) }))} /></label>
              <label><span>Lượt nhấp tối thiểu</span><input type="number" min="0" value={settingsDraft.minimumClicks} onChange={(event) => setSettingsDraft((current) => ({ ...current, minimumClicks: Number(event.target.value) }))} /></label>
              <label><span>Thời gian chờ sau thay đổi (ngày)</span><input type="number" min="0" value={settingsDraft.cooldownDays} onChange={(event) => setSettingsDraft((current) => ({ ...current, cooldownDays: Number(event.target.value) }))} /></label>
              <label><span>Nhãn tài nguyên</span><input value="LOW" disabled /></label>
            </div>
            <div className="settingsActions"><span>Tiêu đề {settings.policy.headlineMaxLength} ký tự · Mô tả {settings.policy.descriptionMaxLength} ký tự</span><button className="primaryButton" type="button" disabled={loading || !canManagePolicy} onClick={() => void saveSettings()}><Save size={15} />Lưu chính sách</button></div>
            </section>
          ) : null}
        </>
      ) : null}

      {loading && !overview && !recommendations.length && !terms.length && !settings ? <div className="pageLoading"><RefreshCw size={18} className="spin" />Đang tải</div> : null}
    </div>
  );
}
