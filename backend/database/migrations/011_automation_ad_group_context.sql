ALTER TABLE creative_policy_scopes
  ADD COLUMN IF NOT EXISTS language_code VARCHAR(16),
  ADD COLUMN IF NOT EXISTS ad_group_topic VARCHAR(500);
