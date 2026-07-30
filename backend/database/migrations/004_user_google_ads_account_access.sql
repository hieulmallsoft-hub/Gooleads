CREATE TABLE IF NOT EXISTS user_google_ads_account_access (
  user_id UUID NOT NULL,
  customer_id VARCHAR(32) NOT NULL,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, customer_id)
);

CREATE INDEX IF NOT EXISTS user_google_ads_account_access_customer_idx
  ON user_google_ads_account_access (customer_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_google_ads_account_access_user_fk'
  ) THEN
    ALTER TABLE user_google_ads_account_access
      ADD CONSTRAINT user_google_ads_account_access_user_fk
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_google_ads_account_access_granted_by_fk'
  ) THEN
    ALTER TABLE user_google_ads_account_access
      ADD CONSTRAINT user_google_ads_account_access_granted_by_fk
      FOREIGN KEY (granted_by) REFERENCES app_users(id) ON DELETE SET NULL;
  END IF;
END
$$;

INSERT INTO user_google_ads_account_access (user_id, customer_id, granted_by, granted_at)
SELECT
  user_id,
  customer_id,
  MAX(granted_by::text)::uuid,
  MIN(granted_at)
FROM user_campaign_access
GROUP BY user_id, customer_id
ON CONFLICT (user_id, customer_id) DO NOTHING;
