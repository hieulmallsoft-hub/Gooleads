import { AdAssetDailyMetricEntity } from './ad-asset-daily-metric.entity';
import { AdAssetLinkEntity } from './ad-asset-link.entity';
import { AdGroupDailyMetricEntity } from './ad-group-daily-metric.entity';
import { AdGroupEntity } from './ad-group.entity';
import { AdEntity } from './ad.entity';
import { AiReviewRunEntity } from './ai-review-run.entity';
import { AiSuggestionDecisionEntity } from './ai-suggestion-decision.entity';
import { AiSuggestionVariantEntity } from './ai-suggestion-variant.entity';
import { AiSuggestionEntity } from './ai-suggestion.entity';
import { AppUserEntity } from './app-user.entity';
import { AssetEntity } from './asset.entity';
import { AuditLogEntity } from './audit-log.entity';
import { AutomationRunItemEntity } from './automation-run-item.entity';
import { AutomationRunEntity } from './automation-run.entity';
import { AutomationScheduleEntity } from './automation-schedule.entity';
import { CampaignDailyMetricEntity } from './campaign-daily-metric.entity';
import { CampaignEntity } from './campaign.entity';
import { CampaignGroupEntity } from './campaign-group.entity';
import { CampaignGroupMemberEntity } from './campaign-group-member.entity';
import { ChangeItemEntity } from './change-item.entity';
import { ChangeRequestEntity } from './change-request.entity';
import { CreativeExampleEntity } from './creative-example.entity';
import { CreativePolicyScopeEntity } from './creative-policy-scope.entity';
import { CreativePolicyEntity } from './creative-policy.entity';
import { CreativeTermEntity } from './creative-term.entity';
import { GoogleAdsAccountEntity } from './google-ads-account.entity';
import { MediaFileEntity } from './media-file.entity';
import { PromptTemplateEntity } from './prompt-template.entity';
import { SyncRunEntity } from './sync-run.entity';
import { UserPreferenceEntity } from './user-preference.entity';
import { WorkspaceMemberEntity } from './workspace-member.entity';
import { WorkspaceEntity } from '../../modules/workspaces/entities/workspace.entity';

export const DATABASE_ENTITIES = [
  WorkspaceEntity,
  AppUserEntity,
  WorkspaceMemberEntity,
  GoogleAdsAccountEntity,
  UserPreferenceEntity,
  CampaignEntity,
  CampaignGroupEntity,
  CampaignGroupMemberEntity,
  AdGroupEntity,
  AdEntity,
  MediaFileEntity,
  AssetEntity,
  AdAssetLinkEntity,
  SyncRunEntity,
  CampaignDailyMetricEntity,
  AdGroupDailyMetricEntity,
  AdAssetDailyMetricEntity,
  CreativePolicyEntity,
  CreativePolicyScopeEntity,
  CreativeTermEntity,
  CreativeExampleEntity,
  PromptTemplateEntity,
  AiReviewRunEntity,
  AiSuggestionEntity,
  AiSuggestionVariantEntity,
  AiSuggestionDecisionEntity,
  ChangeRequestEntity,
  ChangeItemEntity,
  AutomationScheduleEntity,
  AutomationRunEntity,
  AutomationRunItemEntity,
  AuditLogEntity,
];
