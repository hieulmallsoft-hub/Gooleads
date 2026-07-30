export type UpdateCreativeSettingsDto = {
  languageStrategy?: string;
  targetLanguage?: string | null;
  targetLabels?: string[];
  approvalMode?: string;
  minimumImpressions?: number;
  minimumClicks?: number;
  reviewIntervalDays?: number;
  cooldownDays?: number;
  maxChangesPerRun?: number;
  automationEnabled?: boolean;
};
