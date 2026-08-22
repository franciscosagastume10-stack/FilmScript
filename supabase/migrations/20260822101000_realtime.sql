-- Project content uses authorized private Broadcast channels in the runtime,
-- not global Postgres Changes. DELETE events cannot be filtered with RLS and
-- would otherwise disclose cross-project primary keys to subscribers.

do $realtime$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'activity_events',
    'notifications',
    'collaboration_documents',
    'collaboration_entities',
    'collaboration_operations',
    'content_conflicts',
    'project_comments',
    'project_messages'
  ]
  loop
    execute format('alter table public.%I replica identity default', relation_name);

    if exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', relation_name);
    end if;
  end loop;
end;
$realtime$;
