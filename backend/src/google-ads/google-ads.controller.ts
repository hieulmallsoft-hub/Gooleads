import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsSyncService } from './google-ads-sync.service';
import { AiPersistenceService } from './ai-persistence.service';
import { GoogleAdsAccountRegistryService } from '../database/google-ads-account-registry.service';

const ALLOWED_TIMES = new Set(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'THIS_MONTH']);

type ReplaceLowAssetsBody = {
  customerId?: string;
  adGroupId?: string;
  time?: string;
  headline?: string;
  description?: string;
  headlineReplacements?: unknown;
  descriptionReplacements?: unknown;
};

type AiReviewBody = {
  customerId?: string;
  adGroupId?: string;
  time?: string;
};

type ReplaceMediaBody = {
  customerId?: string;
  adGroupId?: string;
  time?: string;
  mediaType?: string;
  oldAssetResourceName?: string;
  youtubeVideo?: string;
};

type AiDecisionBody = {
  action?: string;
  variantId?: string;
  editedContent?: unknown;
  note?: string;
};

type NormalizedTextReplacement = {
  oldText: string;
  newText: string;
  suggestionId?: string;
  variantId?: string;
};

function normalizeTextReplacements(value: unknown): NormalizedTextReplacement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): NormalizedTextReplacement | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const replacement = item as {
        oldText?: unknown;
        newText?: unknown;
        suggestionId?: unknown;
        variantId?: unknown;
      };
      const oldText = String(replacement.oldText ?? '').trim();
      const newText = String(replacement.newText ?? '').trim();
      const suggestionId = String(replacement.suggestionId ?? '').trim();
      const variantId = String(replacement.variantId ?? '').trim();

      if (!oldText || !newText) {
        return null;
      }

      return {
        oldText,
        newText,
        ...(suggestionId ? { suggestionId } : {}),
        ...(variantId ? { variantId } : {}),
      };
    })
    .filter((item): item is NormalizedTextReplacement => Boolean(item));
}

function normalizeCustomerId(customerId: string | undefined) {
  if (!customerId) {
    throw new BadRequestException('Missing customerId');
  }

  const normalizedCustomerId = customerId.replace(/\D/g, '');
  if (!/^\d{10}$/.test(normalizedCustomerId)) {
    throw new BadRequestException('customerId must be a 10 digit Google Ads customer ID');
  }

  return normalizedCustomerId;
}

function normalizeAdGroupId(adGroupId: string | undefined) {
  if (!adGroupId) {
    throw new BadRequestException('Missing adGroupId');
  }

  const normalizedAdGroupId = adGroupId.replace(/\D/g, '');
  if (!/^\d+$/.test(normalizedAdGroupId)) {
    throw new BadRequestException('adGroupId must be numeric');
  }

  return normalizedAdGroupId;
}

function normalizeTimeRange(time = 'TODAY') {
  if (ALLOWED_TIMES.has(time)) {
    return time;
  }

  const customRange = time.match(/^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})$/);
  if (!customRange) {
    throw new BadRequestException('Invalid date range');
  }

  const [, startDate, endDate] = customRange;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString().slice(0, 10) !== startDate ||
    end.toISOString().slice(0, 10) !== endDate
  ) {
    throw new BadRequestException('Date range must use valid YYYY-MM-DD dates');
  }

  if (start > end) {
    throw new BadRequestException('Start date must be before or equal to end date');
  }

  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  if (end > today) {
    throw new BadRequestException('End date cannot be in the future');
  }

  return `${startDate},${endDate}`;
}

function normalizeMediaType(mediaType: string | undefined) {
  const normalized = mediaType?.trim().toUpperCase();

  if (normalized !== 'IMAGE' && normalized !== 'VIDEO') {
    throw new BadRequestException('mediaType must be IMAGE or VIDEO');
  }

  return normalized;
}

@Controller('google-ads')
export class GoogleAdsController {
  constructor(
    private readonly googleAdsService: GoogleAdsService,
    private readonly googleAdsSyncService: GoogleAdsSyncService,
    private readonly aiPersistenceService: AiPersistenceService,
    private readonly accountRegistry: GoogleAdsAccountRegistryService,
  ) {}

  @Get('accounts')
  async getAccounts() {
    const accounts = await this.accountRegistry.listActive();
    return {
      accounts: accounts.map((account) => ({
        customerId: account.customerId,
        displayName: account.displayName,
        status: account.status,
      })),
    };
  }

  @Get('campaigns')
  async getCampaigns(
    @Query('customerId') customerId: string | undefined,
    @Query('time') time = 'TODAY',
  ) {
    const normalizedCustomerId = normalizeCustomerId(customerId);
    const timeRange = normalizeTimeRange(time);
    return this.googleAdsService.getCampaignPerformance(normalizedCustomerId, timeRange);
  }

  @Get('ad-groups')
  async getAdGroups(
    @Query('customerId') customerId: string | undefined,
    @Query('time') time = 'TODAY',
  ) {
    const normalizedCustomerId = normalizeCustomerId(customerId);
    const timeRange = normalizeTimeRange(time);
    return this.googleAdsService.getAdGroupPerformance(normalizedCustomerId, timeRange);
  }

  @Get('assets')
  async getAssets(
    @Query('customerId') customerId: string | undefined,
    @Query('adGroupId') adGroupId: string | undefined,
    @Query('time') time = 'TODAY',
  ) {
    const normalizedCustomerId = normalizeCustomerId(customerId);
    const normalizedAdGroupId = normalizeAdGroupId(adGroupId);
    const timeRange = normalizeTimeRange(time);
    return this.googleAdsService.getAssetPerformance(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
  }

  @Post('sync')
  async sync(@Body() body: AiReviewBody) {
    const normalizedCustomerId = normalizeCustomerId(body.customerId);
    const normalizedAdGroupId = normalizeAdGroupId(body.adGroupId);
    const timeRange = normalizeTimeRange(body.time);
    return this.googleAdsSyncService.sync(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
  }

  @Get('sync/status')
  async getSyncStatus(@Query('customerId') customerId: string | undefined) {
    const normalizedCustomerId = normalizeCustomerId(customerId);
    return this.googleAdsSyncService.getLatestStatus(normalizedCustomerId);
  }

  @Post('assets/replace-low')
  async replaceLowAssets(@Body() body: ReplaceLowAssetsBody) {
    return this.prepareTextChangeRequest(body);
  }

  @Post('change-requests/text')
  async createTextChangeRequest(@Body() body: ReplaceLowAssetsBody) {
    return this.prepareTextChangeRequest(body);
  }

  @Get('change-requests/:id')
  async getChangeRequest(@Param('id') id: string | undefined) {
    const changeRequestId = id?.trim();
    if (!changeRequestId) {
      throw new BadRequestException('Missing change request ID');
    }
    return this.aiPersistenceService.getChangeRequestPreview(changeRequestId);
  }

  @Post('change-requests/:id/apply')
  async applyChangeRequest(@Param('id') id: string | undefined) {
    const changeRequestId = id?.trim();
    if (!changeRequestId) {
      throw new BadRequestException('Missing change request ID');
    }

    const request = await this.aiPersistenceService.getTextChangeRequestForApply(
      changeRequestId,
    );

    try {
      const result = await this.googleAdsService.replaceLowTextAssets(
        request.customerId,
        request.adGroupId,
        request.timeRange,
        request.input,
      );
      const changeRequest = await this.aiPersistenceService.completeTextChangeRequest(
        changeRequestId,
        request.input,
        result,
      );
      return { changeRequest, result };
    } catch (error) {
      await this.aiPersistenceService.failChangeRequest(changeRequestId, error);
      throw error;
    }
  }

  private async prepareTextChangeRequest(body: ReplaceLowAssetsBody) {
    const normalizedCustomerId = normalizeCustomerId(body.customerId);
    const normalizedAdGroupId = normalizeAdGroupId(body.adGroupId);
    const timeRange = normalizeTimeRange(body.time);
    const headline = body.headline?.trim() ?? '';
    const description = body.description?.trim() ?? '';
    const headlineReplacements = normalizeTextReplacements(body.headlineReplacements);
    const descriptionReplacements = normalizeTextReplacements(body.descriptionReplacements);

    if (
      !headline &&
      !description &&
      headlineReplacements.length === 0 &&
      descriptionReplacements.length === 0
    ) {
      throw new BadRequestException('Enter or choose headline/description suggestions');
    }

    await this.googleAdsSyncService.sync(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
    const preview = await this.googleAdsService.previewLowTextReplacement(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
      { headline, description, headlineReplacements, descriptionReplacements },
    );
    return this.aiPersistenceService.createTextChangeRequest(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
      { headline, description, headlineReplacements, descriptionReplacements },
      preview,
    );
  }

  @Post('assets/ai-review')
  async generateAiReview(@Body() body: AiReviewBody) {
    const normalizedCustomerId = normalizeCustomerId(body.customerId);
    const normalizedAdGroupId = normalizeAdGroupId(body.adGroupId);
    const timeRange = normalizeTimeRange(body.time);

    await this.googleAdsSyncService.sync(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
    const result = await this.googleAdsService.generateAiCreativeReview(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
    return this.aiPersistenceService.saveCreativeReview(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
      result,
    );
  }

  @Post('assets/ai-text-suggestions')
  async generateAiTextSuggestions(@Body() body: AiReviewBody) {
    const normalizedCustomerId = normalizeCustomerId(body.customerId);
    const normalizedAdGroupId = normalizeAdGroupId(body.adGroupId);
    const timeRange = normalizeTimeRange(body.time);

    await this.googleAdsSyncService.sync(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
    const result = await this.googleAdsService.generateAiTextSuggestions(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
    return this.aiPersistenceService.saveTextSuggestions(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
      result,
    );
  }

  @Post('assets/ai-suggestions/:suggestionId/decision')
  async decideAiSuggestion(
    @Param('suggestionId') pathSuggestionId: string | undefined,
    @Body() body: AiDecisionBody,
  ) {
    const suggestionId = pathSuggestionId?.trim();
    if (!suggestionId) {
      throw new BadRequestException('Missing suggestionId');
    }
    return this.aiPersistenceService.decideSuggestion(suggestionId, body);
  }

  @Post('assets/replace-media')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async replaceMediaAsset(
    @Body() body: ReplaceMediaBody,
    @UploadedFile() imageFile?: any,
  ) {
    const normalizedCustomerId = normalizeCustomerId(body.customerId);
    const normalizedAdGroupId = normalizeAdGroupId(body.adGroupId);
    const timeRange = normalizeTimeRange(body.time);
    const mediaType = normalizeMediaType(body.mediaType);
    const oldAssetResourceName = body.oldAssetResourceName?.trim() ?? '';

    if (!oldAssetResourceName) {
      throw new BadRequestException('Choose an image or video asset to replace');
    }

    await this.googleAdsSyncService.sync(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
    const result = await this.googleAdsService.replaceMediaAsset(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
      {
        mediaType,
        oldAssetResourceName,
        imageFile,
        youtubeVideo: body.youtubeVideo,
      },
    );
    await this.aiPersistenceService.saveMediaChange(
      normalizedCustomerId,
      normalizedAdGroupId,
      {
        mediaType,
        oldAssetResourceName,
        youtubeVideo: body.youtubeVideo?.trim() || null,
        imageFileName: imageFile?.originalname ?? null,
      },
      result,
    );
    return result;
  }
}
