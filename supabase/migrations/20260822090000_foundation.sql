-- FilmScript PostgreSQL foundation.
--
-- The browser-facing Data API exposes only `public`. Secrets, provider state,
-- one-time tokens and raw migration bookkeeping live in non-exposed schemas.

create schema if not exists private;
create schema if not exists billing;

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

revoke all on schema private from public, anon, authenticated;
revoke all on schema billing from public, anon, authenticated;
grant usage on schema private, billing to service_role;

alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema billing revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated;
alter default privileges in schema billing revoke all on sequences from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public, anon, authenticated;
alter default privileges in schema billing revoke all on functions from public, anon, authenticated;
alter default privileges in schema private grant all on tables to service_role;
alter default privileges in schema billing grant all on tables to service_role;
alter default privileges in schema private grant all on sequences to service_role;
alter default privileges in schema billing grant all on sequences to service_role;
alter default privileges in schema private grant execute on functions to service_role;
alter default privileges in schema billing grant execute on functions to service_role;

create table private.migration_control (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default statement_timestamp(),
  constraint migration_control_value_object check (jsonb_typeof(value) = 'object')
);

comment on table private.migration_control is
  'Server-only checkpoints and reconciliation evidence for the SQLite-to-Postgres cutover.';

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.set_updated_at() to service_role;

create or replace function public.permission_rank(level text)
returns smallint
language sql
immutable
strict
set search_path = ''
as $$
  select case level
    when 'no_access' then 0
    when 'view' then 1
    when 'comment' then 2
    when 'edit' then 3
    when 'manage' then 4
    else 0
  end::smallint;
$$;

revoke all on function public.permission_rank(text) from public, anon;
grant execute on function public.permission_rank(text) to authenticated, service_role;

insert into private.migration_control (key, value)
values (
  'source_schema',
  jsonb_build_object(
    'adapter', 'sqlite',
    'version', 18,
    'captured_from', 'origin/main',
    'legacy_sessions_imported', false
  )
)
on conflict (key) do update
set value = excluded.value,
    updated_at = statement_timestamp();

comment on schema private is
  'FilmScript server-only data. This schema must never be added to PostgREST exposed schemas.';
comment on schema billing is
  'FilmScript billing and webhook state. This schema must never be added to PostgREST exposed schemas.';
