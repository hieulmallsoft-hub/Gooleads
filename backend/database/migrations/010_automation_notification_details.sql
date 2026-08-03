ALTER TABLE automation_run_items
  ADD COLUMN IF NOT EXISTS change_request_id UUID NULL REFERENCES change_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_snapshot JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_automation_run_items_change_request
  ON automation_run_items(change_request_id)
  WHERE change_request_id IS NOT NULL;
