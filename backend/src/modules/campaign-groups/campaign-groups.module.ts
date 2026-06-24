import { Module } from '@nestjs/common';
import { CampaignGroupsController } from './campaign-groups.controller';
import { CampaignGroupsService } from './campaign-groups.service';

@Module({
  controllers: [CampaignGroupsController],
  providers: [CampaignGroupsService],
})
export class CampaignGroupsModule {}
