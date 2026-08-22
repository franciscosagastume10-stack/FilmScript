import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createSupabasePreviewHandler } from "../backend/supabase/handler.js";
import { postgresEnvironmentFromUrl, resolvePsqlBin } from "../scripts/supabase-migration/lib/common.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrations = fs.readdirSync(path.join(ROOT, "supabase", "migrations"))
  .filter((filename) => filename.endsWith(".sql"))
  .sort()
  .map((filename) => fs.readFileSync(path.join(ROOT, "supabase", "migrations", filename), "utf8"))
  .join("\n");

const previewEnvironment = Object.freeze({
  FILMSCRIPT_SUPABASE_PREVIEW_ENABLED: "true",
  FILMSCRIPT_SUPABASE_PREVIEW_MODE: "isolated",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "preview-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "preview-service-role-key",
  VERCEL_ENV: "preview",
});

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    chunks: [],
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    end(value) { if (value !== undefined) this.chunks.push(Buffer.from(value)); },
    json() { return JSON.parse(Buffer.concat(this.chunks).toString("utf8")); },
  };
}

function request({ method = "GET", url, path: requestPath, headers = {}, body = null }) {
  const req = Readable.from(body == null ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(body)]);
  req.method = method;
  req.url = url;
  req.query = requestPath == null ? {} : { path: requestPath };
  req.headers = headers;
  return req;
}

function jsonResponse(payload, status = 200) {
  return new Response(payload == null ? null : JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authenticatedFetch(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = new URL(url);
    calls.push({ target, options });
    if (overrides.handle) {
      const overridden = await overrides.handle(target, options, calls);
      if (overridden) return overridden;
    }
    if (target.pathname === "/auth/v1/user") {
      return jsonResponse({ id: "00000000-0000-4000-8000-000000000001", email_confirmed_at: "2026-08-22T00:00:00Z" });
    }
    if (target.pathname === "/rest/v1/rpc/get_my_profile") {
      return jsonResponse([{ id: "usr_aaaaaaaaaaaaaaaaaaaa", email: "preview@example.com" }]);
    }
    throw new Error(`Unhandled preview fetch: ${options.method || "GET"} ${target.pathname}`);
  };
  return { fetchImpl, calls };
}

test("Supabase Preview flags fail closed and reject production or a shared cloud project", async () => {
  for (const environment of [
    {},
    { ...previewEnvironment, VERCEL_ENV: "production" },
    {
      ...previewEnvironment,
      SUPABASE_URL: "https://prodref.supabase.co",
      FILMSCRIPT_SUPABASE_PREVIEW_PROJECT_REF: "prodref",
      FILMSCRIPT_SUPABASE_PRODUCTION_PROJECT_REF: "prodref",
    },
  ]) {
    let contacted = false;
    const handler = createSupabasePreviewHandler({ environment, fetchImpl: async () => { contacted = true; return jsonResponse({}); } });
    const res = responseRecorder();
    await handler(request({ url: "/api/supabase/health", path: "health" }), res);
    assert.ok(new Set([404, 503]).has(res.statusCode));
    assert.equal(contacted, false);
  }
});

test("health is isolated and authenticated routes validate the JWT before RLS requests", async () => {
  const { fetchImpl, calls } = authenticatedFetch({
    handle(target) {
      if (target.pathname === "/rest/v1/rpc/preview_create_project") {
        return jsonResponse({ id: "scr_aaaaaaaaaaaaaaaaaaaa", title: "Preview Project", role: "owner" });
      }
      return null;
    },
  });
  const handler = createSupabasePreviewHandler({ environment: previewEnvironment, fetchImpl });

  const healthRes = responseRecorder();
  await handler(request({ url: "/api/supabase/health", path: "health" }), healthRes);
  assert.equal(healthRes.statusCode, 200);
  assert.equal(calls.length, 0);

  const missingTokenRes = responseRecorder();
  await handler(request({ url: "/api/supabase/projects", path: "projects" }), missingTokenRes);
  assert.equal(missingTokenRes.statusCode, 401);
  assert.equal(calls.length, 0);

  const createRes = responseRecorder();
  await handler(request({
    method: "POST",
    url: "/api/supabase/projects",
    path: "projects",
    headers: { authorization: "Bearer user-jwt", "content-type": "application/json" },
    body: JSON.stringify({ title: "Preview Project" }),
  }), createRes);
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.json().project.role, "owner");
  assert.deepEqual(calls.map((call) => call.target.pathname), [
    "/auth/v1/user",
    "/rest/v1/rpc/get_my_profile",
    "/rest/v1/rpc/preview_create_project",
  ]);
  assert.equal(calls[0].options.headers.authorization, "Bearer user-jwt");
  assert.equal(calls[2].options.headers.authorization, "Bearer user-jwt");
  assert.notEqual(calls[2].options.headers.authorization, `Bearer ${previewEnvironment.SUPABASE_SERVICE_ROLE_KEY}`);
});

test("GET me safely claims one verified legacy profile for a pre-migration Auth identity", async () => {
  let profileReads = 0;
  const { fetchImpl, calls } = authenticatedFetch({
    handle(target) {
      if (target.pathname === "/rest/v1/rpc/get_my_profile") {
        profileReads += 1;
        return profileReads === 1
          ? jsonResponse([])
          : jsonResponse([{ id: "usr_bbbbbbbbbbbbbbbbbbbb", email: "legacy@example.com" }]);
      }
      if (target.pathname === "/rest/v1/rpc/preview_claim_verified_legacy_profile") {
        return jsonResponse({ linked: true, profileId: "usr_bbbbbbbbbbbbbbbbbbbb", status: "linked" });
      }
      return null;
    },
  });
  const handler = createSupabasePreviewHandler({ environment: previewEnvironment, fetchImpl });
  const res = responseRecorder();
  await handler(request({
    url: "/api/supabase/me",
    path: "me",
    headers: { authorization: "Bearer user-jwt" },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().user.id, "usr_bbbbbbbbbbbbbbbbbbbb");
  assert.deepEqual(calls.map((call) => call.target.pathname), [
    "/auth/v1/user",
    "/rest/v1/rpc/get_my_profile",
    "/rest/v1/rpc/preview_claim_verified_legacy_profile",
    "/rest/v1/rpc/get_my_profile",
  ]);
  assert.ok(calls.slice(1).every((call) => call.options.headers.authorization === "Bearer user-jwt"));
});

test("project list, read, rename, archive, and restore stay on JWT-scoped REST and RPC routes", async () => {
  const projectRow = {
    id: "scr_aaaaaaaaaaaaaaaaaaaa",
    user_id: "usr_aaaaaaaaaaaaaaaaaaaa",
    title: "Project One",
    filename: null,
    source: "new",
    text: "INT. ROOM - DAY",
    blocks: [],
    created_at: "2026-08-22T01:00:00Z",
    updated_at: "2026-08-22T01:00:00Z",
  };
  const { fetchImpl, calls } = authenticatedFetch({
    handle(target, options) {
      if (target.pathname === "/rest/v1/scripts") {
        return jsonResponse([{ ...projectRow, title: options.method === "PATCH" ? "Renamed" : projectRow.title }]);
      }
      if (target.pathname === "/rest/v1/project_states") {
        return jsonResponse([{ project_id: projectRow.id, archived_at: null, archived_by_user_id: null }]);
      }
      if (target.pathname === "/rest/v1/project_memberships") {
        return jsonResponse([{ project_id: projectRow.id, project_role: "owner", status: "active" }]);
      }
      if (target.pathname === "/rest/v1/rpc/preview_set_project_archived") {
        const body = JSON.parse(options.body);
        return jsonResponse({ projectId: projectRow.id, archived: body.requested_archived, archivedAt: body.requested_archived ? "2026-08-22T02:00:00Z" : null });
      }
      return null;
    },
  });
  const handler = createSupabasePreviewHandler({ environment: previewEnvironment, fetchImpl });
  const cases = [
    { method: "GET", path: "projects", url: "/api/supabase/projects", expected: 200 },
    { method: "GET", path: ["projects", projectRow.id], url: `/api/supabase/projects/${projectRow.id}`, expected: 200 },
    { method: "PATCH", path: ["projects", projectRow.id], url: `/api/supabase/projects/${projectRow.id}`, body: JSON.stringify({ title: "Renamed" }), headers: { "content-type": "application/json" }, expected: 200 },
    { method: "POST", path: ["projects", projectRow.id, "archive"], url: `/api/supabase/projects/${projectRow.id}/archive`, expected: 200 },
    { method: "POST", path: ["projects", projectRow.id, "restore"], url: `/api/supabase/projects/${projectRow.id}/restore`, expected: 200 },
  ];
  for (const route of cases) {
    const res = responseRecorder();
    await handler(request({
      ...route,
      headers: { authorization: "Bearer user-jwt", ...route.headers },
    }), res);
    assert.equal(res.statusCode, route.expected, `${route.method} ${route.url}`);
  }
  const dataCalls = calls.filter((call) => call.target.pathname.startsWith("/rest/v1/")
    && !call.target.pathname.endsWith("/get_my_profile"));
  assert.ok(dataCalls.length >= 9);
  assert.ok(dataCalls.every((call) => call.options.headers.authorization === "Bearer user-jwt"));
  assert.ok(dataCalls.every((call) => call.options.headers.authorization !== `Bearer ${previewEnvironment.SUPABASE_SERVICE_ROLE_KEY}`));
});

test("private upload compensates Storage if the JWT-scoped manifest transaction fails", async () => {
  const { fetchImpl, calls } = authenticatedFetch({
    handle(target, options) {
      if (target.pathname === "/rest/v1/rpc/has_project_permission") return jsonResponse(true);
      if (target.pathname.startsWith("/storage/v1/object/filmscript-private/") && options.method === "POST") {
        return jsonResponse({ Key: "stored" });
      }
      if (target.pathname === "/rest/v1/rpc/preview_register_upload") {
        return jsonResponse({ message: "Project file edit permission is required." }, 403);
      }
      if (target.pathname.startsWith("/storage/v1/object/filmscript-private/") && options.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return null;
    },
  });
  const handler = createSupabasePreviewHandler({
    environment: previewEnvironment,
    fetchImpl,
    randomBytes: () => Buffer.alloc(16, 0xab),
  });
  const res = responseRecorder();
  await handler(request({
    method: "POST",
    url: "/api/supabase/projects/scr_aaaaaaaaaaaaaaaaaaaa/files",
    path: ["projects", "scr_aaaaaaaaaaaaaaaaaaaa", "files"],
    headers: {
      authorization: "Bearer user-jwt",
      "content-type": "image/png",
      "x-filmscript-filename": "reference.png",
    },
    body: Buffer.from("private-preview-bytes"),
  }), res);

  assert.equal(res.statusCode, 403);
  const storageCalls = calls.filter((call) => call.target.pathname.startsWith("/storage/v1/object/filmscript-private/"));
  assert.deepEqual(storageCalls.map((call) => call.options.method), ["POST", "DELETE"]);
  assert.match(storageCalls[0].target.pathname, /med_(?:ab){16}/);
  assert.equal(storageCalls[0].options.headers.authorization, `Bearer ${previewEnvironment.SUPABASE_SERVICE_ROLE_KEY}`);
  const register = calls.find((call) => call.target.pathname.endsWith("/preview_register_upload"));
  assert.equal(register.options.headers.authorization, "Bearer user-jwt");
});

test("private downloads query the manifest with the user JWT before signing", async () => {
  let signingContacted = false;
  const { fetchImpl } = authenticatedFetch({
    handle(target) {
      if (target.pathname === "/rest/v1/media_objects") return jsonResponse([]);
      if (target.pathname.startsWith("/storage/v1/object/sign/")) {
        signingContacted = true;
        return jsonResponse({ signedURL: "/should-not-happen" });
      }
      return null;
    },
  });
  const handler = createSupabasePreviewHandler({ environment: previewEnvironment, fetchImpl });
  const res = responseRecorder();
  await handler(request({
    url: "/api/supabase/projects/scr_aaaaaaaaaaaaaaaaaaaa/files/med_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/download",
    path: ["projects", "scr_aaaaaaaaaaaaaaaaaaaa", "files", "med_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "download"],
    headers: { authorization: "Bearer user-jwt" },
  }), res);
  assert.equal(res.statusCode, 404);
  assert.equal(signingContacted, false);
});

test("Preview migration pins SECURITY DEFINER functions and routing bypasses the AWS catch-all", () => {
  for (const name of ["preview_create_project", "preview_claim_verified_legacy_profile", "preview_set_project_archived", "preview_register_upload"]) {
    assert.match(migrations, new RegExp(`function public\\.${name}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`, "i"));
    assert.match(migrations, new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon`, "i"));
  }
  assert.match(migrations, /insert into public\.scripts[\s\S]*?insert into public\.project_memberships[\s\S]*?insert into public\.project_states/i);
  assert.match(migrations, /has_project_permission\(requested_project_id, 'files', 'edit'\)/i);
  assert.match(migrations, /requested_object_path[\s\S]*?outside the caller namespace/i);
  assert.match(migrations, /function public\.preview_claim_verified_legacy_profile\(\)[\s\S]*?email_confirmed_at[\s\S]*?identity\.provider = 'google'[\s\S]*?identity\.identity_data ->> 'sub'[\s\S]*?= identity\.provider_id[\s\S]*?google_identity_count > 1[\s\S]*?PT409[\s\S]*?private\.sync_auth_user_profile/i);
  assert.doesNotMatch(migrations, /preview_claim_verified_legacy_profile\([^)]*(?:profile|email)/i);
  assert.doesNotMatch(migrations, /raise notice/i);

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const awsCatchAll = vercel.rewrites.find((rewrite) => rewrite.source.startsWith("/api/:path"));
  assert.ok(awsCatchAll);
  assert.match(awsCatchAll.source, /supabase/);
  assert.equal(vercel.rewrites.filter((rewrite) => rewrite.source.includes("supabase")).length, 1);
});

test("local PostgreSQL proves atomic owner bootstrap and RLS denial", { skip: !process.env.FILMSCRIPT_TEST_POSTGRES_URL }, () => {
  const psql = resolvePsqlBin();
  const sql = String.raw`
    \set ON_ERROR_STOP on
    begin;
    insert into auth.users (
      instance_id, id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      is_sso_user, is_anonymous
    ) values
      ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'preview-owner@example.test', statement_timestamp(), '{}', '{}', statement_timestamp(), statement_timestamp(), false, false),
      ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'preview-other@example.test', statement_timestamp(), '{}', '{}', statement_timestamp(), statement_timestamp(), false, false);

    set local role authenticated;
    select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
    select public.preview_create_project('Atomic Preview Project');
    select public.preview_register_upload(
      (select id from public.scripts where title = 'Atomic Preview Project'),
      'med_11111111111111111111111111111111',
      'projects/' || (select id from public.scripts where title = 'Atomic Preview Project') || '/files/' || public.current_app_user_id() || '/med_11111111111111111111111111111111/reference.png',
      'reference.png', 'image/png', 7,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    reset role;

    select '__ATOMIC__:' ||
      (select count(*) from public.scripts where title = 'Atomic Preview Project') || ':' ||
      (select count(*) from public.project_memberships m join public.scripts s on s.id=m.project_id where s.title = 'Atomic Preview Project' and m.project_role='owner' and m.status='active') || ':' ||
      (select count(*) from public.project_states st join public.scripts s on s.id=st.project_id where s.title = 'Atomic Preview Project');

    set local role authenticated;
    select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
    select '__OTHER_VISIBLE__:' || (select count(*) from public.scripts where title = 'Atomic Preview Project');
    select '__OTHER_MEDIA__:' || (select count(*) from public.media_objects where id = 'med_11111111111111111111111111111111');
    reset role;
    rollback;
  `;
  const result = spawnSync(psql, ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
    env: postgresEnvironmentFromUrl(process.env.FILMSCRIPT_TEST_POSTGRES_URL).environment,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /__ATOMIC__:1:1:1/);
  assert.match(result.stdout, /__OTHER_VISIBLE__:0/);
  assert.match(result.stdout, /__OTHER_MEDIA__:0/);
});

test("legacy profile claim uses the exact Google subject and leaves email-only cases for review", { skip: !process.env.FILMSCRIPT_TEST_POSTGRES_URL }, () => {
  const psql = resolvePsqlBin();
  const sql = String.raw`
    \set ON_ERROR_STOP on
    begin;
    insert into public.profiles (id, google_sub, email, email_verified) values
      ('usr_30000000000000000000', 'google-sub-exact-node', 'legacy-old@example.test', true),
      ('usr_40000000000000000000', 'google-sub-original-node', 'reassigned-node@example.test', true),
      ('usr_50000000000000000000', null, 'legacy-no-sub-node@example.test', true),
      ('usr_60000000000000000001', null, 'legacy-ambiguous-node@example.test', true),
      ('usr_60000000000000000002', null, 'LEGACY-AMBIGUOUS-NODE@example.test', true),
      ('usr_70000000000000000000', 'google-sub-unverified-node', 'legacy-unverified-node@example.test', false),
      ('usr_80000000000000000000', null, 'legacy-password-node@example.test', true);

    insert into auth.users (
      instance_id, id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      is_sso_user, is_anonymous
    ) values
      ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'current-node@example.test', statement_timestamp(), '{"provider":"google","providers":["google"]}', '{}', statement_timestamp(), statement_timestamp(), false, false),
      ('00000000-0000-0000-0000-000000000000', '40000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'reassigned-node@example.test', statement_timestamp(), '{"provider":"google","providers":["google"]}', '{}', statement_timestamp(), statement_timestamp(), false, false),
      ('00000000-0000-0000-0000-000000000000', '50000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'legacy-no-sub-node@example.test', statement_timestamp(), '{"provider":"google","providers":["google"]}', '{}', statement_timestamp(), statement_timestamp(), false, false),
      ('00000000-0000-0000-0000-000000000000', '60000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'legacy-ambiguous-node@example.test', statement_timestamp(), '{"provider":"google","providers":["google"]}', '{}', statement_timestamp(), statement_timestamp(), false, false),
      ('00000000-0000-0000-0000-000000000000', '70000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'legacy-unverified-node@example.test', statement_timestamp(), '{"provider":"google","providers":["google"]}', '{}', statement_timestamp(), statement_timestamp(), false, false),
      ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'legacy-password-node@example.test', statement_timestamp(), '{"provider":"email","providers":["email"]}', '{}', statement_timestamp(), statement_timestamp(), false, false);

    select '__DEFERRED__:' || count(*)
    from public.profiles
    where auth_user_id in (
      '30000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000004',
      '50000000-0000-4000-8000-000000000005',
      '60000000-0000-4000-8000-000000000006',
      '70000000-0000-4000-8000-000000000007'
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values
      ('google-sub-exact-node', '30000000-0000-4000-8000-000000000003', '{"sub":"google-sub-exact-node","email":"current-node@example.test"}', 'google', statement_timestamp(), statement_timestamp()),
      ('google-sub-new-owner-node', '40000000-0000-4000-8000-000000000004', '{"sub":"google-sub-new-owner-node","email":"reassigned-node@example.test"}', 'google', statement_timestamp(), statement_timestamp()),
      ('google-sub-no-anchor-node', '50000000-0000-4000-8000-000000000005', '{"sub":"google-sub-no-anchor-node","email":"legacy-no-sub-node@example.test"}', 'google', statement_timestamp(), statement_timestamp()),
      ('google-sub-ambiguous-a-node', '60000000-0000-4000-8000-000000000006', '{"sub":"google-sub-ambiguous-a-node","email":"legacy-ambiguous-node@example.test"}', 'google', statement_timestamp(), statement_timestamp()),
      ('google-sub-ambiguous-b-node', '60000000-0000-4000-8000-000000000006', '{"sub":"google-sub-ambiguous-b-node","email":"legacy-ambiguous-node@example.test"}', 'google', statement_timestamp(), statement_timestamp()),
      ('google-sub-unverified-node', '70000000-0000-4000-8000-000000000007', '{"sub":"google-sub-unverified-node","email":"legacy-unverified-node@example.test"}', 'google', statement_timestamp(), statement_timestamp());

    set local role authenticated;
    select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
    select public.preview_claim_verified_legacy_profile();
    select public.preview_claim_verified_legacy_profile();
    reset role;
    select '__EXACT_LINKS__:' || count(*) from public.profiles where auth_user_id = '30000000-0000-4000-8000-000000000003';

    set local role authenticated;
    select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000004', true);
    select public.preview_claim_verified_legacy_profile();
    reset role;
    select '__MISMATCH_LINKS__:' || count(*) from public.profiles where auth_user_id = '40000000-0000-4000-8000-000000000004';

    set local role authenticated;
    select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000005', true);
    select public.preview_claim_verified_legacy_profile();
    reset role;
    select '__NO_SUB_LINKS__:' || count(*) from public.profiles where auth_user_id = '50000000-0000-4000-8000-000000000005';

    set local role authenticated;
    select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000006', true);
    do $claim$
    begin
      perform public.preview_claim_verified_legacy_profile();
      raise exception 'ambiguous claim unexpectedly succeeded';
    exception
      when sqlstate 'PT409' then null;
    end;
    $claim$;
    reset role;
    select '__AMBIGUOUS_LINKS__:' || count(*) from public.profiles where auth_user_id = '60000000-0000-4000-8000-000000000006';

    set local role authenticated;
    select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000007', true);
    select public.preview_claim_verified_legacy_profile();
    reset role;
    select '__UNVERIFIED_LINKS__:' || count(*) from public.profiles where auth_user_id = '70000000-0000-4000-8000-000000000007';

    set local role authenticated;
    select set_config('request.jwt.claim.sub', '80000000-0000-4000-8000-000000000008', true);
    do $password$
    begin
      perform public.preview_claim_verified_legacy_profile();
      raise exception 'password claim unexpectedly succeeded';
    exception
      when sqlstate '42501' then null;
    end;
    $password$;
    reset role;
    select '__PASSWORD_LINKS__:' || count(*) from public.profiles where auth_user_id = '80000000-0000-4000-8000-000000000008';
    rollback;
    select '__ROLLBACK__:' || count(*) from public.profiles where id = 'usr_30000000000000000000';
  `;
  const result = spawnSync(psql, ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
    env: postgresEnvironmentFromUrl(process.env.FILMSCRIPT_TEST_POSTGRES_URL).environment,
  });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /__DEFERRED__:0/);
  assert.match(result.stdout, /__EXACT_LINKS__:1/);
  assert.match(result.stdout, /__MISMATCH_LINKS__:0/);
  assert.match(result.stdout, /__NO_SUB_LINKS__:0/);
  assert.match(result.stdout, /__AMBIGUOUS_LINKS__:0/);
  assert.match(result.stdout, /__UNVERIFIED_LINKS__:0/);
  assert.match(result.stdout, /__PASSWORD_LINKS__:0/);
  assert.match(result.stdout, /__ROLLBACK__:0/);
});
