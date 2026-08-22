#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  isMain,
  assertLocalEndpoint,
  assertSupabaseProjectRef,
  parseArgs,
  postgresEnvironmentFromUrl,
  quoteIdentifier,
  quoteQualifiedName,
  resolvePsqlBin,
  requireProductionConfirmation,
  requiredArg,
  resolveInside,
  stableStringify,
  writeTextExclusive,
} from "./lib/common.mjs";
import { validateBundle } from "./lib/bundle.mjs";

function sqlString(value) {
  const string = String(value);
  if (string.includes("\0")) throw new Error("Postgres text cannot contain a NUL byte");
  return `'${string.replaceAll("'", "''")}'`;
}

function sqlLiteral(value, type, bundleRoot) {
  if (value == null) return "NULL";
  if (type === "boolean") return value ? "TRUE" : "FALSE";
  if (type === "bigint") return value.value;
  if (type === "jsonb") return `${sqlString(stableStringify(value))}::jsonb`;
  if (type === "bytea") {
    const filename = resolveInside(bundleRoot, value.path, "BLOB import path");
    const base64 = fs.readFileSync(filename).toString("base64");
    return `decode(${sqlString(base64)}, 'base64')`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot import a non-finite number");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return sqlString(value);
}

function insertStatements(table, bundleRoot, maxStatementBytes = 512 * 1024) {
  if (!table.rows.length) return [];
  const columnsSql = table.columns.map(quoteIdentifier).join(", ");
  const prefix = `INSERT INTO ${quoteQualifiedName(table.target)} (${columnsSql}) VALUES\n`;
  const statements = [];
  let tuples = [];
  let bytes = Buffer.byteLength(prefix);
  const flush = () => {
    if (!tuples.length) return;
    statements.push(`${prefix}${tuples.join(",\n")};`);
    tuples = [];
    bytes = Buffer.byteLength(prefix);
  };
  for (const row of table.rows) {
    const tuple = `  (${table.columns.map((column) => sqlLiteral(row[column], table.columnTypes[column], bundleRoot)).join(", ")})`;
    const tupleBytes = Buffer.byteLength(tuple) + 2;
    if (tuples.length && bytes + tupleBytes > maxStatementBytes) flush();
    tuples.push(tuple);
    bytes += tupleBytes;
  }
  flush();
  return statements;
}

function emptyDestinationGuard(tables) {
  const bundleChecks = tables.map((table) => `
  IF EXISTS (SELECT 1 FROM ${quoteQualifiedName(table.target)} LIMIT 1) THEN
    RAISE EXCEPTION ${sqlString(`FilmScript import requires empty destination table ${table.target}`)};
  END IF;`).join("");
  const platformChecks = `
  IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    RAISE EXCEPTION 'FilmScript import requires empty destination table auth.users';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'filmscript-private' LIMIT 1) THEN
    RAISE EXCEPTION 'FilmScript import requires empty Storage bucket filmscript-private';
  END IF;
  IF EXISTS (SELECT 1 FROM private.credit_accounts LIMIT 1) THEN
    RAISE EXCEPTION 'FilmScript import requires empty destination table private.credit_accounts';
  END IF;
  IF EXISTS (SELECT 1 FROM private.credit_windows LIMIT 1) THEN
    RAISE EXCEPTION 'FilmScript import requires empty destination table private.credit_windows';
  END IF;
  IF EXISTS (SELECT 1 FROM private.credit_reservations LIMIT 1) THEN
    RAISE EXCEPTION 'FilmScript import requires empty destination table private.credit_reservations';
  END IF;
  IF EXISTS (SELECT 1 FROM private.credit_ledger LIMIT 1) THEN
    RAISE EXCEPTION 'FilmScript import requires empty destination table private.credit_ledger';
  END IF;
  IF EXISTS (SELECT 1 FROM private.feature_allowances LIMIT 1) THEN
    RAISE EXCEPTION 'FilmScript import requires empty destination table private.feature_allowances';
  END IF;`;
  return `DO $filmscript_import_empty$\nBEGIN${bundleChecks}${platformChecks}\nEND\n$filmscript_import_empty$;`;
}

export function buildImportSql(bundleDirectory, { rollback = false } = {}) {
  const bundle = validateBundle(bundleDirectory);
  const sections = [
    "\\set ON_ERROR_STOP on",
    "BEGIN;",
    "SET LOCAL lock_timeout = '10s';",
    "SET LOCAL statement_timeout = '0';",
    "SELECT pg_advisory_xact_lock(hashtextextended('filmscript-supabase-import-v1', 0));",
    emptyDestinationGuard(bundle.tables),
  ];
  for (const table of bundle.tables.sort((left, right) => left.order - right.order || left.target.localeCompare(right.target))) {
    sections.push(`-- ${table.target}: ${table.rowCount} row(s), ${table.databaseRowSha256}`);
    sections.push(...insertStatements(table, bundle.root));
  }
  sections.push(rollback ? "ROLLBACK;" : "COMMIT;", "SELECT 'FILMSCRIPT_IMPORT_OK' AS status;", "");
  return { bundle, sql: sections.join("\n\n") };
}

export function safePsqlImportFailure(result) {
  const status = Number.isInteger(result?.status) ? `exit code ${result.status}` : "an unknown exit code";
  const signal = typeof result?.signal === "string" && result.signal ? ` (signal ${result.signal})` : "";
  return `psql import failed with ${status}${signal}; detailed database output was suppressed because it may contain private data`;
}

export function assertFullBundleForApply(bundle) {
  if (bundle?.manifest?.validationMode !== "full") {
    throw new Error("Refusing to apply a partial-schema bundle; regenerate it with full production validation");
  }
  return bundle;
}

function applyWithPsql(sql, databaseUrl) {
  const connection = postgresEnvironmentFromUrl(databaseUrl);
  const psqlBin = resolvePsqlBin();
  const result = spawnSync(psqlBin, ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1"], {
    env: connection.environment,
    input: sql,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error?.code === "ENOENT") throw new Error(`psql disappeared before import: ${psqlBin}`);
  if (result.error) throw new Error(`psql import could not start${result.error.code ? ` (${result.error.code})` : ""}`);
  if (result.status !== 0) throw new Error(safePsqlImportFailure(result));
  if (!String(result.stdout).includes("FILMSCRIPT_IMPORT_OK")) throw new Error("psql finished without the expected import confirmation");
  return { host: connection.host };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply && args["dry-run"]) throw new Error("Choose either --dry-run or --apply, not both");
  const { bundle, sql } = buildImportSql(requiredArg(args, "bundle"));
  if (args["sql-out"]) writeTextExclusive(args["sql-out"], sql, 0o600);
  const summary = {
    ok: true,
    dryRun: !args.apply,
    sourceDataSha256: bundle.manifest.source.dataSha256,
    targetDataSha256: bundle.manifest.databaseDataSha256,
    tables: bundle.tables.map((table) => ({ target: table.target, rows: table.rowCount })),
    statementBytes: Buffer.byteLength(sql),
  };
  if (args.apply) {
    if (!args.environment) throw new Error("--apply requires an explicit --environment local, preview, staging, or production");
    const environment = requireProductionConfirmation(args, "Postgres import");
    const environmentVariable = requiredArg(args, "database-url-env");
    const databaseUrl = process.env[environmentVariable];
    if (!databaseUrl) throw new Error(`Environment variable ${environmentVariable} is not set`);
    if (environment === "local") assertLocalEndpoint(databaseUrl);
    else assertSupabaseProjectRef(databaseUrl, requiredArg(args, "project-ref"));
    assertFullBundleForApply(bundle);
    summary.destination = applyWithPsql(sql, databaseUrl);
    summary.dryRun = false;
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (isMain(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Postgres import failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
