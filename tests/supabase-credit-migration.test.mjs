import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import Database from "better-sqlite3";
import {
  creditTargetDefinitions,
  normalizeLegacyCredits,
  validateNormalizedCreditGraph,
} from "../scripts/supabase-migration/lib/credit-normalization.mjs";
import { snapshotSqlite, validateSnapshotExport } from "../scripts/supabase-migration/snapshot-sqlite.mjs";
import { transformBundle } from "../scripts/supabase-migration/transform-bundle.mjs";
import { validateBundle } from "../scripts/supabase-migration/lib/bundle.mjs";
import { buildImportSql } from "../scripts/supabase-migration/import-postgres.mjs";
import { materializeLegacyCredits } from "../scripts/supabase-migration/materialize-legacy-credits.mjs";
import {
  postgresEnvironmentFromUrl,
  resolvePsqlBin,
  sha256File,
} from "../scripts/supabase-migration/lib/common.mjs";

const CAPTURED_AT = "2026-08-22T12:00:00.000Z";
const PROVIDER_START = "2026-08-01T00:00:00.000Z";
const PROVIDER_END = "2026-09-01T00:00:00.000Z";
const PROVIDER_PERIOD = `provider:${Date.parse(PROVIDER_START)}:${Date.parse(PROVIDER_END)}`;
const TEST_IMAGE_DIGEST = `sha256:${"f".repeat(64)}`;

function writeRuntimeHashes(root) {
  const filename = path.join(root, "runtime-hashes.json");
  const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const hashes = Object.fromEntries([
    "server.js", "permissions-model.js", "database.js", "platform-database.js",
  ].map((name) => [name, sha256File(path.join(repositoryRoot, name))]));
  fs.writeFileSync(filename, `${JSON.stringify({ image: "TEST_RUNTIME", hashes })}\n`, { mode: 0o600 });
  return filename;
}

function richLegacyAccount() {
  return {
    plan: "full",
    unlimited: false,
    lifetime: false,
    period: "2026-08",
    limit: 1200,
    used: 8,
    lastResetAt: "2026-08-01T00:00:00.000Z",
    week: { key: "2026-08-17", limit: 500, used: 6 },
    session: { startedAt: "2026-08-22T10:00:00.000Z", limit: 150, used: 5 },
    textReservations: {
      "request-shared": {
        amount: 2,
        createdAt: "2026-08-22T10:00:00.000Z",
        expiresAt: "2026-08-22T11:50:00.000Z",
        state: "settled",
        settledAt: "2026-08-22T10:01:00.000Z",
        receipt: { reply: "Preserved result", provider: "openai", model: "gpt-test", requiredCredits: 2 },
      },
      pending: {
        amount: 1,
        createdAt: "2026-08-22T11:55:00.000Z",
        expiresAt: "2026-08-22T12:25:00.000Z",
      },
      expired_pending: {
        amount: 1,
        createdAt: "2026-08-22T10:30:00.000Z",
        expiresAt: "2026-08-22T11:00:00.000Z",
      },
    },
    imageCredits: {
      plan: "full",
      period: PROVIDER_PERIOD,
      limit: 1000,
      used: 6,
      reserved: 6,
      remaining: 988,
      costPerImage: 3,
      resetAt: PROVIDER_END,
      cycle: { key: PROVIDER_PERIOD, startAt: PROVIDER_START, endAt: PROVIDER_END, source: "provider" },
      usageByPeriod: { [PROVIDER_PERIOD]: 6, "2026-07": 9 },
      reservations: {
        image_active: { amount: 3, period: PROVIDER_PERIOD, expiresAt: "2026-08-22T12:10:00.000Z" },
        image_expired: { amount: 3, period: PROVIDER_PERIOD, expiresAt: "2026-08-22T11:59:59.000Z" },
        image_prior_cycle: { amount: 3, period: "2026-07", expiresAt: "2026-08-22T12:10:00.000Z" },
      },
      unlimited: false,
    },
    freeAllowances: {
      analysis: { used: 1, usedAt: "2026-08-02T00:00:00.000Z" },
      breakdown: { used: 0, reservation: { id: "free-active", expiresAt: "2026-08-22T13:00:00.000Z" } },
      storyboard: { used: 0, reservation: { id: "free-expired", expiresAt: "2026-08-22T11:00:00.000Z" } },
    },
  };
}

function quiescentLegacyAccount() {
  const account = richLegacyAccount();
  for (const reservation of Object.values(account.textReservations)) {
    if (reservation.state !== "settled") reservation.expiresAt = "2026-08-22T11:59:59.000Z";
  }
  for (const reservation of Object.values(account.imageCredits.reservations)) {
    reservation.expiresAt = "2026-08-22T11:59:59.000Z";
  }
  for (const allowance of Object.values(account.freeAllowances)) {
    if (allowance.reservation) allowance.reservation.expiresAt = "2026-08-22T11:59:59.000Z";
  }
  return account;
}

function normalize(account = richLegacyAccount(), options = {}) {
  return normalizeLegacyCredits({
    appSettings: [{ key: "lumiere_credits", value: { usr_credit: account } }],
    profiles: [{ id: "usr_credit" }],
    subscriptions: [{
      user_id: "usr_credit",
      plan: "full",
      status: "active",
      billing_cycle_key: PROVIDER_PERIOD,
      current_period_start: PROVIDER_START,
      current_period_end: PROVIDER_END,
    }],
    capturedAt: CAPTURED_AT,
    ...options,
  });
}

function tablesForValidation(normalized, account = richLegacyAccount()) {
  return [
    { target: "private.app_settings", rows: [{ key: "lumiere_credits", value: { usr_credit: account } }] },
    { target: "public.profiles", rows: [{ id: "usr_credit" }] },
    { target: "billing.subscriptions", rows: [{
      user_id: "usr_credit", plan: "full", status: "active", billing_cycle_key: PROVIDER_PERIOD,
    }] },
    ...creditTargetDefinitions().map((definition) => ({
      target: definition.target,
      rows: normalized.rowsByTarget.get(definition.target),
    })),
  ];
}

test("credit ETL preserves exact snapshots and normalizes cycles, reservations, settlements, and allowances", () => {
  const result = normalize(richLegacyAccount());
  assert.deepEqual(result.summary, {
    status: "verified",
    capturedAt: CAPTURED_AT,
    sourceSha256: result.summary.sourceSha256,
    normalizedSha256: result.summary.normalizedSha256,
    accountCount: 1,
    windowCount: 8,
    reservationCount: 8,
    activeReservationCount: 4,
    settledReservationCount: 1,
    expiredReservationCount: 3,
    ledgerEntryCount: 5,
    allowanceCount: 3,
  });
  assert.match(result.summary.sourceSha256, /^[0-9a-f]{64}$/);
  assert.match(result.summary.normalizedSha256, /^[0-9a-f]{64}$/);

  const accounts = result.rowsByTarget.get("private.credit_accounts");
  assert.deepEqual(accounts[0].legacy_snapshot, richLegacyAccount());
  const windows = result.rowsByTarget.get("private.credit_windows");
  const currentImage = windows.find((row) => row.feature === "imagine_image" && row.period_key === PROVIDER_PERIOD);
  const historicImage = windows.find((row) => row.feature === "imagine_image" && row.period_key === "2026-07");
  assert.equal(currentImage.allowance, 1000);
  assert.equal(currentImage.used, 6);
  assert.equal(currentImage.legacy_allowance_unknown, false);
  assert.equal(historicImage.allowance, null);
  assert.equal(historicImage.used, 9);
  assert.equal(historicImage.legacy_allowance_unknown, true);

  const reservations = result.rowsByTarget.get("private.credit_reservations");
  const textReceipt = reservations.find((row) => row.metadata.legacy_id === "request-shared");
  assert.equal(textReceipt.state, "settled");
  assert.equal(textReceipt.id, "request-shared");
  assert.equal(textReceipt.idempotency_key, "request-shared");
  assert.equal(textReceipt.created_at, "2026-08-22T10:00:00.000Z");
  assert.equal(textReceipt.metadata.legacy_created_at_inferred, false);
  assert.equal(reservations.find((row) => row.metadata.legacy_id === "image_expired").state, "expired");
  assert.equal(reservations.find((row) => row.metadata.legacy_id === "image_prior_cycle").state, "reserved");
  assert.equal(reservations.find((row) => row.metadata.legacy_id === "free-active").amount, 1);
  assert.equal(reservations.find((row) => row.metadata.legacy_id === "image_active").created_at, CAPTURED_AT);
  assert.equal(reservations.find((row) => row.metadata.legacy_id === "image_active")
    .metadata.legacy_created_at_inferred, true);

  const ledger = result.rowsByTarget.get("private.credit_ledger");
  const settlement = ledger.find((row) => row.entry_type === "settlement");
  assert.equal(settlement.amount, 2);
  assert.equal(settlement.metadata.legacy_id, "request-shared");
  assert.equal(settlement.id, "settlement:request-shared");
  assert.equal(settlement.idempotency_key, "settlement:request-shared");
  assert.equal(settlement.created_at, "2026-08-22T10:01:00.000Z");
  const textRemainder = ledger.find((row) => row.metadata.legacy_kind === "text_usage_remainder");
  assert.equal(textRemainder.amount, 6, "settled receipts plus remainder reconcile exactly to text used");
  assert.equal(ledger.filter((row) => row.metadata.legacy_kind === "image_usage_snapshot")
    .reduce((sum, row) => sum + row.amount, 0), 15);

  assert.deepEqual(validateNormalizedCreditGraph({
    tables: tablesForValidation(result),
    capturedAt: CAPTURED_AT,
  }), result.summary);
});

test("credit ETL preserves globally unique reservation identities and fails closed on collisions", () => {
  const unique = normalize();
  const preserved = unique.rowsByTarget.get("private.credit_reservations")
    .find((row) => row.metadata.legacy_id === "request-shared");
  assert.equal(preserved.id, "request-shared");
  assert.equal(preserved.idempotency_key, "request-shared");

  const first = richLegacyAccount();
  const second = richLegacyAccount();
  assert.throws(() => normalizeLegacyCredits({
    appSettings: [{ key: "lumiere_credits", value: { usr_one: first, usr_two: second } }],
    profiles: [{ id: "usr_one" }, { id: "usr_two" }],
    capturedAt: CAPTURED_AT,
  }), /reservation id request-shared is not globally unique/);

  assert.throws(() => normalizeLegacyCredits({
    appSettings: [{ key: "lumiere_credits", value: { missing_user: first } }],
    profiles: [{ id: "another_user" }],
    capturedAt: CAPTURED_AT,
  }), /unknown profile missing_user/);

  const inconsistent = richLegacyAccount();
  inconsistent.imageCredits.reserved = 3;
  assert.throws(() => normalize(inconsistent), /reserved disagrees with its reservation records/);

  assert.throws(() => normalize(quiescentLegacyAccount(), {
    enforceBilling: true,
    subscriptions: [{ user_id: "usr_credit", plan: "creator", status: "active", billing_cycle_key: PROVIDER_PERIOD }],
  }), /disagrees with billing subscription entitlement creator/);

  const ineligible = richLegacyAccount();
  Object.assign(ineligible, {
    plan: "free", lifetime: true, period: "lifetime", limit: 5, used: 0,
    week: { key: "lifetime", limit: 5, used: 0 },
    session: { startedAt: null, limit: 5, used: 0 },
    textReservations: {}, freeAllowances: {},
  });
  ineligible.imageCredits = {
    plan: "free", period: null, limit: 0, used: 0, reserved: 0, remaining: 0,
    costPerImage: 3, resetAt: null, reservations: {}, usageByPeriod: { "2026-08": 0 }, unlimited: false,
    cycle: {
      key: "2026-08", startAt: "2026-08-01T00:00:00.000Z",
      endAt: "2026-09-01T00:00:00.000Z", source: "calendar",
    },
  };
  const ineligibleResult = normalizeLegacyCredits({
    appSettings: [{ key: "lumiere_credits", value: { usr_free: ineligible } }],
    profiles: [{ id: "usr_free" }],
    subscriptions: [],
    capturedAt: CAPTURED_AT,
    enforceBilling: true,
  });
  assert.equal(ineligibleResult.rowsByTarget.get("private.credit_windows")
    .filter((row) => row.feature === "imagine_image").length, 0,
  "a calendar marker on an ineligible account must not mint an image window");

  assert.throws(() => normalizeLegacyCredits({
    appSettings: [{ key: "lumiere_credits", value: {} }],
    profiles: [{ id: "usr_paid_without_ledger" }],
    subscriptions: [{ user_id: "usr_paid_without_ledger", plan: "lumiere", status: "active" }],
    capturedAt: CAPTURED_AT,
    enforceBilling: true,
  }), /has no lumiere_credits account/);

  const valid = normalize();
  const tamperedTables = tablesForValidation(valid);
  tamperedTables.find((table) => table.target === "private.credit_windows").rows[0].used += 1;
  assert.throws(() => validateNormalizedCreditGraph({
    tables: tamperedTables,
    capturedAt: CAPTURED_AT,
  }), /does not reconcile to private\.app_settings lumiere_credits/);
});

test("Free lifetime usage follows lifetimeUsed before compatibility aliases", () => {
  const account = richLegacyAccount();
  Object.assign(account, {
    plan: "free",
    lifetime: true,
    period: "lifetime",
    limit: 5,
    used: 1,
    lifetimeUsed: 4,
    week: { key: "lifetime", limit: 5, used: 0 },
    session: { startedAt: null, limit: 5, used: 2 },
    textReservations: {},
    imageCredits: null,
    freeAllowances: {},
  });
  const normalized = normalize(account);
  const lifetimeWindows = normalized.rowsByTarget.get("private.credit_windows")
    .filter((row) => row.feature.startsWith("lumiere_text"));
  assert.equal(lifetimeWindows.length, 3);
  assert.deepEqual(new Set(lifetimeWindows.map((row) => row.used)), new Set([4]));
  assert.equal(normalized.rowsByTarget.get("private.credit_accounts")[0].legacy_snapshot.used, 1,
    "the non-authoritative compatibility alias remains exact in the retained source snapshot");

  const fallback = structuredClone(account);
  delete fallback.lifetimeUsed;
  fallback.used = 3;
  const fallbackWindows = normalize(fallback).rowsByTarget.get("private.credit_windows")
    .filter((row) => row.feature.startsWith("lumiere_text"));
  assert.deepEqual(new Set(fallbackWindows.map((row) => row.used)), new Set([3]));
});

test("legacy Lumiere plan aliases canonicalize to Creator only in normalized windows", () => {
  const account = quiescentLegacyAccount();
  Object.assign(account, {
    plan: "lumiere",
    limit: 600,
    week: { ...account.week, limit: 250 },
    session: { ...account.session, limit: 75 },
  });
  Object.assign(account.imageCredits, { plan: "lumiere", limit: 100, remaining: 88 });
  const normalized = normalize(account, {
    enforceBilling: true,
    subscriptions: [{
      user_id: "usr_credit",
      plan: "lumiere",
      status: "active",
      billing_cycle_key: PROVIDER_PERIOD,
      current_period_start: PROVIDER_START,
      current_period_end: PROVIDER_END,
    }],
  });
  const planned = normalized.rowsByTarget.get("private.credit_windows")
    .filter((row) => row.plan != null && !row.feature.startsWith("free_"));
  assert.ok(planned.length > 0);
  assert.deepEqual(new Set(planned.map((row) => row.plan)), new Set(["creator"]));
  assert.equal(normalized.rowsByTarget.get("private.credit_accounts")[0].legacy_snapshot.plan, "lumiere");
});

test("a paid downgrade preserves current-cycle image usage above the new allowance", () => {
  const account = quiescentLegacyAccount();
  Object.assign(account, {
    plan: "creator",
    limit: 600,
    week: { ...account.week, limit: 250 },
    session: { ...account.session, limit: 75 },
  });
  Object.assign(account.imageCredits, {
    plan: "creator",
    limit: 100,
    used: 900,
    reserved: 0,
    remaining: 0,
    reservations: {},
    usageByPeriod: { [PROVIDER_PERIOD]: 900 },
  });
  const normalized = normalize(account, {
    enforceBilling: true,
    subscriptions: [{
      user_id: "usr_credit",
      plan: "creator",
      status: "active",
      billing_cycle_key: PROVIDER_PERIOD,
      current_period_start: PROVIDER_START,
      current_period_end: PROVIDER_END,
    }],
  });
  const imageWindow = normalized.rowsByTarget.get("private.credit_windows")
    .find((row) => row.feature === "imagine_image" && row.period_key === PROVIDER_PERIOD);
  assert.equal(imageWindow.allowance, 100);
  assert.equal(imageWindow.used, 900);
});

test("calendar usage carried into a provider cycle is not counted twice as consumption", () => {
  const account = quiescentLegacyAccount();
  Object.assign(account.imageCredits, {
    used: 163,
    reserved: 0,
    remaining: 837,
    reservations: {},
    usageByPeriod: { "2026-08": 126, [PROVIDER_PERIOD]: 163 },
  });
  const normalized = normalize(account, { enforceBilling: true });
  const windows = normalized.rowsByTarget.get("private.credit_windows");
  assert.equal(windows.find((row) => row.feature === "imagine_image" && row.period_key === "2026-08").used, 126);
  const providerWindow = windows.find((row) => row.feature === "imagine_image" && row.period_key === PROVIDER_PERIOD);
  assert.equal(providerWindow.used, 163);

  const imageLedger = normalized.rowsByTarget.get("private.credit_ledger")
    .filter((row) => row.feature === "imagine_image");
  const consumption = imageLedger.filter((row) => row.entry_type === "legacy_usage_snapshot");
  assert.equal(consumption.reduce((sum, row) => sum + row.amount, 0), 163,
    "only the original calendar usage plus the provider-cycle increment are consumption");
  const carry = imageLedger.find((row) => row.entry_type === "legacy_carry_forward");
  assert.equal(carry.amount, 126);
  assert.equal(carry.metadata.non_consumption, true);
  assert.equal(imageLedger.filter((row) => row.window_id === providerWindow.id)
    .reduce((sum, row) => sum + row.amount, 0), 163,
  "the provider window is reconciled as opening balance plus incremental use");
});

test("strict credit cutover rejects active jobs, missing paid ledgers, and stale paid cycles", () => {
  assert.throws(() => normalize(richLegacyAccount(), {
    enforceBilling: true,
    aiJobs: [{ id: "job_active", status: "processing" }],
  }), /active AI job job_active has status processing/);

  assert.throws(() => normalize(richLegacyAccount(), { enforceBilling: true }),
    /active legacy credit reservation .*textReservations\.pending/);

  const staleText = quiescentLegacyAccount();
  Object.assign(staleText, {
    period: "2026-07",
    week: { ...staleText.week, key: "2026-07-27" },
  });
  assert.throws(() => normalize(staleText, { enforceBilling: true }),
    /period is not the current paid text-credit cycle/);

  const stale = quiescentLegacyAccount();
  stale.imageCredits = {
    plan: "full",
    period: "2026-07",
    limit: 1000,
    used: 0,
    reserved: 0,
    remaining: 1000,
    costPerImage: 3,
    resetAt: "2026-08-01T00:00:00.000Z",
    cycle: {
      key: "2026-07",
      startAt: "2026-07-01T00:00:00.000Z",
      endAt: "2026-08-01T00:00:00.000Z",
      source: "calendar",
    },
    reservations: {},
    usageByPeriod: { "2026-07": 0 },
    unlimited: false,
  };
  assert.throws(() => normalize(stale, {
    enforceBilling: true,
    subscriptions: [{ user_id: "usr_credit", plan: "full", status: "active" }],
  }), /imageCredits\.period disagrees with the subscription billing cycle/);
});

function createMaterializationFixture(filename, {
  activeReservation = false,
  activeJob = false,
  legacyNullActivityTimestamp = false,
} = {}) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const initialized = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    "await import('./platform-database.js')",
  ], {
    cwd: root,
    env: {
      ...process.env,
      FILMSCRIPT_DB_PATH: filename,
      FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      FILMSCRIPT_PREVIEW_MODE: "false",
      NODE_ENV: "test",
    },
    encoding: "utf8",
  });
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const providerPeriod = `provider:${periodStart.getTime()}:${periodEnd.getTime()}`;
  const timestamp = now.toISOString();
  const database = new Database(filename);
  database.pragma("foreign_keys = ON");
  database.prepare(`
    INSERT INTO users (id, email, email_verified, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?)
  `).run("usr_materialization_secret", "private-person@example.test", timestamp, timestamp);
  database.prepare(`
    INSERT INTO subscriptions
      (user_id, plan, status, provider_subscription_id, billing_cycle_key,
       current_period_start, current_period_end, updated_at)
    VALUES (?, 'lumiere', 'active', ?, ?, ?, ?, ?)
  `).run(
    "usr_materialization_secret", "sub_materialization_secret", providerPeriod,
    periodStart.toISOString(), periodEnd.toISOString(), timestamp,
  );
  database.prepare(`
    INSERT INTO scripts
      (id, user_id, title, text, blocks_json, chat_json, title_room_json,
       character_names_json, created_at, updated_at)
    VALUES (?, ?, 'Private title', '', '[]', '[]', '{}', '{}', ?, ?)
  `).run("scr_materialization_secret", "usr_materialization_secret", timestamp, timestamp);
  if (legacyNullActivityTimestamp) {
    const insertActivity = database.prepare(`
      INSERT INTO activity_events
        (id, project_id, module, actor_user_id, actor_type, entity_type, entity_id,
         action, summary, before_json, after_json, contains_financial_data,
         financial_department_id, created_at, aggregation_key, aggregation_count,
         metadata_json, updated_at)
      VALUES (?, ?, 'script', ?, 'user', 'script', ?, 'updated', 'Legacy event',
              NULL, NULL, 0, NULL, ?, NULL, 1, '{}', ?)
    `);
    insertActivity.run(
      "act_materialization_null", "scr_materialization_secret", "usr_materialization_secret",
      "scr_materialization_secret", timestamp, null,
    );
    insertActivity.run(
      "act_materialization_existing", "scr_materialization_secret", "usr_materialization_secret",
      "scr_materialization_secret", timestamp, timestamp,
    );
  }
  const creditAccount = activeReservation ? {
    plan: "lumiere",
    textReservations: {
      reservation_materialization_secret: {
        amount: 1,
        createdAt: timestamp,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      },
    },
  } : {};
  database.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value_json)
    VALUES ('lumiere_credits', ?)
  `).run(JSON.stringify({ usr_materialization_secret: creditAccount }));
  database.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value_json)
    VALUES ('preserve_materialization_test', '{"must":"stay exact"}')
  `).run();
  if (activeJob) {
    database.prepare(`
      INSERT INTO ai_jobs
        (id, project_id, requested_by_user_id, type, status, progress, stage,
         source_script_id, source_script_version_id, source_content_hash,
         internal_primary_model, reserved_credits, settled_credits,
         idempotency_key, input_json, output_schema_version, created_at, updated_at)
      VALUES (?, ?, ?, 'translation', 'processing', 20, 'translating', ?, ?, ?,
              'test-model', 1, 0, ?, '{}', 1, ?, ?)
    `).run(
      "job_materialization_secret", "scr_materialization_secret", "usr_materialization_secret",
      "scr_materialization_secret", "version_materialization_secret", "hash_materialization_secret",
      "idempotency_materialization_secret", timestamp, timestamp,
    );
  }
  database.close();
  return { providerPeriod, timestamp };
}

test("credit materializer writes an exclusive DELETE-journal backup and attests only app_settings changes", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-credit-materialize-"));
  const source = path.join(root, "legacy.sqlite");
  const output = path.join(root, "materialized");
  const { providerPeriod, timestamp } = createMaterializationFixture(source, { legacyNullActivityTimestamp: true });
  const runtimeHashesPath = writeRuntimeHashes(root);
  const sourceBefore = fs.readFileSync(source);
  try {
    const result = await materializeLegacyCredits({
      source, outputDirectory: output, runtimeHashesPath, imageDigest: TEST_IMAGE_DIGEST,
    });
    assert.equal(result.databasePath, path.join(output, "source.sqlite"));
    assert.equal(result.manifest.verification.activePaidSubscriptionCount, 1);
    assert.equal(result.manifest.verification.materializedAccountCount, 1);
    assert.equal(result.manifest.verification.syntheticOwnerMembershipsRemoved, 1);
    assert.equal(result.manifest.verification.nonAppSettingsTablesUnchanged, true);
    assert.equal(result.manifest.verification.nonCreditAppSettingsUnchanged, true);
    assert.equal(result.manifest.verification.activeJobCount, 0);
    assert.equal(result.manifest.verification.activeReservationCount, 0);
    assert.match(result.manifest.policy.serverJsSha256, /^[0-9a-f]{64}$/);
    assert.match(result.manifest.policy.contractSha256, /^[0-9a-f]{64}$/);
    assert.equal(result.manifest.runtime.imageDigest, TEST_IMAGE_DIGEST);
    assert.equal(result.manifest.clock.capturedAt, result.manifest.clock.startedAt);
    assert.equal(result.manifest.verification.activityTimestampsRestored, 1);
    assert.equal(fs.existsSync(path.join(output, "INCOMPLETE")), false);
    assert.equal(fs.existsSync(`${result.databasePath}-wal`), false);
    assert.equal(fs.existsSync(`${result.databasePath}-shm`), false);
    assert.equal(fs.statSync(result.databasePath).mode & 0o777, 0o600);
    assert.equal(fs.statSync(result.manifestPath).mode & 0o777, 0o600);
    assert.deepEqual(fs.readFileSync(source), sourceBefore, "the source SQLite file is byte-for-byte untouched");

    const database = new Database(result.databasePath, { readonly: true });
    assert.equal(database.pragma("journal_mode", { simple: true }), "delete");
    assert.deepEqual(database.pragma("integrity_check"), [{ integrity_check: "ok" }]);
    assert.deepEqual(database.pragma("foreign_key_check"), []);
    assert.equal(database.prepare("select count(*) as count from project_memberships").get().count, 0,
      "server backfillOwners rows are removed after proving they are synthetic");
    assert.equal(database.prepare(
      "select updated_at from activity_events where id = 'act_materialization_null'",
    ).get().updated_at, null, "only the reviewed migration-013 timestamp fill is restored");
    assert.equal(database.prepare(
      "select updated_at from activity_events where id = 'act_materialization_existing'",
    ).get().updated_at, timestamp, "pre-existing activity timestamps remain exact");
    const credits = JSON.parse(database.prepare(
      "select value_json from app_settings where key = 'lumiere_credits'",
    ).get().value_json);
    assert.equal(database.prepare(
      "select value_json from app_settings where key = 'preserve_materialization_test'",
    ).get().value_json, '{"must":"stay exact"}');
    database.close();
    assert.equal(credits.usr_materialization_secret.plan, "creator");
    assert.equal(credits.usr_materialization_secret.imageCredits.plan, "creator");
    assert.equal(credits.usr_materialization_secret.imageCredits.period, providerPeriod);

    const exportDirectory = path.join(root, "materialized-export");
    const bundleDirectory = path.join(root, "materialized-bundle");
    const exportManifest = await snapshotSqlite({ source: result.databasePath, outputDirectory: exportDirectory });
    assert.match(exportManifest.source.creditMaterialization.sha256, /^[0-9a-f]{64}$/);
    assert.equal(validateSnapshotExport(exportDirectory).ok, true);
    const transformed = transformBundle({
      exportDirectory,
      outputDirectory: bundleDirectory,
      allowPartialSchema: true,
    });
    assert.equal(
      transformed.source.creditMaterialization.attestation.runtime.imageDigest,
      TEST_IMAGE_DIGEST,
      "snapshot and bundle preserve the reviewed runtime/image attestation",
    );
    assert.equal(validateBundle(bundleDirectory).manifest.source.creditMaterialization.manifestSha256,
      exportManifest.source.creditMaterialization.sha256);

    const manifestText = fs.readFileSync(result.manifestPath, "utf8");
    for (const forbidden of [
      "usr_materialization_secret", "scr_materialization_secret",
      "sub_materialization_secret", "private-person@example.test", source,
    ]) assert.equal(manifestText.includes(forbidden), false, `manifest must not contain ${forbidden}`);

    await assert.rejects(
      materializeLegacyCredits({
        source, outputDirectory: output, runtimeHashesPath, imageDigest: TEST_IMAGE_DIGEST,
      }),
      /Output directory already exists/,
    );
    await assert.rejects(
      materializeLegacyCredits({
        source, outputDirectory: source, runtimeHashesPath, imageDigest: TEST_IMAGE_DIGEST,
      }),
      /Refusing in-place materialization/,
    );

    const unconfirmedOutput = path.join(root, "unconfirmed-cli-output");
    const unconfirmed = spawnSync(process.execPath, [
      "scripts/supabase-migration/materialize-legacy-credits.mjs",
      "--source", source,
      "--output", unconfirmedOutput,
    ], { cwd: path.resolve("."), encoding: "utf8" });
    assert.notEqual(unconfirmed.status, 0);
    assert.match(unconfirmed.stderr, /Refusing credit materialization without --confirm-copy/);
    assert.equal(fs.existsSync(unconfirmedOutput), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("credit materializer fails closed before copying active jobs or reservations", async () => {
  for (const condition of ["reservation", "job"]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `filmscript-credit-${condition}-`));
    const source = path.join(root, "legacy.sqlite");
    const output = path.join(root, "materialized");
    createMaterializationFixture(source, {
      activeReservation: condition === "reservation",
      activeJob: condition === "job",
    });
    const runtimeHashesPath = writeRuntimeHashes(root);
    const sourceBefore = fs.readFileSync(source);
    try {
      await assert.rejects(
        materializeLegacyCredits({
          source, outputDirectory: output, runtimeHashesPath, imageDigest: TEST_IMAGE_DIGEST,
        }),
        condition === "reservation" ? /active credit reservation/ : /active AI job/,
      );
      assert.equal(fs.existsSync(output), false, "a rejected run leaves no ambiguous partial output");
      assert.deepEqual(fs.readFileSync(source), sourceBefore, "a rejected run never modifies its source");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("credit materializer refuses SQLite WAL/SHM sidecars before creating a staged copy", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-credit-sidecar-"));
  const source = path.join(root, "legacy.sqlite");
  const output = path.join(root, "materialized");
  createMaterializationFixture(source);
  const runtimeHashesPath = writeRuntimeHashes(root);
  fs.writeFileSync(`${source}-wal`, "unreviewed-wal-state", { mode: 0o600 });
  try {
    await assert.rejects(
      materializeLegacyCredits({
        source, outputDirectory: output, runtimeHashesPath, imageDigest: TEST_IMAGE_DIGEST,
      }),
      /has SQLite sidecar files/,
    );
    assert.equal(fs.existsSync(output), false);
    assert.equal(fs.readdirSync(root).some((name) => name.includes("materialized.incomplete-")), false);
    fs.unlinkSync(`${source}-wal`);
    const walDatabase = new Database(source);
    assert.equal(walDatabase.pragma("journal_mode = WAL", { simple: true }), "wal");
    walDatabase.close();
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = `${source}${suffix}`;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }
    await assert.rejects(
      materializeLegacyCredits({
        source, outputDirectory: path.join(root, "wal-header-output"),
        runtimeHashesPath, imageDigest: TEST_IMAGE_DIGEST,
      }),
      /persists WAL journal mode/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function createCreditFixture(filename) {
  const database = new Database(filename);
  database.exec(`
    create table schema_meta (key text primary key, value text not null);
    create table users (
      id text primary key, email text, email_verified integer not null,
      created_at text not null, updated_at text not null
    );
    create table subscriptions (
      user_id text primary key references users(id), plan text, status text, checkout_id text,
      provider_subscription_id text, billing_cycle_key text, current_period_start text,
      current_period_end text, updated_at text not null
    );
    create table app_settings (key text primary key, value_json text not null);
  `);
  database.prepare("insert into schema_meta values (?, ?)").run("schema_version", "18");
  database.prepare("insert into users values (?, ?, ?, ?, ?)").run(
    "usr_credit", "credit@example.test", 1, CAPTURED_AT, CAPTURED_AT,
  );
  database.prepare("insert into subscriptions values (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "usr_credit", "full", "active", null, "sub_credit", PROVIDER_PERIOD,
    PROVIDER_START, PROVIDER_END, CAPTURED_AT,
  );
  database.prepare("insert into app_settings values (?, ?)").run(
    "lumiere_credits", JSON.stringify({ usr_credit: richLegacyAccount() }),
  );
  database.close();
}

async function buildCreditBundle() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-credit-etl-"));
  const source = path.join(root, "source.sqlite");
  const exportDirectory = path.join(root, "export");
  const bundleDirectory = path.join(root, "bundle");
  createCreditFixture(source);
  await snapshotSqlite({ source, outputDirectory: exportDirectory });
  transformBundle({ exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true });
  return { root, bundleDirectory };
}

test("transformed bundles independently retain and reconcile normalized credit rows", async () => {
  const fixture = await buildCreditBundle();
  try {
    const bundle = validateBundle(fixture.bundleDirectory);
    assert.equal(bundle.manifest.creditNormalization.status, "verified");
    assert.equal(bundle.manifest.creditNormalization.accountCount, 1);
    assert.equal(bundle.tables.find((table) => table.target === "private.credit_accounts").rowCount, 1);
    assert.equal(bundle.tables.find((table) => table.target === "private.credit_windows").rowCount, 8);
    assert.equal(bundle.tables.find((table) => table.target === "private.credit_reservations").rowCount, 8);
    assert.equal(bundle.tables.find((table) => table.target === "private.credit_ledger").rowCount, 5);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("normalized credit bundle satisfies the local Postgres schema in a rolled-back transaction", {
  skip: !process.env.FILMSCRIPT_TEST_POSTGRES_URL,
}, async () => {
  const fixture = await buildCreditBundle();
  try {
    const { sql } = buildImportSql(fixture.bundleDirectory, { rollback: true });
    const connection = postgresEnvironmentFromUrl(process.env.FILMSCRIPT_TEST_POSTGRES_URL);
    const result = spawnSync(resolvePsqlBin(), ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1"], {
      env: connection.environment,
      input: sql,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /FILMSCRIPT_IMPORT_OK/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
