import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { normalizeFinancialPermissions, permissionsForRole } from "../../permissions-model.js";
import {
  assertRegularFile,
  createExclusiveDirectory,
  isMain,
  normalizeTimestamp,
  parseArgs,
  quoteIdentifier,
  requiredArg,
  sha256,
  sha256File,
  stableStringify,
  writeJsonExclusive,
} from "./lib/common.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SERVER_FILE = path.join(ROOT, "server.js");
const OUTPUT_DATABASE_NAME = "source.sqlite";
const MANIFEST_NAME = "materialization-manifest.json";
const COPY_CONFIRMATION = "MATERIALIZE_LEGACY_CREDIT_COPY";
const WORKER_TIMEOUT_MS = 120_000;
const RUNTIME_FILES = Object.freeze([
  "server.js", "permissions-model.js", "database.js", "platform-database.js",
]);
const ACTIVE_JOB_STATUSES = new Set(["queued", "processing", "running", "saving"]);
const ACTIVE_PAID_PLANS = new Set(["basic", "creator", "full", "lumiere"]);
const POLICY = Object.freeze({
  name: "legacy-credit-write-fence-materialization",
  version: 1,
  activeJobStatuses: [...ACTIVE_JOB_STATUSES].sort(),
  activePaidPlans: [...ACTIVE_PAID_PLANS].sort(),
  entitlementHooks: ["lumiereCreditsFor", "imageCreditsFor"],
  rejectsActiveReservations: ["text", "image", "free_allowance"],
  permittedChangedTables: ["app_settings"],
  workerTimeoutMs: WORKER_TIMEOUT_MS,
  frozenUtcClock: true,
  rejectsUtcMonthOrWeekBoundaryCrossing: true,
  requiresRollbackJournalHeaderAndNoSidecars: true,
});

function sqliteSidecarPaths(databasePath) {
  return ["-wal", "-shm", "-journal"].map((suffix) => `${databasePath}${suffix}`);
}

function assertNoSqliteSidecars(databasePath, label) {
  const present = sqliteSidecarPaths(databasePath).filter((filename) => fs.existsSync(filename));
  if (present.length) throw new Error(`${label} has SQLite sidecar files; require an offline DELETE-journal source`);
}

function assertRollbackJournalHeader(databasePath, label) {
  const descriptor = fs.openSync(databasePath, "r");
  try {
    const header = Buffer.alloc(20);
    if (fs.readSync(descriptor, header, 0, header.length, 0) !== header.length
      || header.subarray(0, 16).toString("binary") !== "SQLite format 3\u0000") {
      throw new Error(`${label} has an invalid SQLite header`);
    }
    if (header[18] !== 1 || header[19] !== 1) {
      throw new Error(`${label} persists WAL journal mode; require an offline rollback-journal copy`);
    }
  } finally {
    fs.closeSync(descriptor);
  }
}

function utcMonthKey(value) {
  return normalizeTimestamp(value, "materialization clock").slice(0, 7);
}

function utcWeekKey(value) {
  const date = new Date(normalizeTimestamp(value, "materialization clock"));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function assertSameCreditBoundary(startedAt, completedAt) {
  if (utcMonthKey(startedAt) !== utcMonthKey(completedAt)
    || utcWeekKey(startedAt) !== utcWeekKey(completedAt)) {
    throw new Error("Credit materialization crossed a UTC month or week boundary; discard it and retry");
  }
}

function loadRuntimeAttestation(runtimeHashesPath, imageDigest) {
  const filename = path.resolve(String(runtimeHashesPath || ""));
  const stats = assertRegularFile(filename, "Runtime hash attestation");
  if ((stats.mode & 0o022) !== 0) throw new Error("Runtime hash attestation must not be group/world writable");
  let source;
  try { source = JSON.parse(fs.readFileSync(filename, "utf8")); }
  catch { throw new Error("Runtime hash attestation is not valid JSON"); }
  if (!source || typeof source !== "object" || Array.isArray(source)
    || typeof source.image !== "string" || !source.image.trim()
    || !source.hashes || typeof source.hashes !== "object" || Array.isArray(source.hashes)) {
    throw new Error("Runtime hash attestation has an invalid shape");
  }
  const digest = String(imageDigest || "").trim().toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error("Deployed image digest must be sha256:<64 lowercase hex characters>");
  }
  const declaredNames = Object.keys(source.hashes).sort();
  if (stableStringify(declaredNames) !== stableStringify([...RUNTIME_FILES].sort())) {
    throw new Error("Runtime hash attestation must cover exactly the reviewed FilmScript runtime files");
  }
  const hashes = {};
  for (const name of RUNTIME_FILES) {
    const declared = String(source.hashes[name] || "").toLowerCase();
    const actual = sha256File(path.join(ROOT, name));
    if (!/^[0-9a-f]{64}$/.test(declared) || actual !== declared) {
      throw new Error(`Runtime hash attestation disagrees with ${name}`);
    }
    hashes[name] = declared;
  }
  return {
    image: source.image.trim(),
    imageDigest: digest,
    hashes,
    attestationSha256: sha256File(filename),
  };
}

function assertRuntimeUnchanged(runtime) {
  for (const [name, expected] of Object.entries(runtime.hashes)) {
    if (sha256File(path.join(ROOT, name)) !== expected) {
      throw new Error(`Runtime file ${name} changed during credit materialization`);
    }
  }
}

function quote(value) {
  return quoteIdentifier(value);
}

function requiredTables(database) {
  const names = new Set(database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `).all().map((row) => row.name));
  for (const name of [
    "schema_meta", "users", "scripts", "subscriptions", "app_settings",
    "project_memberships", "ai_jobs",
  ]) {
    if (!names.has(name)) throw new Error(`Source database is missing required table ${name}`);
  }
  const schemaVersion = Number(database.prepare(
    "SELECT value FROM schema_meta WHERE key = 'schema_version'",
  ).get()?.value);
  if (schemaVersion !== 18) {
    throw new Error("Source database must be exactly FilmScript schema version 18");
  }
}

function assertDatabaseHealth(database, label) {
  const integrity = database.pragma("integrity_check");
  if (integrity.length !== 1 || String(integrity[0]?.integrity_check || "").toLowerCase() !== "ok") {
    throw new Error(`${label} failed SQLite integrity_check`);
  }
  database.pragma("foreign_keys = ON");
  const foreignKeys = database.pragma("foreign_key_check");
  if (foreignKeys.length) throw new Error(`${label} has ${foreignKeys.length} foreign-key violation(s)`);
  return { integrityCheck: "ok", foreignKeyViolationCount: 0 };
}

function sqliteSchemaDigest(database) {
  const rows = database.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all();
  return sha256(stableStringify(rows));
}

function tableSnapshot(database) {
  const tables = database.prepare(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  const result = {};
  for (const table of tables) {
    const columns = database.prepare(`PRAGMA table_info(${quote(table.name)})`).all();
    const primaryKey = columns.filter((column) => column.pk > 0)
      .sort((left, right) => left.pk - right.pk)
      .map((column) => column.name);
    const order = primaryKey.length
      ? primaryKey.map(quote).join(", ")
      : "rowid";
    const hash = crypto.createHash("sha256");
    let rowCount = 0;
    for (const row of database.prepare(`SELECT * FROM ${quote(table.name)} ORDER BY ${order}`).iterate()) {
      hash.update(stableStringify(row)).update("\n");
      rowCount += 1;
    }
    result[table.name] = {
      rowCount,
      rowsSha256: hash.digest("hex"),
      schemaSha256: sha256(String(table.sql || "")),
    };
  }
  return result;
}

function logicalSnapshot(database) {
  database.exec("BEGIN DEFERRED");
  try {
    const tables = tableSnapshot(database);
    const result = {
      schemaSha256: sqliteSchemaDigest(database),
      tables,
      sha256: sha256(stableStringify(tables)),
    };
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch {}
    throw error;
  }
}

function parseCreditSnapshot(database) {
  const raw = database.prepare(
    "SELECT value_json FROM app_settings WHERE key = 'lumiere_credits'",
  ).get()?.value_json;
  if (raw == null) return {};
  let value;
  try { value = JSON.parse(raw); }
  catch { throw new Error("app_settings.lumiere_credits is not valid JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("app_settings.lumiere_credits must be a JSON object");
  }
  return value;
}

function activeReservationCount(database, cutoff = Date.now()) {
  const snapshot = parseCreditSnapshot(database);
  let count = 0;
  const active = (expiresAt) => {
    const expiry = Date.parse(String(expiresAt || ""));
    return Number.isFinite(expiry) && expiry > cutoff;
  };
  for (const account of Object.values(snapshot)) {
    if (!account || typeof account !== "object" || Array.isArray(account)) continue;
    for (const reservation of Object.values(account.textReservations || {})) {
      if (reservation?.state !== "settled" && active(reservation?.expiresAt)) count += 1;
    }
    for (const reservation of Object.values(account.imageCredits?.reservations || {})) {
      if (active(reservation?.expiresAt)) count += 1;
    }
    for (const allowance of Object.values(account.freeAllowances || {})) {
      if (active(allowance?.reservation?.expiresAt)) count += 1;
    }
  }
  return count;
}

function activeJobCount(database) {
  const placeholders = [...ACTIVE_JOB_STATUSES].map(() => "?").join(", ");
  return Number(database.prepare(
    `SELECT count(*) AS count FROM ai_jobs WHERE lower(trim(status)) IN (${placeholders})`,
  ).get(...ACTIVE_JOB_STATUSES)?.count || 0);
}

function assertQuiescent(database, phase, cutoff = Date.now()) {
  const jobs = activeJobCount(database);
  if (jobs) throw new Error(`${phase} rejected: ${jobs} active AI job(s) remain`);
  const reservations = activeReservationCount(database, cutoff);
  if (reservations) throw new Error(`${phase} rejected: ${reservations} active credit reservation(s) remain`);
  return { activeJobCount: jobs, activeReservationCount: reservations };
}

function paidSubscriptionCount(database) {
  const placeholders = [...ACTIVE_PAID_PLANS].map(() => "?").join(", ");
  return Number(database.prepare(`
    SELECT count(*) AS count
    FROM subscriptions
    WHERE lower(trim(status)) = 'active'
      AND lower(trim(plan)) IN (${placeholders})
  `).get(...ACTIVE_PAID_PLANS)?.count || 0);
}

function parsedJsonEquals(value, expected) {
  try { return stableStringify(JSON.parse(value)) === stableStringify(expected); }
  catch { return false; }
}

function removeSyntheticOwnerMemberships(database, beforeIds) {
  const scripts = new Map(database.prepare("SELECT id, user_id FROM scripts").all()
    .map((row) => [row.id, row.user_id]));
  const expectedModules = permissionsForRole("owner");
  const expectedFinancial = normalizeFinancialPermissions([], "owner");
  const added = database.prepare("SELECT * FROM project_memberships").all()
    .filter((row) => !beforeIds.has(row.id));
  for (const row of added) {
    const scriptOwner = scripts.get(row.project_id);
    const timestampsAreSynthetic = row.created_at === row.updated_at
      && Number.isFinite(Date.parse(String(row.created_at || "")));
    const provenSyntheticOwner = scriptOwner
      && row.user_id === scriptOwner
      && row.invited_by_user_id === scriptOwner
      && row.guest_id == null
      && row.project_role === "owner"
      && row.cinematic_role == null
      && row.status === "active"
      && Number(row.version) === 1
      && parsedJsonEquals(row.module_permissions_json, expectedModules)
      && parsedJsonEquals(row.financial_permissions_json, expectedFinancial)
      && parsedJsonEquals(row.financial_department_ids_json, [])
      && (row.department_ids_json == null || parsedJsonEquals(row.department_ids_json, []))
      && timestampsAreSynthetic;
    if (!provenSyntheticOwner) {
      throw new Error("Server import created a project membership that cannot be proven to be a synthetic owner backfill");
    }
  }
  const remove = database.prepare("DELETE FROM project_memberships WHERE id = ?");
  database.transaction(() => added.forEach((row) => remove.run(row.id)))();
  return added.length;
}

function tableExists(database, name) {
  return Boolean(database.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(name));
}

function activityEventSnapshot(database) {
  if (!tableExists(database, "activity_events")) return [];
  return database.prepare("SELECT * FROM activity_events ORDER BY id").all();
}

function restoreProvenLegacyActivityTimestamps(database, beforeRows) {
  const afterRows = activityEventSnapshot(database);
  if (beforeRows.length !== afterRows.length) {
    throw new Error("Server import changed the activity_events row inventory");
  }
  const beforeById = new Map(beforeRows.map((row) => [row.id, row]));
  const restoreIds = [];
  for (const after of afterRows) {
    const before = beforeById.get(after.id);
    if (!before) throw new Error("Server import added an activity_events row");
    if (stableStringify(before) === stableStringify(after)) continue;
    const beforeWithoutUpdatedAt = { ...before };
    const afterWithoutUpdatedAt = { ...after };
    delete beforeWithoutUpdatedAt.updated_at;
    delete afterWithoutUpdatedAt.updated_at;
    const provenMigration013Backfill = before.updated_at == null
      && after.updated_at === before.created_at
      && stableStringify(beforeWithoutUpdatedAt) === stableStringify(afterWithoutUpdatedAt);
    if (!provenMigration013Backfill) {
      throw new Error("Server import changed an activity_events row beyond the reviewed migration-013 timestamp backfill");
    }
    restoreIds.push(after.id);
  }
  const restore = database.prepare(`
    UPDATE activity_events
    SET updated_at = NULL
    WHERE id = ? AND updated_at = created_at
  `);
  database.transaction(() => {
    for (const id of restoreIds) {
      if (restore.run(id).changes !== 1) {
        throw new Error("Could not narrowly restore a reviewed activity_events timestamp");
      }
    }
  })();
  if (stableStringify(activityEventSnapshot(database)) !== stableStringify(beforeRows)) {
    throw new Error("activity_events did not return to its exact pre-import state");
  }
  return restoreIds.length;
}

function assertOnlyAppSettingsChanged(before, after) {
  if (before.schemaSha256 !== after.schemaSha256) {
    throw new Error("Server import changed the SQLite schema");
  }
  const names = new Set([...Object.keys(before.tables), ...Object.keys(after.tables)]);
  for (const name of names) {
    if (name === "app_settings") continue;
    if (stableStringify(before.tables[name]) !== stableStringify(after.tables[name])) {
      throw new Error(`Server import changed forbidden table ${name}`);
    }
  }
}

function appSettingsSnapshot(database) {
  return new Map(database.prepare("SELECT key, value_json FROM app_settings ORDER BY key").all()
    .map((row) => [row.key, row.value_json]));
}

function assertOnlyLumiereCreditsSettingChanged(before, after) {
  if (stableStringify([...before.keys()]) !== stableStringify([...after.keys()])) {
    throw new Error("Server import changed the app_settings key inventory");
  }
  for (const [key, value] of before) {
    if (key !== "lumiere_credits" && after.get(key) !== value) {
      throw new Error(`Server import changed forbidden app_settings key ${key}`);
    }
  }
}

function runEntitlementWorker(databasePath, runtime, capturedAt) {
  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--internal-worker"], {
    cwd: ROOT,
    env: {
      ...process.env,
      FILMSCRIPT_MATERIALIZE_DB: databasePath,
      FILMSCRIPT_MATERIALIZE_RUNTIME: JSON.stringify(runtime),
      FILMSCRIPT_MATERIALIZE_CAPTURED_AT: capturedAt,
      FILMSCRIPT_DB_PATH: databasePath,
      FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      FILMSCRIPT_PREVIEW_MODE: "false",
      NODE_ENV: "test",
    },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: WORKER_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  if (result.error?.code === "ETIMEDOUT" || result.signal === "SIGKILL") {
    throw new Error(`Entitlement materialization worker exceeded ${WORKER_TIMEOUT_MS}ms`);
  }
  if (result.status !== 0) {
    throw new Error(`Entitlement materialization worker failed: ${(result.stderr || result.stdout || "unknown failure").trim()}`);
  }
  let summary;
  try { summary = JSON.parse(result.stdout); }
  catch { throw new Error("Entitlement materialization worker returned an invalid result"); }
  if (summary?.status !== "materialized" || !Number.isSafeInteger(summary.accountCount)) {
    throw new Error("Entitlement materialization worker did not attest completion");
  }
  return summary;
}

async function entitlementWorker() {
  const databasePath = path.resolve(String(process.env.FILMSCRIPT_MATERIALIZE_DB || ""));
  assertRegularFile(databasePath, "Materialization database");
  process.env.FILMSCRIPT_DB_PATH = databasePath;
  process.env.FILMSCRIPT_SQLITE_JOURNAL_MODE = "DELETE";
  process.env.FILMSCRIPT_PREVIEW_MODE = "false";
  process.env.NODE_ENV = "test";
  let runtime;
  try { runtime = JSON.parse(String(process.env.FILMSCRIPT_MATERIALIZE_RUNTIME || "")); }
  catch { throw new Error("Materialization worker runtime attestation is invalid"); }
  if (!runtime?.hashes || stableStringify(Object.keys(runtime.hashes).sort()) !== stableStringify([...RUNTIME_FILES].sort())) {
    throw new Error("Materialization worker runtime attestation is incomplete");
  }
  const capturedAt = normalizeTimestamp(
    process.env.FILMSCRIPT_MATERIALIZE_CAPTURED_AT,
    "materialization worker capturedAt",
  );
  const frozenMilliseconds = Date.parse(capturedAt);
  const NativeDate = globalThis.Date;
  class FrozenDate extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [frozenMilliseconds])); }
    static now() { return frozenMilliseconds; }
  }
  globalThis.Date = FrozenDate;
  assertRuntimeUnchanged(runtime);
  const server = await import(`${pathToFileURL(SERVER_FILE).href}?credit-materialization=${frozenMilliseconds}`);
  assertRuntimeUnchanged(runtime);
  const hooks = server.__entitlementTesting;
  if (typeof hooks?.lumiereCreditsFor !== "function" || typeof hooks?.imageCreditsFor !== "function") {
    throw new Error("server.__entitlementTesting does not expose both entitlement materialization hooks");
  }
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const placeholders = [...ACTIVE_PAID_PLANS].map(() => "?").join(", ");
    const subscriptions = database.prepare(`
      SELECT user_id
      FROM subscriptions
      WHERE lower(trim(status)) = 'active'
        AND lower(trim(plan)) IN (${placeholders})
      ORDER BY user_id
    `).all(...ACTIVE_PAID_PLANS);
    for (const subscription of subscriptions) {
      const text = hooks.lumiereCreditsFor(subscription.user_id);
      const image = hooks.imageCreditsFor(subscription.user_id);
      if (!text || !image) throw new Error("An active paid account could not be materialized");
    }
    assertRuntimeUnchanged(runtime);
    process.stdout.write(JSON.stringify({
      status: "materialized",
      accountCount: subscriptions.length,
      capturedAt,
      runtimeSha256: sha256(stableStringify(runtime)),
    }));
  } finally {
    database.close();
  }
}

export function validateCreditMaterializationAttestation(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)
    || manifest.kind !== "filmscript-legacy-credit-materialization" || manifest.formatVersion !== 2) {
    throw new Error("Unsupported legacy credit materialization attestation");
  }
  if (manifest.files?.database !== OUTPUT_DATABASE_NAME || manifest.files?.manifest !== MANIFEST_NAME) {
    throw new Error("Credit materialization attestation has unexpected file names");
  }
  for (const field of ["bytes", "fileSha256", "logicalSha256", "schemaSha256"]) {
    if (field === "bytes") {
      if (!Number.isSafeInteger(manifest.input?.[field]) || manifest.input[field] < 0
        || !Number.isSafeInteger(manifest.output?.[field]) || manifest.output[field] < 0) {
        throw new Error("Credit materialization attestation has invalid database byte counts");
      }
    } else if (!/^[0-9a-f]{64}$/.test(manifest.input?.[field] || "")
      || !/^[0-9a-f]{64}$/.test(manifest.output?.[field] || "")) {
      throw new Error("Credit materialization attestation has invalid database hashes");
    }
  }
  const expectedPolicy = {
    name: POLICY.name,
    version: POLICY.version,
    contractSha256: sha256(stableStringify(POLICY)),
    serverJsSha256: manifest.runtime?.hashes?.["server.js"],
    hooks: [...POLICY.entitlementHooks],
  };
  if (stableStringify(manifest.policy) !== stableStringify(expectedPolicy)) {
    throw new Error("Credit materialization policy attestation is not the reviewed policy");
  }
  const runtime = manifest.runtime;
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)
    || typeof runtime.image !== "string" || !runtime.image.trim()
    || !/^sha256:[0-9a-f]{64}$/.test(runtime.imageDigest || "")
    || !/^[0-9a-f]{64}$/.test(runtime.attestationSha256 || "")
    || stableStringify(Object.keys(runtime.hashes || {}).sort()) !== stableStringify([...RUNTIME_FILES].sort())
    || Object.values(runtime.hashes || {}).some((value) => !/^[0-9a-f]{64}$/.test(value || ""))) {
    throw new Error("Credit materialization runtime attestation is invalid");
  }
  const runtimeContract = {
    image: runtime.image,
    imageDigest: runtime.imageDigest,
    hashes: runtime.hashes,
    attestationSha256: runtime.attestationSha256,
  };
  if (runtime.contractSha256 !== sha256(stableStringify(runtimeContract))) {
    throw new Error("Credit materialization runtime contract hash is invalid");
  }
  const startedAt = normalizeTimestamp(manifest.clock?.startedAt, "credit materialization startedAt");
  const capturedAt = normalizeTimestamp(manifest.clock?.capturedAt, "credit materialization capturedAt");
  const completedAt = normalizeTimestamp(manifest.clock?.completedAt, "credit materialization completedAt");
  if (capturedAt !== startedAt || Date.parse(completedAt) < Date.parse(capturedAt)
    || manifest.createdAt !== completedAt
    || manifest.clock.utcMonth !== utcMonthKey(capturedAt)
    || manifest.clock.utcWeek !== utcWeekKey(capturedAt)) {
    throw new Error("Credit materialization clock attestation is inconsistent");
  }
  assertSameCreditBoundary(startedAt, completedAt);
  const verification = manifest.verification || {};
  if (verification.integrityCheck !== "ok" || verification.foreignKeyViolationCount !== 0
    || verification.activeJobCount !== 0 || verification.activeReservationCount !== 0
    || verification.activePaidSubscriptionCount !== verification.materializedAccountCount
    || verification.nonAppSettingsTablesUnchanged !== true
    || verification.nonCreditAppSettingsUnchanged !== true
    || verification.sourceUnchanged !== true
    || !Number.isSafeInteger(verification.syntheticOwnerMembershipsRemoved)
    || !Number.isSafeInteger(verification.activityTimestampsRestored)) {
    throw new Error("Credit materialization verification gates are incomplete");
  }
  return manifest;
}

export function validateCreditMaterializationManifest({ manifestPath, databasePath, requirePhysicalMatch = true }) {
  const filename = path.resolve(String(manifestPath || ""));
  const databaseFilename = path.resolve(String(databasePath || ""));
  assertRegularFile(filename, "Credit materialization manifest");
  const databaseStats = assertRegularFile(databaseFilename, "Credit materialization database");
  assertNoSqliteSidecars(databaseFilename, "Credit materialization database");
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(filename, "utf8")); }
  catch { throw new Error("Credit materialization manifest is not valid JSON"); }
  validateCreditMaterializationAttestation(manifest);
  if (requirePhysicalMatch
    && (databaseStats.size !== manifest.output.bytes || sha256File(databaseFilename) !== manifest.output.fileSha256)) {
    throw new Error("Credit materialization database physical hash does not match its attestation");
  }
  const database = new Database(databaseFilename, { readonly: true, fileMustExist: true });
  let logical;
  try {
    requiredTables(database);
    assertDatabaseHealth(database, "Credit materialization database");
    logical = logicalSnapshot(database);
  } finally {
    database.close();
  }
  assertNoSqliteSidecars(databaseFilename, "Validated credit materialization database");
  if (logical.sha256 !== manifest.output.logicalSha256
    || logical.schemaSha256 !== manifest.output.schemaSha256) {
    throw new Error("Credit materialization database logical hash does not match its attestation");
  }
  return { manifest, manifestSha256: sha256File(filename), logical };
}

export async function materializeLegacyCredits({ source, outputDirectory, runtimeHashesPath, imageDigest }) {
  const sourcePath = path.resolve(String(source || ""));
  const outputPath = path.resolve(String(outputDirectory || ""));
  assertRegularFile(sourcePath, "Source SQLite database");
  if (sourcePath === outputPath) throw new Error("Refusing in-place materialization: source and output must be different paths");
  if (outputPath.startsWith(`${sourcePath}${path.sep}`)) {
    throw new Error("Refusing to place materialized output inside the source database path");
  }
  if (fs.existsSync(outputPath)) throw new Error(`Output directory already exists: ${outputPath}`);
  assertNoSqliteSidecars(sourcePath, "Source SQLite database");
  assertRollbackJournalHeader(sourcePath, "Source SQLite database");
  const runtime = loadRuntimeAttestation(runtimeHashesPath, imageDigest);
  const startedAt = new Date().toISOString();
  const capturedAt = startedAt;
  const capturedMilliseconds = Date.parse(capturedAt);
  const sourceFileBefore = { bytes: fs.statSync(sourcePath).size, sha256: sha256File(sourcePath) };
  assertRuntimeUnchanged(runtime);
  const stagingPath = `${outputPath}.incomplete-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  const destinationDirectory = createExclusiveDirectory(stagingPath);
  const destinationDatabase = path.join(destinationDirectory, OUTPUT_DATABASE_NAME);
  const incompleteMarker = path.join(destinationDirectory, "INCOMPLETE");
  fs.writeFileSync(incompleteMarker, "Credit materialization is incomplete. Do not consume this directory.\n", {
    encoding: "utf8", flag: "wx", mode: 0o600,
  });
  try {
    const sourceDatabase = new Database(sourcePath, { readonly: true, fileMustExist: true });
    let sourceLogicalBefore;
    try {
      requiredTables(sourceDatabase);
      assertDatabaseHealth(sourceDatabase, "Source database");
      assertQuiescent(sourceDatabase, "Preflight", capturedMilliseconds);
      sourceLogicalBefore = logicalSnapshot(sourceDatabase);
      await sourceDatabase.backup(destinationDatabase);
    } finally {
      sourceDatabase.close();
    }
    fs.chmodSync(destinationDatabase, 0o600);

    const destination = new Database(destinationDatabase, { fileMustExist: true });
    let before;
    let appSettingsBefore;
    let membershipIds;
    let paidAccounts;
    let activityEventsBefore;
    try {
      const journal = String(destination.pragma("journal_mode = DELETE", { simple: true }) || "").toLowerCase();
      if (journal !== "delete") throw new Error(`Materialized database did not enter DELETE journal mode (${journal || "unknown"})`);
      requiredTables(destination);
      assertDatabaseHealth(destination, "Backup database");
      assertQuiescent(destination, "Backup preflight", capturedMilliseconds);
      before = logicalSnapshot(destination);
      appSettingsBefore = appSettingsSnapshot(destination);
      if (before.sha256 !== sourceLogicalBefore.sha256 || before.schemaSha256 !== sourceLogicalBefore.schemaSha256) {
        throw new Error("SQLite backup does not match the source logical snapshot");
      }
      membershipIds = new Set(destination.prepare("SELECT id FROM project_memberships").all().map((row) => row.id));
      paidAccounts = paidSubscriptionCount(destination);
      activityEventsBefore = activityEventSnapshot(destination);
    } finally {
      destination.close();
    }
    assertNoSqliteSidecars(destinationDatabase, "Backup database");
    assertRollbackJournalHeader(destinationDatabase, "Backup database");

    const worker = runEntitlementWorker(destinationDatabase, runtime, capturedAt);
    if (worker.accountCount !== paidAccounts) {
      throw new Error("Entitlement worker account count disagrees with the backup preflight");
    }
    if (worker.capturedAt !== capturedAt
      || worker.runtimeSha256 !== sha256(stableStringify(runtime))) {
      throw new Error("Entitlement worker attestation disagrees with its fixed clock or runtime");
    }
    assertRuntimeUnchanged(runtime);

    const verified = new Database(destinationDatabase, { fileMustExist: true });
    let after;
    let appSettingsAfter;
    let removedSyntheticOwners;
    let health;
    let quiescence;
    let journalMode;
    let activityTimestampsRestored;
    try {
      journalMode = String(verified.pragma("journal_mode = DELETE", { simple: true }) || "").toLowerCase();
      if (journalMode !== "delete") throw new Error("Post-materialization database is not using DELETE journal mode");
      removedSyntheticOwners = removeSyntheticOwnerMemberships(verified, membershipIds);
      activityTimestampsRestored = restoreProvenLegacyActivityTimestamps(verified, activityEventsBefore);
      health = assertDatabaseHealth(verified, "Materialized database");
      quiescence = assertQuiescent(verified, "Postflight", capturedMilliseconds);
      after = logicalSnapshot(verified);
      assertOnlyAppSettingsChanged(before, after);
      appSettingsAfter = appSettingsSnapshot(verified);
      assertOnlyLumiereCreditsSettingChanged(appSettingsBefore, appSettingsAfter);
    } finally {
      verified.close();
    }
    assertNoSqliteSidecars(destinationDatabase, "Materialized database");
    assertRollbackJournalHeader(destinationDatabase, "Materialized database");

    const sourceVerification = new Database(sourcePath, { readonly: true, fileMustExist: true });
    let sourceLogicalAfter;
    try { sourceLogicalAfter = logicalSnapshot(sourceVerification); }
    finally { sourceVerification.close(); }
    const sourceFileAfter = { bytes: fs.statSync(sourcePath).size, sha256: sha256File(sourcePath) };
    assertNoSqliteSidecars(sourcePath, "Source SQLite database after materialization");
    assertRollbackJournalHeader(sourcePath, "Source SQLite database after materialization");
    if (stableStringify(sourceFileAfter) !== stableStringify(sourceFileBefore)
      || sourceLogicalAfter.sha256 !== sourceLogicalBefore.sha256
      || sourceLogicalAfter.schemaSha256 !== sourceLogicalBefore.schemaSha256) {
      throw new Error("Source SQLite database changed during materialization");
    }

    fs.chmodSync(destinationDatabase, 0o600);
    assertRuntimeUnchanged(runtime);
    const completedAt = new Date().toISOString();
    assertSameCreditBoundary(startedAt, completedAt);
    const manifest = {
      formatVersion: 2,
      kind: "filmscript-legacy-credit-materialization",
      createdAt: completedAt,
      files: {
        database: OUTPUT_DATABASE_NAME,
        manifest: MANIFEST_NAME,
      },
      input: {
        bytes: sourceFileBefore.bytes,
        fileSha256: sourceFileBefore.sha256,
        logicalSha256: sourceLogicalBefore.sha256,
        schemaSha256: sourceLogicalBefore.schemaSha256,
      },
      output: {
        bytes: fs.statSync(destinationDatabase).size,
        fileSha256: sha256File(destinationDatabase),
        logicalSha256: after.sha256,
        schemaSha256: after.schemaSha256,
      },
      policy: {
        name: POLICY.name,
        version: POLICY.version,
        contractSha256: sha256(stableStringify(POLICY)),
        serverJsSha256: runtime.hashes["server.js"],
        hooks: [...POLICY.entitlementHooks],
      },
      runtime: {
        image: runtime.image,
        imageDigest: runtime.imageDigest,
        hashes: runtime.hashes,
        attestationSha256: runtime.attestationSha256,
        contractSha256: sha256(stableStringify(runtime)),
      },
      clock: {
        startedAt,
        capturedAt,
        completedAt,
        utcMonth: utcMonthKey(capturedAt),
        utcWeek: utcWeekKey(capturedAt),
      },
      verification: {
        journalMode,
        ...health,
        ...quiescence,
        activePaidSubscriptionCount: paidAccounts,
        materializedAccountCount: worker.accountCount,
        syntheticOwnerMembershipsRemoved: removedSyntheticOwners,
        activityTimestampsRestored,
        tableCount: Object.keys(after.tables).length,
        nonAppSettingsTablesUnchanged: true,
        nonCreditAppSettingsUnchanged: true,
        appSettingsBeforeSha256: before.tables.app_settings.rowsSha256,
        appSettingsAfterSha256: after.tables.app_settings.rowsSha256,
        sourceUnchanged: true,
      },
    };
    const manifestPath = path.join(destinationDirectory, MANIFEST_NAME);
    writeJsonExclusive(manifestPath, manifest, 0o600);
    assertNoSqliteSidecars(destinationDatabase, "Final materialized database");
    fs.unlinkSync(incompleteMarker);
    fs.renameSync(destinationDirectory, outputPath);
    const finalDatabasePath = path.join(outputPath, OUTPUT_DATABASE_NAME);
    const finalManifestPath = path.join(outputPath, MANIFEST_NAME);
    return { outputDirectory: outputPath, databasePath: finalDatabasePath, manifestPath: finalManifestPath, manifest };
  } catch (error) {
    fs.rmSync(destinationDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  if (process.argv[2] === "--internal-worker") {
    await entitlementWorker();
    return;
  }
  const args = parseArgs(process.argv.slice(2));
  const unexpected = Object.keys(args).filter((key) => ![
    "source", "output", "confirm-copy", "runtime-hashes", "image-digest",
  ].includes(key));
  if (unexpected.length) throw new Error(`Unknown option --${unexpected[0]}`);
  if (args["confirm-copy"] !== COPY_CONFIRMATION) {
    throw new Error(`Refusing credit materialization without --confirm-copy ${COPY_CONFIRMATION}`);
  }
  const source = requiredArg(args, "source");
  const outputDirectory = requiredArg(args, "output");
  const result = await materializeLegacyCredits({
    source,
    outputDirectory,
    runtimeHashesPath: requiredArg(args, "runtime-hashes"),
    imageDigest: requiredArg(args, "image-digest"),
  });
  process.stdout.write(`${JSON.stringify({
    status: "materialized",
    outputDirectory: result.outputDirectory,
    database: result.databasePath,
    manifest: result.manifestPath,
    accountCount: result.manifest.verification.materializedAccountCount,
  }, null, 2)}\n`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Credit materialization failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
