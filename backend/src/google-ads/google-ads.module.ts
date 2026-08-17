import { Module } from '@nestjs/common';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleAdsSyncService } from './google-ads-sync.service';
import { GoogleAdsSyncQueueService } from './google-ads-sync-queue.service';
import { GoogleAdsService } from './google-ads.service';
import { AiPersistenceService } from './ai-persistence.service';
import { AiReviewService } from './ai-review.service';
import { AssetReplacementService } from './asset-replacement.service';
import { ChangeRequestService } from './change-request.service';
import { GoogleAdsApiService } from './google-ads-api.service';
import { GoogleAdsMutationService } from './google-ads-mutation.service';
import { GoogleAdsQueryService } from './google-ads-query.service';
import { GoogleAdsSnapshotService } from './google-ads-snapshot.service';
import { GoogleAdsPeriodicSyncService } from './google-ads-periodic-sync.service';

@Module({
  controllers: [GoogleAdsController],
  providers: [
    GoogleAdsApiService,
    GoogleAdsQueryService,
    GoogleAdsMutationService,
    GoogleAdsService,
    GoogleAdsSyncService,
    GoogleAdsSyncQueueService,
    GoogleAdsSnapshotService,
    GoogleAdsPeriodicSyncService,
    AiPersistenceService,
    AiReviewService,
    AssetReplacementService,
    ChangeRequestService,
  ],
  exports: [
    GoogleAdsApiService,
    GoogleAdsQueryService,
    GoogleAdsMutationService,
    GoogleAdsService,
    GoogleAdsSyncService,
    GoogleAdsSyncQueueService,
    GoogleAdsSnapshotService,
    AiPersistenceService,
    AiReviewService,
    AssetReplacementService,
    ChangeRequestService,
  ],
})
export class GoogleAdsModule {}
