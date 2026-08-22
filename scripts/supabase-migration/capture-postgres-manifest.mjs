#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import {
  assertCaptureTarget,
  assertLocalEndpoint,
  assertSupabaseProjectRef,
  databaseStableStringify,
  isMain,
  normalizeDate,
  normalizeTimestamp,
  parseArgs,
  postgresEnvironmentFromUrl,
  quoteIdentifier,
  quoteQualifiedName,
  requireProductionConfirmation,
  requiredArg,
  resolvePsqlBin,
  sha256,
  stableStringify,
  writeJsonExclusive,
} from "./lib/common.mjs";
import { validateBundle } from "./lib/bundle.mjs";

const TABLE_MARKER = "__FILMSCRIPT_TABLE__:";
const END_MARKER = "__FILMSCRIPT_END__";

function selectExpression(column, type) {
  const quoted = quoteIdentifier(column);
  if (type === "bytea") return `encode(${quoted}, 'hex') AS ${quoted}`;
  if (type === "bigint") return `${quoted}::text AS ${quoted}`;
  return quoted;
}

export function buildCaptureSql(bundleDirectory) {
  const bundle = validateBundle(bundleDirectory);
  const sections = ["\\set ON_ERROR_STOP on", "BEGIN READ ONLY;", "SET LOCAL statement_timeout = '60s';"];
  for (const table of bundle.tables) {
    if (!table.primaryKey.length) throw new Error(`${table.target} has no primary key for deterministic reconciliation`);
    const expressions = table.columns.map((column) => selectExpression(column, table.columnTypes[column])).join(", ");
    const order = table.primaryKey.map(quoteIdentifier).join(", ");
    sections.push(`SELECT '${TABLE_MARKER}${table.target}';`);
    sections.push(`SELECT row_to_json(filmscript_row)::text FROM (SELECT ${expressions} FROM ${quoteQualifiedName(table.target)} ORDER BY ${order}) AS filmscript_row;`);
    sections.push(`SELECT '${END_MARKER}';`);
  }
  sections.push("COMMIT;", "");
  return { bundle, sql: sections.join("\n") };
}

function normalizeCapturedValue(value, type, context) {
  if (value == null) return null;
  if (type === "bytea") {
    if (typeof value !== "string" || value.length % 2 || !/^[0-9a-f]*$/i.test(value)) throw new Error(`${context} is not Postgres hex bytea`);
    const bytes = Buffer.from(value, "hex");
    return { $type: "blob", bytes: bytes.length, sha256: sha256(bytes) };
  }
  if (type === "bigint") {
    if (typeof value !== "string" || !/^-?\d+$/.test(value)) throw new Error(`${context} is not Postgres bigint text`);
    return { $type: "bigint", value };
  }
  if (type === "timestamptz") return normalizeTimestamp(value, context);
  if (type === "date") return normalizeDate(value, context);
  return value;
}

function parseCaptureLines(lines, bundle, target = null) {
  const expected = new Map(bundle.tables.map((table) => [table.target, table]));
  const captured = new Map();
  const started = new Set();
  let active = null;
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(TABLE_MARKER)) {
      if (active) throw new Error(`Postgres capture started a new table before closing ${active.target}`);
      const tableTarget = line.slice(TABLE_MARKER.length);
      if (!expected.has(tableTarget)) throw new Error(`Postgres capture returned unexpected table ${tableTarget}`);
      if (started.has(tableTarget)) throw new Error(`Postgres capture returned duplicate table ${tableTarget}`);
      started.add(tableTarget);
      active = {
        target: tableTarget,
        rowCount: 0,
        rowHash: crypto.createHash("sha256"),
        rows: [],
      };
      continue;
    }
    if (line === END_MARKER) {
      if (!active) throw new Error("Postgres capture emitted an end marker without a table");
      captured.set(active.target, {
        target: active.target,
        rowCount: active.rowCount,
        databaseRowSha256: active.rowHash.digest("hex"),
        rows: active.rows,
      });
      active = null;
      continue;
    }
    if (!active) throw new Error(`Unexpected Postgres capture output: ${line.slice(0, 120)}`);
    let row;
    try { row = JSON.parse(line); }
    catch (error) { throw new Error(`Postgres returned invalid row JSON for ${active.target}: ${error.message}`); }
    const table = expected.get(active.target);
    if (stableStringify(Object.keys(row).sort()) !== stableStringify([...table.columns].sort())) {
      throw new Error(`Postgres capture returned unexpected columns for ${active.target}`);
    }
    const normalized = {};
    for (const column of table.columns) normalized[column] = normalizeCapturedValue(row[column], table.columnTypes[column], `${table.target}.${column}`);
    const canonicalRow = databaseStableStringify(normalized);
    active.rowHash.update(canonicalRow).update("\n");
    active.rows.push({
      primaryKey: table.primaryKey.map((column) => normalized[column]),
      sha256: sha256(canonicalRow),
    });
    active.rowCount += 1;
  }
  if (active) throw new Error(`Postgres capture did not close table ${active.target}`);
  for (const target of expected.keys()) if (!captured.has(target)) throw new Error(`Postgres capture omitted table ${target}`);

  const tables = [];
  for (const table of bundle.tables) {
    tables.push(captured.get(table.target));
  }
  const manifest = {
    format: "filmscript-postgres-capture",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    databaseDataSha256: sha256(stableStringify(tables.map(({ target, rowCount, databaseRowSha256 }) => ({ target, rowCount, databaseRowSha256 })))),
    tables,
  };
  if (target) manifest.target = assertCaptureTarget(target);
  return manifest;
}

export function parseCaptureOutput(output, bundle, target = null) {
  return parseCaptureLines(String(output).split(/\r?\n/), bundle, target);
}

function* readLinesSync(filename) {
  const descriptor = fs.openSync(filename, "r");
  const decoder = new StringDecoder("utf8");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let pending = "";
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      pending += decoder.write(buffer.subarray(0, bytesRead));
      const parts = pending.split("\n");
      pending = parts.pop() || "";
      for (const part of parts) yield part.endsWith("\r") ? part.slice(0, -1) : part;
    } while (bytesRead);
    pending += decoder.end();
    if (pending) yield pending.endsWith("\r") ? pending.slice(0, -1) : pending;
  } finally {
    fs.closeSync(descriptor);
  }
}

export function parseCaptureFile(filename, bundle, target = null) {
  return parseCaptureLines(readLinesSync(filename), bundle, target);
}

function captureWithPsql(sql, databaseUrl) {
  const connection = postgresEnvironmentFromUrl(databaseUrl);
  const psqlBin = resolvePsqlBin();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-pg-capture-"));
  const outputFile = path.join(temporary, "capture.ndjson");
  const errorFile = path.join(temporary, "psql-error.log");
  const outputDescriptor = fs.openSync(outputFile, "wx", 0o600);
  const errorDescriptor = fs.openSync(errorFile, "wx", 0o600);
  let result;
  try {
    result = spawnSync(psqlBin, ["--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1"], {
      env: connection.environment,
      input: sql,
      stdio: ["pipe", outputDescriptor, errorDescriptor],
    });
  } finally {
    fs.closeSync(outputDescriptor);
    fs.closeSync(errorDescriptor);
  }
  const cleanup = () => fs.rmSync(temporary, { recursive: true, force: true });
  if (result.error?.code === "ENOENT") {
    cleanup();
    throw new Error(`psql disappeared before capture: ${psqlBin}`);
  }
  if (result.error) {
    cleanup();
    throw new Error(`psql capture could not start${result.error.code ? ` (${result.error.code})` : ""}`);
  }
  if (result.status !== 0) {
    cleanup();
    throw new Error(`psql capture failed with exit code ${result.status}; detailed database output was suppressed because it may contain private data`);
  }
  return { outputFile, cleanup, host: connection.host };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.environment) throw new Error("Postgres capture requires --environment local, preview, staging, or production");
  const environment = requireProductionConfirmation(args, "Postgres reconciliation read");
  const { bundle, sql } = buildCaptureSql(requiredArg(args, "bundle"));
  if (args["dry-run"]) {
    process.stdout.write(`${JSON.stringify({ ok: true, dryRun: true, tables: bundle.tables.length, queryBytes: Buffer.byteLength(sql) }, null, 2)}\n`);
    return;
  }
  const variable = requiredArg(args, "database-url-env");
  const databaseUrl = process.env[variable];
  if (!databaseUrl) throw new Error(`Environment variable ${variable} is not set`);
  const projectRef = environment === "local" ? null : requiredArg(args, "project-ref");
  if (environment === "local") assertLocalEndpoint(databaseUrl);
  else assertSupabaseProjectRef(databaseUrl, projectRef);
  const capture = captureWithPsql(sql, databaseUrl);
  let manifest;
  try {
    manifest = parseCaptureFile(capture.outputFile, bundle, {
      host: capture.host,
      projectRef,
      environment,
    });
  } finally {
    capture.cleanup();
  }
  writeJsonExclusive(requiredArg(args, "output"), manifest, 0o600);
  process.stdout.write(`${JSON.stringify({ ok: true, dryRun: false, host: capture.host, databaseDataSha256: manifest.databaseDataSha256, tables: manifest.tables.length }, null, 2)}\n`);
}

if (isMain(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Postgres capture failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
