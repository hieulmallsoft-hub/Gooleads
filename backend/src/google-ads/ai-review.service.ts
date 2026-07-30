import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../modules/auth/auth.guard';
import { CampaignAccessService } from '../modules/auth/campaign-access.service';
import { AiPersistenceService } from './ai-persistence.service';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsSyncService } from './google-ads-sync.service';

@Injectable()
export class AiReviewService {
  constructor(
    private readonly googleAdsSyncService: GoogleAdsSyncService,
    private readonly googleAdsService: GoogleAdsService,
    private readonly aiPersistenceService: AiPersistenceService,
    private readonly campaignAccessService: CampaignAccessService,
  ) {}

  async generateCreativeReview(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    user: AuthenticatedUser,
  ) {
    await this.googleAdsSyncService.sync(customerId, adGroupId, timeRange);
    await this.campaignAccessService.assertCanEditAdGroup(user, customerId, adGroupId);
    const result = await this.googleAdsService.generateAiCreativeReview(
      customerId,
      adGroupId,
      timeRange,
    );
    return this.aiPersistenceService.saveCreativeReview(
      customerId,
      adGroupId,
      timeRange,
      result,
    );
  }

  async generateTextSuggestions(
    customerId: string,
    adGroupId: string,
    timeRange: string,
    user: AuthenticatedUser,
  ) {
    await this.googleAdsSyncService.sync(customerId, adGroupId, timeRange);
    await this.campaignAccessService.assertCanEditAdGroup(user, customerId, adGroupId);
    const result = await this.googleAdsService.generateAiTextSuggestions(
      customerId,
      adGroupId,
      timeRange,
    );
    return this.aiPersistenceService.saveTextSuggestions(
      customerId,
      adGroupId,
      timeRange,
      result,
    );
  }
}
