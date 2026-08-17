import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

type Metric = {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  roas: number;
  costPerConversion: number;
};

@Injectable()
export class GoogleAdsSnapshotService {
  constructor(private readonly dataSource: DataSource) {}

  async getCampaignPerformance(customerId: string, timeRange: string) {
    const [start, end] = this.dateBounds(timeRange);
    const rows = await this.dataSource.query(`
      SELECT campaign.google_campaign_id AS id,
             campaign.name,
             campaign.status,
             COALESCE(SUM(metric.impressions), 0) AS impressions,
             COALESCE(SUM(metric.clicks), 0) AS clicks,
             COALESCE(SUM(metric.cost_micros), 0) AS "costMicros",
             COALESCE(SUM(metric.conversions), 0) AS conversions,
             COALESCE(SUM(metric.conversion_value), 0) AS "conversionValue",
             MIN(metric.metric_date) AS "metricStart",
             MAX(metric.metric_date) AS "metricEnd"
      FROM campaigns campaign
      JOIN google_ads_accounts account ON account.id = campaign.account_id
      LEFT JOIN campaign_daily_metrics metric
        ON metric.campaign_id = campaign.id
       AND metric.metric_date BETWEEN $2 AND $3
      WHERE account.customer_id = $1 AND campaign.status != 'REMOVED'
      GROUP BY campaign.id
      ORDER BY COALESCE(SUM(metric.impressions), 0) DESC, campaign.name ASC
    `, [customerId, start, end]);
    const campaigns = rows.map((row: any) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      status: String(row.status ?? 'UNKNOWN'),
      metricStart: row.metricStart ? String(row.metricStart).slice(0, 10) : null,
      metricEnd: row.metricEnd ? String(row.metricEnd).slice(0, 10) : null,
      ...this.metric(row),
      dailyMetrics: [],
    }));
    return this.collectionResponse('campaigns', campaigns, timeRange, await this.account(customerId));
  }

  async getAdGroupPerformance(customerId: string, timeRange: string) {
    const [start, end] = this.dateBounds(timeRange);
    const rows = await this.dataSource.query(`
      SELECT ad_group.google_ad_group_id AS id,
             ad_group.name,
             ad_group.status,
             campaign.google_campaign_id AS "campaignId",
             campaign.name AS "campaignName",
             campaign.status AS "campaignStatus",
             COALESCE(SUM(metric.impressions), 0) AS impressions,
             COALESCE(SUM(metric.clicks), 0) AS clicks,
             COALESCE(SUM(metric.cost_micros), 0) AS "costMicros",
             COALESCE(SUM(metric.conversions), 0) AS conversions,
             COALESCE(SUM(metric.conversion_value), 0) AS "conversionValue",
             MIN(metric.metric_date) AS "metricStart",
             MAX(metric.metric_date) AS "metricEnd"
      FROM ad_groups ad_group
      JOIN campaigns campaign ON campaign.id = ad_group.campaign_id
      JOIN google_ads_accounts account ON account.id = campaign.account_id
      LEFT JOIN ad_group_daily_metrics metric
        ON metric.ad_group_id = ad_group.id
       AND metric.metric_date BETWEEN $2 AND $3
      WHERE account.customer_id = $1
        AND campaign.status != 'REMOVED' AND ad_group.status != 'REMOVED'
      GROUP BY ad_group.id, campaign.id
      ORDER BY COALESCE(SUM(metric.impressions), 0) DESC, ad_group.name ASC
    `, [customerId, start, end]);
    const adGroups = rows.map((row: any) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      campaignId: String(row.campaignId ?? ''),
      campaignName: String(row.campaignName ?? ''),
      campaignStatus: String(row.campaignStatus ?? 'UNKNOWN'),
      status: String(row.status ?? 'UNKNOWN'),
      metricStart: row.metricStart ? String(row.metricStart).slice(0, 10) : null,
      metricEnd: row.metricEnd ? String(row.metricEnd).slice(0, 10) : null,
      ...this.metric(row),
      dailyMetrics: [],
    }));
    return this.collectionResponse('adGroups', adGroups, timeRange, await this.account(customerId));
  }

  async getAssetPerformance(customerId: string, adGroupId: string, timeRange: string) {
    const [start, end] = this.dateBounds(timeRange);
    const rows = await this.dataSource.query(`
      SELECT asset.google_asset_id AS id,
             asset.resource_name AS "resourceName",
             ad.resource_name AS "adResourceName",
             COALESCE(asset.name, '') AS name,
             asset.asset_type AS type,
             link.field_type AS "fieldType",
             link.performance_label AS "performanceLabel",
             COALESCE(asset.text_content, '') AS text,
             COALESCE(asset.image_url, '') AS "imageUrl",
             COALESCE(asset.image_width, 0) AS "imageWidth",
             COALESCE(asset.image_height, 0) AS "imageHeight",
             COALESCE(asset.youtube_video_id, '') AS "videoId",
             COALESCE(SUM(metric.impressions), 0) AS impressions,
             COALESCE(SUM(metric.clicks), 0) AS clicks,
             COALESCE(SUM(metric.cost_micros), 0) AS "costMicros",
             COALESCE(SUM(metric.conversions), 0) AS conversions,
             COALESCE(SUM(metric.conversion_value), 0) AS "conversionValue",
             MIN(metric.metric_date) AS "metricStart",
             MAX(metric.metric_date) AS "metricEnd"
      FROM ad_asset_links link
      JOIN assets asset ON asset.id = link.asset_id
      JOIN ads ad ON ad.id = link.ad_id
      JOIN ad_groups ad_group ON ad_group.id = ad.ad_group_id
      JOIN campaigns campaign ON campaign.id = ad_group.campaign_id
      JOIN google_ads_accounts account ON account.id = campaign.account_id
      LEFT JOIN ad_asset_daily_metrics metric
        ON metric.ad_asset_link_id = link.id
       AND metric.metric_date BETWEEN $3 AND $4
      WHERE account.customer_id = $1
        AND ad_group.google_ad_group_id = $2
        AND link.enabled = TRUE
      GROUP BY link.id, asset.id, ad.id
      ORDER BY COALESCE(SUM(metric.impressions), 0) DESC, asset.text_content ASC
    `, [customerId, adGroupId, start, end]);
    const assets = rows.map((row: any) => {
      const metrics = this.metric(row);
      return {
        id: String(row.id), resourceName: String(row.resourceName ?? ''),
        adResourceName: String(row.adResourceName ?? ''), name: String(row.name ?? ''),
        type: String(row.type ?? ''), fieldType: String(row.fieldType ?? ''),
        performanceLabel: String(row.performanceLabel ?? 'UNKNOWN'), text: String(row.text ?? ''),
        imageUrl: String(row.imageUrl ?? ''), imageWidth: Number(row.imageWidth ?? 0),
        imageHeight: Number(row.imageHeight ?? 0), videoId: String(row.videoId ?? ''),
        metricStart: row.metricStart ? String(row.metricStart).slice(0, 10) : null,
        metricEnd: row.metricEnd ? String(row.metricEnd).slice(0, 10) : null,
        ...metrics, cpa: metrics.costPerConversion, ...this.evaluate(metrics, String(row.performanceLabel ?? '')),
      };
    });
    const account = await this.account(customerId);
    return {
      ...this.collectionResponse('assets', assets, timeRange, account),
      adGroupId,
    };
  }

  private async account(customerId: string) {
    const rows = await this.dataSource.query(`
      SELECT currency_code AS "currencyCode", last_synced_at AS "lastSyncedAt"
      FROM google_ads_accounts WHERE customer_id = $1 LIMIT 1
    `, [customerId]);
    return rows[0] ?? { currencyCode: null, lastSyncedAt: null };
  }

  private collectionResponse(key: string, items: any[], timeRange: string, account: any) {
    const totalCost = items.reduce((sum, item) => sum + item.cost, 0);
    const totalClicks = items.reduce((sum, item) => sum + item.clicks, 0);
    const totalConversions = items.reduce((sum, item) => sum + item.conversions, 0);
    const totalImpressions = items.reduce((sum, item) => sum + item.impressions, 0);
    const totalConversionValue = items.reduce((sum, item) => sum + item.conversionValue, 0);
    const metricStarts = items.map((item) => item.metricStart).filter(Boolean).sort();
    const metricEnds = items.map((item) => item.metricEnd).filter(Boolean).sort();
    return {
      [key]: items,
      timeRange,
      currencyCode: account.currencyCode ?? null,
      lastSyncedAt: account.lastSyncedAt ?? null,
      dataSource: 'DATABASE_SNAPSHOT',
      dataRangeStart: metricStarts[0] ?? null,
      dataRangeEnd: metricEnds.at(-1) ?? null,
      totalCost, totalClicks, totalConversions, totalImpressions,
      avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgRoas: totalCost > 0 ? totalConversionValue / totalCost : 0,
      dailyMetrics: [],
    };
  }

  private metric(row: any): Metric {
    const impressions = Number(row.impressions ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const cost = Number(row.costMicros ?? 0) / 1_000_000;
    const conversions = Number(row.conversions ?? 0);
    const conversionValue = Number(row.conversionValue ?? 0);
    return {
      impressions, clicks, cost, conversions, conversionValue,
      ctr: impressions > 0 ? clicks / impressions : 0,
      roas: cost > 0 ? conversionValue / cost : 0,
      costPerConversion: conversions > 0 ? cost / conversions : 0,
    };
  }

  private evaluate(metric: Metric, label: string) {
    if (metric.impressions < 100 || metric.clicks < 10) {
      return { score: 40, assessment: 'Need more data', action: 'Keep testing', reason: 'Data volume is still low' };
    }
    let score = 50 + (metric.roas >= 1.2 ? 30 : metric.roas >= 1 ? 20 : metric.roas >= 0.8 ? 5 : -20);
    score += label === 'BEST' ? 15 : label === 'GOOD' ? 5 : label === 'LOW' ? -20 : 0;
    score = Math.max(0, Math.min(100, score));
    if (score >= 80) return { score, assessment: 'Strong', action: 'Keep and scale', reason: 'Strong performance snapshot' };
    if (score >= 60) return { score, assessment: 'Good', action: 'Keep', reason: 'Good performance snapshot' };
    if (score >= 40) return { score, assessment: 'Needs improvement', action: 'Rewrite or test variant', reason: 'Performance can be improved' };
    return { score, assessment: 'Weak', action: 'Replace', reason: 'Weak performance snapshot' };
  }

  private dateBounds(timeRange: string): [string, string] {
    const custom = timeRange.match(/^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})$/);
    if (custom) return [custom[1], custom[2]];
    const end = new Date();
    const start = new Date(end);
    if (timeRange === 'YESTERDAY') {
      start.setUTCDate(start.getUTCDate() - 1);
      end.setUTCDate(end.getUTCDate() - 1);
    } else if (timeRange === 'LAST_7_DAYS') {
      start.setUTCDate(start.getUTCDate() - 6);
    } else if (timeRange === 'THIS_MONTH') {
      start.setUTCDate(1);
    }
    const format = (value: Date) => value.toISOString().slice(0, 10);
    return [format(start), format(end)];
  }
}
