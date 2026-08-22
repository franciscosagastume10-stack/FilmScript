-- Browser access is deny-by-default. The Node compatibility API may use the
-- service role, while authenticated clients receive only the grants below.

alter table public.profiles enable row level security;
alter table public.scripts enable row level security;
alter table public.project_memberships enable row level security;
alter table public.project_states enable row level security;
alter table public.preproduction_projects enable row level security;
alter table public.canvas_workspaces enable row level security;
alter table public.canvas_libraries enable row level security;
alter table public.location_plans enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.collaboration_documents enable row level security;
alter table public.collaboration_entities enable row level security;
alter table public.collaboration_operations enable row level security;
alter table public.content_conflicts enable row level security;
alter table public.project_comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.project_messages enable row level security;
alter table public.release_notice_acknowledgements enable row level security;
alter table public.media_objects enable row level security;

do $rls$
declare
  relation record;
begin
  for relation in
    select n.nspname as schema_name, c.relname as table_name
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname in ('private', 'billing')
      and c.relkind in ('r', 'p')
  loop
    execute format(
      'alter table %I.%I enable row level security',
      relation.schema_name,
      relation.table_name
    );
  end loop;
end;
$rls$;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all tables in schema billing from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all tables in schema private to service_role;
grant all privileges on all tables in schema billing to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all sequences in schema private to service_role;
grant all privileges on all sequences in schema billing to service_role;

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = public.current_app_user_id())
with check (id = public.current_app_user_id());

grant update (
  name, first_name, last_name, picture_url, lumiere_preferences, gender,
  birth_date, profile_completed_at, interface_language, theme, avatar_key,
  avatar_crop
) on public.profiles to authenticated;

create or replace function public.get_my_profile()
returns table (
  id text,
  email text,
  username text,
  name text,
  first_name text,
  last_name text,
  picture_url text,
  lumiere_preferences jsonb,
  gender text,
  birth_date date,
  profile_completed_at timestamptz,
  interface_language text,
  email_verified boolean,
  theme text,
  avatar_key text,
  avatar_crop jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.email::text,
    p.username::text,
    p.name,
    p.first_name,
    p.last_name,
    p.picture_url,
    p.lumiere_preferences,
    p.gender,
    p.birth_date,
    p.profile_completed_at,
    p.interface_language,
    p.email_verified,
    p.theme,
    p.avatar_key,
    p.avatar_crop,
    p.created_at,
    p.updated_at
  from public.profiles as p
  where p.id = public.current_app_user_id();
$$;

create or replace function public.get_visible_profile_directory()
returns table (
  id text,
  username text,
  name text,
  first_name text,
  last_name text,
  picture_url text,
  theme text,
  avatar_crop jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username::text,
    p.name,
    p.first_name,
    p.last_name,
    p.picture_url,
    p.theme,
    p.avatar_crop
  from public.profiles as p
  where public.can_view_profile(p.id);
$$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.get_visible_profile_directory() from public, anon;
grant execute on function public.get_my_profile() to authenticated, service_role;
grant execute on function public.get_visible_profile_directory() to authenticated, service_role;

create view public.my_profile
with (security_invoker = true, security_barrier = true)
as
select
  id, email, username, name, first_name, last_name, picture_url,
  lumiere_preferences, gender, birth_date, profile_completed_at,
  interface_language, email_verified, theme, avatar_key, avatar_crop,
  created_at, updated_at
from public.get_my_profile();

create view public.profile_directory
with (security_invoker = true, security_barrier = true)
as
select
  id, username, name, first_name, last_name, picture_url, theme,
  avatar_crop
from public.get_visible_profile_directory();

revoke all on public.my_profile from public, anon;
revoke all on public.profile_directory from public, anon;
grant select on public.my_profile to authenticated;
grant select on public.profile_directory to authenticated;

create policy scripts_select_member
on public.scripts
for select
to authenticated
using (
  user_id = public.current_app_user_id()
  or public.has_project_permission(id, 'script', 'view')
);

create policy scripts_insert_owner
on public.scripts
for insert
to authenticated
with check (user_id = public.current_app_user_id());

create policy scripts_update_editor
on public.scripts
for update
to authenticated
using (public.has_project_permission(id, 'script', 'edit'))
with check (public.has_project_permission(id, 'script', 'edit'));

create policy scripts_delete_owner
on public.scripts
for delete
to authenticated
using (user_id = public.current_app_user_id());

grant select on public.scripts to authenticated;
grant insert (
  id, user_id, title, filename, source, text, blocks, chat, title_room,
  character_names
) on public.scripts to authenticated;
grant update (
  title, filename, source, text, blocks, chat, title_room, character_names
) on public.scripts to authenticated;
grant delete on public.scripts to authenticated;

create policy project_memberships_select_authorized
on public.project_memberships
for select
to authenticated
using (
  user_id = public.current_app_user_id()
  or public.has_project_permission(project_id, 'members', 'view')
);

grant select on public.project_memberships to authenticated;

create policy project_states_select_member
on public.project_states
for select
to authenticated
using (public.has_project_access(project_id));

grant select on public.project_states to authenticated;

-- No authenticated grant or policy is created for preproduction_projects or
-- canvas_workspaces. Both are mixed legacy JSON snapshots: preproduction can
-- combine modules, while Canvas also embeds quotes and prices. The server/API
-- must return an authorized, financially filtered projection.

create policy canvas_libraries_select_self
on public.canvas_libraries
for select
to authenticated
using (user_id = public.current_app_user_id());

create policy canvas_libraries_insert_self
on public.canvas_libraries
for insert
to authenticated
with check (user_id = public.current_app_user_id());

create policy canvas_libraries_update_self
on public.canvas_libraries
for update
to authenticated
using (user_id = public.current_app_user_id())
with check (user_id = public.current_app_user_id());

create policy canvas_libraries_delete_self
on public.canvas_libraries
for delete
to authenticated
using (user_id = public.current_app_user_id());

grant select on public.canvas_libraries to authenticated;
grant insert (user_id, data) on public.canvas_libraries to authenticated;
grant update (data) on public.canvas_libraries to authenticated;
grant delete on public.canvas_libraries to authenticated;

create policy location_plans_select_member
on public.location_plans
for select
to authenticated
using (public.has_project_permission(project_id, 'location_plan', 'view'));

create policy location_plans_insert_editor
on public.location_plans
for insert
to authenticated
with check (
  created_by_user_id = public.current_app_user_id()
  and public.has_project_permission(project_id, 'location_plan', 'edit')
);

create policy location_plans_update_editor
on public.location_plans
for update
to authenticated
using (public.has_project_permission(project_id, 'location_plan', 'edit'))
with check (public.has_project_permission(project_id, 'location_plan', 'edit'));

create policy location_plans_delete_editor
on public.location_plans
for delete
to authenticated
using (public.has_project_permission(project_id, 'location_plan', 'edit'));

grant select on public.location_plans to authenticated;
grant insert (id, project_id, name, data, version, created_by_user_id)
  on public.location_plans to authenticated;
grant update (name, data, version) on public.location_plans to authenticated;
grant delete on public.location_plans to authenticated;

create policy activity_events_select_member
on public.activity_events
for select
to authenticated
using (
  public.has_project_permission(project_id, module, 'view')
  and (
    (
      lower(coalesce(module, '')) <> 'budget'
      and not contains_financial_data
    )
    or public.has_financial_access(project_id, financial_department_id, false)
  )
);

grant select on public.activity_events to authenticated;

create or replace function public.can_read_notification(
  requested_user_id text,
  requested_project_id text,
  requested_type text,
  requested_contains_financial_data boolean,
  requested_financial_department_id text,
  requested_metadata jsonb default '{}'::jsonb
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with resolved as (
    select case
      when nullif(lower(coalesce(
        requested_metadata ->> 'module',
        requested_metadata ->> 'access_module',
        ''
      )), '') is not null then nullif(lower(coalesce(
        requested_metadata ->> 'module',
        requested_metadata ->> 'access_module',
        ''
      )), '')
      when lower(coalesce(requested_type, '')) in (
        'message', 'translation_completed', 'translation_failed'
      ) then 'script'
      else null
    end as module
  )
  select requested_user_id = public.current_app_user_id()
    and case
      -- Account-only notices contain no project content. The marked lifecycle
      -- allowlist is generic account copy; removed notices intentionally remain
      -- visible after membership revocation.
      when requested_project_id is null then true
      when lower(coalesce(requested_type, '')) in (
        'project_invitation', 'removed_from_project',
        'permission_changed', 'ownership_transfer'
      )
        and coalesce(requested_metadata ->> 'account_project_event', '') = 'true'
      then case
        when lower(requested_type) in (
          'project_invitation', 'removed_from_project'
        ) then true
        else public.has_project_access(requested_project_id)
      end
      else resolved.module is not null
        and public.has_project_permission(
          requested_project_id,
          resolved.module,
          'view'
        )
        and (
          (
            resolved.module <> 'budget'
            and not coalesce(requested_contains_financial_data, false)
          )
          or public.has_financial_access(
            requested_project_id,
            requested_financial_department_id,
            false
          )
        )
    end
  from resolved;
$$;

revoke all on function public.can_read_notification(
  text, text, text, boolean, text, jsonb
) from public, anon;
grant execute on function public.can_read_notification(
  text, text, text, boolean, text, jsonb
) to authenticated, service_role;

create policy notifications_select_self
on public.notifications
for select
to authenticated
using (public.can_read_notification(
  user_id, project_id, type, contains_financial_data,
  financial_department_id, metadata
));

create policy notifications_mark_read_self
on public.notifications
for update
to authenticated
using (public.can_read_notification(
  user_id, project_id, type, contains_financial_data,
  financial_department_id, metadata
))
with check (public.can_read_notification(
  user_id, project_id, type, contains_financial_data,
  financial_department_id, metadata
));

create policy notifications_delete_self
on public.notifications
for delete
to authenticated
using (public.can_read_notification(
  user_id, project_id, type, contains_financial_data,
  financial_department_id, metadata
));

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

create policy ai_jobs_select_authorized
on public.ai_jobs
for select
to authenticated
using (
  public.has_project_permission(project_id, 'script', 'view')
  and public.has_project_permission(project_id, 'lumiere', 'view')
);

grant select (
  id, project_id, requested_by_user_id, type, status, progress, stage,
  source_script_id, source_script_version_id, source_content_hash,
  reserved_credits, settled_credits, idempotency_key, input, output,
  output_schema_version, error_code, created_at, started_at, completed_at,
  updated_at
) on public.ai_jobs to authenticated;

create view public.ai_job_statuses
with (security_invoker = true, security_barrier = true)
as
select
  id, project_id, requested_by_user_id, type, status, progress, stage,
  source_script_id, source_script_version_id, source_content_hash,
  reserved_credits, settled_credits, idempotency_key, input, output,
  output_schema_version, error_code, created_at, started_at, completed_at,
  updated_at
from public.ai_jobs;

revoke all on public.ai_job_statuses from public, anon;
grant select on public.ai_job_statuses to authenticated;

create or replace function public.can_access_project_module(
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
  select public.has_project_permission(
      requested_project_id,
      requested_module,
      needed_level
    )
    and (
      lower(coalesce(requested_module, '')) <> 'budget'
      or public.has_financial_access(
        requested_project_id,
        null,
        public.permission_rank(needed_level) >= public.permission_rank('edit')
      )
    );
$$;

revoke all on function public.can_access_project_module(text, text, text)
  from public, anon;
grant execute on function public.can_access_project_module(text, text, text)
  to authenticated, service_role;

create policy collaboration_documents_select_member
on public.collaboration_documents
for select
to authenticated
using (public.can_access_project_module(project_id, module, 'view'));

create policy collaboration_entities_select_member
on public.collaboration_entities
for select
to authenticated
using (public.can_access_project_module(project_id, module, 'view'));

create policy collaboration_operations_select_member
on public.collaboration_operations
for select
to authenticated
using (public.can_access_project_module(project_id, module, 'view'));

create policy content_conflicts_select_member
on public.content_conflicts
for select
to authenticated
using (public.can_access_project_module(project_id, module, 'view'));

grant select on public.collaboration_documents to authenticated;
grant select on public.collaboration_entities to authenticated;
grant select on public.collaboration_operations to authenticated;
grant select on public.content_conflicts to authenticated;

create policy project_comments_select_member
on public.project_comments
for select
to authenticated
using (public.can_access_project_module(project_id, module, 'view'));

create policy project_comments_insert_commenter
on public.project_comments
for insert
to authenticated
with check (
  author_user_id = public.current_app_user_id()
  and guest_id is null
  and public.can_access_project_module(project_id, module, 'comment')
);

create policy project_comments_update_author
on public.project_comments
for update
to authenticated
using (
  author_user_id = public.current_app_user_id()
  or public.can_access_project_module(project_id, module, 'manage')
)
with check (public.can_access_project_module(project_id, module, 'comment'));

create policy project_comments_delete_author
on public.project_comments
for delete
to authenticated
using (
  author_user_id = public.current_app_user_id()
  or public.can_access_project_module(project_id, module, 'manage')
);

grant select on public.project_comments to authenticated;
grant insert (
  id, project_id, module, entity_type, entity_id, coordinate, body,
  author_user_id, guest_id, parent_comment_id
) on public.project_comments to authenticated;
grant update (body, resolved_at, resolved_by_user_id, reopened_at)
  on public.project_comments to authenticated;
grant delete on public.project_comments to authenticated;

create policy comment_mentions_select_authorized
on public.comment_mentions
for select
to authenticated
using (
  exists (
    select 1
    from public.project_comments as c
    where c.id = comment_id
  )
);

grant select on public.comment_mentions to authenticated;

create policy project_messages_select_party
on public.project_messages
for select
to authenticated
using (
  public.has_project_permission(project_id, 'script', 'view')
  and public.current_app_user_id() in (sender_user_id, recipient_user_id)
);

create policy project_messages_insert_sender
on public.project_messages
for insert
to authenticated
with check (
  sender_user_id = public.current_app_user_id()
  and public.has_project_permission(project_id, 'script', 'view')
  and public.can_message_project_user(project_id, recipient_user_id)
);

create policy project_messages_mark_read_recipient
on public.project_messages
for update
to authenticated
using (recipient_user_id = public.current_app_user_id())
with check (recipient_user_id = public.current_app_user_id());

grant select on public.project_messages to authenticated;
grant insert (id, project_id, sender_user_id, recipient_user_id, body)
  on public.project_messages to authenticated;
grant update (read_at) on public.project_messages to authenticated;

create policy release_notice_select_self
on public.release_notice_acknowledgements
for select
to authenticated
using (user_id = public.current_app_user_id());

create policy release_notice_insert_self
on public.release_notice_acknowledgements
for insert
to authenticated
with check (user_id = public.current_app_user_id());

create policy release_notice_update_self
on public.release_notice_acknowledgements
for update
to authenticated
using (user_id = public.current_app_user_id())
with check (user_id = public.current_app_user_id());

grant select on public.release_notice_acknowledgements to authenticated;
grant insert (user_id, release_version, presented_at, acknowledged_at)
  on public.release_notice_acknowledgements to authenticated;
grant update (acknowledged_at) on public.release_notice_acknowledgements to authenticated;

create or replace function public.can_read_media(
  requested_project_id text,
  requested_owner_user_id text,
  requested_kind text,
  requested_metadata jsonb default '{}'::jsonb
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when requested_project_id is null then
        requested_owner_user_id = public.current_app_user_id()
      when lower(coalesce(requested_kind, '')) = 'budget_receipt' then
        public.has_project_permission(requested_project_id, 'budget', 'view')
        and public.has_financial_access(
          requested_project_id,
          nullif(coalesce(
            requested_metadata ->> 'financial_department_id',
            requested_metadata ->> 'department_id'
          ), ''),
          false
        )
      when lower(coalesce(requested_kind, '')) in ('shot_reference', 'shot_list_reference') then
        public.has_project_permission(requested_project_id, 'shot_list', 'view')
      when lower(coalesce(requested_kind, '')) in ('imagine_asset', 'imagine_reference')
        or (
          lower(coalesce(requested_kind, '')) = 'canvas_asset'
          and lower(coalesce(
            requested_metadata ->> 'access_module',
            requested_metadata ->> 'module',
            requested_metadata ->> 'source'
          )) in ('imagine', 'imagine_reference')
        ) then
        public.has_project_permission(requested_project_id, 'imagine', 'view')
      when lower(coalesce(requested_kind, '')) in ('canvas_reference', 'canvas_upload')
        or (
          lower(coalesce(requested_kind, '')) = 'canvas_asset'
          and lower(coalesce(
            requested_metadata ->> 'access_module',
            requested_metadata ->> 'module'
          )) = 'canvas'
        ) then
        public.has_project_permission(requested_project_id, 'canvas', 'view')
      when lower(coalesce(requested_kind, '')) = 'project_file' then
        public.has_project_permission(requested_project_id, 'files', 'view')
      when lower(coalesce(requested_kind, '')) = 'project_export' then
        public.has_project_permission(requested_project_id, 'exports', 'view')
      else exists (
        select 1
        from public.scripts as project
        where project.id = requested_project_id
          and project.user_id = public.current_app_user_id()
      )
    end;
$$;

revoke all on function public.can_read_media(text, text, text, jsonb)
  from public, anon;
grant execute on function public.can_read_media(text, text, text, jsonb)
  to authenticated, service_role;

create policy media_objects_select_authorized
on public.media_objects
for select
to authenticated
using (public.can_read_media(project_id, owner_user_id, kind, metadata));

grant select on public.media_objects to authenticated;

drop policy if exists filmscript_private_objects_select on storage.objects;
create policy filmscript_private_objects_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'filmscript-private'
  and exists (
    select 1
    from public.media_objects as media
    where media.bucket_id = storage.objects.bucket_id
      and media.object_path = storage.objects.name
      and public.can_read_media(
        media.project_id,
        media.owner_user_id,
        media.kind,
        media.metadata
      )
  )
);

-- The helpers below are implementation details of other SECURITY DEFINER
-- functions. They are intentionally not callable as standalone browser RPCs.
revoke all on function public.permission_rank(text) from authenticated;
revoke all on function public.is_project_participant(text, text) from authenticated;
