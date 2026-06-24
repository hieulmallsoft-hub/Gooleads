import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AdAssetDailyMetricEntity } from '../database/entities/ad-asset-daily-metric.entity';
import { AdAssetLinkEntity } from '../database/entities/ad-asset-link.entity';
import { AdGroupDailyMetricEntity } from '../database/entities/ad-group-daily-metric.entity';
import { AdGroupEntity } from '../database/entities/ad-group.entity';
import { AdEntity } from '../database/entities/ad.entity';
import { AssetEntity } from '../database/entities/asset.entity';
import { CampaignDailyMetricEntity } from '../database/entities/campaign-daily-metric.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { GoogleAdsAccountEntity } from '../database/entities/google-ads-account.entity';
import { SyncRunEntity } from '../database/entities/sync-run.entity';
import { GoogleAdsAccountRegistryService } from '../database/google-ads-account-registry.service';
import {
  GoogleAdsService,
  GoogleAdsSyncAdGroup,
  GoogleAdsSyncAsset,
  GoogleAdsSyncCampaign,
} from './google-ads.service';

@Injectable()
export class GoogleAdsSyncService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly googleAdsService: GoogleAdsService,
    private readonly accountRegistry: GoogleAdsAccountRegistryService,
  ) {}

  async sync(customerId: string, adGroupId: string, timeRange: string) {
    const accountRepository = this.dataSource.getRepository(GoogleAdsAccountEntity);
    const syncRunRepository = this.dataSource.getRepository(SyncRunEntity);
    const account = await this.accountRegistry.getOrCreate(customerId);

    const syncRun = await syncRunRepository.save(
      syncRunRepository.create({
        accountId: account.id,
        scope: 'ASSETS',
        rangeStart: null,
        rangeEnd: null,
        status: 'RUNNING',
        rowsRead: 0,
        rowsWritten: 0,
        errorMessage: null,
        metadata: { customerId, adGroupId, timeRange, mode: 'LOW_ONLY' },
        startedAt: new Date(),
        completedAt: null,
      }),
    );

    try {
      const sourceSnapshot = await this.googleAdsService.getSyncSnapshot(
        customerId,
        timeRange,
        adGroupId,
      );
      const snapshot = {
        campaigns: sourceSnapshot.campaigns,
        adGroups: sourceSnapshot.adGroups,
        assets: sourceSnapshot.assets.filter(
          (asset) => asset.performanceLabel === 'LOW',
        ),
      };
      const dates = [
        ...snapshot.campaigns.map((item) => item.date),
        ...snapshot.adGroups.map((item) => item.date),
        ...snapshot.assets.map((item) => item.date),
      ]
        .filter(Boolean)
        .sort();

      const rowsRead =
        snapshot.campaigns.length + snapshot.adGroups.length + snapshot.assets.length;
      const result = await this.dataSource.transaction((manager) =>
        this.persistSnapshot(manager, account, syncRun, snapshot),
      );

      syncRun.rangeStart = dates[0] ?? null;
      syncRun.rangeEnd = dates.at(-1) ?? null;
      syncRun.status = 'COMPLETED';
      syncRun.rowsRead = rowsRead;
      syncRun.rowsWritten = result.rowsWritten;
      syncRun.completedAt = new Date();
      syncRun.metadata = { ...syncRun.metadata, ...result.counts };
      account.lastSyncedAt = syncRun.completedAt;
      await syncRunRepository.save(syncRun);
      await accountRepository.save(account);

      return {
        syncRunId: syncRun.id,
        customerId,
        adGroupId,
        timeRange,
        rangeStart: syncRun.rangeStart,
        rangeEnd: syncRun.rangeEnd,
        rowsRead,
        rowsWritten: result.rowsWritten,
        ...result.counts,
      };
    } catch (error) {
      syncRun.status = 'FAILED';
      syncRun.errorMessage = error instanceof Error ? error.message : String(error);
      syncRun.completedAt = new Date();
      await syncRunRepository.save(syncRun);
      throw error;
    }
  }

  async getLatestStatus(customerId: string) {
    const account = await this.dataSource
      .getRepository(GoogleAdsAccountEntity)
      .findOneBy({ customerId });
    if (!account) return null;

    return this.dataSource.getRepository(SyncRunEntity).findOne({
      where: { accountId: account.id },
      order: { startedAt: 'DESC' },
    });
  }

  private async persistSnapshot(
    manager: EntityManager,
    account: GoogleAdsAccountEntity,
    syncRun: SyncRunEntity,
    snapshot: {
      campaigns: GoogleAdsSyncCampaign[];
      adGroups: GoogleAdsSyncAdGroup[];
      assets: GoogleAdsSyncAsset[];
    },
  ) {
    const now = new Date();
    const campaignRows = this.uniqueBy(snapshot.campaigns, (item) => item.id);
    const campaignRepository = manager.getRepository(CampaignEntity);
    const existingCampaigns = await campaignRepository.findBy({ accountId: account.id });
    const existingCampaignMap = new Map(
      existingCampaigns.map((item) => [item.googleCampaignId, item]),
    );

    await this.bulkUpsert(
      campaignRepository,
      campaignRows.map((item) => ({
        accountId: account.id,
        googleCampaignId: item.id,
        resourceName:
          item.resourceName || `customers/${account.customerId}/campaigns/${item.id}`,
        name: item.name,
        status: item.status,
        channelType: item.channelType || null,
        firstSeenAt: existingCampaignMap.get(item.id)?.firstSeenAt ?? now,
        lastSeenAt: now,
      })),
      ['accountId', 'googleCampaignId'],
    );
    const campaigns = await campaignRepository.findBy({ accountId: account.id });
    const campaignMap = new Map(campaigns.map((item) => [item.googleCampaignId, item]));

    const adGroupRows = this.uniqueBy(snapshot.adGroups, (item) => item.id).filter((item) =>
      campaignMap.has(item.campaignId),
    );
    const adGroupRepository = manager.getRepository(AdGroupEntity);
    const campaignIds = campaigns.map((item) => item.id);
    const existingAdGroups = campaignIds.length
      ? await adGroupRepository.findBy({ campaignId: In(campaignIds) })
      : [];
    const existingAdGroupMap = new Map(
      existingAdGroups.map((item) => [`${item.campaignId}:${item.googleAdGroupId}`, item]),
    );

    await this.bulkUpsert(
      adGroupRepository,
      adGroupRows.map((item) => {
        const campaign = campaignMap.get(item.campaignId)!;
        return {
          campaignId: campaign.id,
          googleAdGroupId: item.id,
          resourceName:
            item.resourceName || `customers/${account.customerId}/adGroups/${item.id}`,
          name: item.name,
          status: item.status,
          firstSeenAt:
            existingAdGroupMap.get(`${campaign.id}:${item.id}`)?.firstSeenAt ?? now,
          lastSeenAt: now,
        };
      }),
      ['campaignId', 'googleAdGroupId'],
    );
    const adGroups = campaignIds.length
      ? await adGroupRepository.findBy({ campaignId: In(campaignIds) })
      : [];
    const adGroupMap = new Map(adGroups.map((item) => [item.googleAdGroupId, item]));

    const assetRows = snapshot.assets.filter(
      (item) => item.assetId && item.assetResourceName && adGroupMap.has(item.adGroupId),
    );
    const uniqueAssets = this.uniqueBy(assetRows, (item) => item.assetId);
    const assetRepository = manager.getRepository(AssetEntity);
    const existingAssets = await assetRepository.findBy({ accountId: account.id });
    const existingAssetMap = new Map(existingAssets.map((item) => [item.googleAssetId, item]));
    await this.bulkUpsert(
      assetRepository,
      uniqueAssets.map((item) => ({
        accountId: account.id,
        mediaFileId: null,
        googleAssetId: item.assetId,
        resourceName: item.assetResourceName,
        assetType: item.assetType,
        name: item.assetName || null,
        textContent: item.text || null,
        languageCode: this.detectLanguage(item.text),
        imageUrl: item.imageUrl || null,
        imageWidth: item.imageWidth || null,
        imageHeight: item.imageHeight || null,
        youtubeVideoId: item.videoId || null,
        contentHash: null,
        source: 'GOOGLE_ADS',
        status: 'ACTIVE',
        firstSeenAt: existingAssetMap.get(item.assetId)?.firstSeenAt ?? now,
        lastSeenAt: now,
      })),
      ['accountId', 'googleAssetId'],
    );
    const assets = await assetRepository.findBy({ accountId: account.id });
    const assetMap = new Map(assets.map((item) => [item.googleAssetId, item]));

    const adRepository = manager.getRepository(AdEntity);
    const uniqueAds = this.uniqueBy(assetRows, (item) => `${item.adGroupId}:${item.adId}`)
      .map((item) => ({ ...item, adId: item.adId || this.parseAdId(item.adResourceName) }))
      .filter((item) => item.adId);
    const adGroupIds = adGroups.map((item) => item.id);
    const existingAds = adGroupIds.length
      ? await adRepository.findBy({ adGroupId: In(adGroupIds) })
      : [];
    const existingAdMap = new Map(
      existingAds.map((item) => [`${item.adGroupId}:${item.googleAdId}`, item]),
    );
    await this.bulkUpsert(
      adRepository,
      uniqueAds.map((item) => {
        const adGroup = adGroupMap.get(item.adGroupId)!;
        return {
          adGroupId: adGroup.id,
          googleAdId: item.adId,
          resourceName: item.adResourceName,
          adType: item.adType,
          status: item.adStatus,
          firstSeenAt: existingAdMap.get(`${adGroup.id}:${item.adId}`)?.firstSeenAt ?? now,
          lastSeenAt: now,
        };
      }),
      ['adGroupId', 'googleAdId'],
    );
    const ads = adGroupIds.length
      ? await adRepository.findBy({ adGroupId: In(adGroupIds) })
      : [];
    const adMap = new Map(ads.map((item) => [`${item.adGroupId}:${item.googleAdId}`, item]));

    const linkRepository = manager.getRepository(AdAssetLinkEntity);
    const existingLinks = ads.length
      ? await linkRepository.findBy({ adId: In(ads.map((item) => item.id)) })
      : [];
    const existingLinkMap = new Map(
      existingLinks.map((item) => [
        `${item.adId}:${item.assetId}:${item.fieldType}:${item.occurrenceIndex}`,
        item,
      ]),
    );
    const linkInputs = this.uniqueBy(assetRows, (item) =>
      `${item.adGroupId}:${item.adId || this.parseAdId(item.adResourceName)}:${item.assetId}:${item.fieldType}`,
    )
      .map((item) => {
        const adGroup = adGroupMap.get(item.adGroupId);
        const adId = item.adId || this.parseAdId(item.adResourceName);
        const ad = adGroup ? adMap.get(`${adGroup.id}:${adId}`) : undefined;
        const asset = assetMap.get(item.assetId);
        if (!ad || !asset) return null;
        const key = `${ad.id}:${asset.id}:${item.fieldType}:0`;
        return {
          adId: ad.id,
          assetId: asset.id,
          googleViewResourceName: item.viewResourceName || null,
          fieldType: item.fieldType,
          occurrenceIndex: 0,
          enabled: true,
          performanceLabel: item.performanceLabel || 'UNKNOWN',
          firstSeenAt: existingLinkMap.get(key)?.firstSeenAt ?? now,
          lastSeenAt: now,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    await this.bulkUpsert(linkRepository, linkInputs, [
      'adId',
      'assetId',
      'fieldType',
      'occurrenceIndex',
    ]);
    const links = ads.length
      ? await linkRepository.findBy({ adId: In(ads.map((item) => item.id)) })
      : [];
    const linkMap = new Map(
      links.map((item) => [`${item.adId}:${item.assetId}:${item.fieldType}:0`, item]),
    );

    const campaignMetrics = snapshot.campaigns
      .map((item) => {
        const campaign = campaignMap.get(item.id);
        return campaign && item.date
          ? {
              campaignId: campaign.id,
              metricDate: item.date,
              syncRunId: syncRun.id,
              impressions: String(item.impressions),
              clicks: String(item.clicks),
              costMicros: String(item.costMicros),
              conversions: String(item.conversions),
              conversionValue: String(item.conversionValue),
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const adGroupMetrics = snapshot.adGroups
      .map((item) => {
        const adGroup = adGroupMap.get(item.id);
        return adGroup && item.date
          ? {
              adGroupId: adGroup.id,
              metricDate: item.date,
              syncRunId: syncRun.id,
              impressions: String(item.impressions),
              clicks: String(item.clicks),
              costMicros: String(item.costMicros),
              conversions: String(item.conversions),
              conversionValue: String(item.conversionValue),
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const adAssetMetrics = snapshot.assets
      .map((item) => {
        const adGroup = adGroupMap.get(item.adGroupId);
        const ad = adGroup
          ? adMap.get(`${adGroup.id}:${item.adId || this.parseAdId(item.adResourceName)}`)
          : undefined;
        const asset = assetMap.get(item.assetId);
        const link = ad && asset
          ? linkMap.get(`${ad.id}:${asset.id}:${item.fieldType}:0`)
          : undefined;
        return link && item.date
          ? {
              adAssetLinkId: link.id,
              metricDate: item.date,
              syncRunId: syncRun.id,
              performanceLabel: item.performanceLabel || 'UNKNOWN',
              impressions: String(item.impressions),
              clicks: String(item.clicks),
              costMicros: String(item.costMicros),
              conversions: String(item.conversions),
              conversionValue: String(item.conversionValue),
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    await this.bulkUpsert(
      manager.getRepository(CampaignDailyMetricEntity),
      campaignMetrics,
      ['campaignId', 'metricDate'],
    );
    await this.bulkUpsert(
      manager.getRepository(AdGroupDailyMetricEntity),
      adGroupMetrics,
      ['adGroupId', 'metricDate'],
    );
    await this.bulkUpsert(
      manager.getRepository(AdAssetDailyMetricEntity),
      adAssetMetrics,
      ['adAssetLinkId', 'metricDate'],
    );

    const counts = {
      campaigns: campaignRows.length,
      adGroups: adGroupRows.length,
      ads: uniqueAds.length,
      assets: uniqueAssets.length,
      assetLinks: linkInputs.length,
      campaignMetricRows: campaignMetrics.length,
      adGroupMetricRows: adGroupMetrics.length,
      assetMetricRows: adAssetMetrics.length,
    };
    return {
      counts,
      rowsWritten: Object.values(counts).reduce((sum, count) => sum + count, 0),
    };
  }

  private uniqueBy<T>(items: T[], key: (item: T) => string) {
    return Array.from(new Map(items.map((item) => [key(item), item])).values());
  }

  private async bulkUpsert<T extends object>(
    repository: Repository<T>,
    rows: Record<string, unknown>[],
    conflictPaths: string[],
  ) {
    for (let index = 0; index < rows.length; index += 300) {
      await repository.upsert(rows.slice(index, index + 300) as any, {
        conflictPaths,
        skipUpdateIfNoValuesChanged: true,
      });
    }
  }

  private parseAdId(resourceName: string) {
    return resourceName.split('~').at(-1)?.replace(/\D/g, '') ?? '';
  }

  private detectLanguage(text: string) {
    if (!text) return null;
    if (/[\uac00-\ud7af]/u.test(text)) return 'ko';
    if (/[\u3040-\u30ff]/u.test(text)) return 'ja';
    if (/[\u3400-\u9fff]/u.test(text)) return 'zh';
    if (/[\u0600-\u06ff]/u.test(text)) return 'ar';
    if (/[\u0590-\u05ff]/u.test(text)) return 'he';
    if (/[\u0370-\u03ff]/u.test(text)) return 'el';
    if (/[\u0400-\u04ff]/u.test(text)) return 'ru';
    if (/[\u0530-\u058f]/u.test(text)) return 'hy';
    if (/[\u0780-\u07bf]/u.test(text)) return 'dv';
    if (/[\u0900-\u097f]/u.test(text)) return 'hi';
    if (/[\u0980-\u09ff]/u.test(text)) return 'bn';
    if (/[\u0a00-\u0a7f]/u.test(text)) return 'pa';
    if (/[\u0a80-\u0aff]/u.test(text)) return 'gu';
    if (/[\u0b00-\u0b7f]/u.test(text)) return 'or';
    if (/[\u0b80-\u0bff]/u.test(text)) return 'ta';
    if (/[\u0c00-\u0c7f]/u.test(text)) return 'te';
    if (/[\u0c80-\u0cff]/u.test(text)) return 'kn';
    if (/[\u0d00-\u0d7f]/u.test(text)) return 'ml';
    if (/[\u0d80-\u0dff]/u.test(text)) return 'si';
    if (/[\u0e00-\u0e7f]/u.test(text)) return 'th';
    if (/[\u0e80-\u0eff]/u.test(text)) return 'lo';
    if (/[\u0f00-\u0fff]/u.test(text)) return 'bo';
    if (/[\u1000-\u109f]/u.test(text)) return 'my';
    if (/[\u10a0-\u10ff]/u.test(text)) return 'ka';
    if (/[\u1200-\u137f]/u.test(text)) return 'am';
    if (/[\u1780-\u17ff]/u.test(text)) return 'km';
    if (/[\u1800-\u18af]/u.test(text)) return 'mn';
    if (/[ăâđêôơưĂÂĐÊÔƠƯ]/u.test(text)) return 'vi';
    if (/[ğĞıİşŞ]/u.test(text)) return 'tr';
    if (/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/u.test(text)) return 'pl';
    if (/[ăâîșşțţĂÂÎȘŞȚŢ]/u.test(text)) return 'ro';
    if (/[őűŐŰ]/u.test(text)) return 'hu';
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const words = ` ${normalized.replace(/[^a-z0-9\u00df]+/g, ' ')} `;
    const hasAny = (tokens: string[]) => tokens.some((token) => words.includes(` ${token} `));

    if (
      hasAny([
        'kostenlos',
        'kostenlose',
        'fernbedienung',
        'steuerung',
        'klimaanlage',
        'klima',
        'infrarot',
        'testen',
        'starten',
        'nutzen',
        'handy',
        'steuern',
      ]) ||
      /[\u00e4\u00f6\u00fc\u00df]/i.test(text)
    ) {
      return 'de';
    }

    if (
      hasAny([
        'gratuito',
        'gratuita',
        'controle',
        'protecao',
        'escaneamento',
        'tempo',
        'sem',
        'custo',
        'seu',
        'sua',
      ]) ||
      /[\u00e3\u00f5\u00e7]/i.test(text) ||
      /\bgrátis\b/i.test(text)
    ) {
      return 'pt';
    }

    if (
      hasAny([
        'avec',
        'pour',
        'votre',
        'vos',
        'sur',
        'facile',
        'rapide',
        'gratuit',
        'gratuite',
        'telecommande',
        'universelle',
        'climatiseur',
        'climatisation',
        'clim',
        'commande',
        'telephone',
        'mobile',
        'utiliser',
        'controle',
        'controlez',
        'reglez',
        'distance',
        'application',
      ]) ||
      /[\u00e9\u00e8\u00ea\u00eb\u00e0\u00e2\u00ee\u00ef\u00f4\u00fb\u00f9\u00e7]/i.test(text)
    ) {
      return 'fr';
    }

    if (
      hasAny([
        'para',
        'aire',
        'movil',
        'mando',
        'controla',
        'facil',
        'usar',
        'rapido',
        'acondicionado',
        'toque',
      ]) ||
      /[\u00bf\u00a1]/u.test(text)
    ) {
      return 'es';
    }

    return 'en';
  }
}
