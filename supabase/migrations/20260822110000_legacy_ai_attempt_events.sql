-- SQLite records one provider/model event for every chunk executed inside an
-- AI job attempt. Several events can therefore share the same job and attempt
-- number; their stable ids and timestamps are the authoritative event order.

alter table private.ai_job_attempts
  drop constraint if exists ai_job_attempts_job_id_attempt_number_key;

comment on table private.ai_job_attempts is
  'Provider/model audit events. Multiple events may share a job and attempt number; ids and created_at preserve the legacy history. Intentionally unavailable through the browser Data API.';
