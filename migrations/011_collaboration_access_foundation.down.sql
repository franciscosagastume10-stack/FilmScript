DROP TABLE IF EXISTS project_guest_sessions;
DROP TABLE IF EXISTS project_states;
DROP INDEX IF EXISTS project_memberships_single_owner_idx;

CREATE TABLE project_invitations_rollback AS
  SELECT id, project_id, invited_user_id, invited_username, invited_email, token_hash,
    project_role, cinematic_role, permission_snapshot_json, status, expires_at,
    created_by_user_id, created_at, updated_at
  FROM project_invitations;
DROP TABLE project_invitations;
ALTER TABLE project_invitations_rollback RENAME TO project_invitations;

CREATE TABLE project_memberships_rollback AS
  SELECT id, project_id, user_id, guest_id, project_role, cinematic_role,
    module_permissions_json, financial_permissions_json, financial_department_ids_json,
    status, invited_by_user_id, version, created_at, updated_at
  FROM project_memberships;
DROP TABLE project_memberships;
ALTER TABLE project_memberships_rollback RENAME TO project_memberships;

CREATE UNIQUE INDEX IF NOT EXISTS project_memberships_user_project_idx
  ON project_memberships(project_id, user_id);
CREATE INDEX IF NOT EXISTS project_memberships_user_idx
  ON project_memberships(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS project_memberships_project_idx
  ON project_memberships(project_id, status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS project_invitations_token_idx
  ON project_invitations(token_hash);
CREATE INDEX IF NOT EXISTS project_invitations_target_idx
  ON project_invitations(invited_user_id, invited_email, status);
CREATE INDEX IF NOT EXISTS project_invitations_project_idx
  ON project_invitations(project_id, status, created_at DESC);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '10');
