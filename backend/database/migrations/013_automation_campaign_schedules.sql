ALTER TABLE creative_policy_scopes
  ADD COLUMN IF NOT EXISTS interval_days SMALLINT,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;

UPDATE creative_policy_scopes scope
SET interval_days = COALESCE(schedule.interval_days, policy.review_interval_days, 14),
    next_run_at = CASE
      WHEN schedule.enabled THEN COALESCE(schedule.next_run_at, NOW() + (COALESCE(schedule.interval_days, policy.review_interval_days, 14) * INTERVAL '1 day'))
      ELSE NULL
    END
FROM creative_policies policy
LEFT JOIN automation_schedules schedule ON schedule.policy_id = policy.id
WHERE scope.policy_id = policy.id
  AND scope.campaign_id IS NOT NULL
  AND scope.interval_days IS NULL;

ALTER TABLE creative_policy_scopes
  ADD CONSTRAINT creative_policy_scopes_interval_days_check
  CHECK (interval_days IS NULL OR interval_days BETWEEN 1 AND 365);

CREATE INDEX IF NOT EXISTS creative_policy_scopes_campaign_due_idx
  ON creative_policy_scopes (next_run_at)
  WHERE campaign_id IS NOT NULL AND next_run_at IS NOT NULL;
