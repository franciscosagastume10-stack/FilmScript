import { sha256, stableStringify } from "./common.mjs";

export const LEGACY_ACTIVITY_UPDATED_AT_MARKER = "legacy_updated_at_inferred_from_created_at";

export function validateActivityTimestampRemediation(rows = []) {
  const inferred = [];
  for (const row of rows) {
    if (!row.updated_at) {
      throw new Error(`activity_events.${row.id || "unknown"}.updated_at was not normalized for the Postgres target`);
    }
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : {};
    if (!Object.hasOwn(metadata, LEGACY_ACTIVITY_UPDATED_AT_MARKER)) continue;
    if (metadata[LEGACY_ACTIVITY_UPDATED_AT_MARKER] !== true) {
      throw new Error(`activity_events.${row.id || "unknown"} has an invalid reserved timestamp-remediation marker`);
    }
    if (!row.id || !row.created_at || row.updated_at !== row.created_at) {
      throw new Error("An inferred legacy activity timestamp is missing its exact created_at anchor");
    }
    inferred.push({ id: row.id, createdAt: row.created_at });
  }
  inferred.sort((left, right) => left.id.localeCompare(right.id));
  return {
    status: "verified",
    inferredUpdatedAtCount: inferred.length,
    inferredUpdatedAtSha256: sha256(stableStringify(inferred)),
  };
}
