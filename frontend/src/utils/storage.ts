import {
  AD_GROUP_STORAGE_KEY,
  configuredCustomerIds,
  CUSTOMER_STORAGE_KEY,
} from '../config/googleAds';
import type { CustomerOption } from '../types/googleAds';

export function normalizeNumericId(id: string) {
  return id.replace(/\D/g, '');
}

export function toCustomerOptions(ids: string[]): CustomerOption[] {
  const uniqueIds = Array.from(new Set(ids.map(normalizeNumericId).filter(Boolean)));
  return uniqueIds.map((id) => ({ value: id, label: id }));
}

function getSavedIds(storageKey: string) {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as string[]) : [];
  } catch {
    return [];
  }
}

export function getInitialCustomerOptions() {
  return toCustomerOptions([
    ...configuredCustomerIds,
    ...getSavedIds(CUSTOMER_STORAGE_KEY),
  ]);
}

export function getInitialAdGroupOptions() {
  return toCustomerOptions(getSavedIds(AD_GROUP_STORAGE_KEY));
}
