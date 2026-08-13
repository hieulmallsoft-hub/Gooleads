import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Not } from 'typeorm';
import { AdGroupEntity } from '../database/entities/ad-group.entity';
import { AiReviewRunEntity } from '../database/entities/ai-review-run.entity';
import { AiSuggestionVariantEntity } from '../database/entities/ai-suggestion-variant.entity';
import { AiSuggestionEntity } from '../database/entities/ai-suggestion.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { CreativePolicyEntity } from '../database/entities/creative-policy.entity';
import { CreativePolicyScopeEntity } from '../database/entities/creative-policy-scope.entity';
import { CreativeTermEntity } from '../database/entities/creative-term.entity';
import { GoogleAdsAccountEntity } from '../database/entities/google-ads-account.entity';
import { GoogleAdsMutationService } from './google-ads-mutation.service';
import { GoogleAdsQueryService } from './google-ads-query.service';

type CampaignPerformance = {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas: number;
};

type AdGroupPerformance = {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas: number;
};

type AssetPerformance = {
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

type AssetEvaluationInput = {
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  performanceLabel: string;
};

type ReplaceLowTextInput = {
  headline?: string;
  description?: string;
  headlineReplacements?: TextReplacement[];
  descriptionReplacements?: TextReplacement[];
};

type ReplaceMediaInput = {
  mediaType: 'IMAGE' | 'VIDEO';
  oldAssetResourceName: string;
  imageFile?: {
    originalname?: string;
    mimetype?: string;
    buffer?: Buffer;
  };
  youtubeVideo?: string;
};

type TextReplacement = {
  oldText: string;
  newText: string;
  suggestionId?: string;
  variantId?: string;
};

type LowTextAsset = {
  adResourceName: string;
  fieldType: 'HEADLINE' | 'DESCRIPTION';
  text: string;
  impressions: number;
  clicks: number;
  ctr: number;
  performanceLabel: string;
};

type ReplacementTarget = {
  headlineTexts: Set<string>;
  descriptionTexts: Set<string>;
  lowAssetCount: number;
};

type ReplacementPlan = {
  oldResourceName: string;
  operationIndex: number;
  headlineReplacements: number;
  descriptionReplacements: number;
};

type TextReplacementPreviewChange = {
  fieldType: 'HEADLINE' | 'DESCRIPTION';
  oldText: string;
  newText: string;
  suggestionId?: string;
  variantId?: string;
};

type TextReplacementPreviewAd = {
  oldResourceName: string;
  updateMask: string;
  headlineReplacements: number;
  descriptionReplacements: number;
  changes: TextReplacementPreviewChange[];
  beforePayload: Record<string, unknown>;
  afterPayload: Record<string, unknown>;
};

type TextReplacementPlanResult = {
  timeRange: string;
  adGroupId: string;
  lowAssetCount: number;
  operations: any[];
  plans: ReplacementPlan[];
  plannedAds: TextReplacementPreviewAd[];
  skippedAds: { resourceName: string; reason: string }[];
};

type MediaReplacementPlan = {
  oldResourceName: string;
  operationIndex: number;
  replacements: number;
};

type MediaAssetUsage = {
  adResourceName: string;
  fieldType: string;
  performanceLabel: string;
  impressions: number;
  source: 'date_range' | 'current_link';
};

type MediaReplacementSlot = {
  adType: 'APP_AD' | 'RESPONSIVE_DISPLAY_AD';
  adJsonField: 'appAd' | 'responsiveDisplayAd';
  mediaJsonField: string;
  updateMask: string;
  currentAssets: string[];
};

type AiCreativeAsset = {
  key: string;
  id: string;
  title: string;
  mediaType: 'Text' | 'Image' | 'Video' | 'Asset';
  fieldType: string;
  type: string;
  performanceLabel: string;
  text: string;
  sourceLanguageCode: string;
  sourceLanguageName: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  previewUrl: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  score: number;
  assessment: string;
  action: string;
  reason: string;
};

type AiTextSuggestionCandidate = {
  key: string;
  fieldType: 'HEADLINE' | 'DESCRIPTION';
  text: string;
  sourceLanguageCode: string;
  sourceLanguageName: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversionValue: number;
  ctr: number;
  roas: number;
  maxLength: number;
};

type AiProviderConfig = {
  source: 'openai' | 'gemini';
  model: string;
  label: string;
};

type CreativeGuidance = {
  languageStrategy: string;
  targetLanguage: string | null;
  headlineMaxLength: number;
  descriptionMaxLength: number;
  minimumImpressions: number;
  minimumClicks: number;
  terms: Record<
    string,
    Array<{
      languageCode: string;
      marketCode: string | null;
      scopeLevel: string;
      googleCampaignId: string | null;
      googleAdGroupId: string | null;
      term: string;
      weight: number;
    }>
  >;
};

type LanguageHint = {
  code: string;
  name: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
};

type CreativeHistory = {
  approved: string[];
  rejected: string[];
  applied: string[];
};

export type GoogleAdsSyncCampaign = {
  id: string;
  resourceName: string;
  name: string;
  status: string;
  channelType: string;
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionValue: number;
};

export type GoogleAdsSyncAdGroup = {
  id: string;
  resourceName: string;
  campaignId: string;
  name: string;
  status: string;
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionValue: number;
};

export type GoogleAdsSyncAsset = {
  adId: string;
  adResourceName: string;
  adType: string;
  adStatus: string;
  adGroupId: string;
  assetId: string;
  assetResourceName: string;
  assetName: string;
  assetType: string;
  fieldType: string;
  performanceLabel: string;
  viewResourceName: string;
  text: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  videoId: string;
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionValue: number;
};

@Injectable()
export class GoogleAdsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly googleAdsQuery: GoogleAdsQueryService,
    private readonly googleAdsMutation: GoogleAdsMutationService,
  ) {}

  private dateSegmentCondition(timeRange: string) {
    const customRange = timeRange.match(/^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})$/);
    if (customRange) {
      return `segments.date BETWEEN '${customRange[1]}' AND '${customRange[2]}'`;
    }

    return `segments.date DURING ${timeRange}`;
  }

  async getCampaignPerformance(customerId: string, timeRange: string) {
    const statusQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      WHERE campaign.status != REMOVED
    `;
    const performanceQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE campaign.status != REMOVED
        AND ${this.dateSegmentCondition(timeRange)}
      ORDER BY metrics.impressions DESC
    `;

    // Campaign status is queried without a date segment. This is the authoritative
    // current list; a metrics query alone can retain/miss rows based on date activity.
    const [statusResponse, performanceResponse] = await Promise.all([
      this.searchAll(customerId, statusQuery),
      this.searchAll(customerId, performanceQuery),
    ]);
    const metricsByCampaignId = new Map(
      (performanceResponse.results ?? []).map((row: any) => [String(row.campaign?.id ?? ''), row]),
    );
    const campaigns: CampaignPerformance[] = (statusResponse.results ?? []).map((statusRow: any): CampaignPerformance => {
      const campaignId = String(statusRow.campaign?.id ?? '');
      const row: any = metricsByCampaignId.get(campaignId) ?? statusRow;
      const impressions = Number(row.metrics?.impressions ?? 0);
      const clicks = Number(row.metrics?.clicks ?? 0);
      const cost = Number(row.metrics?.costMicros ?? 0) / 1_000_000;
      const conversions = Number(row.metrics?.conversions ?? 0);
      const conversionValue = Number(row.metrics?.conversionsValue ?? 0);

      return {
        id: campaignId,
        name: String(statusRow.campaign?.name ?? ''),
        status: String(statusRow.campaign?.status ?? 'UNKNOWN'),
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cost,
        conversions,
        conversionValue,
        roas: cost > 0 ? conversionValue / cost : 0,
      };
    });
    await this.persistCampaignHierarchy(customerId, campaigns, [], true);

    const totalCost = campaigns.reduce(
      (sum: number, campaign: CampaignPerformance) => sum + campaign.cost,
      0,
    );
    const totalConversionValue = campaigns.reduce(
      (sum: number, campaign: CampaignPerformance) => sum + campaign.conversionValue,
      0,
    );
    const totalClicks = campaigns.reduce(
      (sum: number, campaign: CampaignPerformance) => sum + campaign.clicks,
      0,
    );
    const totalConversions = campaigns.reduce(
      (sum: number, campaign: CampaignPerformance) => sum + campaign.conversions,
      0,
    );
    const totalImpressions = campaigns.reduce(
      (sum: number, campaign: CampaignPerformance) => sum + campaign.impressions,
      0,
    );

    return {
      campaigns,
      timeRange,
      totalCost,
      totalClicks,
      totalConversions,
      totalImpressions,
      avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgRoas: totalCost > 0 ? totalConversionValue / totalCost : 0,
    };
  }

  async getAdGroupPerformance(customerId: string, timeRange: string) {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        ad_group.id,
        ad_group.name,
        ad_group.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group
      WHERE campaign.status != REMOVED
        AND ad_group.status != REMOVED
        AND ${this.dateSegmentCondition(timeRange)}
      ORDER BY metrics.impressions DESC
    `;

    const response = await this.searchAll(customerId, query);
    const adGroups: AdGroupPerformance[] = (response.results ?? []).map((row: any): AdGroupPerformance => {
      const impressions = Number(row.metrics?.impressions ?? 0);
      const clicks = Number(row.metrics?.clicks ?? 0);
      const cost = Number(row.metrics?.costMicros ?? 0) / 1_000_000;
      const conversions = Number(row.metrics?.conversions ?? 0);
      const conversionValue = Number(row.metrics?.conversionsValue ?? 0);

      return {
        id: String(row.adGroup?.id ?? ''),
        name: String(row.adGroup?.name ?? ''),
        campaignId: String(row.campaign?.id ?? ''),
        campaignName: String(row.campaign?.name ?? ''),
        campaignStatus: String(row.campaign?.status ?? 'UNKNOWN'),
        status: String(row.adGroup?.status ?? ''),
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cost,
        conversions,
        conversionValue,
        roas: cost > 0 ? conversionValue / cost : 0,
      };
    });
    await this.persistCampaignHierarchy(customerId, [], adGroups);

    const totalCost = adGroups.reduce(
      (sum: number, adGroup: AdGroupPerformance) => sum + adGroup.cost,
      0,
    );
    const totalConversionValue = adGroups.reduce(
      (sum: number, adGroup: AdGroupPerformance) => sum + adGroup.conversionValue,
      0,
    );
    const totalClicks = adGroups.reduce(
      (sum: number, adGroup: AdGroupPerformance) => sum + adGroup.clicks,
      0,
    );
    const totalConversions = adGroups.reduce(
      (sum: number, adGroup: AdGroupPerformance) => sum + adGroup.conversions,
      0,
    );
    const totalImpressions = adGroups.reduce(
      (sum: number, adGroup: AdGroupPerformance) => sum + adGroup.impressions,
      0,
    );

    return {
      adGroups,
      timeRange,
      totalCost,
      totalClicks,
      totalConversions,
      totalImpressions,
      avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgRoas: totalCost > 0 ? totalConversionValue / totalCost : 0,
    };
  }

  private async persistCampaignHierarchy(
    customerId: string,
    campaignPerformance: CampaignPerformance[],
    adGroupPerformance: AdGroupPerformance[],
    reconcileCampaigns = false,
  ) {
    if (!this.dataSource?.isInitialized) return;

    const accountRepository = this.dataSource.getRepository(GoogleAdsAccountEntity);
    const account = await accountRepository.findOneBy({ customerId });
    if (!account) return;

    const now = new Date();
    const campaignRepository = this.dataSource.getRepository(CampaignEntity);
    const existingCampaigns = await campaignRepository.findBy({ accountId: account.id });
    const existingCampaignMap = new Map(
      existingCampaigns.map((campaign) => [campaign.googleCampaignId, campaign]),
    );
    const campaignRows = new Map<string, { id: string; name: string; status: string }>();

    for (const campaign of campaignPerformance) {
      if (campaign.id) campaignRows.set(campaign.id, campaign);
    }
    for (const adGroup of adGroupPerformance) {
      if (adGroup.campaignId) {
        campaignRows.set(adGroup.campaignId, {
          id: adGroup.campaignId,
          name: adGroup.campaignName,
          status: adGroup.campaignStatus,
        });
      }
    }

    if (campaignRows.size) {
      await campaignRepository.upsert(
        [...campaignRows.values()].map((campaign) => ({
          accountId: account.id,
          googleCampaignId: campaign.id,
          resourceName: `customers/${customerId}/campaigns/${campaign.id}`,
          name: campaign.name,
          status: campaign.status,
          channelType: existingCampaignMap.get(campaign.id)?.channelType ?? null,
          firstSeenAt: existingCampaignMap.get(campaign.id)?.firstSeenAt ?? now,
          lastSeenAt: now,
        })),
        ['accountId', 'googleCampaignId'],
      );
    }

    // A successful full status snapshot is authoritative. Rows no longer returned
    // by Google Ads have been removed and must not keep their previous local status.
    if (reconcileCampaigns) {
      const activeCampaignIds = [...campaignRows.keys()];
      await campaignRepository.update(
        activeCampaignIds.length
          ? { accountId: account.id, googleCampaignId: Not(In(activeCampaignIds)) }
          : { accountId: account.id },
        { status: 'REMOVED', lastSeenAt: now },
      );
    }

    if (adGroupPerformance.length) {
      const campaigns = await campaignRepository.findBy({ accountId: account.id });
      const campaignMap = new Map(campaigns.map((campaign) => [campaign.googleCampaignId, campaign]));
      const adGroupRepository = this.dataSource.getRepository(AdGroupEntity);
      const existingAdGroups = campaigns.length
        ? await adGroupRepository.findBy({ campaignId: In(campaigns.map((campaign) => campaign.id)) })
        : [];
      const existingAdGroupMap = new Map(
        existingAdGroups.map((adGroup) => [`${adGroup.campaignId}:${adGroup.googleAdGroupId}`, adGroup]),
      );
      const rows = adGroupPerformance.flatMap((adGroup) => {
        const campaign = campaignMap.get(adGroup.campaignId);
        if (!campaign || !adGroup.id) return [];
        const existing = existingAdGroupMap.get(`${campaign.id}:${adGroup.id}`);
        return [{
          campaignId: campaign.id,
          googleAdGroupId: adGroup.id,
          resourceName: `customers/${customerId}/adGroups/${adGroup.id}`,
          name: adGroup.name,
          status: adGroup.status,
          firstSeenAt: existing?.firstSeenAt ?? now,
          lastSeenAt: now,
        }];
      });
      if (rows.length) {
        await adGroupRepository.upsert(rows, ['campaignId', 'googleAdGroupId']);
      }
    }

    account.lastSyncedAt = now;
    await accountRepository.save(account);
  }

  async getAssetPerformance(customerId: string, adGroupId: string, timeRange: string) {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group_ad.resource_name,
        ad_group.id,
        ad_group.name,
        ad_group_ad_asset_view.field_type,
        ad_group_ad_asset_view.performance_label,
        asset.resource_name,
        asset.id,
        asset.name,
        asset.type,
        asset.text_asset.text,
        asset.image_asset.full_size.url,
        asset.image_asset.full_size.width_pixels,
        asset.image_asset.full_size.height_pixels,
        asset.youtube_video_asset.youtube_video_id,
        ad_group_ad_asset_view.enabled,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group_ad_asset_view
      WHERE ad_group.id = ${adGroupId}
        AND ${this.dateSegmentCondition(timeRange)}
        AND ad_group_ad_asset_view.enabled = TRUE
      ORDER BY metrics.impressions DESC
    `;

    const response = await this.searchAll(customerId, query);
    const assets: AssetPerformance[] = (response.results ?? []).map((row: any): AssetPerformance => {
      const metrics = row.metrics ?? {};
      const asset = row.asset ?? {};
      const assetView = row.adGroupAdAssetView ?? {};
      const clicks = Number(metrics.clicks ?? 0);
      const impressions = Number(metrics.impressions ?? 0);
      const cost = Number(metrics.costMicros ?? 0) / 1_000_000;
      const conversions = Number(metrics.conversions ?? 0);
      const conversionValue = Number(metrics.conversionsValue ?? 0);

      const performanceLabel = String(assetView.performanceLabel ?? '');
      const roas = cost > 0 ? conversionValue / cost : 0;
      const evaluation = this.evaluateAsset({
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cost,
        conversions,
        conversionValue,
        roas,
        performanceLabel,
      });

      return {
        id: String(asset.id ?? ''),
        resourceName: String(asset.resourceName ?? ''),
        adResourceName: String(row.adGroupAd?.resourceName ?? ''),
        name: String(asset.name ?? ''),
        type: String(asset.type ?? ''),
        fieldType: String(assetView.fieldType ?? ''),
        performanceLabel,
        text: String(asset.textAsset?.text ?? ''),
        imageUrl: String(asset.imageAsset?.fullSize?.url ?? ''),
        imageWidth: Number(asset.imageAsset?.fullSize?.widthPixels ?? 0),
        imageHeight: Number(asset.imageAsset?.fullSize?.heightPixels ?? 0),
        videoId: String(asset.youtubeVideoAsset?.youtubeVideoId ?? ''),
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cost,
        conversions,
        conversionValue,
        cpa: conversions > 0 ? cost / conversions : 0,
        roas,
        ...evaluation,
      };
    });

    const totalCost = assets.reduce((sum: number, asset: AssetPerformance) => sum + asset.cost, 0);
    const totalConversionValue = assets.reduce(
      (sum: number, asset: AssetPerformance) => sum + asset.conversionValue,
      0,
    );
    const totalClicks = assets.reduce((sum: number, asset: AssetPerformance) => sum + asset.clicks, 0);
    const totalConversions = assets.reduce(
      (sum: number, asset: AssetPerformance) => sum + asset.conversions,
      0,
    );
    const totalImpressions = assets.reduce(
      (sum: number, asset: AssetPerformance) => sum + asset.impressions,
      0,
    );

    return {
      assets,
      adGroupId,
      timeRange,
      totalCost,
      totalClicks,
      totalConversions,
      totalImpressions,
      avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgRoas: totalCost > 0 ? totalConversionValue / totalCost : 0,
    };
  }

  async getSyncSnapshot(customerId: string, timeRange: string, adGroupId: string) {
    const campaignQuery = `
      SELECT
        campaign.id,
        campaign.resource_name,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE ${this.dateSegmentCondition(timeRange)}
    `;
    const adGroupQuery = `
      SELECT
        campaign.id,
        ad_group.id,
        ad_group.resource_name,
        ad_group.name,
        ad_group.status,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group
      WHERE ad_group.id = ${adGroupId}
        AND ${this.dateSegmentCondition(timeRange)}
    `;
    const assetQuery = `
      SELECT
        ad_group.id,
        ad_group_ad.resource_name,
        ad_group_ad.status,
        ad_group_ad.ad.id,
        ad_group_ad.ad.type,
        ad_group_ad_asset_view.resource_name,
        ad_group_ad_asset_view.field_type,
        ad_group_ad_asset_view.performance_label,
        ad_group_ad_asset_view.enabled,
        asset.id,
        asset.resource_name,
        asset.name,
        asset.type,
        asset.text_asset.text,
        asset.image_asset.full_size.url,
        asset.image_asset.full_size.width_pixels,
        asset.image_asset.full_size.height_pixels,
        asset.youtube_video_asset.youtube_video_id,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group_ad_asset_view
      WHERE ad_group.id = ${adGroupId}
        AND ${this.dateSegmentCondition(timeRange)}
        AND ad_group_ad_asset_view.enabled = TRUE
    `;

    const [campaignResponse, adGroupResponse, assetResponse] = await Promise.all([
      this.searchAll(customerId, campaignQuery),
      this.searchAll(customerId, adGroupQuery),
      this.searchAll(customerId, assetQuery),
    ]);

    const selectedCampaignIds = new Set(
      (adGroupResponse.results ?? []).map((row: any) => String(row.campaign?.id ?? '')),
    );
    const campaigns: GoogleAdsSyncCampaign[] = (campaignResponse.results ?? [])
      .filter((row: any) => selectedCampaignIds.has(String(row.campaign?.id ?? '')))
      .map(
      (row: any) => ({
        id: String(row.campaign?.id ?? ''),
        resourceName: String(row.campaign?.resourceName ?? ''),
        name: String(row.campaign?.name ?? ''),
        status: String(row.campaign?.status ?? 'UNKNOWN'),
        channelType: String(row.campaign?.advertisingChannelType ?? ''),
        date: String(row.segments?.date ?? ''),
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        costMicros: Number(row.metrics?.costMicros ?? 0),
        conversions: Number(row.metrics?.conversions ?? 0),
        conversionValue: Number(row.metrics?.conversionsValue ?? 0),
      }),
    );
    const adGroups: GoogleAdsSyncAdGroup[] = (adGroupResponse.results ?? []).map(
      (row: any) => ({
        id: String(row.adGroup?.id ?? ''),
        resourceName: String(row.adGroup?.resourceName ?? ''),
        campaignId: String(row.campaign?.id ?? ''),
        name: String(row.adGroup?.name ?? ''),
        status: String(row.adGroup?.status ?? 'UNKNOWN'),
        date: String(row.segments?.date ?? ''),
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        costMicros: Number(row.metrics?.costMicros ?? 0),
        conversions: Number(row.metrics?.conversions ?? 0),
        conversionValue: Number(row.metrics?.conversionsValue ?? 0),
      }),
    );
    const assets: GoogleAdsSyncAsset[] = (assetResponse.results ?? []).map(
      (row: any) => ({
        adId: String(row.adGroupAd?.ad?.id ?? ''),
        adResourceName: String(row.adGroupAd?.resourceName ?? ''),
        adType: String(row.adGroupAd?.ad?.type ?? 'UNKNOWN'),
        adStatus: String(row.adGroupAd?.status ?? 'UNKNOWN'),
        adGroupId: String(row.adGroup?.id ?? ''),
        assetId: String(row.asset?.id ?? ''),
        assetResourceName: String(row.asset?.resourceName ?? ''),
        assetName: String(row.asset?.name ?? ''),
        assetType: String(row.asset?.type ?? 'UNKNOWN'),
        fieldType: String(row.adGroupAdAssetView?.fieldType ?? 'UNKNOWN'),
        performanceLabel: String(
          row.adGroupAdAssetView?.performanceLabel ?? 'UNKNOWN',
        ),
        viewResourceName: String(row.adGroupAdAssetView?.resourceName ?? ''),
        text: String(row.asset?.textAsset?.text ?? ''),
        imageUrl: String(row.asset?.imageAsset?.fullSize?.url ?? ''),
        imageWidth: Number(row.asset?.imageAsset?.fullSize?.widthPixels ?? 0),
        imageHeight: Number(row.asset?.imageAsset?.fullSize?.heightPixels ?? 0),
        videoId: String(row.asset?.youtubeVideoAsset?.youtubeVideoId ?? ''),
        date: String(row.segments?.date ?? ''),
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        costMicros: Number(row.metrics?.costMicros ?? 0),
        conversions: Number(row.metrics?.conversions ?? 0),
        conversionValue: Number(row.metrics?.conversionsValue ?? 0),
      }),
    );

    return { campaigns, adGroups, assets };
  }

  async replaceLowTextAssets(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    input: ReplaceLowTextInput,
  ) {
    const plan = await this.prepareLowTextReplacementPlan(
      customerId,
      adGroupId,
      timeRange,
      input,
    );

    const response = await this.mutateAds(customerId, plan.operations);
    const results = response.results ?? [];
    const replacedAds = plan.plans.map((item) => ({
      oldResourceName: item.oldResourceName,
      newResourceName: String(results[item.operationIndex]?.resourceName ?? ''),
      headlineReplacements: item.headlineReplacements,
      descriptionReplacements: item.descriptionReplacements,
    }));

    return {
      message: `Updated ${replacedAds.length} ad${replacedAds.length === 1 ? '' : 's'}`,
      timeRange,
      adGroupId,
      lowAssetCount: plan.lowAssetCount,
      replacedAds,
      skippedAds: plan.skippedAds,
    };
  }

  async previewLowTextReplacement(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    input: ReplaceLowTextInput,
  ) {
    const plan = await this.prepareLowTextReplacementPlan(
      customerId,
      adGroupId,
      timeRange,
      input,
    );

    return {
      message: `Prepared ${plan.plannedAds.length} ad${plan.plannedAds.length === 1 ? '' : 's'} for review`,
      timeRange,
      adGroupId,
      lowAssetCount: plan.lowAssetCount,
      plannedAds: plan.plannedAds,
      skippedAds: plan.skippedAds,
    };
  }

  private async prepareLowTextReplacementPlan(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    input: ReplaceLowTextInput,
  ): Promise<TextReplacementPlanResult> {
    const headline = input.headline
      ? this.fitGoogleAdsCopy(input.headline, 30)
      : '';
    const description = input.description
      ? this.fitGoogleAdsCopy(input.description, 90)
      : '';
    const headlineReplacementMap = this.buildTextReplacementMap(
      input.headlineReplacements,
      30,
    );
    const descriptionReplacementMap = this.buildTextReplacementMap(
      input.descriptionReplacements,
      90,
    );
    const headlineReplacementLinkMap = this.buildTextReplacementLinkMap(input.headlineReplacements);
    const descriptionReplacementLinkMap = this.buildTextReplacementLinkMap(input.descriptionReplacements);

    if (
      !headline &&
      !description &&
      headlineReplacementMap.size === 0 &&
      descriptionReplacementMap.size === 0
    ) {
      throw new BadRequestException('Enter or choose headline/description suggestions');
    }

    const lowAssets = await this.findLowTextAssets(customerId, adGroupId, timeRange);
    const targetAssets = lowAssets.filter((asset) => {
      if (asset.fieldType === 'HEADLINE') {
        return Boolean(headline || headlineReplacementMap.has(asset.text));
      }
      return Boolean(description || descriptionReplacementMap.has(asset.text));
    });

    if (targetAssets.length === 0) {
      throw new NotFoundException(
        'No LOW headline or description assets found for this ad group and time range',
      );
    }

    const targets = targetAssets.reduce<Map<string, ReplacementTarget>>((map, asset) => {
      const current =
        map.get(asset.adResourceName) ??
        {
          headlineTexts: new Set<string>(),
          descriptionTexts: new Set<string>(),
          lowAssetCount: 0,
        };

      if (asset.fieldType === 'HEADLINE') {
        current.headlineTexts.add(asset.text);
      } else {
        current.descriptionTexts.add(asset.text);
      }
      current.lowAssetCount += 1;
      map.set(asset.adResourceName, current);
      return map;
    }, new Map<string, ReplacementTarget>());

    const operations: any[] = [];
    const plans: ReplacementPlan[] = [];
    const plannedAds: TextReplacementPreviewAd[] = [];
    const skippedAds: { resourceName: string; reason: string }[] = [];

    for (const [resourceName, target] of targets) {
      const adGroupAd = await this.getAdGroupAd(customerId, resourceName);
      const appAd = adGroupAd?.ad?.appAd;

      if (!appAd) {
        skippedAds.push({
          resourceName,
          reason: 'Only APP_AD replacements are supported by this action',
        });
        continue;
      }

      const headlineReplacements = headline || headlineReplacementMap.size > 0
        ? this.countMatchingTextAssets(appAd.headlines, target.headlineTexts)
        : 0;
      const descriptionReplacements = description || descriptionReplacementMap.size > 0
        ? this.countMatchingTextAssets(appAd.descriptions, target.descriptionTexts)
        : 0;

      if (headlineReplacements + descriptionReplacements === 0) {
        skippedAds.push({
          resourceName,
          reason: 'Weak text was not found inside the current ad copy',
        });
        continue;
      }

      const update = this.buildReplacementAd({
        customerId,
        adGroupAd,
        headline,
        description,
        headlineReplacementMap,
        descriptionReplacementMap,
        headlineTexts: target.headlineTexts,
        descriptionTexts: target.descriptionTexts,
      });
      const operationIndex = operations.length;

      const updateMask = this.buildAppAdTextUpdateMask({
        updateHeadlines: headlineReplacements > 0,
        updateDescriptions: descriptionReplacements > 0,
      });
      operations.push({ updateMask, update });
      plans.push({
        oldResourceName: resourceName,
        operationIndex,
        headlineReplacements,
        descriptionReplacements,
      });
      plannedAds.push({
        oldResourceName: resourceName,
        updateMask,
        headlineReplacements,
        descriptionReplacements,
        changes: this.buildTextReplacementPreviewChanges({
          headline,
          description,
          headlineReplacementMap,
          descriptionReplacementMap,
          headlineReplacementLinkMap,
          descriptionReplacementLinkMap,
          headlineTexts: target.headlineTexts,
          descriptionTexts: target.descriptionTexts,
        }),
        beforePayload: {
          headlines: this.textAssetTexts(appAd.headlines),
          descriptions: this.textAssetTexts(appAd.descriptions),
        },
        afterPayload: {
          headlines: update.appAd && 'headlines' in update.appAd
            ? this.textAssetTexts(update.appAd.headlines)
            : this.textAssetTexts(appAd.headlines),
          descriptions: update.appAd && 'descriptions' in update.appAd
            ? this.textAssetTexts(update.appAd.descriptions)
            : this.textAssetTexts(appAd.descriptions),
        },
      });
    }

    if (operations.length === 0) {
      throw new BadRequestException({
        message: 'No editable APP_AD rows were found for the LOW text assets',
        skippedAds,
      });
    }

    return {
      timeRange,
      adGroupId,
      lowAssetCount: targetAssets.length,
      operations,
      plans,
      plannedAds,
      skippedAds,
    };
  }

  async replaceMediaAsset(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    input: ReplaceMediaInput,
  ) {
    const oldAssetResourceName = input.oldAssetResourceName.trim();
    if (!/^customers\/\d+\/assets\/\d+$/.test(oldAssetResourceName)) {
      throw new BadRequestException('Choose a valid image or video asset from the table first');
    }

    if (input.mediaType === 'IMAGE' && !input.imageFile?.buffer?.length) {
      throw new BadRequestException('Upload a replacement image file');
    }

    if (input.mediaType === 'VIDEO' && !this.extractYoutubeVideoId(input.youtubeVideo)) {
      throw new BadRequestException('Enter a valid YouTube video URL or ID');
    }

    const usages = await this.findMediaAssetUsages(
      customerId,
      adGroupId,
      timeRange,
      oldAssetResourceName,
    );

    if (usages.length === 0) {
      throw new NotFoundException('No active ads using the selected image/video asset were found');
    }

    const editableAds: any[] = [];
    const skippedAds: { resourceName: string; reason: string }[] = [];
    const uniqueAdResourceNames: string[] = Array.from(
      new Set(usages.map((usage: MediaAssetUsage) => usage.adResourceName)),
    );

    for (const resourceName of uniqueAdResourceNames) {
      const adGroupAd = await this.getAdGroupAd(customerId, resourceName);
      const usage = usages.find((item) => item.adResourceName === resourceName);
      const slot = this.getMediaReplacementSlot(
        adGroupAd,
        input.mediaType,
        usage?.fieldType ?? '',
      );

      if (!slot) {
        skippedAds.push({
          resourceName,
          reason: [
            'This ad media field is not supported yet',
            adGroupAd?.ad?.type ? `adType=${adGroupAd.ad.type}` : '',
            usage?.fieldType ? `fieldType=${usage.fieldType}` : '',
            `supported=APP_AD images/videos and RESPONSIVE_DISPLAY_AD marketing images/videos`,
          ]
            .filter(Boolean)
            .join(' | '),
        });
        continue;
      }

      const currentAssets = slot.currentAssets;
      const replacements = currentAssets.filter((asset) => asset === oldAssetResourceName).length;

      if (replacements === 0) {
        skippedAds.push({
          resourceName,
          reason: [
            `Selected asset was not found inside ${slot.updateMask}`,
            usage?.fieldType ? `fieldType=${usage.fieldType}` : '',
            `current ${input.mediaType.toLowerCase()} assets=${currentAssets.join(', ') || 'none'}`,
          ]
            .filter(Boolean)
            .join(' | '),
        });
        continue;
      }

      editableAds.push({
        adGroupAd,
        fieldType: usage?.fieldType ?? '',
        replacements,
        resourceName,
      });
    }

    if (editableAds.length === 0) {
      throw new BadRequestException({
        message: 'No editable ad rows were found for the selected media asset',
        usages,
        skippedAds,
      });
    }

    const newAssetResourceName =
      input.mediaType === 'IMAGE'
        ? await this.createImageAsset(customerId, input.imageFile)
        : await this.createYoutubeVideoAsset(customerId, input.youtubeVideo);

    const operations: any[] = [];
    const plans: MediaReplacementPlan[] = [];

    for (const editableAd of editableAds) {
      const { update, replacements, updateMask } = this.buildMediaReplacementAd({
        customerId,
        adGroupAd: editableAd.adGroupAd,
        mediaType: input.mediaType,
        fieldType: editableAd.fieldType,
        oldAssetResourceName,
        newAssetResourceName,
      });

      const operationIndex = operations.length;
      operations.push({
        updateMask,
        update,
      });
      plans.push({ oldResourceName: editableAd.resourceName, operationIndex, replacements });
    }

    if (operations.length === 0) {
      throw new BadRequestException({
        message: 'No editable ad rows were found for the selected media asset',
        newAssetResourceName,
        usages,
        skippedAds,
      });
    }

    const response = await this.mutateAds(customerId, operations);
    const results = response.results ?? [];
    const replacedAds = plans.map((plan) => ({
      oldResourceName: plan.oldResourceName,
      newResourceName: String(results[plan.operationIndex]?.resourceName ?? ''),
      replacements: plan.replacements,
    }));

    return {
      message: `Updated ${replacedAds.length} ad${replacedAds.length === 1 ? '' : 's'}`,
      mediaType: input.mediaType,
      timeRange,
      adGroupId,
      oldAssetResourceName,
      newAssetResourceName,
      replacedAds,
      skippedAds,
    };
  }

  async generateAiCreativeReview(customerId: string, adGroupId: string, timeRange: string) {
    const aiProvider = this.getAiProvider('AI creative review');
    const reviewAssetLimit = Number(
      process.env.AI_REVIEW_ASSET_LIMIT ??
        process.env.OPENAI_REVIEW_ASSET_LIMIT ??
        (aiProvider.source === 'gemini' ? 6 : 12),
    );
    const assetPerformance = await this.getAssetPerformance(customerId, adGroupId, timeRange);
    const guidance = await this.getCreativeGuidance(customerId, adGroupId);
    const history = await this.getCreativeSuggestionHistory(customerId, adGroupId);
    const adGroupFallbackLanguage = this.resolveAdGroupTargetLanguage(assetPerformance.assets, guidance);
    const assets = this.selectAiReviewAssets(
      assetPerformance.assets,
      reviewAssetLimit,
    )
      .map((asset, index) =>
        this.toAiCreativeAsset(asset, index + 1, adGroupFallbackLanguage, guidance),
      );

    if (assets.length === 0) {
      throw new BadRequestException('No assets with LOW label were found for AI review');
    }

    const content = this.buildOpenAiReviewContent(assets, {
      customerId,
      adGroupId,
      timeRange,
      targetLanguageCode: adGroupFallbackLanguage.code,
      targetLanguageName: adGroupFallbackLanguage.name,
      targetLanguageConfidence: adGroupFallbackLanguage.confidence,
      totalImpressions: assetPerformance.totalImpressions,
      totalClicks: assetPerformance.totalClicks,
      totalCost: assetPerformance.totalCost,
      avgCtr: assetPerformance.avgCtr,
      avgRoas: assetPerformance.avgRoas,
    }, guidance, history);

    const outputText =
      aiProvider.source === 'gemini'
        ? await this.requestGeminiJson({
            model: aiProvider.model,
            prompt: this.openAiContentToPlainText(content),
            schema: this.aiReviewSchema(),
            maxOutputTokens: 4096,
          })
        : await this.requestOpenAiJson({
            model: aiProvider.model,
            input: [
              {
                role: 'user',
                content,
              },
            ],
            schemaName: 'google_ads_creative_review',
            schema: this.aiReviewSchema(),
            maxOutputTokens: 4096,
          });

    if (!outputText) {
      throw new InternalServerErrorException(`${aiProvider.label} returned an empty creative review`);
    }

    try {
      const review = this.parseAiJson(outputText) as {
        recommendations?: Array<Record<string, unknown>>;
      };

      return this.withAiReviewAssetDetails(review, assets, {
        model: aiProvider.model,
        adGroupId,
        timeRange,
        source: aiProvider.source,
      });
    } catch (error) {
      return this.withAiReviewAssetDetails(this.buildMetricFallbackAiReview(assets), assets, {
        model: `${aiProvider.model} fallback`,
        adGroupId,
        timeRange,
        source: aiProvider.source,
      });
    }
  }

  async generateAiTextSuggestions(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    automationContext?: { languageCode: string; topic: string },
  ) {
    const aiProvider = this.getAiProvider('AI text suggestions');
    const suggestionLimit = Math.max(
      1,
      Math.min(
        Number(
          process.env.AI_TEXT_SUGGESTION_LIMIT ??
            process.env.OPENAI_TEXT_SUGGESTION_LIMIT ??
            12,
        ),
        20,
      ),
    );
    const assetPerformance = await this.getAssetPerformance(customerId, adGroupId, timeRange);
    const guidance = await this.getCreativeGuidance(customerId, adGroupId);
    const history = await this.getCreativeSuggestionHistory(customerId, adGroupId);
    const savedAdGroupContext = automationContext ?? await this.getSavedAdGroupAiContext(customerId, adGroupId);
    const adGroupFallbackLanguage = this.resolveAdGroupTargetLanguage(assetPerformance.assets, guidance);
    const configuredLanguage = savedAdGroupContext?.languageCode
      ? {
          code: savedAdGroupContext.languageCode.toLowerCase(),
          name: this.languageName(savedAdGroupContext.languageCode.toLowerCase()),
          confidence: 'HIGH' as const,
        }
      : null;
    const candidates = this.collectWeakTextSuggestionCandidates(
      assetPerformance.assets,
      adGroupFallbackLanguage,
      guidance,
      configuredLanguage,
    ).slice(
      0,
      suggestionLimit,
    );

    if (candidates.length === 0) {
      throw new BadRequestException('No LOW headline/description assets found for AI suggestions');
    }

    const prompt = this.buildOpenAiTextSuggestionPrompt(candidates, {
      customerId,
      adGroupId,
      timeRange,
      targetLanguageCode: adGroupFallbackLanguage.code,
      targetLanguageName: adGroupFallbackLanguage.name,
      targetLanguageConfidence: adGroupFallbackLanguage.confidence,
      totalImpressions: assetPerformance.totalImpressions,
      totalClicks: assetPerformance.totalClicks,
      totalCost: assetPerformance.totalCost,
      avgCtr: assetPerformance.avgCtr,
      avgRoas: assetPerformance.avgRoas,
      automationLanguageCode: savedAdGroupContext?.languageCode ?? null,
      automationTopic: savedAdGroupContext?.topic ?? null,
    }, guidance, history);
    const schema = this.aiTextSuggestionSchema(candidates);
    const outputText =
      aiProvider.source === 'gemini'
        ? await this.requestGeminiJson({
            model: aiProvider.model,
            prompt,
            schema,
            maxOutputTokens: 3600,
          })
        : await this.requestOpenAiJson({
            model: aiProvider.model,
            input: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_text',
                    text: prompt,
                  },
                ],
              },
            ],
            schemaName: 'google_ads_ai_text_suggestions',
            schema,
            maxOutputTokens: 3600,
          });

    if (!outputText) {
      throw new InternalServerErrorException(`${aiProvider.label} returned empty text suggestions`);
    }

    try {
      const result = this.parseAiJson(outputText) as {
        summary?: {
          headline?: string;
          approach?: string;
        };
        suggestions?: Array<Record<string, unknown>>;
      };
      const suggestions = this.normalizeAiTextSuggestions(
        result.suggestions ?? [],
        candidates,
      );

      if (suggestions.length === 0) {
        throw new Error('No valid suggestion keys returned');
      }

      return {
        summary: {
          headline: String(result.summary?.headline ?? 'AI text suggestions'),
          approach: String(result.summary?.approach ?? `${aiProvider.label} generated replacement copy`),
        },
        suggestions,
        model: aiProvider.model,
        source: aiProvider.source,
        adGroupId,
        timeRange,
        targetLanguageCode: configuredLanguage?.code ?? adGroupFallbackLanguage.code,
        targetLanguageName: configuredLanguage?.name ?? adGroupFallbackLanguage.name,
        languageSource: configuredLanguage ? 'AD_GROUP_CONFIG' : 'DETECTED',
        adGroupTopic: savedAdGroupContext?.topic ?? null,
      };
    } catch (error) {
      return this.buildFallbackTextSuggestions(candidates, {
        model: `${aiProvider.model} fallback`,
        source: aiProvider.source,
        adGroupId,
        timeRange,
        targetLanguageCode: configuredLanguage?.code ?? adGroupFallbackLanguage.code,
        targetLanguageName: configuredLanguage?.name ?? adGroupFallbackLanguage.name,
        languageSource: configuredLanguage ? 'AD_GROUP_CONFIG' : 'DETECTED',
        adGroupTopic: savedAdGroupContext?.topic ?? null,
      });
    }
  }

  async translateAssetText(text: string) {
    const sourceText = String(text ?? '').trim();
    if (!sourceText) throw new BadRequestException('Missing text to translate');
    if (sourceText.length > 500) throw new BadRequestException('Text is too long to translate');

    const detected = this.detectTextLanguage(sourceText);
    if (detected.code === 'vi') {
      return { sourceText, sourceLanguage: 'vi', translation: sourceText };
    }

    const aiProvider = this.getAiProvider('asset translation');
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['translation'],
      properties: { translation: { type: 'string' } },
    };
    const prompt = [
      'Translate the following Google Ads headline or description into natural Vietnamese.',
      'Preserve brand names and product names. Do not add explanations or marketing claims.',
      `Source text: ${JSON.stringify(sourceText)}`,
    ].join('\n');
    const output = aiProvider.source === 'gemini'
      ? await this.requestGeminiJson({ model: aiProvider.model, prompt, schema, maxOutputTokens: 512 })
      : await this.requestOpenAiJson({
          model: aiProvider.model,
          input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
          schemaName: 'asset_translation',
          schema,
          maxOutputTokens: 512,
        });
    const parsed = this.parseAiJson(output) as { translation?: unknown };
    const translation = String(parsed.translation ?? '').trim();
    if (!translation) throw new InternalServerErrorException('AI returned an empty translation');

    return { sourceText, sourceLanguage: detected.code, translation };
  }

  private collectWeakTextSuggestionCandidates(
    assets: AssetPerformance[],
    adGroupFallbackLanguage: LanguageHint,
    guidance: CreativeGuidance | null,
    configuredLanguage: LanguageHint | null = null,
  ) {
    const grouped = new Map<string, AiTextSuggestionCandidate>();

    for (const asset of assets) {
      if (
        asset.performanceLabel !== 'LOW' ||
        (asset.fieldType !== 'HEADLINE' && asset.fieldType !== 'DESCRIPTION') ||
        !asset.text.trim()
      ) {
        continue;
      }

      const fieldType = asset.fieldType as AiTextSuggestionCandidate['fieldType'];
      const text = asset.text.trim();
      const sourceLanguage = this.detectTextLanguage(text);
      const targetLanguage = configuredLanguage ?? this.resolveAssetTargetLanguage(
        sourceLanguage,
        adGroupFallbackLanguage,
        guidance,
      );
      const key = `${fieldType}:${text.toLowerCase()}`;
      const current =
        grouped.get(key) ??
        {
          key,
          fieldType,
          text,
          sourceLanguageCode: sourceLanguage.code,
          sourceLanguageName: sourceLanguage.name,
          targetLanguageCode: targetLanguage.code,
          targetLanguageName: targetLanguage.name,
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversionValue: 0,
          ctr: 0,
          roas: 0,
          maxLength: fieldType === 'HEADLINE' ? 30 : 90,
        };

      current.impressions += asset.impressions;
      current.clicks += asset.clicks;
      current.cost += asset.cost;
      current.conversionValue += asset.conversionValue;
      current.ctr = current.impressions > 0 ? current.clicks / current.impressions : 0;
      current.roas = current.cost > 0 ? current.conversionValue / current.cost : 0;
      grouped.set(key, current);
    }

    return Array.from(grouped.values()).sort((a, b) => b.impressions - a.impressions);
  }

  private normalizeAiTextSuggestions(
    suggestions: Array<Record<string, unknown>>,
    candidates: AiTextSuggestionCandidate[],
  ) {
    const candidateMap = new Map(candidates.map((candidate) => [candidate.key, candidate]));
    const usedSuggestions = new Set<string>();

    return suggestions
      .map((suggestion) => {
        const key = String(suggestion.key ?? '');
        const candidate = candidateMap.get(key);

        if (!candidate) {
          return null;
        }

        const replacement = this.fitGoogleAdsCopy(
          String(suggestion.suggestion ?? ''),
          candidate.maxLength,
        );
        const normalizedReplacement = this.normalizeSuggestionCopy(replacement);
        const normalizedCurrent = this.normalizeSuggestionCopy(candidate.text);
        const languageMismatch = this.isReplacementLanguageMismatch(
          replacement,
          candidate.targetLanguageCode,
        );

        if (
          !replacement ||
          normalizedReplacement === normalizedCurrent
        ) {
          return null;
        }

        const finalReplacement = languageMismatch || usedSuggestions.has(normalizedReplacement)
          ? this.buildFallbackCopySuggestion(candidate, usedSuggestions)
          : replacement;
        const normalizedFinalReplacement = this.normalizeSuggestionCopy(finalReplacement);

        if (!finalReplacement || usedSuggestions.has(normalizedFinalReplacement)) {
          return null;
        }

        usedSuggestions.add(normalizedFinalReplacement);

        return {
          key,
          fieldType: candidate.fieldType,
          text: candidate.text,
          impressions: candidate.impressions,
          clicks: candidate.clicks,
          cost: candidate.cost,
          roas: candidate.roas,
          suggestion: finalReplacement,
          priority: String(suggestion.priority ?? 'Test'),
          rationale: String(suggestion.rationale ?? '').trim(),
          confidence: String(suggestion.confidence ?? 'Medium'),
        };
      })
      .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion));
  }

  private buildFallbackTextSuggestions(
    candidates: AiTextSuggestionCandidate[],
    meta: {
      model: string;
      source: AiProviderConfig['source'];
      adGroupId: string;
      timeRange: string;
      targetLanguageCode: string;
      targetLanguageName: string;
      languageSource: 'AD_GROUP_CONFIG' | 'DETECTED';
      adGroupTopic: string | null;
    },
  ) {
    const usedSuggestions = new Set<string>();
    const fallbackSuggestions = candidates
      .map((candidate) => {
        const suggestion = this.buildFallbackCopySuggestion(candidate, usedSuggestions);
        const normalizedSuggestion = this.normalizeSuggestionCopy(suggestion);

        if (!suggestion || usedSuggestions.has(normalizedSuggestion)) {
          return null;
        }

        usedSuggestions.add(normalizedSuggestion);

        return {
          key: candidate.key,
          fieldType: candidate.fieldType,
          text: candidate.text,
          impressions: candidate.impressions,
          clicks: candidate.clicks,
          cost: candidate.cost,
          roas: candidate.roas,
          suggestion,
          priority: 'Fix first',
          rationale: this.buildFallbackRationale(candidate),
          confidence: candidate.impressions >= 50 ? 'Medium' : 'Low',
        };
      })
      .filter((suggestion): suggestion is NonNullable<typeof suggestion> => {
        if (!suggestion?.suggestion) {
          return false;
        }

        return (
          this.normalizeSuggestionCopy(suggestion.suggestion) !==
          this.normalizeSuggestionCopy(suggestion.text)
        );
      });

    return {
      summary: {
        headline: 'Backup text suggestions',
        approach: 'Generated varied replacement copy from LOW-label text assets.',
      },
      suggestions: fallbackSuggestions,
      model: meta.model,
      source: meta.source,
      adGroupId: meta.adGroupId,
      timeRange: meta.timeRange,
      targetLanguageCode: meta.targetLanguageCode,
      targetLanguageName: meta.targetLanguageName,
      languageSource: meta.languageSource,
      adGroupTopic: meta.adGroupTopic,
    };
  }

  private buildFallbackCopySuggestion(
    candidate: AiTextSuggestionCandidate,
    usedSuggestions = new Set<string>(),
  ) {
    const current = this.normalizeSuggestionCopy(candidate.text);
    const source = candidate.text.toLowerCase();
    const localizedOptions = this.getLocalizedFallbackCopyOptions(candidate, source);
    if (localizedOptions.length === 0 && candidate.targetLanguageCode !== 'en') {
      return '';
    }
    const baseOptions =
      localizedOptions.length > 0
        ? localizedOptions
        : this.getEnglishFallbackCopyOptions(candidate, source);
    const options = this.uniqueStrings(baseOptions);
    const startIndex = this.stableIndex(`${candidate.key}:${candidate.text}`, options.length);

    for (let offset = 0; offset < options.length; offset += 1) {
      const option = options[(startIndex + offset) % options.length];
      const fitted = this.fitGoogleAdsCopy(option, candidate.maxLength);
      const normalized = this.normalizeSuggestionCopy(fitted);

      if (fitted && normalized !== current && !usedSuggestions.has(normalized)) {
        return fitted;
      }
    }

    return '';
  }

  private getLocalizedFallbackCopyOptions(
    candidate: AiTextSuggestionCandidate,
    source: string,
  ) {
    const languageCode = candidate.targetLanguageCode.toLowerCase();

    if (languageCode === 'ja') {
      const headlineOptions = [
        source.includes('エアコン') ? 'スマホでエアコン操作' : '',
        source.includes('リモコン') ? 'リモコン操作をスマホで' : '',
        source.includes('温度') ? '温度調整をすぐに' : '',
        'エアコンを簡単操作',
        'スマホで温度調整',
        'リモコン操作を簡単に',
        'すぐにエアコン操作',
        '快適な温度を手元で',
      ];
      const descriptionOptions = [
        'スマホでエアコンをすばやく操作できます。',
        '温度調整やリモコン操作をアプリで簡単に。',
        '外出先でもエアコン操作をわかりやすく。',
        '面倒な設定なしで快適な温度に調整できます。',
        'スマホを使ってエアコン操作をもっと手軽に。',
        'いつでも温度調整をスムーズに始められます。',
      ];

      return candidate.fieldType === 'HEADLINE' ? headlineOptions : descriptionOptions;
    }

    if (languageCode === 'de') {
      const headlineOptions = [
        source.includes('klima') ? 'Klima per App steuern' : '',
        source.includes('fernbedien') ? 'AC Fernbedienung App' : '',
        source.includes('kostenlos') ? 'Kostenlose AC Steuerung' : '',
        'AC Steuerung per Handy',
        'Klimaanlage schnell steuern',
        'AC Remote einfach testen',
        'Handy als AC Fernbedienung',
        'Klima smart bedienen',
      ];
      const descriptionOptions = [
        'Steuere deine Klimaanlage bequem per Handy.',
        'Nutze dein Handy als einfache AC Fernbedienung.',
        'Teste eine schnelle App zur Steuerung deiner Klimaanlage.',
        'Starte die AC Steuerung direkt auf deinem Smartphone.',
        'Bediene deine Klimaanlage einfach, schnell und mobil.',
        'Mach dein Handy zur praktischen Fernbedienung fuer AC.',
      ];

      return candidate.fieldType === 'HEADLINE' ? headlineOptions : descriptionOptions;
    }

    if (languageCode === 'es') {
      const headlineOptions = [
        source.includes('aire') ? 'Controla tu aire fácil' : '',
        source.includes('móvil') || source.includes('movil') ? 'Mando de aire en móvil' : '',
        source.includes('gratis') ? 'Control de aire gratis' : '',
        'Control remoto del aire',
        'Controla el aire desde móvil',
        'Aire acondicionado fácil',
        'Mando universal de aire',
        'Ajusta tu aire al instante',
      ];
      const descriptionOptions = [
        'Controla tu aire acondicionado desde el móvil.',
        'Usa tu teléfono como mando de aire rápido y sencillo.',
        'Prueba una app fácil para manejar tu climatizador.',
        'Ajusta tu aire desde el móvil en pocos segundos.',
        'Convierte tu teléfono en un mando de aire práctico.',
        'Gestiona la temperatura con una app clara y simple.',
      ];

      return candidate.fieldType === 'HEADLINE' ? headlineOptions : descriptionOptions;
    }

    if (languageCode === 'pt') {
      const headlineOptions = [
        source.includes('antiv') ? 'Antivirus gratis e rapido' : '',
        source.includes('protec') ? 'Protecao gratis no celular' : '',
        source.includes('escane') ? 'Escaneamento rapido gratis' : '',
        'Proteja seu celular gratis',
        'Limpeza e protecao gratis',
        'Seguranca movel gratuita',
        'Remova virus do celular',
        'Protecao em tempo real',
      ];
      const descriptionOptions = [
        'Proteja seu dispositivo com escaneamento rapido e gratis.',
        'Mantenha seu celular limpo contra virus, malware e spyware.',
        'Escaneie ameacas em tempo real com protecao gratuita.',
        'Use uma protecao simples para manter seu aparelho seguro.',
        'Remova riscos do celular com verificacao rapida e gratis.',
        'Protecao antivirus gratis para uso diario no celular.',
      ];

      return candidate.fieldType === 'HEADLINE' ? headlineOptions : descriptionOptions;
    }

    if (languageCode === 'fr') {
      const headlineOptions = [
        source.includes('clim') ? 'Controle climatiseur facile' : '',
        source.includes('telecommande') ? 'Telecommande AC mobile' : '',
        source.includes('universelle') ? 'Telecommande universelle AC' : '',
        'Controlez votre climatiseur',
        'Commande AC sur telephone',
        'Clim facile a controler',
        'App telecommande climatiseur',
        'Reglez la clim a distance',
      ];
      const descriptionOptions = [
        'Controlez votre climatiseur facilement depuis votre telephone.',
        'Transformez votre mobile en telecommande AC simple et rapide.',
        'Reglez la clim a distance avec une application claire.',
        'Pilotez votre climatiseur depuis le telephone en quelques secondes.',
        'Utilisez une telecommande AC pratique directement sur mobile.',
        'Ajustez votre climatiseur facilement ou que vous soyez.',
      ];

      return candidate.fieldType === 'HEADLINE' ? headlineOptions : descriptionOptions;
    }

    if (languageCode === 'ar') {
      const headlineOptions = [
        source.includes('مكيف') ? 'تحكم بالمكيف من هاتفك' : '',
        source.includes('الهواء') ? 'ريموت مكيف على الهاتف' : '',
        source.includes('التحكم') ? 'تحكم ذكي بالمكيف' : '',
        'شغل المكيف بسهولة',
        'ريموت مكيف شامل',
        'تحكم بالمكيف عن بعد',
        'تطبيق ريموت للمكيف',
        'اضبط المكيف من هاتفك',
      ];
      const descriptionOptions = [
        'تحكم بالمكيف بسهولة من هاتفك في أي وقت.',
        'حوّل هاتفك إلى ريموت مكيف سريع وسهل الاستخدام.',
        'اضبط درجة الحرارة وشغل المكيف من تطبيق واحد.',
        'استخدم هاتفك للتحكم بالمكيف عن بعد بخطوات بسيطة.',
        'تطبيق واضح يساعدك على تشغيل المكيف والتحكم به.',
        'تحكم ذكي بالمكيف من الهاتف دون تعقيد.',
      ];

      return candidate.fieldType === 'HEADLINE' ? headlineOptions : descriptionOptions;
    }

    return [];
  }

  private getEnglishFallbackCopyOptions(
    candidate: AiTextSuggestionCandidate,
    source: string,
  ) {
    const theme = this.inferCreativeTheme(source);
    const isHeadline = candidate.fieldType === 'HEADLINE';

    if (theme === 'ac') {
      return isHeadline
        ? [
            source.includes('phone') ? 'Control AC From Phone' : '',
            source.includes('remote') ? 'AC Remote App' : '',
            'Control Your AC Fast',
            'Smart AC Remote App',
            'Adjust AC From Phone',
            'Easy AC Remote Control',
            'AC Control Made Easy',
            'Cool Room In One Tap',
          ]
        : [
            'Control your AC from your phone in seconds.',
            'Use your phone as a simple AC remote control.',
            'Adjust room temperature quickly with one app.',
            'Manage your air conditioner without the remote.',
            'Set a comfortable room temperature from your phone.',
            'Turn your phone into an easy air conditioner remote.',
          ];
    }

    if (theme === 'security') {
      return isHeadline
        ? [
            'Protect Your Phone Free',
            'Fast Antivirus Scan',
            'Clean Phone Security',
            'Stop Malware Fast',
            'Free Virus Cleaner',
            'Phone Protection App',
          ]
        : [
            'Scan your phone quickly for viruses and malware.',
            'Keep your device cleaner with simple mobile protection.',
            'Find risky files fast with a free security scan.',
            'Protect your phone from threats in just a few taps.',
            'Clean malware and spyware with an easy mobile tool.',
          ];
    }

    if (theme === 'led') {
      return isHeadline
        ? [
            source.includes('phone') ? 'LED Text On Phone' : '',
            source.includes('free') ? 'Free Scrolling Text' : '',
            source.includes('event') || source.includes('part') ? 'LED Signs For Events' : '',
            source.includes('board') ? 'LED Board Maker' : '',
            'Free LED Text App',
            'LED Scroller Maker',
            'Make LED Signs Free',
            'Scrolling Text App',
            'Create LED Text Fast',
            'LED Banner On Phone',
          ]
        : [
            source.includes('phone') ? 'Create scrolling LED text right on your phone.' : '',
            source.includes('event') || source.includes('part')
              ? 'Make bright LED messages for events, parties, and shops.'
              : '',
            source.includes('free') ? 'Create free LED-style scrolling text in seconds.' : '',
            source.includes('board') ? 'Build a bright LED board message from your phone.' : '',
            'Create scrolling LED messages on your phone in seconds.',
            'Design custom LED signs with simple colors and effects.',
            'Turn your phone into a clear scrolling LED display.',
            'Show bold LED messages anywhere with a free app.',
          ];
    }

    return isHeadline
      ? [
          'Try The App Today',
          'Simple App Control',
          'Fast Mobile Tool',
          'Easy App Experience',
          'Get Started Fast',
        ]
      : [
          'Use the app to complete the task quickly and easily.',
          'Try a simpler mobile experience for everyday use.',
          'Get started in seconds with clear app controls.',
          'Make the task easier with a simple mobile app.',
        ];
  }

  private inferCreativeTheme(text: string) {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (
      /(\bled\b|scroller|scrolling|sign|banner|board|message|display)/i.test(normalized)
    ) {
      return 'led';
    }

    if (
      /(\bac\b|air conditioner|conditioner|remote|climat|climatisation|klima|aire|acondicionado|condicionado|controle remoto|mando|telecommande|エアコン|リモコン|温度|空調|مكيف|الهواء)/i.test(text) ||
      /(klimaanlage|fernbedienung|steuerung|climatiseur|temperatura)/i.test(normalized)
    ) {
      return 'ac';
    }

    if (/(antivirus|virus|malware|spyware|security|protect|protec|scan|escane|limp|clean)/i.test(normalized)) {
      return 'security';
    }

    return 'generic';
  }

  private buildFallbackRationale(candidate: AiTextSuggestionCandidate) {
    const signals: string[] = [];

    if (candidate.impressions <= 30) {
      signals.push(`low views (${candidate.impressions})`);
    }

    if (candidate.ctr <= 0.08) {
      signals.push(`CTR ${(candidate.ctr * 100).toFixed(2)}%`);
    }

    if (candidate.roas <= 0) {
      signals.push('ROAS is 0');
    }

    return signals.length > 0
      ? `Suggested because Google Ads labels this ${candidate.fieldType.toLowerCase()} LOW; context: ${signals.join(', ')}.`
      : `Suggested because Google Ads labels this ${candidate.fieldType.toLowerCase()} LOW.`;
  }

  private uniqueStrings(values: string[]) {
    const seen = new Set<string>();

    return values.filter((value) => {
      const normalized = this.normalizeSuggestionCopy(value);

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  private normalizeSuggestionCopy(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private stableIndex(value: string, modulo: number) {
    if (modulo <= 0) {
      return 0;
    }

    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }

    return hash % modulo;
  }

  private resolveAdGroupTargetLanguage(
    assets: AssetPerformance[],
    guidance: CreativeGuidance | null,
  ): LanguageHint {
    const configuredLanguage =
      guidance?.languageStrategy === 'FIXED'
        ? this.normalizeConfiguredLanguageCode(guidance.targetLanguage)
        : null;
    if (configuredLanguage) {
      return {
        code: configuredLanguage,
        name: this.languageName(configuredLanguage),
        confidence: 'HIGH',
      };
    }

    const scores = new Map<string, { hint: LanguageHint; score: number }>();

    for (const asset of assets) {
      const text = [asset.text, asset.name].filter(Boolean).join(' ').trim();
      if (!text) {
        continue;
      }

      const hint = this.detectTextLanguage(text);
      const impressionWeight = Math.max(
        1,
        Math.log10(Math.max(Number(asset.impressions) || 0, 0) + 10),
      );
      const confidenceWeight =
        hint.confidence === 'HIGH' ? 2 : hint.confidence === 'MEDIUM' ? 1.25 : 0.5;
      const englishPenalty = hint.code === 'en' && hint.confidence !== 'HIGH' ? 0.45 : 1;
      const score = impressionWeight * confidenceWeight * englishPenalty;
      const current = scores.get(hint.code);

      scores.set(hint.code, {
        hint,
        score: (current?.score ?? 0) + score,
      });
    }

    const ranked = Array.from(scores.values()).sort((a, b) => b.score - a.score);
    const winner = ranked[0];
    if (!winner) {
      return { code: 'en', name: 'English', confidence: 'LOW' };
    }

    const runnerUpScore = ranked[1]?.score ?? 0;
    const confidence: LanguageHint['confidence'] =
      winner.score >= runnerUpScore * 1.4 && winner.score >= 3
        ? 'HIGH'
        : winner.score >= 2
          ? 'MEDIUM'
          : 'LOW';

    return {
      code: winner.hint.code,
      name: winner.hint.name,
      confidence,
    };
  }

  private resolveAssetTargetLanguage(
    sourceLanguage: LanguageHint,
    adGroupFallbackLanguage: LanguageHint,
    guidance: CreativeGuidance | null,
    preferSourceLanguage = true,
  ): LanguageHint {
    // The visible copy on a text asset is authoritative. A workspace-level fixed
    // language is only a fallback for assets whose language cannot be identified.
    if (preferSourceLanguage && sourceLanguage.confidence !== 'LOW') {
      return sourceLanguage;
    }

    const fixedLanguage =
      guidance?.languageStrategy === 'FIXED'
        ? this.normalizeConfiguredLanguageCode(guidance.targetLanguage)
        : null;

    if (fixedLanguage) {
      return {
        code: fixedLanguage,
        name: this.languageName(fixedLanguage),
        confidence: 'HIGH',
      };
    }

    if (preferSourceLanguage) {
      if (sourceLanguage.code === 'en' && sourceLanguage.confidence === 'LOW') {
        return {
          code: 'auto',
          name: 'same visible language/script as current text',
          confidence: 'LOW',
        };
      }

      return sourceLanguage;
    }

    return sourceLanguage.confidence === 'LOW'
      ? adGroupFallbackLanguage
      : sourceLanguage;
  }

  private detectTextLanguage(text: string): LanguageHint {
    const raw = text.trim();
    if (!raw) {
      return { code: 'en', name: 'English', confidence: 'LOW' };
    }

    const scriptLanguage = this.detectLanguageByScript(raw);
    if (scriptLanguage) return scriptLanguage;
    const latinCharacterLanguage = this.detectLatinLanguageByCharacters(raw);
    if (latinCharacterLanguage) return latinCharacterLanguage;

    const normalized = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const words = ` ${normalized.replace(/[^a-z0-9\u00df]+/g, ' ')} `;
    const languageScores = [
      {
        code: 'en',
        score: this.scoreLanguageTokens(words, [
          'the',
          'your',
          'you',
          'with',
          'from',
          'for',
          'and',
          'free',
          'easy',
          'fast',
          'phone',
          'mobile',
          'screen',
          'control',
          'remote',
          'protect',
          'upgrade',
          'instantly',
          'beautiful',
          'create',
          'use',
          'try',
          'get',
        ]),
      },
      {
        code: 'de',
        score:
          this.scoreLanguageTokens(words, [
            'der',
            'die',
            'das',
            'und',
            'mit',
            'fuer',
            'fur',
            'kostenlos',
            'kostenlose',
            'gratis',
            'fernbedienung',
            'steuerung',
            'klimaanlage',
            'klima',
            'infrarot',
            'testen',
            'starten',
            'nutzen',
            'handy',
            'steuern',
            'bedienen',
          ]) + (/[\u00e4\u00f6\u00fc\u00df]/i.test(raw) ? 2 : 0),
      },
      {
        code: 'es',
        score:
          this.scoreLanguageTokens(words, [
            'para',
            'tu',
            'aire',
            'movil',
            'mando',
            'controla',
            'gratis',
            'facil',
            'usar',
            'rapido',
            'desde',
            'cualquier',
            'convierte',
            'descarga',
            'acondicionado',
            'clic',
            'toque',
          ]) + (/[\u00bf\u00a1]/u.test(raw) ? 2 : 0),
      },
      {
        code: 'fr',
        score:
          this.scoreLanguageTokens(words, [
            'avec',
            'pour',
            'votre',
            'vos',
            'sur',
            'facile',
            'rapide',
            'gratuit',
            'gratuite',
            'telecommande',
            'universelle',
            'climatiseur',
            'climatisation',
            'clim',
            'commande',
            'telephone',
            'mobile',
            'utiliser',
            'controle',
            'controlez',
            'reglez',
            'distance',
            'application',
            'bout',
            'doigts',
          ]) + (/[\u00e9\u00e8\u00ea\u00eb\u00e0\u00e2\u00ee\u00ef\u00f4\u00fb\u00f9\u00e7]/i.test(raw) ? 2 : 0),
      },
      {
        code: 'pt',
        score:
          this.scoreLanguageTokens(words, [
            'para',
            'gratis',
            'gratuito',
            'gratuita',
            'facil',
            'rapido',
            'controle',
            'remoto',
            'celular',
            'dispositivo',
            'protecao',
            'proteger',
            'protegido',
            'antivirus',
            'malware',
            'spyware',
            'escaneamento',
            'escanear',
            'tempo',
            'real',
            'limpo',
            'elimine',
            'virus',
            'graca',
            'sem',
            'custo',
            'totalmente',
            'seu',
            'sua',
          ]) + (/[\u00e3\u00f5\u00e7]/i.test(raw) ? 3 : 0) + (/\bgrátis\b/i.test(raw) ? 3 : 0),
      },
      {
        code: 'it',
        score: this.scoreLanguageTokens(words, [
          'per',
          'gratis',
          'telecomando',
          'condizionatore',
          'telefono',
          'facile',
          'rapido',
          'controllo',
        ]),
      },
      {
        code: 'id',
        score: this.scoreLanguageTokens(words, [
          'dan',
          'dari',
          'untuk',
          'dengan',
          'mudah',
          'gratis',
          'gunakan',
          'pakai',
          'kendali',
          'kontrol',
          'lewat',
          'ponsel',
          'rumah',
          'atur',
          'ubah',
          'suhu',
          'jarak',
          'aplikasi',
          'perangkat',
          'cepat',
          'praktis',
        ]),
      },
      {
        code: 'ms',
        score: this.scoreLanguageTokens(words, [
          'yang',
          'anda',
          'dengan',
          'untuk',
          'mudah',
          'percuma',
          'gunakan',
          'telefon',
          'kawalan',
          'penghawa',
          'dingin',
          'suhu',
          'segera',
        ]),
      },
      {
        code: 'nl',
        score: this.scoreLanguageTokens(words, [
          'de',
          'het',
          'een',
          'met',
          'voor',
          'van',
          'gratis',
          'snel',
          'eenvoudig',
          'telefoon',
          'bedien',
          'afstandsbediening',
        ]),
      },
    ].sort((a, b) => b.score - a.score);
    const winner = languageScores[0];

    if (winner.score >= 2) {
      return {
        code: winner.code,
        name: this.languageName(winner.code),
        confidence: 'HIGH',
      };
    }

    if (winner.score === 1) {
      return {
        code: winner.code,
        name: this.languageName(winner.code),
        confidence: 'MEDIUM',
      };
    }

    return { code: 'en', name: 'English', confidence: 'LOW' };
  }

  private detectLanguageByScript(text: string): LanguageHint | null {
    const scriptHints: Array<{ pattern: RegExp; code: string }> = [
      { pattern: /[\uac00-\ud7af]/u, code: 'ko' },
      { pattern: /[\u3040-\u30ff]/u, code: 'ja' },
      { pattern: /[\u3400-\u9fff]/u, code: 'zh' },
      { pattern: /[\u0600-\u06ff]/u, code: 'ar' },
      { pattern: /[\u0590-\u05ff]/u, code: 'he' },
      { pattern: /[\u0370-\u03ff]/u, code: 'el' },
      { pattern: /[\u0400-\u04ff]/u, code: 'ru' },
      { pattern: /[\u0530-\u058f]/u, code: 'hy' },
      { pattern: /[\u0780-\u07bf]/u, code: 'dv' },
      { pattern: /[\u0900-\u097f]/u, code: 'hi' },
      { pattern: /[\u0980-\u09ff]/u, code: 'bn' },
      { pattern: /[\u0a00-\u0a7f]/u, code: 'pa' },
      { pattern: /[\u0a80-\u0aff]/u, code: 'gu' },
      { pattern: /[\u0b00-\u0b7f]/u, code: 'or' },
      { pattern: /[\u0b80-\u0bff]/u, code: 'ta' },
      { pattern: /[\u0c00-\u0c7f]/u, code: 'te' },
      { pattern: /[\u0c80-\u0cff]/u, code: 'kn' },
      { pattern: /[\u0d00-\u0d7f]/u, code: 'ml' },
      { pattern: /[\u0d80-\u0dff]/u, code: 'si' },
      { pattern: /[\u0e00-\u0e7f]/u, code: 'th' },
      { pattern: /[\u0e80-\u0eff]/u, code: 'lo' },
      { pattern: /[\u0f00-\u0fff]/u, code: 'bo' },
      { pattern: /[\u1000-\u109f]/u, code: 'my' },
      { pattern: /[\u10a0-\u10ff]/u, code: 'ka' },
      { pattern: /[\u1200-\u137f]/u, code: 'am' },
      { pattern: /[\u1780-\u17ff]/u, code: 'km' },
      { pattern: /[\u1800-\u18af]/u, code: 'mn' },
      { pattern: /[\u1b00-\u1b7f]/u, code: 'ban' },
      { pattern: /[\u1b80-\u1bbf]/u, code: 'su' },
      { pattern: /[\u1c50-\u1c7f]/u, code: 'sat' },
      { pattern: /[\ua980-\ua9df]/u, code: 'jv' },
      { pattern: /[\uabc0-\uabff]/u, code: 'mni' },
    ];
    const match = scriptHints.find((item) => item.pattern.test(text));

    return match
      ? {
          code: match.code,
          name: this.languageName(match.code),
          confidence: 'HIGH',
        }
      : null;
  }

  private detectLatinLanguageByCharacters(text: string): LanguageHint | null {
    const characterHints: Array<{ pattern: RegExp; code: string }> = [
      { pattern: /[ăâđêôơưĂÂĐÊÔƠƯ]/u, code: 'vi' },
      { pattern: /[ğĞıİşŞ]/u, code: 'tr' },
      { pattern: /[ąćęłńśźżĄĆĘŁŃŚŹŻ]/u, code: 'pl' },
      { pattern: /[ăâîșşțţĂÂÎȘŞȚŢ]/u, code: 'ro' },
      { pattern: /[őűŐŰ]/u, code: 'hu' },
      { pattern: /[ěščřžůďťňĚŠČŘŽŮĎŤŇ]/u, code: 'cs' },
      { pattern: /[ĺľŕôäňôĹĽŔÔÄŇ]/u, code: 'sk' },
      { pattern: /[æøåÆØÅ]/u, code: 'da' },
      { pattern: /[ðþÐÞ]/u, code: 'is' },
      { pattern: /[ñÑ¿¡]/u, code: 'es' },
      { pattern: /[ãõÃÕçÇ]/u, code: 'pt' },
      { pattern: /[éèêëàâîïôûùçÉÈÊËÀÂÎÏÔÛÙÇ]/u, code: 'fr' },
    ];
    const match = characterHints.find((item) => item.pattern.test(text));

    return match
      ? {
          code: match.code,
          name: this.languageName(match.code),
          confidence: 'HIGH',
        }
      : null;
  }

  private scoreLanguageTokens(words: string, tokens: string[]) {
    return tokens.reduce((score, token) => {
      return words.includes(` ${token} `) ? score + 1 : score;
    }, 0);
  }

  private normalizeConfiguredLanguageCode(value?: string | null) {
    const normalized = String(value ?? '').trim().toLowerCase();

    if (!normalized || normalized === 'detect_from_asset' || normalized === 'auto') {
      return null;
    }

    const aliases: Record<string, string> = {
      english: 'en',
      german: 'de',
      deutsch: 'de',
      spanish: 'es',
      espanol: 'es',
      korean: 'ko',
      chinese: 'zh',
      japanese: 'ja',
      french: 'fr',
      portuguese: 'pt',
      italian: 'it',
      arabic: 'ar',
      hebrew: 'he',
      greek: 'el',
      russian: 'ru',
      hindi: 'hi',
      thai: 'th',
      vietnamese: 'vi',
      turkish: 'tr',
      polish: 'pl',
    };

    return aliases[normalized] ?? normalized.slice(0, 2);
  }

  private languageName(code: string) {
    const names: Record<string, string> = {
      en: 'English',
      de: 'German',
      es: 'Spanish',
      ko: 'Korean',
      zh: 'Chinese',
      ja: 'Japanese',
      fr: 'French',
      pt: 'Portuguese',
      it: 'Italian',
      ar: 'Arabic',
      he: 'Hebrew',
      el: 'Greek',
      ru: 'Russian/Cyrillic',
      hy: 'Armenian',
      dv: 'Dhivehi',
      hi: 'Hindi/Devanagari',
      bn: 'Bengali',
      pa: 'Punjabi/Gurmukhi',
      gu: 'Gujarati',
      or: 'Odia',
      ta: 'Tamil',
      te: 'Telugu',
      kn: 'Kannada',
      ml: 'Malayalam',
      si: 'Sinhala',
      th: 'Thai',
      lo: 'Lao',
      bo: 'Tibetan',
      my: 'Burmese/Myanmar',
      ka: 'Georgian',
      am: 'Amharic/Ethiopic',
      km: 'Khmer',
      mn: 'Mongolian',
      ban: 'Balinese',
      su: 'Sundanese',
      sat: 'Santali',
      jv: 'Javanese',
      mni: 'Meitei',
      vi: 'Vietnamese',
      tr: 'Turkish',
      pl: 'Polish',
      ro: 'Romanian',
      hu: 'Hungarian',
      cs: 'Czech',
      sk: 'Slovak',
      da: 'Danish/Nordic',
      is: 'Icelandic',
    };

    return names[code] ?? code.toUpperCase();
  }

  private buildOpenAiTextSuggestionPrompt(
    candidates: AiTextSuggestionCandidate[],
    context: {
      customerId: string;
      adGroupId: string;
      timeRange: string;
      targetLanguageCode: string;
      targetLanguageName: string;
      targetLanguageConfidence: LanguageHint['confidence'];
      totalImpressions: number;
      totalClicks: number;
      totalCost: number;
      avgCtr: number;
      avgRoas: number;
      automationLanguageCode: string | null;
      automationTopic: string | null;
    },
    guidance: CreativeGuidance | null,
    history: CreativeHistory,
  ) {
    return [
      'You are a Senior Google Ads Copywriter specializing in conversion-focused mobile app advertising.',
      'Your task is to replace underperforming headlines and descriptions with specific, persuasive, policy-safe copy.',
      'Return one replacement for every supplied LOW-label candidate. The JSON schema is the final output contract; do not add commentary outside it.',
      '',
      'COPY QUALITY RULES:',
      '1. Write natural native copy that sounds written by an experienced local copywriter, not generic AI text.',
      '2. Focus on a concrete customer benefit, desired outcome, relevant pain point, meaningful differentiator, verifiable proof, real offer, or clear action.',
      '3. Prefer specific and immediately understandable wording. Describe customer value rather than merely naming a feature.',
      '4. Never invent prices, discounts, statistics, awards, guarantees, product capabilities, audiences, pain points, or competitive claims that are absent from the supplied policy/context/current copy.',
      '5. Avoid empty superlatives and cliches equivalent to “leading solution”, “best quality”, “great experience”, “breakthrough”, “perfect”, or “elevate your experience” unless supplied facts objectively support them.',
      '6. Do not paraphrase the same message repeatedly. Across the returned set, vary the persuasive angle and sentence structure while keeping each item relevant to its source asset.',
      '7. Use keywords naturally. Never keyword-stuff, use all caps, repeat exclamation marks, create false urgency, or make unverifiable promises.',
      '8. A headline must communicate one clear idea and make sense on its own. A description must add useful detail and, when supported by context, end with an appropriate action.',
      '9. Do not copy the current text, rejected content, or any historical suggestion verbatim. Do not produce variants that differ only by one weak synonym.',
      '10. Before returning each item, silently verify relevance, specificity, uniqueness, factual support, policy safety, native fluency, and character length. Rewrite any item that fails.',
      '',
      'LANGUAGE AND MARKET RULES:',
      `User-configured ad group language: ${context.automationLanguageCode ?? 'not configured'}. When configured, this is the REQUIRED output language for every candidate and overrides automatic detection and the language of currentText.`,
      `User-configured ad group topic: ${context.automationTopic ?? 'not configured'}. Every suggestion must stay relevant to this topic and must not invent unsupported product facts.`,
      `Ad group fallback language: ${context.targetLanguageName} (${context.targetLanguageCode}), confidence ${context.targetLanguageConfidence}.`,
      '1. If a user-configured ad group language is present, write every replacement in exactly that language. Keep only supplied brand/product names unchanged.',
      '2. A country/market is not a language. Use the candidate language for output and use market context only to localize vocabulary, tone, spelling, and conventions.',
      '3. Only when no user-configured language exists: detect currentText independently and use targetLanguage/currentText as the fallback authority.',
      '4. Never default to English merely because the brand, app name, or keyword is English. Do not translate into English or Spanish unless that candidate is already written in it.',
      '5. Do not mix languages in one item except for a supplied brand name, product name, or established term that should remain unchanged.',
      '6. Use native spelling, accents, grammar, punctuation, word order, and regional vocabulary. Do not produce a literal translation from English.',
      '',
      'GOOGLE ADS AND DATA RULES:',
      'Respect Google Ads length limits exactly: HEADLINE max 30 characters, DESCRIPTION max 90 characters.',
      'Use active KEYWORD, BRAND_TERM, and CTA policy terms only when they fit the source language and meaning. Never use NEGATIVE_KEYWORD or PROHIBITED_CLAIM terms.',
      'Do not reuse any exact text from suggestion history. Rejected text is banned. Approved/applied text can inspire style but must not be copied exactly.',
      'Treat creative policy and term data as the only source of product facts, brand terms, offers, required wording, and prohibited wording.',
      'Use performance metrics only to understand priority and weakness; never turn those metrics into an advertising claim.',
      'For rationale, briefly state the customer-focused angle and why it is stronger than the current text. Do not claim that performance is guaranteed.',
      'For summary, keep headline and approach under 8 words.',
      '',
      `Creative policy and term database: ${JSON.stringify(guidance)}`,
      `Suggestion history to avoid: ${JSON.stringify(history)}`,
      `Context: ${JSON.stringify(context)}`,
      `LOW-label text candidates sorted by views: ${JSON.stringify(
        candidates.map((candidate) => ({
          key: candidate.key,
          fieldType: candidate.fieldType,
          currentText: candidate.text,
          sourceLanguage: candidate.sourceLanguageName,
          sourceLanguageConfidence: candidate.sourceLanguageCode === 'en' ? 'low-if-auto' : 'detected',
          targetLanguage: candidate.targetLanguageName,
          targetLanguageCode: candidate.targetLanguageCode,
          maxLength: candidate.maxLength,
          impressions: candidate.impressions,
          clicks: candidate.clicks,
          ctr: candidate.ctr,
          cost: candidate.cost,
          roas: candidate.roas,
        })),
      )}`,
    ].join('\n');
  }

  private selectAiReviewAssets(assets: AssetPerformance[], limit: number) {
    const maxItems = Math.max(1, limit);
    const selected = new Map<string, AssetPerformance>();
    const lowLabelAssets = assets
      .filter((asset) => {
        const mediaType = this.getAssetMediaType(asset);
        const isReviewable =
          mediaType === 'Text' || mediaType === 'Image' || mediaType === 'Video';

        return isReviewable && asset.performanceLabel === 'LOW';
      })
      .sort((a, b) => {
        const mediaPriority =
          this.aiReviewMediaPriority(a) - this.aiReviewMediaPriority(b);
        if (mediaPriority !== 0) {
          return mediaPriority;
        }

        const impressionDiff = b.impressions - a.impressions;
        if (impressionDiff !== 0) {
          return impressionDiff;
        }

        const ctrDiff = a.ctr - b.ctr;
        if (ctrDiff !== 0) {
          return ctrDiff;
        }

        return a.score - b.score;
      });

    for (const mediaType of ['Text', 'Image', 'Video'] as const) {
      const asset = lowLabelAssets.find((candidate) => this.getAssetMediaType(candidate) === mediaType);
      if (asset) {
        selected.set(`${asset.id}:${asset.fieldType}:${asset.text}:${asset.resourceName}`, asset);
      }
    }

    for (const asset of lowLabelAssets) {
      if (selected.size >= maxItems) {
        break;
      }
      selected.set(`${asset.id}:${asset.fieldType}:${asset.text}:${asset.resourceName}`, asset);
    }

    return Array.from(selected.values()).slice(0, maxItems);
  }

  private aiReviewMediaPriority(asset: AssetPerformance) {
    const mediaType = this.getAssetMediaType(asset);

    if (mediaType === 'Text') {
      return 0;
    }

    if (mediaType === 'Image') {
      return 1;
    }

    if (mediaType === 'Video') {
      return 2;
    }

    return 3;
  }

  private buildOpenAiReviewContent(
    assets: AiCreativeAsset[],
    context: {
      customerId: string;
      adGroupId: string;
      timeRange: string;
      targetLanguageCode: string;
      targetLanguageName: string;
      targetLanguageConfidence: LanguageHint['confidence'];
      totalImpressions: number;
      totalClicks: number;
      totalCost: number;
      avgCtr: number;
      avgRoas: number;
    },
    guidance: CreativeGuidance | null,
    history: CreativeHistory,
  ) {
    const content: any[] = [
      {
        type: 'input_text',
        text: [
          'You are a senior mobile app performance creative strategist reviewing Google Ads app assets.',
          'Return only new ad copy or new image/video creative prompts. Do not explain.',
          `Ad group fallback language: ${context.targetLanguageName} (${context.targetLanguageCode}), confidence ${context.targetLanguageConfidence}.`,
          'Each supplied asset has its own targetLanguage. All replacementIdeas must be actual ad creative variants or production prompts written in that asset targetLanguage.',
          'If targetLanguage is AUTO or "same visible language/script as current text", infer the visible language/script from the current asset text and write replacementIdeas in that exact same language/script.',
          'The asset text is the final authority. If sourceLanguage or targetLanguage seems wrong, infer the visible language/script from the current asset text and write replacementIdeas in that same language.',
          'Do not translate into English or Spanish unless that specific asset text is already English or Spanish.',
          'Use natural native spelling, accents, punctuation, and word order for that language. Avoid English-style abbreviations like "AC" unless the current asset text already uses them.',
          'Review only the supplied assets. They were preselected only because Google Ads marked their performance_label as LOW.',
          'For HEADLINE and DESCRIPTION text assets, replacementIdeas must be concrete headline/description variants respecting Google Ads copy limits.',
          'For image assets, replacementIdeas must be short image generation prompts or thumbnail prompt ideas.',
          'For video assets, replacementIdeas must be short video prompt ideas: hook, first frame, on-screen copy, and action. Do not pretend you watched the full video.',
          'Use active KEYWORD, BRAND_TERM, and CTA policy terms only when relevant to the source language. Never use NEGATIVE_KEYWORD or PROHIBITED_CLAIM terms.',
          'Do not reuse any exact text from suggestion history. Rejected text is banned. Approved/applied text can inspire style but must not be copied exactly.',
          'Keep title under 8 words. Return diagnosis="", suggestion="", evidence=[].',
          '',
          `Creative policy and term database: ${JSON.stringify(guidance)}`,
          `Suggestion history to avoid: ${JSON.stringify(history)}`,
          `Context: ${JSON.stringify(context)}`,
          `LOW-label assets selected for review: ${JSON.stringify(
            assets.map((asset) => ({
              key: asset.key,
              id: asset.id,
              title: asset.title,
              mediaType: asset.mediaType,
              fieldType: asset.fieldType,
              type: asset.type,
              performanceLabel: asset.performanceLabel,
              text: asset.text,
              sourceLanguage: asset.sourceLanguageName,
              targetLanguage: asset.targetLanguageName,
              targetLanguageCode: asset.targetLanguageCode,
              previewUrl: asset.previewUrl,
              impressions: asset.impressions,
              clicks: asset.clicks,
              ctr: asset.ctr,
              cost: asset.cost,
              conversions: asset.conversions,
              conversionValue: asset.conversionValue,
              roas: asset.roas,
              currentAssessment: asset.assessment,
              currentReason: asset.reason,
            })),
          )}`,
        ].join('\n'),
      },
    ];

    for (const asset of assets.filter((item) => item.previewUrl).slice(0, 8)) {
      content.push({
        type: 'input_text',
        text: `Visual reference for asset ${asset.key} (${asset.mediaType}, ${asset.title})`,
      });
      content.push({
        type: 'input_image',
        image_url: asset.previewUrl,
        detail: 'low',
      });
    }

    return content;
  }

  private toAiCreativeAsset(
    asset: AssetPerformance,
    rank: number,
    adGroupFallbackLanguage: LanguageHint,
    guidance: CreativeGuidance | null,
  ): AiCreativeAsset {
    const sourceLanguage = this.detectTextLanguage(asset.text || asset.name || '');
    const targetLanguage = this.resolveAssetTargetLanguage(
      sourceLanguage,
      adGroupFallbackLanguage,
      guidance,
      Boolean(asset.text?.trim()),
    );

    return {
      key: `${rank}-${asset.id}-${asset.fieldType || asset.type || 'asset'}`,
      id: asset.id,
      title: asset.text || asset.name || asset.videoId || asset.imageUrl || asset.id,
      mediaType: this.getAssetMediaType(asset),
      fieldType: asset.fieldType,
      type: asset.type,
      performanceLabel: asset.performanceLabel || 'UNKNOWN',
      text: asset.text,
      sourceLanguageCode: sourceLanguage.code,
      sourceLanguageName: sourceLanguage.name,
      targetLanguageCode: targetLanguage.code,
      targetLanguageName: targetLanguage.name,
      previewUrl: this.getAssetPreviewUrl(asset),
      impressions: asset.impressions,
      clicks: asset.clicks,
      ctr: asset.ctr,
      cost: asset.cost,
      conversions: asset.conversions,
      conversionValue: asset.conversionValue,
      roas: asset.roas,
      score: asset.score,
      assessment: asset.assessment,
      action: asset.action,
      reason: asset.reason,
    };
  }

  private withAiReviewAssetDetails(
    review: { recommendations?: Array<Record<string, unknown>>; summary?: unknown },
    assets: AiCreativeAsset[],
    meta: {
      model: string;
      adGroupId: string;
      timeRange: string;
      source: AiProviderConfig['source'];
    },
  ) {
    const assetMap = new Map(assets.map((asset) => [asset.key, asset]));
    const recommendations = (review.recommendations ?? []).flatMap((recommendation) => {
      const asset = assetMap.get(String(recommendation.assetKey ?? ''));
      // Never expose or persist an AI recommendation that cannot be tied back to
      // one of the exact assets supplied in this review request.
      if (!asset) return [];
      const replacementIdeas = this.normalizeReviewReplacementIdeas(
        recommendation.replacementIdeas,
        asset,
      );

      return [{
        ...recommendation,
        title: asset.title,
        replacementIdeas,
        asset: {
              id: asset.id,
              title: asset.title,
              mediaType: asset.mediaType,
              fieldType: asset.fieldType,
              type: asset.type,
              text: asset.text,
              sourceLanguageCode: asset.sourceLanguageCode,
              sourceLanguageName: asset.sourceLanguageName,
              targetLanguageCode: asset.targetLanguageCode,
              targetLanguageName: asset.targetLanguageName,
              previewUrl: asset.previewUrl,
              impressions: asset.impressions,
              clicks: asset.clicks,
              ctr: asset.ctr,
              cost: asset.cost,
              conversions: asset.conversions,
              conversionValue: asset.conversionValue,
              roas: asset.roas,
              score: asset.score,
              performanceLabel: asset.performanceLabel,
            },
      }];
    });

    return {
      ...review,
      recommendations,
      model: meta.model,
      adGroupId: meta.adGroupId,
      timeRange: meta.timeRange,
      source: meta.source,
    };
  }

  private normalizeReviewReplacementIdeas(value: unknown, asset: AiCreativeAsset) {
    const ideas = Array.isArray(value)
      ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];
    const expectedLanguageCode =
      asset.targetLanguageCode === 'auto'
        ? asset.sourceLanguageCode
        : asset.targetLanguageCode;
    const hasLanguageMismatch = ideas.some((idea) =>
      this.isReplacementLanguageMismatch(idea, expectedLanguageCode),
    );

    if (ideas.length < 2 || hasLanguageMismatch) {
      return this.buildFallbackReviewIdeas(asset);
    }

    return ideas;
  }

  private isReplacementLanguageMismatch(text: string, targetLanguageCode: string) {
    if (targetLanguageCode === 'auto') {
      return false;
    }

    const language = this.detectTextLanguage(text);

    if (language.code === targetLanguageCode) {
      return false;
    }

    if (language.confidence !== 'LOW') {
      return true;
    }

    return targetLanguageCode !== 'en' && /[a-z]{3,}/i.test(text);
  }

  private buildMetricFallbackAiReview(assets: AiCreativeAsset[]) {
    const recommendations = assets.slice(0, 8).map((asset) => {
      const isText = asset.mediaType === 'Text';
      const isImage = asset.mediaType === 'Image';
      const title = isText
        ? `${asset.fieldType === 'HEADLINE' ? 'Headline' : 'Description'} ideas`
        : isImage
          ? 'Image prompts'
          : 'Video prompts';

      return {
        assetKey: asset.key,
        assetId: asset.id,
        mediaType: asset.mediaType,
        priority: 'Fix first',
        title,
        diagnosis: '',
        suggestion: '',
        replacementIdeas: this.buildFallbackReviewIdeas(asset),
        evidence: [],
        confidence: asset.impressions >= 50 ? 'Medium' : 'Low',
      };
    });

    return {
      summary: {
        headline: 'Fallback review from metrics',
        overview:
          'Gemini tra ve JSON loi, nen he thong tao review tu cac asset co Google Ads label LOW.',
        focus: 'Chi uu tien assets co Google Ads label LOW.',
      },
      recommendations,
    };
  }

  private buildFallbackReviewIdeas(asset: AiCreativeAsset) {
    const isText = asset.mediaType === 'Text';
    const isImage = asset.mediaType === 'Image';

    if (asset.targetLanguageCode === 'id' || asset.sourceLanguageCode === 'id') {
      if (isText) {
        return asset.fieldType === 'HEADLINE'
          ? ['Kontrol AC Lewat Ponsel', 'Atur AC dari Ponsel']
          : [
              'Kontrol AC dengan mudah langsung dari ponsel Anda.',
              'Atur suhu ruangan lebih praktis lewat aplikasi di ponsel.',
            ];
      }

      return isImage
        ? [
            'Tampilkan aplikasi kontrol AC dengan jelas di layar ponsel.',
            'Gunakan visual ruangan sejuk dengan kontrol suhu yang terlihat.',
          ]
        : [
            'Buka video dengan perubahan suhu AC dalam dua detik pertama.',
            'Tampilkan demo singkat: buka aplikasi, pilih AC, lalu atur suhu.',
          ];
    }

    if (asset.targetLanguageCode === 'ja') {
      if (isText) {
        return asset.fieldType === 'HEADLINE'
          ? ['スマホでエアコン操作', 'エアコンを簡単操作']
          : [
              'スマホでエアコンをすばやく操作できます。',
              '温度調整やリモコン操作をアプリで簡単に。',
            ];
      }

      return isImage
        ? [
            'スマホでエアコンを操作する画面を大きく見せる。',
            '涼しい部屋とアプリ操作を一枚で伝える。',
          ]
        : [
            '最初の2秒でエアコン操作の結果を見せる。',
            'アプリを開き、温度を変える短いデモを試す。',
          ];
    }

    if (asset.targetLanguageCode === 'de') {
      if (isText) {
        return asset.fieldType === 'HEADLINE'
          ? ['AC Steuerung per Handy', 'Klima per App steuern']
          : [
              'Steuere deine Klimaanlage bequem per Handy.',
              'Nutze dein Handy als einfache AC Fernbedienung.',
            ];
      }

      return isImage
        ? [
            'Zeige die App klar auf dem Handy mit kurzer CTA im Bild.',
            'Teste ein helles Produktbild mit sichtbarer AC Steuerung.',
          ]
        : [
            'Starte mit dem Ergebnis der AC Steuerung in den ersten 2 Sekunden.',
            'Teste einen kurzen Ablauf: App oeffnen, AC waehlen, Temperatur aendern.',
          ];
    }

    if (asset.targetLanguageCode === 'es') {
      if (isText) {
        return asset.fieldType === 'HEADLINE'
          ? ['Controla tu aire fácil', 'Mando de aire en móvil']
          : [
              'Controla tu aire acondicionado desde el móvil.',
              'Usa tu teléfono como mando de aire rápido y sencillo.',
            ];
      }

      return isImage
        ? [
            'Muestra la app en el móvil con una CTA corta y clara.',
            'Prueba una imagen luminosa con el control del aire visible.',
          ]
        : [
            'Abre con el resultado del control del aire en los primeros 2 segundos.',
            'Prueba un demo corto: abrir la app, elegir el aire y ajustar temperatura.',
          ];
    }

    if (asset.targetLanguageCode === 'pt') {
      if (isText) {
        return asset.fieldType === 'HEADLINE'
          ? ['Proteja seu celular gratis', 'Antivirus gratis e rapido']
          : [
              'Proteja seu dispositivo com escaneamento rapido e gratis.',
              'Mantenha seu celular limpo contra virus, malware e spyware.',
            ];
      }

      return isImage
        ? [
            'Mostre o app no celular com uma CTA curta e clara.',
            'Teste uma imagem limpa com protecao antivirus visivel.',
          ]
        : [
            'Abra com o resultado da protecao nos primeiros 2 segundos.',
            'Teste um demo curto: escanear, detectar risco e limpar o celular.',
          ];
    }

    if (asset.targetLanguageCode === 'fr') {
      if (isText) {
        return asset.fieldType === 'HEADLINE'
          ? ['Controlez votre climatiseur', 'Telecommande AC mobile']
          : [
              'Controlez votre climatiseur facilement depuis votre telephone.',
              'Transformez votre mobile en telecommande AC simple et rapide.',
            ];
      }

      return isImage
        ? [
            'Montrez l app sur telephone avec une CTA courte et claire.',
            'Testez une image simple avec la commande climatiseur visible.',
          ]
        : [
            'Ouvrez avec le controle du climatiseur dans les 2 premieres secondes.',
            'Testez une demo courte: ouvrir l app, regler la clim, voir le resultat.',
          ];
    }

    if (asset.targetLanguageCode === 'ar') {
      if (isText) {
        return asset.fieldType === 'HEADLINE'
          ? ['تحكم بالمكيف من هاتفك', 'ريموت مكيف على الهاتف']
          : [
              'تحكم بالمكيف بسهولة من هاتفك في أي وقت.',
              'حوّل هاتفك إلى ريموت مكيف سريع وسهل الاستخدام.',
            ];
      }

      return isImage
        ? [
            'اعرض التطبيق على الهاتف مع دعوة واضحة لاتخاذ إجراء.',
            'اختبر صورة بسيطة توضح التحكم بالمكيف من الهاتف.',
          ]
        : [
            'ابدأ الفيديو بنتيجة التحكم بالمكيف خلال أول ثانيتين.',
            'اختبر عرضا قصيرا: افتح التطبيق، اختر المكيف، غيّر الحرارة.',
          ];
    }

    if (asset.targetLanguageCode !== 'en') {
      return [];
    }

    return this.getEnglishFallbackReviewIdeas(asset);
  }

  private getEnglishFallbackReviewIdeas(asset: AiCreativeAsset) {
    const isText = asset.mediaType === 'Text';
    const isImage = asset.mediaType === 'Image';
    const theme = this.inferCreativeTheme([asset.title, asset.text, asset.type, asset.fieldType].join(' '));

    if (theme === 'ac') {
      if (isText) {
        return asset.fieldType === 'HEADLINE'
          ? ['Control AC From Phone', 'Easy AC Remote App']
          : [
              'Control your AC from your phone in seconds.',
              'Adjust room temperature quickly with one app.',
            ];
      }

      return isImage
        ? [
            'Show the AC control app clearly on a phone screen.',
            'Use a cool room scene with a visible app control CTA.',
          ]
        : [
            'Open with the AC changing temperature in the first 2 seconds.',
            'Show a short demo: open app, choose AC, adjust temperature.',
          ];
    }

    if (theme === 'security') {
      if (isText) {
        return asset.fieldType === 'HEADLINE'
          ? ['Fast Antivirus Scan', 'Protect Your Phone Free']
          : [
              'Scan your phone quickly for viruses and malware.',
              'Keep your device cleaner with simple mobile protection.',
            ];
      }

      return isImage
        ? [
            'Show a clear scan result and phone protection status.',
            'Use a simple security screen with a short trust-focused CTA.',
          ]
        : [
            'Open with a quick scan result and threat removed.',
            'Show a short demo: scan, detect risk, clean the phone.',
          ];
    }

    if (theme === 'led') {
      if (isText) {
        return [
          asset.fieldType === 'HEADLINE'
            ? 'Free LED Scroller App'
            : 'Create bright scrolling LED text on your phone for free.',
          asset.fieldType === 'HEADLINE'
            ? 'Make LED Text Free'
            : 'Design moving LED messages fast with a simple free app.',
        ];
      }

      return isImage
        ? [
            'Use a high-contrast phone screenshot with the overlay copy "Free LED Text".',
            'Test a clean product mockup showing the scrolling LED effect and a short CTA.',
          ]
        : [
            'Open with the finished LED scrolling result in the first 2 seconds.',
            'Test a short demo angle: type text, choose color, show the LED result.',
          ];
    }

    if (isText) {
      return asset.fieldType === 'HEADLINE'
        ? ['Try The App Today', 'Simple App Control']
        : [
            'Use the app to complete the task quickly and easily.',
            'Get started in seconds with clear app controls.',
          ];
    }

    return isImage
      ? [
          'Show the app value clearly on a phone screen.',
          'Test a simple product visual with a short CTA.',
        ]
      : [
          'Open with the main app benefit in the first 2 seconds.',
          'Show a short demo of the core action and result.',
        ];
  }

  private getAssetMediaType(asset: AssetPerformance): AiCreativeAsset['mediaType'] {
    const type = `${asset.type} ${asset.fieldType}`.toUpperCase();

    if (asset.videoId || type.includes('VIDEO') || type.includes('YOUTUBE')) {
      return 'Video';
    }

    if (asset.imageUrl || type.includes('IMAGE')) {
      return 'Image';
    }

    if (asset.text) {
      return 'Text';
    }

    return 'Asset';
  }

  private getAssetPreviewUrl(asset: AssetPerformance) {
    if (asset.imageUrl?.startsWith('http')) {
      return asset.imageUrl;
    }

    if (asset.videoId) {
      return `https://img.youtube.com/vi/${asset.videoId}/hqdefault.jpg`;
    }

    return '';
  }

  private aiTextSuggestionSchema(candidates: AiTextSuggestionCandidate[]) {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'suggestions'],
      properties: {
        summary: {
          type: 'object',
          additionalProperties: false,
          required: ['headline', 'approach'],
          properties: {
            headline: { type: 'string' },
            approach: { type: 'string' },
          },
        },
        suggestions: {
          type: 'array',
          minItems: 1,
          maxItems: Math.max(candidates.length, 1),
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'key',
              'fieldType',
              'currentText',
              'suggestion',
              'priority',
              'rationale',
              'confidence',
            ],
            properties: {
              key: {
                type: 'string',
                enum: candidates.map((candidate) => candidate.key),
              },
              fieldType: {
                type: 'string',
                enum: ['HEADLINE', 'DESCRIPTION'],
              },
              currentText: { type: 'string' },
              suggestion: { type: 'string' },
              priority: {
                type: 'string',
                enum: ['Fix first', 'Test', 'Monitor'],
              },
              rationale: { type: 'string' },
              confidence: {
                type: 'string',
                enum: ['High', 'Medium', 'Low'],
              },
            },
          },
        },
      },
    };
  }

  private aiReviewSchema() {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'recommendations'],
      properties: {
        summary: {
          type: 'object',
          additionalProperties: false,
          required: ['headline', 'overview', 'focus'],
          properties: {
            headline: { type: 'string' },
            overview: { type: 'string' },
            focus: { type: 'string' },
          },
        },
        recommendations: {
          type: 'array',
          minItems: 1,
          maxItems: 8,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'assetKey',
              'assetId',
              'mediaType',
              'priority',
              'title',
              'diagnosis',
              'suggestion',
              'replacementIdeas',
              'evidence',
              'confidence',
            ],
            properties: {
              assetKey: { type: 'string' },
              assetId: { type: 'string' },
              mediaType: {
                type: 'string',
                enum: ['Text', 'Image', 'Video', 'Asset'],
              },
              priority: {
                type: 'string',
                enum: ['Fix first', 'Improve', 'Test', 'Monitor'],
              },
              title: { type: 'string' },
              diagnosis: { type: 'string' },
              suggestion: { type: 'string' },
              replacementIdeas: {
                type: 'array',
                minItems: 2,
                maxItems: 4,
                items: { type: 'string' },
              },
              evidence: {
                type: 'array',
                minItems: 0,
                maxItems: 0,
                items: { type: 'string' },
              },
              confidence: {
                type: 'string',
                enum: ['High', 'Medium', 'Low'],
              },
            },
          },
        },
      },
    };
  }

  private evaluateAsset(asset: AssetEvaluationInput) {
    const reasons: string[] = [];
    let score = 50;

    if (asset.impressions < 100 || asset.clicks < 10) {
      reasons.push('Data volume is still low');
      score -= 10;
    }

    if (asset.roas >= 1.2) {
      reasons.push('ROAS is strong');
      score += 30;
    } else if (asset.roas >= 1) {
      reasons.push('ROAS is profitable');
      score += 20;
    } else if (asset.roas >= 0.8) {
      reasons.push('ROAS is below target but still close');
      score += 5;
    } else if (asset.cost > 10 && asset.conversions === 0) {
      reasons.push('Spent budget without conversions');
      score -= 35;
    } else {
      reasons.push('ROAS is weak');
      score -= 20;
    }

    if (asset.ctr >= 0.1) {
      reasons.push('CTR is high');
      score += 10;
    } else if (asset.ctr < 0.03 && asset.impressions >= 500) {
      reasons.push('CTR is low for its impression volume');
      score -= 15;
    }

    if (asset.performanceLabel === 'BEST') {
      reasons.push('Google labels it BEST');
      score += 15;
    } else if (asset.performanceLabel === 'GOOD') {
      reasons.push('Google labels it GOOD');
      score += 5;
    } else if (asset.performanceLabel === 'LOW') {
      reasons.push('Google labels it LOW');
      score -= 20;
    }

    score = Math.max(0, Math.min(100, score));

    if (asset.impressions < 100 || asset.clicks < 10) {
      return {
        score,
        assessment: 'Need more data',
        action: 'Keep testing',
        reason: reasons.join('; '),
      };
    }

    if (score >= 80) {
      return {
        score,
        assessment: 'Strong',
        action: 'Keep and scale',
        reason: reasons.join('; '),
      };
    }

    if (score >= 60) {
      return {
        score,
        assessment: 'Good',
        action: 'Keep',
        reason: reasons.join('; '),
      };
    }

    if (score >= 40) {
      return {
        score,
        assessment: 'Needs improvement',
        action: 'Rewrite or test variant',
        reason: reasons.join('; '),
      };
    }

    return {
      score,
      assessment: 'Weak',
      action: 'Replace or pause',
      reason: reasons.join('; '),
    };
  }

  private async findLowTextAssets(
    customerId: string,
    adGroupId: string,
    timeRange: string,
  ): Promise<LowTextAsset[]> {
    const query = `
      SELECT
        ad_group_ad.resource_name,
        ad_group_ad_asset_view.field_type,
        ad_group_ad_asset_view.performance_label,
        ad_group_ad_asset_view.enabled,
        asset.text_asset.text,
        metrics.impressions,
        metrics.clicks
      FROM ad_group_ad_asset_view
      WHERE ad_group.id = ${adGroupId}
        AND ${this.dateSegmentCondition(timeRange)}
        AND ad_group_ad_asset_view.field_type IN ('HEADLINE', 'DESCRIPTION')
        AND ad_group_ad_asset_view.enabled = TRUE
      ORDER BY metrics.impressions DESC
      LIMIT 200
    `;

    const response = await this.search(customerId, query);
    return (response.results ?? [])
      .map((row: any): LowTextAsset | null => {
        const fieldType = String(row.adGroupAdAssetView?.fieldType ?? '');
        const text = String(row.asset?.textAsset?.text ?? '').trim();
        const adResourceName = String(row.adGroupAd?.resourceName ?? '');
        const impressions = Number(row.metrics?.impressions ?? 0);
        const clicks = Number(row.metrics?.clicks ?? 0);
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const performanceLabel = String(row.adGroupAdAssetView?.performanceLabel ?? '');

        if (
          (fieldType !== 'HEADLINE' && fieldType !== 'DESCRIPTION') ||
          !text ||
          !adResourceName
        ) {
          return null;
        }

        return {
          adResourceName,
          fieldType,
          text,
          impressions,
          clicks,
          ctr,
          performanceLabel,
        };
      })
      .filter((asset: LowTextAsset | null): asset is LowTextAsset => Boolean(asset))
      .filter((asset: LowTextAsset) => asset.performanceLabel === 'LOW');
  }

  private async findMediaAssetUsages(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    assetResourceName: string,
  ): Promise<MediaAssetUsage[]> {
    const datedQuery = `
      SELECT
        ad_group_ad.resource_name,
        ad_group_ad_asset_view.field_type,
        ad_group_ad_asset_view.performance_label,
        asset.resource_name,
        metrics.impressions
      FROM ad_group_ad_asset_view
      WHERE ad_group.id = ${adGroupId}
        AND ${this.dateSegmentCondition(timeRange)}
        AND asset.resource_name = '${assetResourceName}'
        AND ad_group_ad_asset_view.enabled = TRUE
      ORDER BY metrics.impressions DESC
      LIMIT 200
    `;

    const datedResponse = await this.search(customerId, datedQuery);
    const datedUsages = this.mapMediaAssetUsageRows(
      datedResponse.results ?? [],
      'date_range',
    );

    if (datedUsages.length > 0) {
      return datedUsages;
    }

    const currentLinkQuery = `
      SELECT
        ad_group_ad.resource_name,
        ad_group_ad_asset_view.field_type,
        ad_group_ad_asset_view.performance_label,
        asset.resource_name
      FROM ad_group_ad_asset_view
      WHERE ad_group.id = ${adGroupId}
        AND asset.resource_name = '${assetResourceName}'
        AND ad_group_ad_asset_view.enabled = TRUE
      LIMIT 200
    `;

    const currentLinkResponse = await this.search(customerId, currentLinkQuery);
    return this.mapMediaAssetUsageRows(currentLinkResponse.results ?? [], 'current_link');
  }

  private mapMediaAssetUsageRows(
    rows: any[],
    source: MediaAssetUsage['source'],
  ): MediaAssetUsage[] {
    return rows
      .map((row: any): MediaAssetUsage => ({
        adResourceName: String(row.adGroupAd?.resourceName ?? ''),
        fieldType: String(row.adGroupAdAssetView?.fieldType ?? ''),
        performanceLabel: String(row.adGroupAdAssetView?.performanceLabel ?? ''),
        impressions: Number(row.metrics?.impressions ?? 0),
        source,
      }))
      .filter((usage: MediaAssetUsage) => usage.adResourceName);
  }

  private async createImageAsset(
    customerId: string,
    file: ReplaceMediaInput['imageFile'],
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Upload an image file before replacing image assets');
    }

    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (file.mimetype && !allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Image must be JPG, PNG, WEBP, or non-animated GIF');
    }

    const safeName = (file.originalname || 'replacement-image')
      .replace(/[^\w.\- ]+/g, '')
      .trim()
      .slice(0, 80);
    const response = await this.mutateAssets(customerId, [
      {
        create: {
          name: `GGAds replacement ${new Date().toISOString()} ${safeName}`.slice(0, 120),
          imageAsset: {
            data: file.buffer.toString('base64'),
          },
        },
      },
    ]);
    const resourceName = String(response.results?.[0]?.resourceName ?? '');

    if (!resourceName) {
      throw new InternalServerErrorException('Google Ads did not return a new image asset');
    }

    return resourceName;
  }

  private async createYoutubeVideoAsset(customerId: string, youtubeVideo: string | undefined) {
    const youtubeVideoId = this.extractYoutubeVideoId(youtubeVideo);

    if (!youtubeVideoId) {
      throw new BadRequestException('Enter a valid YouTube video URL or ID');
    }

    const response = await this.mutateAssets(customerId, [
      {
        create: {
          name: `GGAds replacement video ${youtubeVideoId}`,
          youtubeVideoAsset: {
            youtubeVideoId,
          },
        },
      },
    ]);
    const resourceName = String(response.results?.[0]?.resourceName ?? '');

    if (!resourceName) {
      throw new InternalServerErrorException('Google Ads did not return a new YouTube video asset');
    }

    return resourceName;
  }

  private extractYoutubeVideoId(value: string | undefined) {
    const input = value?.trim() ?? '';
    if (/^[\w-]{11}$/.test(input)) {
      return input;
    }

    const patterns = [
      /youtube\.com\/watch\?v=([\w-]{11})/,
      /youtube\.com\/shorts\/([\w-]{11})/,
      /youtu\.be\/([\w-]{11})/,
      /youtube\.com\/embed\/([\w-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return '';
  }

  private async getAdGroupAd(customerId: string, resourceName: string) {
    const query = `
      SELECT
        ad_group_ad.resource_name,
        ad_group_ad.status,
        ad_group_ad.ad.id,
        ad_group_ad.ad.resource_name,
        ad_group_ad.ad.type,
        ad_group_ad.ad.name,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.final_mobile_urls,
        ad_group_ad.ad.tracking_url_template,
        ad_group_ad.ad.final_url_suffix,
        ad_group_ad.ad.app_ad.headlines,
        ad_group_ad.ad.app_ad.descriptions,
        ad_group_ad.ad.app_ad.images,
        ad_group_ad.ad.app_ad.youtube_videos,
        ad_group_ad.ad.app_ad.html5_media_bundles,
        ad_group_ad.ad.app_ad.app_deep_link,
        ad_group_ad.ad.app_ad.mandatory_ad_text,
        ad_group_ad.ad.responsive_display_ad.marketing_images,
        ad_group_ad.ad.responsive_display_ad.square_marketing_images,
        ad_group_ad.ad.responsive_display_ad.logo_images,
        ad_group_ad.ad.responsive_display_ad.square_logo_images,
        ad_group_ad.ad.responsive_display_ad.youtube_videos
      FROM ad_group_ad
      WHERE ad_group_ad.resource_name = '${resourceName}'
      LIMIT 1
    `;

    const response = await this.search(customerId, query);
    return response.results?.[0]?.adGroupAd;
  }

  private buildReplacementAd({
    customerId,
    adGroupAd,
    headline,
    description,
    headlineReplacementMap,
    descriptionReplacementMap,
    headlineTexts,
    descriptionTexts,
  }: {
    customerId: string;
    adGroupAd: any;
    headline?: string;
    description?: string;
    headlineReplacementMap: Map<string, string>;
    descriptionReplacementMap: Map<string, string>;
    headlineTexts: Set<string>;
    descriptionTexts: Set<string>;
  }) {
    const sourceAd = adGroupAd.ad ?? {};
    const sourceAppAd = sourceAd.appAd ?? {};
    const appAd: Record<string, unknown> = {};
    const updateHeadlines = Boolean(headline) || headlineReplacementMap.size > 0;
    const updateDescriptions = Boolean(description) || descriptionReplacementMap.size > 0;

    if (updateHeadlines) {
      appAd.headlines = this.cloneTextAssets(
        sourceAppAd.headlines,
        headlineTexts,
        headline,
        headlineReplacementMap,
      );
    }

    if (updateDescriptions) {
      appAd.descriptions = this.cloneTextAssets(
        sourceAppAd.descriptions,
        descriptionTexts,
        description,
        descriptionReplacementMap,
      );
    }

    return {
      resourceName: sourceAd.resourceName ?? `customers/${customerId}/ads/${sourceAd.id}`,
      appAd,
    };
  }

  private buildMediaReplacementAd({
    customerId,
    adGroupAd,
    mediaType,
    fieldType,
    oldAssetResourceName,
    newAssetResourceName,
  }: {
    customerId: string;
    adGroupAd: any;
    mediaType: ReplaceMediaInput['mediaType'];
    fieldType: string;
    oldAssetResourceName: string;
    newAssetResourceName: string;
  }) {
    const sourceAd = adGroupAd.ad ?? {};
    const slot = this.getMediaReplacementSlot(adGroupAd, mediaType, fieldType);

    if (!slot) {
      throw new BadRequestException('Selected media asset is not editable on this ad type');
    }

    const mediaAssets =
      slot.adJsonField === 'appAd'
        ? sourceAd.appAd?.[slot.mediaJsonField]
        : sourceAd.responsiveDisplayAd?.[slot.mediaJsonField];
    const mediaResult = this.replaceAssetRef(
      mediaAssets,
      oldAssetResourceName,
      newAssetResourceName,
    );
    const adPayload: Record<string, unknown> = {
      [slot.mediaJsonField]: mediaResult.assets,
    };

    return {
      update: {
        resourceName: sourceAd.resourceName ?? `customers/${customerId}/ads/${sourceAd.id}`,
        [slot.adJsonField]: adPayload,
      },
      replacements: mediaResult.replacements,
      currentAssets: slot.currentAssets,
      updateMask: slot.updateMask,
    };
  }

  private getMediaReplacementSlot(
    adGroupAd: any,
    mediaType: ReplaceMediaInput['mediaType'],
    fieldType: string,
  ): MediaReplacementSlot | null {
    const sourceAd = adGroupAd?.ad ?? {};

    if (sourceAd.appAd) {
      const mediaJsonField = mediaType === 'IMAGE' ? 'images' : 'youtubeVideos';
      const updateMask = mediaType === 'IMAGE' ? 'app_ad.images' : 'app_ad.youtube_videos';

      return {
        adType: 'APP_AD',
        adJsonField: 'appAd',
        mediaJsonField,
        updateMask,
        currentAssets: this.cloneAssetRefs(sourceAd.appAd?.[mediaJsonField]).map(
          (asset) => asset.asset,
        ),
      };
    }

    if (sourceAd.responsiveDisplayAd) {
      const responsiveField = this.getResponsiveDisplayMediaField(mediaType, fieldType);

      if (!responsiveField) {
        return null;
      }

      return {
        adType: 'RESPONSIVE_DISPLAY_AD',
        adJsonField: 'responsiveDisplayAd',
        mediaJsonField: responsiveField.jsonField,
        updateMask: `responsive_display_ad.${responsiveField.updateField}`,
        currentAssets: this.cloneAssetRefs(
          sourceAd.responsiveDisplayAd?.[responsiveField.jsonField],
        ).map((asset) => asset.asset),
      };
    }

    return null;
  }

  private getResponsiveDisplayMediaField(
    mediaType: ReplaceMediaInput['mediaType'],
    fieldType: string,
  ) {
    const normalizedFieldType = fieldType.toUpperCase();

    if (mediaType === 'VIDEO') {
      return {
        jsonField: 'youtubeVideos',
        updateField: 'youtube_videos',
      };
    }

    if (normalizedFieldType === 'SQUARE_MARKETING_IMAGE') {
      return {
        jsonField: 'squareMarketingImages',
        updateField: 'square_marketing_images',
      };
    }

    if (normalizedFieldType === 'LOGO' || normalizedFieldType === 'LANDSCAPE_LOGO') {
      return {
        jsonField: 'logoImages',
        updateField: 'logo_images',
      };
    }

    if (normalizedFieldType === 'SQUARE_LOGO' || normalizedFieldType === 'BUSINESS_LOGO') {
      return {
        jsonField: 'squareLogoImages',
        updateField: 'square_logo_images',
      };
    }

    if (
      normalizedFieldType === 'MARKETING_IMAGE' ||
      normalizedFieldType === 'IMAGE' ||
      normalizedFieldType === 'AD_IMAGE'
    ) {
      return {
        jsonField: 'marketingImages',
        updateField: 'marketing_images',
      };
    }

    return null;
  }

  private countMatchingTextAssets(assets: any[] | undefined, targetTexts: Set<string>) {
    return (assets ?? []).filter((asset) => targetTexts.has(String(asset.text ?? '').trim()))
      .length;
  }

  private textAssetTexts(assets: unknown) {
    return Array.isArray(assets)
      ? assets
          .map((asset) => String((asset as { text?: unknown })?.text ?? '').trim())
          .filter(Boolean)
      : [];
  }

  private buildTextReplacementPreviewChanges({
    headline,
    description,
    headlineReplacementMap,
    descriptionReplacementMap,
    headlineReplacementLinkMap,
    descriptionReplacementLinkMap,
    headlineTexts,
    descriptionTexts,
  }: {
    headline: string;
    description: string;
    headlineReplacementMap: Map<string, string>;
    descriptionReplacementMap: Map<string, string>;
    headlineReplacementLinkMap: Map<string, { suggestionId?: string; variantId?: string }>;
    descriptionReplacementLinkMap: Map<string, { suggestionId?: string; variantId?: string }>;
    headlineTexts: Set<string>;
    descriptionTexts: Set<string>;
  }): TextReplacementPreviewChange[] {
    const changes: TextReplacementPreviewChange[] = [];

    for (const oldText of headlineTexts) {
      const newText = headline || headlineReplacementMap.get(oldText) || oldText;
      changes.push({
        fieldType: 'HEADLINE',
        oldText,
        newText,
        ...headlineReplacementLinkMap.get(oldText),
      });
    }

    for (const oldText of descriptionTexts) {
      const newText = description || descriptionReplacementMap.get(oldText) || oldText;
      changes.push({
        fieldType: 'DESCRIPTION',
        oldText,
        newText,
        ...descriptionReplacementLinkMap.get(oldText),
      });
    }

    return changes;
  }

  private buildAppAdTextUpdateMask({
    updateHeadlines,
    updateDescriptions,
  }: {
    updateHeadlines: boolean;
    updateDescriptions: boolean;
  }) {
    return [
      updateHeadlines ? 'app_ad.headlines' : '',
      updateDescriptions ? 'app_ad.descriptions' : '',
    ]
      .filter(Boolean)
      .join(',');
  }

  private cloneTextAssets(
    assets: any[] | undefined,
    targetTexts: Set<string>,
    replacementText?: string,
    replacementMap = new Map<string, string>(),
  ) {
    const seenTexts = new Set<string>();

    return (assets ?? [])
      .map((asset) => {
        const currentText = String(asset.text ?? '').trim();
        const nextText =
          replacementMap.get(currentText) ??
          (replacementText && targetTexts.has(currentText) ? replacementText : currentText);

        if (!nextText || seenTexts.has(nextText)) {
          return null;
        }

        seenTexts.add(nextText);
        const clone: Record<string, string> = { text: nextText };

        if (asset.pinnedField && asset.pinnedField !== 'UNSPECIFIED') {
          clone.pinnedField = asset.pinnedField;
        }

        return clone;
      })
      .filter((asset): asset is Record<string, string> => Boolean(asset));
  }

  private buildTextReplacementMap(replacements: TextReplacement[] | undefined, maxLength: number) {
    return (replacements ?? []).reduce<Map<string, string>>((map, replacement) => {
      const oldText = replacement.oldText.trim();
      const newText = this.fitGoogleAdsCopy(replacement.newText, maxLength);

      if (oldText && newText) {
        map.set(oldText, newText);
      }

    return map;
  }, new Map<string, string>());
  }

  private buildTextReplacementLinkMap(replacements: TextReplacement[] | undefined) {
    return (replacements ?? []).reduce<Map<string, { suggestionId?: string; variantId?: string }>>(
      (map, replacement) => {
        const oldText = replacement.oldText.trim();
        if (!oldText) return map;

        map.set(oldText, {
          ...(replacement.suggestionId ? { suggestionId: replacement.suggestionId } : {}),
          ...(replacement.variantId ? { variantId: replacement.variantId } : {}),
        });
        return map;
      },
      new Map<string, { suggestionId?: string; variantId?: string }>(),
    );
  }

  private cloneTextAsset(asset: any) {
    if (!asset?.text) {
      return undefined;
    }

    const clone: Record<string, string> = { text: String(asset.text) };
    if (asset.pinnedField && asset.pinnedField !== 'UNSPECIFIED') {
      clone.pinnedField = asset.pinnedField;
    }
    return clone;
  }

  private cloneAssetRefs(assets: any[] | undefined) {
    return (assets ?? [])
      .map((asset) => (asset?.asset ? { asset: String(asset.asset) } : null))
      .filter((asset): asset is { asset: string } => Boolean(asset));
  }

  private replaceAssetRef(
    assets: any[] | undefined,
    oldAssetResourceName: string,
    newAssetResourceName: string,
  ) {
    let replacements = 0;
    const seenAssets = new Set<string>();
    const nextAssets = (assets ?? [])
      .map((asset) => {
        const currentAsset = String(asset?.asset ?? '');
        if (!currentAsset) {
          return null;
        }

        const nextAsset =
          currentAsset === oldAssetResourceName ? newAssetResourceName : currentAsset;

        if (nextAsset === newAssetResourceName && currentAsset === oldAssetResourceName) {
          replacements += 1;
        }

        if (seenAssets.has(nextAsset)) {
          return null;
        }

        seenAssets.add(nextAsset);
        return { asset: nextAsset };
      })
      .filter((asset): asset is { asset: string } => Boolean(asset));

    return { assets: nextAssets, replacements };
  }

  private cloneAssetRef(asset: any) {
    return asset?.asset ? { asset: String(asset.asset) } : undefined;
  }

  private async mutateAds(customerId: string, operations: any[]) {
    return this.googleAdsMutation.mutateAds(customerId, operations);
  }

  private async mutateAssets(customerId: string, operations: any[]) {
    return this.googleAdsMutation.mutateAssets(customerId, operations);
  }

  private async search(customerId: string, query: string) {
    return this.googleAdsQuery.search(customerId, query);
  }

  private async searchAll(customerId: string, query: string) {
    return this.googleAdsQuery.searchAll(customerId, query);
  }

  private fitGoogleAdsCopy(value: string, maxLength: number) {
    const normalized = value.replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxLength) {
      return normalized;
    }

    const words = normalized.split(' ');
    let result = '';

    for (const word of words) {
      const next = result ? `${result} ${word}` : word;
      if (next.length > maxLength) {
        break;
      }
      result = next;
    }

    return result || normalized.slice(0, maxLength).trim();
  }

  private getAiProvider(featureName: string): AiProviderConfig {
    const requestedProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
    const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

    if (requestedProvider && requestedProvider !== 'gemini' && requestedProvider !== 'openai') {
      throw new BadRequestException('AI_PROVIDER must be gemini or openai');
    }

    if (requestedProvider === 'gemini' || (!requestedProvider && hasGeminiKey)) {
      if (!hasGeminiKey) {
        throw new BadRequestException(
          `Missing GEMINI_API_KEY. Set it in backend/.env before using ${featureName}.`,
        );
      }

      return {
        source: 'gemini',
        model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
        label: 'Gemini',
      };
    }

    if (requestedProvider === 'openai' || (!requestedProvider && hasOpenAiKey)) {
      if (!hasOpenAiKey) {
        throw new BadRequestException(
          `Missing OPENAI_API_KEY. Set it in backend/.env before using ${featureName}.`,
        );
      }

      return {
        source: 'openai',
        model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
        label: 'OpenAI',
      };
    }

    throw new BadRequestException(
      `Missing AI API key. Add GEMINI_API_KEY for Gemini or OPENAI_API_KEY for OpenAI before using ${featureName}.`,
    );
  }

  private async requestOpenAiJson({
    model,
    input,
    schemaName,
    schema,
    maxOutputTokens,
  }: {
    model: string;
    input: unknown[];
    schemaName: string;
    schema: unknown;
    maxOutputTokens: number;
  }) {
    const response = await this.requestOpenAi({
      model,
      input,
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
      max_output_tokens: maxOutputTokens,
      store: false,
    });

    return this.extractOpenAiText(response);
  }

  private async requestGeminiJson({
    model,
    prompt,
    schema,
    maxOutputTokens,
  }: {
    model: string;
    prompt: string;
    schema: unknown;
    maxOutputTokens: number;
  }) {
    const jsonPrompt = [
      prompt,
      '',
      'Return only valid JSON matching this schema. Do not wrap it in markdown.',
      'Use double-quoted strings, escape any newline inside a string as \\n, and include commas between every property and array item.',
      'Keep every string concise so the JSON is not truncated.',
      JSON.stringify(schema),
    ].join('\n');
    const jsonSchemaPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: jsonPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    };
    const geminiSchema = this.toGeminiResponseSchema(schema);
    const legacyPayload = {
      contents: jsonSchemaPayload.contents,
      generationConfig: {
        maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
      },
    };
    const jsonModePayload = {
      contents: jsonSchemaPayload.contents,
      generationConfig: {
        maxOutputTokens,
        responseMimeType: 'application/json',
      },
    };
    let result = await this.postGemini(model, jsonSchemaPayload);

    if (!result.ok && result.status === 400) {
      result = await this.postGemini(model, legacyPayload);
    }

    if (!result.ok && result.status === 400) {
      result = await this.postGemini(model, jsonModePayload);
    }

    if (!result.ok) {
      throw new InternalServerErrorException({
        message: this.formatGeminiError(result.body),
        status: result.status,
        details: result.body,
      });
    }

    const outputText = this.extractGeminiText(result.body);

    try {
      this.parseAiJson(outputText);
      return outputText;
    } catch {
      const repairedText = await this.repairGeminiJson({
        model,
        invalidJson: outputText,
        schema,
        maxOutputTokens,
      });

      return repairedText || outputText;
    }
  }

  private async repairGeminiJson({
    model,
    invalidJson,
    schema,
    maxOutputTokens,
  }: {
    model: string;
    invalidJson: string;
    schema: unknown;
    maxOutputTokens: number;
  }) {
    const repairPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'Repair this malformed JSON. Return only valid JSON, no markdown.',
                'Do not add new facts. Preserve the meaning and keys as much as possible.',
                'Schema:',
                JSON.stringify(schema),
                'Malformed JSON:',
                invalidJson,
              ].join('\n'),
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        responseMimeType: 'application/json',
      },
    };
    const result = await this.postGemini(model, repairPayload);

    if (!result.ok) {
      return '';
    }

    const repaired = this.extractGeminiText(result.body);

    try {
      this.parseAiJson(repaired);
      return repaired;
    } catch {
      return '';
    }
  }

  private toGeminiResponseSchema(schema: unknown): unknown {
    if (Array.isArray(schema)) {
      return schema.map((item) => this.toGeminiResponseSchema(item));
    }

    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    const unsupportedKeys = new Set([
      '$schema',
      'additionalProperties',
      'default',
      'examples',
      'exclusiveMaximum',
      'exclusiveMinimum',
      'minItems',
      'maxItems',
      'minLength',
      'maxLength',
      'pattern',
      'title',
      'description',
    ]);
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (unsupportedKeys.has(key)) {
        continue;
      }

      if (key === 'type' && typeof value === 'string') {
        result[key] = value.toUpperCase();
        continue;
      }

      if (key === 'properties' && value && typeof value === 'object' && !Array.isArray(value)) {
        const properties: Record<string, unknown> = {};
        const propertyOrdering: string[] = [];

        for (const [propertyName, propertySchema] of Object.entries(value as Record<string, unknown>)) {
          properties[propertyName] = this.toGeminiResponseSchema(propertySchema);
          propertyOrdering.push(propertyName);
        }

        result.properties = properties;
        result.propertyOrdering = propertyOrdering;
        continue;
      }

      result[key] = this.toGeminiResponseSchema(value);
    }

    return result;
  }

  private async postGemini(model: string, payload: unknown) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      throw new BadRequestException('Missing GEMINI_API_KEY');
    }

    const normalizedModel = model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        status: response.status,
        body,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        message: `Could not reach Gemini API: ${this.formatRuntimeError(error)}`,
      });
    }
  }

  private async requestOpenAi(payload: unknown) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new BadRequestException('Missing OPENAI_API_KEY');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new InternalServerErrorException({
          message: this.formatOpenAiError(body),
          status: response.status,
          details: body,
        });
      }

      return body;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: `Could not reach OpenAI API: ${this.formatRuntimeError(error)}`,
      });
    }
  }

  private parseAiJson(text: string) {
    const cleaned = this.stripJsonMarkdown(text);
    const extracted = this.extractJsonObject(cleaned);
    const escaped = this.escapeControlCharsInJsonStrings(extracted);
    const candidates = [
      text,
      cleaned,
      extracted,
      escaped,
      this.addMissingJsonCommas(escaped),
    ].filter((candidate, index, list) => candidate && list.indexOf(candidate) === index);
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error('Invalid JSON');
  }

  private addMissingJsonCommas(text: string) {
    return text
      .replace(/(["}\]])(\s*\n\s*")/g, '$1,$2')
      .replace(/(["}\]])(\s*\n\s*\{)/g, '$1,$2');
  }

  private stripJsonMarkdown(text: string) {
    return text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  private extractJsonObject(text: string) {
    const firstBrace = text.indexOf('{');

    if (firstBrace === -1) {
      return text;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = firstBrace; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;

        if (depth === 0) {
          return text.slice(firstBrace, index + 1);
        }
      }
    }

    const lastBrace = text.lastIndexOf('}');
    return lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text.slice(firstBrace);
  }

  private escapeControlCharsInJsonStrings(text: string) {
    let result = '';
    let inString = false;
    let escaped = false;

    for (const char of text) {
      if (inString) {
        if (escaped) {
          result += char;
          escaped = false;
          continue;
        }

        if (char === '\\') {
          result += char;
          escaped = true;
          continue;
        }

        if (char === '"') {
          result += char;
          inString = false;
          continue;
        }

        if (char === '\n') {
          result += '\\n';
          continue;
        }

        if (char === '\r') {
          result += '\\r';
          continue;
        }

        if (char === '\t') {
          result += '\\t';
          continue;
        }

        result += char;
        continue;
      }

      result += char;

      if (char === '"') {
        inString = true;
      }
    }

    return result;
  }

  private extractOpenAiText(response: any) {
    if (typeof response?.output_text === 'string') {
      return response.output_text;
    }

    const textParts =
      response?.output
        ?.flatMap((item: any) => item?.content ?? [])
        ?.map((content: any) => content?.text)
        ?.filter((text: unknown): text is string => typeof text === 'string') ?? [];

    return textParts.join('').trim();
  }

  private extractGeminiText(response: any) {
    const textParts =
      response?.candidates
        ?.flatMap((candidate: any) => candidate?.content?.parts ?? [])
        ?.map((part: any) => part?.text)
        ?.filter((text: unknown): text is string => typeof text === 'string') ?? [];

    return textParts.join('').trim();
  }

  private openAiContentToPlainText(content: any[]) {
    return content
      .map((item) => {
        if (item?.type === 'input_text') {
          return String(item.text ?? '');
        }

        if (item?.type === 'input_image') {
          return `Visual reference URL: ${String(item.image_url ?? '')}`;
        }

        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  private formatRuntimeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private formatOpenAiError(body: any) {
    const error = body?.error;
    const message = String(error?.message ?? 'OpenAI API request failed');
    const code = error?.code ? `Code: ${error.code}` : '';
    const type = error?.type ? `Type: ${error.type}` : '';

    return [message, type, code].filter(Boolean).join(' | ');
  }

  private formatGeminiError(body: any) {
    const error = body?.error;
    const message = String(error?.message ?? 'Gemini API request failed');
    const status = error?.status ? `Status: ${error.status}` : '';
    const code = error?.code ? `Code: ${error.code}` : '';

    return [message, status, code].filter(Boolean).join(' | ');
  }

  private async getSavedAdGroupAiContext(customerId: string, googleAdGroupId: string) {
    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId });
    if (!account) return null;

    const adGroup = await this.dataSource
      .getRepository(AdGroupEntity)
      .createQueryBuilder('adGroup')
      .innerJoin(CampaignEntity, 'campaign', 'campaign.id = adGroup.campaign_id')
      .where('campaign.account_id = :accountId', { accountId: account.id })
      .andWhere('adGroup.google_ad_group_id = :googleAdGroupId', { googleAdGroupId })
      .getOne();
    if (!adGroup) return null;

    const scope = await this.dataSource
      .getRepository(CreativePolicyScopeEntity)
      .createQueryBuilder('scope')
      .innerJoin(CreativePolicyEntity, 'policy', 'policy.id = scope.policy_id')
      .where('scope.ad_group_id = :adGroupId', { adGroupId: adGroup.id })
      .andWhere('policy.workspace_id = :workspaceId', { workspaceId: account.workspaceId })
      .andWhere('policy.enabled = true')
      .andWhere('scope.language_code IS NOT NULL')
      .orderBy('policy.version', 'DESC')
      .addOrderBy('scope.created_at', 'DESC')
      .getOne();

    if (!scope?.languageCode) return null;
    return {
      languageCode: scope.languageCode.trim().toLowerCase(),
      topic: String(scope.adGroupTopic ?? '').trim(),
    };
  }

  private async getCreativeGuidance(
    customerId: string,
    googleAdGroupId?: string,
  ): Promise<CreativeGuidance | null> {
    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId });
    if (!account) return null;
    const policy = await this.dataSource.getRepository(CreativePolicyEntity).findOne({
      where: { workspaceId: account.workspaceId, enabled: true },
      order: { version: 'DESC' },
    });
    if (!policy) return null;
    const terms = await this.dataSource.getRepository(CreativeTermEntity).find({
      where: { policyId: policy.id, active: true },
      order: { weight: 'DESC', createdAt: 'ASC' },
      take: 200,
    });
    const termContext = await this.getCreativeTermContext(account.id, googleAdGroupId);
    const scopedTerms = terms.filter((item) => this.creativeTermMatchesContext(item, termContext));
    const groupedTerms = scopedTerms.reduce<CreativeGuidance['terms']>((groups, item) => {
      groups[item.termType] = [
        ...(groups[item.termType] ?? []),
        {
          languageCode: item.languageCode,
          marketCode: item.marketCode,
          scopeLevel: item.scopeLevel || 'ACCOUNT',
          googleCampaignId: item.googleCampaignId,
          googleAdGroupId: item.googleAdGroupId,
          term: item.term,
          weight: Number(item.weight),
        },
      ];
      return groups;
    }, {});

    return {
      languageStrategy: policy.languageStrategy,
      targetLanguage: policy.targetLanguage,
      headlineMaxLength: policy.headlineMaxLength,
      descriptionMaxLength: policy.descriptionMaxLength,
      minimumImpressions: Number(policy.minimumImpressions),
      minimumClicks: Number(policy.minimumClicks),
      terms: groupedTerms,
    };
  }

  private async getCreativeTermContext(accountId: string, googleAdGroupId?: string) {
    const normalizedAdGroupId = String(googleAdGroupId ?? '').replace(/\D/g, '');

    if (!normalizedAdGroupId) {
      return {
        googleCampaignId: null as string | null,
        googleAdGroupId: null as string | null,
      };
    }

    const campaigns = await this.dataSource.getRepository(CampaignEntity).findBy({ accountId });
    const campaignIds = campaigns.map((item) => item.id);

    if (!campaignIds.length) {
      return {
        googleCampaignId: null,
        googleAdGroupId: normalizedAdGroupId,
      };
    }

    const adGroup = await this.dataSource.getRepository(AdGroupEntity).findOne({
      where: {
        campaignId: In(campaignIds),
        googleAdGroupId: normalizedAdGroupId,
      },
    });
    const campaign = adGroup
      ? campaigns.find((item) => item.id === adGroup.campaignId)
      : null;

    return {
      googleCampaignId: campaign?.googleCampaignId ?? null,
      googleAdGroupId: normalizedAdGroupId,
    };
  }

  private creativeTermMatchesContext(
    term: CreativeTermEntity,
    context: { googleCampaignId: string | null; googleAdGroupId: string | null },
  ) {
    const scopeLevel = term.scopeLevel || 'ACCOUNT';

    if (scopeLevel === 'ACCOUNT') {
      return true;
    }

    if (scopeLevel === 'CAMPAIGN') {
      return Boolean(
        context.googleCampaignId &&
          term.googleCampaignId &&
          term.googleCampaignId === context.googleCampaignId,
      );
    }

    if (scopeLevel === 'AD_GROUP') {
      return Boolean(
        context.googleAdGroupId &&
          term.googleAdGroupId &&
          term.googleAdGroupId === context.googleAdGroupId,
      );
    }

    return false;
  }

  private async getCreativeSuggestionHistory(
    customerId: string,
    googleAdGroupId: string,
  ): Promise<CreativeHistory> {
    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId });
    if (!account) return { approved: [], rejected: [], applied: [] };

    const campaigns = await this.dataSource
      .getRepository(CampaignEntity)
      .findBy({ accountId: account.id });
    if (!campaigns.length) return { approved: [], rejected: [], applied: [] };

    const adGroup = await this.dataSource.getRepository(AdGroupEntity).findOne({
      where: {
        campaignId: In(campaigns.map((item) => item.id)),
        googleAdGroupId,
      },
    });
    if (!adGroup) return { approved: [], rejected: [], applied: [] };

    const runs = await this.dataSource.getRepository(AiReviewRunEntity).find({
      where: { accountId: account.id, adGroupId: adGroup.id },
      order: { startedAt: 'DESC' },
      take: 30,
    });
    if (!runs.length) return { approved: [], rejected: [], applied: [] };

    const suggestions = await this.dataSource.getRepository(AiSuggestionEntity).find({
      where: { reviewRunId: In(runs.map((item) => item.id)) },
      order: { createdAt: 'DESC' },
      take: 300,
    });
    if (!suggestions.length) return { approved: [], rejected: [], applied: [] };

    const variants = await this.dataSource.getRepository(AiSuggestionVariantEntity).find({
      where: { suggestionId: In(suggestions.map((item) => item.id)) },
      order: { createdAt: 'DESC' },
      take: 500,
    });
    const suggestionStatus = new Map(suggestions.map((item) => [item.id, item.status]));
    const history = variants.reduce<CreativeHistory>(
      (groups, variant) => {
        const text = String(variant.content?.text ?? '').trim();
        if (!text) return groups;
        const status = suggestionStatus.get(variant.suggestionId);

        if (status === 'REJECTED') groups.rejected.push(text);
        if (status === 'APPROVED') groups.approved.push(text);
        if (status === 'APPLIED') groups.applied.push(text);
        return groups;
      },
      { approved: [], rejected: [], applied: [] },
    );

    return {
      approved: this.uniqueStrings(history.approved).slice(0, 40),
      rejected: this.uniqueStrings(history.rejected).slice(0, 80),
      applied: this.uniqueStrings(history.applied).slice(0, 40),
    };
  }

}
