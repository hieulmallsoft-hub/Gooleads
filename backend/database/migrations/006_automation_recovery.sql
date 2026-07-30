ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

UPDATE automation_runs
SET last_heartbeat_at = COALESCE(completed_at, started_at)
WHERE last_heartbeat_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_change_requests_stale_applying
  ON change_requests (started_at)
  WHERE status = 'APPLYING';

CREATE INDEX IF NOT EXISTS idx_automation_runs_running_heartbeat
  ON automation_runs (last_heartbeat_at)
  WHERE status = 'RUNNING';
