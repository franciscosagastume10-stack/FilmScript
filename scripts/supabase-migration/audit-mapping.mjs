#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  assertLocalEndpoint,
  assertSupabaseProjectRef,
  isMain,
  parseArgs,
  parseQualifiedName,
  postgresEnvironmentFromUrl,
  readJson,
  requiredArg,
  requireProductionConfirmation,
  resolvePsqlBin,
  sha256File,
  writeJsonExclusive,
} from "./lib/common.mjs";
import { validateBundle } from "./lib/bundle.mjs";
import { validateSnapshotExport } from "./snapshot-sqlite.mjs";

const DEFAULT_MAPPING_PATH = new URL("./default-mapping.json", import.meta.url);

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function mappedColumnName(sourceColumn, tableMapping) {
  if (tableMapping.columnRenames?.[sourceColumn]) return tableMapping.columnRenames[sourceColumn];
  return sourceColumn.endsWith("_json") ? sourceColumn.slice(0, -5) : sourceColumn;
}

export function assertBundleMapping(bundleManifest, mappingPath) {
  const mappingSha256 = sha256File(mappingPath);
  if (bundleManifest.mappingSha256 !== mappingSha256) {
    throw new Error("Mapping audit must use the exact mapping file recorded by the transformed bundle");
  }
  return mappingSha256;
}

function expectedTargetType(bundleType) {
  return {
    boolean: new Set(["boolean"]),
    date: new Set(["date"]),
    timestamptz: new Set(["timestamp with time zone"]),
    jsonb: new Set(["jsonb"]),
    bytea: new Set(["bytea"]),
    bigint: new Set(["smallint", "integer", "bigint", "numeric"]),
  }[bundleType] || null;
}

function requiredBundleType(targetDataType) {
  return {
    boolean: "boolean",
    date: "date",
    "timestamp with time zone": "timestamptz",
    jsonb: "jsonb",
    bytea: "bytea",
  }[targetDataType] || null;
}

export function buildTargetColumnQuery(bundleDirectory) {
  const bundle = validateBundle(bundleDirectory);
  const targets = bundle.tables.map((table) => parseQualifiedName(table.target));
  const tuples = targets.map(({ schema, table }) => `(${sqlString(schema)}, ${sqlString(table)})`).join(",\n    ");
  const sql = `
\\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT json_build_object(
  'schema', table_schema,
  'table', table_name,
  'column', column_name,
  'dataType', data_type,
  'udtName', udt_name,
  'nullable', is_nullable = 'YES',
  'default', column_default,
  'identity', is_identity = 'YES',
  'generated', is_generated <> 'NEVER'
)::text
FROM information_schema.columns
WHERE (table_schema, table_name) IN (
    ${tuples}
)
ORDER BY table_schema, table_name, ordinal_position;
COMMIT;
`;
  return { bundle, sql, targets };
}

export function captureTargetColumns(bundleDirectory, databaseUrl) {
  const { bundle, sql } = buildTargetColumnQuery(bundleDirectory);
  const connection = postgresEnvironmentFromUrl(databaseUrl);
  const psqlBin = resolvePsqlBin();
  const result = spawnSync(psqlBin, ["--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1"], {
    env: connection.environment,
    input: sql,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Postgres schema capture failed: ${String(result.stderr || result.stdout || "unknown error").trim()}`);
  const columns = String(result.stdout).split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`Postgres returned invalid column JSON: ${error.message}`); }
  });
  return { bundle, host: connection.host, columns };
}

export function auditMapping({ exportDirectory, bundleDirectory, targetColumns, mappingPath = DEFAULT_MAPPING_PATH }) {
  validateSnapshotExport(exportDirectory);
  const sourceManifest = readJson(path.join(path.resolve(exportDirectory), "manifest.json"), "SQLite export manifest");
  const bundle = validateBundle(bundleDirectory);
  const mappingFilename = mappingPath instanceof URL ? mappingPath : path.resolve(mappingPath);
  const mapping = readJson(mappingFilename, "SQLite to Postgres mapping");
  assertBundleMapping(bundle.manifest, mappingFilename);
  const targets = new Map();
  for (const column of targetColumns) {
    const qualified = `${column.schema}.${column.table}`;
    const columns = targets.get(qualified) || new Map();
    columns.set(column.column, column);
    targets.set(qualified, columns);
  }
  const bundleTargets = new Map(bundle.tables.map((table) => [table.target, table]));
  const issues = [];
  const skipped = [];
  const specials = [];
  let mappedSourceColumnCount = 0;

  for (const sourceTable of sourceManifest.tables) {
    const tableMapping = mapping.tables?.[sourceTable.name];
    if (!tableMapping) {
      issues.push({ sourceTable: sourceTable.name, issue: "missing_table_mapping" });
      continue;
    }
    if (tableMapping.action === "skip") {
      skipped.push({ table: sourceTable.name, rowCount: sourceTable.rowCount, columns: sourceTable.columns.map((column) => column.name), reason: tableMapping.reason });
      continue;
    }
    const actualTargetColumns = targets.get(tableMapping.target);
    const bundleTarget = bundleTargets.get(tableMapping.target);
    if (!actualTargetColumns) issues.push({ sourceTable: sourceTable.name, target: tableMapping.target, issue: "missing_target_table" });
    if (!bundleTarget) issues.push({ sourceTable: sourceTable.name, target: tableMapping.target, issue: "missing_bundle_table" });
    for (const sourceColumn of sourceTable.columns.map((column) => column.name)) {
      if (tableMapping.special === "budgetReceiptStorage" && sourceColumn === "data_blob") {
        specials.push({ sourceTable: sourceTable.name, sourceColumn, destination: "Supabase Storage + public.media_objects + private.budget_receipts.legacy_blob_sha256" });
        continue;
      }
      if ((tableMapping.omitColumns || []).includes(sourceColumn)) {
        issues.push({ sourceTable: sourceTable.name, sourceColumn, issue: "unexplained_omitted_column" });
        continue;
      }
      const targetColumn = mappedColumnName(sourceColumn, tableMapping);
      mappedSourceColumnCount += 1;
      if (actualTargetColumns && !actualTargetColumns.has(targetColumn)) {
        issues.push({ sourceTable: sourceTable.name, sourceColumn, target: tableMapping.target, targetColumn, issue: "missing_target_column" });
      }
      if (bundleTarget && !bundleTarget.columns.includes(targetColumn)) {
        issues.push({ sourceTable: sourceTable.name, sourceColumn, target: tableMapping.target, targetColumn, issue: "missing_bundle_column" });
      }
    }
  }

  for (const table of bundle.tables) {
    const actualTargetColumns = targets.get(table.target);
    if (!actualTargetColumns) continue;
    for (const column of table.columns) {
      const targetColumn = actualTargetColumns.get(column);
      if (!targetColumn) {
        issues.push({ target: table.target, targetColumn: column, issue: "bundle_column_absent_from_target" });
        continue;
      }
      const acceptedTypes = expectedTargetType(table.columnTypes[column]);
      if (acceptedTypes && !acceptedTypes.has(targetColumn.dataType)) {
        issues.push({ target: table.target, targetColumn: column, issue: "target_type_mismatch", bundleType: table.columnTypes[column], targetType: targetColumn.dataType });
      }
      const requiredType = requiredBundleType(targetColumn.dataType);
      if (requiredType && table.columnTypes[column] !== requiredType) {
        issues.push({ target: table.target, targetColumn: column, issue: "missing_canonical_type_transform", bundleType: table.columnTypes[column], requiredBundleType: requiredType });
      }
    }
    for (const targetColumn of actualTargetColumns.values()) {
      const requiredWithoutDefault = !targetColumn.nullable && targetColumn.default == null && !targetColumn.identity && !targetColumn.generated;
      if (requiredWithoutDefault && !table.columns.includes(targetColumn.column)) {
        issues.push({ target: table.target, targetColumn: targetColumn.column, issue: "required_target_column_has_no_value_or_default" });
      }
    }
  }

  const specialDestinations = [
    ["public.media_objects", ["id", "project_id", "owner_user_id", "bucket_id", "object_path", "kind", "size_bytes", "sha256", "metadata", "created_at", "updated_at"]],
    ["private.budget_receipts", ["media_object_id", "legacy_blob_sha256"]],
  ];
  if (specials.length) {
    for (const [target, columns] of specialDestinations) {
      const actual = targets.get(target);
      if (!actual) issues.push({ target, issue: "missing_special_target_table" });
      else for (const column of columns) if (!actual.has(column)) issues.push({ target, targetColumn: column, issue: "missing_special_target_column" });
    }
  }

  return {
    ok: issues.length === 0,
    sourceSchemaVersion: sourceManifest.schemaVersion,
    sourceTableCount: sourceManifest.tables.length,
    mappedTableCount: sourceManifest.tables.length - skipped.length,
    mappedSourceColumnCount,
    skipped,
    specials,
    targetTablesChecked: [...targets.keys()].sort(),
    targetBundleDataSha256: bundle.manifest.databaseDataSha256,
    issues,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundleDirectory = requiredArg(args, "bundle");
  const query = buildTargetColumnQuery(bundleDirectory);
  if (args["dry-run"]) {
    process.stdout.write(`${JSON.stringify({ ok: true, dryRun: true, targets: query.targets }, null, 2)}\n`);
    return;
  }
  if (!args.environment) throw new Error("Mapping audit requires --environment local, preview, staging, or production");
  const environment = requireProductionConfirmation(args, "mapping audit read");
  const variable = requiredArg(args, "database-url-env");
  const databaseUrl = process.env[variable];
  if (!databaseUrl) throw new Error(`Environment variable ${variable} is not set`);
  if (environment === "local") assertLocalEndpoint(databaseUrl);
  else assertSupabaseProjectRef(databaseUrl, requiredArg(args, "project-ref"));
  const capture = captureTargetColumns(bundleDirectory, databaseUrl);
  const result = auditMapping({
    exportDirectory: requiredArg(args, "export"),
    bundleDirectory,
    targetColumns: capture.columns,
    mappingPath: args.mapping || DEFAULT_MAPPING_PATH,
  });
  if (args.output) writeJsonExclusive(args.output, { ...result, capturedAt: new Date().toISOString(), targetHost: capture.host }, 0o600);
  process.stdout.write(`${JSON.stringify({ ...result, targetHost: capture.host }, null, 2)}\n`);
  if (!result.ok) process.exitCode = 2;
}

if (isMain(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Mapping audit failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
