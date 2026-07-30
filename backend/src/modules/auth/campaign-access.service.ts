import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdGroupEntity } from '../../database/entities/ad-group.entity';
import { AiReviewRunEntity } from '../../database/entities/ai-review-run.entity';
import { AiSuggestionEntity } from '../../database/entities/ai-suggestion.entity';
import { CampaignEntity } from '../../database/entities/campaign.entity';
import { ChangeRequestEntity } from '../../database/entities/change-request.entity';
import { GoogleAdsAccountEntity } from '../../database/entities/google-ads-account.entity';
import type { AuthenticatedUser } from './auth.guard';

@Injectable()
export class CampaignAccessService {
  constructor(private readonly dataSource: DataSource) {}

  canViewCustomer(user: AuthenticatedUser, customerId: string) {
    if (user.role === 'ADMIN') return true;
    return user.accountAccess.some((access) => access.customerId === customerId);
  }

  assertCanViewCustomer(user: AuthenticatedUser, customerId: string) {
    if (!this.canViewCustomer(user, customerId)) {
      throw new ForbiddenException('You do not have access to this Google Ads account');
    }
  }

  async assertCanViewAdGroup(
    user: AuthenticatedUser,
    customerId: string,
    googleAdGroupId: string,
  ) {
    this.assertCanViewCustomer(user, customerId);
  }

  async assertCanEditAdGroup(
    user: AuthenticatedUser,
    customerId: string,
    googleAdGroupId: string,
  ) {
    if (user.role === 'ADMIN') return;
    if (user.role !== 'EDITOR') {
      throw new ForbiddenException('You do not have edit permission');
    }
    this.assertCanViewCustomer(user, customerId);
  }

  async assertCanDecideSuggestion(user: AuthenticatedUser, suggestionId: string) {
    if (user.role === 'ADMIN') return;
    if (user.role !== 'EDITOR') {
      throw new ForbiddenException('You do not have edit permission');
    }

    const suggestion = await this.dataSource
      .getRepository(AiSuggestionEntity)
      .findOneBy({ id: suggestionId });
    if (!suggestion) throw new NotFoundException('AI suggestion not found');

    const reviewRun = await this.dataSource
      .getRepository(AiReviewRunEntity)
      .findOneBy({ id: suggestion.reviewRunId });
    if (!reviewRun?.adGroupId) {
      throw new ForbiddenException('This suggestion is not linked to an editable ad group');
    }

    const context = await this.findCampaignByInternalAdGroup(reviewRun.adGroupId);
    if (!context) {
      throw new NotFoundException('Suggestion campaign context is unavailable');
    }

    this.assertCanViewCustomer(user, context.account.customerId);
  }

  async assertCanApplyChangeRequest(user: AuthenticatedUser, changeRequestId: string) {
    if (user.role === 'ADMIN') return;
    if (user.role !== 'EDITOR') {
      throw new ForbiddenException('You do not have edit permission');
    }

    const request = await this.dataSource
      .getRepository(ChangeRequestEntity)
      .findOneBy({ id: changeRequestId });
    if (!request) throw new NotFoundException('Change request not found');
    if (!request.adGroupId) {
      throw new ForbiddenException('This change request is not linked to an editable ad group');
    }

    const context = await this.findCampaignByInternalAdGroup(request.adGroupId);
    if (!context) {
      throw new NotFoundException('Change request campaign context is unavailable');
    }

    this.assertCanViewCustomer(user, context.account.customerId);
  }

  private async findAdGroupCampaign(customerId: string, googleAdGroupId: string) {
    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId });
    if (!account) return null;

    const campaigns = await this.dataSource
      .getRepository(CampaignEntity)
      .findBy({ accountId: account.id });
    if (!campaigns.length) return null;

    const campaignIds = campaigns.map((campaign) => campaign.id);
    const adGroup = await this.dataSource
      .getRepository(AdGroupEntity)
      .createQueryBuilder('adGroup')
      .where('adGroup.googleAdGroupId = :googleAdGroupId', { googleAdGroupId })
      .andWhere('adGroup.campaignId IN (:...campaignIds)', { campaignIds })
      .getOne();
    if (!adGroup) return null;

    const campaign = campaigns.find((item) => item.id === adGroup.campaignId);
    return campaign ? { account, campaign, adGroup } : null;
  }

  private async findCampaignByInternalAdGroup(adGroupId: string) {
    const adGroup = await this.dataSource
      .getRepository(AdGroupEntity)
      .findOneBy({ id: adGroupId });
    if (!adGroup) return null;

    const campaign = await this.dataSource
      .getRepository(CampaignEntity)
      .findOneBy({ id: adGroup.campaignId });
    if (!campaign) return null;

    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ id: campaign.accountId });
    if (!account) return null;

    return { account, campaign, adGroup };
  }
}
