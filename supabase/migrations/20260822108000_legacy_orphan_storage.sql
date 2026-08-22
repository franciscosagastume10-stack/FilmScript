-- Two unreferenced profile avatars remain in the complete legacy S3 inventory
-- as a byte-identical pair. Preserve both objects and their original source
-- evidence without inventing an owner or exposing their live legacy paths.
-- No other orphan object class is approved.

create table private.legacy_orphan_storage (
  id text primary key,
  source_bucket text not null,
  source_key text not null unique,
  duplicate_of_source_key text not null,
  target_bucket text not null,
  target_path text not null unique,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  reason text not null,
  source_inventory jsonb not null,
  imported_at timestamptz not null,
  constraint legacy_orphan_storage_id_not_blank check (btrim(id) <> ''),
  constraint legacy_orphan_storage_source_bucket check (
    source_bucket = 'filmscript-production-mediabucket-xzgdb1rat94u'
  ),
  constraint legacy_orphan_storage_profile_avatar_key check (
    source_key in (
      'filmscript/canvas/profiles/avatar_4cd220be9504b805.webp',
      'filmscript/canvas/profiles/avatar_68db05ce1a0181a2.webp'
    )
    and duplicate_of_source_key in (
      'filmscript/canvas/profiles/avatar_4cd220be9504b805.webp',
      'filmscript/canvas/profiles/avatar_68db05ce1a0181a2.webp'
    )
    and source_key <> duplicate_of_source_key
  ),
  constraint legacy_orphan_storage_private_target check (
    target_bucket = 'filmscript-private'
    and target_path = 'migration-quarantine/' || id || '/' || regexp_replace(source_key, '^.*/', '')
  ),
  constraint legacy_orphan_storage_content_type_not_blank check (btrim(content_type) <> ''),
  constraint legacy_orphan_storage_reviewed_bytes check (size_bytes = 29218),
  constraint legacy_orphan_storage_reviewed_sha256 check (
    sha256 = '44ed0e9bd1bd7a518f4db1523266a5d647cfc7d6dc3a5e6729dea29c7a75e10b'
  ),
  constraint legacy_orphan_storage_reason check (reason = 'unreferenced_byte_duplicate_avatar'),
  constraint legacy_orphan_storage_inventory_object check (jsonb_typeof(source_inventory) = 'object')
);

comment on table private.legacy_orphan_storage is
  'Service-only evidence and Storage reconciliation contract for unreferenced legacy profile avatars proven byte-identical to another quarantined object. Rows never authorize browser access.';

revoke all on table private.legacy_orphan_storage from public, anon, authenticated;
grant all on table private.legacy_orphan_storage to service_role;
