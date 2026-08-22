import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const migrationFiles = fs.readdirSync(migrationsDirectory)
  .filter((filename) => filename.endsWith(".sql"))
  .sort();
const migrations = Object.fromEntries(migrationFiles.map((filename) => [
  filename,
  fs.readFileSync(path.join(migrationsDirectory, filename), "utf8"),
]));
const allSql = Object.values(migrations).join("\n");
const supabaseConfig = fs.readFileSync(path.join(root, "supabase", "config.toml"), "utf8");

test("Supabase migrations preserve FilmScript IDs and translate SQLite values", () => {
  for (const expected of [
    "20260822090000_foundation.sql",
    "20260822091000_identity_projects.sql",
    "20260822092000_production_modules.sql",
    "20260822093000_collaboration_ai.sql",
    "20260822094000_storage.sql",
    "20260822095000_private_billing_credits.sql",
    "20260822100000_rls.sql",
    "20260822101000_realtime.sql",
    "20260822103000_realtime_authorization.sql",
  ]) {
    assert.ok(migrationFiles.includes(expected), `missing ${expected}`);
  }
  for (const table of ["profiles", "scripts", "project_memberships", "ai_jobs", "media_objects"]) {
    assert.match(allSql, new RegExp(`create table public\\.${table} \\(`, "i"));
  }
  assert.match(allSql, /create table public\.scripts \([\s\S]*?id text primary key/i);
  assert.match(allSql, /blocks jsonb not null default '\[\]'::jsonb/i);
  assert.match(allSql, /email_verified boolean not null default false/i);
  assert.match(allSql, /snapshot bytea not null/i);
  assert.doesNotMatch(allSql, /data_blob\s+bytea/i);
});

test("secrets, billing, receipts and provider attempts are not browser tables", () => {
  for (const table of [
    "project_invitations",
    "project_guest_sessions",
    "shared_projects",
    "budget_receipts",
    "ai_job_attempts",
    "app_settings",
  ]) {
    assert.match(allSql, new RegExp(`create table private\\.${table} \\(`, "i"));
  }
  for (const table of [
    "subscriptions",
    "checkouts",
    "subscription_switch_previews",
    "processed_events",
  ]) {
    assert.match(allSql, new RegExp(`create table billing\\.${table} \\(`, "i"));
  }
  assert.doesNotMatch(allSql, /create table (?:public\.)?(?:sessions|oauth_states|auth_handoffs)\s*\(/i);
  assert.match(allSql, /legacy_sessions_imported', false/i);
});

test("RLS is explicit and security definer functions pin search_path", () => {
  const identitySql = migrations["20260822091000_identity_projects.sql"];
  const rlsSql = migrations["20260822100000_rls.sql"];
  assert.ok(identitySql);
  assert.ok(rlsSql);

  const definerFunctions = identitySql.match(/security definer[\s\S]*?\$\$;/gi) || [];
  assert.ok(definerFunctions.length >= 6);
  for (const definition of definerFunctions) {
    assert.match(definition, /set search_path = ''/i);
  }

  for (const table of [
    "profiles",
    "scripts",
    "project_memberships",
    "preproduction_projects",
    "notifications",
    "project_comments",
    "project_messages",
    "media_objects",
  ]) {
    assert.match(rlsSql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }

  assert.match(rlsSql, /revoke all on all tables in schema private from public, anon, authenticated/i);
  assert.match(rlsSql, /revoke all on all tables in schema billing from public, anon, authenticated/i);
  assert.match(
    rlsSql,
    /create view public\.my_profile\s+with \(security_invoker = true, security_barrier = true\)/i,
  );
  assert.match(
    rlsSql,
    /create view public\.profile_directory\s+with \(security_invoker = true, security_barrier = true\)/i,
  );
  for (const functionName of ["get_my_profile", "get_visible_profile_directory"]) {
    assert.match(
      rlsSql,
      new RegExp(`function public\\.${functionName}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`, "i"),
    );
  }
  assert.doesNotMatch(
    rlsSql,
    /grant select \([\s\S]*?internal_primary_model[\s\S]*?\) on public\.ai_jobs to authenticated/i,
  );
});

test("Storage remains private and has an independent reconciliation manifest", () => {
  const storageSql = migrations["20260822094000_storage.sql"];
  const rlsSql = migrations["20260822100000_rls.sql"];
  assert.match(storageSql, /values \('filmscript-private', 'filmscript-private', false, 52428800\)/i);
  assert.match(storageSql, /sha256 text/i);
  assert.match(storageSql, /unique\(bucket_id, object_path\)/i);
  assert.match(rlsSql, /create policy filmscript_private_objects_select/i);
  assert.match(rlsSql, /function public\.can_read_media\([\s\S]*?security definer[\s\S]*?set search_path = ''/i);
  assert.match(rlsSql, /requested_kind, ''\)\) = 'budget_receipt'[\s\S]*?has_financial_access/i);
  assert.match(rlsSql, /requested_metadata ->> 'access_module'/i);
  assert.match(rlsSql, /requested_project_id is null then[\s\S]*?requested_owner_user_id = public\.current_app_user_id\(\)/i);
  assert.match(rlsSql, /requested_kind, ''\)\) = 'project_export'[\s\S]*?'exports', 'view'/i);
  assert.doesNotMatch(rlsSql, /create policy filmscript_private_objects_(?:insert|update|delete)/i);
});

test("script content and Auth claims fail closed", () => {
  const identitySql = migrations["20260822091000_identity_projects.sql"];
  const previewSql = migrations["20260822102000_preview_api.sql"];
  const rlsSql = migrations["20260822100000_rls.sql"];
  assert.match(
    rlsSql,
    /create policy scripts_select_member[\s\S]*?has_project_permission\(id, 'script', 'view'\)/i,
  );
  assert.match(
    rlsSql,
    /create policy ai_jobs_select_authorized[\s\S]*?has_project_permission\(project_id, 'script', 'view'\)[\s\S]*?has_project_permission\(project_id, 'lumiere', 'view'\)/i,
  );
  assert.match(identitySql, /function private\.sync_auth_user_profile\([\s\S]*?security definer[\s\S]*?set search_path = ''/i);
  assert.match(identitySql, /auth_confirmed_at is null then[\s\S]*?return null/i);
  assert.match(identitySql, /identity\.provider = 'google'[\s\S]*?from auth\.identities as identity/i);
  assert.match(identitySql, /identity\.identity_data ->> 'sub'[\s\S]*?= identity\.provider_id/i);
  assert.match(identitySql, /profile\.google_sub = google_subject[\s\S]*?subject_profile_count = 1 and verified_subject_profile_count = 1[\s\S]*?auth_user_id = target_auth_user_id/i);
  assert.match(identitySql, /profile\.email = auth_email[\s\S]*?if legacy_email_candidate_count > 0 then[\s\S]*?return null/i);
  assert.doesNotMatch(identitySql, /raw_user_meta_data\s*->>\s*'provider_id'/i);
  assert.match(identitySql, /generated_profile_id := 'usr_'[\s\S]*?insert into public\.profiles/i);
  assert.match(identitySql, /after insert or update of email_confirmed_at, email on auth\.users/i);
  assert.match(identitySql, /after insert or update of provider, provider_id, identity_data on auth\.identities/i);
  assert.match(identitySql, /function private\.handle_new_auth_user\(\)[\s\S]*?sync_auth_user_profile\(new\.id\)/i);
  assert.match(identitySql, /function private\.handle_auth_identity_ready\(\)[\s\S]*?new\.provider = 'google'[\s\S]*?sync_auth_user_profile\(new\.user_id\)/i);
  assert.match(identitySql, /function private\.link_verified_auth_user_to_profile\(/i);
  assert.match(identitySql, /if profile_verified is not true then/i);
  assert.match(previewSql, /function public\.preview_claim_verified_legacy_profile\(\)[\s\S]*?identity\.identity_data ->> 'sub'[\s\S]*?= identity\.provider_id[\s\S]*?from auth\.identities as identity[\s\S]*?private\.sync_auth_user_profile\(caller_auth_user_id\)/i);
  assert.doesNotMatch(previewSql, /raise notice/i);
  assert.match(supabaseConfig, /\[auth\.email\][\s\S]*?enable_confirmations = true/i);
});

test("mixed financial snapshots and collaboration modules fail closed", () => {
  const collaborationSql = migrations["20260822093000_collaboration_ai.sql"];
  const rlsSql = migrations["20260822100000_rls.sql"];
  const realtimeSql = migrations["20260822101000_realtime.sql"];

  assert.doesNotMatch(rlsSql, /create policy canvas_workspaces_/i);
  assert.doesNotMatch(rlsSql, /grant (?:select|insert|update|delete)[\s\S]*?on public\.canvas_workspaces to authenticated/i);
  assert.match(
    collaborationSql,
    /foreign key\(project_id, document_id, module\)[\s\S]*?references public\.collaboration_documents\(project_id, document_id, module\)/i,
  );
  assert.match(
    collaborationSql,
    /foreign key\(operation_id, project_id, module\)[\s\S]*?references public\.collaboration_operations\(id, project_id, module\)/i,
  );
  assert.match(rlsSql, /function public\.can_access_project_module\([\s\S]*?lower\(coalesce\(requested_module, ''\)\) <> 'budget'[\s\S]*?has_financial_access/i);
  assert.match(rlsSql, /create policy activity_events_select_member[\s\S]*?lower\(coalesce\(module, ''\)\) <> 'budget'[\s\S]*?has_financial_access/i);
  assert.match(rlsSql, /function public\.can_read_notification\([\s\S]*?requested_metadata ->> 'module'[\s\S]*?has_project_permission[\s\S]*?has_financial_access/i);
  assert.match(rlsSql, /'message', 'translation_completed', 'translation_failed'[\s\S]*?then 'script'/i);
  assert.match(rlsSql, /'project_invitation', 'removed_from_project',[\s\S]*?'permission_changed', 'ownership_transfer'[\s\S]*?requested_metadata ->> 'account_project_event'[\s\S]*?'project_invitation', 'removed_from_project'[\s\S]*?has_project_access/i);
  assert.doesNotMatch(realtimeSql, /alter publication supabase_realtime add table/i);
  assert.match(realtimeSql, /alter publication supabase_realtime drop table/i);
  assert.match(realtimeSql, /replica identity default/i);
});

test("Realtime accepts only private canonical project and user topics", () => {
  const authorizationSql = migrations["20260822103000_realtime_authorization.sql"];
  assert.match(
    authorizationSql,
    /function public\.can_access_realtime_topic\([\s\S]*?security definer[\s\S]*?set search_path = ''/i,
  );
  assert.match(authorizationSql, /requested_private is not true[\s\S]*?return false/i);
  assert.match(authorizationSql, /requested_extension not in \('broadcast', 'presence'\)/i);
  assert.match(authorizationSql, /array_length\(topic_parts, 1\) = 2[\s\S]*?topic_parts\[1\] = 'user'[\s\S]*?topic_parts\[2\] = app_user_id/i);
  assert.match(authorizationSql, /array_length\(topic_parts, 1\) <> 3[\s\S]*?topic_parts\[1\] <> 'project'[\s\S]*?topic_parts\[3\] not in/i);
  assert.doesNotMatch(
    authorizationSql,
    /topic_parts\[3\] not in \([\s\S]*?'canvas'[\s\S]*?\) then/i,
  );
  assert.match(authorizationSql, /requested_operation = 'insert' and requested_extension = 'broadcast'[\s\S]*?needed_level := 'edit'/i);
  assert.match(authorizationSql, /has_project_permission\([\s\S]*?project_module,[\s\S]*?needed_level/i);
  assert.match(authorizationSql, /project_module = 'budget'[\s\S]*?has_financial_access\([\s\S]*?needs_financial_edit/i);
  assert.match(authorizationSql, /create policy filmscript_private_topics_select[\s\S]*?\(select realtime\.topic\(\)\)[\s\S]*?'select'/i);
  assert.match(authorizationSql, /create policy filmscript_private_topics_insert[\s\S]*?\(select realtime\.topic\(\)\)[\s\S]*?'insert'/i);
  assert.match(authorizationSql, /create policy filmscript_private_topics_select[\s\S]*?to authenticated/i);
  assert.match(authorizationSql, /create policy filmscript_private_topics_insert[\s\S]*?to authenticated/i);
  assert.doesNotMatch(authorizationSql, /create policy [^\n]+[\s\S]*?to anon/i);
});
