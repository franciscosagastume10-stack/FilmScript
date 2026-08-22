import { normalizeRelativePath, normalizeTimestamp, sha256, stableStringify } from "./common.mjs";

export const LEGACY_ORPHAN_STORAGE_TARGET = "private.legacy_orphan_storage";
export const UNREFERENCED_AVATAR_REASON = "unreferenced_byte_duplicate_avatar";
export const UNREFERENCED_MISSING_PROJECT_REASON = "unreferenced_missing_project_prefix";
const PROFILE_AVATAR_KEY = /^filmscript\/canvas\/profiles\/avatar_[A-Za-z0-9._-]+$/;
const REVIEWED_SOURCE_BUCKET = "filmscript-production-mediabucket-xzgdb1rat94u";
const REVIEWED_AVATAR_SHA256 = "44ed0e9bd1bd7a518f4db1523266a5d647cfc7d6dc3a5e6729dea29c7a75e10b";
const REVIEWED_AVATAR_BYTES = 29_218;
const REVIEWED_AVATAR_KEYS = Object.freeze([
  "filmscript/canvas/profiles/avatar_4cd220be9504b805.webp",
  "filmscript/canvas/profiles/avatar_68db05ce1a0181a2.webp",
]);
const REVIEWED_AVATAR_KEY_SET = new Set(REVIEWED_AVATAR_KEYS);
const REVIEWED_MISSING_PROJECT_ID = "scr_c38477536398e2486704";
const REVIEWED_MISSING_PROJECT_PREFIX = `filmscript/canvas/${REVIEWED_MISSING_PROJECT_ID}/`;
const REVIEWED_MISSING_PROJECT_COUNT = 95;
const REVIEWED_MISSING_PROJECT_BYTES = 29_302_421;
const REVIEWED_MISSING_PROJECT_DATA_SHA256 = "d68625311de1ab5b439b426dc97136bda8d21e690fd6b9e21c038477dfc47167";
const REVIEWED_MISSING_SHOT_KEY = `filmscript/shot-references/${REVIEWED_MISSING_PROJECT_ID}/ref_2b308c5391fd5222172590d3.png`;
const REVIEWED_MISSING_SHOT_BYTES = 1_840_035;
const REVIEWED_MISSING_SHOT_SHA256 = "808f180ed6ec93d5f8e6c05baaedf1cb7f19465875ae1f0ab6e3d240a30c0ae3";
const REVIEWED_MISSING_SHOT_DATA_SHA256 = "481d2fa274c6b5e5d1ff7bbafa6bb9b15a4fe83a7dac170a982375c6ae2aee8e";
const REVIEWED_MISSING_PROJECT_EARLIEST = "2026-07-28T00:00:00.000Z";
const REVIEWED_MISSING_PROJECT_LATEST_EXCLUSIVE = "2026-08-01T00:00:00.000Z";

function nonblank(value, context) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${context} must be a non-empty string`);
  return text;
}

function normalizedSourceKey(entry) {
  return normalizeRelativePath(entry?.source?.key, `${entry?.id || "S3 entry"} source key`);
}

function quarantineId(sourceBucket, sourceKey) {
  return `los_${sha256(`legacy-orphan-storage:${sourceBucket}:${sourceKey}`).slice(0, 24)}`;
}

function quarantineTargetPath(id, sourceKey) {
  return normalizeRelativePath(`migration-quarantine/${id}/${sourceKey.split("/").at(-1)}`, `${id} quarantine path`);
}

export function isProfileAvatarStorageKey(value) {
  return PROFILE_AVATAR_KEY.test(String(value || ""));
}

export function isReviewedMissingProjectStorageKey(value) {
  const key = String(value || "");
  return key.startsWith(REVIEWED_MISSING_PROJECT_PREFIX) || key === REVIEWED_MISSING_SHOT_KEY;
}

export function reviewedMissingProjectId() {
  return REVIEWED_MISSING_PROJECT_ID;
}

export function buildUnreferencedAvatarQuarantine({ entry, duplicateEntry, targetBucket, importedAt }) {
  if (entry?.source?.type !== "s3" || duplicateEntry?.source?.type !== "s3") {
    throw new Error("Unreferenced avatar quarantine requires two S3 inventory entries");
  }
  const sourceBucket = nonblank(entry.source.bucket, `${entry.id}.source.bucket`);
  const sourceKey = normalizedSourceKey(entry);
  const duplicateSourceKey = normalizedSourceKey(duplicateEntry);
  if (!isProfileAvatarStorageKey(sourceKey) || !isProfileAvatarStorageKey(duplicateSourceKey)) {
    throw new Error(`Storage quarantine is not approved for ${sourceKey}`);
  }
  if (!REVIEWED_AVATAR_KEY_SET.has(sourceKey)
    || !REVIEWED_AVATAR_KEY_SET.has(duplicateSourceKey)
    || sourceKey === duplicateSourceKey
    || entry.source.bytes !== REVIEWED_AVATAR_BYTES
    || duplicateEntry.source.bytes !== REVIEWED_AVATAR_BYTES
    || String(entry.source.sha256 || "").toLowerCase() !== REVIEWED_AVATAR_SHA256
    || String(duplicateEntry.source.sha256 || "").toLowerCase() !== REVIEWED_AVATAR_SHA256
    || sourceBucket !== REVIEWED_SOURCE_BUCKET
    || duplicateEntry.source.bucket !== REVIEWED_SOURCE_BUCKET) {
    throw new Error(`Unreferenced profile avatar ${sourceKey} is outside the exact reviewed duplicate-avatar contract`);
  }
  if (sourceKey === duplicateSourceKey) throw new Error(`Storage quarantine ${sourceKey} cannot duplicate itself`);
  if (entry.source.sha256 !== duplicateEntry.source.sha256 || entry.source.bytes !== duplicateEntry.source.bytes) {
    throw new Error(`Unreferenced profile avatar ${sourceKey} is not byte-identical to its duplicate`);
  }
  if (!/^[0-9a-f]{64}$/i.test(entry.source.sha256 || "")
    || !Number.isSafeInteger(entry.source.bytes) || entry.source.bytes < 0) {
    throw new Error(`Unreferenced profile avatar ${sourceKey} has invalid byte evidence`);
  }
  const destinationBucket = nonblank(targetBucket, "legacy orphan Storage target bucket");
  const declaredTarget = normalizeRelativePath(entry.target?.path || sourceKey, `${entry.id}.target.path`);
  if (declaredTarget !== sourceKey) {
    throw new Error(`Unreferenced profile avatar ${sourceKey} must preserve its original Storage path`);
  }
  if (entry.target?.bucket && entry.target.bucket !== destinationBucket) {
    throw new Error(`Unreferenced profile avatar ${sourceKey} has an unexpected target bucket`);
  }
  const contentType = nonblank(entry.contentType || "application/octet-stream", `${entry.id}.contentType`);
  const id = quarantineId(sourceBucket, sourceKey);
  const row = {
    id,
    source_bucket: sourceBucket,
    source_key: sourceKey,
    duplicate_of_source_key: duplicateSourceKey,
    target_bucket: destinationBucket,
    target_path: quarantineTargetPath(id, sourceKey),
    content_type: contentType,
    size_bytes: entry.source.bytes,
    sha256: entry.source.sha256.toLowerCase(),
    reason: UNREFERENCED_AVATAR_REASON,
    source_inventory: structuredClone(entry),
    imported_at: normalizeTimestamp(importedAt, `${entry.id}.importedAt`),
  };
  const storage = {
    ...structuredClone(entry),
    id: row.id,
    target: { bucket: row.target_bucket, path: row.target_path },
    metadata: {
      ...(entry.metadata || {}),
      kind: "legacy_orphan_profile_avatar",
      quarantineReason: row.reason,
      duplicateOfSourceKey: row.duplicate_of_source_key,
    },
  };
  return { row, storage };
}

export function buildMissingProjectPrefixQuarantine({ entry, targetBucket, importedAt }) {
  if (entry?.source?.type !== "s3") throw new Error("Missing-project Storage quarantine requires an S3 inventory entry");
  const sourceBucket = nonblank(entry.source.bucket, `${entry.id}.source.bucket`);
  const sourceKey = normalizedSourceKey(entry);
  if (sourceBucket !== REVIEWED_SOURCE_BUCKET || !isReviewedMissingProjectStorageKey(sourceKey)) {
    throw new Error(`Storage quarantine is not approved for ${sourceKey}`);
  }
  if (!/^[0-9a-f]{64}$/i.test(entry.source.sha256 || "")
    || !Number.isSafeInteger(entry.source.bytes) || entry.source.bytes < 0) {
    throw new Error(`Unreferenced missing-project object ${sourceKey} has invalid byte evidence`);
  }
  const lastModified = normalizeTimestamp(entry.lastModified, `${entry.id}.lastModified`);
  if (lastModified < REVIEWED_MISSING_PROJECT_EARLIEST
    || lastModified >= REVIEWED_MISSING_PROJECT_LATEST_EXCLUSIVE) {
    throw new Error(`Unreferenced missing-project object ${sourceKey} is outside the reviewed modification window`);
  }
  const destinationBucket = nonblank(targetBucket, "legacy orphan Storage target bucket");
  const declaredTarget = normalizeRelativePath(entry.target?.path || sourceKey, `${entry.id}.target.path`);
  if (declaredTarget !== sourceKey) {
    throw new Error(`Unreferenced missing-project object ${sourceKey} must preserve its original Storage path as evidence`);
  }
  if (entry.target?.bucket && entry.target.bucket !== destinationBucket) {
    throw new Error(`Unreferenced missing-project object ${sourceKey} has an unexpected target bucket`);
  }
  const id = quarantineId(sourceBucket, sourceKey);
  const row = {
    id,
    source_bucket: sourceBucket,
    source_key: sourceKey,
    duplicate_of_source_key: null,
    target_bucket: destinationBucket,
    target_path: quarantineTargetPath(id, sourceKey),
    content_type: nonblank(entry.contentType || "application/octet-stream", `${entry.id}.contentType`),
    size_bytes: entry.source.bytes,
    sha256: entry.source.sha256.toLowerCase(),
    reason: UNREFERENCED_MISSING_PROJECT_REASON,
    source_inventory: structuredClone(entry),
    imported_at: normalizeTimestamp(importedAt, `${entry.id}.importedAt`),
  };
  const storage = {
    ...structuredClone(entry),
    id: row.id,
    target: { bucket: row.target_bucket, path: row.target_path },
    metadata: {
      ...(entry.metadata || {}),
      kind: "legacy_orphan_missing_project_prefix",
      quarantineReason: row.reason,
      duplicateOfSourceKey: null,
    },
  };
  return { row, storage };
}

export function legacyOrphanStorageTargetDefinition(rows = []) {
  return {
    target: LEGACY_ORPHAN_STORAGE_TARGET,
    order: 69,
    primaryKey: ["id"],
    columnTypes: {
      id: "scalar",
      source_bucket: "scalar",
      source_key: "scalar",
      duplicate_of_source_key: "scalar",
      target_bucket: "scalar",
      target_path: "scalar",
      content_type: "scalar",
      size_bytes: "scalar",
      sha256: "scalar",
      reason: "scalar",
      source_inventory: "jsonb",
      imported_at: "timestamptz",
    },
    rows: [...rows],
  };
}

export function validateLegacyOrphanStorageRows(rows = []) {
  if (!Array.isArray(rows)) throw new Error("Legacy orphan Storage quarantine rows must be an array");
  const ids = new Set();
  const paths = new Set();
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error(`Duplicate legacy orphan Storage id ${row.id}`);
    ids.add(row.id);
    if (paths.has(row.source_key)) throw new Error(`Duplicate legacy orphan Storage key ${row.source_key}`);
    paths.add(row.source_key);
    if (row.id !== quarantineId(row.source_bucket, row.source_key)) {
      throw new Error(`Legacy orphan Storage ${row.id} has a non-deterministic id`);
    }
    if (![UNREFERENCED_AVATAR_REASON, UNREFERENCED_MISSING_PROJECT_REASON].includes(row.reason)
      || row.target_path !== quarantineTargetPath(row.id, row.source_key)) {
      throw new Error(`Legacy orphan Storage ${row.id} does not preserve its approved reason/path contract`);
    }
    if (!/^[0-9a-f]{64}$/.test(row.sha256 || "")
      || !Number.isSafeInteger(row.size_bytes) || row.size_bytes < 0) {
      throw new Error(`Legacy orphan Storage ${row.id} has invalid byte evidence`);
    }
    if (!row.source_inventory || typeof row.source_inventory !== "object" || Array.isArray(row.source_inventory)) {
      throw new Error(`Legacy orphan Storage ${row.id} has no exact source inventory evidence`);
    }
    const source = row.source_inventory.source;
    if (source?.type !== "s3" || source.bucket !== row.source_bucket || source.key !== row.source_key
      || source.bytes !== row.size_bytes || String(source.sha256 || "").toLowerCase() !== row.sha256) {
      throw new Error(`Legacy orphan Storage ${row.id} disagrees with its source inventory evidence`);
    }
    if (row.source_inventory.target?.bucket !== row.target_bucket
      || row.source_inventory.target?.path !== row.source_key
      || (row.source_inventory.contentType || "application/octet-stream") !== row.content_type) {
      throw new Error(`Legacy orphan Storage ${row.id} disagrees with its original inventory destination`);
    }
    if (row.reason === UNREFERENCED_AVATAR_REASON) {
      if (!isProfileAvatarStorageKey(row.source_key) || !isProfileAvatarStorageKey(row.duplicate_of_source_key)
        || row.duplicate_of_source_key === row.source_key) {
        throw new Error(`Legacy orphan Storage ${row.id} is outside the approved duplicate-avatar class`);
      }
    } else if (!isReviewedMissingProjectStorageKey(row.source_key) || row.duplicate_of_source_key !== null) {
      throw new Error(`Legacy orphan Storage ${row.id} is outside the approved missing-project-prefix class`);
    }
    if (row.reason === UNREFERENCED_MISSING_PROJECT_REASON) {
      const lastModified = normalizeTimestamp(
        row.source_inventory.lastModified,
        `${LEGACY_ORPHAN_STORAGE_TARGET}.${row.id}.source_inventory.lastModified`,
      );
      if (lastModified < REVIEWED_MISSING_PROJECT_EARLIEST
        || lastModified >= REVIEWED_MISSING_PROJECT_LATEST_EXCLUSIVE) {
        throw new Error(`Legacy orphan Storage ${row.id} is outside the reviewed modification window`);
      }
    }
    normalizeTimestamp(row.imported_at, `${LEGACY_ORPHAN_STORAGE_TARGET}.${row.id}.imported_at`);
  }
  const bySourceKey = new Map(rows.map((row) => [row.source_key, row]));
  const avatarRows = rows.filter((row) => row.reason === UNREFERENCED_AVATAR_REASON);
  for (const row of avatarRows) {
    const duplicate = bySourceKey.get(row.duplicate_of_source_key);
    if (!duplicate || duplicate.sha256 !== row.sha256 || duplicate.size_bytes !== row.size_bytes) {
      throw new Error(`Legacy orphan Storage ${row.id} has no byte-identical quarantined duplicate`);
    }
  }
  if (avatarRows.length && (avatarRows.length !== REVIEWED_AVATAR_KEYS.length
    || new Set(avatarRows.map((row) => row.source_key)).size !== REVIEWED_AVATAR_KEYS.length
    || REVIEWED_AVATAR_KEYS.some((key) => !bySourceKey.has(key))
    || avatarRows.some((row) => row.source_bucket !== REVIEWED_SOURCE_BUCKET
      || row.sha256 !== REVIEWED_AVATAR_SHA256 || row.size_bytes !== REVIEWED_AVATAR_BYTES))) {
    throw new Error("Legacy orphan Storage rows do not match the exact reviewed duplicate-avatar pair");
  }
  const missingProjectRows = rows.filter((row) => row.reason === UNREFERENCED_MISSING_PROJECT_REASON);
  const missingCanvasRows = missingProjectRows.filter((row) => row.source_key.startsWith(REVIEWED_MISSING_PROJECT_PREFIX));
  const missingShotRows = missingProjectRows.filter((row) => row.source_key === REVIEWED_MISSING_SHOT_KEY);
  const missingCanvasEvidence = [...missingCanvasRows]
    .sort((left, right) => left.source_key.localeCompare(right.source_key))
    .map((row) => ({ key: row.source_key, bytes: row.size_bytes, sha256: row.sha256 }));
  const missingShotEvidence = missingShotRows.map((row) => ({
    key: row.source_key, bytes: row.size_bytes, sha256: row.sha256,
  }));
  const missingProjectBytes = missingProjectRows.reduce((sum, row) => sum + row.size_bytes, 0);
  const missingCanvasBytes = missingCanvasRows.reduce((sum, row) => sum + row.size_bytes, 0);
  const missingCanvasDataSha256 = sha256(stableStringify(missingCanvasEvidence));
  const missingShotDataSha256 = sha256(stableStringify(missingShotEvidence));
  if (missingProjectRows.length && (missingCanvasRows.length !== REVIEWED_MISSING_PROJECT_COUNT
    || missingCanvasBytes !== REVIEWED_MISSING_PROJECT_BYTES
    || missingCanvasDataSha256 !== REVIEWED_MISSING_PROJECT_DATA_SHA256
    || missingShotRows.length !== 1
    || missingShotRows[0].size_bytes !== REVIEWED_MISSING_SHOT_BYTES
    || missingShotRows[0].sha256 !== REVIEWED_MISSING_SHOT_SHA256
    || missingShotDataSha256 !== REVIEWED_MISSING_SHOT_DATA_SHA256
    || missingProjectRows.some((row) => row.source_bucket !== REVIEWED_SOURCE_BUCKET))) {
    throw new Error("Legacy orphan Storage contract does not match the exact reviewed missing-project prefixes contract");
  }
  const contract = [...rows].sort((left, right) => left.id.localeCompare(right.id));
  return {
    status: "verified",
    count: contract.length,
    totalBytes: contract.reduce((sum, row) => sum + row.size_bytes, 0),
    reasons: [...new Set(contract.map((row) => row.reason))].sort(),
    classes: {
      duplicateAvatars: {
        count: avatarRows.length,
        totalBytes: avatarRows.reduce((sum, row) => sum + row.size_bytes, 0),
        reviewedPairSha256: sha256(stableStringify(REVIEWED_AVATAR_KEYS)),
        sharedObjectSha256: avatarRows.length ? REVIEWED_AVATAR_SHA256 : null,
      },
      missingProjectPrefix: {
        count: missingProjectRows.length,
        totalBytes: missingProjectBytes,
        canvas: {
          count: missingCanvasRows.length,
          totalBytes: missingCanvasBytes,
          sourcePrefix: REVIEWED_MISSING_PROJECT_PREFIX,
          dataSha256: missingCanvasDataSha256,
        },
        shotReference: {
          count: missingShotRows.length,
          totalBytes: missingShotRows.reduce((sum, row) => sum + row.size_bytes, 0),
          sourceKey: REVIEWED_MISSING_SHOT_KEY,
          dataSha256: missingShotDataSha256,
        },
      },
    },
    dataSha256: sha256(stableStringify(contract)),
  };
}

function containsStorageKey(value, sourceKey) {
  if (typeof value === "string") return value.includes(sourceKey);
  if (Array.isArray(value)) return value.some((item) => containsStorageKey(item, sourceKey));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsStorageKey(item, sourceKey));
  }
  return false;
}

export function validateLegacyOrphanStorageGraph(rows = [], tables = []) {
  const missingRows = rows.filter((row) => row.reason === UNREFERENCED_MISSING_PROJECT_REASON);
  if (!missingRows.length) return { status: "verified", unreferencedMissingProjectObjects: 0 };
  const scripts = tables.find((table) => table.target === "public.scripts")?.rows || [];
  if (scripts.some((row) => row.id === REVIEWED_MISSING_PROJECT_ID)) {
    throw new Error(`Reviewed Storage quarantine project ${REVIEWED_MISSING_PROJECT_ID} exists in the normalized project graph`);
  }
  for (const row of missingRows) {
    for (const table of tables) {
      if (table.target === LEGACY_ORPHAN_STORAGE_TARGET) continue;
      if ((table.rows || []).some((targetRow) => containsStorageKey(targetRow, row.source_key))) {
        throw new Error(`Reviewed Storage quarantine object ${row.source_key} is referenced by ${table.target}`);
      }
    }
  }
  return { status: "verified", unreferencedMissingProjectObjects: missingRows.length };
}

export function validateLegacyOrphanStoragePlanEntry(row, entry) {
  const contract = {
    sourceBucket: entry.source?.bucket,
    sourceKey: entry.source?.key,
    targetBucket: entry.target?.bucket,
    targetPath: entry.target?.path,
    bytes: entry.source?.bytes,
    sha256: String(entry.source?.sha256 || "").toLowerCase(),
    contentType: entry.contentType || "application/octet-stream",
    reason: entry.metadata?.quarantineReason,
    duplicateOfSourceKey: entry.metadata?.duplicateOfSourceKey ?? null,
  };
  const expected = {
    sourceBucket: row.source_bucket,
    sourceKey: row.source_key,
    targetBucket: row.target_bucket,
    targetPath: row.target_path,
    bytes: row.size_bytes,
    sha256: row.sha256,
    contentType: row.content_type,
    reason: row.reason,
    duplicateOfSourceKey: row.duplicate_of_source_key,
  };
  if (entry.source?.type !== "s3" || stableStringify(contract) !== stableStringify(expected)) {
    throw new Error(`Storage plan ${entry.id} disagrees with private.legacy_orphan_storage`);
  }
}
