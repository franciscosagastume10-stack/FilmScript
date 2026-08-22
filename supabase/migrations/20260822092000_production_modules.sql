-- Script-adjacent production state from SQLite schema v18.

create table public.preproduction_projects (
  script_id text primary key references public.scripts(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default statement_timestamp(),
  constraint preproduction_projects_data_object check (jsonb_typeof(data) = 'object')
);

comment on table public.preproduction_projects is
  'Mixed-module legacy snapshot. Kept server-only because one JSON document can contain financial and non-financial data.';

create trigger preproduction_projects_set_updated_at
before update on public.preproduction_projects
for each row execute function private.set_updated_at();

create table public.canvas_workspaces (
  script_id text primary key references public.scripts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default statement_timestamp(),
  constraint canvas_workspaces_data_object check (jsonb_typeof(data) = 'object')
);

create index canvas_workspaces_user_idx
  on public.canvas_workspaces(user_id, updated_at desc);

create trigger canvas_workspaces_set_updated_at
before update on public.canvas_workspaces
for each row execute function private.set_updated_at();

create table public.canvas_libraries (
  user_id text primary key references public.profiles(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default statement_timestamp(),
  constraint canvas_libraries_data_object check (jsonb_typeof(data) = 'object')
);

create trigger canvas_libraries_set_updated_at
before update on public.canvas_libraries
for each row execute function private.set_updated_at();

create table public.location_plans (
  id text primary key,
  project_id text not null references public.scripts(id) on delete cascade,
  name text not null,
  data jsonb not null,
  version integer not null default 1,
  created_by_user_id text not null references public.profiles(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint location_plans_id_not_blank check (btrim(id) <> ''),
  constraint location_plans_name_not_blank check (btrim(name) <> ''),
  constraint location_plans_data_object check (jsonb_typeof(data) = 'object'),
  constraint location_plans_version_nonnegative check (version >= 0)
);

create index location_plans_project_idx
  on public.location_plans(project_id, updated_at desc);

create trigger location_plans_set_updated_at
before update on public.location_plans
for each row execute function private.set_updated_at();
