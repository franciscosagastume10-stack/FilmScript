-- Private Realtime Broadcast/Presence authorization.
--
-- Project content never uses global Postgres Changes. Clients must subscribe
-- with `private: true` to one of these canonical topics:
--   project:<projectId>:<module>
--   user:<profileId>

create or replace function public.can_access_realtime_topic(
  requested_topic text,
  requested_extension text,
  requested_operation text,
  requested_private boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  topic_parts text[];
  app_user_id text := public.current_app_user_id();
  project_id text;
  project_module text;
  needed_level text;
  needs_financial_edit boolean := false;
begin
  if app_user_id is null
    or requested_private is not true
    or requested_extension not in ('broadcast', 'presence')
    or requested_operation not in ('select', 'insert') then
    return false;
  end if;

  topic_parts := pg_catalog.string_to_array(coalesce(requested_topic, ''), ':');

  -- Per-user notifications are readable and writable only by that exact
  -- linked FilmScript profile. Service-role server broadcasts bypass RLS.
  if pg_catalog.array_length(topic_parts, 1) = 2
    and topic_parts[1] = 'user'
    and topic_parts[2] ~ '^usr_[A-Za-z0-9_-]+$' then
    return topic_parts[2] = app_user_id;
  end if;

  -- Canvas is intentionally absent: its legacy workspace mixes visual content
  -- with quotes/prices and has no safe Broadcast payload contract yet.
  if pg_catalog.array_length(topic_parts, 1) <> 3
    or topic_parts[1] <> 'project'
    or topic_parts[2] !~ '^scr_[A-Za-z0-9_-]+$'
    or topic_parts[3] not in (
      'script', 'analysis', 'breakdown', 'shot_list', 'stripboard',
      'calendar', 'budget', 'location_plan', 'imagine',
      'files', 'project_settings', 'members', 'shared_projects',
      'exports', 'lumiere'
    ) then
    return false;
  end if;

  project_id := topic_parts[2];
  project_module := topic_parts[3];

  -- Receiving Broadcast/Presence and publishing Presence require current
  -- module view access. Publishing a Broadcast requires module edit access.
  if requested_operation = 'insert' and requested_extension = 'broadcast' then
    needed_level := 'edit';
    needs_financial_edit := true;
  else
    needed_level := 'view';
  end if;

  if not public.has_project_permission(
    project_id,
    project_module,
    needed_level
  ) then
    return false;
  end if;

  -- A project-wide Budget topic has no department dimension, so only global
  -- financial access is safe. Department-only users remain fail-closed.
  if project_module = 'budget'
    and not public.has_financial_access(
      project_id,
      null,
      needs_financial_edit
    ) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.can_access_realtime_topic(
  text, text, text, boolean
) from public, anon;
grant execute on function public.can_access_realtime_topic(
  text, text, text, boolean
) to authenticated, service_role;

-- This migration owns the complete FilmScript authorization surface on the
-- Supabase-managed messages table. Remove any permissive bootstrap policy so
-- PostgreSQL's policy OR semantics cannot accidentally reopen a topic.
do $policies$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
  loop
    execute pg_catalog.format(
      'drop policy %I on realtime.messages',
      existing_policy.policyname
    );
  end loop;
end;
$policies$;

-- Defense in depth only: Supabase Realtime may restore its managed table ACL
-- when the service starts. The authenticated-only RLS policies below remain
-- the durable authorization boundary, and anon has no applicable policy.
revoke all on table realtime.messages from public, anon, authenticated;
grant select, insert on table realtime.messages to authenticated;

create policy filmscript_private_topics_select
on realtime.messages
for select
to authenticated
using (
  public.can_access_realtime_topic(
    (select realtime.topic()),
    extension,
    'select',
    private
  )
);

create policy filmscript_private_topics_insert
on realtime.messages
for insert
to authenticated
with check (
  public.can_access_realtime_topic(
    (select realtime.topic()),
    extension,
    'insert',
    private
  )
);

comment on function public.can_access_realtime_topic(text, text, text, boolean) is
  'Fail-closed authorization for canonical FilmScript private Broadcast and Presence topics.';
