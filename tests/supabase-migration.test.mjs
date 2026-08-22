import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { assertSupabaseProjectRef, postgresEnvironmentFromUrl, requireProductionConfirmation, resolveInside, resolvePsqlBin, sha256, stableStringify, storageContractDataSha256, validateSupabaseServiceUrl } from "../scripts/supabase-migration/lib/common.mjs";
import { snapshotSqlite, validateSnapshotExport } from "../scripts/supabase-migration/snapshot-sqlite.mjs";
import { transformBundle } from "../scripts/supabase-migration/transform-bundle.mjs";
import { loadStoragePlan, validateBundle } from "../scripts/supabase-migration/lib/bundle.mjs";
import { buildImportSql } from "../scripts/supabase-migration/import-postgres.mjs";
import { buildCaptureSql, parseCaptureFile, parseCaptureOutput } from "../scripts/supabase-migration/capture-postgres-manifest.mjs";
import { reconcilePostgres } from "../scripts/supabase-migration/reconcile.mjs";
import { createStorageManifest } from "../scripts/supabase-migration/create-storage-manifest.mjs";
import { validateStorageManifest } from "../scripts/supabase-migration/copy-storage.mjs";
import { captureStorage } from "../scripts/supabase-migration/capture-storage-manifest.mjs";
import { reconcileStorage } from "../scripts/supabase-migration/reconcile-storage.mjs";
import { auditMapping, captureTargetColumns } from "../scripts/supabase-migration/audit-mapping.mjs";
import {
  remediateLegacyProjectOwners,
  validateProjectOwnershipGraph,
  validateProjectOwnershipRemediation,
} from "../scripts/supabase-migration/lib/project-ownership.mjs";
import {
  buildMissingProjectPrefixQuarantine,
  validateLegacyOrphanStorageGraph,
  validateLegacyOrphanStorageRows,
} from "../scripts/supabase-migration/lib/storage-quarantine.mjs";
import { LEGACY_ACTIVITY_UPDATED_AT_MARKER } from "../scripts/supabase-migration/lib/activity-remediation.mjs";

const PRODUCTION_S3_BUCKET = "filmscript-production-mediabucket-xzgdb1rat94u";

function createFixture(filename, { invalidJson = false } = {}) {
  const database = new Database(filename);
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT, lumiere_preferences_json TEXT NOT NULL,
      email_verified INTEGER NOT NULL, birth_date TEXT, avatar_key TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE scripts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      blocks_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE budget_receipts (
      id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES scripts(id), user_id TEXT NOT NULL REFERENCES users(id),
      filename TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, data_blob BLOB NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE collaboration_documents (
      project_id TEXT NOT NULL, document_id TEXT NOT NULL,
      module TEXT NOT NULL, snapshot_blob BLOB NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(project_id, document_id)
    );
    CREATE TABLE collaboration_operations (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, document_id TEXT NOT NULL,
      module TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL REFERENCES users(id), base_version INTEGER NOT NULL,
      committed_version INTEGER NOT NULL, operation_type TEXT NOT NULL, patch_json TEXT NOT NULL,
      previous_json TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
    CREATE TABLE canvas_workspaces (
      script_id TEXT PRIMARY KEY REFERENCES scripts(id), user_id TEXT NOT NULL REFERENCES users(id),
      data_json TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE canvas_libraries (
      user_id TEXT PRIMARY KEY REFERENCES users(id), data_json TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), project_id TEXT REFERENCES scripts(id),
      type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, actor_user_id TEXT REFERENCES users(id),
      deep_link TEXT, contains_financial_data INTEGER NOT NULL, financial_department_id TEXT,
      aggregation_key TEXT, aggregation_count INTEGER NOT NULL, metadata_json TEXT NOT NULL,
      read_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL);
  `);
  const now = "2026-08-22T12:34:56.000Z";
  const receipt = Buffer.from("receipt-bytes\u0000with-binary", "utf8");
  database.prepare("INSERT INTO schema_meta VALUES (?, ?)").run("schema_version", "18");
  database.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    "usr_1", "person@example.com", '{"style":"reference"}', 1, "1990-05-01",
    JSON.stringify({ provider: "s3", key: "filmscript/canvas/profiles/avatar_usr_1.webp" }), now, now,
  );
  database.prepare("INSERT INTO scripts VALUES (?, ?, ?, ?, ?, ?)").run("scr_1", "usr_1", "Example", '[{"type":"scene"}]', now, now);
  database.prepare("INSERT INTO canvas_workspaces VALUES (?, ?, ?, ?)").run(
    "scr_1", "usr_1",
    JSON.stringify({ assets: [{ id: "cas_1", key: "filmscript/canvas/scr_1/asset.jpg", source: "imagine" }] }), now,
  );
  database.prepare("INSERT INTO canvas_libraries VALUES (?, ?, ?)").run(
    "usr_1",
    JSON.stringify({ assets: [
      { id: "cas_1", key: "filmscript/canvas/scr_1/asset.jpg", source: "imagine" },
      { id: "cas_personal", key: "filmscript/canvas/imaging_usr_1/personal.jpg", source: "imagine" },
    ] }), now,
  );
  database.prepare("INSERT INTO notifications VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "not_budget_mention", "usr_1", "scr_1", "mention", "You were mentioned", "Budget is 88888",
    "usr_1", "/Editor%20v5.dc.html?script=scr_1&view=budget", 0, null, null, 1, "{}", null, now, now,
  );
  database.prepare("INSERT INTO budget_receipts VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run("rcp_1", "scr_1", "usr_1", "receipt/one.pdf", "application/pdf", receipt.length, receipt, now);
  database.prepare("INSERT INTO collaboration_documents VALUES (?, ?, ?, ?, ?, ?)")
    .run("scr_1", "doc_1", "script", Buffer.from([0, 1, 2, 255]), 7, now);
  database.prepare("INSERT INTO app_settings VALUES (?, ?)").run("credits", invalidJson ? "{bad" : '{"budget":5,"spent":1}');
  database.prepare("INSERT INTO sessions VALUES (?, ?)").run("ses_1", "secret-hash");
  database.close();
  return { now, receipt };
}

function createV18Fixture(filename) {
  const initializer = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    process.env.FILMSCRIPT_DB_PATH = ${JSON.stringify(filename)};
    process.env.FILMSCRIPT_SQLITE_JOURNAL_MODE = "DELETE";
    await import("./platform-database.js");
  `], { cwd: path.resolve("."), encoding: "utf8" });
  assert.equal(initializer.status, 0, initializer.stderr || initializer.stdout);
  const database = new Database(filename);
  const now = "2026-08-22T12:34:56.000Z";
  const receipt = Buffer.from("v18-receipt", "utf8");
  database.prepare(`INSERT INTO users
    (id,email,lumiere_preferences_json,email_verified,birth_date,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run("usr_v18", "v18@example.com", "{}", 1, "1990-05-01", now, now);
  database.prepare(`INSERT INTO scripts
    (id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)`).run("scr_v18", "usr_v18", "V18", now, now);
  database.prepare(`INSERT INTO project_memberships
    (id,project_id,user_id,project_role,module_permissions_json,financial_permissions_json,
     financial_department_ids_json,department_ids_json,status,invited_by_user_id,version,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    "mem_v18_owner", "scr_v18", "usr_v18", "owner", "{}", '["financial.edit_all"]',
    "[]", "[]", "active", "usr_v18", 1, now, now,
  );
  database.prepare(`INSERT INTO budget_receipts
    (id,script_id,user_id,filename,mime_type,size_bytes,data_blob,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run("rcp_v18", "scr_v18", "usr_v18", "v18.pdf", "application/pdf", receipt.length, receipt, now);
  database.prepare(`INSERT INTO ai_jobs
    (id,project_id,requested_by_user_id,type,status,progress,stage,source_script_id,
     source_script_version_id,source_content_hash,internal_primary_model,used_fallback,
     reserved_credits,settled_credits,idempotency_key,input_json,output_json,
     output_schema_version,error_code,created_at,completed_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    "job_v18_failed", "scr_v18", "usr_v18", "analysis", "failed", 37, "failed",
    "scr_v18", "ver_v18", "hash_v18", "gpt-test", 0, 2, 0, "idem_v18_failed",
    "{}", "null", 1, "provider_failed", now, now, now,
  );
  database.close();
}

function writeProductionS3Inventory(filename, { bucket = PRODUCTION_S3_BUCKET, prefix = "", entries = [] } = {}) {
  fs.writeFileSync(filename, `${JSON.stringify({
    format: "filmscript-s3-inventory",
    formatVersion: 1,
    bucket,
    prefix,
    objectCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.source.bytes, 0),
    dataSha256: sha256(stableStringify(entries.map((entry) => ({
      key: entry.source.key, bytes: entry.source.bytes, sha256: entry.source.sha256,
    })))),
    entries,
  }, null, 2)}\n`);
}

async function withFixture(callback, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-migration-test-"));
  try {
    const source = path.join(root, "source.sqlite");
    const fixture = createFixture(source, options);
    return await callback({ root, source, ...fixture });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function postgresOutputFromBundle(bundle) {
  const lines = [];
  for (const table of bundle.tables) {
    lines.push(`__FILMSCRIPT_TABLE__:${table.target}`);
    for (const row of table.rows) {
      const actual = {};
      for (const column of table.columns) {
        const value = row[column];
        if (table.columnTypes[column] === "bigint" && value != null) actual[column] = value.value;
        else if (table.columnTypes[column] === "bytea" && value != null) {
          actual[column] = fs.readFileSync(resolveInside(bundle.root, value.path)).toString("hex");
        } else actual[column] = value;
      }
      lines.push(JSON.stringify(actual));
    }
    lines.push("__FILMSCRIPT_END__");
  }
  return `${lines.join("\n")}\n`;
}

test("SQLite snapshot is consistent, canonical, and independently verifiable", async () => {
  await withFixture(async ({ root, source, receipt }) => {
    const exportDirectory = path.join(root, "export");
    const manifest = await snapshotSqlite({ source, outputDirectory: exportDirectory });
    assert.equal(manifest.schemaVersion, "18");
    assert.equal(manifest.snapshot.integrityCheck, "ok");
    assert.equal(new Date(manifest.source.capturedAt).toISOString(), manifest.source.capturedAt);
    assert.ok(Date.parse(manifest.source.capturedAt) <= Date.parse(manifest.generatedAt));
    assert.equal(manifest.tables.find((table) => table.name === "budget_receipts").rowCount, 1);
    assert.deepEqual(validateSnapshotExport(exportDirectory).ok, true);
    const receiptRow = JSON.parse(fs.readFileSync(path.join(exportDirectory, "tables", "budget_receipts.ndjson"), "utf8"));
    assert.equal(receiptRow.data_blob.sha256, sha256(receipt));
    assert.equal(fs.statSync(resolveInside(exportDirectory, receiptRow.data_blob.path)).size, receipt.length);
  });
});

test("SQLite validation binds manifest structure and NDJSON rows to source.sqlite", async () => {
  await withFixture(async ({ root, source }) => {
    const exportDirectory = path.join(root, "export");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    const manifestPath = path.join(exportDirectory, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const users = manifest.tables.find((table) => table.name === "users");
    users.columns = users.columns.filter((column) => column.name !== "birth_date");
    const dataPath = resolveInside(exportDirectory, users.dataFile);
    const rows = fs.readFileSync(dataPath, "utf8").trim().split("\n").map((line) => {
      const row = JSON.parse(line);
      delete row.birth_date;
      return row;
    });
    const contents = rows.map(stableStringify).join("\n");
    fs.writeFileSync(dataPath, `${contents}\n`);
    users.rowSha256 = sha256(`${contents}\n`);
    manifest.dataSha256 = sha256(stableStringify(manifest.tables.map(({ name, rowCount, rowSha256 }) => ({ name, rowCount, rowSha256 }))));
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    assert.throws(() => validateSnapshotExport(exportDirectory), /metadata for table users does not match source\.sqlite/);
  });
});

test("production transform refuses a non-v18 or incomplete SQLite snapshot", async () => {
  await withFixture(async ({ root, source }) => {
    const wrongVersionExport = path.join(root, "wrong-version-export");
    await snapshotSqlite({ source, outputDirectory: wrongVersionExport });
    const wrongVersionManifestPath = path.join(wrongVersionExport, "manifest.json");
    const wrongVersionManifest = JSON.parse(fs.readFileSync(wrongVersionManifestPath, "utf8"));
    wrongVersionManifest.schemaVersion = "17";
    fs.writeFileSync(wrongVersionManifestPath, `${JSON.stringify(wrongVersionManifest, null, 2)}\n`);
    assert.throws(
      () => transformBundle({ exportDirectory: wrongVersionExport, outputDirectory: path.join(root, "wrong-version-bundle") }),
      /Expected FilmScript SQLite schema 18; received 17/,
    );

    const incompleteExport = path.join(root, "incomplete-export");
    await snapshotSqlite({ source, outputDirectory: incompleteExport });
    assert.throws(
      () => transformBundle({ exportDirectory: incompleteExport, outputDirectory: path.join(root, "incomplete-bundle") }),
      /SQLite snapshot is missing .* required tables/,
    );
  });
});

test("full production transform requires a whole-bucket S3 inventory and the v18 fixture has a valid owner", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-full-inventory-gate-"));
  try {
    const source = path.join(root, "source.sqlite");
    const exportDirectory = path.join(root, "export");
    createV18Fixture(source);
    const database = new Database(source, { readonly: true });
    const ownership = database.prepare(`SELECT s.id, s.user_id AS script_owner, m.user_id AS membership_owner
      FROM scripts s
      JOIN project_memberships m ON m.project_id=s.id AND m.project_role='owner' AND m.status='active'`).all();
    database.close();
    assert.equal(ownership.length, 1);
    assert.equal(ownership[0].membership_owner, ownership[0].script_owner);
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    assert.throws(
      () => transformBundle({ exportDirectory, outputDirectory: path.join(root, "bundle") }),
      /requires a complete --s3-inventory/,
    );
    const wrongBucketInventory = path.join(root, "wrong-bucket-inventory.json");
    writeProductionS3Inventory(wrongBucketInventory, { bucket: "another-bucket" });
    assert.throws(
      () => transformBundle({
        exportDirectory,
        outputDirectory: path.join(root, "wrong-bucket-bundle"),
        s3InventoryPath: wrongBucketInventory,
      }),
      /requires S3 inventory bucket filmscript-production-mediabucket-xzgdb1rat94u/,
    );
    const prefixedInventory = path.join(root, "prefixed-inventory.json");
    writeProductionS3Inventory(prefixedInventory, { prefix: "filmscript/" });
    assert.throws(
      () => transformBundle({
        exportDirectory,
        outputDirectory: path.join(root, "prefixed-bundle"),
        s3InventoryPath: prefixedInventory,
      }),
      /requires an unprefixed whole-bucket S3 inventory/,
    );
    const mismatchedEntryInventory = path.join(root, "mismatched-entry-inventory.json");
    writeProductionS3Inventory(mismatchedEntryInventory, { entries: [{
      id: "s3:filmscript/canvas/scr_v18/example.jpg",
      source: {
        type: "s3",
        bucket: "another-bucket",
        key: "filmscript/canvas/scr_v18/example.jpg",
        bytes: 1,
        sha256: "a".repeat(64),
      },
      target: { bucket: "filmscript-private", path: "filmscript/canvas/scr_v18/example.jpg" },
    }] });
    assert.throws(
      () => transformBundle({
        exportDirectory,
        outputDirectory: path.join(root, "mismatched-entry-bundle"),
        s3InventoryPath: mismatchedEntryInventory,
      }),
      /does not belong to its declared source bucket/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("AI job JSON-null output is coerced only for failed or cancelled jobs", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-ai-job-json-null-"));
  try {
    const source = path.join(root, "source.sqlite");
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    createV18Fixture(source);
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    transformBundle({ exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true });
    const bundle = validateBundle(bundleDirectory);
    const failed = bundle.tables.find((table) => table.target === "public.ai_jobs").rows[0];
    assert.equal(failed.output, null);
    assert.equal(failed.status, "failed");
    assert.deepEqual(failed.progress, { $type: "bigint", value: "37" });
    assert.equal(failed.error_code, "provider_failed");

    const completedSource = path.join(root, "completed.sqlite");
    createV18Fixture(completedSource);
    const completedDatabase = new Database(completedSource);
    completedDatabase.prepare("UPDATE ai_jobs SET status='completed' WHERE id='job_v18_failed'").run();
    completedDatabase.close();
    const completedExport = path.join(root, "completed-export");
    await snapshotSqlite({ source: completedSource, outputDirectory: completedExport });
    assert.throws(
      () => transformBundle({
        exportDirectory: completedExport,
        outputDirectory: path.join(root, "completed-bundle"),
        allowPartialSchema: true,
      }),
      /output_json contains JSON null for non-failed status completed/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("full transform deterministically restores only a truly missing scripts.user_id owner membership", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-owner-remediation-"));
  try {
    const source = path.join(root, "source.sqlite");
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    const inventoryPath = path.join(root, "s3-inventory.json");
    createV18Fixture(source);
    const database = new Database(source);
    database.prepare("DELETE FROM project_memberships WHERE project_id=?").run("scr_v18");
    database.close();
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    writeProductionS3Inventory(inventoryPath);
    const manifest = transformBundle({
      exportDirectory,
      outputDirectory: bundleDirectory,
      s3InventoryPath: inventoryPath,
    });
    const bundle = validateBundle(bundleDirectory);
    assert.deepEqual({
      ...manifest.projectOwnership.legacyOwnerRemediation,
      syntheticOwnerSha256: "<verified-separately>",
    }, {
      status: "verified",
      sourceActiveOwnerCount: 0,
      syntheticOwnerCount: 1,
      syntheticOwnerSha256: "<verified-separately>",
    });
    assert.match(manifest.projectOwnership.legacyOwnerRemediation.syntheticOwnerSha256, /^[0-9a-f]{64}$/);
    const membership = bundle.tables.find((table) => table.target === "public.project_memberships").rows[0];
    assert.match(membership.id, /^mem_legacy_owner_[0-9a-f]{24}$/);
    assert.equal(membership.project_id, "scr_v18");
    assert.equal(membership.user_id, "usr_v18");
    assert.equal(membership.invited_by_user_id, "usr_v18");
    assert.equal(membership.project_role, "owner");
    assert.equal(membership.status, "active");
    assert.equal(membership.module_permissions.shared_projects, "manage");
    assert.deepEqual(membership.financial_permissions, [
      "financial.view_all", "financial.edit_all", "financial.export", "financial.manage_access",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("owner remediation never overwrites an existing membership for scripts.user_id", () => {
  const script = {
    id: "scr_existing", user_id: "usr_existing",
    created_at: "2026-08-22T00:00:00.000Z", updated_at: "2026-08-22T01:00:00.000Z",
  };
  const existing = {
    id: "mem_existing", project_id: script.id, user_id: script.user_id,
    project_role: "viewer", status: "suspended",
  };
  assert.throws(
    () => remediateLegacyProjectOwners({ scripts: [script], memberships: [existing] }),
    /would overwrite an existing membership/,
  );
  const result = remediateLegacyProjectOwners({ scripts: [script], memberships: [], versionType: "bigint" });
  const memberships = result.syntheticRows;
  assert.deepEqual(validateProjectOwnershipGraph({ scripts: [script], memberships }), {
    projectCount: 1, activeOwnerCount: 1,
  });
  assert.deepEqual(validateProjectOwnershipRemediation({ scripts: [script], memberships, versionType: "bigint" }), result.summary);
});

test("transform preserves IDs, validates types, extracts BLOB storage, and builds insert-only SQL", async () => {
  await withFixture(async ({ root, source }) => {
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    const manifest = transformBundle({ exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true });
    const bundle = validateBundle(bundleDirectory);
    assert.equal(bundle.ok, true);
    assert.ok(manifest.skipped.some((entry) => entry.table === "sessions" && entry.rowCount === 1));

    const profiles = bundle.tables.find((table) => table.target === "public.profiles");
    assert.equal(profiles.rows[0].id, "usr_1");
    assert.equal(profiles.rows[0].email_verified, true);
    assert.deepEqual(profiles.rows[0].lumiere_preferences, { style: "reference" });
    const scripts = bundle.tables.find((table) => table.target === "public.scripts");
    assert.equal(scripts.rows[0].id, "scr_1");
    assert.deepEqual(scripts.rows[0].blocks, [{ type: "scene" }]);
    const notifications = bundle.tables.find((table) => table.target === "public.notifications");
    assert.equal(notifications.rows[0].metadata.module, "budget");
    assert.equal(notifications.rows[0].contains_financial_data, true);
    const receipts = bundle.tables.find((table) => table.target === "private.budget_receipts");
    assert.equal(receipts.rows[0].id, "rcp_1");
    assert.match(receipts.rows[0].media_object_id, /^med_[0-9a-f]{24}$/);
    assert.equal(Object.hasOwn(receipts.rows[0], "data_blob"), false);
    assert.equal(manifest.storage.entryCount, 1);

    const { sql } = buildImportSql(bundleDirectory);
    const guard = sql.indexOf("FilmScript import requires empty destination table public.profiles");
    const firstInsert = sql.indexOf('INSERT INTO "public"."profiles"');
    assert.ok(guard >= 0 && firstInsert > guard, "all destinations are checked empty inside the transaction before inserts");
    assert.match(sql, /INSERT INTO "public"\."profiles"/);
    assert.match(sql, /INSERT INTO "public"\."media_objects"/);
    assert.match(sql, /decode\('[A-Za-z0-9+/=]+'/);
    assert.doesNotMatch(sql, /INSERT INTO .*sessions/);
    assert.doesNotMatch(sql, /\bDELETE\b|\bUPDATE\b|ON CONFLICT/i);
  });
});

test("Postgres capture and reconciliation compare canonical rows and BLOB hashes", async () => {
  await withFixture(async ({ root, source }) => {
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    transformBundle({ exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true });
    const { bundle, sql } = buildCaptureSql(bundleDirectory);
    assert.match(sql, /BEGIN READ ONLY/);
    const capture = parseCaptureOutput(postgresOutputFromBundle(bundle), bundle);
    const result = reconcilePostgres({ bundleDirectory, captureManifest: capture });
    assert.equal(result.ok, true);
    assert.equal(result.creditNormalization.status, "verified");

    const captureFile = path.join(root, "postgres-capture.ndjson");
    fs.writeFileSync(captureFile, postgresOutputFromBundle(bundle));
    const streamedCapture = parseCaptureFile(captureFile, bundle);
    assert.equal(streamedCapture.databaseDataSha256, capture.databaseDataSha256);
    assert.deepEqual(streamedCapture.tables, capture.tables);

    capture.tables[0].databaseRowSha256 = "0".repeat(64);
    const mismatch = reconcilePostgres({ bundleDirectory, captureManifest: capture });
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.differences[0].issue, "row_checksum");
  });
});

test("Storage manifest is self-contained and checksum validated", async () => {
  await withFixture(async ({ root, source, receipt }) => {
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    const storageDirectory = path.join(root, "storage-manifest");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    transformBundle({ exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true });
    const manifest = createStorageManifest({ bundleDirectory, outputDirectory: storageDirectory });
    assert.equal(manifest.objectCount, 1);
    assert.equal(manifest.totalBytes, receipt.length);
    assert.equal(validateStorageManifest(storageDirectory).manifest.dataSha256, manifest.dataSha256);
    const sourceBytes = fs.readFileSync(resolveInside(storageDirectory, manifest.entries[0].source.path));
    const capture = await captureStorage({
      manifestDirectory: storageDirectory,
      baseUrl: "https://example.supabase.co",
      serviceRoleKey: "test-only",
      fetchImpl: async () => new Response(sourceBytes, { status: 200 }),
    });
    assert.equal(reconcileStorage({ manifestDirectory: storageDirectory, captureManifest: capture }).ok, true);
  });
});

test("Storage plan cannot be retargeted independently of media_objects", async () => {
  await withFixture(async ({ root, source }) => {
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    transformBundle({ exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true });
    const planPath = path.join(bundleDirectory, "storage-plan.json");
    const bundleManifestPath = path.join(bundleDirectory, "manifest.json");
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const bundleManifest = JSON.parse(fs.readFileSync(bundleManifestPath, "utf8"));
    plan.entries[0].target.path = "filmscript/tampered/receipt.pdf";
    plan.dataSha256 = sha256(stableStringify(plan.entries));
    plan.contractSha256 = storageContractDataSha256(plan.entries);
    bundleManifest.storage.dataSha256 = plan.dataSha256;
    bundleManifest.storage.contractSha256 = plan.contractSha256;
    fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    fs.writeFileSync(bundleManifestPath, `${JSON.stringify(bundleManifest, null, 2)}\n`);
    assert.throws(() => loadStoragePlan(bundleDirectory), /disagrees with public\.media_objects/);
  });
});

test("S3 inventory becomes authorized media rows and Storage copy entries", async () => {
  await withFixture(async ({ root, source, now }) => {
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    const storageDirectory = path.join(root, "storage-manifest");
    const inventoryPath = path.join(root, "s3-inventory.json");
    const database = new Database(source);
    database.prepare("INSERT INTO scripts VALUES (?, ?, ?, ?, ?, ?)").run(
      "scr_0replica", "usr_1", "Replicated library workspace", "[]", now, now,
    );
    database.prepare("INSERT INTO canvas_workspaces VALUES (?, ?, ?, ?)").run(
      "scr_0replica", "usr_1",
      JSON.stringify({ assets: [{
        id: "cas_replicated", key: "filmscript/canvas/scr_1/asset.jpg", source: "imagine",
      }] }),
      now,
    );
    database.close();
    const digest = "a".repeat(64);
    const entries = [
      {
        id: "s3:filmscript/canvas/scr_1/asset.jpg",
        source: { type: "s3", bucket: "legacy-media", key: "filmscript/canvas/scr_1/asset.jpg", bytes: 123, sha256: digest, etag: null },
        target: { bucket: "filmscript-private", path: "filmscript/canvas/scr_1/asset.jpg" },
        contentType: "image/jpeg",
        lastModified: "2026-08-22T01:02:03.000Z",
        metadata: {},
      },
      {
        id: "s3:filmscript/canvas/scr_1/unclassified.jpg",
        source: { type: "s3", bucket: "legacy-media", key: "filmscript/canvas/scr_1/unclassified.jpg", bytes: 41, sha256: "b".repeat(64), etag: null },
        target: { bucket: "filmscript-private", path: "filmscript/canvas/scr_1/unclassified.jpg" },
        contentType: "image/jpeg",
        lastModified: "2026-08-22T01:02:03.000Z",
        metadata: {},
      },
      {
        id: "s3:filmscript/canvas/profiles/avatar_usr_1.webp",
        source: { type: "s3", bucket: "legacy-media", key: "filmscript/canvas/profiles/avatar_usr_1.webp", bytes: 57, sha256: "c".repeat(64), etag: null },
        target: { bucket: "filmscript-private", path: "filmscript/canvas/profiles/avatar_usr_1.webp" },
        contentType: "image/webp",
        lastModified: "2026-08-22T01:02:03.000Z",
        metadata: {},
      },
      {
        id: "s3:filmscript/canvas/profiles/avatar_4cd220be9504b805.webp",
        source: { type: "s3", bucket: PRODUCTION_S3_BUCKET, key: "filmscript/canvas/profiles/avatar_4cd220be9504b805.webp", bytes: 29218, sha256: "44ed0e9bd1bd7a518f4db1523266a5d647cfc7d6dc3a5e6729dea29c7a75e10b", etag: null },
        target: { bucket: "filmscript-private", path: "filmscript/canvas/profiles/avatar_4cd220be9504b805.webp" },
        contentType: "image/webp",
        lastModified: "2026-08-22T01:02:03.000Z",
        metadata: {},
      },
      {
        id: "s3:filmscript/canvas/profiles/avatar_68db05ce1a0181a2.webp",
        source: { type: "s3", bucket: PRODUCTION_S3_BUCKET, key: "filmscript/canvas/profiles/avatar_68db05ce1a0181a2.webp", bytes: 29218, sha256: "44ed0e9bd1bd7a518f4db1523266a5d647cfc7d6dc3a5e6729dea29c7a75e10b", etag: null },
        target: { bucket: "filmscript-private", path: "filmscript/canvas/profiles/avatar_68db05ce1a0181a2.webp" },
        contentType: "image/webp",
        lastModified: "2026-08-22T01:02:03.000Z",
        metadata: {},
      },
      {
        id: "s3:filmscript/canvas/imaging_usr_1/personal.jpg",
        source: { type: "s3", bucket: "legacy-media", key: "filmscript/canvas/imaging_usr_1/personal.jpg", bytes: 63, sha256: "d".repeat(64), etag: null },
        target: { bucket: "filmscript-private", path: "filmscript/canvas/imaging_usr_1/personal.jpg" },
        contentType: "image/jpeg",
        lastModified: "2026-08-22T01:02:03.000Z",
        metadata: {},
      },
    ];
    fs.writeFileSync(inventoryPath, JSON.stringify({
      format: "filmscript-s3-inventory",
      formatVersion: 1,
      objectCount: entries.length,
      totalBytes: entries.reduce((sum, entry) => sum + entry.source.bytes, 0),
      dataSha256: sha256(stableStringify(entries.map((entry) => ({ key: entry.source.key, bytes: entry.source.bytes, sha256: entry.source.sha256 })))),
      entries,
    }));
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    const transformedManifest = transformBundle({
      exportDirectory,
      outputDirectory: bundleDirectory,
      s3InventoryPath: inventoryPath,
      allowPartialSchema: true,
    });
    assert.equal(transformedManifest.storage.classifiedAccessCount, 4);
    assert.equal(transformedManifest.storage.ownerOnlyUnclassifiedCount, 1);
    assert.equal(transformedManifest.storage.legacyOrphanStorage.count, 2);
    assert.equal(transformedManifest.storage.legacyOrphanStorage.totalBytes, 58436);
    assert.deepEqual(transformedManifest.storage.ownerOnlyCrossProjectLibrary, {
      count: 1, canvasCount: 0, imagineCount: 1,
    });
    const bundle = validateBundle(bundleDirectory);
    const media = bundle.tables.find((table) => table.target === "public.media_objects").rows;
    assert.equal(media.length, 5);
    const imagineAsset = media.find((row) => row.object_path.endsWith("/asset.jpg"));
    assert.equal(imagineAsset.project_id, null,
      "a library asset replicated across projects remains visible only to its owner");
    assert.equal(imagineAsset.owner_user_id, "usr_1");
    assert.equal(imagineAsset.kind, "imagine_asset");
    assert.equal(imagineAsset.metadata.access_module, "imagine");
    assert.deepEqual(imagineAsset.metadata.legacy_reference_project_ids, ["scr_0replica", "scr_1"],
      "all legacy project references remain provenance rather than authorization");
    assert.equal(imagineAsset.metadata.legacy_access_scope, "owner_only_cross_project_library");
    const unclassified = media.find((row) => row.object_path.endsWith("/unclassified.jpg"));
    assert.equal(Object.hasOwn(unclassified.metadata, "access_module"), false);
    const avatar = media.find((row) => row.kind === "profile_avatar");
    assert.equal(avatar.project_id, null);
    assert.equal(avatar.owner_user_id, "usr_1");
    assert.equal(avatar.metadata.access_module, "profile");
    const personalImagine = media.find((row) => row.kind === "imagine_asset");
    assert.equal(personalImagine.project_id, null);
    assert.equal(personalImagine.owner_user_id, "usr_1");
    assert.equal(personalImagine.metadata.access_module, "imagine");
    const quarantined = bundle.tables.find((table) => table.target === "private.legacy_orphan_storage").rows;
    assert.equal(quarantined.length, 2);
    assert.deepEqual(new Set(quarantined.map((row) => row.reason)), new Set(["unreferenced_byte_duplicate_avatar"]));
    assert.deepEqual(new Set(quarantined.map((row) => row.sha256)), new Set(["44ed0e9bd1bd7a518f4db1523266a5d647cfc7d6dc3a5e6729dea29c7a75e10b"]));
    assert.deepEqual(new Set(quarantined.map((row) => row.size_bytes)), new Set([29218]));
    assert.ok(quarantined.every((row) => row.target_path.startsWith(`migration-quarantine/${row.id}/`)));
    const manifest = createStorageManifest({ bundleDirectory, outputDirectory: storageDirectory });
    assert.equal(manifest.objectCount, 7);
    assert.equal(manifest.totalBytes, 123 + 41 + 57 + 29218 + 29218 + 63 + Buffer.byteLength("receipt-bytes\u0000with-binary"));
    assert.equal(validateStorageManifest(storageDirectory).manifest.objectCount, 7);
  });
});

test("cross-project owner library provenance preserves the real 21 Canvas / 8 Imagine shape", async () => {
  await withFixture(async ({ root, source, now }) => {
    const canvasAssets = Array.from({ length: 21 }, (_, index) => ({
      id: `cas_canvas_${index}`,
      key: `filmscript/canvas/scr_1/canvas-${index}.webp`,
      source: "upload",
    }));
    const imagineAssets = Array.from({ length: 8 }, (_, index) => ({
      id: `cas_imagine_${index}`,
      key: `filmscript/canvas/scr_1/imagine-${index}.webp`,
      source: "imagine",
    }));
    const assets = [...canvasAssets, ...imagineAssets];
    const database = new Database(source);
    database.prepare("UPDATE canvas_workspaces SET data_json = ? WHERE script_id = 'scr_1'")
      .run(JSON.stringify({ assets }));
    database.prepare("UPDATE canvas_libraries SET data_json = ? WHERE user_id = 'usr_1'")
      .run(JSON.stringify({ assets: [...assets].reverse() }));
    database.prepare("INSERT INTO scripts VALUES (?, ?, ?, ?, ?, ?)")
      .run("scr_replica", "usr_1", "Replica", "[]", now, now);
    database.prepare("INSERT INTO canvas_workspaces VALUES (?, ?, ?, ?)")
      .run("scr_replica", "usr_1", JSON.stringify({ assets: [...assets].reverse() }), now);
    database.close();

    const entries = assets.map((asset, index) => ({
      id: `s3:${asset.key}`,
      source: {
        type: "s3", bucket: "legacy-media", key: asset.key,
        bytes: index + 1, sha256: sha256(`asset-${index}`), etag: null,
      },
      target: { bucket: "filmscript-private", path: asset.key },
      contentType: "image/webp",
      lastModified: now,
      metadata: {},
    }));
    const inventoryPath = path.join(root, "s3-inventory.json");
    fs.writeFileSync(inventoryPath, JSON.stringify({
      format: "filmscript-s3-inventory",
      formatVersion: 1,
      objectCount: entries.length,
      totalBytes: entries.reduce((sum, entry) => sum + entry.source.bytes, 0),
      dataSha256: sha256(stableStringify(entries.map((entry) => ({
        key: entry.source.key, bytes: entry.source.bytes, sha256: entry.source.sha256,
      })))),
      entries,
    }));
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    const manifest = transformBundle({
      exportDirectory, outputDirectory: bundleDirectory,
      s3InventoryPath: inventoryPath, allowPartialSchema: true,
    });
    assert.deepEqual(manifest.storage.ownerOnlyCrossProjectLibrary, {
      count: 29, canvasCount: 21, imagineCount: 8,
    });
    const rows = validateBundle(bundleDirectory).tables
      .find((table) => table.target === "public.media_objects").rows
      .filter((row) => row.metadata.legacy_access_scope === "owner_only_cross_project_library");
    assert.equal(rows.length, 29);
    assert.ok(rows.every((row) => row.project_id === null && row.owner_user_id === "usr_1"));
    assert.equal(rows.filter((row) => row.kind === "canvas_asset").length, 21);
    assert.equal(rows.filter((row) => row.kind === "imagine_asset").length, 8);
  });
});

test("an unreferenced profile avatar without a byte-identical orphan duplicate fails closed", async () => {
  await withFixture(async ({ root, source }) => {
    const exportDirectory = path.join(root, "export");
    const inventoryPath = path.join(root, "s3-inventory.json");
    const entry = {
      id: "s3:filmscript/canvas/profiles/avatar_unmatched.webp",
      source: {
        type: "s3", bucket: "legacy-media",
        key: "filmscript/canvas/profiles/avatar_unmatched.webp",
        bytes: 11, sha256: "f".repeat(64), etag: null,
      },
      target: { bucket: "filmscript-private", path: "filmscript/canvas/profiles/avatar_unmatched.webp" },
      contentType: "image/webp",
      lastModified: "2026-08-22T01:02:03.000Z",
      metadata: {},
    };
    fs.writeFileSync(inventoryPath, JSON.stringify({
      format: "filmscript-s3-inventory",
      formatVersion: 1,
      objectCount: 1,
      totalBytes: 11,
      dataSha256: sha256(stableStringify([{ key: entry.source.key, bytes: 11, sha256: entry.source.sha256 }])),
      entries: [entry],
    }));
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    assert.throws(() => transformBundle({
      exportDirectory,
      outputDirectory: path.join(root, "bundle"),
      s3InventoryPath: inventoryPath,
      allowPartialSchema: true,
    }), /has no byte-identical orphan duplicate approved for quarantine/);
  });
});

test("missing-project Storage quarantine is isolated and refuses a partial or referenced prefix", () => {
  const key = "filmscript/canvas/scr_c38477536398e2486704/example.webp";
  const { row, storage } = buildMissingProjectPrefixQuarantine({
    entry: {
      id: `s3:${key}`,
      source: {
        type: "s3", bucket: PRODUCTION_S3_BUCKET, key,
        bytes: 17, sha256: "e".repeat(64), etag: null,
      },
      target: { bucket: "filmscript-private", path: key },
      contentType: "image/webp",
      lastModified: "2026-07-29T18:24:41.000Z",
      metadata: {},
    },
    targetBucket: "filmscript-private",
    importedAt: "2026-08-22T12:34:56.000Z",
  });
  assert.equal(row.reason, "unreferenced_missing_project_prefix");
  assert.equal(row.duplicate_of_source_key, null);
  assert.equal(row.source_key, key);
  assert.match(row.target_path, /^migration-quarantine\/los_[0-9a-f]{24}\/example\.webp$/);
  assert.equal(storage.target.path, row.target_path);
  assert.throws(
    () => validateLegacyOrphanStorageRows([row]),
    /does not match the exact reviewed missing-project prefixes contract/,
  );
  assert.throws(
    () => validateLegacyOrphanStorageGraph([row], [{
      target: "public.canvas_libraries",
      rows: [{ user_id: "usr_fixture", data: { assets: [{ key }] } }],
    }]),
    /is referenced by public\.canvas_libraries/,
  );
});

test("conflicting Canvas and Imagine metadata for one object fails closed", async () => {
  await withFixture(async ({ root, source }) => {
    const database = new Database(source);
    database.prepare("UPDATE canvas_libraries SET data_json = ? WHERE user_id = ?").run(
      JSON.stringify({ assets: [{ id: "cas_1", key: "filmscript/canvas/scr_1/asset.jpg", source: "upload" }] }),
      "usr_1",
    );
    database.close();
    const exportDirectory = path.join(root, "export");
    const inventoryPath = path.join(root, "s3-inventory.json");
    const entries = [{
      id: "s3:filmscript/canvas/scr_1/asset.jpg",
      source: {
        type: "s3", bucket: "legacy-media", key: "filmscript/canvas/scr_1/asset.jpg",
        bytes: 123, sha256: "a".repeat(64), etag: null,
      },
      target: { bucket: "filmscript-private", path: "filmscript/canvas/scr_1/asset.jpg" },
      contentType: "image/jpeg",
      lastModified: "2026-08-22T01:02:03.000Z",
      metadata: {},
    }];
    fs.writeFileSync(inventoryPath, JSON.stringify({
      format: "filmscript-s3-inventory",
      formatVersion: 1,
      objectCount: entries.length,
      totalBytes: 123,
      dataSha256: sha256(stableStringify(entries.map((entry) => ({
        key: entry.source.key, bytes: entry.source.bytes, sha256: entry.source.sha256,
      })))),
      entries,
    }));
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    assert.throws(
      () => transformBundle({
        exportDirectory,
        outputDirectory: path.join(root, "bundle"),
        s3InventoryPath: inventoryPath,
        allowPartialSchema: true,
      }),
      /ambiguous Canvas\/Imagine ownership or module metadata/,
    );
  });
});

test("Canvas references with different owners fail closed even when the path project is known", async () => {
  await withFixture(async ({ root, source, now }) => {
    const database = new Database(source);
    database.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      "usr_other", "other@example.test", "{}", 1, null, null, now, now,
    );
    database.prepare("INSERT INTO scripts VALUES (?, ?, ?, ?, ?, ?)").run(
      "scr_0other", "usr_other", "Other owner", "[]", now, now,
    );
    database.prepare("INSERT INTO canvas_workspaces VALUES (?, ?, ?, ?)").run(
      "scr_0other", "usr_other",
      JSON.stringify({ assets: [{ id: "cas_other", key: "filmscript/canvas/scr_1/asset.jpg", source: "imagine" }] }),
      now,
    );
    database.close();
    const exportDirectory = path.join(root, "export");
    const inventoryPath = path.join(root, "s3-inventory.json");
    const entries = [{
      id: "s3:filmscript/canvas/scr_1/asset.jpg",
      source: {
        type: "s3", bucket: "legacy-media", key: "filmscript/canvas/scr_1/asset.jpg",
        bytes: 123, sha256: "a".repeat(64), etag: null,
      },
      target: { bucket: "filmscript-private", path: "filmscript/canvas/scr_1/asset.jpg" },
      contentType: "image/jpeg",
      lastModified: now,
      metadata: {},
    }];
    fs.writeFileSync(inventoryPath, JSON.stringify({
      format: "filmscript-s3-inventory",
      formatVersion: 1,
      objectCount: 1,
      totalBytes: 123,
      dataSha256: sha256(stableStringify(entries.map((entry) => ({
        key: entry.source.key, bytes: entry.source.bytes, sha256: entry.source.sha256,
      })) )),
      entries,
    }));
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    assert.throws(() => transformBundle({
      exportDirectory,
      outputDirectory: path.join(root, "bundle"),
      s3InventoryPath: inventoryPath,
      allowPartialSchema: true,
    }), /ambiguous Canvas\/Imagine ownership or module metadata/);
  });
});

test("production bundle refuses owner-only unclassified Canvas objects", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-unclassified-storage-"));
  try {
    const source = path.join(root, "source.sqlite");
    const exportDirectory = path.join(root, "export");
    const inventoryPath = path.join(root, "s3-inventory.json");
    createV18Fixture(source);
    const entries = [{
      id: "s3:filmscript/canvas/scr_v18/unclassified.jpg",
      source: {
        type: "s3", bucket: PRODUCTION_S3_BUCKET, key: "filmscript/canvas/scr_v18/unclassified.jpg",
        bytes: 41, sha256: "b".repeat(64), etag: null,
      },
      target: { bucket: "filmscript-private", path: "filmscript/canvas/scr_v18/unclassified.jpg" },
      contentType: "image/jpeg",
      lastModified: "2026-08-22T01:02:03.000Z",
      metadata: {},
    }];
    fs.writeFileSync(inventoryPath, JSON.stringify({
      format: "filmscript-s3-inventory",
      formatVersion: 1,
      bucket: PRODUCTION_S3_BUCKET,
      prefix: "",
      objectCount: 1,
      totalBytes: 41,
      dataSha256: sha256(stableStringify(entries.map((entry) => ({
        key: entry.source.key, bytes: entry.source.bytes, sha256: entry.source.sha256,
      })))),
      entries,
    }));
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    assert.throws(
      () => transformBundle({
        exportDirectory,
        outputDirectory: path.join(root, "bundle"),
        s3InventoryPath: inventoryPath,
      }),
      /Storage classification requires remediation/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("an empty budget_receipts table uses the Storage-backed target shape without data_blob", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-empty-budget-receipts-"));
  try {
    const source = path.join(root, "source.sqlite");
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    const inventoryPath = path.join(root, "s3-inventory.json");
    createV18Fixture(source);
    const database = new Database(source);
    database.prepare("DELETE FROM budget_receipts").run();
    database.close();
    writeProductionS3Inventory(inventoryPath);
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    transformBundle({ exportDirectory, outputDirectory: bundleDirectory, s3InventoryPath: inventoryPath });
    const receipts = validateBundle(bundleDirectory).tables.find(
      (table) => table.target === "private.budget_receipts",
    );
    assert.equal(receipts.rowCount, 0);
    assert.equal(receipts.columns.includes("data_blob"), false);
    assert.equal(receipts.columns.includes("media_object_id"), true);
    assert.equal(receipts.columns.includes("legacy_blob_sha256"), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("legacy activity timestamps use only the reviewed created_at inference with an exact contract", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-activity-timestamps-"));
  try {
    const source = path.join(root, "source.sqlite");
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    createV18Fixture(source);
    const database = new Database(source);
    const createdAt = "2026-08-22T12:34:56.000Z";
    const insert = database.prepare(`
      INSERT INTO activity_events
        (id, project_id, module, actor_user_id, actor_type, entity_type, entity_id,
         action, summary, before_json, after_json, contains_financial_data,
         financial_department_id, created_at, aggregation_key, aggregation_count,
         metadata_json, updated_at)
      VALUES (?, 'scr_v18', 'script', 'usr_v18', 'user', 'script', 'scr_v18',
              'updated', 'Legacy event', NULL, NULL, 0, NULL, ?, NULL, 1, '{}', ?)
    `);
    for (let index = 0; index < 16; index += 1) {
      insert.run(`act_null_${String(index).padStart(2, "0")}`, createdAt, null);
    }
    insert.run("act_existing", createdAt, "2026-08-22T13:00:00.000Z");
    database.close();

    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    const manifest = transformBundle({
      exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true,
    });
    assert.equal(manifest.activityTimestampRemediation.status, "verified");
    assert.equal(manifest.activityTimestampRemediation.inferredUpdatedAtCount, 16);
    assert.match(manifest.activityTimestampRemediation.inferredUpdatedAtSha256, /^[0-9a-f]{64}$/);

    const bundle = validateBundle(bundleDirectory);
    const rows = bundle.tables.find((table) => table.target === "public.activity_events").rows;
    const inferred = rows.filter(
      (row) => row.metadata?.[LEGACY_ACTIVITY_UPDATED_AT_MARKER] === true,
    );
    assert.equal(inferred.length, 16);
    assert.ok(inferred.every((row) => row.updated_at === row.created_at));
    const existing = rows.find((row) => row.id === "act_existing");
    assert.equal(existing.updated_at, "2026-08-22T13:00:00.000Z");
    assert.equal(Object.hasOwn(existing.metadata, LEGACY_ACTIVITY_UPDATED_AT_MARKER), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("legacy collaboration parent remediation fails closed when a document scope has multiple modules", async () => {
  await withFixture(async ({ root, source, now }) => {
    const database = new Database(source);
    database.prepare("INSERT INTO collaboration_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "op_orphan_budget", "scr_1", "missing_doc", "budget", "line_item", "item_1", "usr_1",
      0, 1, "patch", '{"amount":88888}', "{}", now,
    );
    database.prepare("INSERT INTO collaboration_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "op_orphan_breakdown", "scr_1", "missing_doc", "breakdown", "element", "item_2", "usr_1",
      0, 1, "patch", '{"label":"Car"}', "{}", now,
    );
    database.close();
    const exportDirectory = path.join(root, "export");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    assert.throws(
      () => transformBundle({
        exportDirectory,
        outputDirectory: path.join(root, "bundle"),
        allowPartialSchema: true,
      }),
      /Legacy collaboration parent remediation is ambiguous.*missing_doc.*breakdown,budget/,
    );
  });
});

test("a unique legacy child scope gets a provenance-marked empty collaboration FK anchor", async () => {
  await withFixture(async ({ root, source, now }) => {
    const database = new Database(source);
    database.prepare("INSERT INTO collaboration_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "op_orphan", "scr_1", "breakdown:scr_1:metadata", "breakdown", "metadata", "scene_1", "usr_1",
      0, 1, "patch", '{"label":"Car"}', "{}", now,
    );
    database.close();
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    const manifest = transformBundle({ exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true });
    const bundle = validateBundle(bundleDirectory);
    assert.equal(manifest.collaborationRemediation.status, "verified");
    assert.equal(manifest.collaborationRemediation.sourceDocumentCount, 1);
    assert.equal(manifest.collaborationRemediation.childEntityCount, 0);
    assert.equal(manifest.collaborationRemediation.childOperationCount, 1);
    assert.equal(manifest.collaborationRemediation.conflictCount, 0);
    assert.equal(manifest.collaborationRemediation.syntheticParentCount, 1);
    assert.deepEqual(manifest.collaborationRemediation.moduleCounts, { breakdown: 1 });
    assert.match(manifest.collaborationRemediation.syntheticParentSha256, /^[0-9a-f]{64}$/);
    assert.deepEqual({
      ...manifest.collaborationRemediation.orphanProjectQuarantine,
      rowSha256: "<verified-separately>",
    }, {
      status: "none",
      reason: "legacy_collaboration_project_missing_from_scripts",
      projectCount: 0,
      documentCount: 0,
      entityCount: 0,
      operationCount: 0,
      conflictCount: 0,
      rowCount: 0,
      rowSha256: "<verified-separately>",
    });
    assert.match(manifest.collaborationRemediation.orphanProjectQuarantine.rowSha256, /^[0-9a-f]{64}$/);
    const documents = bundle.tables.find((table) => table.target === "public.collaboration_documents").rows;
    const sourceDocument = documents.find((row) => row.document_id === "doc_1");
    const anchor = documents.find((row) => row.document_id === "breakdown:scr_1:metadata");
    assert.equal(sourceDocument.legacy_synthetic_parent, false);
    assert.equal(anchor.legacy_synthetic_parent, true);
    assert.equal(anchor.module, "breakdown");
    assert.equal(anchor.snapshot.bytes, 0);
    assert.equal(anchor.snapshot.sha256, sha256(Buffer.alloc(0)));
    assert.equal(fs.readFileSync(path.join(bundleDirectory, anchor.snapshot.path)).length, 0);
    assert.deepEqual(anchor.version, { $type: "bigint", value: "0" });
    assert.equal(anchor.updated_at, now);
  });
});

test("legacy collaboration rows for deleted projects are quarantined with exact private evidence", async () => {
  await withFixture(async ({ root, source, now }) => {
    const database = new Database(source);
    database.prepare("INSERT INTO collaboration_documents VALUES (?, ?, ?, ?, ?, ?)")
      .run("scr_deleted", "script:scr_deleted", "script", Buffer.from("deleted-private-snapshot"), 2, now);
    database.prepare("INSERT INTO collaboration_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "op_deleted", "scr_deleted", "breakdown:scr_deleted:cells", "breakdown", "cell", "cell_1", "usr_1",
      0, 1, "patch", '{"private":"deleted project"}', "{}", now,
    );
    database.close();
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    const manifest = transformBundle({ exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true });
    const bundle = validateBundle(bundleDirectory);
    assert.deepEqual({
      ...manifest.collaborationRemediation.orphanProjectQuarantine,
      rowSha256: "<verified-separately>",
    }, {
      status: "quarantined",
      reason: "legacy_collaboration_project_missing_from_scripts",
      projectCount: 1,
      documentCount: 1,
      entityCount: 0,
      operationCount: 1,
      conflictCount: 0,
      rowCount: 2,
      rowSha256: "<verified-separately>",
    });
    assert.match(manifest.collaborationRemediation.orphanProjectQuarantine.rowSha256, /^[0-9a-f]{64}$/);
    const documents = bundle.tables.find((table) => table.target === "public.collaboration_documents").rows;
    const operations = bundle.tables.find((table) => table.target === "public.collaboration_operations").rows;
    const quarantine = bundle.tables.find((table) => table.target === "private.legacy_orphan_records").rows;
    assert.equal(documents.some((row) => row.project_id === "scr_deleted"), false);
    assert.equal(operations.some((row) => row.project_id === "scr_deleted"), false);
    assert.equal(quarantine.length, 2);
    const documentEvidence = quarantine.find((row) => row.source_table === "collaboration_documents");
    assert.equal(documentEvidence.source_project_id, "scr_deleted");
    assert.equal(documentEvidence.payload.document_id, "script:scr_deleted");
    assert.equal(documentEvidence.payload.snapshot_blob.sha256, documentEvidence.blob_sha256);
    assert.equal(documentEvidence.blob_payload.sha256, documentEvidence.blob_sha256);
    assert.deepEqual(fs.readFileSync(path.join(bundleDirectory, documentEvidence.blob_payload.path)), Buffer.from("deleted-private-snapshot"));
    const { sql } = buildImportSql(bundleDirectory, { rollback: true });
    assert.match(sql, /INSERT INTO "private"\."legacy_orphan_records"/);
    assert.equal(manifest.collaborationRemediation.syntheticParentCount, 0);
  });
});

test("invalid legacy JSON fails transformation with table and column context", async () => {
  await withFixture(async ({ root, source }) => {
    const exportDirectory = path.join(root, "export");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    assert.throws(
      () => transformBundle({ exportDirectory, outputDirectory: path.join(root, "bundle"), allowPartialSchema: true }),
      /app_settings\.value_json contains invalid JSON/,
    );
  }, { invalidJson: true });
});

test("production operations require exact explicit confirmation", () => {
  assert.throws(() => requireProductionConfirmation({ environment: "production" }, "test"), /Refusing production test/);
  assert.equal(requireProductionConfirmation({ environment: "production", confirm: "production" }, "test"), "production");
  assert.throws(() => requireProductionConfirmation({ environment: "staging", confirm: "yes" }, "test"), /only accepted confirmation/);
  assert.throws(() => requireProductionConfirmation({ environment: "prod" }, "test"), /Unknown migration environment/);
  assert.throws(() => requireProductionConfirmation({ environment: "foo", confirm: "production" }, "test"), /Unknown migration environment/);
  assert.equal(assertSupabaseProjectRef("https://nkuyfryxookojkvductn.supabase.co", "nkuyfryxookojkvductn").hostname, "nkuyfryxookojkvductn.supabase.co");
  assert.equal(assertSupabaseProjectRef("postgresql://postgres@db.nkuyfryxookojkvductn.supabase.co/postgres", "nkuyfryxookojkvductn").hostname, "db.nkuyfryxookojkvductn.supabase.co");
  assert.equal(assertSupabaseProjectRef("postgresql://postgres.nkuyfryxookojkvductn@aws-0-us-east-2.pooler.supabase.com/postgres", "nkuyfryxookojkvductn").hostname, "aws-0-us-east-2.pooler.supabase.com");
  assert.throws(() => assertSupabaseProjectRef("https://nkuyfryxookojkvductn.attacker.example", "nkuyfryxookojkvductn"), /official Supabase host/);
  assert.throws(() => assertSupabaseProjectRef("postgresql://postgres.nkuyfryxookojkvductn@example.com/postgres", "nkuyfryxookojkvductn"), /official Supabase host/);
  assert.throws(() => assertSupabaseProjectRef("postgresql://postgres.nkuyfryxookojkvductn@aws-0-us-east-2.pooler.supabase.com.attacker.example/postgres", "nkuyfryxookojkvductn"), /official Supabase host/);
  assert.throws(() => assertSupabaseProjectRef("postgresql://postgres.other@aws-0-us-east-2.pooler.supabase.com/postgres", "nkuyfryxookojkvductn"), /official Supabase host/);
  assert.throws(() => assertSupabaseProjectRef("postgresql://postgres.other@db.nkuyfryxookojkvductn.supabase.co/postgres", "nkuyfryxookojkvductn"), /official Supabase host/);
  assert.equal(validateSupabaseServiceUrl("http://127.0.0.1:54321").hostname, "127.0.0.1");
  assert.throws(() => validateSupabaseServiceUrl("http://example.com"), /must use HTTPS/);
});

test("psql resolver honors PSQL_BIN before PATH without requiring a global link", async () => {
  await withFixture(async ({ root }) => {
    const executable = path.join(root, "psql");
    fs.writeFileSync(executable, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
    assert.equal(resolvePsqlBin({ PSQL_BIN: executable, PATH: "" }), executable);
  });
});

test("generated inserts satisfy the local Supabase schema inside a rolled-back transaction", {
  skip: !process.env.FILMSCRIPT_TEST_POSTGRES_URL,
}, async () => {
  await withFixture(async ({ root, source, now }) => {
    const database = new Database(source);
    database.prepare("INSERT INTO collaboration_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "op_pg_orphan", "scr_1", "canvas:scr_1", "canvas", "node", "node_1", "usr_1",
      0, 1, "patch", '{"x":10}', "{}", now,
    );
    database.prepare("INSERT INTO collaboration_documents VALUES (?, ?, ?, ?, ?, ?)")
      .run("scr_pg_deleted", "script:scr_pg_deleted", "script", Buffer.from("pg-quarantine"), 1, now);
    database.close();
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    await snapshotSqlite({ source, outputDirectory: exportDirectory });
    transformBundle({ exportDirectory, outputDirectory: bundleDirectory, allowPartialSchema: true });
    const { sql } = buildImportSql(bundleDirectory, { rollback: true });
    const connection = postgresEnvironmentFromUrl(process.env.FILMSCRIPT_TEST_POSTGRES_URL);
    const result = spawnSync(resolvePsqlBin(), ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1"], {
      env: connection.environment,
      input: sql,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /FILMSCRIPT_IMPORT_OK/);
  });
});

test("schema v18 mapping covers every migratable source column and every required target column", {
  skip: !process.env.FILMSCRIPT_TEST_POSTGRES_URL,
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-v18-audit-"));
  try {
    const source = path.join(root, "v18.sqlite");
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    const inventoryPath = path.join(root, "s3-inventory.json");
    createV18Fixture(source);
    const sourceManifest = await snapshotSqlite({ source, outputDirectory: exportDirectory });
    assert.equal(sourceManifest.schemaVersion, "18");
    assert.equal(sourceManifest.tables.length, 33);
    writeProductionS3Inventory(inventoryPath);
    transformBundle({ exportDirectory, outputDirectory: bundleDirectory, s3InventoryPath: inventoryPath });
    const capture = captureTargetColumns(bundleDirectory, process.env.FILMSCRIPT_TEST_POSTGRES_URL);
    const audit = auditMapping({ exportDirectory, bundleDirectory, targetColumns: capture.columns });
    assert.equal(audit.ok, true, JSON.stringify(audit.issues, null, 2));
    assert.equal(audit.sourceTableCount, 33);
    assert.deepEqual(audit.skipped.map((entry) => entry.table).sort(), ["auth_handoffs", "oauth_states", "schema_meta", "sessions"]);
    assert.deepEqual(audit.specials, [{
      sourceTable: "budget_receipts",
      sourceColumn: "data_blob",
      destination: "Supabase Storage + public.media_objects + private.budget_receipts.legacy_blob_sha256",
    }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
