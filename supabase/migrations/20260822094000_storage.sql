-- Durable metadata for private objects. PostgreSQL backups do not contain
-- Storage object bytes, so sha256 and size are retained for reconciliation.

create table public.media_objects (
  id text primary key,
  project_id text references public.scripts(id) on delete cascade,
  owner_user_id text not null references public.profiles(id) on delete cascade,
  bucket_id text not null default 'filmscript-private',
  object_path text not null,
  kind text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint not null,
  sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint media_objects_id_not_blank check (btrim(id) <> ''),
  constraint media_objects_path_not_blank check (btrim(object_path) <> ''),
  constraint media_objects_size_nonnegative check (size_bytes >= 0),
  constraint media_objects_sha256_format check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  constraint media_objects_metadata_object check (jsonb_typeof(metadata) = 'object'),
  unique(bucket_id, object_path)
);

create index media_objects_project_idx
  on public.media_objects(project_id, created_at desc)
  where project_id is not null;
create index media_objects_owner_idx
  on public.media_objects(owner_user_id, created_at desc);

create trigger media_objects_set_updated_at
before update on public.media_objects
for each row execute function private.set_updated_at();

create table private.budget_receipts (
  id text primary key,
  script_id text not null references public.scripts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  media_object_id text not null unique references public.media_objects(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  legacy_blob_sha256 text,
  created_at timestamptz not null default statement_timestamp(),
  constraint budget_receipts_size_nonnegative check (size_bytes >= 0),
  constraint budget_receipts_sha256_format check (
    legacy_blob_sha256 is null or legacy_blob_sha256 ~ '^[0-9a-f]{64}$'
  )
);

create index budget_receipts_script_idx
  on private.budget_receipts(script_id, created_at desc);

comment on table private.budget_receipts is
  'Metadata replacing SQLite data_blob. Object bytes live in the private Supabase Storage bucket.';

insert into storage.buckets (id, name, public, file_size_limit)
values ('filmscript-private', 'filmscript-private', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

comment on table public.media_objects is
  'Canonical object manifest used to authorize access and independently reconcile Storage backups.';
