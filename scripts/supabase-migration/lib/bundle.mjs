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
import {
  validateProjectOwnershipGraph,
  validateProjectOwnershipRemediation,
} from "./project-ownership.mjs";
import { validateNormalizedCreditGraph } from "./credit-normalization.mjs";
import { validateNormalizedCollaborationGraph } from "./collaboration-remediation.mjs";
import { validateCreditMaterializationAttestation } from "../materialize-legacy-credits.mjs";
import {
  LEGACY_ORPHAN_STORAGE_TARGET,
  validateLegacyOrphanStorageGraph,
  validateLegacyOrphanStoragePlanEntry,
  validateLegacyOrphanStorageRows,
} from "./storage-quarantine.mjs";
import { validateActivityTimestampRemediation } from "./activity-remediation.mjs";

const REQUIRED_FULL_S3_SOURCE_BUCKET = "filmscript-production-mediabucket-xzgdb1rat94u";

function providerCycleBounds(subscription) {
  const storedKey = String(subscription.billing_cycle_key || "").trim();
  const providerKey = storedKey.match(/^provider:(\d{10,16}):(\d{10,16})$/);
  if (/^\d{4}-\d{2}$/.test(storedKey)) return null;
  const start = providerKey ? Number(providerKey[1]) : Date.parse(String(subscription.current_period_start || ""));
  const end = providerKey ? Number(providerKey[2]) : Date.parse(String(subscription.current_period_end || ""));
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

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
  const materializationBinding = manifest.source?.creditMaterialization;
  const sourceCapturedAt = normalizeTimestamp(
    manifest.source?.capturedAt || manifest.source?.generatedAt,
    "bundle source capturedAt",
  );
  let creditCapturedAt = sourceCapturedAt;
  if (materializationBinding) {
    if (!/^[0-9a-f]{64}$/.test(materializationBinding.manifestSha256 || "")) {
      throw new Error("Postgres bundle credit materialization manifest hash is invalid");
    }
    validateCreditMaterializationAttestation(materializationBinding.attestation);
    if (Date.parse(sourceCapturedAt) < Date.parse(materializationBinding.attestation.clock.completedAt)) {
      throw new Error("Bundle snapshot predates completion of credit materialization");
    }
    const sourceDate = new Date(sourceCapturedAt);
    const mondayOffset = (sourceDate.getUTCDay() + 6) % 7;
    sourceDate.setUTCHours(0, 0, 0, 0);
    sourceDate.setUTCDate(sourceDate.getUTCDate() - mondayOffset);
    if (sourceCapturedAt.slice(0, 7) !== materializationBinding.attestation.clock.utcMonth
      || sourceDate.toISOString().slice(0, 10) !== materializationBinding.attestation.clock.utcWeek) {
      throw new Error("Bundle snapshot crossed a UTC credit boundary after materialization");
    }
    creditCapturedAt = materializationBinding.attestation.clock.capturedAt;
  }
  const hasCreditContract = manifest.creditNormalization != null
    || tables.some((table) => table.target === "private.app_settings" || table.target === "private.credit_accounts");
  if (hasCreditContract) {
    if (!manifest.creditNormalization || !manifest.source?.generatedAt) {
      throw new Error("Postgres bundle with legacy or normalized credits is missing its normalization contract");
    }
    const creditNormalization = validateNormalizedCreditGraph({
      tables,
      capturedAt: creditCapturedAt,
      enforceBilling: manifest.validationMode === "full",
    });
    if (stableStringify(manifest.creditNormalization) !== stableStringify(creditNormalization)) {
      throw new Error("Postgres bundle credit-normalization summary does not match its rows");
    }
  }
  const activityEventsTable = tables.find((table) => table.target === "public.activity_events");
  if (activityEventsTable || manifest.activityTimestampRemediation) {
    if (!manifest.activityTimestampRemediation) {
      throw new Error("Postgres bundle is missing its legacy activity timestamp-remediation contract");
    }
    const activityTimestampRemediation = validateActivityTimestampRemediation(activityEventsTable?.rows || []);
    if (stableStringify(manifest.activityTimestampRemediation)
      !== stableStringify(activityTimestampRemediation)) {
      throw new Error("Postgres bundle activity timestamp-remediation summary does not match its rows");
    }
  }
  if (manifest.validationMode === "full") {
    const subscriptions = tables.find((table) => table.target === "billing.subscriptions")?.rows || [];
    const activePaidSubscriptionCount = subscriptions.filter((row) => {
      const status = String(row.status || "").trim().toLowerCase();
      const plan = String(row.plan || "").trim().toLowerCase();
      return status === "active" && ["basic", "creator", "full", "lumiere"].includes(plan);
    }).length;
    if (activePaidSubscriptionCount && !materializationBinding) {
      throw new Error("Full bundle with active paid subscriptions has no bound credit materialization attestation");
    }
    if (materializationBinding
      && materializationBinding.attestation.verification.activePaidSubscriptionCount
        !== activePaidSubscriptionCount) {
      throw new Error("Full bundle paid subscriptions disagree with the credit materialization attestation");
    }
    if (materializationBinding) {
      const creditTime = Date.parse(creditCapturedAt);
      const snapshotTime = Date.parse(sourceCapturedAt);
      for (const subscription of subscriptions.filter((row) => {
        const status = String(row.status || "").trim().toLowerCase();
        const plan = String(row.plan || "").trim().toLowerCase();
        return status === "active" && ["basic", "creator", "full", "lumiere"].includes(plan);
      })) {
        const bounds = providerCycleBounds(subscription);
        if (bounds && (creditTime < bounds.start || creditTime >= bounds.end
          || snapshotTime < bounds.start || snapshotTime >= bounds.end)) {
          throw new Error("Bundle credit materialization and snapshot are not in the same provider billing cycle");
        }
      }
    }
  }
  const hasCollaborationContract = manifest.collaborationRemediation != null
    || tables.some((table) => table.target === "public.collaboration_documents"
      && table.columns?.includes("legacy_synthetic_parent"));
  if (hasCollaborationContract) {
    if (!manifest.collaborationRemediation) {
      throw new Error("Postgres bundle with remediated collaboration parents is missing its remediation contract");
    }
    const collaborationRemediation = validateNormalizedCollaborationGraph({
      tables,
      capturedAt: manifest.source?.capturedAt || manifest.source?.generatedAt,
    });
    if (stableStringify(manifest.collaborationRemediation) !== stableStringify(collaborationRemediation)) {
      throw new Error("Postgres bundle collaboration-remediation summary does not match its rows");
    }
  }
  if (manifest.validationMode === "full") {
    const scriptsTable = tables.find((table) => table.target === "public.scripts");
    const membershipsTable = tables.find((table) => table.target === "public.project_memberships");
    const ownership = validateProjectOwnershipGraph({
      scripts: scriptsTable?.rows,
      memberships: membershipsTable?.rows,
    });
    const legacyOwnerRemediation = validateProjectOwnershipRemediation({
      scripts: scriptsTable?.rows,
      memberships: membershipsTable?.rows,
      versionType: membershipsTable?.columnTypes.version,
    });
    const expectedOwnership = { status: "verified", ...ownership, legacyOwnerRemediation };
    if (stableStringify(manifest.projectOwnership) !== stableStringify(expectedOwnership)) {
      throw new Error("Postgres bundle ownership validation summary does not match its rows");
    }
  }
  const legacyOrphanStorageTable = tables.find((table) => table.target === LEGACY_ORPHAN_STORAGE_TARGET);
  if (legacyOrphanStorageTable || manifest.storage?.legacyOrphanStorage) {
    if (!legacyOrphanStorageTable || !manifest.storage?.legacyOrphanStorage) {
      throw new Error("Postgres bundle is missing its legacy orphan Storage quarantine contract");
    }
    const legacyOrphanStorage = {
      ...validateLegacyOrphanStorageRows(legacyOrphanStorageTable.rows),
      graph: validateLegacyOrphanStorageGraph(legacyOrphanStorageTable.rows, tables),
    };
    if (stableStringify(legacyOrphanStorage) !== stableStringify(manifest.storage.legacyOrphanStorage)) {
      throw new Error("Postgres bundle legacy orphan Storage summary does not match its rows");
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
  const ownerOnlyCrossProjectLibraryEntries = plan.entries.filter(
    (entry) => entry.metadata?.legacyAccessScope === "owner_only_cross_project_library",
  );
  const ownerOnlyCrossProjectLibrary = {
    count: ownerOnlyCrossProjectLibraryEntries.length,
    canvasCount: ownerOnlyCrossProjectLibraryEntries.filter((entry) => entry.metadata?.kind === "canvas_asset").length,
    imagineCount: ownerOnlyCrossProjectLibraryEntries.filter((entry) => entry.metadata?.kind === "imagine_asset").length,
  };
  if (stableStringify(ownerOnlyCrossProjectLibrary)
    !== stableStringify(bundle.manifest.storage.ownerOnlyCrossProjectLibrary)) {
    throw new Error("Storage plan owner-only cross-project library summary does not match its entries");
  }
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
  const quarantineTable = bundle.tables.find((table) => table.target === LEGACY_ORPHAN_STORAGE_TARGET);
  const quarantineById = new Map((quarantineTable?.rows || []).map((row) => [row.id, row]));
  const entryIds = new Set();
  for (const entry of plan.entries) {
    if (!entry.id || entryIds.has(entry.id)) throw new Error(`Duplicate or missing Storage plan id: ${entry.id || "unknown"}`);
    entryIds.add(entry.id);
    const media = mediaById.get(entry.id);
    const quarantine = quarantineById.get(entry.id);
    if (media && quarantine) throw new Error(`Storage plan ${entry.id} has conflicting live and quarantine metadata`);
    if (!media && !quarantine) {
      throw new Error(`Storage plan ${entry.id} has no matching public.media_objects or private.legacy_orphan_storage row`);
    }
    if (media) {
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
    } else {
      validateLegacyOrphanStoragePlanEntry(quarantine, entry);
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
  for (const quarantineId of quarantineById.keys()) {
    if (!entryIds.has(quarantineId)) throw new Error(`private.legacy_orphan_storage ${quarantineId} is missing from Storage plan`);
  }
  return { bundle, plan };
}
