import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../modules/auth/auth.guard';
import { CampaignAccessService } from '../modules/auth/campaign-access.service';
import { AiPersistenceService } from './ai-persistence.service';
import { ChangeRequestService } from './change-request.service';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsSyncService } from './google-ads-sync.service';

type TextReplacement = {
  oldText: string;
  newText: string;
  suggestionId?: string;
  variantId?: string;
};

type TextChangeInput = {
  headline?: string;
  description?: string;
  headlineReplacements?: TextReplacement[];
  descriptionReplacements?: TextReplacement[];
};

type MediaReplacementInput = {
  mediaType: 'IMAGE' | 'VIDEO';
  oldAssetResourceName: string;
  imageFile?: any;
  youtubeVideo?: string;
};

@Injectable()
export class AssetReplacementService {
  constructor(
    private readonly googleAdsSyncService: GoogleAdsSyncService,
    private readonly googleAdsService: GoogleAdsService,
    private readonly aiPersistenceService: AiPersistenceService,
    private readonly changeRequestService: ChangeRequestService,
    private readonly campaignAccessService: CampaignAccessService,
  ) {}

  async createTextChangeRequest(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    input: TextChangeInput,
    user: AuthenticatedUser,
  ) {
    await this.googleAdsSyncService.sync(customerId, adGroupId, timeRange);
    await this.campaignAccessService.assertCanEditAdGroup(user, customerId, adGroupId);
    const preview = await this.googleAdsService.previewLowTextReplacement(
      customerId,
      adGroupId,
      timeRange,
      input,
    );
    return this.changeRequestService.createTextChangeRequest(
      customerId,
      adGroupId,
      timeRange,
      input,
      preview,
    );
  }

  async applyTextChangeRequest(changeRequestId: string, user: AuthenticatedUser) {
    await this.campaignAccessService.assertCanApplyChangeRequest(user, changeRequestId);
    const request = await this.changeRequestService.getTextChangeRequestForApply(
      changeRequestId,
    );

    try {
      const result = await this.googleAdsService.replaceLowTextAssets(
        request.customerId,
        request.adGroupId,
        request.timeRange,
        request.input,
      );
      await this.googleAdsSyncService.markTextReplacementsApplied(
        request.customerId,
        request.adGroupId,
        request.input,
        result.replacedAds.map((item) => item.oldResourceName),
      );
      const changeRequest = await this.changeRequestService.completeTextChangeRequest(
        changeRequestId,
        request.input,
        result,
      );
      return { changeRequest, result };
    } catch (error) {
      await this.changeRequestService.failChangeRequest(changeRequestId, error);
      throw error;
    }
  }

  async replaceMedia(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    input: MediaReplacementInput,
    user: AuthenticatedUser,
  ) {
    await this.googleAdsSyncService.sync(customerId, adGroupId, timeRange);
    await this.campaignAccessService.assertCanEditAdGroup(user, customerId, adGroupId);
    const result = await this.googleAdsService.replaceMediaAsset(
      customerId,
      adGroupId,
      timeRange,
      input,
    );
    await this.aiPersistenceService.saveMediaChange(
      customerId,
      adGroupId,
      {
        mediaType: input.mediaType,
        oldAssetResourceName: input.oldAssetResourceName,
        youtubeVideo: input.youtubeVideo?.trim() || null,
        imageFileName: input.imageFile?.originalname ?? null,
      },
      result,
    );
    return result;
  }
}
