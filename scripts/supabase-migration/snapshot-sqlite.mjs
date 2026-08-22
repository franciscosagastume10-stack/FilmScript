#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  EXPORT_FORMAT_VERSION,
  assertRegularFile,
  createExclusiveDirectory,
  isMain,
  normalizeRelativePath,
  parseArgs,
  quoteIdentifier,
  readJson,
  normalizeTimestamp,
  requiredArg,
  requireProductionConfirmation,
  resolveInside,
  sanitizeObjectSegment,
  sha256,
  sha256File,
  stableStringify,
  writeJsonExclusive,
} from "./lib/common.mjs";
import { validateCreditMaterializationManifest } from "./materialize-legacy-credits.mjs";

function sqliteChecks(database) {
  const integrity = database.pragma("integrity_check").map((row) => row.integrity_check);
  const foreignKeyViolations = database.pragma("foreign_key_check");
  if (integrity.length !== 1 || integrity[0] !== "ok") {
    throw new Error(`SQLite integrity_check failed: ${integrity.join("; ")}`);
  }
  if (foreignKeyViolations.length) {
    const sample = foreignKeyViolations.slice(0, 5).map((entry) => JSON.stringify(entry)).join("; ");
    throw new Error(`SQLite foreign_key_check found ${foreignKeyViolations.length} violation(s): ${sample}`);
  }
  return { integrityCheck: "ok", foreignKeyViolationCount: 0 };
}

function tableMetadata(database, table) {
  const columns = database.pragma(`table_info(${quoteIdentifier(table.name)})`).map((column) => ({
    name: column.name,
    type: column.type || "",
    notNull: Boolean(column.notnull),
    defaultValue: column.dflt_value,
    primaryKeyOrdinal: Number(column.pk || 0),
  }));
  const primaryKey = columns.filter((column) => column.primaryKeyOrdinal > 0)
    .sort((left, right) => left.primaryKeyOrdinal - right.primaryKeyOrdinal)
    .map((column) => column.name);
  const foreignKeys = database.pragma(`foreign_key_list(${quoteIdentifier(table.name)})`).map((entry) => ({
    from: entry.from,
    targetTable: entry.table,
    targetColumn: entry.to,
    onUpdate: entry.on_update,
    onDelete: entry.on_delete,
  }));
  return { columns, primaryKey, foreignKeys };
}

function encodeSqliteValue(value, { outputDirectory, tableName, columnName }) {
  if (Buffer.isBuffer(value)) {
    const digest = sha256(value);
    const relative = normalizeRelativePath(path.posix.join(
      "blobs",
      sanitizeObjectSegment(tableName, "table"),
      sanitizeObjectSegment(columnName, "column"),
      `${digest}.bin`,
    ));
    const filename = resolveInside(outputDirectory, relative, "BLOB sidecar path");
    fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    if (fs.existsSync(filename)) {
      const stats = assertRegularFile(filename, "BLOB sidecar");
      if (stats.size !== value.length || sha256File(filename) !== digest) {
        throw new Error(`Conflicting BLOB sidecar: ${relative}`);
      }
    } else {
      fs.writeFileSync(filename, value, { flag: "wx", mode: 0o600 });
    }
    return { $type: "blob", bytes: value.length, path: relative, sha256: digest };
  }
  if (typeof value === "bigint") return { $type: "bigint", value: String(value) };
  return value;
}

function encodeSqliteValueForValidation(value, { tableName, columnName }) {
  if (Buffer.isBuffer(value)) {
    const digest = sha256(value);
    return {
      $type: "blob",
      bytes: value.length,
      path: normalizeRelativePath(path.posix.join(
        "blobs",
        sanitizeObjectSegment(tableName, "table"),
        sanitizeObjectSegment(columnName, "column"),
        `${digest}.bin`,
      )),
      sha256: digest,
    };
  }
  if (typeof value === "bigint") return { $type: "bigint", value: String(value) };
  return value;
}

function orderedSelect(tableName, metadata, tableSql) {
  const order = metadata.primaryKey.length
    ? metadata.primaryKey.map(quoteIdentifier).join(", ")
    : /\bWITHOUT\s+ROWID\b/i.test(tableSql || "")
      ? null
      : "rowid";
  if (!order) throw new Error(`Cannot deterministically export ${tableName}: WITHOUT ROWID table has no primary key`);
  return `SELECT * FROM ${quoteIdentifier(tableName)} ORDER BY ${order}`;
}

function utcWeekKey(timestamp) {
  const date = new Date(normalizeTimestamp(timestamp, "SQLite snapshot capturedAt"));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function assertMaterializationPrecedesSnapshot(attestation, snapshotCapturedAt) {
  if (Date.parse(snapshotCapturedAt) < Date.parse(attestation.clock.completedAt)) {
    throw new Error("SQLite snapshot predates completion of credit materialization");
  }
  if (snapshotCapturedAt.slice(0, 7) !== attestation.clock.utcMonth
    || utcWeekKey(snapshotCapturedAt) !== attestation.clock.utcWeek) {
    throw new Error("SQLite snapshot crossed a UTC credit boundary after materialization");
  }
}

export async function snapshotSqlite({ source, outputDirectory }) {
  const sourcePath = path.resolve(source);
  assertRegularFile(sourcePath, "SQLite source");
  const siblingMaterializationManifest = path.join(path.dirname(sourcePath), "materialization-manifest.json");
  const creditMaterialization = fs.existsSync(siblingMaterializationManifest)
    ? validateCreditMaterializationManifest({
      manifestPath: siblingMaterializationManifest,
      databasePath: sourcePath,
      requirePhysicalMatch: true,
    })
    : null;
  const output = createExclusiveDirectory(outputDirectory);
  const snapshotPath = path.join(output, "source.sqlite");
  const sourceDatabase = new Database(sourcePath, { readonly: true, fileMustExist: true });
  sourceDatabase.defaultSafeIntegers(true);
  try {
    sqliteChecks(sourceDatabase);
    await sourceDatabase.backup(snapshotPath);
  } finally {
    sourceDatabase.close();
  }
  // Credit reservations and cycle eligibility are evaluated against the
  // instant the immutable SQLite backup finished, never the later time at
  // which potentially large NDJSON/BLOB exports happened to complete.
  const sourceCapturedAt = new Date().toISOString();
  if (creditMaterialization) {
    assertMaterializationPrecedesSnapshot(creditMaterialization.manifest, sourceCapturedAt);
  }

  let creditMaterializationReference = null;
  if (creditMaterialization) {
    const relative = "credit-materialization.json";
    const target = path.join(output, relative);
    fs.copyFileSync(siblingMaterializationManifest, target, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(target, 0o600);
    creditMaterializationReference = {
      file: relative,
      sha256: creditMaterialization.manifestSha256,
    };
  }

  fs.chmodSync(snapshotPath, 0o600);
  const snapshot = new Database(snapshotPath, { readonly: true, fileMustExist: true });
  snapshot.defaultSafeIntegers(true);
  let manifest;
  try {
    const checks = sqliteChecks(snapshot);
    const tables = snapshot.prepare(`
      SELECT name, sql FROM sqlite_schema
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    const tableEntries = [];
    for (const table of tables) {
      const metadata = tableMetadata(snapshot, table);
      const relativeDataFile = normalizeRelativePath(path.posix.join("tables", `${sanitizeObjectSegment(table.name, "table")}.ndjson`));
      const dataFile = resolveInside(output, relativeDataFile, "table data path");
      fs.mkdirSync(path.dirname(dataFile), { recursive: true, mode: 0o700 });
      const descriptor = fs.openSync(dataFile, "wx", 0o600);
      const rowHash = crypto.createHash("sha256");
      let rowCount = 0;
      try {
        const statement = snapshot.prepare(orderedSelect(table.name, metadata, table.sql));
        for (const sourceRow of statement.iterate()) {
          const row = {};
          for (const column of metadata.columns) {
            row[column.name] = encodeSqliteValue(sourceRow[column.name], {
              outputDirectory: output,
              tableName: table.name,
              columnName: column.name,
            });
          }
          const line = stableStringify(row);
          fs.writeSync(descriptor, `${line}\n`, null, "utf8");
          rowHash.update(line).update("\n");
          rowCount += 1;
        }
      } finally {
        fs.closeSync(descriptor);
      }
      tableEntries.push({
        name: table.name,
        sqlSha256: sha256(table.sql || ""),
        dataFile: relativeDataFile,
        rowCount,
        rowSha256: rowHash.digest("hex"),
        ...metadata,
      });
    }
    const snapshotStats = fs.statSync(snapshotPath);
    const schemaVersion = snapshot.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get()?.value ?? null;
    const dataSha256 = sha256(stableStringify(tableEntries.map(({ name, rowCount, rowSha256 }) => ({ name, rowCount, rowSha256 }))));
    manifest = {
      format: "filmscript-sqlite-export",
      formatVersion: EXPORT_FORMAT_VERSION,
      generatedAt: new Date().toISOString(),
      source: {
        basename: path.basename(sourcePath),
        capturedAt: sourceCapturedAt,
        creditMaterialization: creditMaterializationReference,
      },
      snapshot: {
        file: "source.sqlite",
        bytes: snapshotStats.size,
        sha256: sha256File(snapshotPath),
        ...checks,
      },
      schemaVersion: schemaVersion == null ? null : String(schemaVersion),
      dataSha256,
      tables: tableEntries,
    };
    writeJsonExclusive(path.join(output, "manifest.json"), manifest);
  } finally {
    snapshot.close();
  }
  return manifest;
}

export function validateSnapshotExport(exportDirectory) {
  const root = path.resolve(exportDirectory);
  const manifest = readJson(path.join(root, "manifest.json"), "SQLite export manifest");
  if (manifest.format !== "filmscript-sqlite-export" || manifest.formatVersion !== EXPORT_FORMAT_VERSION) {
    throw new Error(`Unsupported SQLite export format version: ${manifest.formatVersion}`);
  }
  const capturedAt = normalizeTimestamp(manifest.source?.capturedAt || manifest.generatedAt, "SQLite snapshot capturedAt");
  const generatedAt = normalizeTimestamp(manifest.generatedAt, "SQLite export generatedAt");
  if (Date.parse(capturedAt) > Date.parse(generatedAt)) {
    throw new Error("SQLite snapshot capturedAt cannot be later than export generatedAt");
  }
  const snapshotPath = resolveInside(root, manifest.snapshot.file, "snapshot file");
  const snapshotStats = assertRegularFile(snapshotPath, "SQLite snapshot");
  if (snapshotStats.size !== manifest.snapshot.bytes || sha256File(snapshotPath) !== manifest.snapshot.sha256) {
    throw new Error("SQLite snapshot checksum or size does not match its manifest");
  }
  if (manifest.source?.creditMaterialization) {
    const materializationPath = resolveInside(
      root,
      manifest.source.creditMaterialization.file,
      "credit materialization attestation",
    );
    if (sha256File(materializationPath) !== manifest.source.creditMaterialization.sha256) {
      throw new Error("Credit materialization attestation hash does not match the SQLite export");
    }
    const materialization = validateCreditMaterializationManifest({
      manifestPath: materializationPath,
      databasePath: snapshotPath,
      requirePhysicalMatch: false,
    });
    assertMaterializationPrecedesSnapshot(materialization.manifest, capturedAt);
  }
  const database = new Database(snapshotPath, { readonly: true, fileMustExist: true });
  database.defaultSafeIntegers(true);
  const verifiedTables = [];
  try {
    sqliteChecks(database);
    const snapshotTables = database.prepare(`
      SELECT name, sql FROM sqlite_schema
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    const declaredTables = Array.isArray(manifest.tables) ? manifest.tables : [];
    if (snapshotTables.length !== declaredTables.length
      || snapshotTables.some((table, index) => table.name !== declaredTables[index]?.name)) {
      throw new Error("SQLite export manifest table inventory does not match source.sqlite");
    }

    for (const [tableIndex, snapshotTable] of snapshotTables.entries()) {
      const table = declaredTables[tableIndex];
      const metadata = tableMetadata(database, snapshotTable);
      const expectedDataFile = normalizeRelativePath(path.posix.join("tables", `${sanitizeObjectSegment(table.name, "table")}.ndjson`));
      const declaredStructure = {
        sqlSha256: table.sqlSha256,
        dataFile: table.dataFile,
        columns: table.columns,
        primaryKey: table.primaryKey,
        foreignKeys: table.foreignKeys,
      };
      const snapshotStructure = {
        sqlSha256: sha256(snapshotTable.sql || ""),
        dataFile: expectedDataFile,
        ...metadata,
      };
      if (stableStringify(declaredStructure) !== stableStringify(snapshotStructure)) {
        throw new Error(`SQLite export metadata for table ${table.name} does not match source.sqlite`);
      }

      const filename = resolveInside(root, table.dataFile, `${table.name} data file`);
      assertRegularFile(filename, `${table.name} data file`);
      const rows = [];
      const rowHash = crypto.createHash("sha256");
      for (const [index, line] of fs.readFileSync(filename, "utf8").split(/\r?\n/).entries()) {
        if (!line.trim()) continue;
        let row;
        try { row = JSON.parse(line); }
        catch (error) { throw new Error(`Invalid NDJSON at ${filename}:${index + 1}: ${error.message}`); }
        const canonicalLine = stableStringify(row);
        if (canonicalLine !== line) throw new Error(`Non-canonical NDJSON at ${filename}:${index + 1}`);
        const expectedColumns = metadata.columns.map((column) => column.name).sort();
        if (stableStringify(Object.keys(row).sort()) !== stableStringify(expectedColumns)) {
          throw new Error(`${table.name} NDJSON row ${index + 1} does not contain every source.sqlite column exactly once`);
        }
        rowHash.update(canonicalLine).update("\n");
        rows.push(row);
        for (const [column, value] of Object.entries(row)) {
          if (value?.$type !== "blob") continue;
          const blobPath = resolveInside(root, value.path, `${table.name}.${column} BLOB`);
          const stats = assertRegularFile(blobPath, `${table.name}.${column} BLOB`);
          if (stats.size !== value.bytes || sha256File(blobPath) !== value.sha256) {
            throw new Error(`BLOB checksum mismatch for ${table.name}.${column}: ${value.path}`);
          }
        }
      }

      let sourceRowCount = 0;
      const statement = database.prepare(orderedSelect(table.name, metadata, snapshotTable.sql));
      for (const sourceRow of statement.iterate()) {
        const exportedRow = rows[sourceRowCount];
        if (!exportedRow) throw new Error(`SQLite export omitted row ${sourceRowCount + 1} from table ${table.name}`);
        const canonicalSourceRow = {};
        for (const column of metadata.columns) {
          canonicalSourceRow[column.name] = encodeSqliteValueForValidation(sourceRow[column.name], {
            tableName: table.name,
            columnName: column.name,
          });
        }
        if (stableStringify(exportedRow) !== stableStringify(canonicalSourceRow)) {
          throw new Error(`SQLite export row ${sourceRowCount + 1} for table ${table.name} does not match source.sqlite`);
        }
        sourceRowCount += 1;
      }
      if (sourceRowCount !== rows.length) throw new Error(`SQLite export contains extra rows for table ${table.name}`);
      const digest = rowHash.digest("hex");
      if (sourceRowCount !== table.rowCount || digest !== table.rowSha256) {
        throw new Error(`Row count or checksum mismatch for table ${table.name}`);
      }
      verifiedTables.push({ name: table.name, rowCount: sourceRowCount, rowSha256: digest });
    }
  } finally {
    database.close();
  }
  const dataSha256 = sha256(stableStringify(verifiedTables));
  if (dataSha256 !== manifest.dataSha256) throw new Error("Export-level data checksum does not match its manifest");
  return { ok: true, schemaVersion: manifest.schemaVersion, dataSha256, tables: verifiedTables };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.validate) {
    const result = validateSnapshotExport(requiredArg(args, "validate"));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  requireProductionConfirmation(args, "SQLite snapshot");
  const result = await snapshotSqlite({
    source: requiredArg(args, "source"),
    outputDirectory: requiredArg(args, "output"),
  });
  process.stdout.write(`${JSON.stringify({ ok: true, schemaVersion: result.schemaVersion, dataSha256: result.dataSha256, tables: result.tables.length }, null, 2)}\n`);
}

if (isMain(import.meta.url)) main().catch((error) => {
  process.stderr.write(`SQLite snapshot failed: ${error.message}\n`);
  process.exitCode = 1;
});
