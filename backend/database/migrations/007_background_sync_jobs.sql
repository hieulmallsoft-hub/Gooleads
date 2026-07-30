CREATE TABLE IF NOT EXISTS sync_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  requested_by UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL,
  time_range VARCHAR(50) NOT NULL,
  targets JSONB NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  current_ad_group_id VARCHAR(50),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_batch_jobs_account_created
  ON sync_batch_jobs (account_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_batch_jobs_one_active_per_account
  ON sync_batch_jobs (account_id)
  WHERE status IN ('PENDING', 'RUNNING');

CREATE INDEX IF NOT EXISTS idx_ad_group_daily_metrics_impact
  ON ad_group_daily_metrics (ad_group_id, metric_date);

CREATE INDEX IF NOT EXISTS idx_change_requests_account_applied
  ON change_requests (account_id, completed_at DESC)
  WHERE status = 'APPLIED';
