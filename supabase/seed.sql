-- Production data is imported by the audited SQLite/S3 ETL pipeline.
-- Keep local resets empty by default so tests never resemble production data.

-- `supabase db reset` is an isolated local environment. Production never runs
-- this seed and therefore retains the migration's fail-closed false default.
insert into private.runtime_flags (key, enabled)
values ('preview_api_enabled', true)
on conflict (key) do update
set enabled = excluded.enabled,
    updated_at = statement_timestamp();
