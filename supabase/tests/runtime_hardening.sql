begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(27);

select extensions.ok(
  (select pg_get_expr(default_value.adbin, default_value.adrelid) like 'false%'
   from pg_catalog.pg_attrdef as default_value
   join pg_catalog.pg_attribute as attribute
     on attribute.attrelid = default_value.adrelid
    and attribute.attnum = default_value.adnum
   where default_value.adrelid = 'private.runtime_flags'::regclass
     and attribute.attname = 'enabled'),
  'runtime flags default to false'
);

select extensions.is(
  (select enabled from private.runtime_flags where key = 'preview_api_enabled'),
  true,
  'the local-only seed explicitly enables Preview'
);

select extensions.is(
  (select count(*)
   from information_schema.table_privileges
   where table_schema = 'private'
     and table_name = 'runtime_flags'
     and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0::bigint,
  'runtime flags have no browser or public grants'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated', 'private.require_runtime_flag(text)', 'execute'
  ),
  'the runtime flag guard is not a browser RPC'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated', 'private.preview_create_project_impl(text)', 'execute'
  )
  and not has_function_privilege(
    'authenticated', 'private.preview_claim_verified_legacy_profile_impl()', 'execute'
  )
  and not has_function_privilege(
    'authenticated', 'private.preview_set_project_archived_impl(text,boolean)', 'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'private.preview_register_upload_impl(text,text,text,text,text,bigint,text)',
    'execute'
  ),
  'unguarded Preview implementations are private and not browser-callable'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.preview_create_project(text)', 'execute')
  and has_function_privilege(
    'authenticated', 'public.preview_claim_verified_legacy_profile()', 'execute'
  )
  and has_function_privilege(
    'authenticated', 'public.preview_set_project_archived(text,boolean)', 'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.preview_register_upload(text,text,text,text,text,bigint,text)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.preview_update_project_document(text,timestamptz,jsonb)',
    'execute'
  ),
  'authenticated callers can execute only the guarded public Preview RPCs'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.scripts', 'select'),
  'scripts remain readable through RLS'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.scripts', 'insert')
  and not has_any_column_privilege('authenticated', 'public.scripts', 'insert')
  and not has_table_privilege('authenticated', 'public.scripts', 'update')
  and not has_any_column_privilege('authenticated', 'public.scripts', 'update')
  and not has_table_privilege('authenticated', 'public.scripts', 'delete'),
  'scripts have no direct authenticated mutations'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.location_plans', 'select'),
  'location plans remain readable through RLS'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.location_plans', 'insert')
  and not has_any_column_privilege('authenticated', 'public.location_plans', 'insert')
  and not has_table_privilege('authenticated', 'public.location_plans', 'update')
  and not has_any_column_privilege('authenticated', 'public.location_plans', 'update')
  and not has_table_privilege('authenticated', 'public.location_plans', 'delete'),
  'location plans are read-only until their transactional RPC exists'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.project_comments', 'select'),
  'project comments remain readable through RLS'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.project_comments', 'insert')
  and not has_any_column_privilege('authenticated', 'public.project_comments', 'insert')
  and not has_table_privilege('authenticated', 'public.project_comments', 'update')
  and not has_any_column_privilege('authenticated', 'public.project_comments', 'update')
  and not has_table_privilege('authenticated', 'public.project_comments', 'delete'),
  'project comments are read-only until their transactional RPC exists'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.project_messages', 'select'),
  'project messages remain readable through RLS'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.project_messages', 'insert')
  and not has_any_column_privilege('authenticated', 'public.project_messages', 'insert')
  and not has_table_privilege('authenticated', 'public.project_messages', 'update')
  and not has_any_column_privilege('authenticated', 'public.project_messages', 'update')
  and not has_table_privilege('authenticated', 'public.project_messages', 'delete'),
  'project messages are read-only until their transactional RPC exists'
);

select extensions.is(
  (select count(*)
   from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename in (
       'scripts', 'location_plans', 'project_comments', 'project_messages'
     )
     and cmd <> 'SELECT'),
  0::bigint,
  'no browser mutation policy remains on hardened shared tables'
);

update private.runtime_flags
set enabled = false
where key = 'preview_api_enabled';

set local role authenticated;

select extensions.throws_ok(
  $$ select public.preview_create_project('Disabled project') $$,
  '42501',
  'Supabase Preview API is disabled.',
  'project creation fails closed while Preview is disabled'
);
select extensions.throws_ok(
  $$ select public.preview_claim_verified_legacy_profile() $$,
  '42501',
  'Supabase Preview API is disabled.',
  'legacy profile claim fails closed while Preview is disabled'
);
select extensions.throws_ok(
  $$ select public.preview_set_project_archived('scr_disabled', true) $$,
  '42501',
  'Supabase Preview API is disabled.',
  'project lifecycle fails closed while Preview is disabled'
);
select extensions.throws_ok(
  $$ select public.preview_register_upload(
    'scr_disabled', 'med_11111111111111111111111111111111',
    'projects/scr_disabled/files/user/media/file.png',
    'file.png', 'image/png', 1,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  ) $$,
  '42501',
  'Supabase Preview API is disabled.',
  'upload registration fails closed while Preview is disabled'
);
select extensions.throws_ok(
  $$ select public.preview_update_project_document(
    'scr_disabled', null, '{"title":"Disabled"}'::jsonb
  ) $$,
  '42501',
  'Supabase Preview API is disabled.',
  'screenplay update fails closed while Preview is disabled'
);

reset role;

select extensions.is(
  (select count(*) from public.scripts where title = 'Disabled project'),
  0::bigint,
  'disabled RPCs leave no project side effect'
);

set local session_replication_role = replica;
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'runtime-owner@example.test', now(),
    '{}', '{}', now(), now(), false, false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'runtime-outsider@example.test', now(),
    '{}', '{}', now(), now(), false, false
  );
set local session_replication_role = origin;

insert into public.profiles (
  id, auth_user_id, email, email_verified, created_at, updated_at
) values
  (
    'usr_runtime_owner',
    '90000000-0000-4000-8000-000000000001',
    'runtime-owner@example.test', true, now(), now()
  ),
  (
    'usr_runtime_outsider',
    '90000000-0000-4000-8000-000000000002',
    'runtime-outsider@example.test', true, now(), now()
  );

insert into public.scripts (
  id, user_id, title, text, blocks, chat, title_room, character_names,
  created_at, updated_at
) values (
  'scr_runtime_hardening', 'usr_runtime_owner', 'Before CAS', '',
  '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb,
  '2026-08-22T12:00:00.000Z', '2026-08-22T12:00:00.000Z'
);

update private.runtime_flags
set enabled = true
where key = 'preview_api_enabled';

set local role authenticated;
set local "request.jwt.claim.sub" = '90000000-0000-4000-8000-000000000001';

select extensions.is(
  (public.preview_update_project_document(
    'scr_runtime_hardening',
    '2026-08-22T12:00:00.000Z',
    '{"title":"After CAS","blocks":[{"type":"action","text":"Saved atomically"}]}'::jsonb
  ) ->> 'status'),
  'updated',
  'the guarded screenplay RPC accepts the current version'
);

select extensions.is(
  (select title from public.scripts where id = 'scr_runtime_hardening'),
  'After CAS',
  'the screenplay RPC persists the title'
);

select extensions.is(
  (select blocks -> 0 ->> 'text'
   from public.scripts where id = 'scr_runtime_hardening'),
  'Saved atomically',
  'the screenplay RPC persists the full document patch'
);

select extensions.ok(
  (select updated_at <> '2026-08-22T12:00:00.000Z'::timestamptz
   from public.scripts where id = 'scr_runtime_hardening'),
  'the screenplay trigger advances updated_at after the CAS'
);

select extensions.is(
  (public.preview_update_project_document(
    'scr_runtime_hardening',
    '2026-08-22T12:00:00.000Z',
    '{"blocks":[{"type":"action","text":"Stale overwrite"}]}'::jsonb
  ) ->> 'status'),
  'conflict',
  'a stale document version cannot overwrite the current screenplay'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '90000000-0000-4000-8000-000000000002';

select extensions.throws_ok(
  $$ select public.preview_update_project_document(
    'scr_runtime_hardening',
    (select updated_at from public.scripts where id = 'scr_runtime_hardening'),
    '{"blocks":[]}'::jsonb
  ) $$,
  '42501',
  'Script edit permission is required.',
  'the screenplay RPC independently enforces script edit permission'
);

reset role;
select * from extensions.finish();
rollback;
