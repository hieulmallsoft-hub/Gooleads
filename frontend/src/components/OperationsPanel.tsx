import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clipboard,
  FileText,
  ExternalLink,
  History,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { extractApiError, parseJsonSafe } from '../api/client';
import { getLanguageLabel, LANGUAGE_OPTIONS } from '../config/languages';
import type { AuthUser, Campaign } from '../types/googleAds';

export type OperationsSection = 'overview' | 'recommendations' | 'impact' | 'automation' | 'keywords' | 'settings' | 'guide';

type RequestFn = (path: string, options?: RequestInit) => Promise<Response>;

const DEFAULT_BUSINESS_PROMPT = `Bạn là chuyên gia viết nội dung quảng cáo cho {{topic}}.

Hãy viết lại {{field_type}} hiện tại: "{{old_text}}"
- Viết tự nhiên bằng {{language}}.
- Nhấn mạnh lợi ích rõ ràng và phù hợp với nhóm {{ad_group_name}}.
- Không lặp lại nội dung cũ.
- Không vượt quá {{max_length}} ký tự.`;

const DEFAULT_EDITABLE_SYSTEM_PROMPT = `Vai trò: Senior Google Ads Copywriter chuyên tối ưu quảng cáo ứng dụng.
Nhiệm vụ: Viết một nội dung thay thế cho từng HEADLINE hoặc DESCRIPTION được Google Ads gắn nhãn LOW.

QUY TẮC BẮT BUỘC
- Viết tự nhiên như người bản địa, đúng ngôn ngữ cấu hình của nhóm quảng cáo.
- Không bịa đặt giá, ưu đãi, số liệu, giải thưởng, bảo đảm hoặc tính năng.
- Không trùng hoặc gần giống nội dung hiện có và lịch sử đề xuất.
- Không dùng viết hoa bất thường, emoji, ký hiệu trang trí, dấu câu lặp hoặc nội dung gây hiểu nhầm.
- HEADLINE tối đa 30 ký tự; DESCRIPTION tối đa 60 ký tự.
- Không dùng từ khóa phủ định hoặc nội dung bị cấm.
- Tiêu đề và mô tả phải được viết thành một cặp cùng thông điệp: tiêu đề nêu ý chính, mô tả bổ sung đúng lợi ích hoặc hành động của ý đó; không được nói sang nội dung khác.
- Trước khi trả kết quả, đối chiếu toàn bộ tiêu đề với toàn bộ mô tả được tạo trong lần chạy và viết lại nếu chúng không thể xuất hiện cùng một mẫu quảng cáo.
- Chỉ xử lý tài khoản, chiến dịch, nhóm quảng cáo và tài nguyên LOW đã được hệ thống cấp phép.`;

function buildFullPromptPreview(businessPrompt: string) {
  return `SYSTEM PROMPT — KHÔNG THỂ CHỈNH

Vai trò: Senior Google Ads Copywriter chuyên tối ưu quảng cáo ứng dụng.
Nhiệm vụ: Viết một nội dung thay thế cho từng HEADLINE hoặc DESCRIPTION được Google Ads gắn nhãn LOW.

QUY TẮC BẮT BUỘC
- Viết tự nhiên như người bản địa, đúng ngôn ngữ cấu hình của nhóm quảng cáo.
- Không bịa đặt giá, ưu đãi, số liệu, giải thưởng, bảo đảm hoặc tính năng.
- Không trùng hoặc gần giống nội dung hiện có và lịch sử đề xuất.
- Không dùng viết hoa bất thường, emoji, ký hiệu trang trí, dấu câu lặp hoặc nội dung gây hiểu nhầm.
- HEADLINE tối đa 30 ký tự; DESCRIPTION tối đa 60 ký tự.
- Không dùng từ khóa phủ định hoặc nội dung bị cấm.
- Tiêu đề và mô tả phải được viết thành một cặp cùng thông điệp: tiêu đề nêu ý chính, mô tả bổ sung đúng lợi ích hoặc hành động của ý đó; không được nói sang nội dung khác.
- Trước khi trả kết quả, đối chiếu toàn bộ tiêu đề với toàn bộ mô tả được tạo trong lần chạy và viết lại nếu chúng không thể xuất hiện cùng một mẫu quảng cáo.
- Chỉ xử lý tài khoản, chiến dịch, nhóm quảng cáo và tài nguyên LOW đã được hệ thống cấp phép.
- Phải trả đúng JSON schema của hệ thống; không viết giải thích ngoài JSON.

PROMPT NGHIỆP VỤ — DO ADMIN CẤU HÌNH
${businessPrompt.trim() || '(Chưa cấu hình — hệ thống dùng hướng dẫn mặc định)'}

DỮ LIỆU ĐỘNG ĐƯỢC CHÈN KHI CHẠY
Chiến dịch: {{campaign_name}}
Nhóm quảng cáo: {{ad_group_name}}
Ngôn ngữ: {{language}}
Chủ đề: {{topic}}
Loại nội dung: {{field_type}}
Nội dung LOW hiện tại: {{old_text}}
Giới hạn ký tự: {{max_length}}
Số liệu hiệu suất: {{performance_metrics}}
Toàn bộ nội dung hiện có để tránh trùng: {{existing_ad_copy}}
Lịch sử đề xuất: {{suggestion_history}}
Quy tắc từ khóa và từ cấm: {{creative_policy_terms}}

OUTPUT CONTRACT — KHÔNG THỂ CHỈNH
Trả về JSON gồm summary và suggestions. Mỗi suggestion phải khớp đúng candidate key, có nội dung thay thế hợp lệ, lý do và mức độ tin cậy.`;
}

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

type AutomationMetrics = {
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas: number;
};

type AutomationCampaignDetail = {
  campaign: {
    id: string;
    name: string;
    status: string;
    mode: 'ALL' | 'SELECTED';
    prompt: string;
    metricsAvailable: boolean;
    syncStatus: string | null;
    syncCheckedAt: string | null;
    checkedAdGroupCount: number;
    metrics: AutomationMetrics;
  };
  days: number;
  adGroups: Array<{
    id: string;
    name: string;
    status: string;
    selected: boolean;
    metricsAvailable: boolean;
    syncStatus: string | null;
    syncCheckedAt: string | null;
    syncError: string | null;
    languageCode: string;
    topic: string;
    metrics: AutomationMetrics;
  }>;
};

type SettingsData = {
  account: {
    customerId: string;
    displayName: string | null;
    status: string;
    timeZone: string | null;
    currencyCode: string | null;
    lastSyncedAt: string | null;
  };
  policy: {
    name: string;
    languageStrategy: string;
    targetLanguage: string | null;
    selectionCriteria: { targetLabels?: string[]; businessPrompt?: string; editableSystemPrompt?: string };
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
    items: Array<{
      id: string;
      action: string;
      reason: string | null;
      targetSnapshot: {
        campaignId?: string;
        campaignName?: string;
        adGroupId?: string;
        adGroupName?: string;
      } | null;
      replacement: {
        fieldType: string | null;
        oldText: string;
        newText: string;
        status: string;
      } | null;
      createdAt: string;
    }>;
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
      mode: 'ALL' | 'SELECTED';
      adGroupCount: number;
      selectedAdGroupIds: string[];
      intervalDays: number;
      prompt: string;
      automationEnabled: boolean;
      lastRunAt: string | null;
      nextRunAt: string | null;
    }>;
    selectedAdGroupIds: string[];
    adGroupConfigs: Array<{ adGroupId: string; languageCode: string; topic: string }>;
    allCampaignIds: string[];
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
  return extractApiError(body, fallback);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ngày không hợp lệ';
  const calendarDate = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${calendarDate} lúc ${time}`;
}

function formatNextRunDate(value: string | null | undefined) {
  if (!value) return 'Chưa lên lịch';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ngày không hợp lệ';
  const differenceMs = date.getTime() - Date.now();
  const differenceDays = Math.ceil(Math.abs(differenceMs) / 86_400_000);
  const relative = differenceMs >= 0
    ? differenceDays === 0 ? 'hôm nay' : `còn ${differenceDays} ngày`
    : differenceDays === 0 ? 'đã qua' : `đã qua ${differenceDays} ngày`;
  return `${formatDate(value)} · ${relative}`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatAutomationMoney(value: number, currencyCode?: string | null) {
  const amount = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 2,
  }).format(value);
  return currencyCode ? `${amount} ${currencyCode}` : amount;
}

function formatAutomationPercent(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function automationEntityStatus(value: string) {
  if (value === 'ENABLED') return 'Đang hoạt động';
  if (value === 'PAUSED') return 'Đã tạm dừng';
  if (value === 'REMOVED') return 'Đã xóa';
  return value;
}

function normalizeAutomationSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .trim();
}

function sameIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

function automationRunStatus(value?: string | null) {
  if (value === 'RUNNING') return 'Đang xử lý';
  if (value === 'COMPLETED') return 'Đã hoàn tất';
  if (value === 'PARTIAL') return 'Hoàn tất một phần';
  if (value === 'FAILED') return 'Thất bại';
  if (value === 'SKIPPED') return 'Đã kiểm tra — không cần chạy AI';
  if (value === 'CANCELLED') return 'Đã hủy';
  return value || 'Chưa có';
}

function explainAutomationReason(value?: string | null) {
  const reason = String(value ?? '').trim();
  if (/No LOW headline\/description assets found for AI suggestions/i.test(reason)) {
    return 'Không tìm thấy tiêu đề hoặc mô tả mang nhãn LOW. AI không được gọi vì không có nội dung cần thay.';
  }
  if (/No enabled ad groups found/i.test(reason)) return 'Không có nhóm quảng cáo đang hoạt động trong phạm vi đã chọn.';
  if (/Creative policy is disabled/i.test(reason)) return 'Automation đang tắt nên lần chạy đã dừng.';
  if (/returned empty text suggestions/i.test(reason)) return 'AI đã được gọi nhưng không trả về nội dung đề xuất.';
  return reason || 'Không có thông tin chi tiết.';
}

function automationRunActionLabel(value: string) {
  return {
    APPLIED: 'Đã áp dụng',
    FAILED: 'Lỗi',
    SKIPPED: 'Bỏ qua',
    PAUSED: 'Đã dừng',
    SUGGESTED: 'Đã đề xuất',
    PROMPT: 'Prompt AI',
  }[value] ?? value;
}

function formatAutomationPromptBlock(value: string) {
  return value.split('\n').map((line) => {
    const jsonStart = line.search(/[\[{]/);
    if (jsonStart <= 0) return line;
    const prefix = line.slice(0, jsonStart).trimEnd();
    try {
      const parsed = JSON.parse(line.slice(jsonStart));
      return `${prefix}\n${JSON.stringify(parsed, null, 2)}`;
    } catch {
      return line;
    }
  }).join('\n');
}

function splitAutomationPrompt(value: string) {
  const titleLabels: Record<string, string> = {
    'HƯỚNG DẪN HỆ THỐNG DO NGƯỜI DÙNG CẤU HÌNH:': 'Hướng dẫn được cấu hình',
    'YÊU CẦU NGHIỆP VỤ DO NGƯỜI DÙNG CẤU HÌNH:': 'Yêu cầu nghiệp vụ',
    'QUY TẮC CHẤT LƯỢNG NỘI DUNG:': 'Quy tắc chất lượng',
    'QUY TẮC NGÔN NGỮ VÀ THỊ TRƯỜNG:': 'Ngôn ngữ và thị trường',
    'QUY TẮC GOOGLE ADS VÀ DỮ LIỆU:': 'Google Ads và dữ liệu',
    'USER-EDITABLE SYSTEM INSTRUCTIONS:': 'Hướng dẫn được cấu hình',
    'COPY QUALITY RULES:': 'Quy tắc chất lượng',
    'LANGUAGE AND MARKET RULES:': 'Ngôn ngữ và thị trường',
    'GOOGLE ADS AND DATA RULES:': 'Google Ads và dữ liệu',
  };
  const sections: Array<{ title: string; content: string }> = [];
  let title = 'Vai trò và nhiệm vụ';
  let lines: string[] = [];
  const flush = () => {
    const content = formatAutomationPromptBlock(lines.join('\n').trim());
    if (content) sections.push({ title, content });
    lines = [];
  };
  for (const line of String(value ?? '').split('\n')) {
    const heading = line.trim();
    if (titleLabels[heading]) {
      flush();
      title = titleLabels[heading];
    } else {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

function presentAutomationPromptSection(content: string) {
  const labels: Array<[RegExp, string]> = [
    [/^Creative policy and term database:/, 'Chính sách creative và kho thuật ngữ:'],
    [/^Suggestion history to avoid:/, 'Lịch sử đề xuất cần tránh:'],
    [/^All current ad group copy that new suggestions must not duplicate:/, 'Nội dung hiện có cần tránh trùng:'],
    [/^Context:/, 'Dữ liệu lần chạy:'],
    [/^LOW-label text candidates sorted by views:/, 'Nội dung LOW cần thay:'],
  ];
  return content.split('\n').map((line) => {
    for (const [pattern, label] of labels) {
      if (pattern.test(line)) return line.replace(pattern, label);
    }
    return line;
  }).join('\n');
}

function presentLegacyPromptRules(title: string, content: string) {
  const isEnglishLegacy = /\b(?:Write natural|User-configured|Use the stricter|Do not|Never)\b/.test(content);
  if (!isEnglishLegacy) return presentAutomationPromptSection(content);
  if (title === 'Quy tắc chất lượng') return [
    '1. Viết tự nhiên như copywriter bản địa, không dùng văn phong AI chung chung.',
    '2. Tập trung vào lợi ích cụ thể, nhu cầu của khách hàng, điểm khác biệt có ý nghĩa hoặc hành động rõ ràng.',
    '3. Diễn đạt cụ thể, dễ hiểu; nêu giá trị thay vì chỉ kể tên tính năng.',
    '4. Không bịa giá, khuyến mãi, số liệu, giải thưởng, cam kết, tính năng hoặc tuyên bố cạnh tranh.',
    '5. Tránh các từ sáo rỗng như “hàng đầu”, “tốt nhất”, “hoàn hảo” khi không có bằng chứng.',
    '6. Không lặp lại cùng thông điệp; phải đa dạng góc thuyết phục và cấu trúc câu.',
    '7. Dùng từ khóa tự nhiên; không nhồi từ khóa, viết hoa toàn bộ, tạo khẩn cấp giả hoặc hứa hẹn không kiểm chứng.',
    '8. Tiêu đề phải có một ý rõ ràng; mô tả phải bổ sung thông tin hữu ích.',
    '9. Không sao chép nội dung hiện tại, nội dung bị từ chối hoặc lịch sử đề xuất.',
    '10. So sánh với toàn bộ tiêu đề và mô tả trong nhóm để không trùng hoặc gần trùng.',
    '11. Tuân thủ biên tập Google Ads: không emoji, ký hiệu trang trí, lặp dấu câu, clickbait hoặc gây hiểu nhầm.',
    '12. Trước khi trả về, tự kiểm tra tính liên quan, duy nhất, có căn cứ, đúng ngôn ngữ và giới hạn ký tự.',
  ].join('\n');
  if (title === 'Ngôn ngữ và thị trường') {
    const configured = content.match(/User-configured ad group language:\s*([^.]*)/)?.[1]?.trim() || 'không cấu hình';
    const topic = content.match(/User-configured ad group topic:\s*([^.]*)/)?.[1]?.trim() || 'không cấu hình';
    const fallback = content.match(/Ad group fallback language:\s*([^.]*)/)?.[1]?.trim() || 'hệ thống tự nhận diện';
    return [
      `Ngôn ngữ cấu hình: ${configured || 'không cấu hình'}`,
      `Chủ đề nhóm quảng cáo: ${topic}`,
      `Ngôn ngữ hệ thống nhận diện: ${fallback}`,
      '',
      '1. Viết đúng ngôn ngữ của từng candidate; chỉ giữ nguyên tên thương hiệu hoặc sản phẩm.',
      '2. Quốc gia/thị trường không phải ngôn ngữ; chỉ dùng để bản địa hóa giọng văn và từ vựng.',
      '3. Nếu không cấu hình ngôn ngữ, nhận diện trực tiếp từ nội dung hiện tại.',
      '4. Không mặc định sang tiếng Anh chỉ vì tên thương hiệu hoặc từ khóa bằng tiếng Anh.',
      '5. Không trộn nhiều ngôn ngữ trong một nội dung.',
      '6. Dùng ngữ pháp, dấu câu, trật tự từ và từ vựng tự nhiên của người bản địa.',
    ].join('\n');
  }
  if (title === 'Google Ads và dữ liệu') return [
    '1. Tiêu đề tối đa 30 ký tự; mô tả tối đa 60 ký tự.',
    '2. Mỗi nội dung LOW phải có đúng một nội dung thay thế hợp lệ.',
    '3. Chỉ dùng từ khóa, thương hiệu và CTA khi phù hợp; không dùng từ phủ định hoặc tuyên bố bị cấm.',
    '4. Không dùng lại nguyên văn trong lịch sử; nội dung bị từ chối không được phép tái sử dụng.',
    '5. Chỉ dùng dữ liệu được cung cấp làm sự thật về sản phẩm; không tự đoán tính năng.',
    '6. Số liệu hiệu suất chỉ dùng để xác định ưu tiên, không được biến thành tuyên bố quảng cáo.',
    '7. Kết quả phải trả đúng JSON mà hệ thống yêu cầu.',
  ].join('\n');
  return presentAutomationPromptSection(content);
}

type AutomationPromptCandidate = {
  key?: string;
  fieldType?: string;
  currentText?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  targetLanguageCode?: string;
  maxLength?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cost?: number;
  roas?: number;
};

function readPromptJson<T>(prompt: string, labels: string[], fallback: T): T {
  for (const line of prompt.split('\n')) {
    const label = labels.find((candidate) => line.startsWith(candidate));
    if (!label) continue;
    try {
      return JSON.parse(line.slice(label.length).trim()) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function readAutomationLog<T>(items: SettingsData['recentAutomationRuns'][number]['items'], action: string): T | null {
  const entry = items.find((item) => item.action === action);
  if (!entry?.reason) return null;
  try { return JSON.parse(entry.reason) as T; } catch { return null; }
}

function understandAutomationPrompt(prompt: string) {
  return {
    context: readPromptJson<Record<string, unknown>>(prompt, ['Ngữ cảnh lần chạy:', 'Context:'], {}),
    policy: readPromptJson<Record<string, unknown>>(prompt, ['Chính sách creative và kho thuật ngữ:', 'Creative policy and term database:'], {}),
    history: readPromptJson<{ approved?: string[]; rejected?: string[]; applied?: string[] }>(prompt, ['Lịch sử đề xuất cần tránh:', 'Suggestion history to avoid:'], {}),
    existingCopy: readPromptJson<{ headlines?: string[]; descriptions?: string[] }>(prompt, ['Toàn bộ nội dung hiện có không được trùng:', 'All current ad group copy that new suggestions must not duplicate:'], {}),
    candidates: readPromptJson<AutomationPromptCandidate[]>(prompt, ['Danh sách candidate mang nhãn LOW, sắp xếp theo lượt hiển thị:', 'LOW-label text candidates sorted by views:'], []),
  };
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
    businessPrompt: '',
    editableSystemPrompt: DEFAULT_EDITABLE_SYSTEM_PROMPT,
  });
  const [automationPromptOpen, setAutomationPromptOpen] = useState(false);
  const [automationPromptSaving, setAutomationPromptSaving] = useState(false);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationRunningCampaignId, setAutomationRunningCampaignId] = useState('');
  const [automationResultOpen, setAutomationResultOpen] = useState(false);
  const [selectedAutomationRunId, setSelectedAutomationRunId] = useState('');
  const [automationPromptLog, setAutomationPromptLog] = useState<{
    prompt: string;
    runId: string;
    campaignName: string;
    adGroupName: string;
    adGroupId: string;
    runAt: string;
  } | null>(null);
  const [automationPromptRaw, setAutomationPromptRaw] = useState(false);
  const automationStopRequestedRef = useRef(false);
  const [automationScopeSaving, setAutomationScopeSaving] = useState(false);
  const [selectedAutomationCampaignIds, setSelectedAutomationCampaignIds] =
    useState<string[]>([]);
  const [selectedAutomationAdGroupIds, setSelectedAutomationAdGroupIds] =
    useState<string[]>([]);
  const [allAutomationCampaignIds, setAllAutomationCampaignIds] =
    useState<string[]>([]);
  const [automationCampaignSearch, setAutomationCampaignSearch] = useState('');
  const [automationAddSearch, setAutomationAddSearch] = useState('');
  const [automationAddOpen, setAutomationAddOpen] = useState(false);
  const [automationHistoryCampaignId, setAutomationHistoryCampaignId] = useState('');
  const [automationCampaignLogId, setAutomationCampaignLogId] = useState('');
  const [automationCampaignLogRunId, setAutomationCampaignLogRunId] = useState('');
  const [automationCampaignDetail, setAutomationCampaignDetail] =
    useState<AutomationCampaignDetail | null>(null);
  const [automationMetricsSyncing, setAutomationMetricsSyncing] = useState(false);
  const [automationAdGroupConfigs, setAutomationAdGroupConfigs] = useState<Record<string, { languageCode: string; topic: string }>>({});
  const [automationCampaignIntervals, setAutomationCampaignIntervals] = useState<Record<string, number>>({});
  const [automationCampaignPrompts, setAutomationCampaignPrompts] = useState<Record<string, string>>({});
  const [automationCampaignLoadingId, setAutomationCampaignLoadingId] =
    useState('');

  useEffect(() => {
    if (!automationAddOpen && !automationCampaignDetail && !automationHistoryCampaignId && !automationCampaignLogId && !automationPromptOpen) return undefined;

    const closeTopLayer = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (automationPromptOpen) {
        setAutomationPromptOpen(false);
      } else if (automationCampaignLogId) {
        setAutomationCampaignLogId('');
      } else if (automationHistoryCampaignId) {
        setAutomationHistoryCampaignId('');
      } else if (automationCampaignDetail) {
        setAutomationCampaignDetail(null);
      } else {
        setAutomationAddOpen(false);
      }
    };

    window.addEventListener('keydown', closeTopLayer);
    return () => window.removeEventListener('keydown', closeTopLayer);
  }, [automationAddOpen, automationCampaignDetail, automationHistoryCampaignId, automationCampaignLogId, automationPromptOpen]);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [accessSavingId, setAccessSavingId] = useState('');
  const [accessFormError, setAccessFormError] = useState('');
  const [newAccessUser, setNewAccessUser] = useState({
    email: '',
    displayName: '',
    password: '',
    customerId: '',
    role: 'VIEWER',
  });
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const canManageUsers = currentUser.role === 'ADMIN';
  const canRunPeriodicAi = currentUser.permissions.includes('automation.manage');
  const canManageAutomationScope = currentUser.permissions.includes('automation.manage');

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
    const persistedAllCampaignIds = data.automationScope?.allCampaignIds ?? [];
    const persistedSelectedAdGroupIds = new Set(data.automationScope?.selectedAdGroupIds ?? []);
    setSettings(data);
    setSelectedAutomationCampaignIds(
      scopeCampaigns
        .filter((campaign) =>
          campaign.selected ||
          persistedAllCampaignIds.includes(campaign.id) ||
          campaign.selectedAdGroupIds.some((adGroupId) => persistedSelectedAdGroupIds.has(adGroupId)),
        )
        .map((campaign) => campaign.id),
    );
    setSelectedAutomationAdGroupIds(
      data.automationScope?.selectedAdGroupIds ?? [],
    );
    setAllAutomationCampaignIds(
      data.automationScope?.allCampaignIds ?? [],
    );
    setAutomationAdGroupConfigs(Object.fromEntries(
      (data.automationScope?.adGroupConfigs ?? []).map((config) => [config.adGroupId, { languageCode: config.languageCode, topic: config.topic }]),
    ));
    setAutomationCampaignIntervals(Object.fromEntries(
      scopeCampaigns.map((campaign) => [campaign.id, campaign.intervalDays || data.policy.reviewIntervalDays || 14]),
    ));
    setAutomationCampaignPrompts(Object.fromEntries(
      scopeCampaigns.map((campaign) => [campaign.id, campaign.prompt || DEFAULT_EDITABLE_SYSTEM_PROMPT]),
    ));
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
      businessPrompt: data.policy.selectionCriteria?.businessPrompt ?? '',
      editableSystemPrompt: data.policy.selectionCriteria?.editableSystemPrompt || DEFAULT_EDITABLE_SYSTEM_PROMPT,
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
    }, 5 * 60_000);

    return () => window.clearInterval(timer);
  }, [section, customerId]);

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

  async function stopAutomation() {
    if (!canRunPeriodicAi) return;

    const stoppingActiveRun = automationRunning || automationRunInProgress;
    if (stoppingActiveRun) automationStopRequestedRef.current = true;
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
      setNotice(
        stoppingActiveRun
          ? 'Đã gửi yêu cầu dừng. Automation sẽ kết thúc nội dung đang xử lý và không bắt đầu nhóm quảng cáo tiếp theo.'
          : 'Đã tắt AI định kỳ. Hệ thống sẽ không chạy lại cho đến khi bạn bấm Chạy ngay.',
      );
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

  async function saveAutomationBusinessPrompt() {
    if (automationPromptSaving) return;
    if (!settingsDraft.editableSystemPrompt.trim()) {
      setError('Phần Prompt có thể chỉnh không được để trống.');
      return;
    }
    if (settingsDraft.businessPrompt.length > 6000) {
      setError('Prompt nghiệp vụ không được vượt quá 6000 ký tự.');
      return;
    }
    setAutomationPromptSaving(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ customerId });
      const response = await request(`/creative-operations/automation/prompt?${params}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessPrompt: settingsDraft.businessPrompt,
          editableSystemPrompt: settingsDraft.editableSystemPrompt,
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể lưu Prompt nghiệp vụ'));
      setNotice('Đã lưu Prompt nghiệp vụ. Các lần Automation tiếp theo sẽ sử dụng nội dung này.');
      setAutomationPromptOpen(false);
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu Prompt nghiệp vụ');
    } finally {
      setAutomationPromptSaving(false);
    }
  }

  function toggleAutomationCampaign(campaignId: string, selected: boolean) {
    if (selected) {
      setAutomationCampaignIntervals((current) => ({
        ...current,
        [campaignId]: current[campaignId] || settingsDraft.reviewIntervalDays || 14,
      }));
    }
    setSelectedAutomationCampaignIds((current) =>
      selected
        ? [...new Set([...current, campaignId])]
        : current.filter((id) => id !== campaignId),
    );
    setAllAutomationCampaignIds((current) =>
      selected
        ? [...new Set([...current, campaignId])]
        : current.filter((id) => id !== campaignId),
    );
    if (!selected) {
      const adGroupIds = new Set(
        [
          ...(settings?.automationScope?.campaigns
            .find((campaign) => campaign.id === campaignId)
            ?.selectedAdGroupIds ?? []),
          ...(automationCampaignDetail?.campaign.id === campaignId
            ? automationCampaignDetail.adGroups.map((adGroup) => adGroup.id)
            : []),
        ],
      );
      setSelectedAutomationAdGroupIds((current) =>
        current.filter((id) => !adGroupIds.has(id)),
      );
    }
  }

  function setAutomationCampaignMode(campaignId: string, mode: 'ALL' | 'SELECTED') {
    if (mode === 'ALL') {
      setSelectedAutomationCampaignIds((current) => [...new Set([...current, campaignId])]);
    }
    setAllAutomationCampaignIds((current) =>
      mode === 'ALL'
        ? [...new Set([...current, campaignId])]
        : current.filter((id) => id !== campaignId),
    );
    if (mode === 'ALL') {
      const campaignAdGroupIds = new Set(
        automationCampaignDetail?.campaign.id === campaignId
          ? automationCampaignDetail.adGroups.map((adGroup) => adGroup.id)
          : settings?.automationScope?.campaigns.find(
              (campaign) => campaign.id === campaignId,
            )?.selectedAdGroupIds ?? [],
      );
      setSelectedAutomationAdGroupIds((current) =>
        current.filter((id) => !campaignAdGroupIds.has(id)),
      );
    }
  }

  async function loadAutomationCampaign(campaignId: string) {
    setAutomationCampaignIntervals((current) => ({
      ...current,
      [campaignId]: current[campaignId] || settingsDraft.reviewIntervalDays || 14,
    }));
    setAutomationCampaignLoadingId(campaignId);
    setError('');
    try {
      const params = new URLSearchParams({ customerId, days: '14' });
      const response = await request(
        `/creative-operations/automation/scope/campaigns/${campaignId}?${params}`,
      );
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(errorMessage(body, 'Không thể tải nhóm quảng cáo'));
      }
      const detail = body as AutomationCampaignDetail;
      setAutomationCampaignDetail(detail);
      setAutomationAdGroupConfigs((current) => ({
        ...current,
        ...Object.fromEntries(detail.adGroups.filter((item) => item.languageCode || item.topic).map((item) => [item.id, { languageCode: item.languageCode, topic: item.topic }])),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải nhóm quảng cáo');
    } finally {
      setAutomationCampaignLoadingId('');
    }
  }

  async function syncAutomationCampaignMetrics() {
    if (!automationCampaignDetail || automationMetricsSyncing) return;
    setAutomationMetricsSyncing(true);
    setError('');
    try {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 13);
      const datePart = (date: Date) => date.toISOString().slice(0, 10);
      const time = `${datePart(start)},${datePart(end)}`;
      let metricRows = 0;
      for (const adGroup of automationCampaignDetail.adGroups) {
        const response = await request('/google-ads/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId, adGroupId: adGroup.id, time }),
        });
        const body = await parseJsonSafe(response);
        if (!response.ok) throw new Error(errorMessage(body, `Không thể đồng bộ số liệu nhóm ${adGroup.name}`));
        metricRows += Number(body?.adGroupMetricRows ?? 0);
      }
      await loadAutomationCampaign(automationCampaignDetail.campaign.id);
      setNotice(metricRows > 0
        ? `Đã đồng bộ ${metricRows} dòng số liệu 14 ngày cho ${automationCampaignDetail.campaign.name}.`
        : `Đồng bộ hoàn tất nhưng Google Ads không trả về số liệu 14 ngày cho ${automationCampaignDetail.campaign.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đồng bộ số liệu hiệu suất');
    } finally {
      setAutomationMetricsSyncing(false);
    }
  }

  function toggleAutomationAdGroup(campaignId: string, adGroupId: string, selected: boolean) {
    if (selected) {
      setSelectedAutomationCampaignIds((current) => [...new Set([...current, campaignId])]);
      setAllAutomationCampaignIds((current) => current.filter((id) => id !== campaignId));
    }
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
          allCampaignIds: allAutomationCampaignIds,
          adGroupIds: selectedAutomationAdGroupIds,
          adGroupConfigs: Object.entries(automationAdGroupConfigs).map(([adGroupId, config]) => ({ adGroupId, ...config })),
          campaignSchedules: selectedAutomationCampaignIds.map((campaignId) => ({
            campaignId,
            intervalDays: automationCampaignIntervals[campaignId] || settingsDraft.reviewIntervalDays || 14,
            prompt: automationCampaignPrompts[campaignId] || DEFAULT_EDITABLE_SYSTEM_PROMPT,
            enabled: settings?.automationScope?.campaigns.find((campaign) => campaign.id === campaignId)?.automationEnabled !== false,
          })),
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(errorMessage(body, 'Không thể lưu phạm vi Automation'));
      }
      setNotice(
        `Đã lưu phạm vi, chưa chạy Automation: ${allAutomationCampaignIds.length} chiến dịch chọn toàn bộ nhóm, ${selectedAutomationAdGroupIds.length} nhóm quảng cáo được chọn riêng.`,
      );
      await loadSettings();
      setAutomationAddOpen(false);
      setAutomationCampaignDetail(null);
      window.dispatchEvent(new Event('automation-notifications-refresh'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu phạm vi Automation');
    } finally {
      setAutomationScopeSaving(false);
    }
  }

  async function updateAutomationCampaignStatus(campaign: SettingsData['automationScope']['campaigns'][number], action: 'PAUSE' | 'RESUME' | 'REMOVE') {
    if (!canManageAutomationScope) return;
    const message = action === 'REMOVE'
      ? `Bỏ chiến dịch “${campaign.name}” khỏi Automation? Lịch và phạm vi nhóm của chiến dịch này sẽ bị xóa.`
      : action === 'PAUSE'
        ? `Dừng lịch Automation của chiến dịch “${campaign.name}”? Các chiến dịch khác vẫn tiếp tục chạy.`
        : `Bật lại lịch Automation cho chiến dịch “${campaign.name}”?`;
    if (!window.confirm(message)) return;
    setAutomationScopeSaving(true);
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ customerId });
      const response = await request(`/creative-operations/automation/scope/campaigns/${campaign.id}/status?${params}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể cập nhật chiến dịch Automation'));
      setNotice(action === 'REMOVE'
        ? `Đã bỏ ${campaign.name} khỏi Automation. Các chiến dịch khác không bị ảnh hưởng.`
        : action === 'PAUSE'
          ? `Đã dừng lịch riêng của ${campaign.name}.`
          : `Đã bật lại lịch riêng của ${campaign.name}.`);
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật chiến dịch Automation');
    } finally {
      setAutomationScopeSaving(false);
    }
  }

  async function runAutomationNow(campaignId?: string, campaignName?: string) {
    if (!canRunPeriodicAi) return;
    if (campaignId && !window.confirm(`Chạy Automation ngay cho chiến dịch “${campaignName || campaignId}”? Các thay đổi hợp lệ có thể được áp dụng trực tiếp lên Google Ads.`)) return;

    const wasAutomationEnabled = settingsDraft.automationEnabled;
    automationStopRequestedRef.current = false;
    setAutomationRunning(true);
    setAutomationRunningCampaignId(campaignId ?? 'ALL');
    setSettingsDraft((current) => ({ ...current, automationEnabled: true }));
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({ customerId });
      if (campaignId) params.set('campaignId', campaignId);
      const response = await request(`/creative-operations/automation/run?${params}`, {
        method: 'POST',
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể chạy tự động hóa'));
      const selectedCount = Number(body.selectedCount ?? 0);
      const appliedCount = Number(body.appliedCount ?? 0);
      const itemReasons = Array.isArray(body.items)
        ? body.items
            .filter((item: { action?: string }) => ['FAILED', 'SKIPPED'].includes(String(item.action ?? '')))
            .map((item: { reason?: string | null }) => explainAutomationReason(item.reason))
            .filter(Boolean)
            .slice(0, 2)
        : [];
      const reasonText = itemReasons.length ? ` ${itemReasons.join(' | ')}` : '';
      if (!automationStopRequestedRef.current) {
        setNotice(
          appliedCount > 0
            ? `${campaignName ? `Chiến dịch ${campaignName}` : 'Automation'} đã chạy: chọn ${selectedCount} đề xuất và áp dụng ${appliedCount} thay đổi. Hệ thống sẽ tiếp tục chạy theo lịch.`
            : `${campaignName ? `Chiến dịch ${campaignName}` : 'Automation'} đã chạy nhưng chưa áp dụng nội dung nào trong lần này.${reasonText}`,
        );
      }
      await loadSettings();
      window.dispatchEvent(new Event('automation-notifications-refresh'));
    } catch (err) {
      if (!automationStopRequestedRef.current) {
        setSettingsDraft((current) => ({ ...current, automationEnabled: wasAutomationEnabled }));
      }
      setError(err instanceof Error ? err.message : 'Không thể chạy tự động hóa');
    } finally {
      setAutomationRunning(false);
      setAutomationRunningCampaignId('');
    }
  }

  async function createAccessUser() {
    if (!canManageUsers) return;
    if (!newAccessUser.email.trim() || !newAccessUser.displayName.trim() || !newAccessUser.password) {
      setAccessFormError('Vui lòng nhập đầy đủ email, tên hiển thị và mật khẩu.');
      return;
    }
    if (newAccessUser.role !== 'ADMIN' && !/^\d{10}$/.test(newAccessUser.customerId.replace(/\D/g, ''))) {
      setAccessFormError('Mã khách hàng Google Ads phải gồm đúng 10 chữ số.');
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
      setNewAccessUser({ email: '', displayName: '', password: '', customerId: '', role: 'VIEWER' });
      setNotice('Đã tạo người dùng và cấp quyền Google Ads.');
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
      setNotice('Đã cập nhật thông tin và quyền của người dùng.');
      await loadAccessUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật quyền người dùng');
    } finally {
      setAccessSavingId('');
    }
  }

  async function deleteAccessUser(user: AccessUser) {
    if (!canManageUsers || user.id === currentUser.id) return;
    if (!window.confirm(`Xóa người dùng ${user.displayName} (${user.email})? Hành động này không thể hoàn tác.`)) return;

    setAccessSavingId(user.id);
    setError('');
    setNotice('');
    try {
      const response = await request(`/admin/users/${user.id}`, { method: 'DELETE' });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(errorMessage(body, 'Không thể xóa người dùng'));
      setNotice(`Đã xóa người dùng ${user.displayName}.`);
      await loadAccessUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa người dùng');
    } finally {
      setAccessSavingId('');
    }
  }

  async function resetAccessUserPassword(user: AccessUser) {
    if (!canManageUsers || user.id === currentUser.id) return;
    const password = window.prompt(
      `Nhập mật khẩu mới cho ${user.displayName} (${user.email}). Mật khẩu tối thiểu 10 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.`,
    );
    if (password === null) return;
    if (
      password.length < 10 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError('Mật khẩu phải có ít nhất 10 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
      return;
    }
    if (!window.confirm(`Đặt lại mật khẩu cho ${user.displayName}? Tài khoản này sẽ đăng xuất khỏi các phiên hiện tại.`)) return;
    await updateAccessUser(user, { password } as Partial<AccessUser>);
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
    settings: 'Quản lý tài khoản, quyền truy cập và trạng thái kết nối dịch vụ.',
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
  const displayedAutomationRun = (settings?.recentAutomationRuns ?? []).find((run) => run.id === selectedAutomationRunId) ?? latestAutomationRun;
  const latestAutomationSkippedCount = (latestAutomationRun?.items ?? []).filter(
    (item) => item.action === 'SKIPPED',
  ).length ?? 0;
  const automationRunStale = isStaleAutomationRun(latestAutomationRun);
  const automationRunInProgress =
    latestAutomationRun?.status === 'RUNNING' && !automationRunStale;
  const automationCampaigns = useMemo(
    () => settings?.automationScope?.campaigns ?? [],
    [settings?.automationScope?.campaigns],
  );
  const savedAutomationCampaignIdSet = useMemo(() => {
    const savedAllCampaignIds = new Set(settings?.automationScope?.allCampaignIds ?? []);
    const savedAdGroupIds = new Set(settings?.automationScope?.selectedAdGroupIds ?? []);
    return new Set(
      automationCampaigns
        .filter((campaign) =>
          campaign.selected ||
          savedAllCampaignIds.has(campaign.id) ||
          campaign.selectedAdGroupIds.some((adGroupId) => savedAdGroupIds.has(adGroupId)),
        )
        .map((campaign) => campaign.id),
    );
  }, [automationCampaigns, settings?.automationScope?.allCampaignIds, settings?.automationScope?.selectedAdGroupIds]);
  const latestAutomationRunCampaignIds = useMemo(
    () => [...new Set(
      (latestAutomationRun?.items ?? [])
        .map((item) => item.targetSnapshot?.campaignId)
        .filter((id): id is string => Boolean(id)),
    )],
    [latestAutomationRun?.items],
  );
  const automationCampaignRunSummaryById = useMemo(() => {
    const summaries = new Map<string, {
      status: string;
      runAt: string;
      appliedCount: number;
      failedCount: number;
      skippedCount: number;
    }>();
    for (const run of settings?.recentAutomationRuns ?? []) {
      const campaignIds = [...new Set(
        (run.items ?? [])
          .map((item) => item.targetSnapshot?.campaignId)
          .filter((id): id is string => Boolean(id)),
      )];
      for (const campaignId of campaignIds) {
        if (summaries.has(campaignId)) continue;
        const items = (run.items ?? []).filter((item) => item.targetSnapshot?.campaignId === campaignId);
        summaries.set(campaignId, {
          status: run.status,
          runAt: run.completedAt ?? run.startedAt,
          appliedCount: items.reduce(
            (sum, item) => sum + Number(item.reason?.match(/Applied\s+(\d+)/i)?.[1] ?? 0),
            0,
          ),
          failedCount: items.filter((item) => item.action === 'FAILED').length,
          skippedCount: items.filter((item) => item.action === 'SKIPPED').length,
        });
      }
    }
    return summaries;
  }, [settings?.recentAutomationRuns]);
  const automationCampaignLogRuns = (settings?.recentAutomationRuns ?? []).filter((run) =>
    (run.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId),
  );
  const automationCampaignLogRun = automationCampaignLogRuns.find((run) => run.id === automationCampaignLogRunId) ?? automationCampaignLogRuns[0] ?? null;
  const automationChangeHistoryByCampaignId = useMemo(() => {
    const history = new Map<string, Array<{
      id: string;
      fieldType: string;
      oldText: string;
      newText: string;
      adGroupName: string;
      changedAt: string;
    }>>();
    for (const run of settings?.recentAutomationRuns ?? []) {
      for (const item of run.items ?? []) {
        const campaignId = item.targetSnapshot?.campaignId;
        const replacement = item.replacement;
        if (
          !campaignId ||
          item.action !== 'SELECTED' ||
          replacement?.status !== 'APPLIED' ||
          !replacement.oldText ||
          !replacement.newText
        ) continue;
        const entries = history.get(campaignId) ?? [];
        const duplicate = entries.some((entry) =>
          entry.oldText === replacement.oldText &&
          entry.newText === replacement.newText &&
          entry.changedAt === (run.completedAt ?? run.startedAt),
        );
        if (!duplicate) {
          entries.push({
            id: item.id,
            fieldType: replacement.fieldType ?? 'TEXT',
            oldText: replacement.oldText,
            newText: replacement.newText,
            adGroupName: item.targetSnapshot?.adGroupName ?? item.targetSnapshot?.adGroupId ?? 'Nhóm quảng cáo',
            changedAt: run.completedAt ?? run.startedAt,
          });
          history.set(campaignId, entries);
        }
      }
    }
    return history;
  }, [settings?.recentAutomationRuns]);
  const automationHistoryCampaign = automationCampaigns.find(
    (campaign) => campaign.id === automationHistoryCampaignId,
  ) ?? null;
  const activeAutomationChangeHistory = automationHistoryCampaign
    ? automationChangeHistoryByCampaignId.get(automationHistoryCampaign.id) ?? []
    : [];
  const activeCampaignPromptLog = useMemo(() => {
    const campaignId = automationCampaignDetail?.campaign.id;
    if (!campaignId) return null;
    for (const run of settings?.recentAutomationRuns ?? []) {
      const item = (run.items ?? []).find((entry) =>
        entry.action === 'PROMPT' && entry.targetSnapshot?.campaignId === campaignId,
      );
      if (item?.reason) return {
        item,
        runId: run.id,
        runAt: run.completedAt ?? run.startedAt,
      };
    }
    return null;
  }, [automationCampaignDetail?.campaign.id, settings?.recentAutomationRuns]);
  const activeCampaignLastRun = useMemo(() => {
    const campaignId = automationCampaignDetail?.campaign.id;
    if (!campaignId) return null;
    return (settings?.recentAutomationRuns ?? []).find((run) =>
      (run.items ?? []).some((item) => item.targetSnapshot?.campaignId === campaignId),
    ) ?? null;
  }, [automationCampaignDetail?.campaign.id, settings?.recentAutomationRuns]);
  const automationPromptSections = useMemo(
    () => splitAutomationPrompt(automationPromptLog?.prompt ?? ''),
    [automationPromptLog?.prompt],
  );
  const automationPromptExplanation = useMemo(
    () => understandAutomationPrompt(automationPromptLog?.prompt ?? ''),
    [automationPromptLog?.prompt],
  );
  const automationPromptRunItems = useMemo(() => {
    if (!automationPromptLog) return [];
    const run = (settings?.recentAutomationRuns ?? []).find((entry) => entry.id === automationPromptLog.runId);
    return (run?.items ?? [])
      .filter((item) => item.targetSnapshot?.adGroupId === automationPromptLog.adGroupId)
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }, [automationPromptLog, settings?.recentAutomationRuns]);
  const automationRunAudit = useMemo(() => ({
    input: readAutomationLog<{ candidates?: Array<{ key: string; text: string; fieldType: string; impressions: number; clicks: number }>; existingAdCopy?: { headlines?: string[]; descriptions?: string[] } }>(automationPromptRunItems, 'INPUT_SNAPSHOT'),
    request: readAutomationLog<{ provider: string; model: string; prompt: string; schema: unknown }>(automationPromptRunItems, 'AI_REQUEST'),
    response: readAutomationLog<{ raw: string; used: string }>(automationPromptRunItems, 'AI_RESPONSE'),
    validation: readAutomationLog<{ accepted?: Array<{ key: string; oldText: string; newText: string }>; rejected?: Array<{ key: string; oldText: string; proposedText: string; reason: string }>; missing?: Array<{ key: string; oldText: string; reason: string }> }>(automationPromptRunItems, 'AI_VALIDATION'),
    apply: readAutomationLog<{ appliedCount: number; selected?: Array<{ oldText: string; newText: string }> }>(automationPromptRunItems, 'APPLY_RESULT'),
  }), [automationPromptRunItems]);
  const fullAutomationPromptPreview = useMemo(
    () => buildFullPromptPreview(settingsDraft.businessPrompt),
    [settingsDraft.businessPrompt],
  );
  const lockedAutomationPromptPreview = useMemo(() => {
    const marker = 'PROMPT NGHIỆP VỤ';
    const markerIndex = fullAutomationPromptPreview.indexOf(marker);
    return markerIndex >= 0 ? fullAutomationPromptPreview.slice(markerIndex) : fullAutomationPromptPreview;
  }, [fullAutomationPromptPreview]);
  const filteredAutomationCampaigns = useMemo(() => {
    const previousCampaignIds = new Set(latestAutomationRunCampaignIds);
    const visibleCampaigns = automationCampaigns
      .filter((campaign) => savedAutomationCampaignIdSet.has(campaign.id))
      .sort((left, right) => {
        const leftIsNew = previousCampaignIds.has(left.id) ? 0 : 1;
        const rightIsNew = previousCampaignIds.has(right.id) ? 0 : 1;
        return rightIsNew - leftIsNew || left.name.localeCompare(right.name, 'vi');
      });
    const query = normalizeAutomationSearch(automationCampaignSearch);
    if (!query) return visibleCampaigns;
    return visibleCampaigns.filter((campaign) =>
      normalizeAutomationSearch(`${campaign.name} ${campaign.id}`).includes(query),
    );
  }, [automationCampaignSearch, automationCampaigns, latestAutomationRunCampaignIds, savedAutomationCampaignIdSet]);
  const availableAutomationCampaigns = useMemo(() => {
    const query = normalizeAutomationSearch(automationAddSearch);
    return automationCampaigns.filter((campaign) =>
      !savedAutomationCampaignIdSet.has(campaign.id) &&
      campaign.status === 'ENABLED' &&
      (!query || normalizeAutomationSearch(`${campaign.name} ${campaign.id}`).includes(query)),
    );
  }, [automationAddSearch, automationCampaigns, savedAutomationCampaignIdSet]);
  const pendingAutomationAdditions = automationCampaigns.filter(
    (campaign) => !savedAutomationCampaignIdSet.has(campaign.id) && selectedAutomationCampaignIds.includes(campaign.id),
  ).length;
  const pendingAutomationRemovals = automationCampaigns.filter(
    (campaign) => savedAutomationCampaignIdSet.has(campaign.id) && !selectedAutomationCampaignIds.includes(campaign.id),
  ).length;
  const savedAutomationCampaignIds = [...savedAutomationCampaignIdSet];
  const savedAutomationAdGroupIds = settings?.automationScope?.selectedAdGroupIds ?? [];
  const savedAllAutomationCampaignIds = settings?.automationScope?.allCampaignIds ?? [];
  const savedAutomationCampaignIntervals = Object.fromEntries(
    (settings?.automationScope?.campaigns ?? []).map((campaign) => [
      campaign.id,
      campaign.intervalDays || settings?.policy.reviewIntervalDays || 14,
    ]),
  );
  const automationIntervalsDirty = selectedAutomationCampaignIds.some(
    (campaignId) =>
      (automationCampaignIntervals[campaignId] || settings?.policy.reviewIntervalDays || 14) !==
      (savedAutomationCampaignIntervals[campaignId] || settings?.policy.reviewIntervalDays || 14),
  );
  const savedAutomationCampaignPrompts = Object.fromEntries(
    (settings?.automationScope?.campaigns ?? []).map((campaign) => [
      campaign.id,
      campaign.prompt || DEFAULT_EDITABLE_SYSTEM_PROMPT,
    ]),
  );
  const automationPromptsDirty = selectedAutomationCampaignIds.some(
    (campaignId) =>
      (automationCampaignPrompts[campaignId] || DEFAULT_EDITABLE_SYSTEM_PROMPT).trim() !==
      (savedAutomationCampaignPrompts[campaignId] || DEFAULT_EDITABLE_SYSTEM_PROMPT).trim(),
  );
  const savedAutomationGroupConfigs = new Map((settings?.automationScope?.adGroupConfigs ?? []).map((config) => [config.adGroupId, config]));
  const automationGroupConfigsDirty = Object.entries(automationAdGroupConfigs).some(([adGroupId, config]) => {
    const saved = savedAutomationGroupConfigs.get(adGroupId);
    return config.languageCode !== (saved?.languageCode ?? '') || config.topic.trim() !== (saved?.topic ?? '');
  });
  const automationScopeDirty =
    !sameIdSet(selectedAutomationCampaignIds, savedAutomationCampaignIds) ||
    !sameIdSet(selectedAutomationAdGroupIds, savedAutomationAdGroupIds) ||
    !sameIdSet(allAutomationCampaignIds, savedAllAutomationCampaignIds) ||
    automationIntervalsDirty ||
    automationPromptsDirty ||
    automationGroupConfigsDirty;
  const nextAutomationCampaignRunAt = (settings?.automationScope?.campaigns ?? [])
    .map((campaign) => campaign.nextRunAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null;
  const automationNextRunLabel = !settingsDraft.automationEnabled
    ? 'Lịch đang tắt'
    : automationScopeDirty
      ? 'Lưu thay đổi để cập nhật lịch'
      : nextAutomationCampaignRunAt
        ? formatNextRunDate(nextAutomationCampaignRunAt)
        : selectedAutomationCampaignIds.length
          ? 'Chưa có lịch riêng — cần cập nhật backend'
          : 'Chưa có chiến dịch được lên lịch';
  const automationScopeChangedSinceLastRun = Boolean(
    latestAutomationRun &&
    (automationScopeDirty || !sameIdSet([...savedAutomationCampaignIdSet], latestAutomationRunCampaignIds)),
  );
  const hasAutomationTarget =
    allAutomationCampaignIds.length > 0 || selectedAutomationAdGroupIds.length > 0;

  return (
    <div className="operationsPage">
      <header className="operationsHeader">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button className="iconAction" type="button" onClick={() => void loadSection()} disabled={loading} title="Tải lại dữ liệu" aria-label="Tải lại dữ liệu">
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
              <div><span>Lịch chạy AI tiếp theo</span><strong>{formatNextRunDate(overview.automation?.nextRunAt)}</strong></div>
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
                <label><span>Mã khách hàng Google Ads</span><input inputMode="numeric" value={newAccessUser.customerId} onChange={(event) => setNewAccessUser((current) => ({ ...current, customerId: event.target.value }))} placeholder="123-456-7890" /></label>
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
              <div className="plainTable"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th>Thao tác</th></tr></thead><tbody>
                {accessUsers.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.displayName}</strong><br /><span>{user.email}</span></td>
                    <td><select value={user.role} disabled={accessSavingId === user.id || user.id === currentUser.id} onChange={(event) => void updateAccessUser(user, { role: event.target.value as AccessUser['role'] })}><option value="VIEWER">Người xem</option><option value="EDITOR">Người chỉnh sửa</option><option value="ADMIN">Quản trị viên</option></select></td>
                    <td><select value={user.status} disabled={accessSavingId === user.id || user.id === currentUser.id} onChange={(event) => void updateAccessUser(user, { status: event.target.value })}><option value="ACTIVE">Đang hoạt động</option><option value="DISABLED">Đã vô hiệu hóa</option></select></td>
                    <td>{formatDate(user.lastLoginAt)}<br /><span>Tài khoản: {user.accountAccess.length}</span></td>
                    <td><div className="tableActionGroup"><button className="tableActionButton" type="button" disabled={accessSavingId === user.id || user.id === currentUser.id} onClick={() => void resetAccessUserPassword(user)} aria-label={`Đặt lại mật khẩu cho ${user.displayName}`}><KeyRound size={14} />Đặt lại mật khẩu</button><button className="tableActionButton dangerButton" type="button" disabled={accessSavingId === user.id || user.id === currentUser.id} onClick={() => void deleteAccessUser(user)} aria-label={`Xóa người dùng ${user.displayName}`}><Trash2 size={14} />Xóa</button></div></td>
                  </tr>
                ))}
                {!accessUsers.length ? <tr><td colSpan={5} className="empty">Chưa tải người dùng.</td></tr> : null}
              </tbody></table></div>
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
            <div className="automationOverviewCards">
              <div><span>Lịch Automation</span><strong className={settingsDraft.automationEnabled ? 'connected' : 'disconnected'}>{settingsDraft.automationEnabled ? 'Đã bật lịch' : 'Đã tắt lịch'}</strong></div>
              <div><span>Lịch chiến dịch gần nhất</span><strong>{automationNextRunLabel}</strong></div>
              <div className={latestAutomationRun ? 'automationResultSummary' : ''}>
                <span>{automationScopeChangedSinceLastRun ? 'Phạm vi mới chưa chạy' : 'Kết quả lần chạy gần nhất'}</span>
                <strong>{latestAutomationRun ? (automationScopeChangedSinceLastRun ? 'Chưa có kết quả cho chiến dịch mới' : `${latestAutomationRun.appliedCount} áp dụng · ${latestAutomationSkippedCount} bỏ qua · ${latestAutomationRun.failedCount} lỗi`) : 'Chưa có lượt chạy'}</strong>
                {automationScopeChangedSinceLastRun && latestAutomationRun ? <small>Lần trước: {latestAutomationRun.appliedCount} áp dụng · {latestAutomationSkippedCount} bỏ qua · {latestAutomationRun.failedCount} lỗi</small> : null}
                {latestAutomationRun ? (
                  <button type="button" onClick={() => setAutomationResultOpen((open) => !open)}>
                    {automationResultOpen ? 'Ẩn chi tiết' : automationScopeChangedSinceLastRun ? 'Xem kết quả lần chạy trước' : 'Xem chi tiết lần chạy'}
                  </button>
                ) : null}
              </div>
            </div>
            {automationResultOpen && displayedAutomationRun ? (
              <div className="automationRunDetails">
                <div className="automationRunDetailsHeader">
                  <div>
                    <strong>Nhật ký các lần chạy Automation</strong>
                    <span>Chọn một lần chạy để xem prompt và kết quả của từng nhóm quảng cáo.</span>
                  </div>
                  <select aria-label="Chọn lần chạy Automation" value={displayedAutomationRun.id} onChange={(event) => setSelectedAutomationRunId(event.target.value)}>
                    {(settings?.recentAutomationRuns ?? []).map((run) => <option key={run.id} value={run.id}>{formatDate(run.startedAt)} · {automationRunStatus(run.status)}</option>)}
                  </select>
                </div>
                <div className="automationRunAuditSummary">
                  <strong>{automationRunStatus(displayedAutomationRun.status)}</strong>
                  <span>{(displayedAutomationRun.items ?? []).some((item) => item.action === 'AI_RESPONSE') ? 'AI đã trả phản hồi; xem prompt và quyết định lọc theo từng nhóm.' : (displayedAutomationRun.items ?? []).some((item) => item.action === 'AI_REQUEST') ? 'Đã tạo yêu cầu gửi AI nhưng chưa ghi nhận phản hồi.' : (displayedAutomationRun.items ?? []).some((item) => item.action === 'PROMPT') ? 'Đã tạo prompt, chưa có log yêu cầu gửi AI ở lần chạy này.' : 'Không có log gọi AI trong lần chạy này; xem lý do bỏ qua hoặc lỗi bên dưới.'}</span>
                  <span>{displayedAutomationRun.appliedCount} áp dụng · {displayedAutomationRun.failedCount} lỗi · bắt đầu {formatDate(displayedAutomationRun.startedAt)}</span>
                </div>
                {(displayedAutomationRun.items ?? []).length ? (
                  <div className="automationRunItemList">
                    {[...(displayedAutomationRun.items ?? [])]
                      .filter((item) => !['SYNC_STARTED', 'SYNC_COMPLETED', 'INPUT_SNAPSHOT', 'AI_REQUEST', 'AI_RESPONSE', 'AI_VALIDATION', 'APPLY_RESULT'].includes(item.action))
                      .sort((left, right) => Number(right.action === 'FAILED') - Number(left.action === 'FAILED'))
                      .map((item) => {
                      const failed = item.action === 'FAILED';
                      if (item.action === 'PROMPT') {
                        return (
                          <div className="automationRunItem automationPromptRunItem" key={item.id}>
                            <FileText size={17} />
                            <div>
                              <strong>Prompt AI đã đọc</strong>
                              <span>
                                {item.targetSnapshot?.campaignName ? `Chiến dịch: ${item.targetSnapshot.campaignName}` : ''}
                                {item.targetSnapshot?.adGroupName ? ` · Nhóm: ${item.targetSnapshot.adGroupName}` : ''}
                              </span>
                              <p>Bản prompt thật đã chèn dữ liệu và gửi cho AI trong lần chạy này.</p>
                            </div>
                            <button
                              className="automationPromptViewButton"
                              type="button"
                              onClick={() => setAutomationPromptLog({
                                prompt: item.reason ?? '',
                                runId: displayedAutomationRun.id,
                                campaignName: item.targetSnapshot?.campaignName ?? 'Chiến dịch',
                                adGroupName: item.targetSnapshot?.adGroupName ?? 'Nhóm quảng cáo',
                                adGroupId: item.targetSnapshot?.adGroupId ?? '',
                                runAt: displayedAutomationRun.completedAt ?? displayedAutomationRun.startedAt,
                              })}
                            >
                              Xem prompt
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className={`automationRunItem ${failed ? 'failed' : ''}`} key={item.id}>
                          <AlertCircle size={16} />
                          <div>
                            <strong>{item.targetSnapshot?.adGroupName || item.targetSnapshot?.campaignName || 'Phạm vi Automation'}</strong>
                            <span>
                              {item.targetSnapshot?.campaignName ? `Chiến dịch: ${item.targetSnapshot.campaignName}` : ''}
                              {item.targetSnapshot?.adGroupId ? ` · ID nhóm: ${item.targetSnapshot.adGroupId}` : ''}
                            </span>
                            <p>{item.reason || (failed ? 'Không thể hoàn tất xử lý nhóm quảng cáo này.' : 'Đã xử lý xong.')}</p>
                          </div>
                          <span className={`automationRunAction ${item.action.toLowerCase()}`}>{automationRunActionLabel(item.action)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="automationRunEmpty">Lần chạy này chưa lưu chi tiết xử lý.</div>
                )}
              </div>
            ) : null}
            {automationPromptLog ? (
              <div className="automationHistoryBackdrop automationPromptLogBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAutomationPromptLog(null); }}>
                <aside className="automationHistoryDrawer automationPromptLogDrawer" role="dialog" aria-modal="true" aria-label="Prompt AI đã đọc">
                  <header className="automationHistoryHeader">
                    <div>
                      <span className="eyebrow">Nhật ký lần chạy</span>
                      <h2>Kiểm tra lần chạy AI</h2>
                      <p>Đối chiếu dữ liệu đầu vào, yêu cầu gửi đi, phản hồi và kết quả áp dụng cho nhóm này.</p>
                    </div>
                    <button className="iconAction" type="button" onClick={() => setAutomationPromptLog(null)} aria-label="Đóng prompt"><X size={18} /></button>
                  </header>
                  <div className="automationHistoryDrawerBody automationPromptLogBody">
                    <div className="automationPromptLogMeta">
                      <div><span>Chiến dịch</span><strong>{automationPromptLog.campaignName}</strong></div>
                      <div><span>Nhóm quảng cáo</span><strong>{automationPromptLog.adGroupName}</strong><small>{automationPromptLog.adGroupId ? `ID ${automationPromptLog.adGroupId}` : ''}</small></div>
                      <div><span>Thời điểm chạy</span><strong>{formatDate(automationPromptLog.runAt)}</strong></div>
                    </div>
                    <section className="automationAiStory" aria-label="AI đã chạy như thế nào">
                      <header><span>{automationRunAudit.response ? 'ĐÃ CHẠY AI' : 'CHƯA XÁC NHẬN PHẢN HỒI AI'}</span><h3>AI đã làm gì trong lần này?</h3></header>
                      <article>
                        <div className="automationAiStoryNumber">1</div>
                        <div><strong>AI được giao việc gì?</strong><p>Viết lại {automationRunAudit.input?.candidates?.length ?? automationPromptExplanation.candidates.length} nội dung hiệu quả thấp của nhóm <b>{automationPromptLog.adGroupName}</b> bằng <b>{String(automationPromptExplanation.context.targetLanguageName || automationPromptExplanation.candidates[0]?.targetLanguage || 'ngôn ngữ đã cấu hình')}</b>, chủ đề <b>{String(automationPromptExplanation.context.automationTopic || 'chưa cấu hình')}</b>.</p>
                          {(automationRunAudit.input?.candidates ?? []).map((item) => <div className="automationAiCopyRow" key={item.key}><span>{item.fieldType === 'HEADLINE' ? 'Tiêu đề cũ' : 'Mô tả cũ'}</span><b dir="auto">{item.text}</b><small>{item.impressions} hiển thị · {item.clicks} nhấp</small></div>)}
                        </div>
                      </article>
                      <article>
                        <div className="automationAiStoryNumber">2</div>
                        <div><strong>AI trả lời như thế nào?</strong>{automationRunAudit.response ? <p>AI đã trả lời. Sau kiểm tra có <b>{automationRunAudit.validation?.accepted?.length ?? 0} câu đạt</b> và <b>{(automationRunAudit.validation?.rejected?.length ?? 0) + (automationRunAudit.validation?.missing?.length ?? 0)} câu không được chọn</b>.</p> : <p>Lần chạy này chưa có phản hồi AI được lưu. Nếu trạng thái là SKIPPED thì AI chưa được gọi.</p>}
                          {automationRunAudit.validation?.accepted?.map((item) => <div className="automationAiDecision accepted" key={item.key}><span>ĐƯỢC CHỌN</span><p><del dir="auto">{item.oldText}</del><b dir="auto">{item.newText}</b></p></div>)}
                          {automationRunAudit.validation?.rejected?.map((item, index) => <div className="automationAiDecision rejected" key={`${item.key}-${index}`}><span>BỊ LOẠI · {item.reason}</span><b dir="auto">{item.proposedText || item.oldText}</b></div>)}
                        </div>
                      </article>
                      <article>
                        <div className="automationAiStoryNumber">3</div>
                        <div><strong>Hệ thống đã làm gì?</strong><p>{automationRunAudit.apply ? `Đã gửi ${automationRunAudit.apply.appliedCount} thay đổi lên Google Ads.` : automationPromptRunItems.some((item) => item.action === 'SUGGESTED') ? 'Đã tạo yêu cầu thay đổi và đang chờ duyệt.' : 'Không có nội dung nào được áp dụng trong lần này.'}</p>
                          {automationPromptRunItems.filter((item) => ['FAILED', 'SKIPPED'].includes(item.action)).map((item) => <div className="automationAiRunNote" key={item.id}>{automationRunActionLabel(item.action)}: {item.reason}</div>)}
                        </div>
                      </article>
                    </section>
                    <details className="automationTechnicalAudit">
                      <summary>Xem prompt đầy đủ và chi tiết kỹ thuật</summary>
                    <div className="automationPromptLogToolbar">
                      <div><strong>{automationPromptRaw ? 'Prompt nghiệp vụ thô' : 'Prompt nghiệp vụ đã phân nhóm'}</strong><span>Văn bản trước khi gắn schema đầu ra; payload thực gửi AI nằm ở bước 2 bên trên.</span></div>
                      <div className="automationPromptLogActions">
                        <button type="button" onClick={() => setAutomationPromptRaw((current) => !current)}>{automationPromptRaw ? 'Xem trình bày' : 'Xem bản thô'}</button>
                        <button type="button" onClick={() => void navigator.clipboard.writeText(automationPromptLog.prompt)}><Clipboard size={15} /> Sao chép</button>
                      </div>
                    </div>
                    {automationPromptRaw ? (
                      <pre className="automationPromptLogContent">{automationPromptLog.prompt}</pre>
                    ) : (
                      <div className="automationPromptReport">
                        <section className="automationResolvedTemplate">
                          <header>
                            <span>PROMPT NGHIỆP VỤ — DỮ LIỆU THẬT KHI CHẠY</span>
                            <small>Các biến trong mẫu đã được thay bằng giá trị AI thực sự nhận.</small>
                          </header>
                          <div className="automationResolvedCommon">
                            <p><span>Chiến dịch:</span><strong>{String(automationPromptExplanation.context.campaignName || automationPromptLog.campaignName)}</strong><code>{'{{campaign_name}}'}</code></p>
                            <p><span>Nhóm quảng cáo:</span><strong>{String(automationPromptExplanation.context.adGroupName || automationPromptLog.adGroupName)}</strong><code>{'{{ad_group_name}}'}</code></p>
                            <p><span>Ngôn ngữ:</span><strong>{String(automationPromptExplanation.context.targetLanguageName || automationPromptExplanation.candidates[0]?.targetLanguage || '—')} ({String(automationPromptExplanation.context.targetLanguageCode || automationPromptExplanation.candidates[0]?.targetLanguageCode || '—')})</strong><code>{'{{language}}'}</code></p>
                            <p><span>Chủ đề:</span><strong>{String(automationPromptExplanation.context.automationTopic || 'Chưa cấu hình')}</strong><code>{'{{topic}}'}</code></p>
                          </div>
                          <div className="automationResolvedCandidates">
                            <strong>DỮ LIỆU ĐỘNG ĐƯỢC CHÈN CHO TừNG NỘI DUNG LOW</strong>
                            {automationPromptExplanation.candidates.map((candidate, index) => (
                              <article key={candidate.key || index}>
                                <div><span>LOW candidate #{index + 1}</span><em>{candidate.fieldType === 'HEADLINE' ? 'Tiêu đề' : 'Mô tả'}</em></div>
                                <p><span>Loại nội dung:</span><strong>{candidate.fieldType === 'HEADLINE' ? 'HEADLINE — Tiêu đề' : 'DESCRIPTION — Mô tả'}</strong><code>{'{{field_type}}'}</code></p>
                                <p><span>Nội dung LOW hiện tại:</span><strong dir="auto">{candidate.currentText || '—'}</strong><code>{'{{old_text}}'}</code></p>
                                <p><span>Giới hạn ký tự:</span><strong>{candidate.maxLength ?? '—'} ký tự</strong><code>{'{{max_length}}'}</code></p>
                                <p><span>Số liệu hiệu suất:</span><strong>{Number(candidate.impressions ?? 0).toLocaleString('vi-VN')} hiển thị · {Number(candidate.clicks ?? 0).toLocaleString('vi-VN')} nhấp · CTR {(Number(candidate.ctr ?? 0) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}% · ROAS {(Number(candidate.roas ?? 0) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%</strong><code>{'{{performance_metrics}}'}</code></p>
                              </article>
                            ))}
                          </div>
                          <div className="automationResolvedReferences">
                            <p><span>Nội dung hiện có để tránh trùng:</span><strong>{(automationPromptExplanation.existingCopy.headlines?.length ?? 0) + (automationPromptExplanation.existingCopy.descriptions?.length ?? 0)} nội dung</strong><code>{'{{existing_ad_copy}}'}</code></p>
                            <p><span>Lịch sử đề xuất:</span><strong>{(automationPromptExplanation.history.approved?.length ?? 0) + (automationPromptExplanation.history.rejected?.length ?? 0) + (automationPromptExplanation.history.applied?.length ?? 0)} nội dung</strong><code>{'{{suggestion_history}}'}</code></p>
                            <p><span>Quy tắc từ khóa và từ cấm:</span><strong>{Object.keys(automationPromptExplanation.policy.terms && typeof automationPromptExplanation.policy.terms === 'object' ? automationPromptExplanation.policy.terms as object : {}).length} nhóm quy tắc</strong><code>{'{{creative_policy_terms}}'}</code></p>
                          </div>
                          <footer><strong>OUTPUT CONTRACT — KHÔNG THỂ CHỈNH</strong><span>AI phải trả về JSON gồm summary và suggestions, khớp đúng candidate key.</span></footer>
                        </section>
                        <div className="automationPromptReadingSummary">
                          <span>AI HIỂU YÊU CẦU NHƯ SAU</span>
                          <strong>
                            Tạo nội dung thay thế cho {automationPromptExplanation.candidates.length} tài nguyên LOW bằng{' '}
                            {String(automationPromptExplanation.context.targetLanguageName || automationPromptExplanation.candidates[0]?.targetLanguage || 'ngôn ngữ đã nhận diện')},
                            không trùng nội dung cũ và tuân thủ giới hạn Google Ads.
                          </strong>
                        </div>

                        <section className="automationPromptValueSection">
                          <header><span>1</span><div><strong>Phạm vi AI đang xử lý</strong><small>Các giá trị thật được chèn khi bấm chạy.</small></div></header>
                          <div className="automationPromptValueGrid">
                            <div><span>Tài khoản Google Ads</span><strong>{String(automationPromptExplanation.context.customerId || '—')}</strong></div>
                            <div><span>Chiến dịch</span><strong>{String(automationPromptExplanation.context.campaignName || automationPromptLog.campaignName)}</strong></div>
                            <div><span>Nhóm quảng cáo</span><strong>{String(automationPromptExplanation.context.adGroupName || automationPromptLog.adGroupName)}</strong><small>ID {String(automationPromptExplanation.context.adGroupId || automationPromptLog.adGroupId || '—')}</small></div>
                            <div className="language"><span>Ngôn ngữ AI phải viết</span><strong>{String(automationPromptExplanation.context.targetLanguageName || automationPromptExplanation.candidates[0]?.targetLanguage || '—')} ({String(automationPromptExplanation.context.targetLanguageCode || automationPromptExplanation.candidates[0]?.targetLanguageCode || '—')})</strong><small>Độ tin cậy: {String(automationPromptExplanation.context.targetLanguageConfidence || '—')}</small></div>
                            <div><span>Chủ đề</span><strong>{String(automationPromptExplanation.context.automationTopic || 'Chưa cấu hình')}</strong></div>
                            <div><span>Khoảng dữ liệu</span><strong>{String(automationPromptExplanation.context.timeRange || '—')}</strong></div>
                          </div>
                        </section>

                        <section className="automationPromptValueSection">
                          <header><span>2</span><div><strong>Nội dung LOW AI nhận được</strong><small>Mỗi dòng là một nội dung AI phải viết thay thế.</small></div></header>
                          <div className="automationPromptCandidateList">
                            {automationPromptExplanation.candidates.map((candidate, index) => (
                              <article key={candidate.key || index}>
                                <div className="automationPromptCandidateIndex">{index + 1}</div>
                                <div className="automationPromptCandidateText"><span>{candidate.fieldType === 'HEADLINE' ? 'TIÊU ĐỀ' : 'MÔ TẢ'} HIỆN TẠI</span><strong dir="auto">{candidate.currentText || '—'}</strong></div>
                                <div><span>Ngôn ngữ</span><strong>{candidate.targetLanguage || candidate.sourceLanguage || '—'}</strong></div>
                                <div><span>Giới hạn</span><strong>{candidate.maxLength ?? '—'} ký tự</strong></div>
                                <div><span>Hiển thị / Nhấp</span><strong>{Number(candidate.impressions ?? 0).toLocaleString('vi-VN')} / {Number(candidate.clicks ?? 0).toLocaleString('vi-VN')}</strong></div>
                                <div><span>CTR / ROAS</span><strong>{(Number(candidate.ctr ?? 0) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}% / {(Number(candidate.roas ?? 0) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%</strong></div>
                              </article>
                            ))}
                            {!automationPromptExplanation.candidates.length ? <p className="automationPromptNoData">Log cũ không tách được danh sách LOW. Hãy xem bản thô để đối chiếu.</p> : null}
                          </div>
                        </section>

                        <section className="automationPromptValueSection">
                          <header><span>3</span><div><strong>Dữ liệu AI dùng để tránh trùng</strong><small>AI được yêu cầu không lặp lại các nội dung này.</small></div></header>
                          <div className="automationPromptAvoidGrid">
                            <div><span>Tiêu đề hiện có ({automationPromptExplanation.existingCopy.headlines?.length ?? 0})</span>{(automationPromptExplanation.existingCopy.headlines ?? []).map((text, index) => <p dir="auto" key={index}>{text}</p>)}</div>
                            <div><span>Mô tả hiện có ({automationPromptExplanation.existingCopy.descriptions?.length ?? 0})</span>{(automationPromptExplanation.existingCopy.descriptions ?? []).map((text, index) => <p dir="auto" key={index}>{text}</p>)}</div>
                            <div><span>Lịch sử đã áp dụng ({automationPromptExplanation.history.applied?.length ?? 0})</span>{(automationPromptExplanation.history.applied ?? []).map((text, index) => <p dir="auto" key={index}>{text}</p>)}</div>
                          </div>
                        </section>

                        <details className="automationPromptRuleDetails">
                          <summary>4. Xem các quy tắc AI phải tuân thủ</summary>
                          <div className="automationPromptSections">
                            {automationPromptSections.map((section, index) => (
                              <section className="automationPromptSection" key={`${section.title}-${index}`}>
                                <header><strong>{section.title.toLocaleUpperCase('vi-VN')}</strong></header>
                                <pre>{presentLegacyPromptRules(section.title, section.content)}</pre>
                              </section>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                    </details>
                  </div>
                </aside>
              </div>
            ) : null}
            {(!hasAutomationTarget || automationScopeDirty) ? <div className={`automationNextStep ${automationScopeDirty ? 'warning' : ''}`}>
              <div>
                <span>Bước tiếp theo</span>
                <strong>
                  {!selectedAutomationCampaignIds.length
                    ? 'Chọn chiến dịch cần Automation'
                    : automationScopeDirty
                      ? 'Lưu các thay đổi phạm vi'
                      : !hasAutomationTarget
                        ? 'Chọn toàn bộ chiến dịch hoặc ít nhất một nhóm quảng cáo'
                        : settingsDraft.automationEnabled
                          ? `Không cần thao tác · lượt tiếp theo ${formatNextRunDate(settings.schedule?.nextRunAt)}`
                          : 'Phạm vi đã sẵn sàng · bạn có thể chạy ngay'}
                </strong>
                <small>
                  {!selectedAutomationCampaignIds.length
                    ? 'Lưu phạm vi không chạy AI và không thay đổi Google Ads.'
                    : automationScopeDirty
                      ? 'Các lựa chọn hiện tại mới chỉ nằm trên màn hình, chưa được lưu.'
                      : !hasAutomationTarget
                        ? 'Automation sẽ không chạy nếu chưa có nhóm quảng cáo hợp lệ.'
                        : settingsDraft.automationEnabled
                          ? 'Lịch đang bật; hệ thống chỉ xử lý đúng phạm vi đã lưu.'
                          : 'Chạy ngay sẽ áp dụng trực tiếp lên Google Ads và đồng thời bật lịch.'}
                </small>
              </div>
              {automationScopeDirty ? (
                <button className="primaryButton" type="button" disabled={automationScopeSaving} onClick={() => void saveAutomationScope()}><Save size={15} />{automationScopeSaving ? 'Đang lưu...' : 'Lưu thay đổi ngay'}</button>
              ) : null}
            </div> : null}
            <div className="sectionTitle">
              <div>
                <h2 aria-label="1. Phạm vi chạy"><span className="stepNumber" aria-hidden="true">1</span>Phạm vi chạy</h2>
                <p>Chọn chiến dịch và nhóm quảng cáo mà Automation được phép xử lý.</p>
              </div>
              <div className="automationHeaderActions">
                <span>{selectedAutomationCampaignIds.length} chiến dịch đã chọn</span>
                <button className="primaryButton" type="button" onClick={() => { setAutomationAddOpen(true); setAutomationAddSearch(''); }}>
                  <Plus size={15} />
                  Thêm chiến dịch
                </button>
              </div>
            </div>
            <div className="automationCampaignToolbar">
              <label className="searchBox">
                <Search size={16} />
                <input
                  type="search"
                  value={automationCampaignSearch}
                  placeholder="Tìm theo tên hoặc ID chiến dịch"
                  aria-label="Tìm kiếm chiến dịch Automation"
                  onChange={(event) => setAutomationCampaignSearch(event.target.value)}
                />
              </label>
              <span>{filteredAutomationCampaigns.length} chiến dịch đã chọn</span>
            </div>
            {settings.automationScope?.campaigns.length ? (
              <div className="automationScopeTree">
                {filteredAutomationCampaigns.map((campaign) => {
                  const campaignSelected = selectedAutomationCampaignIds.includes(campaign.id);
                  const campaignRunsAll = allAutomationCampaignIds.includes(campaign.id);
                  const knownAdGroupIds =
                    automationCampaignDetail?.campaign.id === campaign.id
                      ? automationCampaignDetail.adGroups.map((adGroup) => adGroup.id)
                      : campaign.selectedAdGroupIds;
                  const selectedChildren = knownAdGroupIds.filter((id) =>
                    selectedAutomationAdGroupIds.includes(id),
                  ).length;
                  const runSummary = automationCampaignRunSummaryById.get(campaign.id);
                  const changeHistory = automationChangeHistoryByCampaignId.get(campaign.id) ?? [];
                  const runSummaryTone = !runSummary
                    ? 'pending'
                    : runSummary.status === 'RUNNING'
                      ? 'running'
                      : runSummary.failedCount > 0 || runSummary.status === 'FAILED' || runSummary.status === 'PARTIAL'
                        ? 'failed'
                        : 'completed';
                  return (
                    <article className="automationScopeCampaign automationCampaignCard" key={campaign.id}>
                      <header className="automationCampaignCardHeader">
                        <div className="automationScopeCampaignMain">
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
                            <small>
                              ID {campaign.id} · {automationEntityStatus(campaign.status)}
                            </small>
                          </span>
                        </label>
                        </div>
                        <div className="automationCampaignCardActions">
                          <button
                            className="secondaryButton"
                            type="button"
                            onClick={() => setAutomationHistoryCampaignId(campaign.id)}
                          >
                            <History size={14} />
                            Lịch sử {changeHistory.length ? `(${changeHistory.length})` : ''}
                          </button>
                          <button className="secondaryButton" type="button" onClick={() => { setAutomationCampaignLogId(campaign.id); setAutomationCampaignLogRunId(''); }}>
                            <FileText size={14} /> Nhật ký AI
                          </button>
                          <button
                            className="secondaryButton"
                            type="button"
                            disabled={automationCampaignLoadingId === campaign.id}
                            onClick={() => void loadAutomationCampaign(campaign.id)}
                          >
                            {automationCampaignLoadingId === campaign.id ? 'Đang tải...' : 'Xem và chọn nhóm'}
                          </button>
                          <button
                            className="primaryButton"
                            type="button"
                            disabled={automationScopeDirty || automationRunning || automationRunInProgress || !canRunPeriodicAi || !campaignSelected || campaign.automationEnabled === false || (!campaignRunsAll && selectedChildren === 0)}
                            onClick={() => void runAutomationNow(campaign.id, campaign.name)}
                          >
                            <Play size={14} />
                            {automationRunningCampaignId === campaign.id ? 'Đang chạy...' : 'Chạy ngay'}
                          </button>
                          <button
                            className={`secondaryButton${campaign.automationEnabled === false ? '' : ' warningButton'}`}
                            type="button"
                            disabled={automationScopeSaving || !canManageAutomationScope}
                            onClick={() => void updateAutomationCampaignStatus(campaign, campaign.automationEnabled === false ? 'RESUME' : 'PAUSE')}
                          >
                            {campaign.automationEnabled === false ? <Play size={14} /> : <Pause size={14} />}
                            {campaign.automationEnabled === false ? 'Bật lại lịch' : 'Dừng lịch'}
                          </button>
                          <button
                            className="secondaryButton dangerButton"
                            type="button"
                            disabled={automationScopeSaving || !canManageAutomationScope}
                            onClick={() => void updateAutomationCampaignStatus(campaign, 'REMOVE')}
                          >
                            <Trash2 size={14} />
                            Bỏ Automation
                          </button>
                        </div>
                      </header>
                      <div className="automationCampaignInfoGrid">
                        <div>
                          <span>Phạm vi xử lý</span>
                          <strong>{campaignRunsAll ? `Toàn bộ ${campaign.adGroupCount} nhóm` : `${selectedChildren}/${campaign.adGroupCount} nhóm đã chọn`}</strong>
                        </div>
                        <div>
                          <span>Chu kỳ riêng</span>
                          <label className="automationCampaignInterval">
                            <input
                              type="number"
                              min="1"
                              max="365"
                              value={automationCampaignIntervals[campaign.id] || campaign.intervalDays || 14}
                              disabled={!canManageAutomationScope}
                              onChange={(event) => setAutomationCampaignIntervals((current) => ({
                                ...current,
                                [campaign.id]: Math.min(365, Math.max(1, Number(event.target.value) || 1)),
                              }))}
                            />
                            <span>ngày/lần</span>
                          </label>
                        </div>
                        <div>
                          <span>Trạng thái gần nhất</span>
                          <strong className={`automationCampaignRunStatus ${runSummaryTone}`}>
                            {runSummary ? automationRunStatus(runSummary.status) : 'Chưa chạy'}
                          </strong>
                        </div>
                        <div>
                          <span>Lần chạy gần nhất</span>
                          <strong>{runSummary ? formatDate(runSummary.runAt) : 'Chưa có'}</strong>
                        </div>
                        <div>
                          <span>Kết quả lần gần nhất</span>
                          <strong>{runSummary ? `${runSummary.appliedCount} áp dụng · ${runSummary.skippedCount} bỏ qua · ${runSummary.failedCount} lỗi` : 'Chưa có kết quả'}</strong>
                        </div>
                        <div className="automationCampaignNextRun">
                          <span>Lịch tiếp theo</span>
                          <strong>
                            {campaign.automationEnabled === false
                              ? 'Đã dừng riêng chiến dịch'
                              : !settingsDraft.automationEnabled
                              ? 'Lịch đang tắt'
                              : automationScopeDirty
                                ? 'Lưu thay đổi để lên lịch'
                                : campaign.nextRunAt
                                  ? formatNextRunDate(campaign.nextRunAt)
                                  : 'Chưa có lịch riêng — cần cập nhật backend'}
                          </strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!filteredAutomationCampaigns.length ? (
                  <div className="empty">Chưa chọn chiến dịch nào trong phạm vi Automation. Bấm “Thêm chiến dịch” để thiết lập.</div>
                ) : null}
              </div>
            ) : (
              <div className="empty">
                Chưa có chiến dịch trong PostgreSQL. Hãy đồng bộ dữ liệu Google Ads trước khi cấu hình Automation.
              </div>
            )}
            {automationHistoryCampaign ? (
              <div
                className="automationHistoryBackdrop"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setAutomationHistoryCampaignId('');
                }}
              >
                <aside className="automationHistoryDrawer" role="dialog" aria-modal="true" aria-label={`Lịch sử thay đổi của ${automationHistoryCampaign.name}`}>
                  <header className="automationHistoryHeader">
                    <div>
                      <span className="eyebrow">Lịch sử Automation</span>
                      <h2>{automationHistoryCampaign.name}</h2>
                      <p>ID {automationHistoryCampaign.id} · {activeAutomationChangeHistory.length} nội dung đã thay</p>
                    </div>
                    <button className="iconAction" type="button" onClick={() => setAutomationHistoryCampaignId('')} aria-label="Đóng lịch sử"><X size={18} /></button>
                  </header>
                  <div className="automationHistoryDrawerBody">
                    {activeAutomationChangeHistory.length ? (
                      <div className="automationChangeHistoryList">
                        {activeAutomationChangeHistory.map((change) => (
                          <article key={change.id}>
                            <header>
                              <strong>{change.fieldType === 'HEADLINE' ? 'Tiêu đề' : change.fieldType === 'DESCRIPTION' ? 'Mô tả' : 'Nội dung'}</strong>
                              <span>{change.adGroupName} · {formatDate(change.changedAt)}</span>
                            </header>
                            <div className="before"><span>Cũ</span><p>{change.oldText}</p></div>
                            <div className="changed"><span>Mới</span><p>{change.newText}</p></div>
                          </article>
                        ))}
                      </div>
                    ) : <div className="automationHistoryEmpty"><History size={28} /><strong>Chưa có nội dung đã thay</strong><p>Chiến dịch này chưa có tiêu đề hoặc mô tả được AI áp dụng trong 5 lần chạy gần nhất.</p></div>}
                  </div>
                </aside>
              </div>
            ) : null}
            {automationCampaignLogId ? (
              <div className="automationHistoryBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAutomationCampaignLogId(''); }}>
                <aside className="automationHistoryDrawer automationCampaignLogDrawer" role="dialog" aria-modal="true" aria-label="Nhật ký AI của chiến dịch">
                  <header className="automationHistoryHeader">
                    <div><span className="eyebrow">Nhật ký Automation</span><h2>{automationCampaigns.find((campaign) => campaign.id === automationCampaignLogId)?.name ?? 'Chiến dịch'}</h2><p>Mỗi lần chạy được lưu riêng. AI chỉ có prompt khi nhóm quảng cáo có nội dung LOW.</p></div>
                    <button className="iconAction" type="button" onClick={() => setAutomationCampaignLogId('')} aria-label="Đóng nhật ký AI"><X size={18} /></button>
                  </header>
                  <div className="automationHistoryDrawerBody automationCampaignLogBody">
                    {automationCampaignLogRuns.length ? <label className="automationCampaignLogPicker"><span>Lần chạy</span><select value={automationCampaignLogRun?.id ?? ''} onChange={(event) => setAutomationCampaignLogRunId(event.target.value)}>{automationCampaignLogRuns.map((run) => <option key={run.id} value={run.id}>{formatDate(run.startedAt)} · {automationRunStatus(run.status)}</option>)}</select></label> : null}
                    {automationCampaignLogRun ? <div className="automationCampaignLogSummary"><strong>{automationRunStatus(automationCampaignLogRun.status)}</strong><span>{(automationCampaignLogRun.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && item.action === 'AI_RESPONSE') ? 'AI đã trả phản hồi.' : (automationCampaignLogRun.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && item.action === 'AI_REQUEST') ? 'Đã tạo yêu cầu gọi AI nhưng chưa có phản hồi.' : 'Không có phản hồi AI được ghi cho chiến dịch trong lần này.'}</span></div> : null}
                    {automationCampaignLogRun ? <div className="automationCampaignRunFlow">
                      <div className={(automationCampaignLogRun.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && item.action === 'SYNC_COMPLETED') ? 'done' : ''}><b>1</b><span><strong>Đồng bộ Google Ads</strong><small>{(automationCampaignLogRun.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && item.action === 'SYNC_COMPLETED') ? 'Đã hoàn tất' : 'Log cũ không ghi nhận'}</small></span></div>
                      <div className={(automationCampaignLogRun.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && item.action === 'PROMPT') ? 'done' : 'stopped'}><b>2</b><span><strong>Tạo và gửi prompt</strong><small>{(automationCampaignLogRun.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && item.action === 'PROMPT') ? 'Đã tạo prompt cho AI' : 'Dừng trước bước gọi AI'}</small></span></div>
                      <div className={(automationCampaignLogRun.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && item.action === 'AI_RESPONSE') ? 'done' : 'stopped'}><b>3</b><span><strong>Nhận và áp dụng</strong><small>{(automationCampaignLogRun.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && item.action === 'AI_RESPONSE') ? 'Đã nhận phản hồi AI' : 'Không có phản hồi AI'}</small></span></div>
                    </div> : null}
                    {automationCampaignLogRun ? (automationCampaignLogRun.items ?? []).filter((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && !['SYNC_STARTED', 'SYNC_COMPLETED', 'INPUT_SNAPSHOT', 'AI_REQUEST', 'AI_RESPONSE', 'AI_VALIDATION', 'APPLY_RESULT'].includes(item.action)).map((item) => <article className="automationCampaignLogEntry" key={item.id}>
                      <div><strong>{item.targetSnapshot?.adGroupName ?? 'Chiến dịch'}</strong><small>{formatDate(item.createdAt)} · {automationRunActionLabel(item.action)}</small></div>
                      {item.action === 'PROMPT' ? <button className="automationPromptViewButton" type="button" onClick={() => { setAutomationCampaignLogId(''); setAutomationPromptLog({ prompt: item.reason ?? '', runId: automationCampaignLogRun.id, campaignName: item.targetSnapshot?.campaignName ?? 'Chiến dịch', adGroupName: item.targetSnapshot?.adGroupName ?? 'Nhóm quảng cáo', adGroupId: item.targetSnapshot?.adGroupId ?? '', runAt: item.createdAt }); }}>Xem AI đã đọc và trả lời</button> : <p>{explainAutomationReason(item.reason)}</p>}
                    </article>) : <div className="automationHistoryEmpty"><FileText size={28} /><strong>Chưa có nhật ký AI</strong><p>Chiến dịch này chưa xuất hiện trong các lần chạy gần đây.</p></div>}
                    {automationCampaignLogRun && !(automationCampaignLogRun.items ?? []).some((item) => item.targetSnapshot?.campaignId === automationCampaignLogId && item.action === 'PROMPT') ? <div className="automationCampaignLogNoPrompt"><strong>Vì sao không có prompt?</strong><span>Hệ thống đã kiểm tra dữ liệu nhưng không có nội dung phù hợp để giao cho AI. Đây không phải lỗi AI.</span></div> : null}
                  </div>
                </aside>
              </div>
            ) : null}
            {automationPromptOpen ? (
              <div className="automationHistoryBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAutomationPromptOpen(false); }}>
                <aside className="automationPromptDrawer" role="dialog" aria-modal="true" aria-label="Chỉnh Prompt nghiệp vụ">
                  <header className="automationHistoryHeader">
                    <div><span className="eyebrow">Automation AI</span><h2>Prompt nghiệp vụ</h2><p>Tùy chỉnh mục tiêu, bố cục và giọng văn. Quy tắc an toàn của hệ thống vẫn được giữ nguyên.</p></div>
                    <button className="iconAction" type="button" onClick={() => setAutomationPromptOpen(false)} aria-label="Đóng trình chỉnh prompt"><X size={18} /></button>
                  </header>
                  <div className="automationPromptBody">
                    <div className="automationFullPromptNotice"><strong>Phần trên mọi người dùng đều có thể chỉnh</strong><span>Phần Prompt nghiệp vụ, dữ liệu động và Output Contract bên dưới luôn bị khóa.</span></div>
                    <label className="automationFullPrompt">
                      <span>Vai trò, nhiệm vụ và quy tắc có thể chỉnh</span>
                      <textarea value={settingsDraft.editableSystemPrompt} onChange={(event) => setSettingsDraft((current) => ({ ...current, editableSystemPrompt: event.target.value }))} maxLength={8000} aria-label="Phần System Prompt có thể chỉnh" autoFocus />
                    </label>
                    <label className="automationFullPrompt locked">
                      <span>Phần mặc định bị khóa</span>
                      <textarea value={lockedAutomationPromptPreview} readOnly aria-label="Prompt nghiệp vụ, dữ liệu động và Output Contract chỉ đọc" />
                    </label>
                  </div>
                  <footer className="automationPromptFooter">
                    <button className="secondaryButton" type="button" onClick={() => setSettingsDraft((current) => ({ ...current, editableSystemPrompt: DEFAULT_EDITABLE_SYSTEM_PROMPT }))}>Khôi phục phần trên</button>
                    <div><span>{settingsDraft.editableSystemPrompt.length}/8000</span><button className="primaryButton" type="button" disabled={automationPromptSaving} onClick={() => void saveAutomationBusinessPrompt()}><Save size={15} />{automationPromptSaving ? 'Đang lưu...' : 'Lưu Prompt'}</button></div>
                  </footer>
                </aside>
              </div>
            ) : null}
            {automationAddOpen ? (
              <div className="automationAddBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAutomationAddOpen(false); }}>
                <aside className="automationAddDrawer" role="dialog" aria-modal="true" aria-label="Thêm chiến dịch vào phạm vi Automation">
                  <div className="automationAddHeader">
                    <div><h2>Thêm chiến dịch</h2><p>Chọn chiến dịch, sau đó xác định nhóm quảng cáo được phép chạy.</p></div>
                    <button className="iconAction" type="button" onClick={() => setAutomationAddOpen(false)} aria-label="Đóng"><X size={17} /></button>
                  </div>
                  <label className="searchBox automationAddSearch">
                    <Search size={16} />
                    <input type="search" value={automationAddSearch} placeholder="Tìm theo tên hoặc ID chiến dịch" aria-label="Tìm chiến dịch để thêm" onChange={(event) => setAutomationAddSearch(event.target.value)} autoFocus />
                  </label>
                  <div className="automationAddSummary">
                    <span>{availableAutomationCampaigns.length} chiến dịch khả dụng</span>
                    <strong>Đã chọn {pendingAutomationAdditions}</strong>
                  </div>
                  <div className="automationAddList">
                    {availableAutomationCampaigns.map((campaign) => {
                      const selected = selectedAutomationCampaignIds.includes(campaign.id);
                      return (
                        <div className={`automationAddRow${selected ? ' selected' : ''}`} key={campaign.id}>
                          <label aria-label={selected ? `Bỏ chọn chiến dịch ${campaign.name}` : `Xem nhóm quảng cáo trước khi chọn chiến dịch ${campaign.name}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={!canManageAutomationScope}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  void loadAutomationCampaign(campaign.id);
                                } else {
                                  toggleAutomationCampaign(campaign.id, false);
                                }
                              }}
                            />
                            <span><strong>{campaign.name}</strong><small>ID {campaign.id} · Đang hoạt động</small></span>
                          </label>
                          <span className="automationAddGroupCount">{campaign.adGroupCount} nhóm</span>
                          <button className="tableActionButton" type="button" disabled={automationCampaignLoadingId === campaign.id} onClick={() => void loadAutomationCampaign(campaign.id)}>{selected ? 'Chỉnh nhóm' : 'Chọn nhóm'}</button>
                        </div>
                      );
                    })}
                    {!availableAutomationCampaigns.length ? <div className="empty">Không tìm thấy chiến dịch khả dụng.</div> : null}
                  </div>
                  <div className="automationAddFooter">
                    <span>{pendingAutomationAdditions ? `${pendingAutomationAdditions} chiến dịch đang chọn` : 'Chưa chọn chiến dịch'}</span>
                    <div><button className="secondaryButton" type="button" onClick={() => setAutomationAddOpen(false)}>Hủy</button><button className="primaryButton" type="button" disabled={!pendingAutomationAdditions || automationScopeSaving} onClick={() => void saveAutomationScope()}><Save size={15} />{automationScopeSaving ? 'Đang lưu...' : `Lưu lựa chọn (${pendingAutomationAdditions})`}</button></div>
                  </div>
                </aside>
              </div>
            ) : null}
            {automationCampaignLoadingId ? (
              <div className="automationCampaignDetailBackdrop" role="presentation">
                <div className="automationCampaignDetail automationCampaignLoading" role="status" aria-live="polite">
                  <strong>Đang tải nhóm quảng cáo...</strong>
                  <span>Hệ thống đang lấy danh sách nhóm quảng cáo và hiệu quả 14 ngày của chiến dịch.</span>
                </div>
              </div>
            ) : null}
            {automationCampaignDetail ? (
              <div
                className="automationCampaignDetailBackdrop"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setAutomationCampaignDetail(null);
                  }
                }}
              >
              <div
                className="automationCampaignDetail"
                role="dialog"
                aria-modal="true"
                aria-label={`Chọn nhóm quảng cáo cho ${automationCampaignDetail.campaign.name}`}
              >
                <div className="sectionTitle">
                  <div>
                    <h3>Chọn nhóm quảng cáo</h3>
                    <p>{automationCampaignDetail.campaign.name} · Automation chỉ chạy theo lựa chọn bên dưới.</p>
                  </div>
                  <button
                    className="iconAction"
                    type="button"
                    aria-label="Đóng danh sách nhóm quảng cáo"
                    onClick={() => setAutomationCampaignDetail(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="automationMetrics">
                  <div><span>Lượt hiển thị</span><strong>{automationCampaignDetail.campaign.metricsAvailable ? formatCompactNumber(automationCampaignDetail.campaign.metrics.impressions) : '—'}</strong></div>
                  <div><span>Lượt nhấp</span><strong>{automationCampaignDetail.campaign.metricsAvailable ? formatCompactNumber(automationCampaignDetail.campaign.metrics.clicks) : '—'}</strong></div>
                  <div><span>CTR</span><strong>{automationCampaignDetail.campaign.metricsAvailable ? formatAutomationPercent(automationCampaignDetail.campaign.metrics.ctr) : '—'}</strong></div>
                  <div><span>Chi phí</span><strong>{automationCampaignDetail.campaign.metricsAvailable ? formatAutomationMoney(automationCampaignDetail.campaign.metrics.cost, settings.account.currencyCode) : '—'}</strong></div>
                  <div><span>Chuyển đổi</span><strong>{automationCampaignDetail.campaign.metricsAvailable ? formatCompactNumber(automationCampaignDetail.campaign.metrics.conversions) : '—'}</strong></div>
                  <div title="Giá trị chuyển đổi chia cho chi phí quảng cáo"><span>ROAS</span><strong>{automationCampaignDetail.campaign.metricsAvailable ? formatAutomationPercent(automationCampaignDetail.campaign.metrics.roas) : '—'}</strong></div>
                </div>
                <div className={`automationMissingMetrics${automationCampaignDetail.campaign.metricsAvailable ? ' synced' : ''}`}>
                    <div>
                      <strong>{automationCampaignDetail.campaign.syncStatus === 'FAILED' ? 'Đồng bộ số liệu không thành công' : automationCampaignDetail.campaign.metricsAvailable ? 'Số liệu hiệu suất 14 ngày' : automationCampaignDetail.campaign.checkedAdGroupCount > 0 ? 'Đã kiểm tra · Chưa phát sinh dữ liệu' : 'Chưa kiểm tra số liệu hiệu suất'}</strong>
                      <span>{automationCampaignDetail.campaign.syncStatus === 'FAILED' ? 'Google Ads hoặc kết nối database đã trả lỗi. Hãy xem lỗi chi tiết rồi thử lại.' : automationCampaignDetail.campaign.metricsAvailable ? 'Bấm đồng bộ để lấy số liệu mới nhất cho tất cả nhóm quảng cáo trong chiến dịch.' : automationCampaignDetail.campaign.checkedAdGroupCount > 0 ? `Google Ads chưa ghi nhận lượt hiển thị trong 14 ngày cho ${automationCampaignDetail.campaign.checkedAdGroupCount}/${automationCampaignDetail.adGroups.length} nhóm đã kiểm tra. Đây là trạng thái bình thường với nhóm quảng cáo mới.` : 'Chưa có lần đồng bộ 14 ngày nào cho các nhóm quảng cáo trong chiến dịch này.'}</span>
                    </div>
                    <button className="secondaryButton" type="button" disabled={automationMetricsSyncing} onClick={() => void syncAutomationCampaignMetrics()}><RefreshCw size={15} className={automationMetricsSyncing ? 'spin' : ''} />{automationMetricsSyncing ? 'Đang đồng bộ...' : 'Đồng bộ số liệu 14 ngày'}</button>
                </div>
                <div className="automationCampaignScheduleEditor">
                  <div>
                    <strong>Chu kỳ chạy của chiến dịch này</strong>
                    <span>Mỗi chiến dịch có lịch riêng. Sau khi chạy, hệ thống tính lần tiếp theo theo số ngày này.</span>
                  </div>
                  <label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={automationCampaignIntervals[automationCampaignDetail.campaign.id] || 14}
                      disabled={!canManageAutomationScope}
                      onChange={(event) => setAutomationCampaignIntervals((current) => ({
                        ...current,
                        [automationCampaignDetail.campaign.id]: Math.min(365, Math.max(1, Number(event.target.value) || 1)),
                      }))}
                    />
                    <span>ngày/lần</span>
                  </label>
                </div>
                <div className="automationCampaignPromptEditor">
                  <div><strong>Prompt AI riêng của chiến dịch</strong><span>Prompt này chỉ áp dụng cho các nhóm quảng cáo thuộc chiến dịch hiện tại.</span></div>
                  <textarea
                    value={automationCampaignPrompts[automationCampaignDetail.campaign.id] || automationCampaignDetail.campaign.prompt || DEFAULT_EDITABLE_SYSTEM_PROMPT}
                    onChange={(event) => setAutomationCampaignPrompts((current) => ({ ...current, [automationCampaignDetail.campaign.id]: event.target.value }))}
                    maxLength={8000}
                    disabled={!canManageAutomationScope}
                  />
                  <div><button className="tableActionButton" type="button" disabled={!canManageAutomationScope} onClick={() => setAutomationCampaignPrompts((current) => ({ ...current, [automationCampaignDetail.campaign.id]: DEFAULT_EDITABLE_SYSTEM_PROMPT }))}>Khôi phục mặc định</button><span>{(automationCampaignPrompts[automationCampaignDetail.campaign.id] || automationCampaignDetail.campaign.prompt || DEFAULT_EDITABLE_SYSTEM_PROMPT).length}/8000</span></div>
                </div>
                <div className={`automationCampaignPromptResult${activeCampaignPromptLog ? ' available' : ''}`}>
                  <FileText size={19} />
                  <div>
                    <strong>Prompt đã gửi lần gần nhất</strong>
                    {activeCampaignPromptLog ? (
                      <span>Đã gửi cho AI · {activeCampaignPromptLog.item.targetSnapshot?.adGroupName ?? 'Nhóm quảng cáo'} · {formatDate(activeCampaignPromptLog.runAt)}</span>
                    ) : activeCampaignLastRun ? (
                      <span>AI chưa được gọi trong lần chạy gần nhất. Không tìm thấy tiêu đề hoặc mô tả mang nhãn LOW.</span>
                    ) : (
                      <span>Chưa có lần chạy nào tạo prompt thật cho chiến dịch này.</span>
                    )}
                  </div>
                  {activeCampaignPromptLog ? (
                    <button className="automationPromptViewButton" type="button" onClick={() => setAutomationPromptLog({
                      prompt: activeCampaignPromptLog.item.reason ?? '',
                      runId: activeCampaignPromptLog.runId,
                      campaignName: activeCampaignPromptLog.item.targetSnapshot?.campaignName ?? automationCampaignDetail.campaign.name,
                      adGroupName: activeCampaignPromptLog.item.targetSnapshot?.adGroupName ?? 'Nhóm quảng cáo',
                      adGroupId: activeCampaignPromptLog.item.targetSnapshot?.adGroupId ?? '',
                      runAt: activeCampaignPromptLog.runAt,
                    })}>Xem prompt AI đã đọc</button>
                  ) : <span className="automationPromptNotSent">Chưa gửi AI</span>}
                </div>
                <div className="automationCampaignMode" role="radiogroup" aria-label="Phạm vi chạy của chiến dịch">
                  <label aria-label="Chạy toàn bộ chiến dịch">
                    <input
                      type="radio"
                      name={`automation-mode-${automationCampaignDetail.campaign.id}`}
                      checked={allAutomationCampaignIds.includes(automationCampaignDetail.campaign.id)}
                      disabled={!canManageAutomationScope}
                      onChange={() => setAutomationCampaignMode(automationCampaignDetail.campaign.id, 'ALL')}
                    />
                    <span><strong>Chạy toàn bộ chiến dịch</strong><small>Tự động xử lý mọi nhóm quảng cáo đang hoạt động trong chiến dịch.</small></span>
                  </label>
                  <label aria-label="Chỉ chạy nhóm quảng cáo được chọn">
                    <input
                      type="radio"
                      name={`automation-mode-${automationCampaignDetail.campaign.id}`}
                      checked={selectedAutomationCampaignIds.includes(automationCampaignDetail.campaign.id) && !allAutomationCampaignIds.includes(automationCampaignDetail.campaign.id)}
                      disabled={!canManageAutomationScope}
                      onChange={() => setAutomationCampaignMode(automationCampaignDetail.campaign.id, 'SELECTED')}
                    />
                    <span><strong>Chỉ chạy nhóm quảng cáo được chọn</strong><small>Tích riêng các nhóm cần Automation ở danh sách bên dưới.</small></span>
                  </label>
                </div>
                <div className="automationScopeAdGroups">
                  <div className="automationAdGroupHeader" aria-hidden="true">
                    <span />
                    <strong>Nhóm quảng cáo</strong>
                    <strong>Hiển thị</strong>
                    <strong>CTR</strong>
                    <strong>Chi phí</strong>
                    <strong title="Giá trị chuyển đổi chia cho chi phí quảng cáo">ROAS</strong>
                  </div>
                  {automationCampaignDetail.adGroups.map((adGroup) => {
                    const targeted = allAutomationCampaignIds.includes(automationCampaignDetail.campaign.id) || selectedAutomationAdGroupIds.includes(adGroup.id);
                    const config = automationAdGroupConfigs[adGroup.id] ?? { languageCode: '', topic: '' };
                    return (
                    <div className={`automationAdGroupRow${targeted ? ' selected' : ''}`} key={adGroup.id}>
                      <input
                        type="checkbox"
                        aria-label={`Cho phép Automation trong nhóm quảng cáo ${adGroup.name}`}
                        checked={targeted}
                        disabled={
                          !canManageAutomationScope ||
                          allAutomationCampaignIds.includes(
                            automationCampaignDetail.campaign.id,
                          )
                        }
                        onChange={(event) =>
                          toggleAutomationAdGroup(automationCampaignDetail.campaign.id, adGroup.id, event.target.checked)
                        }
                      />
                      <span>
                        <strong>{adGroup.name}</strong>
                        <small>ID {adGroup.id} · {automationEntityStatus(adGroup.status)}</small>
                      </span>
                      <span className="automationAdGroupMetrics">
                        <small data-label="Hiển thị">{adGroup.metricsAvailable ? formatCompactNumber(adGroup.metrics.impressions) : adGroup.syncStatus === 'FAILED' ? 'Đồng bộ lỗi' : adGroup.syncCheckedAt ? 'Chưa phát sinh dữ liệu' : 'Chưa kiểm tra'}</small>
                        <small data-label="CTR">{adGroup.metricsAvailable ? formatAutomationPercent(adGroup.metrics.ctr) : '—'}</small>
                        <small data-label="Chi phí">{adGroup.metricsAvailable ? formatAutomationMoney(adGroup.metrics.cost, settings.account.currencyCode) : '—'}</small>
                        <small data-label="ROAS">{adGroup.metricsAvailable ? formatAutomationPercent(adGroup.metrics.roas) : '—'}</small>
                      </span>
                      {targeted ? <div className="automationAdGroupContext">
                        <label><span>Ngôn ngữ AI phải viết *</span><select value={config.languageCode} onChange={(event) => setAutomationAdGroupConfigs((current) => ({ ...current, [adGroup.id]: { ...config, languageCode: event.target.value } }))}><option value="">Chọn ngôn ngữ</option>{LANGUAGE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><small>Chọn ngôn ngữ của nội dung quảng cáo, không chọn theo quốc gia.</small></label>
                        <label><span>Chủ đề của nhóm quảng cáo</span><input value={config.topic} maxLength={500} placeholder="Ví dụ: Ứng dụng điều khiển điều hòa từ điện thoại" onChange={(event) => setAutomationAdGroupConfigs((current) => ({ ...current, [adGroup.id]: { ...config, topic: event.target.value } }))} /></label>
                      </div> : null}
                    </div>
                  );})}
                  {!automationCampaignDetail.adGroups.length ? (
                    <div className="empty">Chiến dịch này chưa có nhóm quảng cáo trong dữ liệu đã đồng bộ.</div>
                  ) : null}
                </div>
                <div className="automationCampaignDetailActions">
                  <span>
                    {allAutomationCampaignIds.includes(automationCampaignDetail.campaign.id)
                      ? `Đã chọn toàn bộ ${automationCampaignDetail.adGroups.length} nhóm quảng cáo.`
                      : `${automationCampaignDetail.adGroups.filter((adGroup) => selectedAutomationAdGroupIds.includes(adGroup.id)).length}/${automationCampaignDetail.adGroups.length} nhóm quảng cáo đã chọn.`}
                  </span>
                  <button
                    className="primaryButton"
                    type="button"
                    disabled={automationScopeSaving || !selectedAutomationCampaignIds.includes(automationCampaignDetail.campaign.id) || automationCampaignDetail.adGroups.some((adGroup) => (allAutomationCampaignIds.includes(automationCampaignDetail.campaign.id) || selectedAutomationAdGroupIds.includes(adGroup.id)) && (!automationAdGroupConfigs[adGroup.id]?.languageCode || !automationAdGroupConfigs[adGroup.id]?.topic.trim()))}
                    onClick={() => void saveAutomationScope()}
                  >
                    {automationScopeSaving ? 'Đang lưu...' : 'Lưu cấu hình nhóm'}
                  </button>
                </div>
              </div>
              </div>
            ) : null}
            <div className={`settingsActions automationSaveBar${automationScopeDirty ? ' dirty' : ''}`}>
              <span>
                {automationScopeDirty
                  ? `${pendingAutomationAdditions} chiến dịch thêm mới · ${pendingAutomationRemovals} chiến dịch sẽ gỡ · có thay đổi nhóm quảng cáo/phạm vi chưa lưu`
                  : 'Mọi thay đổi phạm vi đã được lưu.'}
              </span>
              {canManageAutomationScope ? (
                <button
                  className="primaryButton"
                  type="button"
                  disabled={automationScopeSaving || !automationScopeDirty}
                  onClick={() => void saveAutomationScope()}
                >
                  <Save size={15} />
                  {automationScopeSaving ? 'Đang lưu...' : 'Lưu phạm vi'}
                </button>
              ) : null}
            </div>
          </section>
          <section className="automationGlobalControls" aria-label="Điều khiển chung Automation">
            <div>
              <strong>Điều khiển chung</strong>
              <span>
                {automationScopeDirty
                  ? 'Hãy lưu phạm vi trước khi chạy.'
                  : settingsDraft.automationEnabled
                    ? `Lịch đang bật · chiến dịch gần nhất: ${automationNextRunLabel}`
                    : 'Lịch đang tắt. Chu kỳ và kết quả được hiển thị riêng trên từng chiến dịch.'}
              </span>
            </div>
            <div className="automationGlobalControlActions">
              <button className="primaryButton" type="button" disabled={automationScopeDirty || automationRunning || automationRunInProgress || loading || !canRunPeriodicAi || !hasAutomationTarget} onClick={() => void runAutomationNow()}><Play size={15} />{automationRunning || automationRunInProgress ? 'Đang chạy...' : 'Chạy ngay tất cả'}</button>
              <button className="secondaryButton dangerButton" type="button" disabled={loading || (!settingsDraft.automationEnabled && !automationRunning && !automationRunInProgress) || !canRunPeriodicAi} onClick={() => void stopAutomation()}><X size={15} />{automationRunning || automationRunInProgress ? 'Dừng lượt chạy' : 'Tắt toàn bộ lịch'}</button>
            </div>
          </section>
          </>
          ) : null}
        </>
      ) : null}

      {loading && !overview && !recommendations.length && !terms.length && !settings ? <div className="pageLoading"><RefreshCw size={18} className="spin" />Đang tải</div> : null}
    </div>
  );
}
