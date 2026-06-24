export type UpdateCreativeTermDto = {
  termType?: string;
  languageCode?: string;
  marketCode?: string | null;
  scopeLevel?: string;
  googleCampaignId?: string | null;
  googleAdGroupId?: string | null;
  term?: string;
  weight?: number;
  active?: boolean;
};
