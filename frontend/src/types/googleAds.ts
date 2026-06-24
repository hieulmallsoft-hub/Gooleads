export type Campaign = {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversionValue: number;
  roas: number;
};

export type CampaignResponse = {
  campaigns: Campaign[];
  timeRange: string;
  totalCost: number;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgRoas: number;
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
  conversionValue: number;
  roas: number;
};

export type AdGroupResponse = {
  adGroups: AdGroup[];
  timeRange: string;
  totalCost: number;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgRoas: number;
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
  totalCost: number;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgRoas: number;
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
