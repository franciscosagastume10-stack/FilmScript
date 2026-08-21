-- Chat shipped after databases already using schema version 14. Keep this
-- migration independent of the earlier 013 filename so every production
-- database receives the table before the first chat request.
CREATE TABLE IF NOT EXISTS project_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS project_messages_thread_idx
  ON project_messages(project_id, sender_user_id, recipient_user_id, created_at);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '15');
