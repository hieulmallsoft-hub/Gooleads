CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX app_users_email_unique ON app_users (LOWER(email));

CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'VIEWER'
    CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE google_ads_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id VARCHAR(32) NOT NULL,
  login_customer_id VARCHAR(32),
  display_name VARCHAR(200),
  currency_code VARCHAR(3),
  time_zone VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PAUSED', 'DISCONNECTED')),
  credential_ref TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, customer_id)
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  google_campaign_id VARCHAR(32) NOT NULL,
  resource_name TEXT NOT NULL,
  name VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
  channel_type VARCHAR(80),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, google_campaign_id),
  UNIQUE (account_id, resource_name)
);

CREATE TABLE ad_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  google_ad_group_id VARCHAR(32) NOT NULL,
  resource_name TEXT NOT NULL,
  name VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, google_ad_group_id),
  UNIQUE (campaign_id, resource_name)
);

CREATE TABLE ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_group_id UUID NOT NULL REFERENCES ad_groups(id) ON DELETE CASCADE,
  google_ad_id VARCHAR(32) NOT NULL,
  resource_name TEXT NOT NULL,
  ad_type VARCHAR(100) NOT NULL DEFAULT 'UNKNOWN',
  status VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ad_group_id, google_ad_id),
  UNIQUE (ad_group_id, resource_name)
);

CREATE TABLE media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  storage_provider VARCHAR(50) NOT NULL,
  storage_key TEXT NOT NULL,
  original_name VARCHAR(500),
  mime_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  sha256 VARCHAR(64),
  width_pixels INTEGER CHECK (width_pixels IS NULL OR width_pixels > 0),
  height_pixels INTEGER CHECK (height_pixels IS NULL OR height_pixels > 0),
  duration_seconds NUMERIC(12, 3) CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, storage_provider, storage_key)
);

CREATE INDEX media_files_sha256_idx ON media_files (workspace_id, sha256)
  WHERE sha256 IS NOT NULL;

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  media_file_id UUID REFERENCES media_files(id) ON DELETE SET NULL,
  google_asset_id VARCHAR(32) NOT NULL,
  resource_name TEXT NOT NULL,
  asset_type VARCHAR(100) NOT NULL,
  name VARCHAR(500),
  text_content TEXT,
  language_code VARCHAR(35),
  image_url TEXT,
  image_width INTEGER CHECK (image_width IS NULL OR image_width > 0),
  image_height INTEGER CHECK (image_height IS NULL OR image_height > 0),
  youtube_video_id VARCHAR(100),
  content_hash VARCHAR(128),
  source VARCHAR(30) NOT NULL DEFAULT 'GOOGLE_ADS'
    CHECK (source IN ('GOOGLE_ADS', 'UPLOAD', 'AI', 'IMPORT')),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, google_asset_id),
  UNIQUE (account_id, resource_name)
);

CREATE INDEX assets_language_type_idx ON assets (account_id, language_code, asset_type);
CREATE INDEX assets_content_hash_idx ON assets (account_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE TABLE ad_asset_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  google_view_resource_name TEXT,
  field_type VARCHAR(100) NOT NULL,
  occurrence_index INTEGER NOT NULL DEFAULT 0 CHECK (occurrence_index >= 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  performance_label VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (performance_label IN ('UNSPECIFIED', 'UNKNOWN', 'PENDING', 'LEARNING', 'LOW', 'GOOD', 'BEST')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ad_id, asset_id, field_type, occurrence_index)
);

CREATE UNIQUE INDEX ad_asset_links_view_resource_unique
  ON ad_asset_links (google_view_resource_name)
  WHERE google_view_resource_name IS NOT NULL;
CREATE INDEX ad_asset_links_review_idx
  ON ad_asset_links (performance_label, enabled, field_type);

CREATE TABLE sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  scope VARCHAR(50) NOT NULL
    CHECK (scope IN ('ACCOUNT', 'CAMPAIGNS', 'AD_GROUPS', 'ADS', 'ASSETS', 'METRICS', 'FULL')),
  range_start DATE,
  range_end DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED')),
  rows_read INTEGER NOT NULL DEFAULT 0 CHECK (rows_read >= 0),
  rows_written INTEGER NOT NULL DEFAULT 0 CHECK (rows_written >= 0),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (range_end IS NULL OR range_start IS NULL OR range_end >= range_start)
);

CREATE INDEX sync_runs_account_status_idx ON sync_runs (account_id, status, started_at DESC);

CREATE TABLE campaign_daily_metrics (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
  impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  cost_micros BIGINT NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
  conversions NUMERIC(20, 6) NOT NULL DEFAULT 0,
  conversion_value NUMERIC(24, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, metric_date)
);

CREATE TABLE ad_group_daily_metrics (
  ad_group_id UUID NOT NULL REFERENCES ad_groups(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
  impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  cost_micros BIGINT NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
  conversions NUMERIC(20, 6) NOT NULL DEFAULT 0,
  conversion_value NUMERIC(24, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ad_group_id, metric_date)
);

CREATE TABLE ad_asset_daily_metrics (
  ad_asset_link_id UUID NOT NULL REFERENCES ad_asset_links(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
  performance_label VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
    CHECK (performance_label IN ('UNSPECIFIED', 'UNKNOWN', 'PENDING', 'LEARNING', 'LOW', 'GOOD', 'BEST')),
  impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  cost_micros BIGINT NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
  conversions NUMERIC(20, 6) NOT NULL DEFAULT 0,
  conversion_value NUMERIC(24, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ad_asset_link_id, metric_date)
);

CREATE INDEX campaign_daily_metrics_date_idx ON campaign_daily_metrics (metric_date);
CREATE INDEX ad_group_daily_metrics_date_idx ON ad_group_daily_metrics (metric_date);
CREATE INDEX ad_asset_daily_metrics_review_idx
  ON ad_asset_daily_metrics (metric_date, performance_label, impressions);

CREATE TABLE creative_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  selection_strategy VARCHAR(50) NOT NULL DEFAULT 'PERFORMANCE_LABEL'
    CHECK (selection_strategy IN ('PERFORMANCE_LABEL', 'METRICS', 'HYBRID')),
  selection_criteria JSONB NOT NULL DEFAULT '{"targetLabels":["LOW"]}'::JSONB,
  language_strategy VARCHAR(50) NOT NULL DEFAULT 'DETECT_FROM_ASSET'
    CHECK (language_strategy IN ('DETECT_FROM_ASSET', 'FIXED', 'AD_GROUP_DEFAULT')),
  target_language VARCHAR(35),
  headline_max_length SMALLINT NOT NULL DEFAULT 30 CHECK (headline_max_length > 0),
  description_max_length SMALLINT NOT NULL DEFAULT 90 CHECK (description_max_length > 0),
  approval_mode VARCHAR(30) NOT NULL DEFAULT 'MANUAL'
    CHECK (approval_mode IN ('MANUAL', 'AUTO')),
  review_interval_days SMALLINT NOT NULL DEFAULT 14 CHECK (review_interval_days > 0),
  minimum_impressions BIGINT NOT NULL DEFAULT 0 CHECK (minimum_impressions >= 0),
  minimum_clicks BIGINT NOT NULL DEFAULT 0 CHECK (minimum_clicks >= 0),
  cooldown_days SMALLINT NOT NULL DEFAULT 14 CHECK (cooldown_days >= 0),
  max_changes_per_run SMALLINT NOT NULL DEFAULT 10 CHECK (max_changes_per_run > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, name, version),
  CHECK (language_strategy <> 'FIXED' OR target_language IS NOT NULL)
);

CREATE TABLE creative_policy_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES creative_policies(id) ON DELETE CASCADE,
  account_id UUID REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(account_id, campaign_id, ad_group_id) = 1)
);

CREATE UNIQUE INDEX creative_policy_scope_account_unique
  ON creative_policy_scopes (policy_id, account_id) WHERE account_id IS NOT NULL;
CREATE UNIQUE INDEX creative_policy_scope_campaign_unique
  ON creative_policy_scopes (policy_id, campaign_id) WHERE campaign_id IS NOT NULL;
CREATE UNIQUE INDEX creative_policy_scope_ad_group_unique
  ON creative_policy_scopes (policy_id, ad_group_id) WHERE ad_group_id IS NOT NULL;

CREATE TABLE creative_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES creative_policies(id) ON DELETE CASCADE,
  term_type VARCHAR(40) NOT NULL
    CHECK (term_type IN ('KEYWORD', 'NEGATIVE_KEYWORD', 'BRAND_TERM', 'CTA', 'PROHIBITED_CLAIM')),
  language_code VARCHAR(35) NOT NULL,
  term TEXT NOT NULL,
  weight NUMERIC(8, 4) NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX creative_terms_unique
  ON creative_terms (policy_id, term_type, language_code, LOWER(term));

CREATE TABLE creative_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES creative_policies(id) ON DELETE CASCADE,
  ad_asset_link_id UUID REFERENCES ad_asset_links(id) ON DELETE SET NULL,
  example_type VARCHAR(40) NOT NULL
    CHECK (example_type IN ('WINNER', 'APPROVED', 'REJECTED', 'MANUAL_REFERENCE')),
  field_type VARCHAR(100),
  language_code VARCHAR(35),
  content TEXT NOT NULL,
  performance_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX creative_examples_lookup_idx
  ON creative_examples (policy_id, language_code, example_type, active);

CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  template_key VARCHAR(100) NOT NULL,
  feature VARCHAR(80) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  template TEXT NOT NULL,
  response_schema JSONB NOT NULL DEFAULT '{}'::JSONB,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX prompt_templates_global_unique
  ON prompt_templates (template_key, provider, version) WHERE workspace_id IS NULL;
CREATE UNIQUE INDEX prompt_templates_workspace_unique
  ON prompt_templates (workspace_id, template_key, provider, version)
  WHERE workspace_id IS NOT NULL;

CREATE TABLE ai_review_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES creative_policies(id) ON DELETE SET NULL,
  prompt_template_id UUID REFERENCES prompt_templates(id) ON DELETE SET NULL,
  triggered_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  trigger_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL'
    CHECK (trigger_type IN ('MANUAL', 'SCHEDULED', 'API')),
  provider VARCHAR(40) NOT NULL,
  model VARCHAR(100) NOT NULL,
  requested_time_range VARCHAR(50),
  range_start DATE,
  range_end DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED')),
  input_context JSONB NOT NULL DEFAULT '{}'::JSONB,
  raw_response JSONB,
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  estimated_cost NUMERIC(16, 8) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (range_end IS NULL OR range_start IS NULL OR range_end >= range_start)
);

CREATE INDEX ai_review_runs_scope_idx
  ON ai_review_runs (account_id, ad_group_id, started_at DESC);

CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_run_id UUID NOT NULL REFERENCES ai_review_runs(id) ON DELETE CASCADE,
  ad_asset_link_id UUID REFERENCES ad_asset_links(id) ON DELETE SET NULL,
  suggestion_type VARCHAR(40) NOT NULL
    CHECK (suggestion_type IN ('TEXT', 'IMAGE', 'VIDEO', 'IMAGE_CONCEPT', 'VIDEO_CONCEPT')),
  field_type VARCHAR(100),
  language_code VARCHAR(35),
  current_content JSONB NOT NULL DEFAULT '{}'::JSONB,
  rationale TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
  priority VARCHAR(30) NOT NULL DEFAULT 'TEST'
    CHECK (priority IN ('FIX_FIRST', 'IMPROVE', 'TEST', 'SCALE')),
  confidence NUMERIC(5, 4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'APPLYING', 'APPLIED', 'FAILED', 'EXPIRED')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_suggestions_queue_idx ON ai_suggestions (status, priority, created_at);
CREATE INDEX ai_suggestions_asset_idx ON ai_suggestions (ad_asset_link_id, created_at DESC);

CREATE TABLE ai_suggestion_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES ai_suggestions(id) ON DELETE CASCADE,
  rank SMALLINT NOT NULL CHECK (rank > 0),
  content JSONB NOT NULL,
  character_count INTEGER CHECK (character_count IS NULL OR character_count >= 0),
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (suggestion_id, rank)
);

CREATE UNIQUE INDEX ai_suggestion_variants_one_selected
  ON ai_suggestion_variants (suggestion_id) WHERE selected = TRUE;

CREATE TABLE ai_suggestion_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES ai_suggestions(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES ai_suggestion_variants(id) ON DELETE SET NULL,
  decided_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL
    CHECK (action IN ('APPROVE', 'REJECT', 'EDIT', 'UNAPPROVE')),
  edited_content JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_suggestion_decisions_history_idx
  ON ai_suggestion_decisions (suggestion_id, created_at DESC);

CREATE TABLE change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  ad_group_id UUID REFERENCES ad_groups(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  source VARCHAR(30) NOT NULL
    CHECK (source IN ('MANUAL', 'AI_APPROVED', 'AUTOMATION', 'API')),
  idempotency_key VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'APPLYING', 'APPLIED', 'PARTIAL', 'FAILED', 'CANCELLED')),
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE TABLE change_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  suggestion_id UUID REFERENCES ai_suggestions(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES ai_suggestion_variants(id) ON DELETE SET NULL,
  ad_asset_link_id UUID REFERENCES ad_asset_links(id) ON DELETE SET NULL,
  change_type VARCHAR(40) NOT NULL
    CHECK (change_type IN ('TEXT_REPLACE', 'MEDIA_REPLACE', 'ASSET_DISABLE', 'ASSET_ENABLE')),
  media_type VARCHAR(30),
  before_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  after_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  old_asset_resource_name TEXT,
  new_asset_resource_name TEXT,
  old_ad_resource_name TEXT,
  new_ad_resource_name TEXT,
  replacement_count INTEGER NOT NULL DEFAULT 0 CHECK (replacement_count >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPLYING', 'APPLIED', 'SKIPPED', 'FAILED')),
  error_code VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX change_items_request_status_idx ON change_items (change_request_id, status);
CREATE INDEX change_items_asset_history_idx ON change_items (ad_asset_link_id, created_at DESC);

CREATE TABLE automation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES creative_policies(id) ON DELETE CASCADE,
  timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  interval_days SMALLINT NOT NULL DEFAULT 14 CHECK (interval_days > 0),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_id)
);

CREATE INDEX automation_schedules_due_idx
  ON automation_schedules (next_run_at) WHERE enabled = TRUE;

CREATE TABLE automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES automation_schedules(id) ON DELETE CASCADE,
  review_run_id UUID REFERENCES ai_review_runs(id) ON DELETE SET NULL,
  change_request_id UUID REFERENCES change_requests(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'SKIPPED')),
  selected_count INTEGER NOT NULL DEFAULT 0 CHECK (selected_count >= 0),
  applied_count INTEGER NOT NULL DEFAULT 0 CHECK (applied_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  scheduled_for TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE automation_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_run_id UUID NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
  ad_asset_link_id UUID REFERENCES ad_asset_links(id) ON DELETE SET NULL,
  suggestion_id UUID REFERENCES ai_suggestions(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL
    CHECK (action IN ('SELECTED', 'SUGGESTED', 'APPLIED', 'SKIPPED', 'FAILED')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX automation_run_items_run_idx ON automation_run_items (automation_run_id, action);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id TEXT,
  before_payload JSONB,
  after_payload JSONB,
  correlation_id VARCHAR(200),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_entity_idx ON audit_logs (workspace_id, entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_correlation_idx ON audit_logs (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE TABLE user_preferences (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  selected_account_id UUID REFERENCES google_ads_accounts(id) ON DELETE SET NULL,
  selected_ad_group_id UUID REFERENCES ad_groups(id) ON DELETE SET NULL,
  preferences JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_id)
);

CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'workspaces', 'app_users', 'google_ads_accounts', 'campaigns', 'ad_groups',
    'ads', 'media_files', 'assets', 'ad_asset_links', 'campaign_daily_metrics',
    'ad_group_daily_metrics', 'ad_asset_daily_metrics', 'creative_policies',
    'creative_terms', 'creative_examples', 'prompt_templates', 'ai_suggestions',
    'change_requests', 'change_items', 'automation_schedules', 'user_preferences'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_row_updated_at()',
      table_name,
      table_name
    );
  END LOOP;
END;
$$;
