CREATE TABLE IF NOT EXISTS account_imaging_generations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  lease_token TEXT,
  lease_expires_at TEXT,
  asset_id TEXT,
  result_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS account_imaging_generations_status_idx
  ON account_imaging_generations(status, lease_expires_at);

INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '19');
