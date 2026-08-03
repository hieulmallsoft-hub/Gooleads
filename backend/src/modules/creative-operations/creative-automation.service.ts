import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, In, IsNull, LessThanOrEqual } from 'typeorm';
import { AutomationRunItemEntity } from '../../database/entities/automation-run-item.entity';
import { AutomationRunEntity } from '../../database/entities/automation-run.entity';
import { AutomationScheduleEntity } from '../../database/entities/automation-schedule.entity';
import { AdGroupEntity } from '../../database/entities/ad-group.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { CreativePolicyScopeEntity } from '../../database/entities/creative-policy-scope.entity';
import { CreativePolicyEntity } from '../../database/entities/creative-policy.entity';
import { GoogleAdsAccountEntity } from '../../database/entities/google-ads-account.entity';
import { AiPersistenceService } from '../../google-ads/ai-persistence.service';
import { ChangeRequestService } from '../../google-ads/change-request.service';
import { GoogleAdsService } from '../../google-ads/google-ads.service';
import { GoogleAdsSyncService } from '../../google-ads/google-ads-sync.service';

type TextReplacement = {
  oldText: string;
  newText: string;
  suggestionId?: string;
  variantId?: string;
};

type SavedTextSuggestion = {
  suggestionId?: string;
  fieldType?: string;
  text?: string;
  suggestion?: string;
  variants?: Array<{
    id: string;
    content?: { text?: string };
  }>;
};

type AutomationTarget = {
  customerId: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
};

type AutomationRunOptions = {
  force?: boolean;
  now?: Date;
  accountIds?: string[];
  maxChangesOverride?: number;
  approvalModeOverride?: 'AUTO' | 'MANUAL';
};

@Injectable()
export class CreativeAutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CreativeAutomationService.name);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private runningDueCheck = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly googleAdsService: GoogleAdsService,
    private readonly googleAdsSyncService: GoogleAdsSyncService,
    private readonly aiPersistenceService: AiPersistenceService,
    private readonly changeRequestService: ChangeRequestService,
  ) {}

  onModuleInit() {
    if (process.env.AUTOMATION_WORKER_DISABLED === 'true') {
      return;
    }

    const pollMs = this.clampNumber(
      process.env.AUTOMATION_POLL_INTERVAL_MS,
      60_000,
      10_000,
      3_600_000,
    );
    this.pollTimer = setInterval(() => {
      void this.runDueSchedules().catch((error) => {
        this.logger.error(
          `Automation due check failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, pollMs);

    void this.runDueSchedules().catch((error) => {
      this.logger.error(
        `Initial automation due check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    void this.aiPersistenceService.recoverStaleApplyingRequests().then((recovered) => {
      if (recovered > 0) {
        this.logger.warn(`Recovered ${recovered} interrupted change request(s)`);
      }
    }).catch((error) => {
      this.logger.error(
        `Change request recovery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async runDueSchedules(now = new Date()) {
    if (this.runningDueCheck) {
      return [];
    }

    this.runningDueCheck = true;
    try {
      const repository = this.dataSource.getRepository(AutomationScheduleEntity);
      const dueSchedules = await repository.find({
        where: [
          { enabled: true, nextRunAt: IsNull() },
          { enabled: true, nextRunAt: LessThanOrEqual(now) },
        ],
        order: { nextRunAt: 'ASC' },
        take: this.clampNumber(process.env.AUTOMATION_DUE_LIMIT, 5, 1, 50),
      });

      const results = [];
      for (const schedule of dueSchedules) {
        results.push(await this.runSchedule(schedule.id, { now }));
      }
      return results;
    } finally {
      this.runningDueCheck = false;
    }
  }

  async runSchedule(scheduleId: string, options: AutomationRunOptions = {}) {
    const now = options.now ?? new Date();
    const scheduleRepository = this.dataSource.getRepository(AutomationScheduleEntity);
    const runRepository = this.dataSource.getRepository(AutomationRunEntity);
    const schedule = await scheduleRepository.findOneBy({ id: scheduleId });
    if (!schedule) throw new NotFoundException('Automation schedule not found');

    if (!options.force && !schedule.enabled) {
      throw new NotFoundException('Automation schedule is disabled');
    }

    const existingRun = await runRepository.findOneBy({
      scheduleId: schedule.id,
      status: 'RUNNING',
    });
    if (existingRun) {
      if (!this.isStaleRunningRun(existingRun, now)) {
        return existingRun;
      }
      existingRun.status = 'FAILED';
      existingRun.completedAt = now;
      existingRun.errorMessage = 'Automation run was interrupted before completion';
      await runRepository.save(existingRun);
    }

    const run: AutomationRunEntity = await runRepository.save(
      runRepository.create({
        scheduleId: schedule.id,
        reviewRunId: null,
        changeRequestId: null,
        status: 'RUNNING',
        selectedCount: 0,
        appliedCount: 0,
        failedCount: 0,
        scheduledFor: options.force ? now : schedule.nextRunAt ?? now,
        startedAt: now,
        lastHeartbeatAt: now,
        completedAt: null,
        errorMessage: null,
      }),
    );

    try {
      const policy = await this.dataSource
        .getRepository(CreativePolicyEntity)
        .findOneBy({ id: schedule.policyId });
      if (!policy || !policy.enabled) {
        await this.saveRunItem(run.id, 'SKIPPED', 'Creative policy is disabled');
        return await this.completeRun(run, schedule, now, 'SKIPPED');
      }
      if (options.approvalModeOverride) {
        policy.approvalMode = options.approvalModeOverride;
      }

      const timeRange = this.buildTrailingDateRange(
        Math.max(policy.reviewIntervalDays, 1),
        schedule.timezone,
        now,
      );
      const targets = await this.getAutomationTargets(policy, timeRange, options.accountIds);
      const maxChanges = Math.max(
        options.maxChangesOverride ?? policy.maxChangesPerRun,
        1,
      );
      let remainingChanges = maxChanges;

      if (!targets.length) {
        await this.saveRunItem(run.id, 'SKIPPED', 'No enabled ad groups found for this policy');
      }

      let paused = false;
      for (const target of targets) {
        const currentSchedule = await scheduleRepository.findOneBy({ id: schedule.id });
        if (!currentSchedule?.enabled) {
          paused = true;
          await this.saveRunItem(
            run.id,
            'PAUSED',
            'Người dùng đã tạm dừng tự động hóa; hệ thống không tạo thêm thay đổi mới.',
          );
          break;
        }
        run.lastHeartbeatAt = new Date();
        await runRepository.save(run);
        if (remainingChanges <= 0) {
          await this.saveRunItem(
            run.id,
            'SKIPPED',
            `Run reached the max change limit (${maxChanges}); remaining ad groups were not processed`,
          );
          break;
        }

        try {
          const result = await this.runAdGroupAutomation(
            run,
            policy,
            target,
            timeRange,
            remainingChanges,
          );
          remainingChanges -= result.selectedCount;
        } catch (error) {
          const isEmptyTarget = this.isEmptyAutomationTargetError(error);
          if (!isEmptyTarget) {
            run.failedCount += 1;
          }
          await this.saveRunItem(
            run.id,
            isEmptyTarget ? 'SKIPPED' : 'FAILED',
            this.formatTargetReason(target, error instanceof Error ? error.message : String(error)),
            undefined,
            target,
          );
        }
      }

      const status = paused ? 'PAUSED' : this.resolveRunStatus(run);
      return await this.completeRun(run, schedule, now, status);
    } catch (error) {
      run.status = 'FAILED';
      run.errorMessage = error instanceof Error ? error.message : String(error);
      run.completedAt = new Date();
      await runRepository.save(run);
      await this.advanceSchedule(schedule, now);
      throw error;
    }
  }

  async ensureSchedule(
    policy: CreativePolicyEntity,
    input: {
      enabled?: boolean;
      intervalDays?: number;
      timezone?: string | null;
      nextRunAt?: Date | null;
    },
  ) {
    const repository = this.dataSource.getRepository(AutomationScheduleEntity);
    let schedule = await repository.findOneBy({ policyId: policy.id });
    const intervalDays = Math.round(
      this.clampNumber(input.intervalDays ?? policy.reviewIntervalDays, 14, 1, 365),
    );
    const enabled = input.enabled ?? schedule?.enabled ?? false;
    const timezone =
      input.timezone?.trim() || schedule?.timezone || 'Asia/Ho_Chi_Minh';

    if (!schedule) {
      schedule = repository.create({
        policyId: policy.id,
        timezone,
        intervalDays,
        enabled,
        lastRunAt: null,
        nextRunAt: enabled ? input.nextRunAt ?? this.addDays(new Date(), intervalDays) : null,
      });
    } else {
      schedule.timezone = timezone;
      schedule.intervalDays = intervalDays;
      schedule.enabled = enabled;
      if (!enabled) {
        schedule.nextRunAt = null;
      } else if (input.nextRunAt !== undefined) {
        schedule.nextRunAt = input.nextRunAt;
      } else if (!schedule.nextRunAt) {
        schedule.nextRunAt = schedule.lastRunAt
          ? this.addDays(schedule.lastRunAt, intervalDays)
          : this.addDays(new Date(), intervalDays);
      }
    }

    return repository.save(schedule);
  }

  private async runAdGroupAutomation(
    run: AutomationRunEntity,
    policy: CreativePolicyEntity,
    target: AutomationTarget,
    timeRange: string,
    maxChanges: number,
  ) {
    await this.googleAdsSyncService.sync(target.customerId, target.adGroupId, timeRange);
    if (!(await this.isTargetStillEnabled(target))) {
      await this.saveRunItem(
        run.id,
        'SKIPPED',
        this.formatTargetReason(
          target,
          'Chiến dịch hoặc nhóm quảng cáo hiện đã tạm dừng',
        ),
      );
      return { selectedCount: 0 };
    }
    const generated = await this.googleAdsService.generateAiTextSuggestions(
      target.customerId,
      target.adGroupId,
      timeRange,
    );
    const saved = await this.aiPersistenceService.saveTextSuggestions(
      target.customerId,
      target.adGroupId,
      timeRange,
      generated,
    );
    if (!run.reviewRunId && saved.reviewRunId) {
      run.reviewRunId = String(saved.reviewRunId);
    }

    const replacements = this.buildReplacementInput(
      Array.isArray(saved.suggestions) ? (saved.suggestions as SavedTextSuggestion[]) : [],
      maxChanges,
    );
    const selectedCount =
      replacements.headlineReplacements.length + replacements.descriptionReplacements.length;

    if (selectedCount === 0) {
      await this.saveRunItem(
        run.id,
        'SKIPPED',
        this.formatTargetReason(target, 'AI returned no usable text replacements'),
      );
      return { selectedCount: 0 };
    }

    for (const replacement of [
      ...replacements.headlineReplacements,
      ...replacements.descriptionReplacements,
    ]) {
      await this.saveRunItem(
        run.id,
        'SELECTED',
        this.formatTargetReason(target, `${replacement.oldText} -> ${replacement.newText}`),
        replacement.suggestionId,
      );
    }

    const preview = await this.googleAdsService.previewLowTextReplacement(
      target.customerId,
      target.adGroupId,
      timeRange,
      replacements,
    );
    const changeRequest = await this.changeRequestService.createTextChangeRequest(
      target.customerId,
      target.adGroupId,
      timeRange,
      replacements,
      preview,
    );
    if (!run.changeRequestId && typeof changeRequest.id === 'string') {
      run.changeRequestId = changeRequest.id;
    }
    run.selectedCount += selectedCount;

    if (policy.approvalMode === 'AUTO' && typeof changeRequest.id === 'string') {
      let requestForApply;
      let applyResult;
      try {
        requestForApply = await this.changeRequestService.getTextChangeRequestForApply(
          changeRequest.id,
        );
        applyResult = await this.googleAdsService.replaceLowTextAssets(
          requestForApply.customerId,
          requestForApply.adGroupId,
          requestForApply.timeRange,
          requestForApply.input,
        );
        await this.googleAdsSyncService.markTextReplacementsApplied(
          requestForApply.customerId,
          requestForApply.adGroupId,
          requestForApply.input,
          applyResult.replacedAds.map((item) => item.oldResourceName),
        );
        await this.changeRequestService.completeTextChangeRequest(
          changeRequest.id,
          requestForApply.input,
          applyResult,
        );
      } catch (error) {
        await this.changeRequestService.failChangeRequest(changeRequest.id, error);
        throw error;
      }
      const appliedCount = Array.isArray(applyResult.replacedAds)
        ? applyResult.replacedAds.reduce(
            (sum: number, item: { headlineReplacements?: number; descriptionReplacements?: number }) =>
              sum + Number(item.headlineReplacements ?? 0) + Number(item.descriptionReplacements ?? 0),
            0,
          )
        : 0;
      run.appliedCount += appliedCount;
      await this.saveRunItem(
        run.id,
        'APPLIED',
        this.formatTargetReason(target, `Applied ${appliedCount} text replacement(s)`),
        undefined,
        target,
        changeRequest.id,
      );
    } else {
      await this.saveRunItem(
        run.id,
        'SUGGESTED',
        this.formatTargetReason(
          target,
          `Created change request ${changeRequest.id ?? 'unknown'} for manual approval`,
        ),
        undefined,
        target,
        typeof changeRequest.id === 'string' ? changeRequest.id : undefined,
      );
    }

    return { selectedCount };
  }

  private buildReplacementInput(suggestions: SavedTextSuggestion[], maxChanges: number) {
    const headlineReplacements: TextReplacement[] = [];
    const descriptionReplacements: TextReplacement[] = [];

    for (const suggestion of suggestions) {
      if (headlineReplacements.length + descriptionReplacements.length >= maxChanges) {
        break;
      }

      const fieldType = String(suggestion.fieldType ?? '').toUpperCase();
      if (fieldType !== 'HEADLINE' && fieldType !== 'DESCRIPTION') {
        continue;
      }

      const oldText = String(suggestion.text ?? '').trim();
      const variant = suggestion.variants?.[0] ?? null;
      const newText = String(variant?.content?.text ?? suggestion.suggestion ?? '').trim();
      if (!oldText || !newText || oldText === newText) {
        continue;
      }

      const replacement = {
        oldText,
        newText,
        ...(suggestion.suggestionId ? { suggestionId: suggestion.suggestionId } : {}),
        ...(variant?.id ? { variantId: variant.id } : {}),
      };

      if (fieldType === 'HEADLINE') {
        headlineReplacements.push(replacement);
      } else {
        descriptionReplacements.push(replacement);
      }
    }

    return { headlineReplacements, descriptionReplacements };
  }

  private async isTargetStillEnabled(target: AutomationTarget) {
    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId: target.customerId });
    if (!account) return false;
    const campaign = await this.dataSource
      .getRepository(CampaignEntity)
      .findOneBy({
        accountId: account.id,
        googleCampaignId: target.campaignId,
      });
    if (!campaign || campaign.status !== 'ENABLED') return false;
    const adGroup = await this.dataSource
      .getRepository(AdGroupEntity)
      .findOneBy({
        campaignId: campaign.id,
        googleAdGroupId: target.adGroupId,
      });
    return adGroup?.status === 'ENABLED';
  }

  private async getAutomationTargets(
    policy: CreativePolicyEntity,
    _timeRange: string,
    targetAccountIds?: string[],
  ) {
    const scopes = await this.dataSource
      .getRepository(CreativePolicyScopeEntity)
      .findBy({ policyId: policy.id });
    const selectedAdGroupIds = scopes
      .map((scope) => scope.adGroupId)
      .filter((id): id is string => Boolean(id));
    const allCampaignInternalIds = scopes
      .filter((scope) => scope.campaignId && scope.includeAllAdGroups)
      .map((scope) => scope.campaignId as string);
    if (!selectedAdGroupIds.length && !allCampaignInternalIds.length) return [];

    const explicitAdGroups = selectedAdGroupIds.length
      ? await this.dataSource
          .getRepository(AdGroupEntity)
          .findBy({ id: In(selectedAdGroupIds) })
      : [];
    const campaignAdGroups = allCampaignInternalIds.length
      ? await this.dataSource
          .getRepository(AdGroupEntity)
          .findBy({ campaignId: In(allCampaignInternalIds) })
      : [];
    const adGroupMap = new Map(
      [...explicitAdGroups, ...campaignAdGroups].map((adGroup) => [adGroup.id, adGroup]),
    );
    const adGroups = [...adGroupMap.values()];
    const campaignIds = [
      ...new Set([
        ...allCampaignInternalIds,
        ...adGroups.map((adGroup) => adGroup.campaignId),
      ]),
    ];
    const campaigns = campaignIds.length
      ? await this.dataSource
          .getRepository(CampaignEntity)
          .findBy({ id: In(campaignIds) })
      : [];
    const allowedAccountIds = targetAccountIds?.length
      ? new Set(targetAccountIds)
      : null;
    const accounts = campaigns.length
      ? await this.dataSource.getRepository(GoogleAdsAccountEntity).findBy({
          id: In([...new Set(campaigns.map((campaign) => campaign.accountId))]),
          status: 'ACTIVE',
        })
      : [];
    const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    const targets = new Map<string, AutomationTarget>();
    const configuredLimit = Number(process.env.AUTOMATION_AD_GROUP_LIMIT);
    const adGroupLimit = Number.isFinite(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : Number.POSITIVE_INFINITY;

    for (const adGroup of adGroups) {
      if (targets.size >= adGroupLimit) break;
      const campaign = campaignMap.get(adGroup.campaignId);
      if (!campaign || campaign.status !== 'ENABLED') continue;
      const account = accountMap.get(campaign.accountId);
      if (!account || (allowedAccountIds && !allowedAccountIds.has(account.id))) continue;
      if (adGroup.status !== 'ENABLED') continue;
      targets.set(`${account.customerId}:${adGroup.googleAdGroupId}`, {
        customerId: account.customerId,
        campaignId: campaign.googleCampaignId,
        campaignName: campaign.name || `Campaign ${campaign.googleCampaignId}`,
        adGroupId: adGroup.googleAdGroupId,
        adGroupName: adGroup.name || `Ad group ${adGroup.googleAdGroupId}`,
      });
    }

    return Array.from(targets.values());
  }

  private async completeRun(
    run: AutomationRunEntity,
    schedule: AutomationScheduleEntity,
    now: Date,
    status: string,
  ) {
    run.status = status;
    run.lastHeartbeatAt = new Date();
    run.completedAt = new Date();
    await this.dataSource.getRepository(AutomationRunEntity).save(run);
    await this.advanceSchedule(schedule, now);
    return run;
  }

  private resolveRunStatus(run: AutomationRunEntity) {
    if (run.selectedCount === 0 && run.failedCount === 0) {
      return 'SKIPPED';
    }
    if (run.failedCount > 0 && run.selectedCount === 0) {
      return 'FAILED';
    }
    if (run.failedCount > 0) {
      return 'PARTIAL';
    }
    return 'COMPLETED';
  }

  private async advanceSchedule(schedule: AutomationScheduleEntity, now: Date) {
    schedule.lastRunAt = now;
    schedule.nextRunAt = schedule.enabled
      ? this.addDays(now, Math.max(schedule.intervalDays, 1))
      : null;
    await this.dataSource.getRepository(AutomationScheduleEntity).save(schedule);
  }

  private async saveRunItem(
    automationRunId: string,
    action: string,
    reason: string,
    suggestionId?: string,
    target?: AutomationTarget,
    changeRequestId?: string,
  ) {
    await this.dataSource.getRepository(AutomationRunItemEntity).save({
      automationRunId,
      adAssetLinkId: null,
      suggestionId: suggestionId ?? null,
      changeRequestId: changeRequestId ?? null,
      targetSnapshot: target ?? null,
      action,
      reason,
    });
  }

  private isEmptyAutomationTargetError(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }
    return /No LOW headline\/description assets found/i.test(error.message);
  }

  private isStaleRunningRun(run: AutomationRunEntity, now: Date) {
    const staleMinutes = this.clampNumber(
      process.env.AUTOMATION_STALE_RUNNING_MINUTES,
      30,
      5,
      24 * 60,
    );
    const lastActivity = run.lastHeartbeatAt ?? run.startedAt;
    return now.getTime() - lastActivity.getTime() > staleMinutes * 60_000;
  }

  private buildTrailingDateRange(days: number, timezone: string, now: Date) {
    const end = this.timezoneDateAsUtcMidnight(now, timezone);
    const start = this.addDays(end, -(days - 1));
    return `${this.toInputDate(start)},${this.toInputDate(end)}`;
  }

  private timezoneDateAsUtcMidnight(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const getPart = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? '0');

    return new Date(Date.UTC(getPart('year'), getPart('month') - 1, getPart('day')));
  }

  private toInputDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private formatTargetReason(target: AutomationTarget, reason: string) {
    return `Campaign ${target.campaignName} (${target.campaignId || '-'}), ad group ${target.adGroupName} (${target.adGroupId}): ${reason}`;
  }

  private clampNumber(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(Math.max(number, min), max) : fallback;
  }
}
