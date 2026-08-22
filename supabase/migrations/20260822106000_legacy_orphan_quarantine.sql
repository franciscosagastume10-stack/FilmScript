-- Some legacy collaboration rows outlived their deleted project. They must
-- remain auditable without recreating the project or exposing its private
-- content through public collaboration tables. This service-only quarantine
-- preserves the canonical source row and any snapshot bytes exactly.

create table private.legacy_orphan_records (
  id text primary key,
  source_table text not null,
  source_pk jsonb not null,
  source_project_id text not null,
  reason text not null,
  payload jsonb not null,
  blob_column text,
  blob_payload bytea,
  blob_sha256 text,
  blob_bytes bigint,
  imported_at timestamptz not null,
  constraint legacy_orphan_records_id_not_blank check (btrim(id) <> ''),
  constraint legacy_orphan_records_source_table check (source_table in (
    'collaboration_documents', 'collaboration_entities', 'collaboration_operations', 'content_conflicts'
  )),
  constraint legacy_orphan_records_source_pk_object check (jsonb_typeof(source_pk) = 'object'),
  constraint legacy_orphan_records_project_not_blank check (btrim(source_project_id) <> ''),
  constraint legacy_orphan_records_reason check (
    reason = 'legacy_collaboration_project_missing_from_scripts'
  ),
  constraint legacy_orphan_records_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint legacy_orphan_records_blob_complete check (
    num_nonnulls(blob_column, blob_payload, blob_sha256, blob_bytes) in (0, 4)
  ),
  constraint legacy_orphan_records_blob_sha256 check (
    blob_sha256 is null or blob_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint legacy_orphan_records_blob_bytes check (blob_bytes is null or blob_bytes >= 0)
);

comment on table private.legacy_orphan_records is
  'Service-only migration quarantine for exact legacy rows whose project was already deleted. It is evidence, not live application state, and has no foreign key that can recreate or expose a deleted project.';

revoke all on table private.legacy_orphan_records from public, anon, authenticated;
grant all on table private.legacy_orphan_records to service_role;
