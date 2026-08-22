-- Narrow RPC surface for the isolated Supabase Preview vertical slice.
--
-- These functions keep multi-table writes atomic while every read and ordinary
-- update continues through PostgREST with the caller's JWT and existing RLS.
-- The Preview HTTP adapter never uses its Storage service-role credential for
-- database reads, mutations, or RPC authorization.

create or replace function public.preview_create_project(
  requested_title text default 'Untitled project'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  app_user_id text := public.current_app_user_id();
  project_id text := 'scr_' || encode(extensions.gen_random_bytes(10), 'hex');
  membership_id text := 'mem_' || encode(extensions.gen_random_bytes(10), 'hex');
  clean_title text := nullif(btrim(coalesce(requested_title, '')), '');
  created_project public.scripts%rowtype;
begin
  if (select auth.uid()) is null or app_user_id is null then
    raise exception 'A linked FilmScript profile is required.' using errcode = '42501';
  end if;

  clean_title := left(coalesce(clean_title, 'Untitled project'), 160);

  insert into public.scripts (
    id, user_id, title, source, text, blocks, chat, title_room,
    character_names
  ) values (
    project_id, app_user_id, clean_title, 'new', '', '[]'::jsonb,
    '[]'::jsonb, '{}'::jsonb, '{}'::jsonb
  )
  returning * into created_project;

  insert into public.project_memberships (
    id, project_id, user_id, project_role, module_permissions,
    financial_permissions, status, invited_by_user_id
  ) values (
    membership_id,
    project_id,
    app_user_id,
    'owner',
    jsonb_build_object(
      'script', 'manage',
      'analysis', 'manage',
      'breakdown', 'manage',
      'stripboard', 'manage',
      'shot_list', 'manage',
      'canvas', 'manage',
      'location_plan', 'manage',
      'imagine', 'manage',
      'budget', 'manage',
      'calendar', 'manage',
      'files', 'manage',
      'members', 'manage',
      'project_settings', 'manage'
    ),
    '["financial.edit_all"]'::jsonb,
    'active',
    app_user_id
  );

  insert into public.project_states (project_id)
  values (project_id);

  return jsonb_build_object(
    'id', created_project.id,
    'userId', created_project.user_id,
    'title', created_project.title,
    'filename', created_project.filename,
    'source', created_project.source,
    'text', created_project.text,
    'blocks', created_project.blocks,
    'createdAt', created_project.created_at,
    'updatedAt', created_project.updated_at,
    'archived', false,
    'role', 'owner'
  );
end;
$$;

-- Auth identities that existed before the migration triggers were installed
-- can replay the same subject-safe synchronizer. Email is never a claim key.
create or replace function public.preview_claim_verified_legacy_profile()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_auth_user_id uuid := (select auth.uid());
  auth_confirmed_at timestamptz;
  google_identity_count bigint := 0;
  coherent_google_identity_count bigint := 0;
  linked_profile_id text;
begin
  if caller_auth_user_id is null then
    raise exception 'A confirmed Supabase identity is required.' using errcode = '42501';
  end if;

  select user_row.email_confirmed_at
  into auth_confirmed_at
  from auth.users as user_row
  where user_row.id = caller_auth_user_id;

  if not found or auth_confirmed_at is null then
    raise exception 'A confirmed Google identity is required.' using errcode = '42501';
  end if;

  select
    count(*) filter (where identity.provider = 'google'),
    count(*) filter (
      where identity.provider = 'google'
        and nullif(btrim(identity.provider_id), '') is not null
        and nullif(btrim(identity.identity_data ->> 'sub'), '') = identity.provider_id
    )
  into google_identity_count, coherent_google_identity_count
  from auth.identities as identity
  where identity.user_id = caller_auth_user_id;

  if google_identity_count > 1 then
    raise sqlstate 'PT409'
      using message = 'Multiple Google identities require manual review.';
  end if;
  if google_identity_count <> 1 or coherent_google_identity_count <> 1 then
    raise exception 'A coherent Google subject is required.' using errcode = '42501';
  end if;

  perform private.sync_auth_user_profile(caller_auth_user_id);

  select profile.id
  into linked_profile_id
  from public.profiles as profile
  where profile.auth_user_id = caller_auth_user_id
  limit 1;

  return jsonb_build_object(
    'linked', linked_profile_id is not null,
    'profileId', linked_profile_id,
    'status', case
      when linked_profile_id is not null then 'linked'
      else 'manual_review_required'
    end
  );
end;
$$;

create or replace function public.preview_set_project_archived(
  requested_project_id text,
  requested_archived boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  app_user_id text := public.current_app_user_id();
  changed_state public.project_states%rowtype;
begin
  if (select auth.uid()) is null or app_user_id is null then
    raise exception 'A linked FilmScript profile is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.scripts as script
    where script.id = requested_project_id
      and (
        script.user_id = app_user_id
        or exists (
          select 1
          from public.project_memberships as membership
          where membership.project_id = script.id
            and membership.user_id = app_user_id
            and membership.status = 'active'
            and membership.project_role in ('co_owner', 'admin')
            and public.has_project_permission(
              script.id,
              'project_settings',
              'edit'
            )
        )
      )
  ) then
    raise exception 'Project lifecycle permission is required.' using errcode = '42501';
  end if;

  insert into public.project_states (
    project_id, archived_at, archived_by_user_id
  ) values (
    requested_project_id,
    case when requested_archived then statement_timestamp() else null end,
    case when requested_archived then app_user_id else null end
  )
  on conflict (project_id) do update
  set archived_at = excluded.archived_at,
      archived_by_user_id = excluded.archived_by_user_id,
      updated_at = statement_timestamp()
  returning * into changed_state;

  return jsonb_build_object(
    'projectId', changed_state.project_id,
    'archived', changed_state.archived_at is not null,
    'archivedAt', changed_state.archived_at
  );
end;
$$;

create or replace function public.preview_register_upload(
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
declare
  app_user_id text := public.current_app_user_id();
  expected_prefix text;
  created_media public.media_objects%rowtype;
begin
  if (select auth.uid()) is null or app_user_id is null then
    raise exception 'A linked FilmScript profile is required.' using errcode = '42501';
  end if;
  if requested_project_id !~ '^scr_[0-9a-f]{20,64}$'
    or requested_media_id !~ '^med_[0-9a-f]{32}$' then
    raise exception 'Invalid project or media identifier.' using errcode = '22023';
  end if;
  if not public.has_project_permission(requested_project_id, 'files', 'edit') then
    raise exception 'Project file edit permission is required.' using errcode = '42501';
  end if;
  if requested_size_bytes <= 0 or requested_size_bytes > 10485760 then
    raise exception 'Preview uploads must be between 1 byte and 10 MiB.' using errcode = '22023';
  end if;
  if requested_sha256 !~ '^[0-9a-f]{64}$'
    or requested_mime_type !~ '^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*$'
    or nullif(btrim(coalesce(requested_original_filename, '')), '') is null then
    raise exception 'Invalid file metadata.' using errcode = '22023';
  end if;

  expected_prefix := 'projects/' || requested_project_id || '/files/'
    || app_user_id || '/' || requested_media_id || '/';
  if left(requested_object_path, length(expected_prefix)) <> expected_prefix
    or substring(requested_object_path from length(expected_prefix) + 1)
      !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$' then
    raise exception 'Object path is outside the caller namespace.' using errcode = '22023';
  end if;

  insert into public.media_objects (
    id, project_id, owner_user_id, bucket_id, object_path, kind,
    original_filename, mime_type, size_bytes, sha256, metadata
  ) values (
    requested_media_id,
    requested_project_id,
    app_user_id,
    'filmscript-private',
    requested_object_path,
    'project_file',
    left(btrim(requested_original_filename), 255),
    requested_mime_type,
    requested_size_bytes,
    requested_sha256,
    jsonb_build_object(
      'access_module', 'files',
      'upload_state', 'ready',
      'preview_api', true
    )
  )
  returning * into created_media;

  return jsonb_build_object(
    'id', created_media.id,
    'projectId', created_media.project_id,
    'filename', created_media.original_filename,
    'mimeType', created_media.mime_type,
    'sizeBytes', created_media.size_bytes,
    'sha256', created_media.sha256,
    'createdAt', created_media.created_at
  );
end;
$$;

revoke all on function public.preview_create_project(text) from public, anon;
revoke all on function public.preview_claim_verified_legacy_profile() from public, anon;
revoke all on function public.preview_set_project_archived(text, boolean) from public, anon;
revoke all on function public.preview_register_upload(text, text, text, text, text, bigint, text)
  from public, anon;

grant execute on function public.preview_create_project(text) to authenticated;
grant execute on function public.preview_claim_verified_legacy_profile() to authenticated;
grant execute on function public.preview_set_project_archived(text, boolean) to authenticated;
grant execute on function public.preview_register_upload(text, text, text, text, text, bigint, text)
  to authenticated;

comment on function public.preview_create_project(text) is
  'Preview-only atomic project bootstrap: screenplay, owner membership and lifecycle state.';
comment on function public.preview_claim_verified_legacy_profile() is
  'Synchronizes a confirmed Google caller only by exact auth.identities subject; email never claims a legacy profile.';
comment on function public.preview_register_upload(text, text, text, text, text, bigint, text) is
  'Registers an already uploaded private object inside the authenticated caller namespace.';
