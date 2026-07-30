import { Module } from '@nestjs/common';
import { GoogleAdsModule } from '../../google-ads/google-ads.module';
import { CreativeAutomationService } from './creative-automation.service';
import { CreativeOperationsController } from './creative-operations.controller';
import { CreativeOperationsService } from './creative-operations.service';

@Module({
  imports: [GoogleAdsModule],
  controllers: [CreativeOperationsController],
  providers: [CreativeOperationsService, CreativeAutomationService],
})
export class CreativeOperationsModule {}
