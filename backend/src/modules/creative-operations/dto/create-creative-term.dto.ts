export type CreateCreativeTermDto = {
  customerId?: string;
  termType?: string;
  languageCode?: string;
  marketCode?: string | null;
  scopeLevel?: string;
  googleCampaignId?: string | null;
  googleAdGroupId?: string | null;
  term?: string;
  weight?: number;
};
