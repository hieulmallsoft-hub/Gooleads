import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { DataSource, In } from 'typeorm';
import { AdGroupEntity } from '../database/entities/ad-group.entity';
import { AiReviewRunEntity } from '../database/entities/ai-review-run.entity';
import { AiSuggestionVariantEntity } from '../database/entities/ai-suggestion-variant.entity';
import { AiSuggestionEntity } from '../database/entities/ai-suggestion.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { CreativePolicyEntity } from '../database/entities/creative-policy.entity';
import { CreativeTermEntity } from '../database/entities/creative-term.entity';
import { GoogleAdsAccountEntity } from '../database/entities/google-ads-account.entity';

type GoogleAdsConfig = {
  developerToken: string;
  loginCustomerId?: string;
  keyFilePath: string;
  apiVersion: string;
};

type CampaignPerformance = {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversionValue: number;
  roas: number;
};

type AdGroupPerformance = {
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
  constructor(private readonly dataSource: DataSource) {}

  private readonly config = this.loadConfig();

  private dateSegmentCondition(timeRange: string) {
    const customRange = timeRange.match(/^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})$/);
    if (customRange) {
      return `segments.date BETWEEN '${customRange[1]}' AND '${customRange[2]}'`;
    }

    return `segments.date DURING ${timeRange}`;
  }

  async getCampaignPerformance(customerId: string, timeRange: string) {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions_value
      FROM campaign
      WHERE ${this.dateSegmentCondition(timeRange)}
      ORDER BY metrics.impressions DESC
      LIMIT 50
    `;

    const response = await this.search(customerId, query);
    const campaigns: CampaignPerformance[] = (response.results ?? []).map((row: any): CampaignPerformance => {
      const impressions = Number(row.metrics?.impressions ?? 0);
      const clicks = Number(row.metrics?.clicks ?? 0);
      const cost = Number(row.metrics?.costMicros ?? 0) / 1_000_000;
      const conversionValue = Number(row.metrics?.conversionsValue ?? 0);

      return {
        id: String(row.campaign?.id ?? ''),
        name: String(row.campaign?.name ?? ''),
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cost,
        conversionValue,
        roas: cost > 0 ? conversionValue / cost : 0,
      };
    });

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
    const totalImpressions = campaigns.reduce(
      (sum: number, campaign: CampaignPerformance) => sum + campaign.impressions,
      0,
    );

    return {
      campaigns,
      timeRange,
      totalCost,
      totalClicks,
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
        ad_group.id,
        ad_group.name,
        ad_group.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions_value
      FROM ad_group
      WHERE ${this.dateSegmentCondition(timeRange)}
      ORDER BY metrics.impressions DESC
      LIMIT 100
    `;

    const response = await this.search(customerId, query);
    const adGroups: AdGroupPerformance[] = (response.results ?? []).map((row: any): AdGroupPerformance => {
      const impressions = Number(row.metrics?.impressions ?? 0);
      const clicks = Number(row.metrics?.clicks ?? 0);
      const cost = Number(row.metrics?.costMicros ?? 0) / 1_000_000;
      const conversionValue = Number(row.metrics?.conversionsValue ?? 0);

      return {
        id: String(row.adGroup?.id ?? ''),
        name: String(row.adGroup?.name ?? ''),
        campaignId: String(row.campaign?.id ?? ''),
        campaignName: String(row.campaign?.name ?? ''),
        status: String(row.adGroup?.status ?? ''),
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cost,
        conversionValue,
        roas: cost > 0 ? conversionValue / cost : 0,
      };
    });

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
    const totalImpressions = adGroups.reduce(
      (sum: number, adGroup: AdGroupPerformance) => sum + adGroup.impressions,
      0,
    );

    return {
      adGroups,
      timeRange,
      totalCost,
      totalClicks,
      totalImpressions,
      avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgRoas: totalCost > 0 ? totalConversionValue / totalCost : 0,
    };
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
      LIMIT 200
    `;

    const response = await this.search(customerId, query);
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
    }

    if (operations.length === 0) {
      throw new BadRequestException({
        message: 'No editable APP_AD rows were found for the LOW text assets',
        skippedAds,
      });
    }

    const response = await this.mutateAds(customerId, operations);
    const results = response.results ?? [];
    const replacedAds = plans.map((plan) => ({
      oldResourceName: plan.oldResourceName,
      newResourceName: String(results[plan.operationIndex]?.resourceName ?? ''),
      headlineReplacements: plan.headlineReplacements,
      descriptionReplacements: plan.descriptionReplacements,
    }));

    return {
      message: `Updated ${replacedAds.length} ad${replacedAds.length === 1 ? '' : 's'}`,
      timeRange,
      adGroupId,
      lowAssetCount: targetAssets.length,
      replacedAds,
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

  async generateAiTextSuggestions(customerId: string, adGroupId: string, timeRange: string) {
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
    const adGroupFallbackLanguage = this.resolveAdGroupTargetLanguage(assetPerformance.assets, guidance);
    const candidates = this.collectWeakTextSuggestionCandidates(
      assetPerformance.assets,
      adGroupFallbackLanguage,
      guidance,
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
      };
    } catch (error) {
      return this.buildFallbackTextSuggestions(candidates, {
        model: `${aiProvider.model} fallback`,
        source: aiProvider.source,
        adGroupId,
        timeRange,
      });
    }
  }

  private collectWeakTextSuggestionCandidates(
    assets: AssetPerformance[],
    adGroupFallbackLanguage: LanguageHint,
    guidance: CreativeGuidance | null,
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
      const targetLanguage = this.resolveAssetTargetLanguage(
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
    const headlineSuggestions = [
      'Free LED Text App',
      'LED Scroller Maker',
      'Make LED Signs Free',
      'Scrolling Text App',
      'Create LED Text Fast',
      'LED Banner On Phone',
      'Free LED Board App',
      'LED Sign Maker Free',
      'Bright LED Text App',
      'LED Message Maker',
      'Phone LED Display',
      'Free LED Sign Maker',
      'Make Scrolling Text',
      'LED Board For Events',
      'Easy LED Display App',
    ];
    const descriptionSuggestions = [
      'Create scrolling LED messages on your phone in seconds.',
      'Make bright LED text for parties, shops, and events.',
      'Design custom LED signs with simple colors and effects.',
      'Turn your phone into a clear scrolling LED display.',
      'Show bold LED messages anywhere with a free app.',
      'Build moving LED text for quick eye-catching messages.',
      'Make a free LED board for events, signs, and promos.',
      'Create colorful scrolling text without extra hardware.',
      'Use your phone as an LED banner for clear messages.',
      'Make custom LED display messages fast and free.',
      'Design bright scrolling text for any event or shop.',
      'Create an easy LED sign for phones, parties, and ads.',
      'Turn simple text into a bright moving LED message.',
      'Make event-ready scrolling text from your phone.',
      'Create free LED-style messages for screens and signs.',
    ];
    const contextSuggestions =
      localizedOptions.length > 0
        ? []
        : candidate.fieldType === 'HEADLINE'
        ? [
            source.includes('phone') ? 'LED Text On Phone' : '',
            source.includes('free') ? 'Free Scrolling Text' : '',
            source.includes('event') || source.includes('part') ? 'LED Signs For Events' : '',
            source.includes('board') ? 'LED Board Maker' : '',
          ]
        : [
            source.includes('phone')
              ? 'Create scrolling LED text right on your phone.'
              : '',
            source.includes('event') || source.includes('part')
              ? 'Make bright LED messages for events, parties, and shops.'
              : '',
            source.includes('free')
              ? 'Create free LED-style scrolling text in seconds.'
              : '',
            source.includes('board')
              ? 'Build a bright LED board message from your phone.'
              : '',
          ];
    const baseOptions =
      localizedOptions.length > 0
        ? localizedOptions
        : candidate.fieldType === 'HEADLINE'
          ? headlineSuggestions
          : descriptionSuggestions;
    const options = this.uniqueStrings([...contextSuggestions, ...baseOptions]);
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
    },
    guidance: CreativeGuidance | null,
    history: CreativeHistory,
  ) {
    return [
      'You are a Google Ads copy generator for mobile app campaigns.',
      'Return only replacement ad copy. Do not explain.',
      `Ad group fallback language: ${context.targetLanguageName} (${context.targetLanguageCode}), confidence ${context.targetLanguageConfidence}.`,
      'Each candidate has its own targetLanguage. Write each suggestion in that candidate targetLanguage, even when several languages exist in one ad group.',
      'If targetLanguage is AUTO or "same visible language/script as current text", infer the visible language/script from currentText and write the suggestion in that exact same language/script.',
      'The currentText is the final authority. If sourceLanguage or targetLanguage seems wrong, infer the visible language/script from currentText and write in that same language.',
      'Do not translate into English or Spanish unless that specific candidate currentText is already English or Spanish.',
      'Use natural native spelling, accents, punctuation, and word order for that language. Avoid English-style abbreviations like "AC" unless the currentText already uses them.',
      'Generate one replacement suggestion for every LOW-label headline/description candidate.',
      'Respect Google Ads length limits exactly: HEADLINE max 30 characters, DESCRIPTION max 90 characters.',
      'Do not return the original text unchanged. Avoid emojis, unsupported symbols, exaggerated claims, guarantees, or unverifiable promises.',
      'Use active KEYWORD, BRAND_TERM, and CTA policy terms only when they fit the source language and meaning. Never use NEGATIVE_KEYWORD or PROHIBITED_CLAIM terms.',
      'Do not reuse any exact text from suggestion history. Rejected text is banned. Approved/applied text can inspire style but must not be copied exactly.',
      'For rationale, return an empty string. For summary, keep headline and approach under 8 words.',
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
    const activeAssets = assets.filter((asset) => asset.impressions > 0);
    const maxItems = Math.max(1, limit);
    const selected = new Map<string, AssetPerformance>();
    const lowLabelAssets = activeAssets
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
    const recommendations = (review.recommendations ?? []).map((recommendation) => {
      const asset = assetMap.get(String(recommendation.assetKey ?? ''));
      const replacementIdeas = asset
        ? this.normalizeReviewReplacementIdeas(recommendation.replacementIdeas, asset)
        : recommendation.replacementIdeas;

      return {
        ...recommendation,
        replacementIdeas,
        asset: asset
          ? {
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
            }
          : null,
      };
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
    const hasLanguageMismatch = ideas.some((idea) =>
      this.isReplacementLanguageMismatch(idea, asset.targetLanguageCode),
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
    return this.requestGoogleAds(customerId, 'ads:mutate', { operations });
  }

  private async mutateAssets(customerId: string, operations: any[]) {
    return this.requestGoogleAds(customerId, 'assets:mutate', { operations });
  }

  private async search(customerId: string, query: string) {
    return this.requestGoogleAds(customerId, 'googleAds:search', { query });
  }

  private async searchAll(customerId: string, query: string) {
    const results: any[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.requestGoogleAds(customerId, 'googleAds:search', {
        query,
        ...(pageToken ? { pageToken } : {}),
      });
      results.push(...(response.results ?? []));
      pageToken = response.nextPageToken || undefined;
    } while (pageToken);

    return { results };
  }

  private async requestGoogleAds(customerId: string, path: string, payload: unknown) {
    const auth = new GoogleAuth({
      keyFile: this.config.keyFilePath,
      scopes: ['https://www.googleapis.com/auth/adwords'],
    });
    let accessToken: Awaited<ReturnType<Awaited<ReturnType<typeof auth.getClient>>['getAccessToken']>>;

    try {
      const client = await auth.getClient();
      accessToken = await client.getAccessToken();
    } catch (error) {
      throw new InternalServerErrorException({
        message: `Google Ads auth failed: ${this.formatRuntimeError(error)}`,
      });
    }

    if (!accessToken.token) {
      throw new InternalServerErrorException('Could not get Google access token');
    }

    const url = `https://googleads.googleapis.com/${this.config.apiVersion}/customers/${customerId}/${path}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
          'developer-token': this.config.developerToken,
          ...(this.config.loginCustomerId
            ? { 'login-customer-id': this.config.loginCustomerId }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new InternalServerErrorException({
          message: this.formatGoogleAdsError(body),
          status: response.status,
          details: body,
        });
      }

      return body;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException({
        message: `Could not reach Google Ads API: ${this.formatRuntimeError(error)}`,
      });
    }
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

  private formatGoogleAdsError(body: any) {
    const baseMessage = String(body?.error?.message ?? 'Google Ads API request failed');
    const errors = body?.error?.details
      ?.flatMap((detail: any) => detail?.errors ?? [])
      ?.map((error: any) => {
        const errorCode = error?.errorCode
          ? Object.entries(error.errorCode)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ')
          : '';
        const fieldPath = error?.location?.fieldPathElements
          ?.map((field: any) =>
            field?.index === undefined ? field?.fieldName : `${field?.fieldName}[${field.index}]`,
          )
          ?.filter(Boolean)
          ?.join('.');
        return [error?.message, errorCode, fieldPath ? `Field: ${fieldPath}` : '']
          .filter(Boolean)
          .join(' | ');
      })
      ?.filter(Boolean);

    return errors?.length ? `${baseMessage}: ${errors.join(' / ')}` : baseMessage;
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

  private loadConfig(): GoogleAdsConfig {
    const configPath = resolve(
      process.cwd(),
      process.env.GOOGLE_ADS_CONFIG_PATH ??
        '../GoogleAds_extracted/GooogleAds/google-ads.yaml',
    );
    const yamlConfig = existsSync(configPath) ? this.readSimpleYaml(configPath) : {};
    const keyFilePath =
      process.env.GOOGLE_ADS_KEY_FILE ??
      yamlConfig.json_key_file_path ??
      '../GoogleAds_extracted/GooogleAds/key.json';

    const resolvedKeyFilePath = isAbsolute(keyFilePath)
      ? keyFilePath
      : resolve(dirname(configPath), keyFilePath);

    const developerToken =
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? yamlConfig.developer_token;

    if (!developerToken) {
      throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN or developer_token in google-ads.yaml');
    }

    if (!existsSync(resolvedKeyFilePath)) {
      throw new Error(`Google Ads key file not found: ${resolvedKeyFilePath}`);
    }

    return {
      developerToken,
      loginCustomerId:
        process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? yamlConfig.login_customer_id,
      keyFilePath: resolvedKeyFilePath,
      apiVersion: process.env.GOOGLE_ADS_API_VERSION ?? 'v22',
    };
  }

  private readSimpleYaml(path: string): Record<string, string> {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .reduce<Record<string, string>>((config, line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
          return config;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        config[key] = value;
        return config;
      }, {});
  }
}
