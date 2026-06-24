import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WorkspaceEntity } from '../modules/workspaces/entities/workspace.entity';
import { CreativePolicyScopeEntity } from './entities/creative-policy-scope.entity';
import { CreativePolicyEntity } from './entities/creative-policy.entity';
import { GoogleAdsAccountEntity } from './entities/google-ads-account.entity';

@Injectable()
export class GoogleAdsAccountRegistryService {
  constructor(private readonly dataSource: DataSource) {}

  async listActive() {
    return this.dataSource.getRepository(GoogleAdsAccountEntity).find({
      where: { status: 'ACTIVE' },
      order: { displayName: 'ASC', customerId: 'ASC' },
      select: {
        customerId: true,
        displayName: true,
        status: true,
      },
    });
  }

  async getOrCreate(customerId: string) {
    const existing = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId });
    if (existing) return existing;

    return this.dataSource.transaction(async (manager) => {
      const accountRepository = manager.getRepository(GoogleAdsAccountEntity);
      const concurrent = await accountRepository.findOneBy({ customerId });
      if (concurrent) return concurrent;

      const workspaceRepository = manager.getRepository(WorkspaceEntity);
      let workspace = await workspaceRepository.findOneBy({ slug: 'allsoft' });
      if (!workspace) {
        workspace = await workspaceRepository.save({
          name: 'Allsoft',
          slug: 'allsoft',
          timezone: 'Asia/Ho_Chi_Minh',
        });
      }

      const account = await accountRepository.save({
        workspaceId: workspace.id,
        customerId,
        loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? null,
        displayName: `Google Ads ${customerId}`,
        currencyCode: null,
        timeZone: workspace.timezone,
        status: 'ACTIVE',
        credentialRef: null,
        lastSyncedAt: null,
      });
      const policy = await manager.getRepository(CreativePolicyEntity).findOne({
        where: { workspaceId: workspace.id, enabled: true },
        order: { version: 'DESC' },
      });
      if (policy) {
        await manager.getRepository(CreativePolicyScopeEntity).save({
          policyId: policy.id,
          accountId: account.id,
          campaignId: null,
          adGroupId: null,
        });
      }
      return account;
    });
  }
}
