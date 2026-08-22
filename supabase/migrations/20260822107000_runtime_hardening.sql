-- Production hardening for the temporary Supabase Preview surface.
--
-- Shared/versioned application state must not be mutated directly through
-- PostgREST. Browser reads remain protected by the existing SELECT policies;
-- writes move to narrow transactional RPCs as their production semantics are
-- implemented.

drop policy if exists scripts_insert_owner on public.scripts;
drop policy if exists scripts_update_editor on public.scripts;
drop policy if exists scripts_delete_owner on public.scripts;

drop policy if exists location_plans_insert_editor on public.location_plans;
drop policy if exists location_plans_update_editor on public.location_plans;
drop policy if exists location_plans_delete_editor on public.location_plans;

drop policy if exists project_comments_insert_commenter on public.project_comments;
drop policy if exists project_comments_update_author on public.project_comments;
drop policy if exists project_comments_delete_author on public.project_comments;

drop policy if exists project_messages_insert_sender on public.project_messages;
drop policy if exists project_messages_mark_read_recipient on public.project_messages;

-- Revoke both table-level and the legacy column-level grants. PostgreSQL does
-- not remove column grants when only table privileges are revoked.
revoke insert, update, delete on table public.scripts from authenticated;
revoke insert (
  id, user_id, title, filename, source, text, blocks, chat, title_room,
  character_names
) on public.scripts from authenticated;
revoke update (
  title, filename, source, text, blocks, chat, title_room, character_names
) on public.scripts from authenticated;

revoke insert, update, delete on table public.location_plans from authenticated;
revoke insert (id, project_id, name, data, version, created_by_user_id)
  on public.location_plans from authenticated;
revoke update (name, data, version)
  on public.location_plans from authenticated;

revoke insert, update, delete on table public.project_comments from authenticated;
revoke insert (
  id, project_id, module, entity_type, entity_id, coordinate, body,
  author_user_id, guest_id, parent_comment_id
) on public.project_comments from authenticated;
revoke update (body, resolved_at, resolved_by_user_id, reopened_at)
  on public.project_comments from authenticated;

revoke insert, update, delete on table public.project_messages from authenticated;
revoke insert (id, project_id, sender_user_id, recipient_user_id, body)
  on public.project_messages from authenticated;
revoke update (read_at) on public.project_messages from authenticated;

-- Runtime flags are deliberately outside PostgREST's exposed schemas and have
-- no browser policy. A missing row and a false row are both fail-closed.
create table private.runtime_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default statement_timestamp(),
  constraint runtime_flags_key_not_blank check (btrim(key) <> '')
);

alter table private.runtime_flags enable row level security;

create trigger runtime_flags_set_updated_at
before update on private.runtime_flags
for each row execute function private.set_updated_at();

insert into private.runtime_flags (key, enabled)
values ('preview_api_enabled', false);

revoke all on table private.runtime_flags from public, anon, authenticated;
grant all on table private.runtime_flags to service_role;

comment on table private.runtime_flags is
  'Service-only runtime kill switches. Flags default off and local-only seeds opt in explicitly.';

create or replace function private.require_runtime_flag(requested_key text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from private.runtime_flags as flag
    where flag.key = requested_key
      and flag.enabled
  ) then
    raise exception 'Supabase Preview API is disabled.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.require_runtime_flag(text)
  from public, anon, authenticated;
grant execute on function private.require_runtime_flag(text) to service_role;

-- Preserve the reviewed Preview implementations behind private, non-exposed
-- names. Public wrappers below enforce the database-side kill switch before
-- any authorization, validation, read, or mutation occurs.
alter function public.preview_create_project(text) set schema private;
alter function private.preview_create_project(text) rename to preview_create_project_impl;
alter function public.preview_claim_verified_legacy_profile() set schema private;
alter function private.preview_claim_verified_legacy_profile()
  rename to preview_claim_verified_legacy_profile_impl;
alter function public.preview_set_project_archived(text, boolean) set schema private;
alter function private.preview_set_project_archived(text, boolean)
  rename to preview_set_project_archived_impl;
alter function public.preview_register_upload(text, text, text, text, text, bigint, text)
  set schema private;
alter function private.preview_register_upload(text, text, text, text, text, bigint, text)
  rename to preview_register_upload_impl;

revoke all on function private.preview_create_project_impl(text)
  from public, anon, authenticated;
revoke all on function private.preview_claim_verified_legacy_profile_impl()
  from public, anon, authenticated;
revoke all on function private.preview_set_project_archived_impl(text, boolean)
  from public, anon, authenticated;
revoke all on function private.preview_register_upload_impl(text, text, text, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function private.preview_create_project_impl(text) to service_role;
grant execute on function private.preview_claim_verified_legacy_profile_impl() to service_role;
grant execute on function private.preview_set_project_archived_impl(text, boolean) to service_role;
grant execute on function private.preview_register_upload_impl(text, text, text, text, text, bigint, text)
  to service_role;

create function public.preview_create_project(
  requested_title text default 'Untitled project'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_runtime_flag('preview_api_enabled');
  return private.preview_create_project_impl(requested_title);
end;
$$;

create function public.preview_claim_verified_legacy_profile()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_runtime_flag('preview_api_enabled');
  return private.preview_claim_verified_legacy_profile_impl();
end;
$$;

create function public.preview_set_project_archived(
  requested_project_id text,
  requested_archived boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_runtime_flag('preview_api_enabled');
  return private.preview_set_project_archived_impl(
    requested_project_id,
    requested_archived
  );
end;
$$;

create function public.preview_register_upload(
  requested_project_id text,
  requested_media_id text,
  requested_object_path text,
  requested_original_filename text,
  requested_mime_type text,
  requested_size_bytes bigint,
  requested_sha256 text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_runtime_flag('preview_api_enabled');
  return private.preview_register_upload_impl(
    requested_project_id,
    requested_media_id,
    requested_object_path,
    requested_original_filename,
    requested_mime_type,
    requested_size_bytes,
    requested_sha256
  );
end;
$$;

-- The only authenticated screenplay mutation retained for Preview. Document
-- changes require the exact updated_at observed by the caller; the comparison
-- and update occur in one statement. Title-only changes preserve the legacy
-- endpoint contract and do not require a document version.
create function public.preview_update_project_document(
  requested_project_id text,
  requested_expected_updated_at timestamptz,
  requested_patch jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  app_user_id text;
  changes_document boolean;
  changed_script public.scripts%rowtype;
begin
  perform private.require_runtime_flag('preview_api_enabled');
  app_user_id := public.current_app_user_id();

  if (select auth.uid()) is null or app_user_id is null then
    raise exception 'A linked FilmScript profile is required.' using errcode = '42501';
  end if;
  if not public.has_project_permission(requested_project_id, 'script', 'edit') then
    raise exception 'Script edit permission is required.' using errcode = '42501';
  end if;
  if requested_patch is null or jsonb_typeof(requested_patch) <> 'object'
    or requested_patch = '{}'::jsonb then
    raise exception 'A non-empty project patch is required.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(requested_patch) as key(name)
    where key.name not in (
      'title', 'blocks', 'chat', 'title_room', 'character_names'
    )
  ) then
    raise exception 'The project patch contains an unsupported field.' using errcode = '22023';
  end if;
  if octet_length(requested_patch::text) > 8388608 then
    raise exception 'The project patch is too large.' using errcode = '22023';
  end if;

  changes_document := requested_patch ?| array[
    'blocks', 'chat', 'title_room', 'character_names'
  ];
  if changes_document and requested_expected_updated_at is null then
    raise exception 'The current project version is required.' using errcode = '22023';
  end if;

  if requested_patch ? 'title' and (
    jsonb_typeof(requested_patch -> 'title') <> 'string'
    or nullif(btrim(requested_patch ->> 'title'), '') is null
    or char_length(requested_patch ->> 'title') > 160
  ) then
    raise exception 'The project title is invalid.' using errcode = '22023';
  end if;
  if requested_patch ? 'blocks'
    and jsonb_typeof(requested_patch -> 'blocks') <> 'array' then
    raise exception 'Screenplay blocks must be an array.' using errcode = '22023';
  end if;
  if requested_patch ? 'chat' and (
    jsonb_typeof(requested_patch -> 'chat') <> 'array'
    or jsonb_array_length(requested_patch -> 'chat') > 250
  ) then
    raise exception 'Screenplay chat is invalid.' using errcode = '22023';
  end if;
  if requested_patch ? 'title_room' and (
    jsonb_typeof(requested_patch -> 'title_room') <> 'object'
    or octet_length((requested_patch -> 'title_room')::text) > 500000
  ) then
    raise exception 'title_room is invalid.' using errcode = '22023';
  end if;
  if requested_patch ? 'character_names' and (
    jsonb_typeof(requested_patch -> 'character_names') <> 'object'
    or octet_length((requested_patch -> 'character_names')::text) > 500000
  ) then
    raise exception 'character_names is invalid.' using errcode = '22023';
  end if;

  update public.scripts as script
  set title = case
        when requested_patch ? 'title' then btrim(requested_patch ->> 'title')
        else script.title
      end,
      blocks = case
        when requested_patch ? 'blocks' then requested_patch -> 'blocks'
        else script.blocks
      end,
      chat = case
        when requested_patch ? 'chat' then requested_patch -> 'chat'
        else script.chat
      end,
      title_room = case
        when requested_patch ? 'title_room' then requested_patch -> 'title_room'
        else script.title_room
      end,
      character_names = case
        when requested_patch ? 'character_names' then requested_patch -> 'character_names'
        else script.character_names
      end
  where script.id = requested_project_id
    and (not changes_document or script.updated_at = requested_expected_updated_at)
  returning script.* into changed_script;

  if not found then
    return jsonb_build_object('status', 'conflict');
  end if;

  return jsonb_build_object(
    'status', 'updated',
    'project', jsonb_build_object(
      'id', changed_script.id,
      'user_id', changed_script.user_id,
      'title', changed_script.title,
      'filename', changed_script.filename,
      'source', changed_script.source,
      'text', changed_script.text,
      'blocks', changed_script.blocks,
      'chat', changed_script.chat,
      'title_room', changed_script.title_room,
      'character_names', changed_script.character_names,
      'created_at', changed_script.created_at,
      'updated_at', changed_script.updated_at
    )
  );
end;
$$;

revoke all on function public.preview_create_project(text) from public, anon;
revoke all on function public.preview_claim_verified_legacy_profile() from public, anon;
revoke all on function public.preview_set_project_archived(text, boolean) from public, anon;
revoke all on function public.preview_register_upload(text, text, text, text, text, bigint, text)
  from public, anon;
revoke all on function public.preview_update_project_document(text, timestamptz, jsonb)
  from public, anon;

grant execute on function public.preview_create_project(text)
  to authenticated, service_role;
grant execute on function public.preview_claim_verified_legacy_profile()
  to authenticated, service_role;
grant execute on function public.preview_set_project_archived(text, boolean)
  to authenticated, service_role;
grant execute on function public.preview_register_upload(text, text, text, text, text, bigint, text)
  to authenticated, service_role;
grant execute on function public.preview_update_project_document(text, timestamptz, jsonb)
  to authenticated, service_role;

comment on function public.preview_update_project_document(text, timestamptz, jsonb) is
  'Preview-only screenplay patch. Document fields use an atomic updated_at compare-and-set and script:edit authorization.';
