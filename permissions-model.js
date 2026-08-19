export const PROJECT_ROLES = Object.freeze([
  "owner", "co_owner", "admin", "editor", "department_editor", "commenter", "viewer", "temporary_guest",
]);

export const CINEMATIC_ROLES = Object.freeze([
  "producer", "director", "writer", "assistant_director", "director_of_photography", "camera_department",
  "gaffer", "grip", "production_designer", "art_department", "sound", "hair_and_makeup", "wardrobe",
  "production", "client", "talent",
]);

export const PROJECT_MODULES = Object.freeze([
  "script", "analysis", "breakdown", "shot_list", "stripboard", "calendar", "budget", "canvas",
  "location_plan", "imagine", "files", "project_settings", "members", "exports", "lumiere",
]);

export const PERMISSION_LEVELS = Object.freeze(["no_access", "view", "comment", "edit", "manage"]);
export const FINANCIAL_PERMISSIONS = Object.freeze([
  "financial.no_access", "financial.view_all", "financial.view_department", "financial.edit_all",
  "financial.edit_department", "financial.export", "financial.manage_access",
]);

const LEVEL_RANK = Object.freeze({ no_access: 0, view: 1, comment: 2, edit: 3, manage: 4 });
const ROLE_MAXIMUM = Object.freeze({ commenter: "comment", viewer: "view", temporary_guest: "view" });
const FULL_MODULE_ACCESS = Object.freeze(Object.fromEntries(PROJECT_MODULES.map((module) => [module, "manage"])));

const ROLE_DEFAULTS = Object.freeze({
  owner: FULL_MODULE_ACCESS,
  co_owner: { ...FULL_MODULE_ACCESS, project_settings: "edit" },
  admin: { ...FULL_MODULE_ACCESS, project_settings: "manage", members: "manage", budget: "no_access" },
  editor: Object.fromEntries(PROJECT_MODULES.map((module) => [module, ["project_settings", "members", "shared_projects", "budget"].includes(module) ? "no_access" : "edit"])),
  department_editor: Object.fromEntries(PROJECT_MODULES.map((module) => [module, "no_access"])),
  commenter: Object.fromEntries(PROJECT_MODULES.map((module) => [module, ["project_settings", "members", "budget"].includes(module) ? "no_access" : "comment"])),
  viewer: Object.fromEntries(PROJECT_MODULES.map((module) => [module, ["project_settings", "members", "budget", "lumiere"].includes(module) ? "no_access" : "view"])),
  temporary_guest: Object.fromEntries(PROJECT_MODULES.map((module) => [module, "no_access"])),
});

export const CINEMATIC_PRESETS = Object.freeze({
  producer: { script: "view", analysis: "view", breakdown: "edit", shot_list: "edit", stripboard: "edit", calendar: "edit", canvas: "edit", location_plan: "edit", files: "edit" },
  director: { script: "comment", analysis: "view", breakdown: "view", shot_list: "edit", stripboard: "view", calendar: "view", canvas: "edit", location_plan: "edit", lumiere: "view" },
  writer: { script: "edit", analysis: "edit", breakdown: "view", shot_list: "view", lumiere: "edit" },
  assistant_director: { script: "view", analysis: "view", breakdown: "edit", shot_list: "edit", stripboard: "manage", calendar: "edit" },
  director_of_photography: { script: "view", analysis: "view", breakdown: "view", shot_list: "edit", canvas: "edit", location_plan: "edit", calendar: "view", budget: "no_access" },
  camera_department: { script: "view", breakdown: "view", shot_list: "edit", canvas: "edit", location_plan: "edit" },
  gaffer: { script: "view", breakdown: "view", shot_list: "comment", canvas: "edit", location_plan: "edit" },
  grip: { script: "view", breakdown: "view", shot_list: "comment", canvas: "edit", location_plan: "edit" },
  production_designer: { script: "view", breakdown: "edit", canvas: "edit", location_plan: "edit", files: "edit" },
  art_department: { script: "view", breakdown: "edit", canvas: "edit", location_plan: "edit", files: "edit" },
  sound: { script: "view", breakdown: "edit", shot_list: "comment", location_plan: "edit" },
  hair_and_makeup: { script: "view", breakdown: "edit", calendar: "view", files: "edit" },
  wardrobe: { script: "view", breakdown: "edit", calendar: "view", files: "edit" },
  production: { script: "view", breakdown: "edit", stripboard: "edit", calendar: "edit", files: "edit", location_plan: "edit" },
  client: { script: "comment", analysis: "view", shot_list: "view", canvas: "view" },
  talent: { script: "view", calendar: "view" },
});

export function normalizeProjectRole(value, fallback = "viewer") {
  return PROJECT_ROLES.includes(value) ? value : fallback;
}

export function normalizePermissionLevel(value, fallback = "no_access") {
  return PERMISSION_LEVELS.includes(value) ? value : fallback;
}

export function permissionsForRole(role, cinematicRole = null, explicit = {}) {
  const normalizedRole = normalizeProjectRole(role);
  const base = { ...(ROLE_DEFAULTS[normalizedRole] || ROLE_DEFAULTS.viewer) };
  const cinematic = CINEMATIC_PRESETS[cinematicRole] || {};
  for (const [module, level] of Object.entries(cinematic)) {
    if (PROJECT_MODULES.includes(module) && LEVEL_RANK[level] > LEVEL_RANK[base[module]]) base[module] = level;
  }
  for (const module of PROJECT_MODULES) {
    if (Object.prototype.hasOwnProperty.call(explicit || {}, module)) base[module] = normalizePermissionLevel(explicit[module]);
  }
  const maximum = ROLE_MAXIMUM[normalizedRole];
  if (maximum) {
    for (const module of PROJECT_MODULES) {
      if (LEVEL_RANK[base[module]] > LEVEL_RANK[maximum]) base[module] = maximum;
    }
  }
  // Financial access is never inferred from a cinematic preset.
  if (normalizedRole !== "owner" && !Object.prototype.hasOwnProperty.call(explicit || {}, "budget")) base.budget = "no_access";
  if (normalizedRole === "temporary_guest") {
    base.members = "no_access";
    base.project_settings = "no_access";
    base.exports = "no_access";
    base.lumiere = "no_access";
    base.budget = "no_access";
  }
  return base;
}

export function normalizeFinancialPermissions(value, role = "viewer") {
  if (role === "owner") return ["financial.view_all", "financial.edit_all", "financial.export", "financial.manage_access"];
  if (role === "temporary_guest") return ["financial.no_access"];
  const requested = Array.isArray(value) ? value.filter((item) => FINANCIAL_PERMISSIONS.includes(item) && item !== "financial.no_access") : [];
  return requested.length ? [...new Set(requested)] : ["financial.no_access"];
}

export function permissionAtLeast(actual, needed) {
  return (LEVEL_RANK[normalizePermissionLevel(actual)] || 0) >= (LEVEL_RANK[normalizePermissionLevel(needed)] || 0);
}

export function canAccessModule(access, module, level = "view") {
  if (!access || access.status !== "active" || !PROJECT_MODULES.includes(module)) return false;
  return permissionAtLeast(access.modulePermissions?.[module], level);
}

export const canViewModule = (access, module) => canAccessModule(access, module, "view");
export const canCommentOnModule = (access, module) => canAccessModule(access, module, "comment");
export const canEditModule = (access, module) => canAccessModule(access, module, "edit");
export const canManageModule = (access, module) => canAccessModule(access, module, "manage");

export function canViewFinancialData(access, departmentId = null) {
  if (!access || access.status !== "active") return false;
  const permissions = new Set(access.financialPermissions || []);
  if (permissions.has("financial.view_all") || permissions.has("financial.edit_all")) return true;
  if (!departmentId) return false;
  return (permissions.has("financial.view_department") || permissions.has("financial.edit_department"))
    && (access.financialDepartmentIds || []).includes(departmentId);
}

export function canEditFinancialData(access, departmentId = null) {
  const permissions = new Set(access?.financialPermissions || []);
  if (permissions.has("financial.edit_all")) return true;
  return !!departmentId && permissions.has("financial.edit_department") && (access.financialDepartmentIds || []).includes(departmentId);
}

export function canUseLumiereAction(access, action) {
  if (!canAccessModule(access, "lumiere", action === "chat" ? "view" : "edit")) return false;
  if (["translation", "analysis", "breakdown", "breakdown_scene", "shot_list"].includes(action)) {
    const module = action === "translation" ? "script" : action === "breakdown_scene" ? "breakdown" : action;
    return canAccessModule(access, module, "edit");
  }
  return true;
}

const FINANCIAL_KEYS = /(?:cost|rate|price|amount|total|subtotal|budget|currency|quote|invoice|expense|funding|tax)/i;

export function filterFinancialData(value, access, departmentId = null) {
  if (canViewFinancialData(access, departmentId)) return value;
  if (Array.isArray(value)) return value.map((item) => filterFinancialData(item, access, departmentId));
  if (!value || typeof value !== "object") return value;
  const filtered = {};
  for (const [key, item] of Object.entries(value)) {
    if (FINANCIAL_KEYS.test(key)) continue;
    filtered[key] = filterFinancialData(item, access, departmentId);
  }
  return filtered;
}

export function filterDepartmentFinancialData(value, access, inheritedDepartmentId = null) {
  if (Array.isArray(value)) return value.map((item) => filterDepartmentFinancialData(item, access, inheritedDepartmentId));
  if (!value || typeof value !== "object") return value;
  const accountDepartmentId = Array.isArray(value.items) && value.id ? value.id : null;
  const departmentId = String(value.departmentId ?? value.department_id ?? value.department?.id ?? accountDepartmentId ?? inheritedDepartmentId ?? "") || null;
  const maySeeFinancial = canViewFinancialData(access, departmentId);
  const filtered = {};
  for (const [key, item] of Object.entries(value)) {
    if (FINANCIAL_KEYS.test(key) && !maySeeFinancial) continue;
    filtered[key] = filterDepartmentFinancialData(item, access, departmentId);
  }
  return filtered;
}

export function financialSummary(access) {
  const permissions = new Set(access?.financialPermissions || []);
  if (permissions.has("financial.manage_access")) return "Full access and access management";
  if (permissions.has("financial.edit_all")) return "Edit all financial information";
  if (permissions.has("financial.view_all")) return "View all financial information";
  if (permissions.has("financial.edit_department")) return "Edit assigned departments";
  if (permissions.has("financial.view_department")) return "View assigned departments";
  if (permissions.has("financial.export")) return "Export authorized financial information";
  return "No financial access";
}
