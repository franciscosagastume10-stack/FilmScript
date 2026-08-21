-- A release notice is claimed once per signed-in account, not once per
-- browser. This makes an update feel like a welcome instead of a recurring
-- interruption when the same person uses FilmScript on several devices.
CREATE TABLE IF NOT EXISTS release_notice_acknowledgements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  release_version TEXT NOT NULL,
  presented_at TEXT NOT NULL,
  acknowledged_at TEXT,
  PRIMARY KEY (user_id, release_version)
);
CREATE INDEX IF NOT EXISTS release_notice_acknowledgements_release_idx
  ON release_notice_acknowledgements(release_version, presented_at DESC);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '16');
