ALTER TABLE creative_terms
  ADD COLUMN IF NOT EXISTS market_code VARCHAR(16),
  ADD COLUMN IF NOT EXISTS scope_level VARCHAR(20) NOT NULL DEFAULT 'ACCOUNT',
  ADD COLUMN IF NOT EXISTS google_campaign_id VARCHAR(32),
  ADD COLUMN IF NOT EXISTS google_ad_group_id VARCHAR(32);

ALTER TABLE creative_terms
  DROP CONSTRAINT IF EXISTS creative_terms_scope_level_check;

ALTER TABLE creative_terms
  ADD CONSTRAINT creative_terms_scope_level_check
  CHECK (scope_level IN ('ACCOUNT', 'CAMPAIGN', 'AD_GROUP'));

DROP INDEX IF EXISTS creative_terms_unique;

CREATE UNIQUE INDEX IF NOT EXISTS creative_terms_scope_unique
  ON creative_terms (
    policy_id,
    term_type,
    language_code,
    COALESCE(market_code, ''),
    scope_level,
    COALESCE(google_campaign_id, ''),
    COALESCE(google_ad_group_id, ''),
    LOWER(term)
  );
