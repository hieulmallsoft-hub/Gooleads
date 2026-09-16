ALTER TABLE automation_run_items
  DROP CONSTRAINT IF EXISTS automation_run_items_action_check;

ALTER TABLE automation_run_items
  ADD CONSTRAINT automation_run_items_action_check
  CHECK (action IN (
    'SELECTED',
    'SUGGESTED',
    'APPLIED',
    'SKIPPED',
    'FAILED',
    'PAUSED',
    'PROMPT',
    'SYNC_STARTED',
    'SYNC_COMPLETED',
    'INPUT_SNAPSHOT',
    'AI_REQUEST',
    'AI_RESPONSE',
    'AI_VALIDATION',
    'APPLY_RESULT'
  ));

COMMENT ON COLUMN automation_run_items.action IS
  'Các bước và kết quả được lưu trong nhật ký của từng lần chạy Automation.';
