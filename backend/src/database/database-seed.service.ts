import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreativePolicyScopeEntity } from './entities/creative-policy-scope.entity';
import { CreativePolicyEntity } from './entities/creative-policy.entity';
import { GoogleAdsAccountEntity } from './entities/google-ads-account.entity';
import { WorkspaceEntity } from '../modules/workspaces/entities/workspace.entity';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.DATABASE_SEED_ENABLED === 'false') return;

    const customerId = (
      process.env.DEFAULT_GOOGLE_ADS_CUSTOMER_ID ?? '9920642691'
    ).replace(/\D/g, '');

    await this.dataSource.transaction(async (manager) => {
      const workspaceRepository = manager.getRepository(WorkspaceEntity);
      const accountRepository = manager.getRepository(GoogleAdsAccountEntity);
      const policyRepository = manager.getRepository(CreativePolicyEntity);
      const scopeRepository = manager.getRepository(CreativePolicyScopeEntity);

      let workspace = await workspaceRepository.findOneBy({ slug: 'allsoft' });
      if (!workspace) {
        workspace = await workspaceRepository.save(
          workspaceRepository.create({
            name: 'Allsoft',
            slug: 'allsoft',
            timezone: 'Asia/Ho_Chi_Minh',
          }),
        );
      }

      let account = await accountRepository.findOneBy({
        workspaceId: workspace.id,
        customerId,
      });
      if (!account) {
        account = await accountRepository.save(
          accountRepository.create({
            workspaceId: workspace.id,
            customerId,
            loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? null,
            displayName: 'Allsoft Google Ads',
            currencyCode: null,
            timeZone: workspace.timezone,
            status: 'ACTIVE',
            credentialRef: null,
            lastSyncedAt: null,
          }),
        );
      }

      let policy = await policyRepository.findOneBy({
        workspaceId: workspace.id,
        name: 'Default LOW asset review',
        version: 1,
      });
      if (!policy) {
        policy = await policyRepository.save(
          policyRepository.create({
            workspaceId: workspace.id,
            name: 'Default LOW asset review',
            selectionStrategy: 'PERFORMANCE_LABEL',
            selectionCriteria: { targetLabels: ['LOW'] },
            languageStrategy: 'DETECT_FROM_ASSET',
            targetLanguage: null,
            headlineMaxLength: 30,
            descriptionMaxLength: 90,
            approvalMode: 'MANUAL',
            reviewIntervalDays: 14,
            minimumImpressions: '0',
            minimumClicks: '0',
            cooldownDays: 14,
            maxChangesPerRun: 10,
            version: 1,
            enabled: true,
          }),
        );
      }

      const scope = await scopeRepository.findOneBy({
        policyId: policy.id,
        accountId: account.id,
      });
      if (!scope) {
        await scopeRepository.save(
          scopeRepository.create({
            policyId: policy.id,
            accountId: account.id,
            campaignId: null,
            adGroupId: null,
          }),
        );
      }

      this.logger.log(
        `Seed ready for workspace "${workspace.slug}" and Google Ads customer ${customerId}`,
      );
    });
  }
}
