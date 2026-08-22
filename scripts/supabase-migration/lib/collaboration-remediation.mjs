import {
  assertNoNullBytes,
  normalizeTimestamp,
  readNdjson,
  resolveInside,
  sha256,
  stableStringify,
} from "./common.mjs";

const COLLABORATION_MODULES = new Set([
  "script", "analysis", "breakdown", "shot_list", "stripboard", "calendar", "budget",
  "canvas", "location_plan", "imagine", "files", "project_settings", "members",
  "shared_projects", "exports", "lumiere",
]);

const scopeKey = (projectId, documentId) => `${projectId}\u0000${documentId}`;
const QUARANTINE_REASON = "legacy_collaboration_project_missing_from_scripts";
const QUARANTINE_PRIMARY_KEYS = Object.freeze({
  collaboration_documents: ["project_id", "document_id"],
  collaboration_entities: ["project_id", "document_id", "entity_id"],
  collaboration_operations: ["id"],
  content_conflicts: ["id"],
});

function nonblank(value, context) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(`${context} must be a non-empty string`);
  return result;
}

function rowsFor(sourceRoot, tableByName, name) {
  const table = tableByName.get(name);
  return table ? readNdjson(resolveInside(sourceRoot, table.dataFile, `${name} data`)) : [];
}

function assertModule(value, context) {
  const module = nonblank(value, context);
  if (!COLLABORATION_MODULES.has(module)) throw new Error(`${context} uses unsupported module ${module}`);
  return module;
}

function quarantineRecord(tableName, row, importedAt) {
  const primaryKey = QUARANTINE_PRIMARY_KEYS[tableName];
  if (!primaryKey) throw new Error(`Unsupported collaboration quarantine source table ${tableName}`);
  assertNoNullBytes(row, `${tableName} orphan payload`);
  const sourcePk = Object.fromEntries(primaryKey.map((column) => {
    if (row[column] == null) throw new Error(`${tableName} orphan row has null primary key ${column}`);
    return [column, row[column]];
  }));
  const blobs = Object.entries(row).filter(([, value]) => value?.$type === "blob");
  if (blobs.length > 1) throw new Error(`${tableName} orphan row has multiple BLOBs and needs explicit quarantine mapping`);
  const [blobColumn, sourceBlob] = blobs[0] || [null, null];
  const identity = { sourceTable: tableName, sourcePk };
  return {
    id: `lor_${sha256(stableStringify(identity)).slice(0, 32)}`,
    source_table: tableName,
    source_pk: sourcePk,
    source_project_id: nonblank(row.project_id, `${tableName}.project_id`),
    reason: QUARANTINE_REASON,
    payload: row,
    blob_column: blobColumn,
    blob_payload: sourceBlob ? {
      $type: "blob",
      bytes: sourceBlob.bytes,
      path: `blobs/quarantine/${sourceBlob.sha256}.bin`,
      sha256: sourceBlob.sha256,
    } : null,
    blob_sha256: sourceBlob?.sha256 || null,
    blob_bytes: sourceBlob ? { $type: "bigint", value: String(sourceBlob.bytes) } : null,
    imported_at: importedAt,
  };
}

function quarantineSummary(rows) {
  const sorted = [...rows].sort((left, right) => left.id.localeCompare(right.id));
  const count = (tableName) => sorted.filter((row) => row.source_table === tableName).length;
  return {
    status: sorted.length ? "quarantined" : "none",
    reason: QUARANTINE_REASON,
    projectCount: new Set(sorted.map((row) => row.source_project_id)).size,
    documentCount: count("collaboration_documents"),
    entityCount: count("collaboration_entities"),
    operationCount: count("collaboration_operations"),
    conflictCount: count("content_conflicts"),
    rowCount: sorted.length,
    rowSha256: sha256(stableStringify(sorted)),
  };
}

export function collaborationQuarantineTargetDefinition(rows = []) {
  return {
    target: "private.legacy_orphan_records",
    order: 59,
    primaryKey: ["id"],
    columnTypes: {
      id: "scalar",
      source_table: "scalar",
      source_pk: "jsonb",
      source_project_id: "scalar",
      reason: "scalar",
      payload: "jsonb",
      blob_column: "scalar",
      blob_payload: "bytea",
      blob_sha256: "scalar",
      blob_bytes: "bigint",
      imported_at: "timestamptz",
    },
    rows,
  };
}

export function analyzeLegacyCollaborationGraph({ sourceRoot, sourceManifest }) {
  const tableByName = new Map(sourceManifest.tables.map((table) => [table.name, table]));
  const scripts = rowsFor(sourceRoot, tableByName, "scripts");
  const sourceDocuments = rowsFor(sourceRoot, tableByName, "collaboration_documents");
  const entities = rowsFor(sourceRoot, tableByName, "collaboration_entities");
  const operations = rowsFor(sourceRoot, tableByName, "collaboration_operations");
  const conflicts = rowsFor(sourceRoot, tableByName, "content_conflicts");
  const projectIds = new Set(scripts.map((row) => nonblank(row.id, "scripts.id")));
  const importedAt = normalizeTimestamp(
    sourceManifest.source?.capturedAt || sourceManifest.generatedAt,
    "SQLite collaboration snapshot capturedAt",
  );
  const quarantinedProjectIds = new Set();
  const quarantineRows = [];
  const liveRows = new Map();
  for (const [tableName, rows] of [
    ["collaboration_documents", sourceDocuments],
    ["collaboration_entities", entities],
    ["collaboration_operations", operations],
    ["content_conflicts", conflicts],
  ]) {
    const sourceTable = tableByName.get(tableName);
    if (sourceTable && stableStringify(sourceTable.primaryKey) !== stableStringify(QUARANTINE_PRIMARY_KEYS[tableName])) {
      throw new Error(`${tableName} primary key changed and requires an explicit quarantine mapping review`);
    }
    const live = [];
    for (const row of rows) {
      const projectId = nonblank(row.project_id, `${tableName}.project_id`);
      if (projectIds.has(projectId)) live.push(row);
      else {
        quarantinedProjectIds.add(projectId);
        quarantineRows.push(quarantineRecord(tableName, row, importedAt));
      }
    }
    liveRows.set(tableName, live);
  }
  const liveDocuments = liveRows.get("collaboration_documents");
  const liveEntities = liveRows.get("collaboration_entities");
  const liveOperations = liveRows.get("collaboration_operations");
  const liveConflicts = liveRows.get("content_conflicts");
  const documents = new Map();
  for (const row of liveDocuments) {
    const projectId = nonblank(row.project_id, "collaboration_documents.project_id");
    const documentId = nonblank(row.document_id, "collaboration_documents.document_id");
    const module = assertModule(row.module, `collaboration_documents.${projectId}/${documentId}.module`);
    documents.set(scopeKey(projectId, documentId), { projectId, documentId, module });
  }

  const groups = new Map();
  const operationsById = new Map();
  const issues = [];
  const inspectChild = (tableName, row) => {
    const projectId = nonblank(row.project_id, `${tableName}.project_id`);
    const documentId = nonblank(row.document_id, `${tableName}.document_id`);
    const module = assertModule(row.module, `${tableName}.${projectId}/${documentId}.module`);
    const existing = documents.get(scopeKey(projectId, documentId));
    if (existing && existing.module !== module) {
      issues.push(`${tableName}:${row.id || row.entity_id || "unknown"} module ${module} differs from source document module ${existing.module}`);
      return;
    }
    if (existing) return;
    const key = scopeKey(projectId, documentId);
    const group = groups.get(key) || {
      projectId,
      documentId,
      modules: new Set(),
      entityCount: 0,
      operationCount: 0,
      timestamps: [],
    };
    group.modules.add(module);
    if (tableName === "collaboration_entities") {
      group.entityCount += 1;
      group.timestamps.push(normalizeTimestamp(row.updated_at, `${tableName}.${row.entity_id}.updated_at`));
    } else {
      group.operationCount += 1;
      group.timestamps.push(normalizeTimestamp(row.created_at, `${tableName}.${row.id}.created_at`));
    }
    groups.set(key, group);
  };
  for (const row of liveEntities) inspectChild("collaboration_entities", row);
  for (const row of liveOperations) {
    inspectChild("collaboration_operations", row);
    const id = nonblank(row.id, "collaboration_operations.id");
    operationsById.set(id, row);
  }
  for (const row of liveConflicts) {
    const operation = operationsById.get(String(row.operation_id || ""));
    if (!operation) {
      issues.push(`content_conflicts:${row.id || "unknown"} has no collaboration_operation`);
    } else if (String(row.project_id || "") !== String(operation.project_id || "")
      || String(row.module || "") !== String(operation.module || "")) {
      issues.push(`content_conflicts:${row.id || "unknown"} disagrees with its collaboration_operation scope`);
    }
  }
  if (issues.length) {
    throw new Error(`Legacy collaboration graph needs explicit remediation before import (${issues.length} issue${issues.length === 1 ? "" : "s"}): ${issues.slice(0, 12).join("; ")}`);
  }

  const ambiguous = [...groups.values()].filter((group) => group.modules.size !== 1);
  if (ambiguous.length) {
    const preview = ambiguous.slice(0, 12).map((group) => (
      `${group.projectId}/${group.documentId} [${[...group.modules].sort().join(",") || "no module"}]`
    )).join("; ");
    throw new Error(`Legacy collaboration parent remediation is ambiguous for ${ambiguous.length} document scope${ambiguous.length === 1 ? "" : "s"}: ${preview}`);
  }

  const syntheticParents = [...groups.values()].map((group) => ({
    projectId: group.projectId,
    documentId: group.documentId,
    module: [...group.modules][0],
    updatedAt: [...group.timestamps].sort().at(-1),
    entityCount: group.entityCount,
    operationCount: group.operationCount,
  })).sort((left, right) => scopeKey(left.projectId, left.documentId).localeCompare(scopeKey(right.projectId, right.documentId)));
  const moduleCounts = {};
  for (const parent of syntheticParents) moduleCounts[parent.module] = (moduleCounts[parent.module] || 0) + 1;
  const contract = syntheticParents.map(({ projectId, documentId, module, updatedAt, entityCount, operationCount }) => ({
    projectId, documentId, module, updatedAt, entityCount, operationCount,
  }));
  quarantineRows.sort((left, right) => left.id.localeCompare(right.id));
  return {
    quarantinedProjectIds,
    quarantineRows,
    syntheticParents,
    summary: {
      status: "verified",
      sourceDocumentCount: liveDocuments.length,
      childEntityCount: liveEntities.length,
      childOperationCount: liveOperations.length,
      conflictCount: liveConflicts.length,
      syntheticParentCount: syntheticParents.length,
      moduleCounts: Object.fromEntries(Object.entries(moduleCounts).sort(([left], [right]) => left.localeCompare(right))),
      syntheticParentSha256: sha256(stableStringify(contract)),
      orphanProjectQuarantine: quarantineSummary(quarantineRows),
    },
  };
}

function validateQuarantineRows({ rows, projectIds, capturedAt }) {
  const importedAt = normalizeTimestamp(capturedAt, "collaboration quarantine capturedAt");
  for (const row of rows) {
    const tableName = nonblank(row.source_table, "private.legacy_orphan_records.source_table");
    const primaryKey = QUARANTINE_PRIMARY_KEYS[tableName];
    if (!primaryKey) throw new Error(`Quarantine row ${row.id || "unknown"} has unsupported source table ${tableName}`);
    if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) {
      throw new Error(`Quarantine row ${row.id || "unknown"} payload must be an object`);
    }
    assertNoNullBytes(row.payload, `quarantine row ${row.id || "unknown"} payload`);
    const sourcePk = Object.fromEntries(primaryKey.map((column) => [column, row.payload[column]]));
    if (primaryKey.some((column) => row.payload[column] == null)
      || stableStringify(row.source_pk) !== stableStringify(sourcePk)) {
      throw new Error(`Quarantine row ${row.id || "unknown"} source primary key disagrees with its payload`);
    }
    const expectedId = `lor_${sha256(stableStringify({ sourceTable: tableName, sourcePk })).slice(0, 32)}`;
    if (row.id !== expectedId) throw new Error(`Quarantine row ${row.id || "unknown"} has a non-deterministic id`);
    if (row.reason !== QUARANTINE_REASON) throw new Error(`Quarantine row ${row.id} has an unsupported reason`);
    if (row.source_project_id !== row.payload.project_id || projectIds.has(row.source_project_id)) {
      throw new Error(`Quarantine row ${row.id} does not prove a deleted source project`);
    }
    if (row.imported_at !== importedAt) throw new Error(`Quarantine row ${row.id} imported_at disagrees with snapshot capture`);
    const blobs = Object.entries(row.payload).filter(([, value]) => value?.$type === "blob");
    if (blobs.length > 1) throw new Error(`Quarantine row ${row.id} has multiple unsupported BLOB payloads`);
    if (!blobs.length) {
      if (row.blob_column !== null || row.blob_payload !== null || row.blob_sha256 !== null || row.blob_bytes !== null) {
        throw new Error(`Quarantine row ${row.id} has BLOB metadata without a source BLOB`);
      }
    } else {
      const [column, sourceBlob] = blobs[0];
      const bytes = row.blob_bytes?.$type === "bigint" ? Number(row.blob_bytes.value) : NaN;
      if (row.blob_column !== column || row.blob_payload?.$type !== "blob"
        || row.blob_payload.path !== `blobs/quarantine/${sourceBlob.sha256}.bin`
        || row.blob_payload.sha256 !== sourceBlob.sha256 || row.blob_payload.bytes !== sourceBlob.bytes
        || row.blob_sha256 !== sourceBlob.sha256 || bytes !== sourceBlob.bytes) {
        throw new Error(`Quarantine row ${row.id} does not preserve its source BLOB contract`);
      }
    }
  }
  return quarantineSummary(rows);
}

export function validateNormalizedCollaborationGraph({ tables, capturedAt }) {
  const byTarget = new Map((tables || []).map((table) => [table.target, table.rows || []]));
  const scripts = byTarget.get("public.scripts") || [];
  const documents = byTarget.get("public.collaboration_documents") || [];
  const entities = byTarget.get("public.collaboration_entities") || [];
  const operations = byTarget.get("public.collaboration_operations") || [];
  const conflicts = byTarget.get("public.content_conflicts") || [];
  const quarantineRows = byTarget.get("private.legacy_orphan_records") || [];
  const projectIds = new Set(scripts.map((row) => nonblank(row.id, "public.scripts.id")));
  const documentByScope = new Map();
  for (const row of documents) {
    const projectId = nonblank(row.project_id, "public.collaboration_documents.project_id");
    const documentId = nonblank(row.document_id, "public.collaboration_documents.document_id");
    assertModule(row.module, `public.collaboration_documents.${projectId}/${documentId}.module`);
    if (!projectIds.has(projectId)) throw new Error(`collaboration document ${projectId}/${documentId} references nonexistent project`);
    documentByScope.set(scopeKey(projectId, documentId), row);
  }
  const childrenByScope = new Map();
  const operationsById = new Map();
  for (const [kind, rows] of [["entity", entities], ["operation", operations]]) {
    for (const row of rows) {
      const projectId = nonblank(row.project_id, `public.collaboration_${kind === "entity" ? "entities" : "operations"}.project_id`);
      const documentId = nonblank(row.document_id, `public.collaboration_${kind === "entity" ? "entities" : "operations"}.document_id`);
      assertModule(row.module, `public.collaboration_${kind === "entity" ? "entities" : "operations"}.${projectId}/${documentId}.module`);
      const key = scopeKey(projectId, documentId);
      const parent = documentByScope.get(key);
      if (!parent || parent.module !== row.module) {
        throw new Error(`${projectId}/${documentId} ${kind} has no same-module collaboration parent`);
      }
      const children = childrenByScope.get(key) || [];
      children.push({ kind, row });
      childrenByScope.set(key, children);
      if (kind === "operation") operationsById.set(nonblank(row.id, "public.collaboration_operations.id"), row);
    }
  }
  for (const row of conflicts) {
    const operation = operationsById.get(String(row.operation_id || ""));
    if (!operation) {
      throw new Error(`content conflict ${row.id || "unknown"} has no collaboration operation`);
    }
    if (String(row.project_id || "") !== String(operation.project_id || "")
      || String(row.module || "") !== String(operation.module || "")) {
      throw new Error(`content conflict ${row.id || "unknown"} disagrees with its collaboration operation scope`);
    }
  }
  const syntheticParents = [];
  for (const row of documents) {
    if (row.legacy_synthetic_parent !== true) continue;
    const key = scopeKey(row.project_id, row.document_id);
    const children = childrenByScope.get(key) || [];
    if (!children.length) throw new Error(`synthetic collaboration parent ${row.project_id}/${row.document_id} has no children`);
    if (row.snapshot?.$type !== "blob" || row.snapshot.bytes !== 0
      || row.snapshot.sha256 !== sha256(Buffer.alloc(0))) {
      throw new Error(`synthetic collaboration parent ${row.project_id}/${row.document_id} must use the canonical empty snapshot marker`);
    }
    const timestamps = children.map(({ kind, row: child }) => kind === "entity" ? child.updated_at : child.created_at).sort();
    if (row.updated_at !== timestamps.at(-1)) {
      throw new Error(`synthetic collaboration parent ${row.project_id}/${row.document_id} updated_at does not match its latest child`);
    }
    const version = row.version?.$type === "bigint" ? Number(row.version.value) : Number(row.version);
    if (version !== 0) throw new Error(`synthetic collaboration parent ${row.project_id}/${row.document_id} must have version 0`);
    syntheticParents.push({
      projectId: row.project_id,
      documentId: row.document_id,
      module: row.module,
      updatedAt: row.updated_at,
      entityCount: children.filter(({ kind }) => kind === "entity").length,
      operationCount: children.filter(({ kind }) => kind === "operation").length,
    });
  }
  syntheticParents.sort((left, right) => scopeKey(left.projectId, left.documentId).localeCompare(scopeKey(right.projectId, right.documentId)));
  const moduleCounts = {};
  for (const parent of syntheticParents) moduleCounts[parent.module] = (moduleCounts[parent.module] || 0) + 1;
  return {
    status: "verified",
    sourceDocumentCount: documents.length - syntheticParents.length,
    childEntityCount: entities.length,
    childOperationCount: operations.length,
    conflictCount: conflicts.length,
    syntheticParentCount: syntheticParents.length,
    moduleCounts: Object.fromEntries(Object.entries(moduleCounts).sort(([left], [right]) => left.localeCompare(right))),
    syntheticParentSha256: sha256(stableStringify(syntheticParents)),
    orphanProjectQuarantine: validateQuarantineRows({ rows: quarantineRows, projectIds, capturedAt }),
  };
}
