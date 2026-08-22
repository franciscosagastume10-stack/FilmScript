-- Collaboration, activity, notifications and durable AI state.

create table public.activity_events (
  id text primary key,
  project_id text not null references public.scripts(id) on delete cascade,
  module text not null,
  actor_user_id text references public.profiles(id) on delete set null,
  actor_type text not null,
  entity_type text not null,
  entity_id text,
  action text not null,
  summary text not null,
  before jsonb,
  after jsonb,
  contains_financial_data boolean not null default false,
  financial_department_id text,
  aggregation_key text,
  aggregation_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint activity_events_aggregation_count_positive check (aggregation_count >= 1),
  constraint activity_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index activity_events_project_idx
  on public.activity_events(project_id, module, created_at desc);
create index activity_events_aggregation_idx
  on public.activity_events(project_id, aggregation_key, updated_at desc)
  where aggregation_key is not null;

create trigger activity_events_set_updated_at
before update on public.activity_events
for each row execute function private.set_updated_at();

create table public.notifications (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  project_id text references public.scripts(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  actor_user_id text references public.profiles(id) on delete set null,
  deep_link text,
  contains_financial_data boolean not null default false,
  financial_department_id text,
  aggregation_key text,
  aggregation_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint notifications_aggregation_count_positive check (aggregation_count >= 1),
  constraint notifications_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index notifications_user_idx
  on public.notifications(user_id, read_at, updated_at desc);

create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function private.set_updated_at();

create table public.ai_jobs (
  id text primary key,
  project_id text not null references public.scripts(id) on delete cascade,
  requested_by_user_id text not null references public.profiles(id),
  type text not null,
  status text not null,
  progress integer not null default 0,
  stage text not null,
  source_script_id text not null references public.scripts(id) on delete cascade,
  source_script_version_id text not null,
  source_content_hash text not null,
  internal_primary_model text not null,
  internal_completed_model text,
  used_fallback boolean not null default false,
  reserved_credits integer not null default 0,
  settled_credits integer not null default 0,
  idempotency_key text not null unique,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  output_schema_version integer not null default 1,
  error_code text,
  created_at timestamptz not null default statement_timestamp(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  constraint ai_jobs_progress_range check (progress between 0 and 100),
  constraint ai_jobs_reserved_credits_nonnegative check (reserved_credits >= 0),
  constraint ai_jobs_settled_credits_nonnegative check (settled_credits >= 0),
  constraint ai_jobs_input_object check (jsonb_typeof(input) = 'object'),
  constraint ai_jobs_output_schema_version_positive check (output_schema_version >= 1)
);

create index ai_jobs_user_idx
  on public.ai_jobs(requested_by_user_id, status, updated_at desc);
create index ai_jobs_project_idx
  on public.ai_jobs(project_id, type, updated_at desc);

create trigger ai_jobs_set_updated_at
before update on public.ai_jobs
for each row execute function private.set_updated_at();

create table public.collaboration_documents (
  project_id text not null references public.scripts(id) on delete cascade,
  document_id text not null,
  module text not null,
  snapshot bytea not null,
  version integer not null default 0,
  updated_at timestamptz not null default statement_timestamp(),
  primary key(project_id, document_id),
  unique(project_id, document_id, module),
  constraint collaboration_documents_version_nonnegative check (version >= 0)
);

create trigger collaboration_documents_set_updated_at
before update on public.collaboration_documents
for each row execute function private.set_updated_at();

create table public.collaboration_entities (
  project_id text not null,
  document_id text not null,
  module text not null,
  entity_type text not null,
  entity_id text not null,
  value jsonb not null,
  field_versions jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default statement_timestamp(),
  primary key(project_id, document_id, entity_id),
  foreign key(project_id, document_id, module)
    references public.collaboration_documents(project_id, document_id, module)
    on delete cascade,
  constraint collaboration_entities_field_versions_object check (jsonb_typeof(field_versions) = 'object'),
  constraint collaboration_entities_version_nonnegative check (version >= 0)
);

create index collaboration_entities_module_idx
  on public.collaboration_entities(project_id, module, document_id);

create trigger collaboration_entities_set_updated_at
before update on public.collaboration_entities
for each row execute function private.set_updated_at();

create table public.collaboration_operations (
  id text primary key,
  project_id text not null,
  document_id text not null,
  module text not null,
  entity_type text not null,
  entity_id text not null,
  actor_user_id text not null references public.profiles(id),
  base_version integer not null,
  committed_version integer not null,
  operation_type text not null,
  patch jsonb not null,
  previous jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  unique(id, project_id, module),
  foreign key(project_id, document_id, module)
    references public.collaboration_documents(project_id, document_id, module)
    on delete cascade,
  constraint collaboration_operations_base_version_nonnegative check (base_version >= 0),
  constraint collaboration_operations_committed_version_positive check (committed_version >= 1),
  constraint collaboration_operations_previous_object check (jsonb_typeof(previous) = 'object')
);

create index collaboration_operations_delta_idx
  on public.collaboration_operations(project_id, document_id, committed_version);

create table public.content_conflicts (
  id text primary key,
  project_id text not null references public.scripts(id) on delete cascade,
  operation_id text not null,
  module text not null,
  entity_id text not null,
  field text not null,
  current_value jsonb,
  incoming_value jsonb,
  status text not null default 'open',
  resolved_by_user_id text references public.profiles(id) on delete set null,
  resolution jsonb,
  created_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz,
  foreign key(operation_id, project_id, module)
    references public.collaboration_operations(id, project_id, module)
    on delete cascade
);

create index content_conflicts_project_idx
  on public.content_conflicts(project_id, status, created_at desc);

create table public.project_comments (
  id text primary key,
  project_id text not null references public.scripts(id) on delete cascade,
  module text not null,
  entity_type text not null,
  entity_id text,
  coordinate jsonb,
  body text not null,
  author_user_id text references public.profiles(id) on delete set null,
  guest_id text,
  parent_comment_id text references public.project_comments(id) on delete cascade,
  resolved_at timestamptz,
  resolved_by_user_id text references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  -- A deleted profile leaves an authored comment as an unattributed tombstone.
  constraint project_comments_author check (num_nonnulls(author_user_id, guest_id) <= 1),
  constraint project_comments_body_not_blank check (btrim(body) <> '')
);

create index project_comments_entity_idx
  on public.project_comments(project_id, module, entity_id, created_at);

create trigger project_comments_set_updated_at
before update on public.project_comments
for each row execute function private.set_updated_at();

create table public.comment_mentions (
  comment_id text not null references public.project_comments(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  primary key(comment_id, user_id)
);

create index comment_mentions_user_idx
  on public.comment_mentions(user_id, created_at desc);

create table public.project_messages (
  id text primary key,
  project_id text not null references public.scripts(id) on delete cascade,
  sender_user_id text not null references public.profiles(id) on delete cascade,
  recipient_user_id text not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default statement_timestamp(),
  read_at timestamptz,
  constraint project_messages_body_not_blank check (btrim(body) <> ''),
  constraint project_messages_distinct_users check (sender_user_id <> recipient_user_id)
);

create index project_messages_thread_idx
  on public.project_messages(project_id, sender_user_id, recipient_user_id, created_at);

create table public.release_notice_acknowledgements (
  user_id text not null references public.profiles(id) on delete cascade,
  release_version text not null,
  presented_at timestamptz not null default statement_timestamp(),
  acknowledged_at timestamptz,
  primary key(user_id, release_version)
);

create index release_notice_acknowledgements_release_idx
  on public.release_notice_acknowledgements(release_version, presented_at desc);

create table private.ai_job_attempts (
  id text primary key,
  job_id text not null references public.ai_jobs(id) on delete cascade,
  attempt_number integer not null,
  model_id text not null,
  is_fallback boolean not null default false,
  outcome text not null,
  error_code text,
  created_at timestamptz not null default statement_timestamp(),
  constraint ai_job_attempts_attempt_positive check (attempt_number >= 1),
  unique(job_id, attempt_number)
);

create index ai_job_attempts_job_idx
  on private.ai_job_attempts(job_id, attempt_number, created_at);

comment on table private.ai_job_attempts is
  'Provider/model audit data; intentionally unavailable through the browser Data API.';
