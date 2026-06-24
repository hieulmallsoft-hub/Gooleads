import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { GoogleAdsModule } from './google-ads/google-ads.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { CreativeOperationsModule } from './modules/creative-operations/creative-operations.module';
import { CampaignGroupsModule } from './modules/campaign-groups/campaign-groups.module';

@Module({
  imports: [
    DatabaseModule,
    WorkspacesModule,
    GoogleAdsModule,
    CreativeOperationsModule,
    CampaignGroupsModule,
  ],
})
export class AppModule {}
