import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { AdAssetLinkEntity } from '../../database/entities/ad-asset-link.entity';
import { AdGroupEntity } from '../../database/entities/ad-group.entity';
import { AdEntity } from '../../database/entities/ad.entity';
import { AiReviewRunEntity } from '../../database/entities/ai-review-run.entity';
import { AiSuggestionVariantEntity } from '../../database/entities/ai-suggestion-variant.entity';
import { AiSuggestionEntity } from '../../database/entities/ai-suggestion.entity';
import { AutomationRunItemEntity } from '../../database/entities/automation-run-item.entity';
import { AutomationRunEntity } from '../../database/entities/automation-run.entity';
import { AutomationScheduleEntity } from '../../database/entities/automation-schedule.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { ChangeRequestEntity } from '../../database/entities/change-request.entity';
import { CreativePolicyEntity } from '../../database/entities/creative-policy.entity';
import { CreativePolicyScopeEntity } from '../../database/entities/creative-policy-scope.entity';
import { CreativeTermEntity } from '../../database/entities/creative-term.entity';
import { GoogleAdsAccountEntity } from '../../database/entities/google-ads-account.entity';
import { SyncRunEntity } from '../../database/entities/sync-run.entity';
import { GoogleAdsAccountRegistryService } from '../../database/google-ads-account-registry.service';
import { CreativeAutomationService } from './creative-automation.service';
import { CreateCreativeTermDto } from './dto/create-creative-term.dto';
import { UpdateCreativeSettingsDto } from './dto/update-creative-settings.dto';
import { UpdateCreativeTermDto } from './dto/update-creative-term.dto';

const TERM_TYPES = new Set([
  'KEYWORD',
  'NEGATIVE_KEYWORD',
  'BRAND_TERM',
  'CTA',
  'PROHIBITED_CLAIM',
]);

const SCOPE_LEVELS = new Set(['ACCOUNT', 'CAMPAIGN', 'AD_GROUP']);

@Injectable()
export class CreativeOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly accountRegistry: GoogleAdsAccountRegistryService,
    private readonly automationService: CreativeAutomationService,
  ) {}

  async getOverview(customerId: string, googleAdGroupId?: string) {
    const account = await this.getAccount(customerId);
    const adGroups = await this.getAccountAdGroups(account.id, googleAdGroupId);
    const adGroupIds = adGroups.map((item) => item.id);
    const ads = adGroupIds.length
      ? await this.dataSource.getRepository(AdEntity).findBy({ adGroupId: In(adGroupIds) })
      : [];
    const adIds = ads.map((item) => item.id);
    const lowAssetLinks = adIds.length
      ? await this.dataSource.getRepository(AdAssetLinkEntity).countBy({
          adId: In(adIds),
          performanceLabel: 'LOW',
          enabled: true,
        })
      : 0;
    const runs = await this.getReviewRuns(account.id, adGroupIds);
    const runIds = runs.map((item) => item.id);
    const suggestions = runIds.length
      ? await this.dataSource.getRepository(AiSuggestionEntity).findBy({
          reviewRunId: In(runIds),
        })
      : [];
    const statusCounts = suggestions.reduce<Record<string, number>>((counts, item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      return counts;
    }, {});
    const recentChanges = await this.dataSource.getRepository(ChangeRequestEntity).find({
      where: { accountId: account.id },
      order: { requestedAt: 'DESC' },
      take: 5,
    });
    const policy = await this.getPolicy(account.workspaceId);
    const schedule = await this.dataSource
      .getRepository(AutomationScheduleEntity)
      .findOneBy({ policyId: policy.id });
    const recentAutomationRun = schedule
      ? await this.dataSource.getRepository(AutomationRunEntity).findOne({
          where: { scheduleId: schedule.id },
          order: { createdAt: 'DESC' },
        })
      : null;
    const lastSync = await this.dataSource.getRepository(SyncRunEntity).findOne({
      where: { accountId: account.id },
      order: { startedAt: 'DESC' },
    });

    return {
      account: {
        customerId: account.customerId,
        displayName: account.displayName,
        currencyCode: account.currencyCode,
        timeZone: account.timeZone,
        lastSyncedAt: account.lastSyncedAt,
      },
      scope: googleAdGroupId ? { adGroupId: googleAdGroupId } : { account: true },
      totals: {
        adGroups: adGroups.length,
        lowAssets: lowAssetLinks,
        recommendations: suggestions.length,
        pending: statusCounts.PENDING ?? 0,
        approved: statusCounts.APPROVED ?? 0,
        applied: statusCounts.APPLIED ?? 0,
        rejected: statusCounts.REJECTED ?? 0,
      },
      lastReviewAt: runs[0]?.startedAt ?? null,
      automation: schedule
        ? {
            enabled: schedule.enabled,
            intervalDays: schedule.intervalDays,
            lastRunAt: schedule.lastRunAt,
            nextRunAt: schedule.nextRunAt,
            lastStatus: recentAutomationRun?.status ?? null,
          }
        : null,
      lastSync,
      recentChanges,
    };
  }

  async getChangeImpact(
    customerId: string,
    inputDays?: string,
    input: {
      search?: string;
      source?: string;
      verdict?: string;
      page?: string;
      pageSize?: string;
    } = {},
  ) {
    const account = await this.getAccount(customerId);
    const parsedDays = Number(inputDays ?? 14);
    const days = [7, 14, 30].includes(parsedDays) ? parsedDays : 14;
    const search = String(input.search ?? '').trim();
    const source = String(input.source ?? 'ALL').trim().toUpperCase();
    const verdict = String(input.verdict ?? 'ALL').trim().toUpperCase();
    const page = Math.max(1, Number.parseInt(String(input.page ?? '1'), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number.parseInt(String(input.pageSize ?? '25'), 10) || 25),
    );
    const offset = (page - 1) * pageSize;
    const rows = await this.dataSource.query(
      `
        WITH applied_changes AS (
          SELECT
            cr.id,
            cr.ad_group_id,
            cr.source,
            cr.completed_at,
            COALESCE(
              string_agg(DISTINCT ci.change_type, ', ' ORDER BY ci.change_type),
              'ASSET_REPLACEMENT'
            ) AS change_types,
            COALESCE(SUM(ci.replacement_count), 0)::int AS replacement_count
          FROM change_requests cr
          LEFT JOIN change_items ci ON ci.change_request_id = cr.id
          JOIN ad_groups filter_ag ON filter_ag.id = cr.ad_group_id
          JOIN campaigns filter_c ON filter_c.id = filter_ag.campaign_id
          WHERE cr.account_id = $1
            AND cr.status = 'APPLIED'
            AND cr.completed_at IS NOT NULL
            AND cr.ad_group_id IS NOT NULL
            AND (
              $3::text = ''
              OR filter_c.name ILIKE '%' || $3 || '%'
              OR filter_c.google_campaign_id ILIKE '%' || $3 || '%'
              OR filter_ag.name ILIKE '%' || $3 || '%'
              OR filter_ag.google_ad_group_id ILIKE '%' || $3 || '%'
            )
            AND (
              $4::text = 'ALL'
              OR ($4 = 'MANUAL' AND cr.source = 'MANUAL')
              OR (
                $4 = 'AI_APPROVED'
                AND cr.source = 'AI_APPROVED'
                AND NOT EXISTS (
                  SELECT 1 FROM automation_runs source_run
                  WHERE source_run.change_request_id = cr.id
                )
              )
              OR (
                $4 = 'AI_AUTOMATION'
                AND EXISTS (
                  SELECT 1 FROM automation_runs source_run
                  WHERE source_run.change_request_id = cr.id
                )
              )
            )
          GROUP BY cr.id
        ),
        measured AS (
          SELECT
          ac.id AS change_id,
          ac.source,
          ac.completed_at,
          ac.change_types,
          ac.replacement_count,
          EXISTS (
            SELECT 1
            FROM automation_runs automation_run
            WHERE automation_run.change_request_id = ac.id
          ) AS automated,
          c.google_campaign_id,
          c.name AS campaign_name,
          ag.google_ad_group_id,
          ag.name AS ad_group_name,
          COALESCE(before_metrics.metric_days, 0)::int AS before_days,
          COALESCE(after_metrics.metric_days, 0)::int AS after_days,
          COALESCE(before_metrics.impressions, 0)::float8 AS before_impressions,
          COALESCE(before_metrics.clicks, 0)::float8 AS before_clicks,
          COALESCE(before_metrics.cost_micros, 0)::float8 AS before_cost_micros,
          COALESCE(before_metrics.conversions, 0)::float8 AS before_conversions,
          COALESCE(before_metrics.conversion_value, 0)::float8 AS before_conversion_value,
          COALESCE(after_metrics.impressions, 0)::float8 AS after_impressions,
          COALESCE(after_metrics.clicks, 0)::float8 AS after_clicks,
          COALESCE(after_metrics.cost_micros, 0)::float8 AS after_cost_micros,
          COALESCE(after_metrics.conversions, 0)::float8 AS after_conversions,
          COALESCE(after_metrics.conversion_value, 0)::float8 AS after_conversion_value
          FROM applied_changes ac
          JOIN ad_groups ag ON ag.id = ac.ad_group_id
          JOIN campaigns c ON c.id = ag.campaign_id
          LEFT JOIN LATERAL (
          SELECT
            COUNT(DISTINCT metric_date)::int AS metric_days,
            SUM(impressions)::float8 AS impressions,
            SUM(clicks)::float8 AS clicks,
            SUM(cost_micros)::float8 AS cost_micros,
            SUM(conversions)::float8 AS conversions,
            SUM(conversion_value)::float8 AS conversion_value
          FROM ad_group_daily_metrics
          WHERE ad_group_id = ac.ad_group_id
            AND metric_date BETWEEN
              (ac.completed_at::date - ($2::int * INTERVAL '1 day'))
              AND (ac.completed_at::date - INTERVAL '1 day')
          ) before_metrics ON true
          LEFT JOIN LATERAL (
          SELECT
            COUNT(DISTINCT metric_date)::int AS metric_days,
            SUM(impressions)::float8 AS impressions,
            SUM(clicks)::float8 AS clicks,
            SUM(cost_micros)::float8 AS cost_micros,
            SUM(conversions)::float8 AS conversions,
            SUM(conversion_value)::float8 AS conversion_value
          FROM ad_group_daily_metrics
          WHERE ad_group_id = ac.ad_group_id
            AND metric_date BETWEEN
              (ac.completed_at::date + INTERVAL '1 day')
              AND (ac.completed_at::date + ($2::int * INTERVAL '1 day'))
          ) after_metrics ON true
        ),
        scored AS (
          SELECT measured.*,
            CASE
              WHEN after_days < $2
                OR (
                  after_impressions = 0
                  AND after_clicks = 0
                  AND after_conversions = 0
                )
                THEN 'COLLECTING'
              ELSE CASE
                WHEN (
                  CASE
                    WHEN before_impressions = 0 AND after_impressions = 0 THEN 0
                    WHEN ABS(
                      (CASE WHEN after_impressions > 0 THEN after_clicks / after_impressions ELSE 0 END)
                      - (CASE WHEN before_impressions > 0 THEN before_clicks / before_impressions ELSE 0 END)
                    ) <= GREATEST(
                      ABS(CASE WHEN before_impressions > 0 THEN before_clicks / before_impressions ELSE 0 END) * 0.01,
                      0.000001
                    ) THEN 0
                    WHEN (CASE WHEN after_impressions > 0 THEN after_clicks / after_impressions ELSE 0 END)
                      > (CASE WHEN before_impressions > 0 THEN before_clicks / before_impressions ELSE 0 END)
                      THEN 1 ELSE -1
                  END
                  + CASE
                    WHEN before_clicks = 0 AND after_clicks = 0 THEN 0
                    WHEN ABS(
                      (CASE WHEN after_clicks > 0 THEN after_conversions / after_clicks ELSE 0 END)
                      - (CASE WHEN before_clicks > 0 THEN before_conversions / before_clicks ELSE 0 END)
                    ) <= GREATEST(
                      ABS(CASE WHEN before_clicks > 0 THEN before_conversions / before_clicks ELSE 0 END) * 0.01,
                      0.000001
                    ) THEN 0
                    WHEN (CASE WHEN after_clicks > 0 THEN after_conversions / after_clicks ELSE 0 END)
                      > (CASE WHEN before_clicks > 0 THEN before_conversions / before_clicks ELSE 0 END)
                      THEN 1 ELSE -1
                  END
                  + CASE
                    WHEN before_cost_micros = 0 AND after_cost_micros = 0 THEN 0
                    WHEN ABS(
                      (CASE WHEN after_cost_micros > 0 THEN after_conversion_value / (after_cost_micros / 1000000.0) ELSE 0 END)
                      - (CASE WHEN before_cost_micros > 0 THEN before_conversion_value / (before_cost_micros / 1000000.0) ELSE 0 END)
                    ) <= GREATEST(
                      ABS(CASE WHEN before_cost_micros > 0 THEN before_conversion_value / (before_cost_micros / 1000000.0) ELSE 0 END) * 0.01,
                      0.000001
                    ) THEN 0
                    WHEN (CASE WHEN after_cost_micros > 0 THEN after_conversion_value / (after_cost_micros / 1000000.0) ELSE 0 END)
                      > (CASE WHEN before_cost_micros > 0 THEN before_conversion_value / (before_cost_micros / 1000000.0) ELSE 0 END)
                      THEN 1 ELSE -1
                  END
                  + CASE
                    WHEN before_conversions = 0 AND after_conversions = 0 THEN 0
                    WHEN ABS(
                      (CASE WHEN after_conversions > 0 THEN (after_cost_micros / 1000000.0) / after_conversions ELSE 0 END)
                      - (CASE WHEN before_conversions > 0 THEN (before_cost_micros / 1000000.0) / before_conversions ELSE 0 END)
                    ) <= GREATEST(
                      ABS(CASE WHEN before_conversions > 0 THEN (before_cost_micros / 1000000.0) / before_conversions ELSE 0 END) * 0.01,
                      0.000001
                    ) THEN 0
                    WHEN (CASE WHEN after_conversions > 0 THEN (after_cost_micros / 1000000.0) / after_conversions ELSE 0 END)
                      > (CASE WHEN before_conversions > 0 THEN (before_cost_micros / 1000000.0) / before_conversions ELSE 0 END)
                      THEN -1 ELSE 1
                  END
                ) > 0 THEN 'IMPROVED'
                WHEN (
                  SIGN(
                    (CASE WHEN after_impressions > 0 THEN after_clicks / after_impressions ELSE 0 END)
                    - (CASE WHEN before_impressions > 0 THEN before_clicks / before_impressions ELSE 0 END)
                  )
                  + SIGN(
                    (CASE WHEN after_clicks > 0 THEN after_conversions / after_clicks ELSE 0 END)
                    - (CASE WHEN before_clicks > 0 THEN before_conversions / before_clicks ELSE 0 END)
                  )
                  + SIGN(
                    (CASE WHEN after_cost_micros > 0 THEN after_conversion_value / (after_cost_micros / 1000000.0) ELSE 0 END)
                    - (CASE WHEN before_cost_micros > 0 THEN before_conversion_value / (before_cost_micros / 1000000.0) ELSE 0 END)
                  )
                  - SIGN(
                    (CASE WHEN after_conversions > 0 THEN (after_cost_micros / 1000000.0) / after_conversions ELSE 0 END)
                    - (CASE WHEN before_conversions > 0 THEN (before_cost_micros / 1000000.0) / before_conversions ELSE 0 END)
                  )
                ) < 0 THEN 'DECLINED'
                ELSE 'MIXED'
              END
            END AS verdict
          FROM measured
        ),
        summary AS (
          SELECT
            COUNT(*)::int AS total_changes,
            COUNT(*) FILTER (WHERE verdict = 'IMPROVED')::int AS total_improved,
            COUNT(*) FILTER (WHERE verdict = 'DECLINED')::int AS total_declined,
            COUNT(*) FILTER (WHERE verdict = 'MIXED')::int AS total_mixed,
            COUNT(*) FILTER (WHERE verdict = 'COLLECTING')::int AS total_collecting
          FROM scored
        ),
        filtered AS (
          SELECT * FROM scored
          WHERE $5::text = 'ALL' OR verdict = $5
        )
        SELECT page_rows.*, summary.*,
          (SELECT COUNT(*)::int FROM filtered) AS filtered_total
        FROM summary
        LEFT JOIN LATERAL (
          SELECT *
          FROM filtered
          ORDER BY completed_at DESC
          LIMIT $6 OFFSET $7
        ) page_rows ON true
      `,
      [account.id, days, search, source, verdict, pageSize, offset],
    );

    const changes: any[] = rows
      .filter((row: Record<string, unknown>) => Boolean(row.change_id))
      .map((row: Record<string, unknown>) => {
      const before = this.impactMetrics(row, 'before');
      const after = this.impactMetrics(row, 'after');
      const afterDays = Number(row.after_days ?? 0);

      return {
        id: String(row.change_id),
        source: String(row.source ?? ''),
        origin: row.automated
          ? 'AI_AUTOMATION'
          : String(row.source ?? '') === 'AI_APPROVED'
            ? 'AI_APPROVED'
            : 'MANUAL',
        appliedAt: row.completed_at,
        changeTypes: String(row.change_types ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        replacementCount: Number(row.replacement_count ?? 0),
        campaign: {
          id: String(row.google_campaign_id ?? ''),
          name: String(row.campaign_name ?? ''),
        },
        adGroup: {
          id: String(row.google_ad_group_id ?? ''),
          name: String(row.ad_group_name ?? ''),
        },
        coverage: {
          requestedDays: days,
          beforeDays: Number(row.before_days ?? 0),
          afterDays,
        },
        before,
        after,
        verdict: String(row.verdict ?? 'COLLECTING'),
        };
      });
    const summary = rows[0] ?? {};
    const filteredTotal = Number(summary.filtered_total ?? 0);

    return {
      account: {
        customerId: account.customerId,
        displayName: account.displayName,
        currencyCode: account.currencyCode,
      },
      windowDays: days,
      methodology:
        'Compares equal calendar windows before and after each applied change. The change day is excluded.',
      totals: {
        changes: Number(summary.total_changes ?? 0),
        improved: Number(summary.total_improved ?? 0),
        declined: Number(summary.total_declined ?? 0),
        mixed: Number(summary.total_mixed ?? 0),
        collecting: Number(summary.total_collecting ?? 0),
      },
      pagination: {
        page,
        pageSize,
        total: filteredTotal,
        totalPages: Math.max(1, Math.ceil(filteredTotal / pageSize)),
      },
      changes,
    };
  }

  async getChangeHistory(
    customerId: string,
    input: {
      search?: string;
      source?: string;
      status?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    const account = await this.getAccount(customerId);
    const search = String(input.search ?? '').trim();
    const source = String(input.source ?? 'ALL').trim().toUpperCase();
    const status = String(input.status ?? 'ALL').trim().toUpperCase();
    const page = Math.max(1, Number.parseInt(String(input.page ?? '1'), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number.parseInt(String(input.pageSize ?? '25'), 10) || 25),
    );
    const offset = (page - 1) * pageSize;
    const parameters: unknown[] = [account.id];
    const conditions = ['cr.account_id = $1'];

    if (search) {
      parameters.push(`%${search}%`);
      conditions.push(`(
        c.name ILIKE $${parameters.length}
        OR c.google_campaign_id ILIKE $${parameters.length}
        OR ag.name ILIKE $${parameters.length}
        OR ag.google_ad_group_id ILIKE $${parameters.length}
      )`);
    }
    if (source !== 'ALL') {
      if (source === 'AI_AUTOMATION') {
        conditions.push(`EXISTS (
          SELECT 1 FROM automation_runs ar WHERE ar.change_request_id = cr.id
        )`);
      } else if (source === 'AI_APPROVED') {
        conditions.push(`cr.source = 'AI_APPROVED' AND NOT EXISTS (
          SELECT 1 FROM automation_runs ar WHERE ar.change_request_id = cr.id
        )`);
      } else if (source === 'MANUAL') {
        conditions.push(`cr.source = 'MANUAL'`);
      }
    }
    if (status !== 'ALL') {
      parameters.push(status);
      conditions.push(`cr.status = $${parameters.length}`);
    }

    const where = conditions.join(' AND ');
    const countResult = await this.dataSource.query(
      `
        SELECT COUNT(*)::int AS total
        FROM change_requests cr
        LEFT JOIN ad_groups ag ON ag.id = cr.ad_group_id
        LEFT JOIN campaigns c ON c.id = ag.campaign_id
        WHERE ${where}
      `,
      parameters,
    );
    parameters.push(pageSize, offset);
    const rows = await this.dataSource.query(
      `
        SELECT
          cr.id,
          cr.source,
          cr.status,
          cr.requested_at,
          cr.completed_at,
          cr.error_message,
          c.google_campaign_id,
          c.name AS campaign_name,
          ag.google_ad_group_id,
          ag.name AS ad_group_name,
          COALESCE(
            string_agg(DISTINCT ci.change_type, ', ' ORDER BY ci.change_type),
            'ASSET_REPLACEMENT'
          ) AS change_types,
          COALESCE(SUM(ci.replacement_count), 0)::int AS replacement_count,
          EXISTS (
            SELECT 1 FROM automation_runs ar WHERE ar.change_request_id = cr.id
          ) AS automated
        FROM change_requests cr
        LEFT JOIN ad_groups ag ON ag.id = cr.ad_group_id
        LEFT JOIN campaigns c ON c.id = ag.campaign_id
        LEFT JOIN change_items ci ON ci.change_request_id = cr.id
        WHERE ${where}
        GROUP BY cr.id, c.id, ag.id
        ORDER BY cr.requested_at DESC
        LIMIT $${parameters.length - 1} OFFSET $${parameters.length}
      `,
      parameters,
    );

    const items = rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      source: String(row.source ?? ''),
      origin: row.automated
        ? 'AI_AUTOMATION'
        : String(row.source ?? '') === 'AI_APPROVED'
          ? 'AI_APPROVED'
          : 'MANUAL',
      status: String(row.status ?? ''),
      requestedAt: row.requested_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
      campaign: row.google_campaign_id
        ? {
            id: String(row.google_campaign_id),
            name: String(row.campaign_name ?? ''),
          }
        : null,
      adGroup: row.google_ad_group_id
        ? {
            id: String(row.google_ad_group_id),
            name: String(row.ad_group_name ?? ''),
          }
        : null,
      changeTypes: String(row.change_types ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      replacementCount: Number(row.replacement_count ?? 0),
    }));
    const total = Number(countResult[0]?.total ?? 0);
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getRecommendations(
    customerId: string,
    googleAdGroupId?: string,
    status?: string,
  ) {
    const account = await this.getAccount(customerId);
    const adGroups = await this.getAccountAdGroups(account.id, googleAdGroupId);
    const adGroupIds = adGroups.map((item) => item.id);
    const adGroupMap = new Map(adGroups.map((item) => [item.id, item]));
    const runs = await this.getReviewRuns(account.id, adGroupIds);
    const runIds = runs.map((item) => item.id);
    if (!runIds.length) return { recommendations: [], total: 0 };

    const where: { reviewRunId: ReturnType<typeof In>; status?: string } = {
      reviewRunId: In(runIds),
    };
    if (status && status !== 'ALL') where.status = status;
    const suggestions = await this.dataSource.getRepository(AiSuggestionEntity).find({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const variants = suggestions.length
      ? await this.dataSource.getRepository(AiSuggestionVariantEntity).find({
          where: { suggestionId: In(suggestions.map((item) => item.id)) },
          order: { rank: 'ASC' },
        })
      : [];
    const runMap = new Map(runs.map((item) => [item.id, item]));
    const variantMap = new Map<string, AiSuggestionVariantEntity[]>();
    for (const variant of variants) {
      variantMap.set(variant.suggestionId, [
        ...(variantMap.get(variant.suggestionId) ?? []),
        variant,
      ]);
    }

    return {
      total: suggestions.length,
      recommendations: suggestions.map((item) => {
        const run = runMap.get(item.reviewRunId);
        const adGroup = run?.adGroupId ? adGroupMap.get(run.adGroupId) : null;
        return {
          ...item,
          adGroup: adGroup
            ? { id: adGroup.googleAdGroupId, name: adGroup.name }
            : null,
          provider: run?.provider ?? null,
          model: run?.model ?? null,
          variants: variantMap.get(item.id) ?? [],
        };
      }),
    };
  }

  async getChangeHistoryDetail(customerId: string, changeId: string) {
    const account = await this.getAccount(customerId);
    const rows = await this.dataSource.query(
      `
        SELECT
          cr.id AS change_request_id,
          cr.source,
          cr.status AS request_status,
          cr.requested_at,
          cr.completed_at,
          cr.error_message AS request_error_message,
          ci.id,
          ci.change_type,
          ci.media_type,
          ci.before_payload,
          ci.after_payload,
          ci.old_asset_resource_name,
          ci.new_asset_resource_name,
          ci.old_ad_resource_name,
          ci.new_ad_resource_name,
          ci.replacement_count,
          ci.status,
          ci.error_code,
          ci.error_message
        FROM change_requests cr
        LEFT JOIN change_items ci ON ci.change_request_id = cr.id
        WHERE cr.id = $1 AND cr.account_id = $2
        ORDER BY ci.created_at ASC
      `,
      [changeId, account.id],
    );
    if (!rows.length) {
      throw new NotFoundException('Không tìm thấy lịch sử thay đổi');
    }

    const request = rows[0] as Record<string, unknown>;
    return {
      id: String(request.change_request_id),
      source: String(request.source ?? ''),
      status: String(request.request_status ?? ''),
      requestedAt: request.requested_at,
      completedAt: request.completed_at,
      errorMessage: request.request_error_message,
      items: rows
        .filter((row: Record<string, unknown>) => row.id)
        .map((row: Record<string, unknown>) => ({
          id: String(row.id),
          changeType: String(row.change_type ?? ''),
          mediaType: row.media_type ? String(row.media_type) : null,
          before: row.before_payload ?? {},
          after: row.after_payload ?? {},
          oldAssetResourceName: row.old_asset_resource_name,
          newAssetResourceName: row.new_asset_resource_name,
          oldAdResourceName: row.old_ad_resource_name,
          newAdResourceName: row.new_ad_resource_name,
          replacementCount: Number(row.replacement_count ?? 0),
          status: String(row.status ?? ''),
          errorCode: row.error_code,
          errorMessage: row.error_message,
        })),
    };
  }

  async getTerms(customerId: string) {
    const account = await this.getAccount(customerId);
    const policy = await this.getPolicy(account.workspaceId);
    const terms = await this.dataSource.getRepository(CreativeTermEntity).find({
      where: { policyId: policy.id },
      order: { termType: 'ASC', languageCode: 'ASC', term: 'ASC' },
    });
    return { policyId: policy.id, terms };
  }

  async createTerm(input: CreateCreativeTermDto) {
    const customerId = this.normalizeCustomerId(input.customerId);
    const account = await this.getAccount(customerId);
    const policy = await this.getPolicy(account.workspaceId);
    const termType = this.normalizeTermType(input.termType);
    const languageCode = String(input.languageCode ?? 'en').trim().toLowerCase();
    const marketCode = this.normalizeMarketCode(input.marketCode);
    const scope = this.normalizeTermScope(input);
    const term = String(input.term ?? '').trim();
    if (!term) throw new BadRequestException('Term is required');

    const duplicate = await this.dataSource
      .getRepository(CreativeTermEntity)
      .createQueryBuilder('term')
      .where('term.policy_id = :policyId', { policyId: policy.id })
      .andWhere('term.term_type = :termType', { termType })
      .andWhere('term.language_code = :languageCode', { languageCode })
      .andWhere('COALESCE(term.market_code, \'\') = :marketCode', { marketCode: marketCode ?? '' })
      .andWhere('term.scope_level = :scopeLevel', { scopeLevel: scope.scopeLevel })
      .andWhere('COALESCE(term.google_campaign_id, \'\') = :googleCampaignId', {
        googleCampaignId: scope.googleCampaignId ?? '',
      })
      .andWhere('COALESCE(term.google_ad_group_id, \'\') = :googleAdGroupId', {
        googleAdGroupId: scope.googleAdGroupId ?? '',
      })
      .andWhere('LOWER(term.term) = LOWER(:term)', { term })
      .getOne();
    if (duplicate) throw new BadRequestException('This term already exists');

    return this.dataSource.getRepository(CreativeTermEntity).save({
      policyId: policy.id,
      termType,
      languageCode,
      marketCode,
      ...scope,
      term,
      weight: String(this.clampNumber(input.weight, 1, 0, 100)),
      active: true,
    });
  }

  async updateTerm(id: string, input: UpdateCreativeTermDto) {
    const repository = this.dataSource.getRepository(CreativeTermEntity);
    const entity = await repository.findOneBy({ id });
    if (!entity) throw new NotFoundException('Creative term not found');
    if (input.termType !== undefined) entity.termType = this.normalizeTermType(input.termType);
    if (input.languageCode !== undefined) {
      entity.languageCode = String(input.languageCode).trim().toLowerCase() || 'en';
    }
    if (input.marketCode !== undefined) {
      entity.marketCode = this.normalizeMarketCode(input.marketCode);
    }
    if (
      input.scopeLevel !== undefined ||
      input.googleCampaignId !== undefined ||
      input.googleAdGroupId !== undefined
    ) {
      Object.assign(entity, this.normalizeTermScope({
        scopeLevel: input.scopeLevel ?? entity.scopeLevel,
        googleCampaignId: input.googleCampaignId ?? entity.googleCampaignId,
        googleAdGroupId: input.googleAdGroupId ?? entity.googleAdGroupId,
      }));
    }
    if (input.term !== undefined) {
      entity.term = String(input.term).trim();
      if (!entity.term) throw new BadRequestException('Term is required');
    }
    if (input.weight !== undefined) {
      entity.weight = String(this.clampNumber(input.weight, 1, 0, 100));
    }
    if (input.active !== undefined) entity.active = Boolean(input.active);
    return repository.save(entity);
  }

  async deleteTerm(id: string) {
    const repository = this.dataSource.getRepository(CreativeTermEntity);
    const entity = await repository.findOneBy({ id });
    if (!entity) throw new NotFoundException('Creative term not found');
    await repository.remove(entity);
    return { deleted: true, id };
  }

  async getSettings(customerId: string) {
    const account = await this.getAccount(customerId);
    const policy = await this.getPolicy(account.workspaceId);
    const schedule = await this.dataSource
      .getRepository(AutomationScheduleEntity)
      .findOneBy({ policyId: policy.id });
    const recentAutomationRuns = schedule
      ? await this.dataSource.getRepository(AutomationRunEntity).find({
          where: { scheduleId: schedule.id },
          order: { createdAt: 'DESC' },
          take: 5,
        })
      : [];
    return {
      account: {
        customerId: account.customerId,
        displayName: account.displayName,
        status: account.status,
        timeZone: account.timeZone,
        lastSyncedAt: account.lastSyncedAt,
      },
      policy,
      schedule,
      recentAutomationRuns,
      providers: {
        googleAdsConfigured: Boolean(
          account.lastSyncedAt ||
            process.env.GOOGLE_ADS_CONFIG_PATH ||
            process.env.GOOGLE_ADS_KEY_FILE ||
            process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        ),
        geminiConfigured: Boolean(
          process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
        ),
      },
    };
  }

  async getAutomationNotifications(customerId: string) {
    const account = await this.getAccount(customerId);
    const policy = await this.getPolicy(account.workspaceId);
    const schedule = await this.dataSource
      .getRepository(AutomationScheduleEntity)
      .findOneBy({ policyId: policy.id });

    if (!schedule) {
      return { notifications: [] };
    }

    const runs = await this.dataSource.getRepository(AutomationRunEntity).find({
      where: { scheduleId: schedule.id },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    const runIds = runs.map((run) => run.id);
    if (!runIds.length) {
      return { notifications: [] };
    }

    const runMap = new Map(runs.map((run) => [run.id, run]));
    const items = await this.dataSource.getRepository(AutomationRunItemEntity).find({
      where: {
        automationRunId: In(runIds),
        action: In(['APPLIED', 'SUGGESTED', 'FAILED']),
      },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      notifications: items.map((item) => {
        const run = runMap.get(item.automationRunId);
        const applied = item.action === 'APPLIED';
        const failed = item.action === 'FAILED';
        return {
          id: `automation-${item.id}`,
          severity: failed ? 'warning' : 'info',
          title: applied
            ? 'AI định kỳ đã thay asset'
            : failed
              ? 'AI định kỳ cần kiểm tra'
              : 'AI định kỳ đã tạo đề xuất',
          message: item.reason ?? 'AI định kỳ vừa chạy',
          targetLabel: 'AI định kỳ',
          createdAtLabel: run?.completedAt ?? run?.startedAt ?? item.createdAt,
          recommendations: applied
            ? ['Kiểm tra hiệu quả sau lần thay mới.', 'Giữ AI định kỳ bật nếu kết quả ổn định.']
            : failed
              ? ['Mở Settings để xem lỗi automation.', 'Chạy lại sau khi kiểm tra cấu hình Google Ads/Gemini.']
              : ['Mở Recommendations để duyệt đề xuất.', 'Bật AI định kỳ nếu muốn tự apply mỗi 14 ngày.'],
          runStatus: run?.status ?? null,
          action: item.action,
        };
      }),
    };
  }

  async updateSettings(customerId: string, input: UpdateCreativeSettingsDto) {
    const account = await this.getAccount(customerId);
    const policy = await this.getPolicy(account.workspaceId);
    if (input.languageStrategy !== undefined) {
      const strategy = String(input.languageStrategy).toUpperCase();
      if (!['DETECT_FROM_ASSET', 'FIXED'].includes(strategy)) {
        throw new BadRequestException('Invalid language strategy');
      }
      policy.languageStrategy = strategy;
    }
    if (input.targetLanguage !== undefined) {
      policy.targetLanguage = input.targetLanguage?.trim().toLowerCase() || null;
    }
    if (policy.languageStrategy === 'FIXED' && !policy.targetLanguage) {
      throw new BadRequestException('Choose a target language for FIXED strategy');
    }
    if (input.approvalMode !== undefined) {
      const approvalMode = String(input.approvalMode).trim().toUpperCase();
      if (!['MANUAL', 'AUTO'].includes(approvalMode)) {
        throw new BadRequestException('Invalid approval mode');
      }
      policy.approvalMode = approvalMode;
    }
    if (input.targetLabels !== undefined) {
      const labels = input.targetLabels
        .map((item) => String(item).trim().toUpperCase())
        .filter(Boolean);
      policy.selectionCriteria = { ...policy.selectionCriteria, targetLabels: labels };
    }
    if (input.minimumImpressions !== undefined) {
      policy.minimumImpressions = String(
        Math.round(this.clampNumber(input.minimumImpressions, 0, 0, 1_000_000_000)),
      );
    }
    if (input.minimumClicks !== undefined) {
      policy.minimumClicks = String(
        Math.round(this.clampNumber(input.minimumClicks, 0, 0, 1_000_000_000)),
      );
    }
    if (input.reviewIntervalDays !== undefined) {
      policy.reviewIntervalDays = Math.round(
        this.clampNumber(input.reviewIntervalDays, 14, 1, 365),
      );
    }
    if (input.cooldownDays !== undefined) {
      policy.cooldownDays = Math.round(this.clampNumber(input.cooldownDays, 14, 0, 365));
    }
    if (input.maxChangesPerRun !== undefined) {
      policy.maxChangesPerRun = Math.round(
        this.clampNumber(input.maxChangesPerRun, 10, 1, 100),
      );
    }
    const savedPolicy = await this.dataSource.getRepository(CreativePolicyEntity).save(policy);
    if (input.automationEnabled !== undefined || input.reviewIntervalDays !== undefined) {
      await this.automationService.ensureSchedule(savedPolicy, {
        enabled: input.automationEnabled,
        intervalDays: savedPolicy.reviewIntervalDays,
        timezone: account.timeZone,
      });
    }
    return savedPolicy;
  }

  async updateAutomationSettings(customerId: string, input: UpdateCreativeSettingsDto) {
    const account = await this.getAccount(customerId);
    const policy = await this.getPolicy(account.workspaceId);
    if (input.reviewIntervalDays !== undefined) {
      policy.reviewIntervalDays = Math.round(
        this.clampNumber(input.reviewIntervalDays, 14, 1, 365),
      );
    }
    if (input.maxChangesPerRun !== undefined) {
      policy.maxChangesPerRun = Math.round(
        this.clampNumber(input.maxChangesPerRun, 10, 1, 100),
      );
    }
    policy.approvalMode = input.automationEnabled === false ? 'MANUAL' : 'AUTO';

    const savedPolicy = await this.dataSource.getRepository(CreativePolicyEntity).save(policy);
    if (input.automationEnabled) {
      await this.ensurePolicyAccountScope(savedPolicy.id, account.id);
    }
    await this.automationService.ensureSchedule(savedPolicy, {
      enabled: Boolean(input.automationEnabled),
      intervalDays: savedPolicy.reviewIntervalDays,
      timezone: account.timeZone,
    });

    return this.getSettings(customerId);
  }

  async runAutomationNow(customerId: string) {
    const account = await this.getAccount(customerId);
    const policy = await this.getPolicy(account.workspaceId);
    policy.approvalMode = 'AUTO';
    await this.dataSource.getRepository(CreativePolicyEntity).save(policy);
    await this.ensurePolicyAccountScope(policy.id, account.id);
    const schedule = await this.automationService.ensureSchedule(policy, {
      enabled: true,
      intervalDays: policy.reviewIntervalDays,
      timezone: account.timeZone,
    });
    const maxChangesOverride = Math.round(
      this.clampNumber(
        process.env.AUTOMATION_RUN_NOW_MAX_CHANGES,
        5000,
        1,
        50000,
      ),
    );
    const run = await this.automationService.runSchedule(schedule.id, {
      force: true,
      now: new Date(),
      accountIds: [account.id],
      maxChangesOverride,
      approvalModeOverride: 'AUTO',
    });
    const items = await this.dataSource.getRepository(AutomationRunItemEntity).find({
      where: { automationRunId: run.id },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return { ...run, maxChangesOverride, items };
  }

  private async getAccount(customerId: string) {
    return this.accountRegistry.getOrCreate(customerId);
  }

  private impactMetrics(row: Record<string, unknown>, prefix: 'before' | 'after') {
    const impressions = Number(row[`${prefix}_impressions`] ?? 0);
    const clicks = Number(row[`${prefix}_clicks`] ?? 0);
    const cost = Number(row[`${prefix}_cost_micros`] ?? 0) / 1_000_000;
    const conversions = Number(row[`${prefix}_conversions`] ?? 0);
    const conversionValue = Number(row[`${prefix}_conversion_value`] ?? 0);
    return {
      impressions,
      clicks,
      cost,
      conversions,
      conversionValue,
      ctr: impressions > 0 ? clicks / impressions : 0,
      conversionRate: clicks > 0 ? conversions / clicks : 0,
      cpa: conversions > 0 ? cost / conversions : 0,
      roas: cost > 0 ? conversionValue / cost : 0,
    };
  }

  private metricDirection(before: number, after: number, lowerIsBetter = false) {
    if (before === 0 && after === 0) return 0;
    const delta = after - before;
    const tolerance = Math.max(Math.abs(before) * 0.01, 0.000001);
    if (Math.abs(delta) <= tolerance) return 0;
    const direction = delta > 0 ? 1 : -1;
    return lowerIsBetter ? -direction : direction;
  }

  private async getPolicy(workspaceId: string) {
    const policy = await this.dataSource.getRepository(CreativePolicyEntity).findOne({
      where: { workspaceId, enabled: true },
      order: { version: 'DESC' },
    });
    if (!policy) throw new NotFoundException('Creative policy is not configured');
    return policy;
  }

  private async ensurePolicyAccountScope(policyId: string, accountId: string) {
    const repository = this.dataSource.getRepository(CreativePolicyScopeEntity);
    const existing = await repository.findOneBy({ policyId, accountId });
    if (existing) return existing;
    return repository.save({
      policyId,
      accountId,
      campaignId: null,
      adGroupId: null,
    });
  }

  private async getAccountAdGroups(accountId: string, googleAdGroupId?: string) {
    const campaigns = await this.dataSource
      .getRepository(CampaignEntity)
      .findBy({ accountId });
    if (!campaigns.length) return [];
    const adGroups = await this.dataSource.getRepository(AdGroupEntity).findBy({
      campaignId: In(campaigns.map((item) => item.id)),
    });
    return googleAdGroupId
      ? adGroups.filter((item) => item.googleAdGroupId === googleAdGroupId)
      : adGroups;
  }

  private async getReviewRuns(accountId: string, adGroupIds: string[]) {
    if (!adGroupIds.length) return [];
    return this.dataSource.getRepository(AiReviewRunEntity).find({
      where: { accountId, adGroupId: In(adGroupIds) },
      order: { startedAt: 'DESC' },
      take: 500,
    });
  }

  private normalizeCustomerId(value: unknown) {
    const customerId = String(value ?? '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(customerId)) {
      throw new BadRequestException('customerId must be a 10 digit Google Ads customer ID');
    }
    return customerId;
  }

  private normalizeTermType(value: unknown) {
    const termType = String(value ?? 'KEYWORD').trim().toUpperCase();
    if (!TERM_TYPES.has(termType)) throw new BadRequestException('Invalid term type');
    return termType;
  }

  private normalizeMarketCode(value: unknown) {
    const marketCode = String(value ?? '').trim().toUpperCase();
    return marketCode || null;
  }

  private normalizeTermScope(input: {
    scopeLevel?: unknown;
    googleCampaignId?: unknown;
    googleAdGroupId?: unknown;
  }) {
    const scopeLevel = String(input.scopeLevel ?? 'ACCOUNT').trim().toUpperCase();
    if (!SCOPE_LEVELS.has(scopeLevel)) {
      throw new BadRequestException('Invalid rule scope');
    }

    const googleCampaignId = this.normalizeOptionalGoogleId(input.googleCampaignId);
    const googleAdGroupId = this.normalizeOptionalGoogleId(input.googleAdGroupId);

    if (scopeLevel === 'CAMPAIGN' && !googleCampaignId) {
      throw new BadRequestException('Campaign scope requires a campaign ID');
    }

    if (scopeLevel === 'AD_GROUP' && !googleAdGroupId) {
      throw new BadRequestException('Ad group scope requires an ad group ID');
    }

    return {
      scopeLevel,
      googleCampaignId: scopeLevel === 'ACCOUNT' ? null : googleCampaignId,
      googleAdGroupId: scopeLevel === 'AD_GROUP' ? googleAdGroupId : null,
    };
  }

  private normalizeOptionalGoogleId(value: unknown) {
    const googleId = String(value ?? '').replace(/\D/g, '');
    return googleId || null;
  }

  private clampNumber(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback;
  }
}
