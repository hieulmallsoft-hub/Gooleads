import { Injectable } from '@nestjs/common';
import { GoogleAdsApiService } from './google-ads-api.service';

@Injectable()
export class GoogleAdsQueryService {
  constructor(private readonly googleAdsApi: GoogleAdsApiService) {}

  search(customerId: string, query: string) {
    return this.googleAdsApi.search(customerId, query);
  }

  searchAll(customerId: string, query: string) {
    return this.googleAdsApi.searchAll(customerId, query);
  }
}
