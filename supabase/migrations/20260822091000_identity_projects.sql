-- Identity and project ownership. Application IDs remain TEXT so existing
-- usr_*, scr_* and mem_* identifiers survive the migration unchanged.

create table public.profiles (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  google_sub text unique,
  email extensions.citext,
  username extensions.citext unique,
  name text,
  first_name text,
  last_name text,
  picture_url text,
  lumiere_preferences jsonb not null default '{}'::jsonb,
  gender text,
  birth_date date,
  profile_completed_at timestamptz,
  interface_language text,
  email_verified boolean not null default false,
  theme text not null default 'filmscript',
  avatar_key text,
  avatar_crop jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint profiles_id_not_blank check (btrim(id) <> ''),
  constraint profiles_lumiere_preferences_object check (jsonb_typeof(lumiere_preferences) = 'object'),
  constraint profiles_avatar_crop_object check (jsonb_typeof(avatar_crop) = 'object'),
  constraint profiles_gender check (gender is null or gender in ('man', 'woman', 'unspecified')),
  constraint profiles_language check (interface_language is null or interface_language in ('en', 'es')),
  constraint profiles_birth_date check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date))
);

create index profiles_email_idx on public.profiles(email) where email is not null;
create index profiles_auth_user_idx on public.profiles(auth_user_id) where auth_user_id is not null;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create table public.scripts (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  title text not null,
  filename text,
  source text,
  text text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  chat jsonb not null default '[]'::jsonb,
  title_room jsonb not null default '{}'::jsonb,
  character_names jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint scripts_id_not_blank check (btrim(id) <> ''),
  constraint scripts_title_not_blank check (btrim(title) <> ''),
  constraint scripts_blocks_array check (jsonb_typeof(blocks) = 'array'),
  constraint scripts_chat_array check (jsonb_typeof(chat) = 'array'),
  constraint scripts_title_room_object check (jsonb_typeof(title_room) = 'object'),
  constraint scripts_character_names_object check (jsonb_typeof(character_names) = 'object')
);

create index scripts_user_updated_idx on public.scripts(user_id, updated_at desc);

create trigger scripts_set_updated_at
before update on public.scripts
for each row execute function private.set_updated_at();

create table public.project_memberships (
  id text primary key,
  project_id text not null references public.scripts(id) on delete cascade,
  user_id text references public.profiles(id) on delete cascade,
  guest_id text,
  project_role text not null,
  cinematic_role text,
  module_permissions jsonb not null default '{}'::jsonb,
  financial_permissions jsonb not null default '["financial.no_access"]'::jsonb,
  financial_department_ids jsonb not null default '[]'::jsonb,
  department_ids jsonb not null default '[]'::jsonb,
  status text not null default 'invited',
  invited_by_user_id text not null references public.profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint project_memberships_id_not_blank check (btrim(id) <> ''),
  constraint project_memberships_principal check (num_nonnulls(user_id, guest_id) = 1),
  constraint project_memberships_role check (project_role in (
    'owner', 'co_owner', 'admin', 'editor', 'department_editor', 'commenter', 'viewer', 'temporary_guest'
  )),
  constraint project_memberships_module_permissions_object check (jsonb_typeof(module_permissions) = 'object'),
  constraint project_memberships_financial_permissions_array check (jsonb_typeof(financial_permissions) = 'array'),
  constraint project_memberships_financial_department_ids_array check (jsonb_typeof(financial_department_ids) = 'array'),
  constraint project_memberships_department_ids_array check (jsonb_typeof(department_ids) = 'array'),
  constraint project_memberships_version_positive check (version >= 1),
  unique(project_id, user_id)
);

create index project_memberships_user_idx
  on public.project_memberships(user_id, status, updated_at desc);
create index project_memberships_project_idx
  on public.project_memberships(project_id, status, updated_at desc);
create unique index project_memberships_single_owner_idx
  on public.project_memberships(project_id)
  where project_role = 'owner' and status = 'active';

create trigger project_memberships_set_updated_at
before update on public.project_memberships
for each row execute function private.set_updated_at();

create table public.project_states (
  project_id text primary key references public.scripts(id) on delete cascade,
  archived_at timestamptz,
  archived_by_user_id text references public.profiles(id) on delete set null,
  updated_at timestamptz not null default statement_timestamp()
);

create trigger project_states_set_updated_at
before update on public.project_states
for each row execute function private.set_updated_at();

create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles as p
  where p.auth_user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.has_project_access(requested_project_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.scripts as s
    where s.id = requested_project_id
      and (
        s.user_id = public.current_app_user_id()
        or exists (
          select 1
          from public.project_memberships as m
          where m.project_id = s.id
            and m.user_id = public.current_app_user_id()
            and m.status = 'active'
        )
      )
  );
$$;

create or replace function public.has_project_permission(
  requested_project_id text,
  requested_module text,
  needed_level text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.scripts as s
    where s.id = requested_project_id
      and (
        s.user_id = public.current_app_user_id()
        or exists (
          select 1
          from public.project_memberships as m
          where m.project_id = s.id
            and m.user_id = public.current_app_user_id()
            and m.status = 'active'
            and public.permission_rank(coalesce(m.module_permissions ->> requested_module, 'no_access'))
              >= public.permission_rank(needed_level)
        )
      )
  );
$$;

create or replace function public.has_financial_access(
  requested_project_id text,
  requested_department_id text default null,
  require_edit boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.scripts as s
    where s.id = requested_project_id
      and (
        s.user_id = public.current_app_user_id()
        or exists (
          select 1
          from public.project_memberships as m
          where m.project_id = s.id
            and m.user_id = public.current_app_user_id()
            and m.status = 'active'
            and (
              (require_edit and m.financial_permissions ? 'financial.edit_all')
              or (not require_edit and (
                m.financial_permissions ? 'financial.view_all'
                or m.financial_permissions ? 'financial.edit_all'
              ))
              or (
                requested_department_id is not null
                and m.financial_department_ids ? requested_department_id
                and (
                  (require_edit and m.financial_permissions ? 'financial.edit_department')
                  or (not require_edit and (
                    m.financial_permissions ? 'financial.view_department'
                    or m.financial_permissions ? 'financial.edit_department'
                  ))
                )
              )
            )
        )
      )
  );
$$;

create or replace function public.is_project_participant(
  requested_project_id text,
  requested_user_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.scripts as s
    where s.id = requested_project_id
      and (
        s.user_id = requested_user_id
        or exists (
          select 1
          from public.project_memberships as m
          where m.project_id = s.id
            and m.user_id = requested_user_id
            and m.status = 'active'
        )
      )
  );
$$;

create or replace function public.can_view_profile(requested_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_user_id = public.current_app_user_id()
    or exists (
      select 1
      from public.scripts as s
      where public.is_project_participant(s.id, public.current_app_user_id())
        and public.is_project_participant(s.id, requested_user_id)
    );
$$;

create or replace function public.can_message_project_user(
  requested_project_id text,
  requested_user_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_project_permission(requested_project_id, 'script', 'view')
    and public.is_project_participant(requested_project_id, requested_user_id);
$$;

revoke all on function public.current_app_user_id() from public, anon;
revoke all on function public.has_project_access(text) from public, anon;
revoke all on function public.has_project_permission(text, text, text) from public, anon;
revoke all on function public.has_financial_access(text, text, boolean) from public, anon;
revoke all on function public.is_project_participant(text, text) from public, anon;
revoke all on function public.can_view_profile(text) from public, anon;
revoke all on function public.can_message_project_user(text, text) from public, anon;

grant execute on function public.current_app_user_id() to authenticated, service_role;
grant execute on function public.has_project_access(text) to authenticated, service_role;
grant execute on function public.has_project_permission(text, text, text) to authenticated, service_role;
grant execute on function public.has_financial_access(text, text, boolean) to authenticated, service_role;
grant execute on function public.is_project_participant(text, text) to authenticated, service_role;
grant execute on function public.can_view_profile(text) to authenticated, service_role;
grant execute on function public.can_message_project_user(text, text) to authenticated, service_role;

-- Synchronize one confirmed Auth identity without treating email equality as
-- an ownership credential. A legacy Google profile is claimed only through an
-- exact, internally stored Google subject match. Email-only legacy candidates
-- remain unlinked for the reviewed service-only procedure below.
create or replace function private.sync_auth_user_profile(
  target_auth_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_email extensions.citext;
  auth_confirmed_at timestamptz;
  auth_created_at timestamptz;
  auth_app_provider text;
  metadata jsonb;
  identity_name text;
  linked_profile_id text;
  matched_legacy_profile_id text;
  generated_profile_id text;
  google_identity_count bigint := 0;
  coherent_google_identity_count bigint := 0;
  google_subject text;
  subject_profile_count bigint := 0;
  verified_subject_profile_count bigint := 0;
  legacy_email_candidate_count bigint := 0;
begin
  select
    auth_user.email::extensions.citext,
    auth_user.email_confirmed_at,
    auth_user.created_at,
    lower(coalesce(auth_user.raw_app_meta_data ->> 'provider', '')),
    coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
  into
    auth_email,
    auth_confirmed_at,
    auth_created_at,
    auth_app_provider,
    metadata
  from auth.users as auth_user
  where auth_user.id = target_auth_user_id;

  if not found or auth_email is null or auth_confirmed_at is null then
    return null;
  end if;

  identity_name := nullif(btrim(coalesce(
    metadata ->> 'full_name',
    metadata ->> 'name'
  )), '');

  -- Every call takes locks in the same order: normalized email, then Google
  -- subject if one exists. This serializes trigger replay and Preview RPCs.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.lower(auth_email::text), 0)
  );

  select profile.id
  into linked_profile_id
  from public.profiles as profile
  where profile.auth_user_id = target_auth_user_id
  limit 1
  for update;

  if linked_profile_id is not null then
    update public.profiles
    set email = auth_email,
        email_verified = true,
        name = coalesce(name, identity_name),
        picture_url = coalesce(picture_url, nullif(metadata ->> 'avatar_url', '')),
        updated_at = statement_timestamp()
    where id = linked_profile_id;
    return linked_profile_id;
  end if;

  select
    count(*) filter (where identity.provider = 'google'),
    count(*) filter (
      where identity.provider = 'google'
        and nullif(btrim(identity.provider_id), '') is not null
        and nullif(btrim(identity.identity_data ->> 'sub'), '') = identity.provider_id
    ),
    min(identity.provider_id) filter (
      where identity.provider = 'google'
        and nullif(btrim(identity.provider_id), '') is not null
        and nullif(btrim(identity.identity_data ->> 'sub'), '') = identity.provider_id
    )
  into google_identity_count, coherent_google_identity_count, google_subject
  from auth.identities as identity
  where identity.user_id = target_auth_user_id;

  -- GoTrue normally inserts auth.users before auth.identities. Defer Google
  -- provisioning until its immutable provider identity is present.
  if auth_app_provider = 'google' and google_identity_count = 0 then
    return null;
  end if;
  if google_identity_count > 0
    and (google_identity_count <> 1 or coherent_google_identity_count <> 1) then
    return null;
  end if;

  if google_subject is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('google:' || google_subject, 0)
    );

    select
      count(*),
      count(*) filter (where profile.email_verified is true),
      min(profile.id) filter (where profile.email_verified is true)
    into
      subject_profile_count,
      verified_subject_profile_count,
      matched_legacy_profile_id
    from public.profiles as profile
    where profile.auth_user_id is null
      and profile.google_sub = google_subject;

    if subject_profile_count = 1 and verified_subject_profile_count = 1 then
      update public.profiles
      set auth_user_id = target_auth_user_id,
          email = auth_email,
          email_verified = true,
          name = coalesce(name, identity_name),
          picture_url = coalesce(picture_url, nullif(metadata ->> 'avatar_url', '')),
          updated_at = statement_timestamp()
      where id = matched_legacy_profile_id
        and auth_user_id is null;

      if found then
        return matched_legacy_profile_id;
      end if;
      return null;
    elsif subject_profile_count > 0 then
      return null;
    end if;
  end if;

  -- Email is used only to prevent an unsafe duplicate. It never selects or
  -- claims a legacy row in this release, including a row without google_sub.
  select count(*)
  into legacy_email_candidate_count
  from public.profiles as profile
  where profile.auth_user_id is null
    and profile.email_verified is true
    and profile.email = auth_email;

  if legacy_email_candidate_count > 0 then
    return null;
  end if;

  generated_profile_id := 'usr_' || encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.profiles (
    id, auth_user_id, google_sub, email, name, picture_url,
    email_verified, created_at, updated_at
  ) values (
    generated_profile_id,
    target_auth_user_id,
    google_subject,
    auth_email,
    identity_name,
    nullif(metadata ->> 'avatar_url', ''),
    true,
    coalesce(auth_created_at, statement_timestamp()),
    statement_timestamp()
  ) on conflict do nothing;

  select profile.id
  into linked_profile_id
  from public.profiles as profile
  where profile.auth_user_id = target_auth_user_id
  limit 1;

  return linked_profile_id;
end;
$$;

revoke all on function private.sync_auth_user_profile(uuid)
  from public, anon, authenticated;
grant execute on function private.sync_auth_user_profile(uuid) to service_role;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_auth_user_profile(new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
grant execute on function private.handle_new_auth_user() to service_role;

create or replace function private.handle_auth_identity_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider = 'google' then
    perform private.sync_auth_user_profile(new.user_id);
  end if;
  return new;
end;
$$;

revoke all on function private.handle_auth_identity_ready()
  from public, anon, authenticated;
grant execute on function private.handle_auth_identity_ready() to service_role;

-- Existing auth.users rows predate the trigger in a migrated project. Link
-- each operator-reviewed pair explicitly after import. Unlike automatic
-- subject matching, this manual recovery path accepts a verified exact email
-- pair, but is service-role only and cannot be called from the browser.
create or replace function private.link_verified_auth_user_to_profile(
  target_auth_user_id uuid,
  target_profile_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_email extensions.citext;
  auth_confirmed_at timestamptz;
  profile_email extensions.citext;
  profile_verified boolean;
  existing_auth_user_id uuid;
begin
  select
    u.email::extensions.citext,
    u.email_confirmed_at
  into auth_email, auth_confirmed_at
  from auth.users as u
  where u.id = target_auth_user_id;

  if not found then
    raise exception 'Auth user was not found.' using errcode = 'P0002';
  end if;
  if auth_email is null or auth_confirmed_at is null then
    raise exception 'Auth email must be confirmed before profile linking.' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.lower(auth_email::text), 0)
  );

  select p.email, p.email_verified, p.auth_user_id
  into profile_email, profile_verified, existing_auth_user_id
  from public.profiles as p
  where p.id = target_profile_id
  for update;

  if not found then
    raise exception 'FilmScript profile was not found.' using errcode = 'P0002';
  end if;
  if profile_verified is not true then
    raise exception 'Legacy profile email must be verified before linking.' using errcode = '23514';
  end if;
  if profile_email is null or profile_email <> auth_email then
    raise exception 'Verified email does not match the legacy profile.' using errcode = '23514';
  end if;
  if existing_auth_user_id is not null and existing_auth_user_id <> target_auth_user_id then
    raise exception 'FilmScript profile is already linked to another Auth user.' using errcode = '23505';
  end if;
  if exists (
    select 1
    from public.profiles as p
    where p.auth_user_id = target_auth_user_id
      and p.id <> target_profile_id
  ) then
    raise exception 'Auth user is already linked to another FilmScript profile.' using errcode = '23505';
  end if;

  update public.profiles
  set auth_user_id = target_auth_user_id,
      email_verified = true,
      updated_at = statement_timestamp()
  where id = target_profile_id;

  return true;
end;
$$;

revoke all on function private.link_verified_auth_user_to_profile(uuid, text)
  from public, anon, authenticated;
grant execute on function private.link_verified_auth_user_to_profile(uuid, text)
  to service_role;

create trigger on_auth_user_ready
after insert or update of email_confirmed_at, email on auth.users
for each row execute function private.handle_new_auth_user();

create trigger on_auth_identity_ready
after insert or update of provider, provider_id, identity_data on auth.identities
for each row execute function private.handle_auth_identity_ready();

comment on column public.profiles.auth_user_id is
  'Supabase Auth identity. The application-facing profile ID remains the legacy FilmScript TEXT ID.';
