begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(106);

select extensions.is(
  (select count(*)
   from information_schema.table_privileges
   where table_schema = 'private'
     and table_name = 'legacy_orphan_records'
     and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0::bigint,
  'legacy orphan quarantine has no browser or public table grants'
);

select extensions.is(
  (select count(*)
   from information_schema.table_privileges
   where table_schema = 'private'
     and table_name = 'legacy_orphan_storage'
     and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0::bigint,
  'legacy orphan Storage quarantine has no browser or public table grants'
);

-- -------------------------------------------------------------------------
-- Auth linking: unconfirmed identities have no profile or claim authority.
-- -------------------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'pending@example.test', '{}', '{}', now(), now()
);

select extensions.is(
  (select count(*) from public.profiles where auth_user_id = '10000000-0000-0000-0000-000000000001'),
  0::bigint,
  'unconfirmed Auth insert creates no FilmScript profile'
);

update auth.users
set email_confirmed_at = now(), updated_at = now()
where id = '10000000-0000-0000-0000-000000000001';

select extensions.is(
  (select count(*) from public.profiles where auth_user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'confirmation update creates exactly one profile'
);

update auth.users
set email = 'pending@example.test', updated_at = now()
where id = '10000000-0000-0000-0000-000000000001';

select extensions.is(
  (select count(*) from public.profiles where auth_user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'repeated confirmed updates remain idempotent'
);

insert into public.profiles (
  id, email, email_verified, created_at, updated_at
) values (
  'usr_unverified_legacy', 'unsafe-claim@example.test', false, now(), now()
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'unsafe-claim@example.test', now(),
  '{}', '{}', now(), now()
);

select extensions.is(
  (select auth_user_id from public.profiles where id = 'usr_unverified_legacy'),
  null::uuid,
  'confirmed Auth identity cannot claim an unverified legacy profile'
);

select extensions.is(
  (select count(*) from public.profiles
   where auth_user_id = '10000000-0000-0000-0000-000000000002'
     and id <> 'usr_unverified_legacy'),
  1::bigint,
  'confirmed Auth identity receives a distinct profile when legacy email is unverified'
);

insert into public.profiles (
  id, google_sub, email, email_verified, created_at, updated_at
) values (
  'usr_verified_legacy', 'google-sub-exact',
  'original-subject-email@example.test', true, now(), now()
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000006',
  'authenticated', 'authenticated', 'current-subject-email@example.test', now(),
  '{"provider":"google","providers":["google"]}', '{}', now(), now()
);

select extensions.is(
  (select count(*) from public.profiles
   where auth_user_id = '10000000-0000-0000-0000-000000000006'),
  0::bigint,
  'Google auth.users insertion defers until auth.identities supplies a subject'
);

insert into auth.identities (
  provider_id, user_id, identity_data, provider, created_at, updated_at
) values (
  'google-sub-exact', '10000000-0000-0000-0000-000000000006',
  '{"sub":"google-sub-exact","email":"current-subject-email@example.test"}',
  'google', now(), now()
);

select extensions.is(
  (select auth_user_id from public.profiles where id = 'usr_verified_legacy'),
  '10000000-0000-0000-0000-000000000006'::uuid,
  'exact Google subject links the verified legacy profile despite changed email'
);

select extensions.is(
  (select count(*) from public.profiles
   where auth_user_id = '10000000-0000-0000-0000-000000000006'
     and id <> 'usr_verified_legacy'),
  0::bigint,
  'verified legacy candidate prevents creation of a duplicate fresh profile'
);

update auth.identities
set identity_data = identity_data, updated_at = now()
where user_id = '10000000-0000-0000-0000-000000000006'
  and provider = 'google';

select extensions.is(
  (select count(*) from public.profiles
   where auth_user_id = '10000000-0000-0000-0000-000000000006'),
  1::bigint,
  'Google identity trigger replay remains idempotent'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000006';
select extensions.is(
  (select public.preview_claim_verified_legacy_profile() ->> 'profileId'),
  'usr_verified_legacy',
  'Preview claim replay resolves the same subject-linked profile'
);
reset role;

insert into public.profiles (
  id, email, email_verified, created_at, updated_at
) values (
  'usr_password_legacy', 'historical-password@example.test', true, now(), now()
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000007',
  'authenticated', 'authenticated', 'historical-password@example.test', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

select extensions.is(
  (select auth_user_id from public.profiles where id = 'usr_password_legacy'),
  null::uuid,
  'historically auto-confirmed password identity cannot claim a legacy profile'
);

select extensions.is(
  (select count(*) from public.profiles
   where auth_user_id = '10000000-0000-0000-0000-000000000007'),
  0::bigint,
  'untrusted legacy candidate remains pending explicit service review'
);

-- Reassigned email attack: the Google subject, not possession of the current
-- email, is the automatic legacy ownership credential.
insert into public.profiles (
  id, google_sub, email, email_verified, created_at, updated_at
) values (
  'usr_reassigned_email', 'google-sub-original-owner',
  'reassigned@example.test', true, now(), now()
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000008',
  'authenticated', 'authenticated', 'reassigned@example.test', now(),
  '{"provider":"google","providers":["google"]}', '{}', now(), now()
);

insert into auth.identities (
  provider_id, user_id, identity_data, provider, created_at, updated_at
) values (
  'google-sub-new-email-owner', '10000000-0000-0000-0000-000000000008',
  '{"sub":"google-sub-new-email-owner","email":"reassigned@example.test"}',
  'google', now(), now()
);

select extensions.is(
  (select auth_user_id from public.profiles where id = 'usr_reassigned_email'),
  null::uuid,
  'reassigned email with a different Google subject cannot claim legacy data'
);

select extensions.is(
  (select count(*) from public.profiles
   where auth_user_id = '10000000-0000-0000-0000-000000000008'),
  0::bigint,
  'subject mismatch does not create an unsafe duplicate profile'
);

insert into public.profiles (
  id, email, email_verified, created_at, updated_at
) values (
  'usr_legacy_without_sub', 'legacy-without-sub@example.test', true, now(), now()
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000009',
  'authenticated', 'authenticated', 'legacy-without-sub@example.test', now(),
  '{"provider":"google","providers":["google"]}', '{}', now(), now()
);

insert into auth.identities (
  provider_id, user_id, identity_data, provider, created_at, updated_at
) values (
  'google-sub-no-legacy-anchor', '10000000-0000-0000-0000-000000000009',
  '{"sub":"google-sub-no-legacy-anchor","email":"legacy-without-sub@example.test"}',
  'google', now(), now()
);

select extensions.is(
  (select count(*) from public.profiles
   where auth_user_id = '10000000-0000-0000-0000-000000000009'),
  0::bigint,
  'legacy profile without google_sub remains unlinked and unduplicated'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000009';
select extensions.is(
  (select public.preview_claim_verified_legacy_profile() ->> 'status'),
  'manual_review_required',
  'legacy profile without google_sub requires service-only manual review'
);
reset role;

insert into public.profiles (
  id, email, email_verified, created_at, updated_at
) values
  ('usr_duplicate_a', 'duplicate@example.test', true, now(), now()),
  ('usr_duplicate_b', 'duplicate@example.test', true, now(), now());

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated', 'duplicate@example.test', now(),
  '{"provider":"google","providers":["google"]}', '{}', now(), now()
);

insert into auth.identities (
  provider_id, user_id, identity_data, provider, created_at, updated_at
) values
  (
    'google-sub-ambiguous-a', '10000000-0000-0000-0000-000000000003',
    '{"sub":"google-sub-ambiguous-a","email":"duplicate@example.test"}',
    'google', now(), now()
  ),
  (
    'google-sub-ambiguous-b', '10000000-0000-0000-0000-000000000003',
    '{"sub":"google-sub-ambiguous-b","email":"duplicate@example.test"}',
    'google', now(), now()
  );

select extensions.is(
  (select count(*) from public.profiles
   where auth_user_id = '10000000-0000-0000-0000-000000000003'),
  0::bigint,
  'pre-existing Auth identity does not claim duplicate legacy profiles implicitly'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
select extensions.throws_ok(
  $$ select public.preview_claim_verified_legacy_profile() $$,
  'PT409',
  'Multiple Google identities require manual review.',
  'ambiguous Google identities are never resolved automatically'
);
reset role;

select extensions.ok(
  private.link_verified_auth_user_to_profile(
    '10000000-0000-0000-0000-000000000003',
    'usr_duplicate_b'
  ),
  'reviewed duplicate can be linked explicitly'
);

select extensions.ok(
  (select auth_user_id = '10000000-0000-0000-0000-000000000003'
   from public.profiles where id = 'usr_duplicate_b')
  and (select auth_user_id is null from public.profiles where id = 'usr_duplicate_a'),
  'explicit linker changes only the reviewed profile'
);

set local session_replication_role = replica;
insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values
  (
    '10000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'existing@example.test', now(),
    '{}', '{}', now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'existing-unverified@example.test', now(),
    '{}', '{}', now(), now()
  );
set local session_replication_role = origin;

insert into public.profiles (
  id, email, email_verified, created_at, updated_at
) values
  ('usr_existing_verified', 'existing@example.test', true, now(), now()),
  ('usr_existing_unverified', 'existing-unverified@example.test', false, now(), now());

select extensions.is(
  (select count(*) from public.profiles
   where auth_user_id = '10000000-0000-0000-0000-000000000004'),
  0::bigint,
  'pre-existing Auth row is not auto-linked by migration DDL'
);

select extensions.ok(
  private.link_verified_auth_user_to_profile(
    '10000000-0000-0000-0000-000000000004',
    'usr_existing_verified'
  ),
  'verified pre-existing Auth row links through explicit procedure'
);

select extensions.throws_ok(
  $$ select private.link_verified_auth_user_to_profile(
    '10000000-0000-0000-0000-000000000005',
    'usr_existing_unverified'
  ) $$,
  '23514',
  'Legacy profile email must be verified before linking.',
  'explicit linker rejects an unverified legacy profile'
);

select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'private.link_verified_auth_user_to_profile(uuid,text)',
    'execute'
  ),
  'browser role cannot call the explicit Auth linker'
);

-- -------------------------------------------------------------------------
-- Project, script and module fixtures.
-- -------------------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at
) values
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', now(), '{}', '{"name":"Owner"}', now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'no-script@example.test', now(), '{}', '{"name":"No Script"}', now(), now()),
  ('20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'reader@example.test', now(), '{}', '{"name":"Reader"}', now(), now()),
  ('20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'budget-no@example.test', now(), '{}', '{"name":"Budget No Finance"}', now(), now()),
  ('20000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'budget-yes@example.test', now(), '{}', '{"name":"Budget Finance"}', now(), now()),
  ('20000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'canvas@example.test', now(), '{}', '{"name":"Canvas"}', now(), now()),
  ('20000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'imagine@example.test', now(), '{}', '{"name":"Imagine"}', now(), now()),
  ('20000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'outsider@example.test', now(), '{}', '{"name":"Outsider"}', now(), now()),
  ('20000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'budget-global@example.test', now(), '{}', '{"name":"Budget Global"}', now(), now()),
  ('20000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', 'revoked-uploader@example.test', now(), '{}', '{"name":"Revoked Uploader"}', now(), now());

insert into public.scripts (id, user_id, title, text, blocks)
select
  'scr_security', id, 'Security project', 'TOP SECRET SCRIPT',
  '[{"type":"action","text":"TOP SECRET BLOCK"}]'::jsonb
from public.profiles
where auth_user_id = '20000000-0000-0000-0000-000000000001';

insert into public.project_memberships (
  id, project_id, user_id, project_role, module_permissions,
  financial_permissions, financial_department_ids,
  invited_by_user_id, status
)
select fixture.id, 'scr_security', member.id, 'viewer', fixture.modules,
  fixture.financial_permissions, fixture.financial_departments, owner.id, 'active'
from (
  values
    ('mem_no_script', '20000000-0000-0000-0000-000000000002'::uuid, '{"canvas":"view","lumiere":"view"}'::jsonb, '["financial.no_access"]'::jsonb, '[]'::jsonb),
    ('mem_reader', '20000000-0000-0000-0000-000000000003'::uuid, '{"script":"view","shot_list":"view","lumiere":"view","files":"view"}'::jsonb, '["financial.no_access"]'::jsonb, '[]'::jsonb),
    ('mem_budget_no', '20000000-0000-0000-0000-000000000004'::uuid, '{"budget":"view"}'::jsonb, '["financial.no_access"]'::jsonb, '[]'::jsonb),
    ('mem_budget_yes', '20000000-0000-0000-0000-000000000005'::uuid, '{"budget":"view"}'::jsonb, '["financial.view_department"]'::jsonb, '["dept_art"]'::jsonb),
    ('mem_canvas', '20000000-0000-0000-0000-000000000006'::uuid, '{"canvas":"view"}'::jsonb, '["financial.no_access"]'::jsonb, '[]'::jsonb),
    ('mem_imagine', '20000000-0000-0000-0000-000000000007'::uuid, '{"imagine":"view","exports":"view"}'::jsonb, '["financial.no_access"]'::jsonb, '[]'::jsonb),
    ('mem_budget_global', '20000000-0000-0000-0000-000000000009'::uuid, '{"budget":"view"}'::jsonb, '["financial.view_all"]'::jsonb, '[]'::jsonb)
) as fixture(id, auth_user_id, modules, financial_permissions, financial_departments)
join public.profiles as member on member.auth_user_id = fixture.auth_user_id
cross join public.profiles as owner
where owner.auth_user_id = '20000000-0000-0000-0000-000000000001';

insert into public.project_memberships (
  id, project_id, user_id, project_role, module_permissions,
  financial_permissions, financial_department_ids,
  invited_by_user_id, status
)
select
  'mem_revoked', 'scr_security', revoked.id, 'viewer',
  '{"shot_list":"view"}'::jsonb, '["financial.no_access"]'::jsonb,
  '[]'::jsonb, owner.id, 'revoked'
from public.profiles as revoked
cross join public.profiles as owner
where revoked.auth_user_id = '20000000-0000-0000-0000-000000000010'
  and owner.auth_user_id = '20000000-0000-0000-0000-000000000001';

insert into public.ai_jobs (
  id, project_id, requested_by_user_id, type, status, stage,
  source_script_id, source_script_version_id, source_content_hash,
  internal_primary_model, idempotency_key, input, output
)
select
  'job_security', 'scr_security', owner.id, 'analysis', 'completed', 'done',
  'scr_security', 'v1', 'hash', 'internal-secret-model', 'idem_security',
  '{"script":"TOP SECRET SCRIPT"}', '{"analysis":"TOP SECRET OUTPUT"}'
from public.profiles as owner
where owner.auth_user_id = '20000000-0000-0000-0000-000000000001';

insert into public.collaboration_documents (
  project_id, document_id, module, snapshot, version
) values
  ('scr_security', 'doc_script', 'script', decode('544f5020534543524554', 'hex'), 1),
  ('scr_security', 'doc_budget', 'budget', decode('51554f5445203130303030', 'hex'), 1);

select extensions.throws_ok(
  $$insert into public.collaboration_documents
      (project_id, document_id, module, snapshot, version, legacy_synthetic_parent)
    values ('scr_security', 'doc_invalid_anchor', 'breakdown', decode('01', 'hex'), 1, true)$$,
  '23514',
  null,
  'synthetic collaboration provenance rejects a materialized snapshot'
);

select extensions.lives_ok(
  $$insert into public.collaboration_documents
      (project_id, document_id, module, snapshot, version, legacy_synthetic_parent)
    values ('scr_security', 'doc_legacy_anchor', 'breakdown', decode('', 'hex'), 0, true)$$,
  'synthetic collaboration provenance accepts only an empty version-zero FK anchor'
);

insert into public.collaboration_entities (
  project_id, document_id, module, entity_type, entity_id, value, version
) values (
  'scr_security', 'doc_budget', 'budget', 'quote', 'quote_budget',
  '{"vendor":"Secret Vendor","amount":10000}'::jsonb, 1
);

insert into public.collaboration_operations (
  id, project_id, document_id, module, entity_type, entity_id,
  actor_user_id, base_version, committed_version, operation_type, patch
)
select
  'op_budget', 'scr_security', 'doc_budget', 'budget', 'quote',
  'quote_budget', owner.id, 0, 1, 'replace',
  '{"amount":10000}'::jsonb
from public.profiles as owner
where owner.auth_user_id = '20000000-0000-0000-0000-000000000001';

insert into public.content_conflicts (
  id, project_id, operation_id, module, entity_id, field,
  current_value, incoming_value
) values (
  'conflict_budget', 'scr_security', 'op_budget', 'budget',
  'quote_budget', 'amount', '9000'::jsonb, '10000'::jsonb
);

insert into public.project_comments (
  id, project_id, module, entity_type, entity_id, body, author_user_id
)
select
  'comment_budget', 'scr_security', 'budget', 'quote', 'quote_budget',
  'Secret quote is 10000', owner.id
from public.profiles as owner
where owner.auth_user_id = '20000000-0000-0000-0000-000000000001';

insert into public.comment_mentions (comment_id, user_id)
select 'comment_budget', mentioned.id
from public.profiles as mentioned
where mentioned.auth_user_id = '20000000-0000-0000-0000-000000000002';

insert into public.canvas_workspaces (script_id, user_id, data)
select
  'scr_security', owner.id,
  '{"quotes":[{"vendor":"Secret Vendor","price":10000}]}'::jsonb
from public.profiles as owner
where owner.auth_user_id = '20000000-0000-0000-0000-000000000001';

insert into public.activity_events (
  id, project_id, module, actor_user_id, actor_type, entity_type,
  action, summary, contains_financial_data
)
select
  'activity_budget', 'scr_security', 'budget', owner.id, 'user',
  'quote', 'updated', 'Secret quote is 10000', false
from public.profiles as owner
where owner.auth_user_id = '20000000-0000-0000-0000-000000000001';

insert into public.notifications (
  id, user_id, project_id, type, title, message,
  contains_financial_data, metadata
)
select fixture.id, recipient.id, 'scr_security', 'mention', 'Budget mention',
  'Secret quote is 10000', false, '{"module":"budget"}'::jsonb
from (
  values
    ('notification_budget_no', '20000000-0000-0000-0000-000000000004'::uuid),
    ('notification_budget_global', '20000000-0000-0000-0000-000000000009'::uuid)
) as fixture(id, auth_user_id)
join public.profiles as recipient on recipient.auth_user_id = fixture.auth_user_id;

insert into public.notifications (
  id, user_id, project_id, type, title, message,
  contains_financial_data, metadata
)
select fixture.id, recipient.id, 'scr_security', fixture.type,
  fixture.title, fixture.message, false, fixture.metadata
from (
  values
    ('notification_no_script_mention', '20000000-0000-0000-0000-000000000002'::uuid, 'mention', 'Mention', 'TOP SECRET SCRIPT', '{}'::jsonb),
    ('notification_legacy_blank', '20000000-0000-0000-0000-000000000004'::uuid, 'important_project_change', 'Budget changed', 'Secret quote is 10000', '{}'::jsonb),
    ('notification_message_reader', '20000000-0000-0000-0000-000000000003'::uuid, 'message', 'Message', 'Authorized script message', '{}'::jsonb),
    ('notification_invitation', '20000000-0000-0000-0000-000000000008'::uuid, 'project_invitation', 'Invitation', 'You were invited to collaborate.', '{"invitationId":"inv_security","account_project_event":true}'::jsonb),
    ('notification_removed_marked', '20000000-0000-0000-0000-000000000010'::uuid, 'removed_from_project', 'Access removed', 'Your project access was removed.', '{"account_project_event":true}'::jsonb),
    ('notification_removed_unmarked', '20000000-0000-0000-0000-000000000010'::uuid, 'removed_from_project', 'Access removed', 'TOP SECRET SCRIPT', '{}'::jsonb)
) as fixture(id, auth_user_id, type, title, message, metadata)
join public.profiles as recipient on recipient.auth_user_id = fixture.auth_user_id;

create or replace function pg_temp.rejects_mismatched_collaboration_module()
returns boolean
language plpgsql
as $$
begin
  insert into public.collaboration_entities (
    project_id, document_id, module, entity_type, entity_id, value
  ) values (
    'scr_security', 'doc_budget', 'canvas', 'quote',
    'mislabeled_budget_quote', '{"amount":10000}'::jsonb
  );
  return false;
exception
  when foreign_key_violation then return true;
end;
$$;

select extensions.ok(
  pg_temp.rejects_mismatched_collaboration_module(),
  'child collaboration rows cannot relabel a budget document as Canvas'
);

select extensions.is(
  (
    select count(*)
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in (
        'activity_events', 'notifications', 'collaboration_documents',
        'collaboration_entities', 'collaboration_operations',
        'content_conflicts', 'project_comments', 'project_messages'
      )
  ),
  0::bigint,
  'project content is excluded from global Postgres Changes publication'
);

insert into public.media_objects (
  id, project_id, owner_user_id, bucket_id, object_path, kind,
  size_bytes, metadata
)
select media.id, media.project_id, owner.id, 'filmscript-private', media.object_path,
  media.kind, 1, media.metadata
from (
  values
    ('med_budget', 'scr_security', 'objects/budget.pdf', 'budget_receipt', '{"financial_department_id":"dept_art"}'::jsonb),
    ('med_shot', 'scr_security', 'objects/shot.png', 'shot_reference', '{}'::jsonb),
    ('med_canvas', 'scr_security', 'objects/canvas.png', 'canvas_asset', '{"access_module":"canvas"}'::jsonb),
    ('med_imagine', 'scr_security', 'objects/imagine.png', 'canvas_asset', '{"access_module":"imagine"}'::jsonb),
    ('med_unclassified', 'scr_security', 'objects/unclassified.png', 'canvas_asset', '{}'::jsonb),
    ('med_library_shared', null, 'objects/library-shared.png', 'canvas_asset',
      '{"access_module":"imagine","legacy_access_scope":"owner_only_cross_project_library","legacy_reference_project_ids":["scr_security","scr_replica"]}'::jsonb),
    ('med_file', 'scr_security', 'objects/project-file.pdf', 'project_file', '{}'::jsonb),
    ('med_export', 'scr_security', 'objects/project-export.pdf', 'project_export', '{}'::jsonb),
    ('med_account', null, 'objects/account.png', 'account_private', '{}'::jsonb)
) as media(id, project_id, object_path, kind, metadata)
cross join public.profiles as owner
where owner.auth_user_id = '20000000-0000-0000-0000-000000000001';

insert into public.media_objects (
  id, project_id, owner_user_id, bucket_id, object_path, kind,
  size_bytes, metadata
)
select
  'med_revoked', 'scr_security', revoked.id, 'filmscript-private',
  'objects/revoked-shot.png', 'shot_reference', 1, '{}'::jsonb
from public.profiles as revoked
where revoked.auth_user_id = '20000000-0000-0000-0000-000000000010';

insert into storage.objects (bucket_id, name, owner_id, metadata)
select bucket_id, object_path, '20000000-0000-0000-0000-000000000001', '{"size":1}'
from public.media_objects
where id like 'med_%';

-- An active membership is not enough to read screenplay content.
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';

select extensions.ok(
  public.has_project_access('scr_security'),
  'attack fixture is an active project member'
);
select extensions.is(
  (select count(*) from public.scripts where id = 'scr_security'),
  0::bigint,
  'script:no_access member cannot read scripts.text or scripts.blocks'
);
select extensions.is(
  (select count(*) from public.ai_job_statuses where id = 'job_security'),
  0::bigint,
  'script:no_access member cannot read AI input or output containing script text'
);
select extensions.is(
  (select count(*) from public.collaboration_documents where document_id = 'doc_script'),
  0::bigint,
  'script:no_access member cannot read script collaboration snapshots'
);
select extensions.is(
  (select count(*) from public.notifications where id = 'notification_no_script_mention'),
  0::bigint,
  'script:no_access member cannot read an unclassified project mention excerpt'
);
select extensions.is(
  (select count(*) from public.comment_mentions where comment_id = 'comment_budget'),
  0::bigint,
  'mentioned user cannot infer a comment ID after losing module access'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';

select extensions.is(
  (select count(*) from public.scripts where id = 'scr_security'),
  1::bigint,
  'script:view member can read the screenplay'
);
select extensions.is(
  (select count(*) from public.ai_job_statuses where id = 'job_security'),
  1::bigint,
  'script:view plus lumiere:view member can read safe AI job columns'
);
select extensions.is(
  (select count(*) from public.collaboration_documents where document_id = 'doc_script'),
  1::bigint,
  'script:view member can read script collaboration snapshots'
);
select extensions.is(
  (select count(*) from public.media_objects where id in ('med_file', 'med_export')),
  1::bigint,
  'files:view exposes project files but not project exports'
);
select extensions.is(
  (select count(*) from public.notifications where id = 'notification_message_reader'),
  1::bigint,
  'known message notification maps to script and remains visible to script:view'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
select extensions.is(
  (select count(*) from public.scripts where id = 'scr_security'),
  1::bigint,
  'project owner retains screenplay access'
);

-- Budget metadata and object bytes require both module and financial scope.
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000004';
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_budget'),
  0::bigint,
  'budget:view without financial access cannot read receipt metadata'
);
select extensions.is(
  (select count(*) from storage.objects where name = 'objects/budget.pdf'),
  0::bigint,
  'budget:view without financial access cannot read receipt object'
);
select extensions.is(
  (
    (select count(*) from public.collaboration_documents where document_id = 'doc_budget')
    + (select count(*) from public.collaboration_entities where entity_id = 'quote_budget')
    + (select count(*) from public.collaboration_operations where id = 'op_budget')
    + (select count(*) from public.content_conflicts where id = 'conflict_budget')
    + (select count(*) from public.project_comments where id = 'comment_budget')
  ),
  0::bigint,
  'budget collaboration data is hidden without global financial access'
);
select extensions.is(
  (select count(*) from public.activity_events where id = 'activity_budget'),
  0::bigint,
  'budget activity requires financial access even when legacy flag is false'
);
select extensions.is(
  (select count(*) from public.notifications
   where id in ('notification_budget_no', 'notification_legacy_blank')),
  0::bigint,
  'budget metadata and unclassified legacy notices fail closed despite false flags'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000005';
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_budget'),
  1::bigint,
  'department financial viewer can read matching receipt metadata'
);
select extensions.is(
  (select count(*) from storage.objects where name = 'objects/budget.pdf'),
  1::bigint,
  'department financial viewer can read matching receipt object'
);
select extensions.is(
  (
    (select count(*) from public.collaboration_documents where document_id = 'doc_budget')
    + (select count(*) from public.collaboration_entities where entity_id = 'quote_budget')
    + (select count(*) from public.collaboration_operations where id = 'op_budget')
    + (select count(*) from public.content_conflicts where id = 'conflict_budget')
    + (select count(*) from public.project_comments where id = 'comment_budget')
  ),
  0::bigint,
  'department-scoped finance cannot read mixed budget collaboration snapshots'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000009';
select extensions.is(
  (
    (select count(*) from public.collaboration_documents where document_id = 'doc_budget')
    + (select count(*) from public.collaboration_entities where entity_id = 'quote_budget')
    + (select count(*) from public.collaboration_operations where id = 'op_budget')
    + (select count(*) from public.content_conflicts where id = 'conflict_budget')
    + (select count(*) from public.project_comments where id = 'comment_budget')
  ),
  5::bigint,
  'budget:view plus financial.view_all can read budget collaboration data'
);
select extensions.is(
  (select count(*) from public.activity_events where id = 'activity_budget'),
  1::bigint,
  'global financial viewer can read budget activity'
);
select extensions.is(
  (select count(*) from public.notifications where id = 'notification_budget_global'),
  1::bigint,
  'global financial viewer can read their budget notification'
);

reset role;
update public.project_memberships
set status = 'revoked'
where id = 'mem_budget_global';
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000009';
select extensions.is(
  (select count(*) from public.notifications where id = 'notification_budget_global'),
  0::bigint,
  'revoking financial membership immediately hides an existing budget notification'
);

-- Each visual asset is bound to its declared module. Unknown classification
-- fails closed for collaborators.
reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_shot'),
  1::bigint,
  'shot_list:view member can read shot references'
);
select extensions.is(
  (select count(*) from public.media_objects where id in ('med_canvas', 'med_imagine')),
  0::bigint,
  'shot list permission does not expose Canvas or Imagine assets'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000006';
select extensions.throws_ok(
  $$ select data from public.canvas_workspaces where script_id = 'scr_security' $$,
  '42501',
  'permission denied for table canvas_workspaces',
  'authenticated Canvas users cannot read mixed quote and price snapshots directly'
);
select extensions.throws_ok(
  $$ update public.canvas_workspaces set data = '{}'::jsonb where script_id = 'scr_security' $$,
  '42501',
  'permission denied for table canvas_workspaces',
  'authenticated Canvas users cannot overwrite mixed quote and price snapshots directly'
);
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_canvas'),
  1::bigint,
  'canvas:view member can read Canvas-classified assets'
);
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_imagine'),
  0::bigint,
  'canvas:view does not expose Imagine-classified assets'
);
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_unclassified'),
  0::bigint,
  'unclassified canvas_asset fails closed for collaborator'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000007';
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_imagine'),
  1::bigint,
  'imagine:view member can read Imagine-classified assets'
);
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_canvas'),
  0::bigint,
  'imagine:view does not expose Canvas-classified assets'
);
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_account'),
  0::bigint,
  'project collaborator cannot read owner account-private media'
);
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_library_shared'),
  0::bigint,
  'Imagine collaborator cannot read a cross-project library asset scoped to its owner'
);
select extensions.is(
  (select count(*) from storage.objects where name = 'objects/library-shared.png'),
  0::bigint,
  'Imagine collaborator cannot read bytes for a cross-project library asset scoped to its owner'
);
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_export'),
  1::bigint,
  'exports:view authorizes project exports independently from project files'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000010';
select extensions.is(
  (select count(*) from public.media_objects where id = 'med_revoked'),
  0::bigint,
  'revoked uploader cannot use owner_user_id to read project media metadata'
);
select extensions.is(
  (select count(*) from storage.objects where name = 'objects/revoked-shot.png'),
  0::bigint,
  'revoked uploader cannot use Storage ownership to read project object bytes'
);
select extensions.is(
  (select count(*) from public.notifications
   where id in ('notification_removed_marked', 'notification_removed_unmarked')),
  1::bigint,
  'revoked recipient sees only the explicitly marked removal lifecycle notice'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000008';
select extensions.is(
  (select count(*) from public.notifications where id = 'notification_invitation'),
  1::bigint,
  'project invitation remains visible before the recipient becomes a member'
);
select extensions.is(
  (select count(*) from public.notifications
   where id in ('notification_removed_marked', 'notification_removed_unmarked')),
  0::bigint,
  'another user cannot read lifecycle notices addressed to the revoked recipient'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
select extensions.is(
  (select count(*) from public.media_objects where id like 'med_%'),
  10::bigint,
  'project owner retains access to classified, unclassified and account-private media'
);
select extensions.is(
  (select count(*) from storage.objects where name like 'objects/%'),
  10::bigint,
  'owner retains access to all corresponding private Storage objects'
);

reset role;

-- -------------------------------------------------------------------------
-- Private Realtime topics: canonical parsing, module/financial access,
-- user isolation, INSERT vs Presence permissions, and revocation.
-- -------------------------------------------------------------------------

-- An earlier notification test revokes this fixture to prove historical
-- notices disappear. Restore it solely for the independent Realtime matrix.
update public.project_memberships
set status = 'active'
where id = 'mem_budget_global';

insert into realtime.messages (topic, extension, event, private, payload)
values
  ('filmscript-probe', 'broadcast', 'filmscript_rt_seed_broadcast', true, '{}'::jsonb),
  ('filmscript-probe', 'presence', 'filmscript_rt_seed_presence', true, '{}'::jsonb),
  ('filmscript-probe', 'broadcast', 'filmscript_rt_seed_public', false, '{}'::jsonb);

create or replace function pg_temp.try_realtime_insert(
  requested_extension text,
  requested_private boolean,
  requested_event text
)
returns boolean
language plpgsql
as $$
begin
  insert into realtime.messages (topic, extension, event, private, payload)
  values (
    realtime.topic(), requested_extension, requested_event,
    requested_private, '{}'::jsonb
  );
  return true;
exception
  when insufficient_privilege then return false;
end;
$$;

set local role anon;
select set_config('realtime.topic', 'project:scr_security:script', true);
select extensions.is(
  (select count(*) from realtime.messages
   where event like 'filmscript_rt_seed_%'),
  0::bigint,
  'anon receives no Realtime rows despite Supabase-managed table grants'
);
select extensions.ok(
  not pg_temp.try_realtime_insert(
    'broadcast', true, 'filmscript_rt_anon_broadcast'
  ),
  'anon cannot publish even if Supabase restores its managed table grant'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
select extensions.ok(
  public.can_access_realtime_topic(
    'project:scr_security:script', 'broadcast', 'select', true
  ),
  'project owner can receive private Script broadcasts'
);
select extensions.ok(
  public.can_access_realtime_topic(
    'project:scr_security:script', 'broadcast', 'insert', true
  ),
  'project owner can publish private Script broadcasts'
);
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:script', 'broadcast', 'select', false
  ),
  'a public channel never satisfies FilmScript Realtime authorization'
);
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:script:extra', 'broadcast', 'select', true
  )
  and not public.can_access_realtime_topic(
    'project:scr_security:unknown', 'broadcast', 'select', true
  )
  and not public.can_access_realtime_topic(
    'project::script', 'broadcast', 'select', true
  ),
  'malformed and unknown project topics fail closed'
);
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:script', 'postgres_changes', 'select', true
  ),
  'Postgres Changes is never authorized through FilmScript private topics'
);
select set_config('realtime.topic', 'project:scr_security:script', true);
select extensions.is(
  (select count(*) from realtime.messages
   where event like 'filmscript_rt_seed_%'),
  2::bigint,
  'owner policy reads private Broadcast and Presence probes but not public rows'
);
select extensions.ok(
  pg_temp.try_realtime_insert(
    'broadcast', true, 'filmscript_rt_owner_broadcast'
  ),
  'owner INSERT policy permits a private Script broadcast'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
select extensions.ok(
  public.can_access_realtime_topic(
    'project:scr_security:script', 'broadcast', 'select', true
  ),
  'active script:view member can receive Script broadcasts'
);
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:script', 'broadcast', 'insert', true
  ),
  'script:view member cannot publish a Script broadcast'
);
select extensions.ok(
  public.can_access_realtime_topic(
    'project:scr_security:script', 'presence', 'insert', true
  ),
  'script:view member can publish Presence state'
);
select set_config('realtime.topic', 'project:scr_security:script', true);
select extensions.is(
  (select count(*) from realtime.messages
   where event like 'filmscript_rt_seed_%'),
  2::bigint,
  'script:view member SELECT policy receives private topic probes'
);
select extensions.ok(
  not pg_temp.try_realtime_insert(
    'broadcast', true, 'filmscript_rt_reader_broadcast'
  ),
  'script:view member INSERT policy rejects Broadcast'
);
select extensions.ok(
  pg_temp.try_realtime_insert(
    'presence', true, 'filmscript_rt_reader_presence'
  ),
  'script:view member INSERT policy permits Presence'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:script', 'broadcast', 'select', true
  ),
  'active project member with script:no_access cannot join Script topic'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000006';
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:canvas', 'broadcast', 'select', true
  ),
  'mixed Canvas payload topic remains disabled until a sanitized contract exists'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000010';
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:shot_list', 'presence', 'select', true
  ),
  'revoked membership cannot join a formerly visible module topic'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000008';
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:script', 'broadcast', 'select', true
  ),
  'project outsider cannot join any project topic by guessing its ID'
);
select set_config('realtime.topic', 'project:scr_security:script', true);
select extensions.is(
  (select count(*) from realtime.messages
   where event like 'filmscript_rt_seed_%'),
  0::bigint,
  'outsider SELECT policy exposes no private project probes'
);
select extensions.ok(
  public.can_access_realtime_topic(
    'user:' || public.current_app_user_id(), 'broadcast', 'select', true
  ),
  'linked user can join only their own canonical user topic'
);
select extensions.ok(
  not public.can_access_realtime_topic(
    'user:usr_not_the_current_profile', 'broadcast', 'select', true
  ),
  'linked user cannot join another user topic'
);
select set_config(
  'realtime.topic',
  'user:' || public.current_app_user_id(),
  true
);
select extensions.is(
  (select count(*) from realtime.messages
   where event like 'filmscript_rt_seed_%'),
  2::bigint,
  'own user topic SELECT policy receives private probes'
);
select set_config('realtime.topic', 'user:usr_not_the_current_profile', true);
select extensions.is(
  (select count(*) from realtime.messages
   where event like 'filmscript_rt_seed_%'),
  0::bigint,
  'another user topic exposes no probes'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000004';
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:budget', 'broadcast', 'select', true
  ),
  'budget:view without financial access cannot receive Budget topic data'
);
select set_config('realtime.topic', 'project:scr_security:budget', true);
select extensions.is(
  (select count(*) from realtime.messages
   where event like 'filmscript_rt_seed_%'),
  0::bigint,
  'Budget topic policy exposes no probes without financial access'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000005';
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:budget', 'presence', 'select', true
  ),
  'department-only finance permission cannot join project-wide Budget topic'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000009';
select extensions.ok(
  public.can_access_realtime_topic(
    'project:scr_security:budget', 'broadcast', 'select', true
  ),
  'global financial viewer can receive the project-wide Budget topic'
);
select extensions.ok(
  not public.can_access_realtime_topic(
    'project:scr_security:budget', 'broadcast', 'insert', true
  ),
  'global financial viewer without edit cannot broadcast Budget changes'
);
select extensions.ok(
  public.can_access_realtime_topic(
    'project:scr_security:budget', 'presence', 'insert', true
  ),
  'global financial viewer can publish Budget Presence state'
);
select set_config('realtime.topic', 'project:scr_security:budget', true);
select extensions.is(
  (select count(*) from realtime.messages
   where event like 'filmscript_rt_seed_%'),
  2::bigint,
  'global financial viewer SELECT policy receives private Budget probes'
);
reset role;

update public.project_memberships
set status = 'revoked'
where id = 'mem_reader';

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
select set_config('realtime.topic', 'project:scr_security:script', true);
select extensions.is(
  (select count(*) from realtime.messages
   where event like 'filmscript_rt_seed_%'),
  0::bigint,
  'fresh authorization check denies a member immediately after revocation'
);
reset role;

select * from extensions.finish();
rollback;
