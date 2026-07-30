import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreativePolicyScopeEntity } from './entities/creative-policy-scope.entity';
import { CreativePolicyEntity } from './entities/creative-policy.entity';
import { GoogleAdsAccountEntity } from './entities/google-ads-account.entity';
import { AppUserEntity } from './entities/app-user.entity';
import { WorkspaceMemberEntity } from './entities/workspace-member.entity';
import { WorkspaceEntity } from '../modules/workspaces/entities/workspace.entity';
import { getPasswordPolicyError, hashPassword } from '../modules/auth/password';

function normalizeCustomerId(value: string | null | undefined) {
  const normalized = String(value ?? '').replace(/\D/g, '');
  return /^\d{10}$/.test(normalized) ? normalized : null;
}

function configuredLoginCustomerId() {
  return normalizeCustomerId(
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ??
      process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID ??
      process.env.GOOGLE_ADS_MCC_CUSTOMER_ID,
  );
}

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
      const userRepository = manager.getRepository(AppUserEntity);
      const memberRepository = manager.getRepository(WorkspaceMemberEntity);
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
            loginCustomerId: configuredLoginCustomerId(),
            displayName: 'Allsoft Google Ads',
            currencyCode: null,
            timeZone: workspace.timezone,
            status: 'ACTIVE',
            credentialRef: null,
            lastSyncedAt: null,
          }),
        );
      }

      const adminEmail = (
        process.env.ADMIN_EMAIL ?? 'admin@allsoft.local'
      ).trim().toLowerCase();
      const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
      const adminName = process.env.ADMIN_NAME ?? 'Allsoft Admin';
      if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
        throw new Error('ADMIN_PASSWORD is required in production');
      }
      const adminPasswordError = getPasswordPolicyError(adminPassword);
      if (adminPasswordError) {
        throw new Error(`ADMIN_PASSWORD is invalid: ${adminPasswordError}`);
      }

      let admin = await userRepository.findOneBy({ email: adminEmail });
      if (!admin) {
        admin = await userRepository.save(
          userRepository.create({
            email: adminEmail,
            displayName: adminName,
            passwordHash: hashPassword(adminPassword),
            status: 'ACTIVE',
            lastLoginAt: null,
          }),
        );
      } else {
        admin.displayName = admin.displayName || adminName;
        admin.status = 'ACTIVE';
        if (!admin.passwordHash || process.env.ADMIN_PASSWORD_RESET === 'true') {
          admin.passwordHash = hashPassword(adminPassword);
        }
        admin = await userRepository.save(admin);
      }

      const adminMember = await memberRepository.findOneBy({
        workspaceId: workspace.id,
        userId: admin.id,
      });
      if (!adminMember) {
        await memberRepository.save(
          memberRepository.create({
            workspaceId: workspace.id,
            userId: admin.id,
            role: 'ADMIN',
          }),
        );
      } else if (adminMember.role !== 'ADMIN') {
        adminMember.role = 'ADMIN';
        await memberRepository.save(adminMember);
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
        `Seed ready for workspace "${workspace.slug}", admin "${adminEmail}", and Google Ads customer ${customerId}`,
      );
    });
  }
}
