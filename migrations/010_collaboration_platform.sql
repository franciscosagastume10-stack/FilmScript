ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'filmscript';
ALTER TABLE users ADD COLUMN avatar_key TEXT;
ALTER TABLE users ADD COLUMN avatar_crop_json TEXT NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users(username) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS project_memberships (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  guest_id TEXT,
  project_role TEXT NOT NULL,
  cinematic_role TEXT,
  module_permissions_json TEXT NOT NULL DEFAULT '{}',
  financial_permissions_json TEXT NOT NULL DEFAULT '["financial.no_access"]',
  financial_department_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'invited',
  invited_by_user_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_memberships_user_idx ON project_memberships(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS project_memberships_project_idx ON project_memberships(project_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_invitations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  invited_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  invited_username TEXT,
  invited_email TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  project_role TEXT NOT NULL,
  cinematic_role TEXT,
  permission_snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_invitations_target_idx ON project_invitations(invited_user_id, invited_email, status);
CREATE INDEX IF NOT EXISTS project_invitations_project_idx ON project_invitations(project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS shared_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  access_mode TEXT NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  allowed_emails_json TEXT NOT NULL DEFAULT '[]',
  sections_json TEXT NOT NULL DEFAULT '[]',
  cover_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS shared_projects_project_idx ON shared_projects(project_id, status);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  contains_financial_data INTEGER NOT NULL DEFAULT 0,
  financial_department_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_events_project_idx ON activity_events(project_id, module, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES scripts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  deep_link TEXT,
  contains_financial_data INTEGER NOT NULL DEFAULT 0,
  financial_department_id TEXT,
  aggregation_key TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  requested_by_user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL,
  source_script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  source_script_version_id TEXT NOT NULL,
  source_content_hash TEXT NOT NULL,
  internal_primary_model TEXT NOT NULL,
  internal_completed_model TEXT,
  used_fallback INTEGER NOT NULL DEFAULT 0,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  settled_credits INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  output_schema_version INTEGER NOT NULL DEFAULT 1,
  error_code TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_jobs_user_idx ON ai_jobs(requested_by_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_jobs_project_idx ON ai_jobs(project_id, type, updated_at DESC);

CREATE TABLE IF NOT EXISTS collaboration_operations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  base_version INTEGER NOT NULL,
  committed_version INTEGER NOT NULL,
  operation_type TEXT NOT NULL,
  patch_json TEXT NOT NULL,
  previous_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS collaboration_operations_delta_idx ON collaboration_operations(project_id, document_id, committed_version);

CREATE TABLE IF NOT EXISTS content_conflicts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL REFERENCES collaboration_operations(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  current_value_json TEXT,
  incoming_value_json TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by_user_id TEXT REFERENCES users(id),
  resolution_json TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS location_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS location_plans_project_idx ON location_plans(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  coordinate_json TEXT,
  body TEXT NOT NULL,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  guest_id TEXT,
  resolved_at TEXT,
  resolved_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_comments_entity_idx ON project_comments(project_id, module, entity_id, created_at);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '10');

