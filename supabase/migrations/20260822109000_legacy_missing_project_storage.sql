-- A reviewed legacy Canvas prefix has no surviving project and no reference in
-- the normalized source graph. Keep its exact objects as service-only evidence;
-- never infer an owner or authorize the original paths.

alter table private.legacy_orphan_storage
  alter column duplicate_of_source_key drop not null,
  drop constraint legacy_orphan_storage_profile_avatar_key,
  drop constraint legacy_orphan_storage_reviewed_bytes,
  drop constraint legacy_orphan_storage_reviewed_sha256,
  drop constraint legacy_orphan_storage_reason;

alter table private.legacy_orphan_storage
  add constraint legacy_orphan_storage_reviewed_class check (
    (
      reason = 'unreferenced_byte_duplicate_avatar'
      and source_key in (
        'filmscript/canvas/profiles/avatar_4cd220be9504b805.webp',
        'filmscript/canvas/profiles/avatar_68db05ce1a0181a2.webp'
      )
      and duplicate_of_source_key in (
        'filmscript/canvas/profiles/avatar_4cd220be9504b805.webp',
        'filmscript/canvas/profiles/avatar_68db05ce1a0181a2.webp'
      )
      and source_key <> duplicate_of_source_key
      and size_bytes = 29218
      and sha256 = '44ed0e9bd1bd7a518f4db1523266a5d647cfc7d6dc3a5e6729dea29c7a75e10b'
    )
    or
    (
      reason = 'unreferenced_missing_project_prefix'
      and (
        source_key like 'filmscript/canvas/scr_c38477536398e2486704/%'
        or source_key = 'filmscript/shot-references/scr_c38477536398e2486704/ref_2b308c5391fd5222172590d3.png'
      )
      and duplicate_of_source_key is null
    )
  );

comment on table private.legacy_orphan_storage is
  'Service-only evidence and Storage reconciliation contract for two exact reviewed orphan classes: a byte-identical unreferenced avatar pair and an exact unreferenced missing-project Canvas prefix. Rows never authorize browser access or retain a live target path.';
