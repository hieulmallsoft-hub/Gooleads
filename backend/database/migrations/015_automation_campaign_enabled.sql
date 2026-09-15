ALTER TABLE creative_policy_scopes
  ADD COLUMN IF NOT EXISTS automation_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN creative_policy_scopes.automation_enabled IS
  'Cho phép bật hoặc dừng lịch Automation riêng cho từng chiến dịch.';

CREATE INDEX IF NOT EXISTS creative_policy_scopes_campaign_enabled_due_idx
  ON creative_policy_scopes (automation_enabled, next_run_at)
  WHERE campaign_id IS NOT NULL;
