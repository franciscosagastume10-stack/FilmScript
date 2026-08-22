CREATE TABLE IF NOT EXISTS account_imaging_asset_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  liked INTEGER NOT NULL DEFAULT 0 CHECK (liked IN (0, 1)),
  liked_at TEXT,
  trashed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, asset_id)
);

CREATE INDEX IF NOT EXISTS account_imaging_asset_state_liked_idx
  ON account_imaging_asset_state(user_id, liked, liked_at DESC);

CREATE INDEX IF NOT EXISTS account_imaging_asset_state_trashed_idx
  ON account_imaging_asset_state(user_id, trashed_at);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '20');
