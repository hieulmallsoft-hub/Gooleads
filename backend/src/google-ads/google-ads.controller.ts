import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsSyncService } from './google-ads-sync.service';
import { AiPersistenceService } from './ai-persistence.service';
import { AiReviewService } from './ai-review.service';
import { AssetReplacementService } from './asset-replacement.service';
import { ChangeRequestService } from './change-request.service';
import { GoogleAdsAccountRegistryService } from '../database/google-ads-account-registry.service';
import { AuthGuard, type AuthenticatedUser } from '../modules/auth/auth.guard';
import { CampaignAccessService } from '../modules/auth/campaign-access.service';
import { RequirePermissions } from '../modules/auth/permissions.decorator';

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

@UseGuards(AuthGuard)
@RequirePermissions('ads.view')
@Controller('google-ads')
export class GoogleAdsController {
  constructor(
    private readonly googleAdsService: GoogleAdsService,
    private readonly googleAdsSyncService: GoogleAdsSyncService,
    private readonly aiPersistenceService: AiPersistenceService,
    private readonly aiReviewService: AiReviewService,
    private readonly assetReplacementService: AssetReplacementService,
    private readonly changeRequestService: ChangeRequestService,
    private readonly accountRegistry: GoogleAdsAccountRegistryService,
    private readonly campaignAccessService: CampaignAccessService,
  ) {}

  @Get('accounts')
  async getAccounts(@Req() request: { user: AuthenticatedUser }) {
    const accounts = await this.accountRegistry.listActive();
    return {
      accounts: accounts
        .filter((account) =>
          this.campaignAccessService.canViewCustomer(request.user, account.customerId),
        )
        .map((account) => ({
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
    @Req() request: { user: AuthenticatedUser },
  ) {
    const normalizedCustomerId = normalizeCustomerId(customerId);
    const timeRange = normalizeTimeRange(time);
    this.campaignAccessService.assertCanViewCustomer(request.user, normalizedCustomerId);
    return this.googleAdsService.getCampaignPerformance(normalizedCustomerId, timeRange);
  }

  @Get('ad-groups')
  async getAdGroups(
    @Query('customerId') customerId: string | undefined,
    @Query('time') time = 'TODAY',
    @Req() request: { user: AuthenticatedUser },
  ) {
    const normalizedCustomerId = normalizeCustomerId(customerId);
    const timeRange = normalizeTimeRange(time);
    this.campaignAccessService.assertCanViewCustomer(request.user, normalizedCustomerId);
    return this.googleAdsService.getAdGroupPerformance(normalizedCustomerId, timeRange);
  }

  @Get('assets')
  async getAssets(
    @Query('customerId') customerId: string | undefined,
    @Query('adGroupId') adGroupId: string | undefined,
    @Query('time') time = 'TODAY',
    @Req() request: { user: AuthenticatedUser },
  ) {
    const normalizedCustomerId = normalizeCustomerId(customerId);
    const normalizedAdGroupId = normalizeAdGroupId(adGroupId);
    const timeRange = normalizeTimeRange(time);
    await this.campaignAccessService.assertCanViewAdGroup(
      request.user,
      normalizedCustomerId,
      normalizedAdGroupId,
    );
    return this.googleAdsService.getAssetPerformance(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
  }

  @Post('sync')
  async sync(
    @Body() body: AiReviewBody,
    @Req() request: { user: AuthenticatedUser },
  ) {
    const normalizedCustomerId = normalizeCustomerId(body.customerId);
    this.campaignAccessService.assertCanViewCustomer(request.user, normalizedCustomerId);
    const normalizedAdGroupId = normalizeAdGroupId(body.adGroupId);
    const timeRange = normalizeTimeRange(body.time);
    return this.googleAdsSyncService.sync(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
    );
  }

  @Get('sync/status')
  async getSyncStatus(
    @Query('customerId') customerId: string | undefined,
    @Req() request: { user: AuthenticatedUser },
  ) {
    const normalizedCustomerId = normalizeCustomerId(customerId);
    this.campaignAccessService.assertCanViewCustomer(request.user, normalizedCustomerId);
    return this.googleAdsSyncService.getLatestStatus(normalizedCustomerId);
  }

  @Post('assets/replace-low')
  @RequirePermissions('change.preview')
  async replaceLowAssets(
    @Body() body: ReplaceLowAssetsBody,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.prepareTextChangeRequest(body, request.user);
  }

  @Post('change-requests/text')
  @RequirePermissions('change.preview')
  async createTextChangeRequest(
    @Body() body: ReplaceLowAssetsBody,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.prepareTextChangeRequest(body, request.user);
  }

  @Get('change-requests/:id')
  async getChangeRequest(@Param('id') id: string | undefined) {
    const changeRequestId = id?.trim();
    if (!changeRequestId) {
      throw new BadRequestException('Missing change request ID');
    }
    return this.changeRequestService.getChangeRequestPreview(changeRequestId);
  }

  @Post('change-requests/:id/apply')
  @RequirePermissions('change.apply')
  async applyChangeRequest(
    @Param('id') id: string | undefined,
    @Req() request: { user: AuthenticatedUser },
  ) {
    const changeRequestId = id?.trim();
    if (!changeRequestId) {
      throw new BadRequestException('Missing change request ID');
    }

    return this.assetReplacementService.applyTextChangeRequest(changeRequestId, request.user);
  }

  private async prepareTextChangeRequest(
    body: ReplaceLowAssetsBody,
    user: AuthenticatedUser,
  ) {
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

    return this.assetReplacementService.createTextChangeRequest(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
      { headline, description, headlineReplacements, descriptionReplacements },
      user,
    );
  }

  @Post('assets/ai-review')
  @RequirePermissions('ai.generate')
  async generateAiReview(
    @Body() body: AiReviewBody,
    @Req() request: { user: AuthenticatedUser },
  ) {
    const normalizedCustomerId = normalizeCustomerId(body.customerId);
    const normalizedAdGroupId = normalizeAdGroupId(body.adGroupId);
    const timeRange = normalizeTimeRange(body.time);

    return this.aiReviewService.generateCreativeReview(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
      request.user,
    );
  }

  @Post('assets/ai-text-suggestions')
  @RequirePermissions('ai.generate')
  async generateAiTextSuggestions(
    @Body() body: AiReviewBody,
    @Req() request: { user: AuthenticatedUser },
  ) {
    const normalizedCustomerId = normalizeCustomerId(body.customerId);
    const normalizedAdGroupId = normalizeAdGroupId(body.adGroupId);
    const timeRange = normalizeTimeRange(body.time);

    return this.aiReviewService.generateTextSuggestions(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
      request.user,
    );
  }

  @Post('assets/ai-suggestions/:suggestionId/decision')
  @RequirePermissions('suggestion.approve')
  async decideAiSuggestion(
    @Param('suggestionId') pathSuggestionId: string | undefined,
    @Body() body: AiDecisionBody,
    @Req() request: { user: AuthenticatedUser },
  ) {
    const suggestionId = pathSuggestionId?.trim();
    if (!suggestionId) {
      throw new BadRequestException('Missing suggestionId');
    }
    await this.campaignAccessService.assertCanDecideSuggestion(request.user, suggestionId);
    return this.aiPersistenceService.decideSuggestion(suggestionId, body);
  }

  @Post('assets/replace-media')
  @RequirePermissions('media.replace')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async replaceMediaAsset(
    @Body() body: ReplaceMediaBody,
    @Req() request: { user: AuthenticatedUser },
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

    return this.assetReplacementService.replaceMedia(
      normalizedCustomerId,
      normalizedAdGroupId,
      timeRange,
      {
        mediaType,
        oldAssetResourceName,
        imageFile,
        youtubeVideo: body.youtubeVideo,
      },
      request.user,
    );
  }
}
