import { Injectable, Logger } from '@nestjs/common';
import { GoogleAdsApiService } from './google-ads-api.service';

type CachedQuery = {
  response: any;
  cachedAt: number;
};

@Injectable()
export class GoogleAdsQueryService {
  private readonly logger = new Logger(GoogleAdsQueryService.name);
  private readonly queryCache = new Map<string, CachedQuery>();
  private readonly inFlightQueries = new Map<string, Promise<any>>();
  private readonly freshCacheMs = this.readDuration(
    process.env.GOOGLE_ADS_QUERY_CACHE_MS,
    5 * 60 * 1000,
  );
  private readonly staleCacheMs = this.readDuration(
    process.env.GOOGLE_ADS_QUERY_STALE_MS,
    24 * 60 * 60 * 1000,
  );

  constructor(private readonly googleAdsApi: GoogleAdsApiService) {}

  search(customerId: string, query: string) {
    return this.runCachedQuery('search', customerId, query, () =>
      this.googleAdsApi.search(customerId, query),
    );
  }

  searchAll(customerId: string, query: string) {
    return this.runCachedQuery('searchAll', customerId, query, () =>
      this.googleAdsApi.searchAll(customerId, query),
    );
  }

  private async runCachedQuery(
    operation: string,
    customerId: string,
    query: string,
    execute: () => Promise<any>,
  ) {
    const key = `${operation}:${customerId.replace(/\D/g, '')}:${this.normalizeQuery(query)}`;
    const now = Date.now();
    const cached = this.queryCache.get(key);

    if (cached && now - cached.cachedAt <= this.freshCacheMs) {
      return cached.response;
    }

    const existingRequest = this.inFlightQueries.get(key);
    if (existingRequest) {
      return existingRequest;
    }

    const request = execute()
      .then((response) => {
        this.queryCache.set(key, { response, cachedAt: Date.now() });
        this.pruneExpiredCache();
        return response;
      })
      .catch((error) => {
        if (cached && now - cached.cachedAt <= this.staleCacheMs && this.isQuotaError(error)) {
          this.logger.warn(
            `Google Ads quota limited for customer ${customerId}; serving cached query data from ${new Date(cached.cachedAt).toISOString()}`,
          );
          return cached.response;
        }

        throw error;
      })
      .finally(() => {
        this.inFlightQueries.delete(key);
      });

    this.inFlightQueries.set(key, request);
    return request;
  }

  private normalizeQuery(query: string) {
    return query.replace(/\s+/g, ' ').trim();
  }

  private isQuotaError(error: unknown) {
    const serialized = this.serializeError(error);
    return /RESOURCE_(?:TEMPORARILY_)?EXHAUSTED|quota|too many requests|\b429\b/i.test(
      serialized,
    );
  }

  private serializeError(error: unknown) {
    if (error instanceof Error) {
      const response = (error as any)?.response;
      return `${error.message} ${JSON.stringify(response ?? {})}`;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private pruneExpiredCache() {
    const oldestAllowed = Date.now() - this.staleCacheMs;
    for (const [key, cached] of this.queryCache.entries()) {
      if (cached.cachedAt < oldestAllowed) {
        this.queryCache.delete(key);
      }
    }
  }

  private readDuration(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }
}
