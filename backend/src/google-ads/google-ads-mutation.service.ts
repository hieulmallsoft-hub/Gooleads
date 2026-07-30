import { Injectable } from '@nestjs/common';
import { GoogleAdsApiService } from './google-ads-api.service';

@Injectable()
export class GoogleAdsMutationService {
  constructor(private readonly googleAdsApi: GoogleAdsApiService) {}

  mutateAds(customerId: string, operations: any[]) {
    return this.googleAdsApi.mutateAds(customerId, operations);
  }

  mutateAssets(customerId: string, operations: any[]) {
    return this.googleAdsApi.mutateAssets(customerId, operations);
  }
}
