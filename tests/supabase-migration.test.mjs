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
      project_id TEXT NOT NULL REFERENCES scripts(id), document_id TEXT NOT NULL,
      module TEXT NOT NULL, snapshot_blob BLOB NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(project_id, document_id)
    );
    CREATE TABLE collaboration_operations (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES scripts(id), document_id TEXT NOT NULL,
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
    .run("scr_1", "doc_1", "editor", Buffer.from([0, 1, 2, 255]), 7, now);
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
  await withFixture(async ({ root, source }) => {
    const exportDirectory = path.join(root, "export");
    const bundleDirectory = path.join(root, "bundle");
    const storageDirectory = path.join(root, "storage-manifest");
    const inventoryPath = path.join(root, "s3-inventory.json");
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
    const bundle = validateBundle(bundleDirectory);
    const media = bundle.tables.find((table) => table.target === "public.media_objects").rows;
    assert.equal(media.length, 5);
    const imagineAsset = media.find((row) => row.object_path.endsWith("/asset.jpg"));
    assert.equal(imagineAsset.project_id, "scr_1");
    assert.equal(imagineAsset.owner_user_id, "usr_1");
    assert.equal(imagineAsset.kind, "canvas_asset");
    assert.equal(imagineAsset.metadata.access_module, "imagine");
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
    const manifest = createStorageManifest({ bundleDirectory, outputDirectory: storageDirectory });
    assert.equal(manifest.objectCount, 5);
    assert.equal(manifest.totalBytes, 123 + 41 + 57 + 63 + Buffer.byteLength("receipt-bytes\u0000with-binary"));
    assert.equal(validateStorageManifest(storageDirectory).manifest.objectCount, 5);
  });
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

test("legacy collaboration rows without an authoritative document fail before import", async () => {
  await withFixture(async ({ root, source, now }) => {
    const database = new Database(source);
    database.prepare("INSERT INTO collaboration_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "op_orphan", "scr_1", "missing_doc", "budget", "line_item", "item_1", "usr_1",
      0, 1, "patch", '{"amount":88888}', "{}", now,
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
      /Legacy collaboration graph needs explicit remediation.*has no collaboration_document/,
    );
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
  await withFixture(async ({ root, source }) => {
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
