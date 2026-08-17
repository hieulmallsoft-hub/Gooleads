export type DailyMetric = {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  roas: number;
  costPerConversion: number;
};

export type Campaign = {
  id: string;
  name: string;
  status?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  dailyMetrics?: DailyMetric[];
};

export type AppRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  workspaceId: string;
  role: AppRole;
  permissions: string[];
  accountAccess: Array<{
    customerId: string;
  }>;
};

export type AuthMeResponse = {
  user: AuthUser;
};

export type CampaignResponse = {
  campaigns: Campaign[];
  timeRange: string;
  currencyCode?: string | null;
  totalCost: number;
  totalClicks: number;
  totalConversions: number;
  totalImpressions: number;
  avgCtr: number;
  avgRoas: number;
  dailyMetrics?: DailyMetric[];
  lastSyncedAt?: string | null;
  dataSource?: 'DATABASE_SNAPSHOT' | 'GOOGLE_ADS_LIVE';
  dataRangeStart?: string | null;
  dataRangeEnd?: string | null;
};

export type AdGroup = {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  dailyMetrics?: DailyMetric[];
};

export type AdGroupResponse = {
  adGroups: AdGroup[];
  timeRange: string;
  currencyCode?: string | null;
  totalCost: number;
  totalClicks: number;
  totalConversions: number;
  totalImpressions: number;
  avgCtr: number;
  avgRoas: number;
  dailyMetrics?: DailyMetric[];
  lastSyncedAt?: string | null;
  dataSource?: 'DATABASE_SNAPSHOT' | 'GOOGLE_ADS_LIVE';
  dataRangeStart?: string | null;
  dataRangeEnd?: string | null;
};

export type Asset = {
  id: string;
  resourceName: string;
  adResourceName: string;
  name: string;
  type: string;
  fieldType: string;
  performanceLabel: string;
  text: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  videoId: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  cpa: number;
  roas: number;
  score: number;
  assessment: string;
  action: string;
  reason: string;
};

export type AssetResponse = {
  assets: Asset[];
  adGroupId: string;
  timeRange: string;
  currencyCode?: string | null;
  totalCost: number;
  totalClicks: number;
  totalConversions: number;
  totalImpressions: number;
  avgCtr: number;
  avgRoas: number;
  dailyMetrics?: DailyMetric[];
  lastSyncedAt?: string | null;
  dataSource?: 'DATABASE_SNAPSHOT' | 'GOOGLE_ADS_LIVE';
  dataRangeStart?: string | null;
  dataRangeEnd?: string | null;
};

export type ReplaceLowAssetsResponse = {
  message: string;
  lowAssetCount: number;
  replacedAds: {
    oldResourceName: string;
    newResourceName: string;
    headlineReplacements: number;
    descriptionReplacements: number;
  }[];
  skippedAds: {
    resourceName: string;
    reason: string;
  }[];
};

export type TextChangePreviewChange = {
  fieldType: 'HEADLINE' | 'DESCRIPTION';
  oldText: string;
  newText: string;
  suggestionId?: string;
  variantId?: string;
};

export type TextChangeRequestItem = {
  id: string;
  status: string;
  changeType: string;
  oldAdResourceName: string | null;
  newAdResourceName: string | null;
  replacementCount: number;
  beforePayload: {
    input?: unknown;
    timeRange?: string;
    changes?: TextChangePreviewChange[];
    adText?: {
      headlines?: string[];
      descriptions?: string[];
    };
  };
  afterPayload: {
    adText?: {
      headlines?: string[];
      descriptions?: string[];
    };
    googleAdsResult?: unknown;
  };
  errorMessage: string | null;
};

export type TextChangeRequest = {
  id: string;
  status: string;
  source: string;
  customerId: string | null;
  adGroupId: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  items: TextChangeRequestItem[];
};

export type TextChangeRequestApplyResponse = {
  changeRequest: TextChangeRequest;
  result: ReplaceLowAssetsResponse;
};

export type ReplaceMediaResponse = {
  message: string;
  mediaType: 'IMAGE' | 'VIDEO';
  oldAssetResourceName: string;
  newAssetResourceName: string;
  replacedAds: {
    oldResourceName: string;
    newResourceName: string;
    replacements: number;
  }[];
  skippedAds: {
    resourceName: string;
    reason: string;
  }[];
};

export type SortKey =
  | 'name'
  | 'id'
  | 'status'
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cost'
  | 'conversionValue'
  | 'roas';

export type AdGroupSortKey =
  | 'name'
  | 'id'
  | 'campaignName'
  | 'status'
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cost'
  | 'conversionValue'
  | 'roas';

export type AssetSortKey =
  | 'fieldType'
  | 'type'
  | 'impressions'
  | 'clicks'
  | 'cost'
  | 'conversions'
  | 'conversionValue'
  | 'roas'
  | 'score';

export type SortDir = 'asc' | 'desc';
export type ViewMode = 'campaigns' | 'adGroups' | 'assets';

export type CustomerOption = {
  value: string;
  label: string;
};

export type GoogleAdsAccountResponse = {
  accounts: Array<{
    customerId: string;
    displayName: string | null;
    status: string;
  }>;
};

export type CampaignGroup = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  campaigns: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type CampaignGroupResponse = {
  groups: CampaignGroup[];
};

export type LowTextSuggestion = {
  key: string;
  fieldType: 'HEADLINE' | 'DESCRIPTION';
  text: string;
  impressions: number;
  clicks: number;
  cost: number;
  roas: number;
  suggestion: string;
  priority: string;
  rationale: string;
  confidence: string;
  suggestionId: string;
  variants: AiSuggestionVariant[];
};

export type AiSuggestionVariant = {
  id: string;
  suggestionId: string;
  rank: number;
  content: { text?: string };
  characterCount: number | null;
  selected: boolean;
};

export type LowTextCandidate = Omit<
  LowTextSuggestion,
  | 'suggestion'
  | 'priority'
  | 'rationale'
  | 'confidence'
  | 'suggestionId'
  | 'variants'
>;

export type AiTextSuggestionsResponse = {
  summary: {
    headline: string;
    approach: string;
  };
  suggestions: LowTextSuggestion[];
  model: string;
  source: string;
  adGroupId: string;
  timeRange: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  languageSource: 'AD_GROUP_CONFIG' | 'DETECTED';
  adGroupTopic: string | null;
};

export type AiReviewAsset = Pick<
  Asset,
  | 'id'
  | 'fieldType'
  | 'type'
  | 'text'
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cost'
  | 'conversions'
  | 'conversionValue'
  | 'roas'
  | 'performanceLabel'
> & {
  title: string;
  mediaType: string;
  previewUrl: string;
};

export type AiCreativeRecommendation = {
  assetKey: string;
  assetId: string;
  asset: AiReviewAsset | null;
  mediaType: string;
  priority: string;
  title: string;
  diagnosis: string;
  suggestion: string;
  replacementIdeas: string[];
  evidence: string[];
  confidence: string;
  suggestionId: string;
  variants: AiSuggestionVariant[];
};

export type AiReviewResponse = {
  summary: {
    headline: string;
    overview: string;
    focus: string;
  };
  recommendations: AiCreativeRecommendation[];
  model: string;
  source: string;
  adGroupId: string;
  timeRange: string;
};

export type ImageAspectSpec = {
  label: string;
  ratio: number;
  minWidth: number;
  minHeight: number;
};

export type ReplacementImageInfo = {
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  specLabel: string;
  adjusted: boolean;
};
