CREATE TABLE IF NOT EXISTS campaign_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  name VARCHAR(120) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#1a73e8',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_groups_account_name_unique
  ON campaign_groups (account_id, name);

CREATE TABLE IF NOT EXISTS campaign_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  google_campaign_id VARCHAR(32) NOT NULL,
  campaign_name VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_group_members_group_campaign_unique
  ON campaign_group_members (group_id, google_campaign_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_groups_account_fk'
  ) THEN
    ALTER TABLE campaign_groups
      ADD CONSTRAINT campaign_groups_account_fk
      FOREIGN KEY (account_id) REFERENCES google_ads_accounts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_group_members_group_fk'
  ) THEN
    ALTER TABLE campaign_group_members
      ADD CONSTRAINT campaign_group_members_group_fk
      FOREIGN KEY (group_id) REFERENCES campaign_groups(id) ON DELETE CASCADE;
  END IF;
END
$$;
