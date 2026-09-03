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
    if (user.role === 'ADMIN') {
      const adminCustomerId = (
        process.env.ADMIN_GOOGLE_ADS_CUSTOMER_ID ?? '9920642691'
      ).replace(/\D/g, '');
      return customerId === adminCustomerId;
    }
    return user.accountAccess.some((access) => access.customerId === customerId);
  }

  assertCanViewCustomer(user: AuthenticatedUser, customerId: string) {
    if (!this.canViewCustomer(user, customerId)) {
      throw new ForbiddenException(`Bạn không có quyền truy cập tài khoản Google Ads ${customerId}`);
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
    if (user.role !== 'ADMIN' && user.role !== 'EDITOR') {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa nội dung này');
    }
    this.assertCanViewCustomer(user, customerId);
  }

  async assertCanDecideSuggestion(user: AuthenticatedUser, suggestionId: string) {
    if (user.role !== 'ADMIN' && user.role !== 'EDITOR') {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa nội dung này');
    }

    const suggestion = await this.dataSource
      .getRepository(AiSuggestionEntity)
      .findOneBy({ id: suggestionId });
    if (!suggestion) throw new NotFoundException('Không tìm thấy đề xuất AI');

    const reviewRun = await this.dataSource
      .getRepository(AiReviewRunEntity)
      .findOneBy({ id: suggestion.reviewRunId });
    if (!reviewRun?.adGroupId) {
      throw new ForbiddenException('Đề xuất này không thuộc nhóm quảng cáo mà bạn được phép chỉnh sửa');
    }

    const context = await this.findCampaignByInternalAdGroup(reviewRun.adGroupId);
    if (!context) {
      throw new NotFoundException('Không xác định được chiến dịch của đề xuất');
    }

    this.assertCanViewCustomer(user, context.account.customerId);
  }

  async assertCanApplyChangeRequest(user: AuthenticatedUser, changeRequestId: string) {
    if (user.role !== 'ADMIN' && user.role !== 'EDITOR') {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa nội dung này');
    }

    const request = await this.dataSource
      .getRepository(ChangeRequestEntity)
      .findOneBy({ id: changeRequestId });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu thay đổi');
    if (!request.adGroupId) {
      throw new ForbiddenException('Yêu cầu thay đổi không thuộc nhóm quảng cáo mà bạn được phép chỉnh sửa');
    }

    const context = await this.findCampaignByInternalAdGroup(request.adGroupId);
    if (!context) {
      throw new NotFoundException('Không xác định được chiến dịch của yêu cầu thay đổi');
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
