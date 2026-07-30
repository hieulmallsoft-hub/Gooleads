ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_users_status_check'
  ) THEN
    ALTER TABLE app_users DROP CONSTRAINT app_users_status_check;
  END IF;

  ALTER TABLE app_users
    ADD CONSTRAINT app_users_status_check
    CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED'));
END
$$;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_unique
  ON auth_sessions (token_hash);

CREATE INDEX IF NOT EXISTS auth_sessions_user_expires_idx
  ON auth_sessions (user_id, expires_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'auth_sessions_user_fk'
  ) THEN
    ALTER TABLE auth_sessions
      ADD CONSTRAINT auth_sessions_user_fk
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS user_campaign_access (
  user_id UUID NOT NULL,
  customer_id VARCHAR(32) NOT NULL,
  google_campaign_id VARCHAR(32) NOT NULL,
  campaign_name VARCHAR(500),
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, customer_id, google_campaign_id)
);

CREATE INDEX IF NOT EXISTS user_campaign_access_customer_campaign_idx
  ON user_campaign_access (customer_id, google_campaign_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_campaign_access_user_fk'
  ) THEN
    ALTER TABLE user_campaign_access
      ADD CONSTRAINT user_campaign_access_user_fk
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_campaign_access_granted_by_fk'
  ) THEN
    ALTER TABLE user_campaign_access
      ADD CONSTRAINT user_campaign_access_granted_by_fk
      FOREIGN KEY (granted_by) REFERENCES app_users(id) ON DELETE SET NULL;
  END IF;
END
$$;
