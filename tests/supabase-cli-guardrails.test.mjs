import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertCaptureTarget,
  assertLocalEndpoint,
  requireProductionConfirmation,
  sha256,
  sha256File,
  stableStringify,
  storageContractDataSha256,
} from "../scripts/supabase-migration/lib/common.mjs";
import { assertBundleMapping } from "../scripts/supabase-migration/audit-mapping.mjs";
import { assertFullBundleForApply, buildImportSql, safePsqlImportFailure } from "../scripts/supabase-migration/import-postgres.mjs";
import { parseCaptureOutput } from "../scripts/supabase-migration/capture-postgres-manifest.mjs";
import { reconcilePostgres } from "../scripts/supabase-migration/reconcile.mjs";
import { captureStorage } from "../scripts/supabase-migration/capture-storage-manifest.mjs";
import { reconcileStorage } from "../scripts/supabase-migration/reconcile-storage.mjs";
import { assertFullStorageManifestForRemoteApply } from "../scripts/supabase-migration/copy-storage.mjs";

const PRODUCTION_REF = "nkuyfryxookojkvductn";
const STAGING_REF = "aaaaaaaaaaaaaaaaaaaa";

function temporaryRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-cli-guards-"));
}

function writeEmptyBundle(root) {
  const bundleDirectory = path.join(root, "bundle");
  fs.mkdirSync(bundleDirectory);
  const emptyDigest = sha256(stableStringify([]));
  fs.writeFileSync(path.join(bundleDirectory, "manifest.json"), `${JSON.stringify({
    format: "filmscript-postgres-bundle",
    formatVersion: 1,
    validationMode: "partial",
    projectOwnership: { status: "not_enforced_partial_schema" },
    source: { dataSha256: "b".repeat(64) },
    dataSha256: emptyDigest,
    databaseDataSha256: emptyDigest,
    tables: [],
  }, null, 2)}\n`);
  return { bundleDirectory, emptyDigest };
}

function writeEmptyStorageManifest(root) {
  const manifestDirectory = path.join(root, "storage");
  fs.mkdirSync(manifestDirectory);
  const entries = [];
  const contractSha256 = storageContractDataSha256(entries);
  fs.writeFileSync(path.join(manifestDirectory, "manifest.json"), `${JSON.stringify({
    format: "filmscript-storage-manifest",
    formatVersion: 1,
    sourceBundleValidationMode: "partial",
    sourceS3Inventory: null,
    objectCount: 0,
    totalBytes: 0,
    dataSha256: sha256(stableStringify(entries)),
    contractSha256,
    sourceStorageContractSha256: contractSha256,
    entries,
  }, null, 2)}\n`);
  return manifestDirectory;
}

test("local migration endpoints are restricted to exact loopback hosts", () => {
  assert.equal(assertLocalEndpoint("postgresql://postgres@127.0.0.1:54322/postgres").hostname, "127.0.0.1");
  assert.equal(assertLocalEndpoint("http://localhost:54321").hostname, "localhost");
  assert.equal(assertLocalEndpoint("http://[::1]:54321").hostname, "[::1]");
  assert.throws(() => assertLocalEndpoint(`https://${PRODUCTION_REF}.supabase.co`), /non-loopback endpoint/);
  assert.throws(() => assertLocalEndpoint("http://localhost.attacker.example"), /non-loopback endpoint/);
  assert.throws(() => assertCaptureTarget({
    host: `${PRODUCTION_REF}.supabase.co.attacker.example`,
    projectRef: PRODUCTION_REF,
    environment: "production",
  }), /official Supabase host/);
});

test("the FilmScript production project cannot be mislabeled as preview or staging", () => {
  assert.throws(
    () => requireProductionConfirmation({ environment: "staging", "project-ref": PRODUCTION_REF }, "test"),
    /Refusing to label the FilmScript production project as staging/,
  );
  assert.throws(
    () => requireProductionConfirmation({ environment: "preview", "project-ref": PRODUCTION_REF, confirm: "production" }, "test"),
    /Refusing to label the FilmScript production project as preview/,
  );
  assert.equal(
    requireProductionConfirmation({ environment: "production", "project-ref": PRODUCTION_REF, confirm: "production" }, "test"),
    "production",
  );
});

test("all mutating or evidence-capture CLIs reject remote endpoints labeled local", () => {
  const root = temporaryRoot();
  try {
    const { bundleDirectory } = writeEmptyBundle(root);
    const manifestDirectory = writeEmptyStorageManifest(root);
    const databaseUrl = `postgresql://postgres:private-row@example.com/postgres`;
    const serviceUrl = `https://${PRODUCTION_REF}.supabase.co`;
    const baseEnvironment = {
      ...process.env,
      FILMSCRIPT_GUARD_DB_URL: databaseUrl,
      FILMSCRIPT_GUARD_URL: serviceUrl,
      FILMSCRIPT_GUARD_KEY: "service-role-private-value",
    };
    const commands = [
      ["scripts/supabase-migration/import-postgres.mjs", "--bundle", bundleDirectory, "--apply", "--environment", "local", "--database-url-env", "FILMSCRIPT_GUARD_DB_URL"],
      ["scripts/supabase-migration/capture-postgres-manifest.mjs", "--bundle", bundleDirectory, "--environment", "local", "--database-url-env", "FILMSCRIPT_GUARD_DB_URL", "--output", path.join(root, "postgres-capture.json")],
      ["scripts/supabase-migration/audit-mapping.mjs", "--bundle", bundleDirectory, "--environment", "local", "--database-url-env", "FILMSCRIPT_GUARD_DB_URL", "--export", path.join(root, "unused-export")],
      ["scripts/supabase-migration/copy-storage.mjs", "--manifest", manifestDirectory, "--apply", "--environment", "local", "--supabase-url-env", "FILMSCRIPT_GUARD_URL", "--service-role-key-env", "FILMSCRIPT_GUARD_KEY"],
      ["scripts/supabase-migration/capture-storage-manifest.mjs", "--manifest", manifestDirectory, "--environment", "local", "--supabase-url-env", "FILMSCRIPT_GUARD_URL", "--service-role-key-env", "FILMSCRIPT_GUARD_KEY", "--output", path.join(root, "storage-capture.json")],
    ];
    for (const command of commands) {
      const result = spawnSync(process.execPath, command, { cwd: path.resolve("."), env: baseEnvironment, encoding: "utf8" });
      assert.equal(result.status, 1, `${command[0]} unexpectedly succeeded: ${result.stdout}`);
      assert.match(result.stderr, /non-loopback endpoint/);
      assert.doesNotMatch(result.stderr, /private-row|service-role-private-value/);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Postgres and Storage captures persist validated destination provenance", async () => {
  const root = temporaryRoot();
  try {
    const { bundleDirectory } = writeEmptyBundle(root);
    const bundle = buildImportSql(bundleDirectory).bundle;
    const postgresCapture = parseCaptureOutput("", bundle, {
      host: `${STAGING_REF}.supabase.co`,
      projectRef: STAGING_REF,
      environment: "staging",
    });
    assert.deepEqual(postgresCapture.target, {
      host: `${STAGING_REF}.supabase.co`,
      projectRef: STAGING_REF,
      environment: "staging",
    });

    const manifestDirectory = writeEmptyStorageManifest(root);
    const storageCapture = await captureStorage({
      manifestDirectory,
      baseUrl: `https://${STAGING_REF}.supabase.co`,
      serviceRoleKey: "not-contacted-for-empty-manifest",
      environment: "staging",
      projectRef: STAGING_REF,
    });
    assert.deepEqual(storageCapture.target, {
      host: `${STAGING_REF}.supabase.co`,
      projectRef: STAGING_REF,
      environment: "staging",
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Postgres capture streams psql output to a private file", {
  skip: !process.env.FILMSCRIPT_TEST_POSTGRES_URL,
}, () => {
  const root = temporaryRoot();
  try {
    const { bundleDirectory } = writeEmptyBundle(root);
    const output = path.join(root, "capture.json");
    const result = spawnSync(process.execPath, [
      "scripts/supabase-migration/capture-postgres-manifest.mjs",
      "--bundle", bundleDirectory,
      "--environment", "local",
      "--database-url-env", "FILMSCRIPT_TEST_POSTGRES_URL",
      "--output", output,
    ], { cwd: path.resolve("."), env: process.env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const capture = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.equal(capture.target.environment, "local");
    assert.equal(capture.target.projectRef, null);
    assert.deepEqual(capture.tables, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("reconciliation rejects evidence captured for another environment or project", async () => {
  const root = temporaryRoot();
  try {
    const { bundleDirectory } = writeEmptyBundle(root);
    const bundle = buildImportSql(bundleDirectory).bundle;
    const postgresCapture = parseCaptureOutput("", bundle, {
      host: `${STAGING_REF}.supabase.co`,
      projectRef: STAGING_REF,
      environment: "staging",
    });
    assert.throws(() => reconcilePostgres({
      bundleDirectory,
      captureManifest: postgresCapture,
      expectedEnvironment: "production",
      expectedProjectRef: PRODUCTION_REF,
    }), /Capture environment mismatch/);

    const manifestDirectory = writeEmptyStorageManifest(root);
    const storageCapture = await captureStorage({
      manifestDirectory,
      baseUrl: `https://${STAGING_REF}.supabase.co`,
      serviceRoleKey: "not-contacted-for-empty-manifest",
      environment: "staging",
      projectRef: STAGING_REF,
    });
    assert.throws(() => reconcileStorage({
      manifestDirectory,
      captureManifest: storageCapture,
      expectedEnvironment: "staging",
      expectedProjectRef: PRODUCTION_REF,
    }), /Capture project ref mismatch/);
    assert.throws(() => assertCaptureTarget(null, { expectedEnvironment: "production", expectedProjectRef: PRODUCTION_REF }), /missing destination provenance/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("import preflight checks Auth, private Storage, and every credit destination inside the transaction", () => {
  const root = temporaryRoot();
  try {
    const { bundleDirectory } = writeEmptyBundle(root);
    const { sql } = buildImportSql(bundleDirectory);
    assert.ok(sql.indexOf("pg_advisory_xact_lock") < sql.indexOf("SELECT 1 FROM auth.users"));
    assert.match(sql, /SELECT 1 FROM auth\.users LIMIT 1/);
    assert.match(sql, /SELECT 1 FROM storage\.objects WHERE bucket_id = 'filmscript-private' LIMIT 1/);
    for (const table of ["credit_accounts", "credit_windows", "credit_reservations", "credit_ledger", "feature_allowances"]) {
      assert.match(sql, new RegExp(`SELECT 1 FROM private\\.${table} LIMIT 1`));
    }
    assert.ok(sql.indexOf("SELECT 1 FROM private.feature_allowances") < sql.indexOf("COMMIT;"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("partial bundles and Storage plans cannot be applied or reconciled to a remote destination", async () => {
  const root = temporaryRoot();
  try {
    const { bundleDirectory } = writeEmptyBundle(root);
    assert.throws(() => assertFullBundleForApply(buildImportSql(bundleDirectory).bundle), /partial-schema bundle/);
    const manifestDirectory = writeEmptyStorageManifest(root);
    const manifest = JSON.parse(fs.readFileSync(path.join(manifestDirectory, "manifest.json"), "utf8"));
    assert.throws(() => assertFullStorageManifestForRemoteApply(manifest), /partial-schema bundle/);
    const environment = {
      ...process.env,
      FILMSCRIPT_PARTIAL_DB_URL: `postgresql://postgres@db.${STAGING_REF}.supabase.co/postgres`,
      FILMSCRIPT_PARTIAL_URL: `https://${STAGING_REF}.supabase.co`,
      FILMSCRIPT_PARTIAL_KEY: "not-used",
    };
    const importResult = spawnSync(process.execPath, [
      "scripts/supabase-migration/import-postgres.mjs",
      "--bundle", bundleDirectory,
      "--apply",
      "--environment", "staging",
      "--project-ref", STAGING_REF,
      "--database-url-env", "FILMSCRIPT_PARTIAL_DB_URL",
    ], { cwd: path.resolve("."), env: environment, encoding: "utf8" });
    assert.equal(importResult.status, 1);
    assert.match(importResult.stderr, /partial-schema bundle/);
    const storageResult = spawnSync(process.execPath, [
      "scripts/supabase-migration/copy-storage.mjs",
      "--manifest", manifestDirectory,
      "--apply",
      "--environment", "staging",
      "--project-ref", STAGING_REF,
      "--supabase-url-env", "FILMSCRIPT_PARTIAL_URL",
      "--service-role-key-env", "FILMSCRIPT_PARTIAL_KEY",
    ], { cwd: path.resolve("."), env: environment, encoding: "utf8" });
    assert.equal(storageResult.status, 1);
    assert.match(storageResult.stderr, /partial-schema bundle/);
    const storageCapture = await captureStorage({
      manifestDirectory,
      baseUrl: `https://${STAGING_REF}.supabase.co`,
      serviceRoleKey: "not-contacted-for-empty-manifest",
      environment: "staging",
      projectRef: STAGING_REF,
    });
    assert.throws(() => reconcileStorage({
      manifestDirectory,
      captureManifest: storageCapture,
      expectedEnvironment: "staging",
      expectedProjectRef: STAGING_REF,
    }), /partial-schema bundle/);
    const ambiguousStorageResult = spawnSync(process.execPath, [
      "scripts/supabase-migration/copy-storage.mjs",
      "--manifest", manifestDirectory,
      "--apply",
      "--dry-run",
    ], { cwd: path.resolve("."), env: environment, encoding: "utf8" });
    assert.equal(ambiguousStorageResult.status, 1);
    assert.match(ambiguousStorageResult.stderr, /Choose either --dry-run or --apply/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("import failures suppress raw database output that may contain row PII", () => {
  const privateOutput = "ERROR: failing row contains (person@example.com, secret prompt)";
  const message = safePsqlImportFailure({ status: 3, signal: null, stderr: privateOutput, stdout: privateOutput });
  assert.match(message, /exit code 3/);
  assert.match(message, /private data/);
  assert.doesNotMatch(message, /person@example\.com|secret prompt|failing row/);
});

test("mapping audit accepts only the exact mapping hashed into the bundle", () => {
  const root = temporaryRoot();
  try {
    const mapping = path.join(root, "mapping.json");
    fs.writeFileSync(mapping, '{"tables":{}}\n');
    const bundleManifest = { mappingSha256: sha256File(mapping) };
    assert.equal(assertBundleMapping(bundleManifest, mapping), bundleManifest.mappingSha256);
    fs.writeFileSync(mapping, '{"tables":{"users":{"action":"skip"}}}\n');
    assert.throws(() => assertBundleMapping(bundleManifest, mapping), /exact mapping file/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
