ALTER TABLE project_memberships ADD COLUMN department_ids_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE project_invitations ADD COLUMN revoked_at TEXT;
ALTER TABLE project_invitations ADD COLUMN declined_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS project_memberships_single_owner_idx
  ON project_memberships(project_id)
  WHERE project_role = 'owner' AND status = 'active';

CREATE TABLE IF NOT EXISTS project_guest_sessions (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES project_invitations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_guest_sessions_invitation_idx
  ON project_guest_sessions(invitation_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS project_states (
  project_id TEXT PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
  archived_at TEXT,
  archived_by_user_id TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL
);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '11');
