import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { AdAssetLinkEntity } from '../database/entities/ad-asset-link.entity';
import { AdGroupEntity } from '../database/entities/ad-group.entity';
import { AdEntity } from '../database/entities/ad.entity';
import { AiReviewRunEntity } from '../database/entities/ai-review-run.entity';
import { AiSuggestionDecisionEntity } from '../database/entities/ai-suggestion-decision.entity';
import { AiSuggestionVariantEntity } from '../database/entities/ai-suggestion-variant.entity';
import { AiSuggestionEntity } from '../database/entities/ai-suggestion.entity';
import { AssetEntity } from '../database/entities/asset.entity';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { ChangeItemEntity } from '../database/entities/change-item.entity';
import { ChangeRequestEntity } from '../database/entities/change-request.entity';
import { CreativePolicyEntity } from '../database/entities/creative-policy.entity';
import { GoogleAdsAccountEntity } from '../database/entities/google-ads-account.entity';

type DecisionInput = {
  action?: string;
  variantId?: string;
  editedContent?: unknown;
  note?: string;
};

type TextChangeRequestPayload = {
  headline?: string;
  description?: string;
  headlineReplacements?: any[];
  descriptionReplacements?: any[];
};

@Injectable()
export class AiPersistenceService {
  constructor(private readonly dataSource: DataSource) {}

  async saveCreativeReview(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    response: any,
  ) {
    const context = await this.getContext(customerId, adGroupId);
    const reviewRun = await this.createReviewRun(context, timeRange, response, 'CREATIVE_REVIEW');
    const recommendations = Array.isArray(response.recommendations)
      ? response.recommendations
      : [];
    const saved = [];

    for (const recommendation of recommendations) {
      const assetId = String(recommendation.assetId ?? recommendation.asset?.id ?? '');
      const link = await this.findAssetLink(context.account.id, context.adGroup.id, {
        assetId,
        fieldType: String(recommendation.asset?.fieldType ?? ''),
      });
      const suggestion = await this.dataSource.getRepository(AiSuggestionEntity).save({
        reviewRunId: reviewRun.id,
        adAssetLinkId: link?.id ?? null,
        suggestionType: this.normalizeSuggestionType(recommendation.mediaType),
        fieldType: recommendation.asset?.fieldType || null,
        languageCode: this.detectLanguage(String(recommendation.asset?.text ?? '')),
        currentContent: {
          assetId,
          text: recommendation.asset?.text ?? null,
          previewUrl: recommendation.asset?.previewUrl ?? null,
        },
        rationale: String(
          recommendation.diagnosis ?? recommendation.suggestion ?? 'AI recommendation',
        ),
        evidence: Array.isArray(recommendation.evidence)
          ? recommendation.evidence
          : [],
        priority: this.normalizePriority(recommendation.priority),
        confidence: this.normalizeConfidence(recommendation.confidence),
        status: 'PENDING',
        expiresAt: null,
      });
      const ideas = Array.isArray(recommendation.replacementIdeas)
        ? recommendation.replacementIdeas
        : [];
      const variants = await this.saveVariants(suggestion.id, ideas);
      saved.push({
        ...recommendation,
        suggestionId: suggestion.id,
        variants,
      });
    }

    return { ...response, reviewRunId: reviewRun.id, recommendations: saved };
  }

  async saveTextSuggestions(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    response: any,
  ) {
    const context = await this.getContext(customerId, adGroupId);
    const reviewRun = await this.createReviewRun(context, timeRange, response, 'TEXT_SUGGESTIONS');
    const suggestions = Array.isArray(response.suggestions) ? response.suggestions : [];
    const saved = [];

    for (const item of suggestions) {
      const link = await this.findAssetLink(context.account.id, context.adGroup.id, {
        text: String(item.text ?? ''),
        fieldType: String(item.fieldType ?? ''),
      });
      const suggestion = await this.dataSource.getRepository(AiSuggestionEntity).save({
        reviewRunId: reviewRun.id,
        adAssetLinkId: link?.id ?? null,
        suggestionType: 'TEXT',
        fieldType: item.fieldType || null,
        languageCode: this.detectLanguage(String(item.text ?? '')),
        currentContent: {
          key: item.key ?? null,
          text: item.text ?? null,
          impressions: item.impressions ?? 0,
          clicks: item.clicks ?? 0,
          cost: item.cost ?? 0,
          roas: item.roas ?? 0,
        },
        rationale: String(item.rationale ?? 'AI text suggestion'),
        evidence: [],
        priority: this.normalizePriority(item.priority),
        confidence: this.normalizeConfidence(item.confidence),
        status: 'PENDING',
        expiresAt: null,
      });
      const variants = await this.saveVariants(suggestion.id, [item.suggestion]);
      saved.push({ ...item, suggestionId: suggestion.id, variants });
    }

    return { ...response, reviewRunId: reviewRun.id, suggestions: saved };
  }

  async decideSuggestion(suggestionId: string, input: DecisionInput) {
    const action = String(input.action ?? '').toUpperCase();
    if (!['APPROVE', 'REJECT', 'EDIT', 'UNAPPROVE'].includes(action)) {
      throw new BadRequestException('action must be APPROVE, REJECT, EDIT, or UNAPPROVE');
    }

    const suggestionRepository = this.dataSource.getRepository(AiSuggestionEntity);
    const suggestion = await suggestionRepository.findOneBy({ id: suggestionId });
    if (!suggestion) throw new NotFoundException('AI suggestion not found');

    let variant: AiSuggestionVariantEntity | null = null;
    if (input.variantId) {
      variant = await this.dataSource.getRepository(AiSuggestionVariantEntity).findOneBy({
        id: input.variantId,
        suggestionId,
      });
      if (!variant) throw new BadRequestException('Variant does not belong to this suggestion');
    }

    const decision = await this.dataSource.getRepository(AiSuggestionDecisionEntity).save({
      suggestionId,
      variantId: variant?.id ?? null,
      decidedBy: null,
      action,
      editedContent:
        input.editedContent && typeof input.editedContent === 'object'
          ? (input.editedContent as Record<string, unknown>)
          : null,
      note: input.note?.trim() || null,
    });
    suggestion.status =
      action === 'REJECT' ? 'REJECTED' : action === 'UNAPPROVE' ? 'PENDING' : 'APPROVED';
    await suggestionRepository.save(suggestion);

    if (variant && action === 'APPROVE') {
      await this.dataSource
        .getRepository(AiSuggestionVariantEntity)
        .update({ suggestionId }, { selected: false });
      variant.selected = true;
      await this.dataSource.getRepository(AiSuggestionVariantEntity).save(variant);
    }

    return { suggestionId, status: suggestion.status, decision };
  }

  async saveTextChange(
    customerId: string,
    adGroupId: string,
    input: Record<string, unknown>,
    response: any,
  ) {
    return this.saveChange(customerId, adGroupId, 'TEXT_REPLACE', input, response);
  }

  async saveMediaChange(
    customerId: string,
    adGroupId: string,
    input: Record<string, unknown>,
    response: any,
  ) {
    return this.saveChange(customerId, adGroupId, 'MEDIA_REPLACE', input, response);
  }

  async createTextChangeRequest(
    customerId: string,
    googleAdGroupId: string,
    timeRange: string,
    input: TextChangeRequestPayload,
    preview: any,
  ) {
    const context = await this.getContext(customerId, googleAdGroupId);
    const plannedAds = Array.isArray(preview.plannedAds) ? preview.plannedAds : [];
    if (!plannedAds.length) {
      throw new BadRequestException('No text changes were prepared for preview');
    }

    const request = await this.dataSource.getRepository(ChangeRequestEntity).save({
      workspaceId: context.account.workspaceId,
      accountId: context.account.id,
      adGroupId: context.adGroup.id,
      requestedBy: null,
      source: this.hasSuggestionLinks(input) ? 'AI_APPROVED' : 'MANUAL',
      idempotencyKey: randomUUID(),
      status: 'PENDING',
      errorMessage: null,
      requestedAt: new Date(),
      startedAt: null,
      completedAt: null,
    });
    const itemRepository = this.dataSource.getRepository(ChangeItemEntity);

    for (const item of plannedAds) {
      const linkedSuggestion = this.getPreviewSuggestionLink(item.changes);
      await itemRepository.save({
        changeRequestId: request.id,
        suggestionId: linkedSuggestion?.suggestionId ?? null,
        variantId: linkedSuggestion?.variantId ?? null,
        adAssetLinkId: null,
        changeType: 'TEXT_REPLACE',
        mediaType: null,
        beforePayload: {
          input,
          timeRange,
          changes: item.changes ?? [],
          adText: item.beforePayload ?? {},
        },
        afterPayload: {
          adText: item.afterPayload ?? {},
        },
        oldAssetResourceName: null,
        newAssetResourceName: null,
        oldAdResourceName: item.oldResourceName ?? null,
        newAdResourceName: null,
        replacementCount:
          Number(item.headlineReplacements ?? 0) +
          Number(item.descriptionReplacements ?? 0),
        status: 'PENDING',
        errorCode: null,
        errorMessage: null,
      });
    }

    await this.writeAuditLog({
      workspaceId: context.account.workspaceId,
      action: 'CHANGE_REQUEST_CREATED',
      entityType: 'change_request',
      entityId: request.id,
      beforePayload: null,
      afterPayload: {
        customerId,
        adGroupId: googleAdGroupId,
        timeRange,
        plannedAds: plannedAds.length,
      },
      correlationId: request.id,
      metadata: { source: request.source, changeType: 'TEXT_REPLACE' },
    });

    return this.getChangeRequestPreview(request.id);
  }

  async getChangeRequestPreview(changeRequestId: string) {
    const request = await this.dataSource
      .getRepository(ChangeRequestEntity)
      .findOneBy({ id: changeRequestId });
    if (!request) throw new NotFoundException('Change request not found');

    const [items, account, adGroup] = await Promise.all([
      this.dataSource.getRepository(ChangeItemEntity).find({
        where: { changeRequestId },
        order: { createdAt: 'ASC' },
      }),
      this.dataSource.getRepository(GoogleAdsAccountEntity).findOneBy({
        id: request.accountId,
      }),
      request.adGroupId
        ? this.dataSource.getRepository(AdGroupEntity).findOneBy({ id: request.adGroupId })
        : Promise.resolve(null),
    ]);

    return {
      id: request.id,
      status: request.status,
      source: request.source,
      customerId: account?.customerId ?? null,
      adGroupId: adGroup?.googleAdGroupId ?? null,
      requestedAt: request.requestedAt,
      startedAt: request.startedAt,
      completedAt: request.completedAt,
      errorMessage: request.errorMessage,
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        changeType: item.changeType,
        oldAdResourceName: item.oldAdResourceName,
        newAdResourceName: item.newAdResourceName,
        replacementCount: item.replacementCount,
        beforePayload: item.beforePayload,
        afterPayload: item.afterPayload,
        errorMessage: item.errorMessage,
      })),
    };
  }

  async getTextChangeRequestForApply(changeRequestId: string) {
    const request = await this.dataSource
      .getRepository(ChangeRequestEntity)
      .findOneBy({ id: changeRequestId });
    if (!request) throw new NotFoundException('Change request not found');
    if (!['PENDING', 'APPROVED'].includes(request.status)) {
      throw new BadRequestException(`Change request is already ${request.status.toLowerCase()}`);
    }

    const [account, adGroup, items] = await Promise.all([
      this.dataSource.getRepository(GoogleAdsAccountEntity).findOneBy({
        id: request.accountId,
      }),
      request.adGroupId
        ? this.dataSource.getRepository(AdGroupEntity).findOneBy({ id: request.adGroupId })
        : Promise.resolve(null),
      this.dataSource.getRepository(ChangeItemEntity).find({
        where: { changeRequestId },
        order: { createdAt: 'ASC' },
      }),
    ]);

    if (!account || !adGroup) {
      throw new NotFoundException('Change request account or ad group is unavailable');
    }
    const firstItem = items[0];
    const beforePayload = firstItem?.beforePayload ?? {};
    const input = this.objectPayload(beforePayload.input) as TextChangeRequestPayload;
    const timeRange = String(beforePayload.timeRange ?? '');
    if (!timeRange) {
      throw new BadRequestException('Change request is missing the original time range');
    }

    request.status = 'APPLYING';
    request.startedAt = new Date();
    request.errorMessage = null;
    await this.dataSource.getRepository(ChangeRequestEntity).save(request);

    return {
      customerId: account.customerId,
      adGroupId: adGroup.googleAdGroupId,
      timeRange,
      input,
    };
  }

  async completeTextChangeRequest(
    changeRequestId: string,
    input: TextChangeRequestPayload,
    response: any,
  ) {
    const requestRepository = this.dataSource.getRepository(ChangeRequestEntity);
    const itemRepository = this.dataSource.getRepository(ChangeItemEntity);
    const request = await requestRepository.findOneBy({ id: changeRequestId });
    if (!request) throw new NotFoundException('Change request not found');

    const replaced = Array.isArray(response.replacedAds) ? response.replacedAds : [];
    const skipped = Array.isArray(response.skippedAds) ? response.skippedAds : [];
    const replacedByOldResource = new Map<string, any>(
      replaced.map((item: any) => [String(item.oldResourceName ?? ''), item]),
    );
    const skippedByOldResource = new Map<string, any>(
      skipped.map((item: any) => [String(item.resourceName ?? ''), item]),
    );
    const items = await itemRepository.find({
      where: { changeRequestId },
      order: { createdAt: 'ASC' },
    });

    for (const item of items) {
      const oldResourceName = item.oldAdResourceName ?? '';
      const replacedItem = replacedByOldResource.get(oldResourceName);
      const skippedItem = skippedByOldResource.get(oldResourceName);

      if (replacedItem) {
        item.status = 'APPLIED';
        item.newAdResourceName = String(replacedItem.newResourceName ?? '');
        item.replacementCount =
          Number(replacedItem.headlineReplacements ?? 0) +
          Number(replacedItem.descriptionReplacements ?? 0);
        item.afterPayload = {
          ...item.afterPayload,
          googleAdsResult: replacedItem,
        };
        item.errorMessage = null;
      } else if (skippedItem) {
        item.status = 'SKIPPED';
        item.errorMessage = String(skippedItem.reason ?? 'Skipped by Google Ads update');
      } else {
        item.status = replaced.length > 0 ? 'SKIPPED' : 'FAILED';
        item.errorMessage = replaced.length > 0
          ? 'No matching result returned by Google Ads'
          : 'Google Ads did not apply this change';
      }

      await itemRepository.save(item);
    }

    request.status = replaced.length === 0 ? 'FAILED' : skipped.length ? 'PARTIAL' : 'APPLIED';
    request.completedAt = new Date();
    request.errorMessage = request.status === 'FAILED'
      ? 'No ads were updated by Google Ads'
      : null;
    await requestRepository.save(request);
    await this.markInputSuggestionsApplied(input as Record<string, unknown>);
    await this.writeAuditLog({
      workspaceId: request.workspaceId,
      action: 'CHANGE_REQUEST_APPLIED',
      entityType: 'change_request',
      entityId: request.id,
      beforePayload: null,
      afterPayload: response,
      correlationId: request.id,
      metadata: {
        status: request.status,
        replacedAds: replaced.length,
        skippedAds: skipped.length,
      },
    });

    return this.getChangeRequestPreview(changeRequestId);
  }

  async failChangeRequest(changeRequestId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const requestRepository = this.dataSource.getRepository(ChangeRequestEntity);
    const itemRepository = this.dataSource.getRepository(ChangeItemEntity);
    const request = await requestRepository.findOneBy({ id: changeRequestId });
    if (!request) return;

    request.status = 'FAILED';
    request.errorMessage = message;
    request.completedAt = new Date();
    await requestRepository.save(request);
    await itemRepository.update(
      { changeRequestId, status: In(['PENDING', 'APPLYING']) },
      { status: 'FAILED', errorMessage: message },
    );
    await this.writeAuditLog({
      workspaceId: request.workspaceId,
      action: 'CHANGE_REQUEST_FAILED',
      entityType: 'change_request',
      entityId: request.id,
      beforePayload: null,
      afterPayload: null,
      correlationId: request.id,
      metadata: { errorMessage: message },
    });
  }

  private hasSuggestionLinks(input: TextChangeRequestPayload) {
    return [
      ...this.getInputReplacementLinks(input.headlineReplacements),
      ...this.getInputReplacementLinks(input.descriptionReplacements),
    ].length > 0;
  }

  private getPreviewSuggestionLink(changes: unknown) {
    if (!Array.isArray(changes)) return null;
    const links = changes
      .map((change) => {
        const row = this.objectPayload(change);
        const suggestionId = String(row.suggestionId ?? '').trim();
        const variantId = String(row.variantId ?? '').trim();
        return suggestionId ? { suggestionId, variantId: variantId || null } : null;
      })
      .filter((link): link is { suggestionId: string; variantId: string | null } => Boolean(link));
    const uniqueSuggestionIds = new Set(links.map((link) => link.suggestionId));
    return uniqueSuggestionIds.size === 1 ? links[0] : null;
  }

  private objectPayload(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private async writeAuditLog(input: {
    workspaceId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    beforePayload: Record<string, unknown> | null;
    afterPayload: Record<string, unknown> | null;
    correlationId: string | null;
    metadata: Record<string, unknown>;
  }) {
    await this.dataSource.getRepository(AuditLogEntity).save({
      workspaceId: input.workspaceId,
      actorUserId: null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforePayload: input.beforePayload,
      afterPayload: input.afterPayload,
      correlationId: input.correlationId,
      metadata: input.metadata,
    });
  }

  private async saveChange(
    customerId: string,
    googleAdGroupId: string,
    changeType: string,
    input: Record<string, unknown>,
    response: any,
  ) {
    const context = await this.getContext(customerId, googleAdGroupId);
    const replaced = Array.isArray(response.replacedAds) ? response.replacedAds : [];
    const skipped = Array.isArray(response.skippedAds) ? response.skippedAds : [];
    const status = replaced.length === 0 ? 'FAILED' : skipped.length ? 'PARTIAL' : 'APPLIED';
    const request = await this.dataSource.getRepository(ChangeRequestEntity).save({
      workspaceId: context.account.workspaceId,
      accountId: context.account.id,
      adGroupId: context.adGroup.id,
      requestedBy: null,
      source: 'MANUAL',
      idempotencyKey: randomUUID(),
      status,
      errorMessage: null,
      requestedAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
    });
    const itemRepository = this.dataSource.getRepository(ChangeItemEntity);

    for (const item of replaced) {
      const linkedSuggestion = this.findLinkedTextSuggestion(input, item);
      await itemRepository.save({
        changeRequestId: request.id,
        suggestionId: linkedSuggestion?.suggestionId ?? null,
        variantId: linkedSuggestion?.variantId ?? null,
        adAssetLinkId: null,
        changeType,
        mediaType: response.mediaType ?? null,
        beforePayload: input,
        afterPayload: response,
        oldAssetResourceName: response.oldAssetResourceName ?? null,
        newAssetResourceName: response.newAssetResourceName ?? null,
        oldAdResourceName: item.oldResourceName ?? null,
        newAdResourceName: item.newResourceName ?? null,
        replacementCount:
          Number(item.replacements ?? 0) +
          Number(item.headlineReplacements ?? 0) +
          Number(item.descriptionReplacements ?? 0),
        status: 'APPLIED',
        errorCode: null,
        errorMessage: null,
      });
      if (linkedSuggestion?.suggestionId) {
        await this.markSuggestionApplied(linkedSuggestion.suggestionId, linkedSuggestion.variantId);
      }
    }
    for (const item of skipped) {
      await itemRepository.save({
        changeRequestId: request.id,
        suggestionId: null,
        variantId: null,
        adAssetLinkId: null,
        changeType,
        mediaType: response.mediaType ?? null,
        beforePayload: input,
        afterPayload: {},
        oldAssetResourceName: response.oldAssetResourceName ?? null,
        newAssetResourceName: response.newAssetResourceName ?? null,
        oldAdResourceName: item.resourceName ?? null,
        newAdResourceName: null,
        replacementCount: 0,
        status: 'SKIPPED',
        errorCode: null,
        errorMessage: item.reason ?? 'Skipped by Google Ads update',
      });
    }
    await this.markInputSuggestionsApplied(input);

    return request;
  }

  private findLinkedTextSuggestion(input: Record<string, unknown>, item: any) {
    if (!['TEXT_REPLACE'].includes(String(item?.changeType ?? 'TEXT_REPLACE'))) {
      return null;
    }

    const replacements = [
      ...this.getInputReplacementLinks(input.headlineReplacements),
      ...this.getInputReplacementLinks(input.descriptionReplacements),
    ];

    return replacements.length === 1 ? replacements[0] : null;
  }

  private getInputReplacementLinks(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        const replacement = item as { suggestionId?: unknown; variantId?: unknown };
        const suggestionId = String(replacement?.suggestionId ?? '').trim();
        const variantId = String(replacement?.variantId ?? '').trim();

        return suggestionId
          ? {
              suggestionId,
              variantId: variantId || null,
            }
          : null;
      })
      .filter((item): item is { suggestionId: string; variantId: string | null } => Boolean(item));
  }

  private async markInputSuggestionsApplied(input: Record<string, unknown>) {
    const links = [
      ...this.getInputReplacementLinks(input.headlineReplacements),
      ...this.getInputReplacementLinks(input.descriptionReplacements),
    ];
    const uniqueLinks = new Map(links.map((item) => [item.suggestionId, item]));

    for (const link of uniqueLinks.values()) {
      await this.markSuggestionApplied(link.suggestionId, link.variantId);
    }
  }

  private async markSuggestionApplied(suggestionId: string, variantId: string | null) {
    const suggestionRepository = this.dataSource.getRepository(AiSuggestionEntity);
    const suggestion = await suggestionRepository.findOneBy({ id: suggestionId });
    if (!suggestion) return;

    suggestion.status = 'APPLIED';
    await suggestionRepository.save(suggestion);

    if (variantId) {
      await this.dataSource
        .getRepository(AiSuggestionVariantEntity)
        .update({ suggestionId }, { selected: false });
      await this.dataSource
        .getRepository(AiSuggestionVariantEntity)
        .update({ id: variantId, suggestionId }, { selected: true });
    }
  }

  private async createReviewRun(
    context: Awaited<ReturnType<AiPersistenceService['getContext']>>,
    timeRange: string,
    response: any,
    feature: string,
  ) {
    const policy = await this.dataSource.getRepository(CreativePolicyEntity).findOne({
      where: { workspaceId: context.account.workspaceId, enabled: true },
      order: { version: 'DESC' },
    });
    const now = new Date();
    return this.dataSource.getRepository(AiReviewRunEntity).save({
      workspaceId: context.account.workspaceId,
      accountId: context.account.id,
      adGroupId: context.adGroup.id,
      policyId: policy?.id ?? null,
      promptTemplateId: null,
      triggeredBy: null,
      triggerType: 'MANUAL',
      provider: String(response.source ?? 'unknown'),
      model: String(response.model ?? 'unknown'),
      requestedTimeRange: timeRange,
      rangeStart: null,
      rangeEnd: null,
      status: 'COMPLETED',
      inputContext: { feature, customerId: context.account.customerId, adGroupId: context.adGroup.googleAdGroupId },
      rawResponse: response,
      inputTokens: null,
      outputTokens: null,
      estimatedCost: null,
      errorMessage: null,
      startedAt: now,
      completedAt: now,
    });
  }

  private async getContext(customerId: string, googleAdGroupId: string) {
    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId });
    if (!account) throw new NotFoundException('Google Ads account is not configured');
    const adGroup = await this.dataSource
      .getRepository(AdGroupEntity)
      .findOneBy({ googleAdGroupId });
    if (!adGroup) throw new NotFoundException('Ad group has not been selectively synced');
    return { account, adGroup };
  }

  private async findAssetLink(
    accountId: string,
    adGroupId: string,
    lookup: { assetId?: string; text?: string; fieldType?: string },
  ) {
    const assets = lookup.assetId
      ? await this.dataSource.getRepository(AssetEntity).findBy({
          accountId,
          googleAssetId: lookup.assetId,
        })
      : await this.dataSource.getRepository(AssetEntity).findBy({
          accountId,
          textContent: lookup.text || '',
        });
    if (!assets.length) return null;
    const ads = await this.dataSource.getRepository(AdEntity).findBy({ adGroupId });
    if (!ads.length) return null;
    return this.dataSource.getRepository(AdAssetLinkEntity).findOneBy({
      adId: In(ads.map((item) => item.id)),
      assetId: In(assets.map((item) => item.id)),
      fieldType: lookup.fieldType || 'UNKNOWN',
    });
  }

  private async saveVariants(suggestionId: string, ideas: unknown[]) {
    const repository = this.dataSource.getRepository(AiSuggestionVariantEntity);
    const variants = [];
    for (const [index, idea] of ideas.entries()) {
      const text = String(idea ?? '').trim();
      if (!text) continue;
      variants.push(
        await repository.save({
          suggestionId,
          rank: index + 1,
          content: { text },
          characterCount: text.length,
          selected: false,
        }),
      );
    }
    return variants;
  }

  private normalizeSuggestionType(value: unknown) {
    const type = String(value ?? '').toUpperCase();
    if (type === 'IMAGE') return 'IMAGE_CONCEPT';
    if (type === 'VIDEO') return 'VIDEO_CONCEPT';
    return 'TEXT';
  }

  private normalizePriority(value: unknown) {
    const priority = String(value ?? '').toUpperCase().replace(/\s+/g, '_');
    return ['FIX_FIRST', 'IMPROVE', 'TEST', 'SCALE'].includes(priority)
      ? priority
      : 'TEST';
  }

  private normalizeConfidence(value: unknown) {
    const confidence = String(value ?? '').toUpperCase();
    if (confidence.includes('HIGH')) return '0.9000';
    if (confidence.includes('LOW')) return '0.4000';
    return '0.6500';
  }

  private detectLanguage(text: string) {
    if (!text) return null;
    if (/[\uac00-\ud7af]/u.test(text)) return 'ko';
    if (/[\u3040-\u30ff]/u.test(text)) return 'ja';
    if (/[\u3400-\u9fff]/u.test(text)) return 'zh';
    if (/[\u0600-\u06ff]/u.test(text)) return 'ar';
    if (/[\u0590-\u05ff]/u.test(text)) return 'he';
    if (/[\u0370-\u03ff]/u.test(text)) return 'el';
    if (/[\u0400-\u04ff]/u.test(text)) return 'ru';
    if (/[\u0530-\u058f]/u.test(text)) return 'hy';
    if (/[\u0780-\u07bf]/u.test(text)) return 'dv';
    if (/[\u0900-\u097f]/u.test(text)) return 'hi';
    if (/[\u0980-\u09ff]/u.test(text)) return 'bn';
    if (/[\u0a00-\u0a7f]/u.test(text)) return 'pa';
    if (/[\u0a80-\u0aff]/u.test(text)) return 'gu';
    if (/[\u0b00-\u0b7f]/u.test(text)) return 'or';
    if (/[\u0b80-\u0bff]/u.test(text)) return 'ta';
    if (/[\u0c00-\u0c7f]/u.test(text)) return 'te';
    if (/[\u0c80-\u0cff]/u.test(text)) return 'kn';
    if (/[\u0d00-\u0d7f]/u.test(text)) return 'ml';
    if (/[\u0d80-\u0dff]/u.test(text)) return 'si';
    if (/[\u0e00-\u0e7f]/u.test(text)) return 'th';
    if (/[\u0e80-\u0eff]/u.test(text)) return 'lo';
    if (/[\u0f00-\u0fff]/u.test(text)) return 'bo';
    if (/[\u1000-\u109f]/u.test(text)) return 'my';
    if (/[\u10a0-\u10ff]/u.test(text)) return 'ka';
    if (/[\u1200-\u137f]/u.test(text)) return 'am';
    if (/[\u1780-\u17ff]/u.test(text)) return 'km';
    if (/[\u1800-\u18af]/u.test(text)) return 'mn';
    if (/[ăâđêôơưĂÂĐÊÔƠƯ]/u.test(text)) return 'vi';
    if (/[ğĞıİşŞ]/u.test(text)) return 'tr';
    if (/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/u.test(text)) return 'pl';
    if (/[ăâîșşțţĂÂÎȘŞȚŢ]/u.test(text)) return 'ro';
    if (/[őűŐŰ]/u.test(text)) return 'hu';
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const words = ` ${normalized.replace(/[^a-z0-9\u00df]+/g, ' ')} `;
    const hasAny = (tokens: string[]) => tokens.some((token) => words.includes(` ${token} `));

    if (
      hasAny([
        'kostenlos',
        'kostenlose',
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
      ]) ||
      /[\u00e4\u00f6\u00fc\u00df]/i.test(text)
    ) {
      return 'de';
    }

    if (
      hasAny([
        'gratuito',
        'gratuita',
        'controle',
        'protecao',
        'escaneamento',
        'tempo',
        'sem',
        'custo',
        'seu',
        'sua',
      ]) ||
      /[\u00e3\u00f5\u00e7]/i.test(text) ||
      /\bgrátis\b/i.test(text)
    ) {
      return 'pt';
    }

    if (
      hasAny([
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
      ]) ||
      /[\u00e9\u00e8\u00ea\u00eb\u00e0\u00e2\u00ee\u00ef\u00f4\u00fb\u00f9\u00e7]/i.test(text)
    ) {
      return 'fr';
    }

    if (
      hasAny([
        'para',
        'aire',
        'movil',
        'mando',
        'controla',
        'facil',
        'usar',
        'rapido',
        'acondicionado',
        'toque',
      ]) ||
      /[\u00bf\u00a1]/u.test(text)
    ) {
      return 'es';
    }

    return 'en';
  }
}
