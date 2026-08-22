#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  BUNDLE_FORMAT_VERSION,
  assertNoNullBytes,
  assertRegularFile,
  createExclusiveDirectory,
  databaseStableStringify,
  isMain,
  normalizeDate,
  normalizeRelativePath,
  normalizeTimestamp,
  parseArgs,
  parseQualifiedName,
  readJson,
  readNdjson,
  requiredArg,
  resolveInside,
  sanitizeObjectSegment,
  sha256,
  sha256File,
  stableStringify,
  storageContractDataSha256,
  writeJsonExclusive,
  writeTextExclusive,
} from "./lib/common.mjs";
import {
  remediateLegacyProjectOwners,
  validateProjectOwnershipGraph,
} from "./lib/project-ownership.mjs";
import { creditTargetDefinitions, normalizeLegacyCredits } from "./lib/credit-normalization.mjs";
import {
  analyzeLegacyCollaborationGraph,
  collaborationQuarantineTargetDefinition,
  validateNormalizedCollaborationGraph,
} from "./lib/collaboration-remediation.mjs";
import {
  buildMissingProjectPrefixQuarantine,
  buildUnreferencedAvatarQuarantine,
  isProfileAvatarStorageKey,
  isReviewedMissingProjectStorageKey,
  legacyOrphanStorageTargetDefinition,
  validateLegacyOrphanStorageGraph,
  validateLegacyOrphanStorageRows,
} from "./lib/storage-quarantine.mjs";
import {
  LEGACY_ACTIVITY_UPDATED_AT_MARKER,
  validateActivityTimestampRemediation,
} from "./lib/activity-remediation.mjs";
import { validateCreditMaterializationAttestation } from "./materialize-legacy-credits.mjs";
import { validateSnapshotExport } from "./snapshot-sqlite.mjs";

const DEFAULT_MAPPING_PATH = new URL("./default-mapping.json", import.meta.url);
const REQUIRED_SOURCE_SCHEMA_VERSION = "18";
const REQUIRED_FULL_S3_SOURCE_BUCKET = "filmscript-production-mediabucket-xzgdb1rat94u";
const COLLABORATION_SOURCE_TABLES = new Set([
  "collaboration_documents", "collaboration_entities", "collaboration_operations", "content_conflicts",
]);

function columnType(sourceColumn, tableMapping, value, declaredType = "") {
  if (tableMapping.booleanColumns?.includes(sourceColumn)) return "boolean";
  if (tableMapping.dateColumns?.includes(sourceColumn)) return "date";
  if (tableMapping.timestampColumns?.includes(sourceColumn) || sourceColumn.endsWith("_at")) return "timestamptz";
  if (tableMapping.jsonColumns?.includes(sourceColumn) || sourceColumn.endsWith("_json")) return "jsonb";
  if (value?.$type === "blob" || /\bBLOB\b/i.test(declaredType)) return "bytea";
  if (value?.$type === "bigint") return "bigint";
  return "scalar";
}

function targetColumnName(sourceColumn, tableMapping) {
  if (tableMapping.columnRenames?.[sourceColumn]) return tableMapping.columnRenames[sourceColumn];
  return sourceColumn.endsWith("_json") ? sourceColumn.slice(0, -5) : sourceColumn;
}

function booleanValue(value, context) {
  if (typeof value === "boolean") return value;
  if (value === 0 || value === 0n || value === "0") return false;
  if (value === 1 || value === 1n || value === "1") return true;
  if (value?.$type === "bigint" && (value.value === "0" || value.value === "1")) return value.value === "1";
  throw new Error(`${context} must be SQLite boolean 0 or 1`);
}

function safeIntegerNumber(value, context) {
  const candidate = value?.$type === "bigint" ? BigInt(value.value) : BigInt(value);
  const number = Number(candidate);
  if (!Number.isSafeInteger(number)) throw new Error(`${context} is outside JavaScript's safe integer range`);
  return number;
}

function jsonValue(value, context) {
  if (value == null) return null;
  if (typeof value !== "string") {
    if (typeof value === "object" && value.$type) throw new Error(`${context} cannot decode ${value.$type} as JSON`);
    assertNoNullBytes(value, context);
    return value;
  }
  let parsed;
  try { parsed = JSON.parse(value); }
  catch (error) { throw new Error(`${context} contains invalid JSON: ${error.message}`); }
  if (parsed === null) throw new Error(`${context} contains JSON null, which requires an explicit migration decision`);
  assertNoNullBytes(parsed, context);
  return parsed;
}

function verifyAndCopyBlob(value, sourceRoot, bundleRoot, relativeDestination, context) {
  if (!value || value.$type !== "blob") throw new Error(`${context} is not a BLOB reference`);
  const source = resolveInside(sourceRoot, value.path, `${context} source`);
  const stats = assertRegularFile(source, `${context} source`);
  if (stats.size !== value.bytes || sha256File(source) !== value.sha256) throw new Error(`${context} source checksum mismatch`);
  const relative = normalizeRelativePath(relativeDestination, `${context} bundle path`);
  const destination = resolveInside(bundleRoot, relative, `${context} bundle path`);
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  if (fs.existsSync(destination)) {
    const destinationStats = assertRegularFile(destination, `${context} destination`);
    if (destinationStats.size !== value.bytes || sha256File(destination) !== value.sha256) {
      throw new Error(`${context} destination checksum mismatch`);
    }
  } else {
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(destination, 0o600);
  }
  return { $type: "blob", bytes: value.bytes, path: relative, sha256: value.sha256 };
}

function transformValue(value, type, { sourceRoot, bundleRoot, table, column }) {
  const context = `${table}.${column}`;
  if (value == null) return null;
  if (type === "jsonb") return jsonValue(value, context);
  if (type === "boolean") return booleanValue(value, context);
  if (type === "date") return normalizeDate(value, context);
  if (type === "timestamptz") return normalizeTimestamp(value, context);
  if (type === "bytea") {
    return verifyAndCopyBlob(value, sourceRoot, bundleRoot, path.posix.join("blobs", value.sha256.slice(0, 2), `${value.sha256}.bin`), context);
  }
  assertNoNullBytes(value, context);
  return value;
}

function transformStandardRow(row, sourceTable, sourceMetadata, tableMapping, sourceRoot, bundleRoot) {
  const transformed = {};
  const columnTypes = {};
  const omitted = new Set(tableMapping.omitColumns || []);
  for (const sourceColumnMetadata of sourceMetadata.columns) {
    const sourceColumn = sourceColumnMetadata.name;
    if (omitted.has(sourceColumn)) continue;
    const targetColumn = targetColumnName(sourceColumn, tableMapping);
    if (Object.hasOwn(transformed, targetColumn)) throw new Error(`${sourceTable} maps more than one value to ${targetColumn}`);
    const type = columnType(sourceColumn, tableMapping, row[sourceColumn], sourceColumnMetadata.type);
    transformed[targetColumn] = transformValue(row[sourceColumn], type, {
      sourceRoot, bundleRoot, table: sourceTable, column: sourceColumn,
    });
    columnTypes[targetColumn] = type;
  }
  const targetPrimaryKey = sourceMetadata.primaryKey.map((column) => targetColumnName(column, tableMapping));
  for (let index = 0; index < sourceMetadata.primaryKey.length; index += 1) {
    const sourceKey = sourceMetadata.primaryKey[index];
    const targetKey = targetPrimaryKey[index];
    if (stableStringify(row[sourceKey]) !== stableStringify(transformed[targetKey])) {
      throw new Error(`${sourceTable} primary key ${sourceKey} was not preserved`);
    }
  }
  return { row: transformed, columnTypes, targetPrimaryKey };
}

function transformAiJobRow(row, sourceMetadata, tableMapping, sourceRoot, bundleRoot) {
  let prepared = row;
  if (typeof row.output_json === "string") {
    let parsedOutput;
    try { parsedOutput = JSON.parse(row.output_json); }
    catch { parsedOutput = undefined; }
    if (parsedOutput === null) {
      const status = String(row.status || "").trim().toLowerCase();
      if (!new Set(["failed", "cancelled"]).has(status)) {
        throw new Error(`ai_jobs.${row.id || "unknown"}.output_json contains JSON null for non-failed status ${status || "missing"}`);
      }
      // Legacy updateAIJob serialized a JavaScript null to the JSON text
      // literal "null" on terminal failures. Postgres models the absence of
      // an output as SQL NULL. This one table/status-specific conversion must
      // never weaken the generic JSON-null gate for completed work.
      prepared = { ...row, output_json: null };
    }
  }
  const transformed = transformStandardRow(
    prepared, "ai_jobs", sourceMetadata, tableMapping, sourceRoot, bundleRoot,
  );
  for (const sourceColumn of ["status", "progress", "error_code"]) {
    const targetColumn = targetColumnName(sourceColumn, tableMapping);
    if (stableStringify(row[sourceColumn]) !== stableStringify(transformed.row[targetColumn])) {
      throw new Error(`ai_jobs.${row.id || "unknown"}.${sourceColumn} was not preserved`);
    }
  }
  return transformed;
}

function transformActivityEventRow(row, sourceMetadata, tableMapping, sourceRoot, bundleRoot) {
  const transformed = transformStandardRow(
    row, "activity_events", sourceMetadata, tableMapping, sourceRoot, bundleRoot,
  );
  const metadata = transformed.row.metadata == null ? {} : transformed.row.metadata;
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`activity_events.${row.id || "unknown"}.metadata_json must decode to an object`);
  }
  if (Object.hasOwn(metadata, LEGACY_ACTIVITY_UPDATED_AT_MARKER)) {
    throw new Error(`activity_events.${row.id || "unknown"}.metadata_json uses a reserved migration marker`);
  }
  if (row.updated_at == null) {
    if (!transformed.row.created_at) {
      throw new Error(`activity_events.${row.id || "unknown"} cannot infer updated_at without created_at`);
    }
    // Legacy migration 013 used this exact field-level fill. The copy-only
    // materializer restores the source NULL; the target is NOT NULL, so the
    // ETL applies only that reviewed rule and records its provenance.
    transformed.row.updated_at = transformed.row.created_at;
    transformed.row.metadata = {
      ...metadata,
      [LEGACY_ACTIVITY_UPDATED_AT_MARKER]: true,
    };
  }
  return transformed;
}

const PROJECT_NOTIFICATION_MODULES = new Set([
  "script", "analysis", "breakdown", "shot_list", "stripboard", "calendar", "budget",
  "canvas", "location_plan", "imagine", "files", "project_settings", "members",
  "shared_projects", "exports", "lumiere",
]);
const ACCOUNT_PROJECT_NOTIFICATION_TYPES = new Set([
  "project_invitation", "removed_from_project", "permission_changed", "ownership_transfer",
]);

function moduleFromDeepLink(value) {
  if (!value) return "";
  let view = "";
  try { view = new URL(String(value), "https://filmscript.local").searchParams.get("view") || ""; }
  catch { return ""; }
  const aliases = { editor: "script", shotlist: "shot_list", "shot-list": "shot_list", location: "location_plan" };
  const module = aliases[view] || view;
  return PROJECT_NOTIFICATION_MODULES.has(module) ? module : "";
}

function transformNotificationRow(row, sourceMetadata, tableMapping, sourceRoot, bundleRoot) {
  const transformed = transformStandardRow(row, "notifications", sourceMetadata, tableMapping, sourceRoot, bundleRoot);
  if (!transformed.row.project_id) return transformed;
  const metadata = transformed.row.metadata && typeof transformed.row.metadata === "object" && !Array.isArray(transformed.row.metadata)
    ? { ...transformed.row.metadata }
    : {};
  const declaredModule = String(metadata.module || metadata.access_module || "").trim().toLowerCase();
  let module = PROJECT_NOTIFICATION_MODULES.has(declaredModule) ? declaredModule : moduleFromDeepLink(transformed.row.deep_link);
  if (!module && ["message", "translation_completed", "translation_failed"].includes(String(transformed.row.type || ""))) module = "script";
  if (module) {
    metadata.module = module;
    transformed.row.metadata = metadata;
    if (module === "budget") transformed.row.contains_financial_data = true;
    return transformed;
  }
  if (ACCOUNT_PROJECT_NOTIFICATION_TYPES.has(String(transformed.row.type || ""))) {
    metadata.account_project_event = true;
    transformed.row.metadata = metadata;
    return transformed;
  }
  throw new Error(`notifications.${transformed.row.id || "unknown"} has project content without an authoritative module`);
}

function budgetReceiptRows(row, sourceMetadata, tableMapping, sourceRoot, bundleRoot, storageBucket) {
  const receiptId = String(row.id || "");
  const projectId = String(row.script_id || "");
  const ownerUserId = String(row.user_id || "");
  if (!receiptId || !projectId || !ownerUserId) throw new Error("budget_receipts row is missing its id, script_id, or user_id");
  const blob = row.data_blob;
  if (!blob || blob.$type !== "blob") throw new Error(`budget_receipts ${receiptId} has no data_blob BLOB`);
  const filename = sanitizeObjectSegment(row.filename, "receipt");
  const objectPath = normalizeRelativePath(path.posix.join("projects", projectId, "budget-receipts", receiptId, filename));
  const localPath = normalizeRelativePath(path.posix.join("storage", blob.sha256.slice(0, 2), `${blob.sha256}-${filename}`));
  const copiedBlob = verifyAndCopyBlob(blob, sourceRoot, bundleRoot, localPath, `budget_receipts.${receiptId}.data_blob`);
  const mediaObjectId = `med_${sha256(`budget-receipt:${receiptId}`).slice(0, 24)}`;
  const standard = transformStandardRow(row, "budget_receipts", sourceMetadata, {
    ...tableMapping,
    omitColumns: [...(tableMapping.omitColumns || []), "data_blob"],
  }, sourceRoot, bundleRoot);
  standard.row.media_object_id = mediaObjectId;
  standard.columnTypes.media_object_id = "scalar";
  standard.row.legacy_blob_sha256 = blob.sha256;
  standard.columnTypes.legacy_blob_sha256 = "scalar";
  const mediaRow = {
    id: mediaObjectId,
    project_id: projectId,
    owner_user_id: ownerUserId,
    bucket_id: storageBucket,
    object_path: objectPath,
    kind: "budget_receipt",
    original_filename: row.filename,
    mime_type: row.mime_type,
    size_bytes: safeIntegerNumber(row.size_bytes, `budget_receipts.${receiptId}.size_bytes`),
    sha256: blob.sha256,
    metadata: { legacy_table: "budget_receipts", legacy_id: receiptId },
    created_at: normalizeTimestamp(row.created_at, `budget_receipts.${receiptId}.created_at`),
    updated_at: normalizeTimestamp(row.created_at, `budget_receipts.${receiptId}.created_at`),
  };
  return {
    receipt: standard,
    media: {
      row: mediaRow,
      columnTypes: {
        id: "scalar", project_id: "scalar", owner_user_id: "scalar", bucket_id: "scalar",
        object_path: "scalar", kind: "scalar", original_filename: "scalar", mime_type: "scalar",
        size_bytes: "scalar", sha256: "scalar", metadata: "jsonb", created_at: "timestamptz", updated_at: "timestamptz",
      },
      targetPrimaryKey: ["id"],
    },
    storage: {
      id: mediaObjectId,
      source: { type: "file", path: copiedBlob.path, bytes: copiedBlob.bytes, sha256: copiedBlob.sha256 },
      target: { bucket: storageBucket, path: objectPath },
      contentType: row.mime_type,
      metadata: { projectId, ownerUserId, kind: "budget_receipt", originalFilename: row.filename },
    },
  };
}

function storedObjectKey(value) {
  if (!value) return "";
  if (typeof value === "object" && !Array.isArray(value)) return String(value.key || value.objectPath || "");
  if (typeof value !== "string") return "";
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? String(parsed.key || parsed.objectPath || "")
      : "";
  } catch {
    return value.includes("/") ? value : "";
  }
}

function canvasAssetIndexes(targets) {
  const byKey = new Map();
  const ambiguous = Symbol("ambiguous canvas asset ownership");
  const record = (asset, ownerUserId, projectId = null, fromOwnerLibrary = false) => {
    const key = storedObjectKey(asset);
    if (!key || !ownerUserId) return;
    const source = String(asset?.source || "").trim().toLowerCase();
    const accessModule = ["imagine", "imagine_reference"].includes(source) ? "imagine" : "canvas";
    if (byKey.get(key) === ambiguous) return;
    const existing = byKey.get(key);
    if (existing && (existing.ownerUserId !== ownerUserId || existing.accessModule !== accessModule)) {
      byKey.set(key, ambiguous);
      return;
    }
    if (!existing) {
      byKey.set(key, {
        ownerUserId,
        accessModule,
        projectIds: new Set(projectId ? [projectId] : []),
        fromOwnerLibrary,
      });
    } else if (projectId) {
      existing.projectIds.add(projectId);
    }
    if (fromOwnerLibrary && existing) existing.fromOwnerLibrary = true;
  };
  for (const row of targets.get("public.canvas_workspaces")?.rows || []) {
    for (const asset of Array.isArray(row.data?.assets) ? row.data.assets : []) record(asset, row.user_id, row.script_id);
  }
  for (const row of targets.get("public.canvas_libraries")?.rows || []) {
    for (const asset of Array.isArray(row.data?.assets) ? row.data.assets : []) record(asset, row.user_id, null, true);
  }
  return new Map([...byKey].map(([key, value]) => [key, value === ambiguous ? null : {
    ownerUserId: value.ownerUserId,
    accessModule: value.accessModule,
    projectIds: [...value.projectIds].sort(),
    fromOwnerLibrary: value.fromOwnerLibrary,
  }]));
}

function profileAvatarOwners(targets) {
  const owners = new Map();
  for (const row of targets.get("public.profiles")?.rows || []) {
    const key = storedObjectKey(row.avatar_key);
    if (!key) continue;
    const existing = owners.get(key);
    owners.set(key, existing && existing !== row.id ? null : row.id);
  }
  return owners;
}

function mediaRowForS3(entry, { scriptsById, profilesById, assetByKey, avatarOwnerByKey }, storageBucket) {
  if (entry.source?.type !== "s3" || !entry.source.bucket || !entry.source.key) throw new Error(`Invalid S3 inventory source for ${entry.id}`);
  if (!/^[0-9a-f]{64}$/i.test(entry.source.sha256 || "")) throw new Error(`S3 inventory entry ${entry.id} has no SHA-256`);
  const sourceKey = normalizeRelativePath(entry.source.key, `${entry.id} S3 key`);
  const segments = sourceKey.split("/");
  const namespaceIndex = segments.findIndex((segment) => segment === "canvas" || segment === "shot-references");
  if (namespaceIndex < 0 || !segments[namespaceIndex + 1]) throw new Error(`Cannot classify S3 key ${entry.source.key}`);
  const namespace = segments[namespaceIndex];
  const scopeId = segments[namespaceIndex + 1];
  const script = scriptsById.get(scopeId);
  const indexedAsset = assetByKey.get(sourceKey) || null;
  if (namespace === "canvas" && assetByKey.has(sourceKey) && !indexedAsset) {
    throw new Error(`S3 object ${entry.source.key} has ambiguous Canvas/Imagine ownership or module metadata`);
  }
  let projectId = script?.id || null;
  let ownerUserId = script?.user_id || indexedAsset?.ownerUserId || null;
  let kind = namespace === "shot-references" ? "shot_reference" : "canvas_asset";
  let accessModule = namespace === "shot-references" ? "shot_list" : indexedAsset?.accessModule || null;

  if (namespace === "shot-references" && !script) {
    throw new Error(`Shot reference ${entry.source.key} references unknown project ${scopeId}`);
  }
  if (namespace === "canvas" && script && indexedAsset && indexedAsset.ownerUserId !== script.user_id) {
    throw new Error(`S3 object ${entry.source.key} has Canvas references owned by someone other than its path project owner`);
  }
  const isCrossProjectOwnerLibraryAsset = namespace === "canvas"
    && script
    && indexedAsset?.projectIds?.length > 1
    && indexedAsset.fromOwnerLibrary;
  if (namespace === "canvas" && script && indexedAsset?.projectIds?.length > 1) {
    if (!indexedAsset.fromOwnerLibrary) {
      throw new Error(`S3 object ${entry.source.key} has cross-project references without an authoritative owner library`);
    }
    if (!indexedAsset.projectIds.includes(script.id)
      || indexedAsset.projectIds.some((projectRef) => !scriptsById.has(projectRef))) {
      throw new Error(`S3 object ${entry.source.key} has cross-project owner-library references outside the live project graph`);
    }
  }
  if (namespace === "canvas" && scopeId === "profiles") {
    projectId = null;
    ownerUserId = avatarOwnerByKey.get(sourceKey) || null;
    kind = "profile_avatar";
    accessModule = "profile";
    if (!ownerUserId) throw new Error(`Profile avatar ${entry.source.key} is not referenced by exactly one FilmScript profile`);
  } else if (namespace === "canvas" && !script) {
    const accountUserId = scopeId.startsWith("imaging_") ? scopeId.slice("imaging_".length) : "";
    if (accountUserId && profilesById.has(accountUserId)) {
      projectId = null;
      ownerUserId = accountUserId;
      kind = "imagine_asset";
      accessModule = "imagine";
    } else if (indexedAsset?.projectIds?.length === 0 && profilesById.has(indexedAsset.ownerUserId)) {
      projectId = null;
      ownerUserId = indexedAsset.ownerUserId;
      kind = indexedAsset.accessModule === "imagine" ? "imagine_asset" : "canvas_asset";
      accessModule = indexedAsset.accessModule;
    } else {
      throw new Error(`S3 object ${entry.source.key} does not map to a known project or account owner`);
    }
  }
  if (isCrossProjectOwnerLibraryAsset) {
    // The legacy owner library merged one asset into several projects. Retaining any
    // one project here would expose the object to that project's collaborators.
    projectId = null;
    ownerUserId = indexedAsset.ownerUserId;
    kind = indexedAsset.accessModule === "imagine" ? "imagine_asset" : "canvas_asset";
  }
  if (!ownerUserId || !profilesById.has(ownerUserId)) throw new Error(`S3 object ${entry.source.key} has no known FilmScript owner`);
  const targetPath = normalizeRelativePath(entry.target?.path || entry.source.key, `${entry.id} target path`);
  const mediaObjectId = `med_${sha256(`s3:${entry.source.bucket}:${entry.source.key}`).slice(0, 24)}`;
  const timestamp = entry.lastModified ? normalizeTimestamp(entry.lastModified, `${entry.id}.lastModified`) : "1970-01-01T00:00:00.000Z";
  const metadata = {
    legacy_s3_bucket: entry.source.bucket,
    legacy_s3_key: entry.source.key,
    ...(accessModule ? { access_module: accessModule } : {}),
    ...(indexedAsset?.projectIds?.length ? { legacy_reference_project_ids: indexedAsset.projectIds } : {}),
    ...(isCrossProjectOwnerLibraryAsset ? { legacy_access_scope: "owner_only_cross_project_library" } : {}),
  };
  return {
    transformed: {
      row: {
        id: mediaObjectId,
        project_id: projectId,
        owner_user_id: ownerUserId,
        bucket_id: storageBucket,
        object_path: targetPath,
        kind,
        original_filename: segments.at(-1),
        mime_type: entry.contentType || "application/octet-stream",
        size_bytes: entry.source.bytes,
        sha256: entry.source.sha256,
        metadata,
        created_at: timestamp,
        updated_at: timestamp,
      },
      columnTypes: {
        id: "scalar", project_id: "scalar", owner_user_id: "scalar", bucket_id: "scalar",
        object_path: "scalar", kind: "scalar", original_filename: "scalar", mime_type: "scalar",
        size_bytes: "scalar", sha256: "scalar", metadata: "jsonb", created_at: "timestamptz", updated_at: "timestamptz",
      },
      targetPrimaryKey: ["id"],
    },
    storage: {
      ...entry,
      id: mediaObjectId,
      target: { bucket: storageBucket, path: targetPath },
      metadata: {
        ...entry.metadata,
        projectId,
        ownerUserId,
        kind,
        ...(accessModule ? { accessModule } : {}),
        ...(indexedAsset?.projectIds?.length ? { legacyReferenceProjectIds: indexedAsset.projectIds } : {}),
        ...(isCrossProjectOwnerLibraryAsset ? { legacyAccessScope: "owner_only_cross_project_library" } : {}),
      },
    },
  };
}

function addTargetRow(targets, qualifiedTarget, order, transformed) {
  const target = targets.get(qualifiedTarget) || {
    target: qualifiedTarget,
    order,
    primaryKey: transformed.targetPrimaryKey,
    columnTypes: transformed.columnTypes,
    rows: [],
  };
  if (stableStringify(target.primaryKey) !== stableStringify(transformed.targetPrimaryKey)) {
    throw new Error(`Conflicting primary-key mappings for ${qualifiedTarget}`);
  }
  for (const [column, type] of Object.entries(transformed.columnTypes)) {
    if (target.columnTypes[column] && target.columnTypes[column] !== type) throw new Error(`Conflicting types for ${qualifiedTarget}.${column}`);
    target.columnTypes[column] = type;
  }
  target.rows.push(transformed.row);
  targets.set(qualifiedTarget, target);
}

function compareRowsByPrimaryKey(primaryKey) {
  return (left, right) => {
    for (const column of primaryKey) {
      const comparison = stableStringify(left[column]).localeCompare(stableStringify(right[column]));
      if (comparison) return comparison;
    }
    return stableStringify(left).localeCompare(stableStringify(right));
  };
}

function utcWeekKey(timestamp) {
  const value = new Date(normalizeTimestamp(timestamp, "SQLite snapshot capturedAt"));
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() - mondayOffset);
  return value.toISOString().slice(0, 10);
}

function providerCycleBounds(subscription) {
  const storedKey = String(subscription.billing_cycle_key || "").trim();
  const providerKey = storedKey.match(/^provider:(\d{10,16}):(\d{10,16})$/);
  if (/^\d{4}-\d{2}$/.test(storedKey)) return null;
  let start = providerKey ? Number(providerKey[1]) : Date.parse(String(subscription.current_period_start || ""));
  let end = providerKey ? Number(providerKey[2]) : Date.parse(String(subscription.current_period_end || ""));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

function assertCreditCaptureProviderCycles(subscriptions, creditCapturedAt, snapshotCapturedAt) {
  const creditTime = Date.parse(creditCapturedAt);
  const snapshotTime = Date.parse(snapshotCapturedAt);
  for (const subscription of subscriptions) {
    const bounds = providerCycleBounds(subscription);
    if (bounds && (creditTime < bounds.start || creditTime >= bounds.end
      || snapshotTime < bounds.start || snapshotTime >= bounds.end)) {
      throw new Error("Credit materialization and SQLite snapshot are not in the same active provider billing cycle");
    }
  }
}

export function transformBundle({
  exportDirectory,
  outputDirectory,
  mappingPath = DEFAULT_MAPPING_PATH,
  s3InventoryPath = null,
  allowPartialSchema = false,
}) {
  const sourceRoot = path.resolve(exportDirectory);
  validateSnapshotExport(sourceRoot);
  const sourceManifest = readJson(path.join(sourceRoot, "manifest.json"), "SQLite export manifest");
  const sourceCapturedAt = normalizeTimestamp(
    sourceManifest.source?.capturedAt || sourceManifest.generatedAt,
    "SQLite snapshot capturedAt",
  );
  let creditMaterializationBinding = null;
  let creditCapturedAt = sourceCapturedAt;
  if (sourceManifest.source?.creditMaterialization) {
    const attestationPath = resolveInside(
      sourceRoot,
      sourceManifest.source.creditMaterialization.file,
      "credit materialization attestation",
    );
    if (sha256File(attestationPath) !== sourceManifest.source.creditMaterialization.sha256) {
      throw new Error("SQLite export credit materialization attestation hash mismatch");
    }
    const attestation = readJson(attestationPath, "credit materialization attestation");
    validateCreditMaterializationAttestation(attestation);
    if (Date.parse(sourceCapturedAt) < Date.parse(attestation.clock.completedAt)) {
      throw new Error("SQLite snapshot predates completion of its credit materialization attestation");
    }
    if (sourceCapturedAt.slice(0, 7) !== attestation.clock.utcMonth
      || utcWeekKey(sourceCapturedAt) !== attestation.clock.utcWeek) {
      throw new Error("SQLite snapshot crossed a UTC credit boundary after materialization; rematerialize and recapture");
    }
    creditMaterializationBinding = {
      manifestSha256: sourceManifest.source.creditMaterialization.sha256,
      attestation,
    };
    creditCapturedAt = attestation.clock.capturedAt;
  }
  const mappingFilename = mappingPath instanceof URL ? mappingPath : path.resolve(mappingPath);
  const mapping = readJson(mappingFilename, "SQLite to Postgres mapping");
  if (mapping.format !== "filmscript-sqlite-postgres-mapping" || mapping.version !== 1) throw new Error("Unsupported mapping format");
  if (String(sourceManifest.schemaVersion || "") !== REQUIRED_SOURCE_SCHEMA_VERSION) {
    throw new Error(`Expected FilmScript SQLite schema ${REQUIRED_SOURCE_SCHEMA_VERSION}; received ${sourceManifest.schemaVersion ?? "unknown"}`);
  }
  const sourceNames = new Set(sourceManifest.tables.map((table) => table.name));
  const missingSources = Object.keys(mapping.tables || {}).filter((name) => !sourceNames.has(name));
  if (!allowPartialSchema && missingSources.length) {
    throw new Error(`SQLite snapshot is missing ${missingSources.length} required tables: ${missingSources.sort().join(", ")}`);
  }
  if (!allowPartialSchema && !s3InventoryPath) {
    throw new Error("Full production transform requires a complete --s3-inventory");
  }
  const collaborationRemediation = analyzeLegacyCollaborationGraph({ sourceRoot, sourceManifest });
  const bundleRoot = createExclusiveDirectory(outputDirectory);
  const targets = new Map();
  const skipped = [];
  const storage = [];
  const legacyOrphanStorageRows = [];
  const mappedSources = new Set();

  for (const sourceTable of sourceManifest.tables) {
    const tableMapping = mapping.tables?.[sourceTable.name];
    if (!tableMapping) throw new Error(`No Postgres mapping exists for SQLite table ${sourceTable.name}`);
    mappedSources.add(sourceTable.name);
    if (tableMapping.action === "skip") {
      skipped.push({ table: sourceTable.name, rowCount: sourceTable.rowCount, reason: tableMapping.reason || "Explicitly skipped" });
      continue;
    }
    if (!tableMapping.target) throw new Error(`Mapping for ${sourceTable.name} has no target`);
    parseQualifiedName(tableMapping.target);
    const rows = readNdjson(resolveInside(sourceRoot, sourceTable.dataFile, `${sourceTable.name} data`));
    for (const row of rows) {
      if (COLLABORATION_SOURCE_TABLES.has(sourceTable.name)
        && collaborationRemediation.quarantinedProjectIds.has(String(row.project_id || ""))) {
        continue;
      }
      if (tableMapping.special === "budgetReceiptStorage") {
        const transformed = budgetReceiptRows(row, sourceTable, tableMapping, sourceRoot, bundleRoot, mapping.storageBucket);
        addTargetRow(targets, tableMapping.target, tableMapping.order, transformed.receipt);
        addTargetRow(targets, "public.media_objects", tableMapping.order - 1, transformed.media);
        storage.push(transformed.storage);
      } else if (sourceTable.name === "notifications") {
        addTargetRow(targets, tableMapping.target, tableMapping.order, transformNotificationRow(
          row, sourceTable, tableMapping, sourceRoot, bundleRoot,
        ));
      } else if (sourceTable.name === "ai_jobs") {
        addTargetRow(targets, tableMapping.target, tableMapping.order, transformAiJobRow(
          row, sourceTable, tableMapping, sourceRoot, bundleRoot,
        ));
      } else if (sourceTable.name === "activity_events") {
        addTargetRow(targets, tableMapping.target, tableMapping.order, transformActivityEventRow(
          row, sourceTable, tableMapping, sourceRoot, bundleRoot,
        ));
      } else {
        addTargetRow(targets, tableMapping.target, tableMapping.order, transformStandardRow(
          row, sourceTable.name, sourceTable, tableMapping, sourceRoot, bundleRoot,
        ));
      }
    }
    if (!targets.has(tableMapping.target)) {
      const primaryKey = sourceTable.primaryKey.map((column) => targetColumnName(column, tableMapping));
      const omittedColumns = new Set([
        ...(tableMapping.omitColumns || []),
        ...(tableMapping.special === "budgetReceiptStorage" ? ["data_blob"] : []),
      ]);
      const columnTypes = Object.fromEntries(sourceTable.columns
        .filter((column) => !omittedColumns.has(column.name))
        .map((column) => [targetColumnName(column.name, tableMapping), columnType(column.name, tableMapping, null, column.type)]));
      if (tableMapping.special === "budgetReceiptStorage") {
        columnTypes.media_object_id = "scalar";
        columnTypes.legacy_blob_sha256 = "scalar";
      }
      targets.set(tableMapping.target, { target: tableMapping.target, order: tableMapping.order, primaryKey, columnTypes, rows: [] });
    }
  }

  for (const name of Object.keys(mapping.tables || {})) {
    if (!mappedSources.has(name)) skipped.push({ table: name, rowCount: 0, reason: "Table was not present in this SQLite snapshot" });
  }

  const activityTimestampRemediation = validateActivityTimestampRemediation(
    targets.get("public.activity_events")?.rows || [],
  );

  const quarantineDefinition = collaborationQuarantineTargetDefinition(
    collaborationRemediation.quarantineRows.map((row) => {
      if (!row.blob_payload) return row;
      return {
        ...row,
        blob_payload: verifyAndCopyBlob(
          row.payload[row.blob_column],
          sourceRoot,
          bundleRoot,
          row.blob_payload.path,
          `private.legacy_orphan_records.${row.id}.blob_payload`,
        ),
      };
    }),
  );
  if (targets.has(quarantineDefinition.target)) {
    throw new Error(`Collaboration quarantine target ${quarantineDefinition.target} already exists`);
  }
  targets.set(quarantineDefinition.target, quarantineDefinition);

  const collaborationDocuments = targets.get("public.collaboration_documents");
  if (!collaborationDocuments && collaborationRemediation.syntheticParents.length) {
    throw new Error("Cannot create deterministic collaboration parents because collaboration_documents is absent from the source mapping");
  }
  if (collaborationDocuments) {
    collaborationDocuments.columnTypes.legacy_synthetic_parent = "boolean";
    for (const row of collaborationDocuments.rows) row.legacy_synthetic_parent = false;
    if (collaborationRemediation.syntheticParents.length) {
      const emptySnapshot = Buffer.alloc(0);
      const emptySnapshotSha256 = sha256(emptySnapshot);
      const relativeSnapshotPath = normalizeRelativePath(path.posix.join(
        "blobs", "collaboration", `${emptySnapshotSha256}.bin`,
      ));
      writeTextExclusive(resolveInside(bundleRoot, relativeSnapshotPath), "");
      const version = collaborationDocuments.columnTypes.version === "bigint"
        ? { $type: "bigint", value: "0" }
        : 0;
      for (const parent of collaborationRemediation.syntheticParents) {
        collaborationDocuments.rows.push({
          project_id: parent.projectId,
          document_id: parent.documentId,
          module: parent.module,
          snapshot: {
            $type: "blob",
            bytes: 0,
            path: relativeSnapshotPath,
            sha256: emptySnapshotSha256,
          },
          version,
          updated_at: parent.updatedAt,
          legacy_synthetic_parent: true,
        });
      }
    }
  }
  const normalizedCollaboration = validateNormalizedCollaborationGraph({
    tables: [...targets.values()],
    capturedAt: sourceCapturedAt,
  });
  if (stableStringify(normalizedCollaboration) !== stableStringify(collaborationRemediation.summary)) {
    throw new Error("Deterministic collaboration-parent remediation does not match the legacy collaboration graph");
  }

  const normalizedCredits = normalizeLegacyCredits({
    appSettings: targets.get("private.app_settings")?.rows || [],
    profiles: targets.get("public.profiles")?.rows || [],
    subscriptions: targets.get("billing.subscriptions")?.rows || [],
    aiJobs: targets.get("public.ai_jobs")?.rows || [],
    capturedAt: creditCapturedAt,
    enforceBilling: !allowPartialSchema,
  });
  const activePaidSubscriptions = (targets.get("billing.subscriptions")?.rows || []).filter((row) => {
    const status = String(row.status || "").trim().toLowerCase();
    const plan = String(row.plan || "").trim().toLowerCase();
    return status === "active" && ["basic", "creator", "full", "lumiere"].includes(plan);
  });
  if (creditMaterializationBinding) {
    assertCreditCaptureProviderCycles(activePaidSubscriptions, creditCapturedAt, sourceCapturedAt);
  }
  if (!allowPartialSchema && activePaidSubscriptions.length) {
    if (!creditMaterializationBinding) {
      throw new Error("Active paid subscriptions require a bound credit materialization attestation");
    }
    if (creditMaterializationBinding.attestation.verification.activePaidSubscriptionCount
      !== activePaidSubscriptions.length) {
      throw new Error("Credit materialization attestation paid-account count disagrees with the source snapshot");
    }
  }
  for (const definition of creditTargetDefinitions()) {
    if (targets.has(definition.target)) throw new Error(`Credit normalization target ${definition.target} already exists`);
    targets.set(definition.target, {
      ...definition,
      rows: normalizedCredits.rowsByTarget.get(definition.target) || [],
    });
  }

  let projectOwnership;
  if (allowPartialSchema) {
    projectOwnership = { status: "not_enforced_partial_schema" };
  } else {
    const scripts = targets.get("public.scripts")?.rows;
    const membershipTarget = targets.get("public.project_memberships");
    if (!membershipTarget) throw new Error("Full project ownership remediation requires public.project_memberships");
    const ownerRemediation = remediateLegacyProjectOwners({
      scripts,
      memberships: membershipTarget.rows,
      versionType: membershipTarget.columnTypes.version,
    });
    membershipTarget.rows.push(...ownerRemediation.syntheticRows);
    projectOwnership = {
      status: "verified",
      ...validateProjectOwnershipGraph({ scripts, memberships: membershipTarget.rows }),
      legacyOwnerRemediation: ownerRemediation.summary,
    };
  }

  let s3InventoryProvenance = null;
  if (s3InventoryPath) {
    const inventory = readJson(path.resolve(s3InventoryPath), "S3 inventory");
    if (inventory.format !== "filmscript-s3-inventory" || inventory.formatVersion !== 1) throw new Error("Unsupported S3 inventory format");
    if (inventory.entries.length !== inventory.objectCount) throw new Error("S3 inventory object count mismatch");
    if (!allowPartialSchema) {
      if (inventory.bucket !== REQUIRED_FULL_S3_SOURCE_BUCKET) {
        throw new Error(`Full production transform requires S3 inventory bucket ${REQUIRED_FULL_S3_SOURCE_BUCKET}`);
      }
      if (inventory.prefix !== "") throw new Error("Full production transform requires an unprefixed whole-bucket S3 inventory");
    }
    const inventoryBytes = inventory.entries.reduce((sum, entry) => {
      if (!Number.isSafeInteger(entry.source?.bytes) || entry.source.bytes < 0) throw new Error(`Invalid S3 byte count for ${entry.id}`);
      if (inventory.bucket && entry.source?.bucket !== inventory.bucket) {
        throw new Error(`S3 inventory entry ${entry.id} does not belong to its declared source bucket`);
      }
      return sum + entry.source.bytes;
    }, 0);
    if (inventoryBytes !== inventory.totalBytes) throw new Error("S3 inventory byte count mismatch");
    const inventorySha256 = sha256(stableStringify(inventory.entries.map((entry) => ({
      key: entry.source.key, bytes: entry.source.bytes, sha256: entry.source.sha256,
    }))));
    if (inventorySha256 !== inventory.dataSha256) throw new Error("S3 inventory checksum mismatch");
    s3InventoryProvenance = {
      bucket: inventory.bucket || null,
      prefix: inventory.prefix ?? null,
      objectCount: inventory.objectCount,
      totalBytes: inventory.totalBytes,
      dataSha256: inventory.dataSha256,
    };
    const scriptsById = new Map((targets.get("public.scripts")?.rows || []).map((row) => [row.id, row]));
    const profilesById = new Map((targets.get("public.profiles")?.rows || []).map((row) => [row.id, row]));
    const assetByKey = canvasAssetIndexes(targets);
    const avatarOwnerByKey = profileAvatarOwners(targets);
    const orphanProfileAvatars = inventory.entries.filter((entry) => {
      const sourceKey = normalizeRelativePath(entry.source?.key, `${entry.id} S3 key`);
      return isProfileAvatarStorageKey(sourceKey) && !avatarOwnerByKey.has(sourceKey);
    });
    const orphanAvatarGroups = new Map();
    for (const entry of orphanProfileAvatars) {
      const fingerprint = `${entry.source?.bytes}:${String(entry.source?.sha256 || "").toLowerCase()}`;
      const group = orphanAvatarGroups.get(fingerprint) || [];
      group.push(entry);
      orphanAvatarGroups.set(fingerprint, group);
    }
    const duplicateForOrphanAvatar = new Map();
    for (const group of orphanAvatarGroups.values()) {
      group.sort((left, right) => String(left.source.key).localeCompare(String(right.source.key)));
      if (group.length < 2) {
        throw new Error(`Unreferenced profile avatar ${group[0].source.key} has no byte-identical orphan duplicate approved for quarantine`);
      }
      for (const [index, entry] of group.entries()) {
        duplicateForOrphanAvatar.set(entry, index === 0 ? group[1] : group[0]);
      }
    }
    for (const entry of inventory.entries) {
      if (duplicateForOrphanAvatar.has(entry)) {
        const quarantined = buildUnreferencedAvatarQuarantine({
          entry,
          duplicateEntry: duplicateForOrphanAvatar.get(entry),
          targetBucket: mapping.storageBucket,
          importedAt: sourceCapturedAt,
        });
        legacyOrphanStorageRows.push(quarantined.row);
        storage.push(quarantined.storage);
        continue;
      }
      if (isReviewedMissingProjectStorageKey(entry.source?.key)) {
        const quarantined = buildMissingProjectPrefixQuarantine({
          entry,
          targetBucket: mapping.storageBucket,
          importedAt: sourceCapturedAt,
        });
        legacyOrphanStorageRows.push(quarantined.row);
        storage.push(quarantined.storage);
        continue;
      }
      const media = mediaRowForS3(entry, { scriptsById, profilesById, assetByKey, avatarOwnerByKey }, mapping.storageBucket);
      addTargetRow(targets, "public.media_objects", 70, media.transformed);
      storage.push(media.storage);
    }
  }

  const legacyOrphanStorageDefinition = legacyOrphanStorageTargetDefinition(legacyOrphanStorageRows);
  if (targets.has(legacyOrphanStorageDefinition.target)) {
    throw new Error(`Legacy orphan Storage target ${legacyOrphanStorageDefinition.target} already exists`);
  }
  targets.set(legacyOrphanStorageDefinition.target, legacyOrphanStorageDefinition);
  const legacyOrphanStorage = {
    ...validateLegacyOrphanStorageRows(legacyOrphanStorageRows),
    graph: validateLegacyOrphanStorageGraph(legacyOrphanStorageRows, [...targets.values()]),
  };

  const tableManifest = [];
  for (const target of [...targets.values()].sort((left, right) => left.order - right.order || left.target.localeCompare(right.target))) {
    target.rows.sort(compareRowsByPrimaryKey(target.primaryKey));
    const { schema, table } = parseQualifiedName(target.target);
    const relativeDataFile = normalizeRelativePath(path.posix.join("tables", schema, `${sanitizeObjectSegment(table, "table")}.ndjson`));
    const contents = target.rows.map((row) => stableStringify(row)).join("\n");
    writeTextExclusive(resolveInside(bundleRoot, relativeDataFile), contents ? `${contents}\n` : "");
    const columns = Object.keys(target.columnTypes).sort();
    tableManifest.push({
      target: target.target,
      order: target.order,
      dataFile: relativeDataFile,
      primaryKey: target.primaryKey,
      columns,
      columnTypes: Object.fromEntries(columns.map((column) => [column, target.columnTypes[column]])),
      rowCount: target.rows.length,
      rowSha256: sha256(target.rows.map((row) => `${stableStringify(row)}\n`).join("")),
      databaseRowSha256: sha256(target.rows.map((row) => `${databaseStableStringify(row)}\n`).join("")),
    });
  }
  storage.sort((left, right) => left.id.localeCompare(right.id));
  const ownerOnlyUnclassifiedCount = storage.filter(
    (entry) => entry.metadata?.kind === "canvas_asset" && !entry.metadata?.accessModule,
  ).length;
  const ownerOnlyCrossProjectLibraryEntries = storage.filter(
    (entry) => entry.metadata?.legacyAccessScope === "owner_only_cross_project_library",
  );
  const ownerOnlyCrossProjectLibrary = {
    count: ownerOnlyCrossProjectLibraryEntries.length,
    canvasCount: ownerOnlyCrossProjectLibraryEntries.filter((entry) => entry.metadata?.kind === "canvas_asset").length,
    imagineCount: ownerOnlyCrossProjectLibraryEntries.filter((entry) => entry.metadata?.kind === "imagine_asset").length,
  };
  if (!allowPartialSchema && ownerOnlyUnclassifiedCount) {
    throw new Error(`Storage classification requires remediation: ${ownerOnlyUnclassifiedCount} Canvas object(s) have no authoritative Canvas/Imagine module`);
  }
  const storageFile = "storage-plan.json";
  const storageDataSha256 = sha256(stableStringify(storage));
  const storageContractSha256 = storageContractDataSha256(storage);
  writeJsonExclusive(path.join(bundleRoot, storageFile), {
    format: "filmscript-storage-plan",
    formatVersion: 1,
    validationMode: allowPartialSchema ? "partial" : "full",
    dataSha256: storageDataSha256,
    contractSha256: storageContractSha256,
    entries: storage,
  });
  const manifest = {
    format: "filmscript-postgres-bundle",
    formatVersion: BUNDLE_FORMAT_VERSION,
    validationMode: allowPartialSchema ? "partial" : "full",
    projectOwnership,
    generatedAt: new Date().toISOString(),
    source: {
      schemaVersion: sourceManifest.schemaVersion,
      generatedAt: sourceManifest.generatedAt,
      capturedAt: sourceCapturedAt,
      dataSha256: sourceManifest.dataSha256,
      snapshotSha256: sourceManifest.snapshot.sha256,
      creditMaterialization: creditMaterializationBinding,
      s3Inventory: s3InventoryProvenance,
    },
    collaborationRemediation: collaborationRemediation.summary,
    activityTimestampRemediation,
    creditNormalization: normalizedCredits.summary,
    mappingSha256: sha256File(mappingFilename),
    dataSha256: sha256(stableStringify(tableManifest.map(({ target, rowCount, rowSha256 }) => ({ target, rowCount, rowSha256 })))),
    databaseDataSha256: sha256(stableStringify(tableManifest.map(({ target, rowCount, databaseRowSha256 }) => ({ target, rowCount, databaseRowSha256 })))),
    tables: tableManifest,
    skipped,
    storage: {
      file: storageFile,
      entryCount: storage.length,
      dataSha256: storageDataSha256,
      contractSha256: storageContractSha256,
      classifiedAccessCount: storage.filter((entry) => entry.metadata?.accessModule || entry.metadata?.kind === "budget_receipt").length,
      ownerOnlyUnclassifiedCount,
      ownerOnlyCrossProjectLibrary,
      legacyOrphanStorage,
    },
  };
  writeJsonExclusive(path.join(bundleRoot, "manifest.json"), manifest);
  return manifest;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = transformBundle({
    exportDirectory: requiredArg(args, "export"),
    outputDirectory: requiredArg(args, "output"),
    mappingPath: args.mapping || DEFAULT_MAPPING_PATH,
    s3InventoryPath: typeof args["s3-inventory"] === "string" ? args["s3-inventory"] : null,
  });
  process.stdout.write(`${JSON.stringify({ ok: true, dataSha256: manifest.dataSha256, tables: manifest.tables.length, storageObjects: manifest.storage.entryCount, skipped: manifest.skipped }, null, 2)}\n`);
}

if (isMain(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Transform failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
