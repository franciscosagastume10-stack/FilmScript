import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATABASE_PATH } from "./database.js";
import {
  CINEMATIC_ROLES, FINANCIAL_PERMISSIONS, PERMISSION_LEVELS, PROJECT_MODULES, PROJECT_ROLES,
  canAccessModule, canEditFinancialData, canViewFinancialData, financialSummary,
  normalizeFinancialPermissions, normalizeProjectRole, permissionsForRole,
} from "./permissions-model.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(DATABASE_PATH);
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
const nowIso = () => new Date().toISOString();
const id = (prefix, bytes = 12) => `${prefix}_${crypto.randomBytes(bytes).toString("hex")}`;
const hash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const jsonParse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const normalizedEmail = (value) => String(value || "").trim().toLowerCase();
export const AVATAR_PRESET_ICON_IDS = Object.freeze([
  "camera",
  "clapperboard",
  "film-reel",
  "screenplay",
  "director-chair",
  "spotlight",
  "microphone",
  "star",
  "moon",
  "sun",
]);
export const AVATAR_PRESET_BACKGROUNDS = Object.freeze({
  amber: "#d99a32",
  tangerine: "#d8784e",
  mint: "#70a98a",
  sky: "#6c9dc1",
  lavender: "#947eb8",
  rose: "#bd7586",
  sand: "#b89a73",
  slate: "#596875",
});
const avatarPresetIcons = new Set(AVATAR_PRESET_ICON_IDS);
const avatarPresetBackgrounds = new Set(Object.keys(AVATAR_PRESET_BACKGROUNDS));
const unsafeAvatarCropKeys = new Set(["__proto__", "constructor", "prototype"]);
const avatarPresentationCache = new Map();

function cleanStoredAvatarCrop(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean = {};
  for (const [key, entry] of Object.entries(value)) {
    if (unsafeAvatarCropKeys.has(key)) continue;
    if (key === "presetIcon") {
      if (avatarPresetIcons.has(entry)) clean.presetIcon = entry;
      continue;
    }
    if (key === "presetBackground") {
      if (avatarPresetBackgrounds.has(entry)) clean.presetBackground = entry;
      continue;
    }
    clean[key] = entry;
  }
  return clean;
}

function avatarCropPatch(current, input) {
  if (input === undefined) return cleanStoredAvatarCrop(current);
  if (input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw Object.assign(new Error("Avatar settings must be an object."), { status: 422, code: "invalid_avatar_crop" });
  }
  if (!Object.keys(input).length) return {};
  const next = cleanStoredAvatarCrop(current);
  for (const [key, entry] of Object.entries(input)) {
    if (unsafeAvatarCropKeys.has(key)) continue;
    if (key === "presetIcon") {
      if (entry === null || entry === "") delete next.presetIcon;
      else if (typeof entry !== "string" || !avatarPresetIcons.has(entry)) {
        throw Object.assign(new Error("Choose a valid FilmScript avatar icon."), { status: 422, code: "invalid_avatar_preset_icon" });
      } else next.presetIcon = entry;
      continue;
    }
    if (key === "presetBackground") {
      if (entry === null || entry === "") delete next.presetBackground;
      else if (typeof entry !== "string" || !avatarPresetBackgrounds.has(entry)) {
        throw Object.assign(new Error("Choose a valid FilmScript avatar background."), { status: 422, code: "invalid_avatar_preset_background" });
      } else next.presetBackground = entry;
      continue;
    }
    next[key] = entry;
  }
  return next;
}

function avatarPresentationFromRow(row, { userIdKey = "id", pictureKey = "picture_url" } = {}) {
  const userId = row?.[userIdKey] || null;
  const crop = cleanStoredAvatarCrop(jsonParse(row?.avatar_crop_json, {}));
  const uploaded = userId && row?.avatar_key
    ? `/api/users/${encodeURIComponent(userId)}/avatar?v=${hash(row.avatar_key).slice(0, 16)}`
    : null;
  return {
    picture: uploaded || row?.[pictureKey] || null,
    avatarPreset: crop.presetIcon || null,
    avatarBackground: crop.presetBackground || null,
  };
}

const invitationExpiry = (value) => {
  if (!value) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw Object.assign(new Error("Choose a future invitation expiration."), { status: 422, code: "invalid_expiration" });
  return new Date(timestamp).toISOString();
};

function validateCinematicRole(value) {
  if (value == null || value === "") return null;
  if (!CINEMATIC_ROLES.includes(value)) throw Object.assign(new Error("Choose a valid cinematic role."), { status: 422, code: "invalid_cinematic_role" });
  return value;
}

function validateProjectRole(value, fallback = "viewer") {
  const candidate = value || fallback;
  if (!PROJECT_ROLES.includes(candidate)) throw Object.assign(new Error("Choose a valid project role."), { status: 422, code: "invalid_project_role" });
  return candidate;
}

function validatePermissionInput(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Object.assign(new Error("Module permissions must be an object."), { status: 422, code: "invalid_permissions" });
  for (const [module, level] of Object.entries(value)) {
    if (!PROJECT_MODULES.includes(module) || !PERMISSION_LEVELS.includes(level)) throw Object.assign(new Error("A module permission is invalid."), { status: 422, code: "invalid_permissions" });
  }
  return value;
}

function validateFinancialInput(value) {
  if (value == null) return value;
  if (!Array.isArray(value) || value.some((permission) => !FINANCIAL_PERMISSIONS.includes(permission))) throw Object.assign(new Error("Financial permissions are invalid."), { status: 422, code: "invalid_financial_permissions" });
  return value;
}

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((entry) => entry.name === column);
}

export function runPlatformMigrations() {
  const current = Number(db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get()?.value || 0);
  const migrations = [
    [10, "010_collaboration_platform.sql"],
    [11, "011_collaboration_access_foundation.sql"],
    [12, "012_realtime_collaboration.sql"],
    [13, "013_activity_comments_notifications.sql"],
    [14, "014_lumiere_ai_infrastructure.sql"],
    [15, "015_project_messages.sql"],
    [16, "016_release_notice.sql"],
    [17, "017_user_interface_language.sql"],
  ];
  for (const [version, filename] of migrations) {
    if (current >= version
      && (version !== 10 || hasColumn("users", "theme"))
      && (version !== 11 || hasColumn("project_memberships", "department_ids_json"))
      && (version !== 17 || hasColumn("users", "interface_language"))) continue;
    const sql = fs.readFileSync(path.join(ROOT, "migrations", filename), "utf8");
    const statements = sql.split(/;\s*(?:\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    db.transaction(() => {
      for (const statement of statements) {
        const match = /^ALTER TABLE ([a-z_]+) ADD COLUMN ([a-z_]+)/i.exec(statement);
        if (match && hasColumn(match[1], match[2])) continue;
        db.exec(`${statement};`);
      }
    })();
  }
  backfillOwners();
}

function rowToAccess(row) {
  if (!row) return null;
  return {
    id: row.id, projectId: row.project_id, userId: row.user_id || null, guestId: row.guest_id || null,
    projectRole: row.project_role, cinematicRole: row.cinematic_role || null,
    modulePermissions: jsonParse(row.module_permissions_json, {}),
    financialPermissions: jsonParse(row.financial_permissions_json, ["financial.no_access"]),
    financialDepartmentIds: jsonParse(row.financial_department_ids_json, []),
    departmentIds: jsonParse(row.department_ids_json, []), status: row.status,
    invitedByUserId: row.invited_by_user_id, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function backfillOwners() {
  const insert = db.prepare(`INSERT OR IGNORE INTO project_memberships
    (id, project_id, user_id, project_role, module_permissions_json, financial_permissions_json, financial_department_ids_json, status, invited_by_user_id, version, created_at, updated_at)
    VALUES (?, ?, ?, 'owner', ?, ?, '[]', 'active', ?, 1, ?, ?)`);
  const timestamp = nowIso();
  db.transaction(() => {
    for (const script of db.prepare("SELECT id, user_id FROM scripts").all()) {
      insert.run(id("mem"), script.id, script.user_id, JSON.stringify(permissionsForRole("owner")), JSON.stringify(normalizeFinancialPermissions([], "owner")), script.user_id, timestamp, timestamp);
    }
  })();
}

runPlatformMigrations();

export function projectAccess(userId, projectId) {
  if (!userId || !projectId) return null;
  const script = db.prepare("SELECT id, user_id FROM scripts WHERE id = ?").get(projectId);
  if (!script) return null;
  if (script.user_id === userId) return rowToAccess(db.prepare("SELECT * FROM project_memberships WHERE project_id = ? AND user_id = ? AND status = 'active'").get(projectId, userId)) || {
    id: `owner:${projectId}`, projectId, userId, projectRole: "owner", cinematicRole: null,
    modulePermissions: permissionsForRole("owner"), financialPermissions: normalizeFinancialPermissions([], "owner"), financialDepartmentIds: [], status: "active", version: 1,
  };
  return rowToAccess(db.prepare("SELECT * FROM project_memberships WHERE project_id = ? AND user_id = ? AND status = 'active'").get(projectId, userId));
}

export function listAccessibleProjectIds(userId) {
  if (!userId) return [];
  return db.prepare(`SELECT id FROM scripts WHERE user_id = ? UNION SELECT project_id AS id FROM project_memberships WHERE user_id = ? AND status = 'active'`).all(userId, userId).map((row) => row.id);
}

export function canReadUserAvatar(requesterUserId, targetUserId) {
  if (!requesterUserId || !targetUserId) return false;
  if (requesterUserId === targetUserId) return true;
  return Boolean(db.prepare(`SELECT 1 FROM
    (SELECT id AS project_id FROM scripts WHERE user_id=?
      UNION SELECT project_id FROM project_memberships WHERE user_id=? AND status='active') requester
    JOIN
    (SELECT id AS project_id FROM scripts WHERE user_id=?
      UNION SELECT project_id FROM project_memberships WHERE user_id=? AND status='active') target
    USING (project_id) LIMIT 1`).get(requesterUserId, requesterUserId, targetUserId, targetUserId));
}

export function requireProjectPermission(userId, projectId, module, level = "view") {
  const access = projectAccess(userId, projectId);
  if (!access) throw Object.assign(new Error("Project access was not found."), { status: 404, code: "project_not_found" });
  if (!canAccessModule(access, module, level)) throw Object.assign(new Error("You do not have permission for this project action."), { status: 403, code: "permission_denied" });
  return access;
}

export function financialAccess(userId, projectId, { edit = false, departmentId = null } = {}) {
  const access = projectAccess(userId, projectId);
  return { access, allowed: edit ? canEditFinancialData(access, departmentId) : canViewFinancialData(access, departmentId) };
}

export function listMembers(projectId, actorUserId) {
  requireProjectPermission(actorUserId, projectId, "members", "view");
  return db.prepare(`SELECT project_memberships.*, users.name, users.email, users.picture_url, users.username, users.avatar_key, users.avatar_crop_json
    FROM project_memberships LEFT JOIN users ON users.id = project_memberships.user_id
    WHERE project_id = ? AND status != 'removed' ORDER BY CASE project_role WHEN 'owner' THEN 0 WHEN 'co_owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, updated_at DESC`).all(projectId).map((row) => ({ ...rowToAccess(row), name: row.name || "Guest", email: row.email || null, username: row.username || null, ...avatarPresentationFromRow(row, { userIdKey: "user_id" }) }));
}

function rowToInvitation(row) {
  if (!row) return null;
  const snapshot = jsonParse(row.permission_snapshot_json, {});
  const effectiveStatus = row.status === "pending" && row.expires_at && Date.parse(row.expires_at) <= Date.now() ? "expired" : row.status;
  return {
    id: row.id, projectRole: row.project_role, cinematicRole: row.cinematic_role || null,
    invitedUserId: row.invited_user_id || null, invitedUsername: row.invited_username || null,
    invitedEmail: row.invited_email || null, permissions: snapshot, status: effectiveStatus,
    permissionSummary: Object.entries(snapshot.modulePermissions || {}).filter(([, level]) => level !== "no_access").map(([module, level]) => `${module.replaceAll("_", " ")}: ${level}`).slice(0, 4),
    financialSummary: financialSummary({ financialPermissions: snapshot.financialPermissions || [] }),
    expiresAt: row.expires_at || null, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function invitationTargetMatchesUser(row, user) {
  if (!row || !user) return false;
  if (row.invited_user_id) return row.invited_user_id === user.id;
  return Boolean(
    row.invited_email
    && user.email_verified
    && user.email
    && normalizedEmail(row.invited_email) === normalizedEmail(user.email)
  );
}

function invitationProjectFromRow(row) {
  const owner = row?.owner_user_id ? {
    id: row.owner_user_id,
    name: row.owner_name || "FilmScript collaborator",
    ...avatarPresentationFromRow(row, { userIdKey: "owner_user_id", pictureKey: "owner_picture_url" }),
  } : null;
  return {
    id: row.project_id,
    title: row.project_title || "FilmScript project",
    owner,
    ownerName: owner?.name || null,
  };
}

function rowToAccountInvitation(row) {
  if (!row) return null;
  const project = invitationProjectFromRow(row);
  return {
    ...rowToInvitation(row),
    projectId: row.project_id,
    projectTitle: project.title,
    ownerName: project.ownerName,
    project,
  };
}

const accountInvitationSelect = `SELECT project_invitations.*, scripts.title AS project_title,
  scripts.user_id AS owner_user_id, owners.name AS owner_name,
  owners.picture_url AS owner_picture_url, owners.avatar_key AS avatar_key,
  owners.avatar_crop_json AS avatar_crop_json
  FROM project_invitations
  JOIN scripts ON scripts.id=project_invitations.project_id
  LEFT JOIN users owners ON owners.id=scripts.user_id`;

function accountUser(userId) {
  return db.prepare("SELECT id,email,email_verified FROM users WHERE id=?").get(userId) || null;
}

function accountInvitationById(invitationId, userId) {
  const user = accountUser(userId);
  if (!user) return null;
  const row = db.prepare(`${accountInvitationSelect} WHERE project_invitations.id=?`).get(invitationId);
  return invitationTargetMatchesUser(row, user) ? row : null;
}

export function listAccountInvitations(userId, { includeResolved = false } = {}) {
  const user = accountUser(userId);
  if (!user) throw Object.assign(new Error("Sign in to view project invitations."), { status: 401, code: "authentication_required" });
  const rows = db.prepare(`${accountInvitationSelect}
    WHERE (project_invitations.invited_user_id=@userId
      OR (project_invitations.invited_user_id IS NULL AND @emailVerified=1
        AND lower(project_invitations.invited_email)=@email))
      AND (@includeResolved=1 OR (project_invitations.status='pending'
        AND (project_invitations.expires_at IS NULL OR project_invitations.expires_at>@now)))
    ORDER BY project_invitations.updated_at DESC`).all({
    userId,
    email: normalizedEmail(user.email),
    emailVerified: user.email_verified ? 1 : 0,
    includeResolved: includeResolved ? 1 : 0,
    now: nowIso(),
  });
  return rows.map(rowToAccountInvitation);
}

export function listInvitations(projectId, actorUserId) {
  requireProjectPermission(actorUserId, projectId, "members", "view");
  return db.prepare("SELECT * FROM project_invitations WHERE project_id=? ORDER BY created_at DESC").all(projectId).map(rowToInvitation);
}

function resolveInviteTarget({ username, email }) {
  if (username) return db.prepare("SELECT id, email, username FROM users WHERE lower(username) = lower(?)").get(String(username).trim()) || null;
  if (email) return db.prepare("SELECT id, email, username FROM users WHERE lower(email) = lower(?)").get(String(email).trim()) || null;
  return null;
}

export function createInvitation(projectId, actorUserId, input = {}) {
  const actor = requireProjectPermission(actorUserId, projectId, "members", "manage");
  const role = validateProjectRole(input.projectRole, "viewer");
  if (role === "owner") throw Object.assign(new Error("Use ownership transfer to assign the owner role."), { status: 422 });
  if (actor.projectRole === "admin" && ["co_owner", "admin"].includes(role)) throw Object.assign(new Error("Only an owner or co owner can assign this role."), { status: 403 });
  if (!input.username && !input.email && role !== "temporary_guest") throw Object.assign(new Error("Enter a FilmScript username or email."), { status: 422, code: "invitation_target_required" });
  const email = normalizedEmail(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Enter a valid email address."), { status: 422, code: "invalid_email" });
  const target = resolveInviteTarget({ username: input.username, email });
  if (target?.id && projectAccess(target.id, projectId)) {
    throw Object.assign(new Error("This person already has access to the project."), { status: 409, code: "already_project_member" });
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const timestamp = nowIso(); const invitationId = id("inv");
  const cinematicRole = validateCinematicRole(input.cinematicRole);
  const permissions = permissionsForRole(role, cinematicRole, validatePermissionInput(input.modulePermissions || {}));
  const financialPermissions = normalizeFinancialPermissions(validateFinancialInput(input.financialPermissions), role);
  if (financialPermissions[0] !== "financial.no_access" && !(actor.financialPermissions || []).includes("financial.manage_access")) throw Object.assign(new Error("You cannot grant financial access."), { status: 403, code: "financial_permission_denied" });
  const snapshot = { modulePermissions: permissions, financialPermissions, financialDepartmentIds: Array.isArray(input.financialDepartmentIds) ? input.financialDepartmentIds.map(String) : [], departmentIds: Array.isArray(input.departmentIds) ? input.departmentIds.map(String) : [] };
  const expiresAt = invitationExpiry(input.expiresAt);
  db.prepare(`INSERT INTO project_invitations
    (id, project_id, invited_user_id, invited_username, invited_email, token_hash, project_role, cinematic_role, permission_snapshot_json, status, expires_at, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`)
    .run(invitationId, projectId, target?.id || null, input.username || target?.username || null, email || target?.email || null, hash(token), role, cinematicRole, JSON.stringify(snapshot), expiresAt, actorUserId, timestamp, timestamp);
  recordActivity({ projectId, module: "members", actorUserId, entityType: "invitation", entityId: invitationId, action: "project.member.invited", summary: `Invitation created for ${email || input.username || "a collaborator"}.`, containsFinancialData: financialPermissions[0] !== "financial.no_access" });
  if (target?.id) createNotification({ userId: target.id, projectId, type: "project_invitation", title: "Project invitation", message: "You were invited to collaborate in FilmScript.", actorUserId, deepLink: "/App.dc.html", metadata: { invitationId } });
  return { id: invitationId, token, projectId, projectRole: role, cinematicRole, invitedEmail: email || target?.email || null, invitedUsername: input.username || target?.username || null, permissions: snapshot, status: "pending", expiresAt };
}

export function updateInvitation(projectId, invitationId, actorUserId, input = {}) {
  const actor = requireProjectPermission(actorUserId, projectId, "members", "manage");
  const current = db.prepare("SELECT * FROM project_invitations WHERE id=? AND project_id=?").get(invitationId, projectId);
  if (!current) throw Object.assign(new Error("Invitation was not found."), { status: 404, code: "invitation_not_found" });
  if (current.status !== "pending") throw Object.assign(new Error("Only a pending invitation can be edited."), { status: 409, code: "invitation_not_pending" });
  const role = validateProjectRole(input.projectRole || current.project_role, current.project_role);
  if (role === "owner" || (actor.projectRole === "admin" && ["co_owner", "admin"].includes(role))) throw Object.assign(new Error("You cannot assign that project role."), { status: 403 });
  const cinematicRole = input.cinematicRole === undefined ? current.cinematic_role : validateCinematicRole(input.cinematicRole);
  const existing = jsonParse(current.permission_snapshot_json, {});
  const modulePermissions = permissionsForRole(role, cinematicRole, validatePermissionInput(input.modulePermissions || existing.modulePermissions || {}));
  const financialPermissions = normalizeFinancialPermissions(validateFinancialInput(input.financialPermissions ?? existing.financialPermissions), role);
  if (JSON.stringify(financialPermissions) !== JSON.stringify(existing.financialPermissions || ["financial.no_access"]) && !(actor.financialPermissions || []).includes("financial.manage_access")) throw Object.assign(new Error("You cannot change financial access."), { status: 403, code: "financial_permission_denied" });
  const snapshot = { modulePermissions, financialPermissions, financialDepartmentIds: Array.isArray(input.financialDepartmentIds) ? input.financialDepartmentIds.map(String) : existing.financialDepartmentIds || [], departmentIds: Array.isArray(input.departmentIds) ? input.departmentIds.map(String) : existing.departmentIds || [] };
  db.prepare("UPDATE project_invitations SET project_role=?, cinematic_role=?, permission_snapshot_json=?, expires_at=?, updated_at=? WHERE id=?")
    .run(role, cinematicRole, JSON.stringify(snapshot), input.expiresAt ? invitationExpiry(input.expiresAt) : current.expires_at, nowIso(), invitationId);
  recordActivity({ projectId, module: "members", actorUserId, entityType: "invitation", entityId: invitationId, action: "project.invitation.permissions_changed", summary: "Pending invitation access was updated.", containsFinancialData: financialPermissions[0] !== "financial.no_access" });
  return rowToInvitation(db.prepare("SELECT * FROM project_invitations WHERE id=?").get(invitationId));
}

export function revokeInvitation(projectId, invitationId, actorUserId) {
  requireProjectPermission(actorUserId, projectId, "members", "manage");
  const timestamp = nowIso();
  const result = db.prepare("UPDATE project_invitations SET status='revoked', revoked_at=?, updated_at=? WHERE id=? AND project_id=? AND status='pending'").run(timestamp, timestamp, invitationId, projectId);
  if (!result.changes) throw Object.assign(new Error("Pending invitation was not found."), { status: 404, code: "invitation_not_found" });
  db.prepare("UPDATE project_guest_sessions SET revoked_at=? WHERE invitation_id=? AND revoked_at IS NULL").run(timestamp, invitationId);
  recordActivity({ projectId, module: "members", actorUserId, entityType: "invitation", entityId: invitationId, action: "project.invitation.revoked", summary: "Invitation access was revoked." });
  return { id: invitationId, status: "revoked" };
}

export function rotateInvitationToken(projectId, invitationId, actorUserId) {
  requireProjectPermission(actorUserId, projectId, "members", "manage");
  const token = crypto.randomBytes(32).toString("base64url"); const timestamp = nowIso();
  const result = db.prepare("UPDATE project_invitations SET token_hash=?, updated_at=? WHERE id=? AND project_id=? AND status='pending' AND (expires_at IS NULL OR expires_at>?)").run(hash(token), timestamp, invitationId, projectId, timestamp);
  if (!result.changes) throw Object.assign(new Error("This invitation is no longer available."), { status: 410, code: "invitation_unavailable" });
  db.prepare("UPDATE project_guest_sessions SET revoked_at=? WHERE invitation_id=? AND revoked_at IS NULL").run(timestamp, invitationId);
  return { token, invitation: rowToInvitation(db.prepare("SELECT * FROM project_invitations WHERE id=?").get(invitationId)) };
}

function updateInvitationNotificationState(userId, invitationId, projectId, status, timestamp) {
  const rows = db.prepare("SELECT id,metadata_json FROM notifications WHERE user_id=? AND project_id=? AND type='project_invitation'").all(userId, projectId);
  let matchedLegacyNotification = false;
  for (const notification of rows) {
    const metadata = jsonParse(notification.metadata_json, {});
    if (metadata.invitationId && metadata.invitationId !== invitationId) continue;
    if (!metadata.invitationId && matchedLegacyNotification) continue;
    if (!metadata.invitationId) matchedLegacyNotification = true;
    const nextMetadata = { ...metadata, invitationId, invitationStatus: status };
    const deepLink = status === "accepted"
      ? `/App.dc.html?acceptedProject=${encodeURIComponent(projectId)}`
      : "/App.dc.html";
    db.prepare("UPDATE notifications SET metadata_json=?, deep_link=?, read_at=COALESCE(read_at,?), updated_at=? WHERE id=?")
      .run(JSON.stringify(nextMetadata), deepLink, timestamp, timestamp, notification.id);
  }
}

function completeInvitationAcceptance(row, userId) {
  const user = db.prepare("SELECT id,email,email_verified,username FROM users WHERE id=?").get(userId);
  if (!user) throw Object.assign(new Error("Sign in before accepting this invitation."), { status: 401, code: "authentication_required" });
  if (row.status === "accepted") {
    if (!invitationTargetMatchesUser(row, user)) throw Object.assign(new Error("This invitation belongs to another account."), { status: 403, code: "invitation_account_mismatch" });
    const existing = projectAccess(userId, row.project_id);
    if (existing) return existing;
    throw Object.assign(new Error("This invitation could not be reconciled with project access."), { status: 409, code: "invitation_membership_missing" });
  }
  if (row.status !== "pending") throw Object.assign(new Error("This invitation is no longer available."), { status: 410, code: "invitation_unavailable" });
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) throw Object.assign(new Error("This invitation is no longer available."), { status: 410, code: "invitation_unavailable" });
  if (!invitationTargetMatchesUser(row, user)) throw Object.assign(new Error("This invitation belongs to another account."), { status: 403, code: "invitation_account_mismatch" });
  const snapshot = jsonParse(row.permission_snapshot_json, {});
  const timestamp = nowIso();
  let changed = false;
  let membershipCreated = false;
  db.transaction(() => {
    const current = db.prepare("SELECT status,expires_at FROM project_invitations WHERE id=?").get(row.id);
    if (current?.status === "accepted") return;
    if (current?.status !== "pending" || (current.expires_at && Date.parse(current.expires_at) <= Date.now())) throw Object.assign(new Error("This invitation is no longer available."), { status: 410, code: "invitation_unavailable" });
    const billingOwner = db.prepare("SELECT user_id FROM scripts WHERE id=?").get(row.project_id)?.user_id === userId;
    const activeMembership = db.prepare("SELECT id FROM project_memberships WHERE project_id=? AND user_id=? AND status='active'").get(row.project_id, userId);
    // A stale or duplicate invitation must never rewrite access that is already
    // active. In particular, the billing owner's canonical owner permissions
    // cannot be downgraded through an invitation created by another member.
    if (!billingOwner && !activeMembership) {
      db.prepare(`INSERT INTO project_memberships
        (id, project_id, user_id, project_role, cinematic_role, module_permissions_json, financial_permissions_json, financial_department_ids_json, department_ids_json, status, invited_by_user_id, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 1, ?, ?)
        ON CONFLICT(project_id, user_id) DO UPDATE SET project_role=excluded.project_role, cinematic_role=excluded.cinematic_role, module_permissions_json=excluded.module_permissions_json, financial_permissions_json=excluded.financial_permissions_json, financial_department_ids_json=excluded.financial_department_ids_json, department_ids_json=excluded.department_ids_json, status='active', version=project_memberships.version+1, updated_at=excluded.updated_at`)
        .run(id("mem"), row.project_id, userId, row.project_role, row.cinematic_role, JSON.stringify(snapshot.modulePermissions || {}), JSON.stringify(snapshot.financialPermissions || ["financial.no_access"]), JSON.stringify(snapshot.financialDepartmentIds || []), JSON.stringify(snapshot.departmentIds || []), row.created_by_user_id, timestamp, timestamp);
      membershipCreated = true;
    }
    db.prepare("UPDATE project_invitations SET invited_user_id=COALESCE(invited_user_id,?), status='accepted', updated_at=? WHERE id=?")
      .run(userId, timestamp, row.id);
    db.prepare(`UPDATE project_invitations SET status='revoked', revoked_at=?, updated_at=?
      WHERE project_id=? AND id!=? AND status='pending'
        AND (invited_user_id=? OR (invited_user_id IS NULL AND lower(invited_email)=?))`)
      .run(timestamp, timestamp, row.project_id, row.id, userId, normalizedEmail(user.email));
    updateInvitationNotificationState(userId, row.id, row.project_id, "accepted", timestamp);
    changed = true;
  })();
  const membership = projectAccess(userId, row.project_id);
  if (!membership) throw Object.assign(new Error("Project access could not be created."), { status: 409, code: "membership_creation_failed" });
  if (changed && membershipCreated) recordActivity({ projectId: row.project_id, module: "members", actorUserId: userId, entityType: "membership", entityId: membership.id, action: "project.member.joined", summary: `${user.username || user.email || "A collaborator"} joined the project.` });
  return membership;
}

export function acceptInvitation(token, userId) {
  const row = db.prepare("SELECT * FROM project_invitations WHERE token_hash=?").get(hash(token));
  if (!row) throw Object.assign(new Error("This invitation is no longer available."), { status: 410, code: "invitation_unavailable" });
  return completeInvitationAcceptance(row, userId);
}

export function acceptAccountInvitation(invitationId, userId) {
  const row = accountInvitationById(invitationId, userId);
  if (!row) throw Object.assign(new Error("Invitation was not found."), { status: 404, code: "invitation_not_found" });
  const membership = completeInvitationAcceptance(row, userId);
  const invitation = rowToAccountInvitation(accountInvitationById(invitationId, userId));
  return { membership, invitation, project: invitation.project };
}

export function declineAccountInvitation(invitationId, userId) {
  const row = accountInvitationById(invitationId, userId);
  if (!row) throw Object.assign(new Error("Invitation was not found."), { status: 404, code: "invitation_not_found" });
  if (row.status === "declined") return rowToAccountInvitation(row);
  if (row.status !== "pending" || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) throw Object.assign(new Error("This invitation is no longer available."), { status: 410, code: "invitation_unavailable" });
  const timestamp = nowIso();
  let changed = false;
  const updated = db.transaction(() => {
    const result = db.prepare("UPDATE project_invitations SET invited_user_id=COALESCE(invited_user_id,?), status='declined', declined_at=?, updated_at=? WHERE id=? AND status='pending'")
      .run(userId, timestamp, timestamp, invitationId);
    if (!result.changes) {
      const current = accountInvitationById(invitationId, userId);
      if (current?.status === "declined") return current;
      throw Object.assign(new Error("This invitation is no longer available."), { status: 410, code: "invitation_unavailable" });
    }
    changed = true;
    updateInvitationNotificationState(userId, invitationId, row.project_id, "declined", timestamp);
    return accountInvitationById(invitationId, userId);
  })();
  if (changed) recordActivity({ projectId: row.project_id, module: "members", actorUserId: userId, entityType: "invitation", entityId: invitationId, action: "project.invitation.declined", summary: "Project invitation was declined." });
  return rowToAccountInvitation(updated);
}

export function createGuestSession(invitationToken) {
  const row = db.prepare("SELECT * FROM project_invitations WHERE token_hash=?").get(hash(invitationToken));
  if (!row || row.status !== "pending" || row.project_role !== "temporary_guest" || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) throw Object.assign(new Error("This guest invitation is no longer available."), { status: 410, code: "invitation_unavailable" });
  const token = crypto.randomBytes(32).toString("base64url"); const timestamp = nowIso();
  const expiresAt = new Date(Math.min(Date.parse(row.expires_at), Date.now() + 24 * 60 * 60 * 1000)).toISOString();
  db.prepare("INSERT INTO project_guest_sessions (id, invitation_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?,?,?,?,?,?)")
    .run(id("gst"), row.id, hash(token), expiresAt, timestamp, timestamp);
  return { token, expiresAt, invitation: rowToInvitation(row) };
}

export function guestProjectAccess(guestToken) {
  if (!guestToken) return null;
  const timestamp = nowIso();
  const row = db.prepare(`SELECT project_guest_sessions.id AS guest_session_id, project_invitations.*
    FROM project_guest_sessions JOIN project_invitations ON project_invitations.id=project_guest_sessions.invitation_id
    WHERE project_guest_sessions.token_hash=? AND project_guest_sessions.revoked_at IS NULL AND project_guest_sessions.expires_at>?
      AND project_invitations.status='pending' AND (project_invitations.expires_at IS NULL OR project_invitations.expires_at>?)`).get(hash(guestToken), timestamp, timestamp);
  if (!row) return null;
  db.prepare("UPDATE project_guest_sessions SET last_seen_at=? WHERE id=?").run(timestamp, row.guest_session_id);
  const snapshot = jsonParse(row.permission_snapshot_json, {});
  return { id: `guest:${row.guest_session_id}`, projectId: row.project_id, userId: null, guestId: row.guest_session_id, projectRole: "temporary_guest", cinematicRole: row.cinematic_role, modulePermissions: permissionsForRole("temporary_guest", row.cinematic_role, snapshot.modulePermissions || {}), financialPermissions: ["financial.no_access"], financialDepartmentIds: [], departmentIds: snapshot.departmentIds || [], status: "active", invitationId: row.id };
}

export function projectBillingOwnerId(projectId) {
  return db.prepare("SELECT user_id FROM scripts WHERE id=?").get(projectId)?.user_id || null;
}

export function setProjectArchived(projectId, actorUserId, archived) {
  const access = requireProjectPermission(actorUserId, projectId, "project_settings", "edit");
  if (!["owner", "co_owner", "admin"].includes(access.projectRole)) throw Object.assign(new Error("You cannot archive this project."), { status: 403 });
  const timestamp = nowIso();
  db.prepare(`INSERT INTO project_states (project_id, archived_at, archived_by_user_id, updated_at) VALUES (?,?,?,?)
    ON CONFLICT(project_id) DO UPDATE SET archived_at=excluded.archived_at, archived_by_user_id=excluded.archived_by_user_id, updated_at=excluded.updated_at`)
    .run(projectId, archived ? timestamp : null, archived ? actorUserId : null, timestamp);
  recordActivity({ projectId, module: "project_settings", actorUserId, entityType: "project", entityId: projectId, action: archived ? "project.archived" : "project.restored", summary: archived ? "Project was archived." : "Project was restored." });
  return { projectId, archived: !!archived, archivedAt: archived ? timestamp : null };
}

export function projectState(projectId) {
  const row = db.prepare("SELECT * FROM project_states WHERE project_id=?").get(projectId);
  return { archived: !!row?.archived_at, archivedAt: row?.archived_at || null };
}

export function updateMembership(projectId, membershipId, actorUserId, input = {}) {
  const actor = requireProjectPermission(actorUserId, projectId, "members", "manage");
  const current = db.prepare("SELECT * FROM project_memberships WHERE id = ? AND project_id = ?").get(membershipId, projectId);
  if (!current) throw Object.assign(new Error("Member was not found."), { status: 404 });
  if (current.project_role === "owner") throw Object.assign(new Error("Transfer ownership before changing the owner."), { status: 422 });
  const role = validateProjectRole(input.projectRole || current.project_role, current.project_role);
  if (actor.projectRole === "admin" && ["co_owner", "admin"].includes(role)) throw Object.assign(new Error("Only an owner or co owner can assign this role."), { status: 403 });
  const cinematicRole = input.cinematicRole === undefined ? current.cinematic_role : validateCinematicRole(input.cinematicRole);
  const currentPermissions = jsonParse(current.module_permissions_json, {});
  const permissions = permissionsForRole(role, cinematicRole, validatePermissionInput(input.modulePermissions || (role === current.project_role ? currentPermissions : {})));
  const previousFinancial = jsonParse(current.financial_permissions_json, []);
  const financial = normalizeFinancialPermissions(validateFinancialInput(input.financialPermissions ?? previousFinancial), role);
  if (JSON.stringify(financial) !== JSON.stringify(previousFinancial) && !(actor.financialPermissions || []).includes("financial.manage_access")) throw Object.assign(new Error("You cannot change financial access."), { status: 403, code: "financial_permission_denied" });
  const departments = Array.isArray(input.financialDepartmentIds) ? input.financialDepartmentIds.map(String) : jsonParse(current.financial_department_ids_json, []);
  const departmentIds = Array.isArray(input.departmentIds) ? input.departmentIds.map(String) : jsonParse(current.department_ids_json, []);
  const status = ["active", "suspended", "removed"].includes(input.status) ? input.status : current.status;
  db.prepare(`UPDATE project_memberships SET project_role=?, cinematic_role=?, module_permissions_json=?, financial_permissions_json=?, financial_department_ids_json=?, department_ids_json=?, status=?, version=version+1, updated_at=? WHERE id=?`)
    .run(role, cinematicRole, JSON.stringify(permissions), JSON.stringify(financial), JSON.stringify(departments), JSON.stringify(departmentIds), status, nowIso(), membershipId);
  recordActivity({ projectId, module: "members", actorUserId, entityType: "membership", entityId: membershipId, action: status === "removed" ? "project.member.removed" : "project.permission.changed", summary: status === "removed" ? "Project access was revoked." : "Project permissions were updated.", containsFinancialData: JSON.stringify(financial) !== current.financial_permissions_json });
  if (current.user_id) createNotification({ userId: current.user_id, projectId, type: status === "removed" ? "removed_from_project" : "permission_changed", title: status === "removed" ? "Project access removed" : "Permissions updated", message: status === "removed" ? "Your project access was removed." : "Your project permissions changed.", actorUserId, deepLink: `/App.dc.html?project=${encodeURIComponent(projectId)}` });
  return { ...rowToAccess(db.prepare("SELECT * FROM project_memberships WHERE id=?").get(membershipId)), name: db.prepare("SELECT name FROM users WHERE id=?").get(current.user_id)?.name || null };
}

export function transferProjectOwnership(projectId, actorUserId, targetMembershipId) {
  const actor = projectAccess(actorUserId, projectId);
  if (actor?.projectRole !== "owner") throw Object.assign(new Error("Only the billing owner can transfer ownership."), { status: 403 });
  const target = db.prepare("SELECT * FROM project_memberships WHERE id=? AND project_id=? AND user_id IS NOT NULL AND status='active'").get(targetMembershipId, projectId);
  if (!target) throw Object.assign(new Error("Choose an active account member."), { status: 422 });
  const timestamp = nowIso();
  db.transaction(() => {
    db.prepare("UPDATE scripts SET user_id=?, updated_at=? WHERE id=?").run(target.user_id, timestamp, projectId);
    db.prepare("UPDATE project_memberships SET project_role='co_owner', module_permissions_json=?, financial_permissions_json=?, version=version+1, updated_at=? WHERE project_id=? AND user_id=?")
      .run(JSON.stringify(permissionsForRole("co_owner")), JSON.stringify(["financial.no_access"]), timestamp, projectId, actorUserId);
    db.prepare("UPDATE project_memberships SET project_role='owner', module_permissions_json=?, financial_permissions_json=?, version=version+1, updated_at=? WHERE id=?")
      .run(JSON.stringify(permissionsForRole("owner")), JSON.stringify(normalizeFinancialPermissions([], "owner")), timestamp, targetMembershipId);
  })();
  recordActivity({ projectId, module: "members", actorUserId, entityType: "project", entityId: projectId, action: "project.ownership.transferred", summary: "Project ownership was transferred." });
  createNotification({ userId: target.user_id, projectId, type: "ownership_transfer", title: "You are now the project owner", message: "Billing ownership and project ownership were transferred to you.", actorUserId, deepLink: `/App.dc.html?project=${encodeURIComponent(projectId)}` });
  return projectAccess(target.user_id, projectId);
}

export function recordActivity(event) {
  const timestamp = event.createdAt || nowIso(); const eventId = event.id || id("act");
  db.prepare(`INSERT INTO activity_events (id, project_id, module, actor_user_id, actor_type, entity_type, entity_id, action, summary, before_json, after_json, contains_financial_data, financial_department_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(eventId, event.projectId, PROJECT_MODULES.includes(event.module) ? event.module : "project_settings", event.actorUserId || null, event.actorType || "user", event.entityType || "project", event.entityId || null, event.action, String(event.summary || "Project updated.").slice(0, 400), event.before === undefined ? null : JSON.stringify(event.before), event.after === undefined ? null : JSON.stringify(event.after), event.containsFinancialData ? 1 : 0, event.financialDepartmentId || null, timestamp);
  return eventId;
}

export function listActivity(projectId, actorUserId, module = null, limit = 50, cursor = null) {
  const access = requireProjectPermission(actorUserId, projectId, module && PROJECT_MODULES.includes(module) ? module : "script", "view");
  const financial = canViewFinancialData(access);
  const rows = db.prepare(`SELECT activity_events.*, users.name, users.picture_url, users.avatar_key, users.avatar_crop_json FROM activity_events LEFT JOIN users ON users.id=activity_events.actor_user_id
    WHERE activity_events.project_id=? AND (? IS NULL OR activity_events.module=?) AND (? IS NULL OR activity_events.created_at < ?) AND (? = 1 OR activity_events.contains_financial_data = 0) ORDER BY activity_events.created_at DESC LIMIT ?`)
    .all(projectId, module, module, cursor, cursor, financial ? 1 : 0, Math.min(100, Math.max(1, Number(limit) || 50)));
  return rows.map((row) => ({ id: row.id, projectId: row.project_id, module: row.module, actor: { id: row.actor_user_id, name: row.name || (row.actor_type === "lumiere" ? "Lumiere" : "FilmScript"), type: row.actor_type, ...avatarPresentationFromRow(row, { userIdKey: "actor_user_id" }) }, entityType: row.entity_type, entityId: row.entity_id, action: row.action, summary: row.summary, before: jsonParse(row.before_json, null), after: jsonParse(row.after_json, null), createdAt: row.created_at }));
}

export function createNotification(input) {
  if (!input.userId) return null;
  const timestamp = nowIso();
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {};
  if (input.aggregationKey) {
    const existing = db.prepare("SELECT id FROM notifications WHERE user_id=? AND aggregation_key=? AND read_at IS NULL AND updated_at > ?").get(input.userId, input.aggregationKey, new Date(Date.now() - 10 * 60_000).toISOString());
    if (existing) {
      db.prepare("UPDATE notifications SET title=?, message=?, metadata_json=?, updated_at=? WHERE id=?").run(input.title, input.message, JSON.stringify(metadata), timestamp, existing.id);
      return existing.id;
    }
  }
  const notificationId = id("not");
  db.prepare(`INSERT INTO notifications (id,user_id,project_id,type,title,message,actor_user_id,deep_link,contains_financial_data,financial_department_id,aggregation_key,metadata_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(notificationId, input.userId, input.projectId || null, input.type, input.title, input.message, input.actorUserId || null, input.deepLink || null, input.containsFinancialData ? 1 : 0, input.financialDepartmentId || null, input.aggregationKey || null, JSON.stringify(metadata), timestamp, timestamp);
  return notificationId;
}

export function listNotifications(userId, { limit = 40 } = {}) {
  const rows = db.prepare(`SELECT notifications.*, users.name AS actor_name, users.picture_url, users.avatar_key, users.avatar_crop_json FROM notifications LEFT JOIN users ON users.id=notifications.actor_user_id WHERE notifications.user_id=? ORDER BY notifications.updated_at DESC LIMIT ?`).all(userId, Math.min(100, Math.max(1, Number(limit) || 40)));
  const allInvitations = rows.some((row) => row.type === "project_invitation") ? listAccountInvitations(userId, { includeResolved: true }) : [];
  return rows.map((row) => {
    const metadata = jsonParse(row.metadata_json, {});
    let invitation = null;
    if (row.type === "project_invitation") {
      const matched = (metadata.invitationId ? allInvitations.find((item) => item.id === metadata.invitationId) : null)
        || allInvitations.find((item) => item.projectId === row.project_id);
      if (matched) invitation = {
        id: matched.id,
        status: matched.status,
        projectId: matched.projectId,
        projectTitle: matched.projectTitle,
        projectRole: matched.projectRole,
        cinematicRole: matched.cinematicRole,
        ownerName: matched.ownerName,
      };
    }
    return { id: row.id, projectId: row.project_id, type: row.type, title: row.title, message: row.message, actor: row.actor_user_id ? { id: row.actor_user_id, name: row.actor_name, ...avatarPresentationFromRow(row, { userIdKey: "actor_user_id" }) } : null, deepLink: row.deep_link, read: !!row.read_at, invitation, createdAt: row.created_at, updatedAt: row.updated_at };
  });
}

export function markNotificationsRead(userId, notificationId = null) {
  const timestamp = nowIso();
  if (notificationId) db.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?), updated_at=? WHERE id=? AND user_id=?").run(timestamp, timestamp, notificationId, userId);
  else db.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?), updated_at=? WHERE user_id=? AND read_at IS NULL").run(timestamp, timestamp, userId);
  return db.prepare("SELECT count(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL").get(userId).count;
}

export function deleteNotifications(userId, notificationId = null) {
  const result = notificationId
    ? db.prepare("DELETE FROM notifications WHERE id=? AND user_id=?").run(notificationId, userId)
    : db.prepare("DELETE FROM notifications WHERE user_id=?").run(userId);
  const unreadCount = db.prepare("SELECT count(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL").get(userId).count;
  return { deletedCount: result.changes, unreadCount };
}

function releaseVersionKey(value) {
  const releaseVersion = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(releaseVersion)) {
    throw Object.assign(new Error("Release version is invalid."), { status: 422, code: "invalid_release_version" });
  }
  return releaseVersion;
}

// Claiming happens before the UI opens. A unique user/release key means that
// another tab or device cannot receive the same announcement after it has
// already been presented once. Acknowledgement remains separately recorded
// when the person dismisses it.
export function claimReleaseNotice(userId, version) {
  if (!userId) throw Object.assign(new Error("Sign in to view this update."), { status: 401, code: "google_sign_in_required" });
  const releaseVersion = releaseVersionKey(version);
  const timestamp = nowIso();
  const result = db.prepare(`INSERT INTO release_notice_acknowledgements (user_id,release_version,presented_at)
    VALUES (?,?,?) ON CONFLICT(user_id,release_version) DO NOTHING`).run(userId, releaseVersion, timestamp);
  const row = db.prepare("SELECT presented_at,acknowledged_at FROM release_notice_acknowledgements WHERE user_id=? AND release_version=?").get(userId, releaseVersion);
  return {
    releaseVersion,
    shouldPresent: result.changes === 1,
    presentedAt: row?.presented_at || null,
    acknowledgedAt: row?.acknowledged_at || null,
  };
}

export function acknowledgeReleaseNotice(userId, version) {
  if (!userId) throw Object.assign(new Error("Sign in to acknowledge this update."), { status: 401, code: "google_sign_in_required" });
  const releaseVersion = releaseVersionKey(version);
  const timestamp = nowIso();
  db.prepare(`INSERT INTO release_notice_acknowledgements (user_id,release_version,presented_at,acknowledged_at)
    VALUES (?,?,?,?)
    ON CONFLICT(user_id,release_version) DO UPDATE SET acknowledged_at=COALESCE(release_notice_acknowledgements.acknowledged_at,excluded.acknowledged_at)`)
    .run(userId, releaseVersion, timestamp, timestamp);
  const row = db.prepare("SELECT presented_at,acknowledged_at FROM release_notice_acknowledgements WHERE user_id=? AND release_version=?").get(userId, releaseVersion);
  return { releaseVersion, presentedAt: row?.presented_at || null, acknowledgedAt: row?.acknowledged_at || null };
}

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 32).toString("hex");
  return { salt, hash: derived };
}

export function verifySharedPassword(shared, password) {
  if (!shared.password_hash || !shared.password_salt) return false;
  const candidate = crypto.scryptSync(String(password || ""), shared.password_salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(shared.password_hash, "hex"));
}

export function createSharedProject(projectId, actorUserId, input = {}) {
  requireProjectPermission(actorUserId, projectId, "shared_projects", "manage");
  const accessMode = ["public", "password", "email_restricted"].includes(input.accessMode) ? input.accessMode : "public";
  if (accessMode === "password" && String(input.password || "").length < 8) throw Object.assign(new Error("Use a password with at least eight characters."), { status: 422 });
  const sections = (Array.isArray(input.sections) ? input.sections : []).filter((section) => PROJECT_MODULES.includes(section?.module) && section.canView).map((section) => ({ module: section.module, canView: true, canExport: section.canExport === true }));
  if (!sections.length) throw Object.assign(new Error("Select at least one section to share."), { status: 422 });
  const record = accessMode === "password" ? passwordRecord(input.password) : {};
  const sharedId = id("shr"); const slug = crypto.randomBytes(18).toString("base64url"); const timestamp = nowIso();
  db.prepare(`INSERT INTO shared_projects (id,project_id,created_by_user_id,slug,status,access_mode,password_hash,password_salt,allowed_emails_json,sections_json,cover_json,created_at,updated_at)
    VALUES (?,?,?,?,'active',?,?,?,?,?,?,?,?)`).run(sharedId, projectId, actorUserId, slug, accessMode, record.hash || null, record.salt || null, JSON.stringify((input.allowedEmails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean)), JSON.stringify(sections), JSON.stringify(input.cover || {}), timestamp, timestamp);
  recordActivity({ projectId, module: "shared_projects", actorUserId, entityType: "shared_project", entityId: sharedId, action: "shared_project.created", summary: "Shared Project settings were created." });
  return { id: sharedId, projectId, slug, status: "active", accessMode, allowedEmails: input.allowedEmails || [], sections, cover: input.cover || {}, createdAt: timestamp, updatedAt: timestamp };
}

export function getSharedProject(slug) {
  const row = db.prepare("SELECT shared_projects.*, scripts.title AS project_title FROM shared_projects JOIN scripts ON scripts.id=shared_projects.project_id WHERE slug=?").get(slug);
  if (!row) return null;
  return { id: row.id, projectId: row.project_id, createdByUserId: row.created_by_user_id, slug: row.slug, status: row.status, accessMode: row.access_mode, password_hash: row.password_hash, password_salt: row.password_salt, allowedEmails: jsonParse(row.allowed_emails_json, []), sections: jsonParse(row.sections_json, []), cover: jsonParse(row.cover_json, {}), projectTitle: row.project_title, createdAt: row.created_at, updatedAt: row.updated_at, revokedAt: row.revoked_at };
}

export function authorizeSharedProject(slug, { email = null, password = null } = {}) {
  const shared = getSharedProject(slug);
  if (!shared || shared.status !== "active") throw Object.assign(new Error("This Shared Project link has been revoked."), { status: 410, code: "shared_project_revoked" });
  if (shared.accessMode === "password" && !verifySharedPassword(shared, password)) throw Object.assign(new Error("That password is not correct."), { status: 401, code: "shared_password_required" });
  if (shared.accessMode === "email_restricted" && (!email || !shared.allowedEmails.includes(String(email).toLowerCase()))) throw Object.assign(new Error("Sign in with an invited email address."), { status: 403, code: "shared_email_required" });
  const { password_hash, password_salt, ...safe } = shared;
  return safe;
}

export function revokeSharedProject(sharedId, actorUserId) {
  const row = db.prepare("SELECT * FROM shared_projects WHERE id=?").get(sharedId);
  if (!row) throw Object.assign(new Error("Shared Project was not found."), { status: 404 });
  requireProjectPermission(actorUserId, row.project_id, "shared_projects", "manage");
  const timestamp = nowIso(); db.prepare("UPDATE shared_projects SET status='revoked', revoked_at=?, updated_at=? WHERE id=?").run(timestamp, timestamp, sharedId);
  recordActivity({ projectId: row.project_id, module: "shared_projects", actorUserId, entityType: "shared_project", entityId: sharedId, action: "shared_project.revoked", summary: "Shared Project access was revoked." });
}

export function createAIJob(input) {
  const existing = db.prepare("SELECT * FROM ai_jobs WHERE idempotency_key=?").get(input.idempotencyKey);
  if (existing) return rowToJob(existing);
  const jobId = id("job"); const timestamp = nowIso();
  db.prepare(`INSERT INTO ai_jobs (id,project_id,requested_by_user_id,type,status,progress,stage,source_script_id,source_script_version_id,source_content_hash,internal_primary_model,reserved_credits,idempotency_key,input_json,output_schema_version,created_at,updated_at)
    VALUES (?,?,?,?,'queued',0,'queued',?,?,?,?,?,?,?, ?,?,?)`).run(jobId, input.projectId, input.requestedByUserId, input.type, input.sourceScriptId, input.sourceScriptVersionId, input.sourceContentHash, input.internalPrimaryModel, Number(input.reservedCredits)||0, input.idempotencyKey, JSON.stringify(input.input || {}), Number(input.outputSchemaVersion)||1, timestamp, timestamp);
  return getAIJob(jobId, input.requestedByUserId, true);
}

function rowToJob(row, internal = false) {
  if (!row) return null;
  const job = { id: row.id, projectId: row.project_id, requestedByUserId: row.requested_by_user_id, type: row.type, status: row.status, progress: row.progress, stage: row.stage, sourceScriptId: row.source_script_id, sourceScriptVersionId: row.source_script_version_id, sourceContentHash: row.source_content_hash, reservedCredits: row.reserved_credits, settledCredits: row.settled_credits, input: jsonParse(row.input_json, {}), output: jsonParse(row.output_json, null), outputSchemaVersion: row.output_schema_version, errorCode: row.error_code, createdAt: row.created_at, startedAt: row.started_at, completedAt: row.completed_at, updatedAt: row.updated_at };
  if (internal) Object.assign(job, { internalPrimaryModel: row.internal_primary_model, internalCompletedModel: row.internal_completed_model, usedFallback: !!row.used_fallback });
  return job;
}

export function getAIJob(jobId, userId, internal = false) {
  const row = db.prepare("SELECT * FROM ai_jobs WHERE id=?").get(jobId);
  if (!row) return null;
  const access = projectAccess(userId, row.project_id);
  if (!access) return null;
  return rowToJob(row, internal);
}

export function updateAIJob(jobId, patch = {}) {
  const current = db.prepare("SELECT * FROM ai_jobs WHERE id=?").get(jobId);
  if (!current) return null;
  const status = patch.status || current.status; const timestamp = nowIso();
  db.prepare(`UPDATE ai_jobs SET status=?,progress=?,stage=?,internal_completed_model=?,used_fallback=?,settled_credits=?,output_json=?,error_code=?,started_at=?,completed_at=?,updated_at=? WHERE id=?`)
    .run(status, Math.max(0, Math.min(100, Number(patch.progress ?? current.progress))), patch.stage || current.stage, patch.internalCompletedModel ?? current.internal_completed_model, patch.usedFallback === undefined ? current.used_fallback : patch.usedFallback ? 1 : 0, Number(patch.settledCredits ?? current.settled_credits), patch.output === undefined ? current.output_json : JSON.stringify(patch.output), patch.errorCode ?? current.error_code, patch.startedAt ?? current.started_at ?? (status === "processing" ? timestamp : null), patch.completedAt ?? current.completed_at ?? (["completed","failed","cancelled"].includes(status) ? timestamp : null), timestamp, jobId);
  return rowToJob(db.prepare("SELECT * FROM ai_jobs WHERE id=?").get(jobId), true);
}

export function saveCollaborationOperation(input) {
  const operationId = input.id || id("op");
  db.prepare(`INSERT INTO collaboration_operations (id,project_id,document_id,module,entity_type,entity_id,actor_user_id,base_version,committed_version,operation_type,patch_json,previous_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(operationId, input.projectId, input.documentId, input.module, input.entityType, input.entityId, input.actorUserId, input.baseVersion, input.committedVersion, input.operationType, JSON.stringify(input.patch || {}), JSON.stringify(input.previous || {}), nowIso());
  for (const conflict of input.conflicts || []) db.prepare(`INSERT INTO content_conflicts (id,project_id,operation_id,module,entity_id,field,current_value_json,incoming_value_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(id("cnf"), input.projectId, operationId, input.module, input.entityId, conflict.field, JSON.stringify(conflict.currentValue), JSON.stringify(conflict.incomingValue), nowIso());
  return operationId;
}

export function collaborationDelta(projectId, documentId, sinceVersion = 0, limit = 500) {
  return db.prepare(`SELECT * FROM collaboration_operations WHERE project_id=? AND document_id=? AND committed_version>? ORDER BY committed_version ASC LIMIT ?`).all(projectId, documentId, Number(sinceVersion)||0, Math.min(1000, Math.max(1, Number(limit)||500))).map((row) => ({ id: row.id, projectId: row.project_id, documentId: row.document_id, module: row.module, entityType: row.entity_type, entityId: row.entity_id, actorUserId: row.actor_user_id, baseVersion: row.base_version, committedVersion: row.committed_version, operationType: row.operation_type, patch: jsonParse(row.patch_json, {}), createdAt: row.created_at }));
}

export function getCollaborationDocument(projectId, documentId) {
  const row = db.prepare("SELECT * FROM collaboration_documents WHERE project_id=? AND document_id=?").get(projectId, documentId);
  if (!row) return null;
  return { projectId: row.project_id, documentId: row.document_id, module: row.module, snapshot: new Uint8Array(row.snapshot_blob), version: row.version, updatedAt: row.updated_at };
}

export function saveCollaborationDocument(projectId, documentId, module, snapshot) {
  const current = db.prepare("SELECT version FROM collaboration_documents WHERE project_id=? AND document_id=?").get(projectId, documentId);
  const version = Number(current?.version || 0) + 1; const updatedAt = nowIso();
  db.prepare(`INSERT INTO collaboration_documents (project_id,document_id,module,snapshot_blob,version,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(project_id,document_id) DO UPDATE SET module=excluded.module,snapshot_blob=excluded.snapshot_blob,version=excluded.version,updated_at=excluded.updated_at`)
    .run(projectId, documentId, module, Buffer.from(snapshot), version, updatedAt);
  return { version, updatedAt };
}

export function getCollaborationEntity(projectId, documentId, entityId) {
  const row = db.prepare("SELECT * FROM collaboration_entities WHERE project_id=? AND document_id=? AND entity_id=?").get(projectId, documentId, entityId);
  if (!row) return null;
  return { projectId: row.project_id, documentId: row.document_id, module: row.module, entityType: row.entity_type, entityId: row.entity_id, value: jsonParse(row.value_json, {}), fieldVersions: jsonParse(row.field_versions_json, {}), version: row.version, updatedAt: row.updated_at };
}

export function saveCollaborationEntity(input) {
  const updatedAt = nowIso();
  db.prepare(`INSERT INTO collaboration_entities (project_id,document_id,module,entity_type,entity_id,value_json,field_versions_json,version,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(project_id,document_id,entity_id) DO UPDATE SET module=excluded.module,entity_type=excluded.entity_type,value_json=excluded.value_json,field_versions_json=excluded.field_versions_json,version=excluded.version,updated_at=excluded.updated_at`)
    .run(input.projectId, input.documentId, input.module, input.entityType, input.entityId, JSON.stringify(input.value || {}), JSON.stringify(input.fieldVersions || {}), Number(input.version) || 0, updatedAt);
  return { ...input, updatedAt };
}

export function listLocationPlans(projectId, userId) {
  requireProjectPermission(userId, projectId, "location_plan", "view");
  return db.prepare("SELECT * FROM location_plans WHERE project_id=? ORDER BY updated_at DESC").all(projectId).map((row) => jsonParse(row.data_json, null)).filter(Boolean);
}

export function saveLocationPlan(projectId, userId, plan, expectedVersion = null) {
  requireProjectPermission(userId, projectId, "location_plan", "edit");
  const current = db.prepare("SELECT * FROM location_plans WHERE id=? AND project_id=?").get(plan.id, projectId);
  if (current && expectedVersion !== null && Number(expectedVersion) !== current.version) throw Object.assign(new Error("This Location Plan changed on another device. Review the latest version before saving."), { status: 409, code: "stale_write", current: jsonParse(current.data_json, null) });
  const timestamp = nowIso(); const next = { ...plan, projectId, version: (current?.version || 0) + 1, updatedAt: timestamp };
  db.prepare(`INSERT INTO location_plans (id,project_id,name,data_json,version,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,data_json=excluded.data_json,version=excluded.version,updated_at=excluded.updated_at`).run(next.id, projectId, String(next.name || "Location Plan").slice(0,160), JSON.stringify(next), next.version, current?.created_by_user_id || userId, current?.created_at || timestamp, timestamp);
  recordActivity({ projectId, module: "location_plan", actorUserId: userId, entityType: "location_plan", entityId: next.id, action: current ? "content.committed" : "location_plan.created", summary: current ? "Location Plan updated." : "Location Plan created." });
  return next;
}

export function listComments(projectId, userId, module = null, entityId = null) {
  requireProjectPermission(userId, projectId, module && PROJECT_MODULES.includes(module) ? module : "script", "view");
  return db.prepare(`SELECT project_comments.*, users.name, users.picture_url, users.avatar_key, users.avatar_crop_json FROM project_comments LEFT JOIN users ON users.id=project_comments.author_user_id
    WHERE project_id=? AND (? IS NULL OR module=?) AND (? IS NULL OR entity_id=?) ORDER BY created_at ASC`)
    .all(projectId, module, module, entityId, entityId).map((row) => ({ id: row.id, projectId: row.project_id, module: row.module, entityType: row.entity_type, entityId: row.entity_id, coordinate: jsonParse(row.coordinate_json, null), body: row.body, author: { id: row.author_user_id, name: row.name || "Guest", ...avatarPresentationFromRow(row, { userIdKey: "author_user_id" }) }, resolved: !!row.resolved_at, resolvedAt: row.resolved_at, createdAt: row.created_at, updatedAt: row.updated_at }));
}

export function createComment(projectId, userId, input = {}) {
  const module = PROJECT_MODULES.includes(input.module) ? input.module : "script";
  requireProjectPermission(userId, projectId, module, "comment");
  const body = String(input.body || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, 5000);
  if (!body) throw Object.assign(new Error("Write a comment before posting."), { status: 422 });
  const commentId = id("cmt"); const timestamp = nowIso();
  db.prepare(`INSERT INTO project_comments (id,project_id,module,entity_type,entity_id,coordinate_json,body,author_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(commentId, projectId, module, String(input.entityType || "project").slice(0,80), input.entityId || null, input.coordinate ? JSON.stringify(input.coordinate) : null, body, userId, timestamp, timestamp);
  recordActivity({ projectId, module, actorUserId: userId, entityType: "comment", entityId: commentId, action: "comment.created", summary: "A comment was added." });
  const mentioned = [...body.matchAll(/@([a-z0-9_]{2,30})/gi)].map((match) => match[1].toLowerCase());
  if (mentioned.length) {
    const placeholders = mentioned.map(() => "?").join(",");
    for (const user of db.prepare(`SELECT id FROM users WHERE lower(username) IN (${placeholders})`).all(...mentioned)) {
      if (user.id !== userId && projectAccess(user.id, projectId)) createNotification({ userId: user.id, projectId, type: "mention", title: "You were mentioned", message: body.slice(0,220), actorUserId: userId, deepLink: `/Editor%20v5.dc.html?script=${encodeURIComponent(projectId)}&view=${encodeURIComponent(module)}` });
    }
  }
  return listComments(projectId, userId, module, input.entityId || null).find((comment) => comment.id === commentId);
}

function messagePeerId(projectId, userId, peerUserId, { invalidStatus = 404 } = {}) {
  requireProjectPermission(userId, projectId, "script", "view");
  const peer = String(peerUserId || "").trim();
  const peerAccess = peer ? projectAccess(peer, projectId) : null;
  if (!peer || !peerAccess || !canAccessModule(peerAccess, "script", "view")) {
    throw Object.assign(new Error("That collaborator is not available for this project chat."), { status: invalidStatus, code: "collaborator_not_found" });
  }
  return peer;
}

// Chat intentionally exposes less than People & Access. Any collaborator who
// can see the screenplay can message another screenplay-visible collaborator,
// without receiving roles, permissions, department assignments, or finance data.
export function listProjectMessagePeers(projectId, userId) {
  requireProjectPermission(userId, projectId, "script", "view");
  const rows = db.prepare(`SELECT DISTINCT users.id, users.name, users.email, users.picture_url, users.avatar_key, users.avatar_crop_json
    FROM users
    WHERE users.id != ? AND users.id IN (
      SELECT user_id FROM scripts WHERE id = ?
      UNION
      SELECT user_id FROM project_memberships WHERE project_id = ? AND status = 'active' AND user_id IS NOT NULL
    )
    ORDER BY lower(COALESCE(users.name, users.email, users.id)), users.id`).all(userId, projectId, projectId);
  return rows
    .filter((row) => {
      const access = projectAccess(row.id, projectId);
      return !!access && canAccessModule(access, "script", "view");
    })
    .map((row) => ({
      userId: row.id,
      name: row.name || row.email || "Collaborator",
      email: row.email || null,
      ...avatarPresentationFromRow(row),
    }));
}

export function listProjectMessages(projectId, userId, peerUserId) {
  const peer = messagePeerId(projectId, userId, peerUserId);
  db.prepare("UPDATE project_messages SET read_at=? WHERE project_id=? AND sender_user_id=? AND recipient_user_id=? AND read_at IS NULL").run(nowIso(), projectId, peer, userId);
  return db.prepare(`SELECT m.*, s.name AS sender_name, r.name AS recipient_name FROM project_messages m LEFT JOIN users s ON s.id=m.sender_user_id LEFT JOIN users r ON r.id=m.recipient_user_id WHERE m.project_id=? AND ((m.sender_user_id=? AND m.recipient_user_id=?) OR (m.sender_user_id=? AND m.recipient_user_id=?)) ORDER BY m.created_at ASC LIMIT 200`).all(projectId, userId, peer, peer, userId).map((row) => ({ id: row.id, projectId: row.project_id, senderId: row.sender_user_id, recipientId: row.recipient_user_id, senderName: row.sender_name || "Collaborator", recipientName: row.recipient_name || "Collaborator", body: row.body, createdAt: row.created_at, readAt: row.read_at }));
}

export function createProjectMessage(projectId, userId, input = {}) {
  const recipientId = messagePeerId(projectId, userId, input.recipientId, { invalidStatus: 422 });
  if (recipientId === userId) throw Object.assign(new Error("Choose another collaborator in this project."), { status: 422, code: "invalid_recipient" });
  const body = String(input.body || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 2000);
  if (!body) throw Object.assign(new Error("Write a message before sending."), { status: 422, code: "empty_message" });
  const messageId = id("msg"); const timestamp = nowIso();
  db.prepare("INSERT INTO project_messages (id,project_id,sender_user_id,recipient_user_id,body,created_at) VALUES (?,?,?,?,?,?)").run(messageId, projectId, userId, recipientId, body, timestamp);
  createNotification({ userId: recipientId, projectId, type: "message", title: "New collaborator message", message: body.slice(0, 220), actorUserId: userId, deepLink: `/Editor%20v5.dc.html?script=${encodeURIComponent(projectId)}&view=editor&chat=${encodeURIComponent(userId)}` });
  return listProjectMessages(projectId, userId, recipientId).find((message) => message.id === messageId);
}

export function resolveComment(projectId, userId, commentId) {
  const row = db.prepare("SELECT * FROM project_comments WHERE id=? AND project_id=?").get(commentId, projectId);
  if (!row) throw Object.assign(new Error("Comment was not found."), { status: 404 });
  const access = requireProjectPermission(userId, projectId, row.module, "comment");
  if (row.author_user_id !== userId && !canAccessModule(access, row.module, "edit")) throw Object.assign(new Error("You do not have permission to resolve this comment."), { status: 403 });
  const timestamp = nowIso(); db.prepare("UPDATE project_comments SET resolved_at=?,resolved_by_user_id=?,updated_at=? WHERE id=?").run(timestamp, userId, timestamp, commentId);
  recordActivity({ projectId, module: row.module, actorUserId: userId, entityType: "comment", entityId: commentId, action: "comment.resolved", summary: "A comment was resolved." });
  return { ok: true, resolvedAt: timestamp };
}

export function userPlatformProfile(userId) {
  const row = db.prepare("SELECT username,theme,avatar_key,avatar_crop_json FROM users WHERE id=?").get(userId);
  return row ? { username: row.username || null, theme: row.theme || "filmscript", avatarKey: row.avatar_key || null, avatarCrop: cleanStoredAvatarCrop(jsonParse(row.avatar_crop_json, {})) } : null;
}

export function userAvatarPresentation(userId) {
  const cached = avatarPresentationCache.get(userId);
  if (cached && Date.now() - cached.createdAt < 15_000) return cached.value;
  const row = db.prepare("SELECT id,picture_url,avatar_key,avatar_crop_json FROM users WHERE id=?").get(userId);
  const value = row ? avatarPresentationFromRow(row) : null;
  avatarPresentationCache.set(userId, { value, createdAt: Date.now() });
  return value;
}

export function updateUserPlatformProfile(userId, input = {}) {
  const themes = new Set(["filmscript","dark","mint","tangerine","lavender","sky","rose","sun"]);
  const current = userPlatformProfile(userId); if (!current) return null;
  const username = input.username === undefined ? current.username : String(input.username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0,30) || null;
  const theme = input.theme === undefined ? current.theme : themes.has(input.theme) ? input.theme : "filmscript";
  const avatarCrop = avatarCropPatch(current.avatarCrop, input.avatarCrop);
  db.prepare("UPDATE users SET username=?,theme=?,avatar_key=?,avatar_crop_json=?,updated_at=? WHERE id=?").run(username, theme, input.avatarKey === undefined ? current.avatarKey : input.avatarKey || null, JSON.stringify(avatarCrop), nowIso(), userId);
  avatarPresentationCache.delete(userId);
  return userPlatformProfile(userId);
}

export const __platformDb = db;
