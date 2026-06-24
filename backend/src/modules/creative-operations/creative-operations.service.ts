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
import { AutomationScheduleEntity } from '../../database/entities/automation-schedule.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { ChangeRequestEntity } from '../../database/entities/change-request.entity';
import { CreativePolicyEntity } from '../../database/entities/creative-policy.entity';
import { CreativeTermEntity } from '../../database/entities/creative-term.entity';
import { GoogleAdsAccountEntity } from '../../database/entities/google-ads-account.entity';
import { SyncRunEntity } from '../../database/entities/sync-run.entity';
import { GoogleAdsAccountRegistryService } from '../../database/google-ads-account-registry.service';
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
      lastSync,
      recentChanges,
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
    return this.dataSource.getRepository(CreativePolicyEntity).save(policy);
  }

  private async getAccount(customerId: string) {
    return this.accountRegistry.getOrCreate(customerId);
  }

  private async getPolicy(workspaceId: string) {
    const policy = await this.dataSource.getRepository(CreativePolicyEntity).findOne({
      where: { workspaceId, enabled: true },
      order: { version: 'DESC' },
    });
    if (!policy) throw new NotFoundException('Creative policy is not configured');
    return policy;
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
