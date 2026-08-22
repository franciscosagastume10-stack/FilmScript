import fs from "node:fs";
import path from "node:path";
import {
  BUNDLE_FORMAT_VERSION,
  assertNoNullBytes,
  assertRegularFile,
  databaseStableStringify,
  normalizeDate,
  normalizeTimestamp,
  readJson,
  readNdjson,
  resolveInside,
  sha256,
  sha256File,
  stableStringify,
  storageContractDataSha256,
} from "./common.mjs";
import { validateProjectOwnershipGraph } from "./project-ownership.mjs";

const REQUIRED_FULL_S3_SOURCE_BUCKET = "filmscript-production-mediabucket-xzgdb1rat94u";

function validateTypedValue(value, type, root, context) {
  if (value == null) return;
  if (type === "boolean" && typeof value !== "boolean") throw new Error(`${context} is not boolean`);
  if (type === "date" && normalizeDate(value, context) !== value) throw new Error(`${context} is not normalized`);
  if (type === "timestamptz" && normalizeTimestamp(value, context) !== value) throw new Error(`${context} is not normalized`);
  if (type === "bigint") {
    if (value?.$type !== "bigint" || !/^-?\d+$/.test(value.value)) throw new Error(`${context} is not an encoded bigint`);
  }
  if (type === "bytea") {
    if (value?.$type !== "blob") throw new Error(`${context} is not an encoded BLOB`);
    const filename = resolveInside(root, value.path, `${context} BLOB`);
    const stats = assertRegularFile(filename, `${context} BLOB`);
    if (stats.size !== value.bytes || sha256File(filename) !== value.sha256) throw new Error(`${context} BLOB checksum mismatch`);
  }
  if (type !== "bytea") assertNoNullBytes(value, context);
}

export function validateBundle(bundleDirectory) {
  const root = path.resolve(bundleDirectory);
  const manifest = readJson(path.join(root, "manifest.json"), "Postgres bundle manifest");
  if (manifest.format !== "filmscript-postgres-bundle" || manifest.formatVersion !== BUNDLE_FORMAT_VERSION) {
    throw new Error(`Unsupported Postgres bundle format version: ${manifest.formatVersion}`);
  }
  if (manifest.validationMode !== "full" && manifest.validationMode !== "partial") {
    throw new Error("Postgres bundle must declare validationMode full or partial");
  }
  if (manifest.validationMode === "full") {
    const inventory = manifest.source?.s3Inventory;
    if (inventory?.bucket !== REQUIRED_FULL_S3_SOURCE_BUCKET || inventory.prefix !== "") {
      throw new Error("Full Postgres bundle must be bound to the complete production S3 bucket inventory");
    }
    if (!Number.isSafeInteger(inventory.objectCount) || inventory.objectCount < 0
      || !Number.isSafeInteger(inventory.totalBytes) || inventory.totalBytes < 0
      || !/^[0-9a-f]{64}$/i.test(inventory.dataSha256 || "")) {
      throw new Error("Full Postgres bundle has invalid S3 inventory provenance");
    }
  }
  const summaries = [];
  const tables = [];
  for (const table of manifest.tables || []) {
    const rows = readNdjson(resolveInside(root, table.dataFile, `${table.target} data`));
    const primaryKeys = new Set();
    for (const [index, row] of rows.entries()) {
      const actualColumns = Object.keys(row).sort();
      if (stableStringify(actualColumns) !== stableStringify(table.columns)) {
        throw new Error(`${table.target} row ${index + 1} has unexpected columns`);
      }
      for (const column of table.columns) validateTypedValue(row[column], table.columnTypes[column], root, `${table.target}[${index}].${column}`);
      const keyValues = table.primaryKey.map((column) => row[column]);
      if (keyValues.some((value) => value == null)) throw new Error(`${table.target} row ${index + 1} has a null primary key`);
      const encodedKey = stableStringify(keyValues);
      if (primaryKeys.has(encodedKey)) throw new Error(`${table.target} contains duplicate primary key ${encodedKey}`);
      primaryKeys.add(encodedKey);
    }
    const rowSha256 = sha256(rows.map((row) => `${stableStringify(row)}\n`).join(""));
    const databaseRowSha256 = sha256(rows.map((row) => `${databaseStableStringify(row)}\n`).join(""));
    if (rows.length !== table.rowCount || rowSha256 !== table.rowSha256 || databaseRowSha256 !== table.databaseRowSha256) {
      throw new Error(`${table.target} row count or checksum mismatch`);
    }
    const summary = { target: table.target, rowCount: rows.length, rowSha256, databaseRowSha256 };
    summaries.push(summary);
    tables.push({ ...table, rows });
  }
  const localDataSha256 = sha256(stableStringify(summaries.map(({ target, rowCount, rowSha256 }) => ({ target, rowCount, rowSha256 }))));
  const databaseDataSha256 = sha256(stableStringify(summaries.map(({ target, rowCount, databaseRowSha256 }) => ({ target, rowCount, databaseRowSha256 }))));
  if (localDataSha256 !== manifest.dataSha256 || databaseDataSha256 !== manifest.databaseDataSha256) {
    throw new Error("Bundle-level data checksum does not match its manifest");
  }
  if (manifest.validationMode === "full") {
    const ownership = validateProjectOwnershipGraph({
      scripts: tables.find((table) => table.target === "public.scripts")?.rows,
      memberships: tables.find((table) => table.target === "public.project_memberships")?.rows,
    });
    if (manifest.projectOwnership?.status !== "verified"
      || manifest.projectOwnership.projectCount !== ownership.projectCount
      || manifest.projectOwnership.activeOwnerCount !== ownership.activeOwnerCount) {
      throw new Error("Postgres bundle ownership validation summary does not match its rows");
    }
  }
  return { ok: true, root, manifest, dataSha256: localDataSha256, databaseDataSha256, tables };
}

export function loadStoragePlan(bundleDirectory) {
  const bundle = validateBundle(bundleDirectory);
  const filename = resolveInside(bundle.root, bundle.manifest.storage.file, "storage plan");
  const plan = readJson(filename, "Storage plan");
  if (plan.format !== "filmscript-storage-plan" || plan.formatVersion !== 1) throw new Error("Unsupported Storage plan format");
  if (plan.validationMode !== bundle.manifest.validationMode) throw new Error("Storage plan validation mode does not match bundle manifest");
  if (plan.entries.length !== bundle.manifest.storage.entryCount) throw new Error("Storage plan entry count does not match bundle manifest");
  const planDataSha256 = sha256(stableStringify(plan.entries));
  if (plan.dataSha256 !== planDataSha256 || bundle.manifest.storage.dataSha256 !== planDataSha256) {
    throw new Error("Storage plan checksum does not match bundle manifest");
  }
  const contractSha256 = storageContractDataSha256(plan.entries);
  if (plan.contractSha256 !== contractSha256 || bundle.manifest.storage.contractSha256 !== contractSha256) {
    throw new Error("Storage plan contract does not match bundle manifest");
  }
  if (bundle.manifest.validationMode === "full") {
    const inventory = bundle.manifest.source.s3Inventory;
    const s3Entries = plan.entries.filter((entry) => entry.source?.type === "s3");
    const inventoryEntries = [...s3Entries].sort((left, right) => left.source.key.localeCompare(right.source.key));
    const inventoryDataSha256 = sha256(stableStringify(inventoryEntries.map((entry) => ({
      key: entry.source.key,
      bytes: entry.source.bytes,
      sha256: entry.source.sha256,
    }))));
    const inventoryBytes = s3Entries.reduce((sum, entry) => sum + entry.source.bytes, 0);
    if (s3Entries.length !== inventory.objectCount
      || inventoryBytes !== inventory.totalBytes
      || inventoryDataSha256 !== inventory.dataSha256
      || s3Entries.some((entry) => entry.source.bucket !== inventory.bucket)) {
      throw new Error("Full Storage plan does not match the recorded production S3 inventory");
    }
  }
  const mediaTable = bundle.tables.find((table) => table.target === "public.media_objects");
  const mediaById = new Map((mediaTable?.rows || []).map((row) => [row.id, row]));
  const entryIds = new Set();
  for (const entry of plan.entries) {
    if (!entry.id || entryIds.has(entry.id)) throw new Error(`Duplicate or missing Storage plan id: ${entry.id || "unknown"}`);
    entryIds.add(entry.id);
    const media = mediaById.get(entry.id);
    if (!media) throw new Error(`Storage plan ${entry.id} has no matching public.media_objects row`);
    const mediaContract = {
      bucket: media.bucket_id,
      path: media.object_path,
      bytes: media.size_bytes,
      sha256: media.sha256,
      contentType: media.mime_type,
    };
    const storageContract = {
      bucket: entry.target?.bucket,
      path: entry.target?.path,
      bytes: entry.source?.bytes,
      sha256: entry.source?.sha256,
      contentType: entry.contentType,
    };
    if (stableStringify(mediaContract) !== stableStringify(storageContract)) {
      throw new Error(`Storage plan ${entry.id} disagrees with public.media_objects`);
    }
    if (entry.source?.type === "file") {
      const source = resolveInside(bundle.root, entry.source.path, `${entry.id} Storage source`);
      const stats = assertRegularFile(source, `${entry.id} Storage source`);
      if (stats.size !== entry.source.bytes || sha256File(source) !== entry.source.sha256) throw new Error(`${entry.id} Storage source checksum mismatch`);
    } else if (entry.source?.type !== "s3" || !entry.source.bucket || !entry.source.key || !/^[0-9a-f]{64}$/i.test(entry.source.sha256 || "")) {
      throw new Error(`Unsupported bundle Storage source for ${entry.id}`);
    }
  }
  for (const mediaId of mediaById.keys()) {
    if (!entryIds.has(mediaId)) throw new Error(`public.media_objects ${mediaId} is missing from Storage plan`);
  }
  return { bundle, plan };
}
