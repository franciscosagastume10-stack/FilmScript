#!/usr/bin/env node
import path from "node:path";
import {
  assertCaptureTarget,
  isMain,
  normalizeMigrationEnvironment,
  parseArgs,
  readJson,
  readNdjson,
  requiredArg,
  resolveInside,
  sha256,
  databaseStableStringify,
  stableStringify,
} from "./lib/common.mjs";
import { validateBundle } from "./lib/bundle.mjs";

function expectedRowsByKey(bundle, table) {
  const rows = readNdjson(resolveInside(bundle.root, table.dataFile, `${table.target} data`));
  return new Map(rows.map((row) => [
    stableStringify(table.primaryKey.map((column) => row[column])),
    sha256(databaseStableStringify(row)),
  ]));
}

export function reconcilePostgres({ bundleDirectory, captureManifest, expectedEnvironment = null, expectedProjectRef = null }) {
  const bundle = validateBundle(bundleDirectory);
  const destinationEnvironment = expectedEnvironment == null
    ? null
    : normalizeMigrationEnvironment(expectedEnvironment, "expected capture environment");
  const capture = typeof captureManifest === "string"
    ? readJson(path.resolve(captureManifest), "Postgres capture manifest")
    : captureManifest;
  if (capture.format !== "filmscript-postgres-capture" || capture.formatVersion !== 1) throw new Error("Unsupported Postgres capture manifest");
  if (expectedEnvironment != null || expectedProjectRef != null) {
    assertCaptureTarget(capture.target, { expectedEnvironment: destinationEnvironment, expectedProjectRef });
  }
  if ((expectedProjectRef != null || (destinationEnvironment && destinationEnvironment !== "local"))
    && bundle.manifest.validationMode !== "full") {
    throw new Error("Refusing remote reconciliation for a partial-schema bundle");
  }
  const actualByTarget = new Map((capture.tables || []).map((table) => [table.target, table]));
  const expectedTargets = new Set(bundle.tables.map((table) => table.target));
  const differences = [];
  for (const table of bundle.tables) {
    const actual = actualByTarget.get(table.target);
    if (!actual) {
      differences.push({ target: table.target, issue: "missing_table" });
      continue;
    }
    if (actual.rowCount !== table.rowCount) differences.push({ target: table.target, issue: "row_count", expected: table.rowCount, actual: actual.rowCount });
    if (actual.databaseRowSha256 !== table.databaseRowSha256) {
      const expectedRows = expectedRowsByKey(bundle, table);
      const actualRows = new Map((actual.rows || []).map((row) => [stableStringify(row.primaryKey), row.sha256]));
      const missingKeys = [...expectedRows.keys()].filter((key) => !actualRows.has(key)).slice(0, 20);
      const unexpectedKeys = [...actualRows.keys()].filter((key) => !expectedRows.has(key)).slice(0, 20);
      const mismatchedKeys = [...expectedRows.keys()].filter((key) => actualRows.has(key) && actualRows.get(key) !== expectedRows.get(key)).slice(0, 20);
      differences.push({
        target: table.target,
        issue: "row_checksum",
        expected: table.databaseRowSha256,
        actual: actual.databaseRowSha256,
        missingKeys,
        unexpectedKeys,
        mismatchedKeys,
      });
    }
  }
  for (const target of actualByTarget.keys()) if (!expectedTargets.has(target)) differences.push({ target, issue: "unexpected_table" });
  if (capture.databaseDataSha256 !== bundle.manifest.databaseDataSha256 && !differences.length) {
    differences.push({ issue: "database_checksum", expected: bundle.manifest.databaseDataSha256, actual: capture.databaseDataSha256 });
  }
  return {
    ok: differences.length === 0,
    expectedDatabaseDataSha256: bundle.manifest.databaseDataSha256,
    actualDatabaseDataSha256: capture.databaseDataSha256,
    collaborationRemediation: bundle.manifest.collaborationRemediation,
    creditNormalization: bundle.manifest.creditNormalization,
    differences,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const expectedEnvironment = normalizeMigrationEnvironment(requiredArg(args, "expected-environment"), "expected capture environment");
  if (expectedEnvironment === "local" && args["expected-project-ref"]) {
    throw new Error("--expected-project-ref is not valid with --expected-environment local");
  }
  const expectedProjectRef = expectedEnvironment === "local" ? null : requiredArg(args, "expected-project-ref");
  const result = reconcilePostgres({
    bundleDirectory: requiredArg(args, "bundle"),
    captureManifest: requiredArg(args, "capture"),
    expectedEnvironment,
    expectedProjectRef,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 2;
}

if (isMain(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Reconciliation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
