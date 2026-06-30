export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
export const DEFAULT_CUSTOMER_IDS = ['9920642691'];
export const CUSTOMER_STORAGE_KEY = 'ggads.customerIds';
export const AD_GROUP_STORAGE_KEY = 'ggads.adGroupIds';
export const AUTO_AI_STORAGE_KEY = 'ggads.autoAiByCustomer';
export const PAGE_SIZE = 10;
export const HEADLINE_MAX_LENGTH = 30;
export const DESCRIPTION_MAX_LENGTH = 90;
export const IMAGE_RATIO_TOLERANCE = 0.01;

export const configuredCustomerIds: string[] = import.meta.env.VITE_CUSTOMER_IDS
  ? String(import.meta.env.VITE_CUSTOMER_IDS)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  : DEFAULT_CUSTOMER_IDS;

export const TIME_OPTIONS = [
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'THIS_MONTH', label: 'This month' },
];
