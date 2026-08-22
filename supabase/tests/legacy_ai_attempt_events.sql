begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(4);

select extensions.is(
  (select count(*)
   from pg_catalog.pg_constraint
   where conrelid = 'private.ai_job_attempts'::regclass
     and conname = 'ai_job_attempts_job_id_attempt_number_key'),
  0::bigint,
  'legacy AI attempt events are not constrained unique by job and attempt number'
);

select extensions.ok(
  exists (
    select 1
    from pg_catalog.pg_class as index_relation
    join pg_catalog.pg_index as index_definition
      on index_definition.indexrelid = index_relation.oid
    where index_definition.indrelid = 'private.ai_job_attempts'::regclass
      and index_relation.relname = 'ai_job_attempts_job_idx'
      and index_definition.indisunique is false
  ),
  'the non-unique job/attempt/timestamp lookup index remains available'
);

insert into public.profiles (id)
values ('usr_legacy_attempt_events');

insert into public.scripts (id, user_id, title)
values ('scr_legacy_attempt_events', 'usr_legacy_attempt_events', 'Legacy attempt events');

insert into public.ai_jobs (
  id, project_id, requested_by_user_id, type, status, progress, stage,
  source_script_id, source_script_version_id, source_content_hash,
  internal_primary_model, idempotency_key
) values (
  'job_legacy_attempt_events', 'scr_legacy_attempt_events',
  'usr_legacy_attempt_events', 'breakdown', 'completed', 100, 'completed',
  'scr_legacy_attempt_events', 'legacy-v1', 'legacy-content-hash',
  'gpt-5.6-terra', 'legacy-attempt-events-idempotency'
);

insert into private.ai_job_attempts (
  id, job_id, attempt_number, model_id, is_fallback, outcome, created_at
) values
  (
    'aia_legacy_attempt_event_01', 'job_legacy_attempt_events', 1,
    'gpt-5.6-terra', false, 'completed', '2026-08-19T21:20:32.145Z'
  ),
  (
    'aia_legacy_attempt_event_02', 'job_legacy_attempt_events', 1,
    'gpt-5.6-terra', false, 'completed', '2026-08-19T21:21:05.755Z'
  ),
  (
    'aia_legacy_attempt_event_03', 'job_legacy_attempt_events', 1,
    'gpt-5.6-terra', false, 'completed', '2026-08-19T21:21:11.485Z'
  );

select extensions.is(
  (select count(*)
   from private.ai_job_attempts
   where job_id = 'job_legacy_attempt_events'
     and attempt_number = 1),
  3::bigint,
  'three real-shaped provider events survive under the same attempt number'
);

select extensions.is(
  (select array_agg(id order by created_at, id)
   from private.ai_job_attempts
   where job_id = 'job_legacy_attempt_events'
     and attempt_number = 1),
  array[
    'aia_legacy_attempt_event_01',
    'aia_legacy_attempt_event_02',
    'aia_legacy_attempt_event_03'
  ]::text[],
  'event ids and timestamps preserve the historical provider-call order'
);

select * from extensions.finish();
rollback;
