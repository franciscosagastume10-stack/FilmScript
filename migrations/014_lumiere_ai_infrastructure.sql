-- Durable internal audit trail for Lumière job attempts. Model IDs remain
-- server-only and are never returned by the public job representation.
CREATE TABLE IF NOT EXISTS ai_job_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES ai_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  model_id TEXT NOT NULL,
  is_fallback INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_job_attempts_job_idx ON ai_job_attempts(job_id, attempt_number, created_at);
