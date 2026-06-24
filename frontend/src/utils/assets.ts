import type { Asset } from '../types/googleAds';

export function assetTitle(asset: Asset) {
  return asset.text || asset.name || asset.imageUrl || asset.videoId || asset.id;
}

export function getMediaReplacementType(asset: Asset): 'IMAGE' | 'VIDEO' | '' {
  const type = `${asset.type} ${asset.fieldType}`.toUpperCase();

  if (asset.videoId || type.includes('VIDEO') || type.includes('YOUTUBE')) {
    return 'VIDEO';
  }

  if (asset.imageUrl || type.includes('IMAGE')) {
    return 'IMAGE';
  }

  return '';
}

export function getAssetPreviewUrl(asset: Asset | null) {
  if (!asset) return '';
  if (asset.imageUrl) return asset.imageUrl;
  if (asset.videoId) return `https://img.youtube.com/vi/${asset.videoId}/hqdefault.jpg`;
  return '';
}
