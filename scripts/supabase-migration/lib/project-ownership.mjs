import { sha256, stableStringify } from "./common.mjs";

const LEGACY_OWNER_PREFIX = "mem_legacy_owner_";
const OWNER_MODULES = [
  "script", "analysis", "breakdown", "shot_list", "stripboard", "calendar", "budget", "canvas",
  "location_plan", "imagine", "files", "project_settings", "members", "shared_projects", "exports", "lumiere",
];
const OWNER_MODULE_PERMISSIONS = Object.freeze(Object.fromEntries(OWNER_MODULES.map((module) => [module, "manage"])));
const OWNER_FINANCIAL_PERMISSIONS = Object.freeze([
  "financial.view_all", "financial.edit_all", "financial.export", "financial.manage_access",
]);

function nonblank(value, context) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(`${context} must be a non-empty string`);
  return result;
}

function syntheticOwnerId(projectId, userId) {
  return `${LEGACY_OWNER_PREFIX}${sha256(`legacy-owner:${projectId}:${userId}`).slice(0, 24)}`;
}

function encodedOne(versionType) {
  return versionType === "bigint" ? { $type: "bigint", value: "1" } : 1;
}

function syntheticOwnerRow(script, versionType) {
  const projectId = nonblank(script.id, "scripts.id");
  const userId = nonblank(script.user_id, `scripts.${projectId}.user_id`);
  const createdAt = nonblank(script.created_at, `scripts.${projectId}.created_at`);
  const updatedAt = nonblank(script.updated_at, `scripts.${projectId}.updated_at`);
  return {
    id: syntheticOwnerId(projectId, userId),
    project_id: projectId,
    user_id: userId,
    guest_id: null,
    project_role: "owner",
    cinematic_role: null,
    module_permissions: { ...OWNER_MODULE_PERMISSIONS },
    financial_permissions: [...OWNER_FINANCIAL_PERMISSIONS],
    financial_department_ids: [],
    department_ids: [],
    status: "active",
    invited_by_user_id: userId,
    version: encodedOne(versionType),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function remediationSummary(syntheticRows, projectCount) {
  const contract = [...syntheticRows].sort((left, right) => left.id.localeCompare(right.id));
  return {
    status: "verified",
    sourceActiveOwnerCount: projectCount - contract.length,
    syntheticOwnerCount: contract.length,
    syntheticOwnerSha256: sha256(stableStringify(contract)),
  };
}

export function remediateLegacyProjectOwners({ scripts, memberships, versionType = "scalar" }) {
  if (!Array.isArray(scripts) || !Array.isArray(memberships)) {
    throw new Error("Project ownership remediation requires scripts and project_memberships rows");
  }
  const scriptsById = new Map(scripts.map((script) => [nonblank(script.id, "scripts.id"), script]));
  const membershipIds = new Set();
  const membershipsByProject = new Map();
  for (const membership of memberships) {
    const id = nonblank(membership.id, "project_memberships.id");
    if (membershipIds.has(id)) throw new Error(`Project ownership invalid: duplicate membership id ${id}`);
    membershipIds.add(id);
    if (id.startsWith(LEGACY_OWNER_PREFIX)) {
      throw new Error(`Project ownership remediation provenance prefix is already present in source membership ${id}`);
    }
    const projectId = nonblank(membership.project_id, `project_memberships.${id}.project_id`);
    if (!scriptsById.has(projectId)) {
      throw new Error(`Project ownership invalid: membership ${id} references nonexistent project ${projectId}`);
    }
    const rows = membershipsByProject.get(projectId) || [];
    rows.push(membership);
    membershipsByProject.set(projectId, rows);
  }

  const syntheticRows = [];
  for (const script of scripts) {
    const projectId = script.id;
    const rows = membershipsByProject.get(projectId) || [];
    const activeOwners = rows.filter((membership) => membership.project_role === "owner" && membership.status === "active");
    if (activeOwners.length > 1) {
      throw new Error(`Project ownership invalid: project ${projectId} has ${activeOwners.length} active owner memberships; expected at most 1 before remediation`);
    }
    if (activeOwners.length === 1) {
      if (activeOwners[0].user_id !== script.user_id) {
        throw new Error(`Project ownership invalid: project ${projectId} owner membership does not match scripts.user_id`);
      }
      continue;
    }
    if (rows.some((membership) => membership.user_id === script.user_id)) {
      throw new Error(`Project ownership remediation would overwrite an existing membership for scripts.user_id on project ${projectId}`);
    }
    const row = syntheticOwnerRow(script, versionType);
    if (membershipIds.has(row.id)) throw new Error(`Project ownership remediation id collision for ${row.id}`);
    membershipIds.add(row.id);
    syntheticRows.push(row);
  }
  syntheticRows.sort((left, right) => left.id.localeCompare(right.id));
  return { syntheticRows, summary: remediationSummary(syntheticRows, scripts.length) };
}

export function validateProjectOwnershipRemediation({ scripts, memberships, versionType = "scalar" }) {
  if (!Array.isArray(scripts) || !Array.isArray(memberships)) {
    throw new Error("Project ownership remediation validation requires scripts and project_memberships rows");
  }
  const scriptsById = new Map(scripts.map((script) => [script.id, script]));
  const syntheticRows = memberships.filter((membership) => String(membership.id || "").startsWith(LEGACY_OWNER_PREFIX));
  for (const row of syntheticRows) {
    const script = scriptsById.get(row.project_id);
    if (!script) throw new Error(`Synthetic owner membership ${row.id} references nonexistent project ${row.project_id}`);
    const expected = syntheticOwnerRow(script, versionType);
    if (stableStringify(row) !== stableStringify(expected)) {
      throw new Error(`Synthetic owner membership ${row.id} does not match its canonical scripts.user_id remediation`);
    }
  }
  return remediationSummary(syntheticRows, scripts.length);
}

export function validateProjectOwnershipGraph({ scripts, memberships }) {
  if (!Array.isArray(scripts) || !Array.isArray(memberships)) {
    throw new Error("Project ownership validation requires scripts and project_memberships rows");
  }

  const scriptsById = new Map(scripts.map((script) => [script.id, script]));
  const activeOwnersByProject = new Map();
  for (const membership of memberships) {
    if (!scriptsById.has(membership.project_id)) {
      throw new Error(`Project ownership invalid: membership ${membership.id} references nonexistent project ${membership.project_id}`);
    }
    if (membership.project_role !== "owner" || membership.status !== "active") continue;
    const owners = activeOwnersByProject.get(membership.project_id) || [];
    owners.push(membership);
    activeOwnersByProject.set(membership.project_id, owners);
  }

  for (const script of scripts) {
    const owners = activeOwnersByProject.get(script.id) || [];
    if (owners.length !== 1) {
      throw new Error(`Project ownership invalid: project ${script.id} has ${owners.length} active owner memberships; expected exactly 1`);
    }
    if (owners[0].user_id !== script.user_id) {
      throw new Error(`Project ownership invalid: project ${script.id} owner membership does not match scripts.user_id`);
    }
  }

  return { projectCount: scripts.length, activeOwnerCount: scripts.length };
}
