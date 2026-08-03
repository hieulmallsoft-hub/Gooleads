ALTER TABLE creative_policy_scopes
  ADD COLUMN IF NOT EXISTS include_all_ad_groups BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN creative_policy_scopes.include_all_ad_groups IS
  'When true on a campaign scope, Automation targets every enabled ad group in that campaign.';
