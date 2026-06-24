import { Module } from '@nestjs/common';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleAdsSyncService } from './google-ads-sync.service';
import { GoogleAdsService } from './google-ads.service';
import { AiPersistenceService } from './ai-persistence.service';

@Module({
  controllers: [GoogleAdsController],
  providers: [GoogleAdsService, GoogleAdsSyncService, AiPersistenceService],
})
export class GoogleAdsModule {}
