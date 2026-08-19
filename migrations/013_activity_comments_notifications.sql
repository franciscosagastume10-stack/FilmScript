ALTER TABLE activity_events ADD COLUMN aggregation_key TEXT;
ALTER TABLE activity_events ADD COLUMN aggregation_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE activity_events ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE activity_events ADD COLUMN updated_at TEXT;
CREATE INDEX IF NOT EXISTS activity_events_aggregation_idx ON activity_events(project_id, aggregation_key, updated_at DESC);

ALTER TABLE notifications ADD COLUMN aggregation_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notifications ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE project_comments ADD COLUMN parent_comment_id TEXT REFERENCES project_comments(id) ON DELETE CASCADE;
ALTER TABLE project_comments ADD COLUMN reopened_at TEXT;

CREATE TABLE IF NOT EXISTS comment_mentions (
  comment_id TEXT NOT NULL REFERENCES project_comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS comment_mentions_user_idx ON comment_mentions(user_id, created_at DESC);

UPDATE activity_events SET updated_at = created_at WHERE updated_at IS NULL;
INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '13');
