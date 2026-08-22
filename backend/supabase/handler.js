import crypto from "node:crypto";

import { loadPreviewConfig, requireStorageService } from "./config.js";
import { SupabasePreviewClient } from "./client.js";
import { normalizePreviewError, previewError } from "./errors.js";

const PROJECT_ID = /^scr_[0-9a-f]{20,64}$/;
const MEDIA_ID = /^med_[0-9a-f]{32}$/;
const PROJECT_VERSION = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const READ_METHODS = new Set(["GET", "HEAD"]);
const SCRIPT_DOCUMENT_BYTES = 8 * 1024 * 1024;
const SCRIPT_METADATA_BYTES = 500_000;

function header(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "");
}

function sendJson(res, status, payload, method = "GET", extraHeaders = {}) {
  const bytes = Buffer.from(JSON.stringify(payload));
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Authorization");
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  if (method !== "HEAD") res.setHeader("Content-Length", String(bytes.length));
  return res.end(method === "HEAD" ? undefined : bytes);
}

function methodNotAllowed(res, method, allowed) {
  return sendJson(res, 405, { error: "method_not_allowed" }, method, { Allow: allowed.join(", ") });
}

function requestedSegments(req) {
  let rawPath;
  if (Array.isArray(req.query?.path)) rawPath = req.query.path.join("/");
  else if (typeof req.query?.path === "string") rawPath = req.query.path;
  else {
    const pathname = new URL(req.url || "/api/supabase", "https://filmscript.local").pathname;
    rawPath = pathname.replace(/^\/api\/supabase\/?/, "");
  }
  let decoded;
  try { decoded = decodeURIComponent(rawPath); }
  catch { throw previewError(400, "invalid_path", "The request path is invalid."); }
  const segments = decoded.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === ".."
    || segment.includes("\\") || segment.includes("\0"))) {
    throw previewError(400, "invalid_path", "The request path is invalid.");
  }
  return segments;
}

function bearerToken(req) {
  const authorization = header(req, "authorization");
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match || match[1].length > 8192) {
    throw previewError(401, "authentication_required", "A Supabase access token is required.");
  }
  return match[1];
}

async function readBytes(req, maximumBytes, tooLarge = () => (
  previewError(413, "upload_too_large", "Preview uploads are limited to 10 MiB.")
)) {
  const contentLength = Number(header(req, "content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw tooLarge();
  }
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > maximumBytes) throw tooLarge();
    return req.body;
  }
  if (typeof req.body === "string") {
    const value = Buffer.from(req.body);
    if (value.length > maximumBytes) throw tooLarge();
    return value;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > maximumBytes) throw tooLarge();
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function jsonBody(req, maximumBytes = 32 * 1024) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    let serialized;
    try { serialized = JSON.stringify(req.body); }
    catch { throw previewError(400, "invalid_json", "The request body must be valid JSON."); }
    if (Buffer.byteLength(serialized) > maximumBytes) {
      throw previewError(413, "request_too_large", "The request body is too large.");
    }
    return req.body;
  }
  const bytes = await readBytes(req, maximumBytes, () => (
    previewError(413, "request_too_large", "The request body is too large.")
  ));
  if (!bytes.length) return {};
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { throw previewError(400, "invalid_json", "The request body must be valid JSON."); }
}

function jsonSize(value) {
  try { return Buffer.byteLength(JSON.stringify(value)); }
  catch { throw previewError(400, "invalid_project_update", "The project update is invalid."); }
}

function safeFilename(value) {
  const original = String(value || "").trim().slice(0, 255);
  if (!original) throw previewError(400, "filename_required", "A filename is required.");
  let stored = original.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
  if (!/^[A-Za-z0-9]/.test(stored)) stored = `file-${stored.replace(/^[^A-Za-z0-9]+/, "")}`;
  if (!stored) stored = "file.bin";
  return { original, stored };
}

function mimeType(req) {
  const value = header(req, "content-type").split(";", 1)[0].trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(value)
    || value === "multipart/form-data") {
    throw previewError(415, "invalid_content_type", "Upload the file body with its exact content type.");
  }
  return value;
}

function normalizeProject(row, state = null, membership = null) {
  return {
    id: row.id,
    ownerUserId: row.user_id,
    title: row.title,
    filename: row.filename,
    source: row.source,
    text: row.text,
    blocks: row.blocks,
    chat: row.chat,
    titleRoom: row.title_room,
    characterNames: row.character_names,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: Boolean(state?.archived_at),
    archivedAt: state?.archived_at || null,
    role: row.user_id === membership?.currentUserId ? "owner" : (membership?.project_role || null),
  };
}

async function authenticatedContext(client, req) {
  const token = bearerToken(req);
  const identity = await client.authUser(token);
  if (!identity?.id || (!identity.email_confirmed_at && !identity.confirmed_at)) {
    throw previewError(401, "invalid_access_token", "The Supabase identity is not confirmed.");
  }
  let profileRows = await client.rpc("get_my_profile", {}, token);
  let profile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
  if (!profile?.id) {
    await client.rpc("preview_claim_verified_legacy_profile", {}, token);
    profileRows = await client.rpc("get_my_profile", {}, token);
    profile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
  }
  if (!profile?.id) {
    throw previewError(403, "profile_not_ready", "Your FilmScript profile is not ready yet.");
  }
  return { token, identity, profile };
}

async function listProjects(client, context, req) {
  const rows = await client.table("scripts", {
    select: "id,user_id,title,filename,source,created_at,updated_at",
    order: "updated_at.desc",
    limit: "200",
  }, context.token);
  const states = await client.table("project_states", {
    select: "project_id,archived_at,archived_by_user_id",
    limit: "500",
  }, context.token);
  const memberships = await client.table("project_memberships", {
    select: "project_id,project_role,status",
    user_id: `eq.${context.profile.id}`,
    status: "eq.active",
    limit: "500",
  }, context.token);
  const stateByProject = new Map(states.map((state) => [state.project_id, state]));
  const membershipByProject = new Map(memberships.map((membership) => [membership.project_id, {
    ...membership,
    currentUserId: context.profile.id,
  }]));
  const query = new URL(req.url || "/api/supabase/projects", "https://filmscript.local").searchParams;
  const archiveFilter = query.get("archived") || "false";
  if (!new Set(["true", "false", "all"]).has(archiveFilter)) {
    throw previewError(400, "invalid_archive_filter", "The archived filter is invalid.");
  }
  const projects = rows.map((row) => normalizeProject(
    row,
    stateByProject.get(row.id),
    membershipByProject.get(row.id) || { currentUserId: context.profile.id },
  )).filter((project) => archiveFilter === "all" || project.archived === (archiveFilter === "true"));
  return { projects };
}

async function readProject(client, context, projectId) {
  const rows = await client.table("scripts", {
    select: "id,user_id,title,filename,source,text,blocks,chat,title_room,character_names,created_at,updated_at",
    id: `eq.${projectId}`,
    limit: "1",
  }, context.token);
  if (!rows[0]) throw previewError(404, "project_not_found", "The project was not found.");
  const states = await client.table("project_states", {
    select: "project_id,archived_at,archived_by_user_id",
    project_id: `eq.${projectId}`,
    limit: "1",
  }, context.token);
  const memberships = await client.table("project_memberships", {
    select: "project_id,project_role,status",
    project_id: `eq.${projectId}`,
    user_id: `eq.${context.profile.id}`,
    status: "eq.active",
    limit: "1",
  }, context.token);
  return normalizeProject(rows[0], states[0], {
    ...memberships[0],
    currentUserId: context.profile.id,
  });
}

function projectPatch(body) {
  const has = (name) => Object.prototype.hasOwnProperty.call(body, name);
  const allowed = new Set(["title", "blocks", "chat", "titleRoom", "characterNames", "expectedUpdatedAt"]);
  const unknown = Object.keys(body).filter((name) => !allowed.has(name));
  if (unknown.length) {
    throw previewError(400, "invalid_project_update", "The project update contains unsupported fields.");
  }

  const patch = {};
  if (has("title")) {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    if (!title) throw previewError(400, "title_required", "A project title is required.");
    patch.title = title;
  }
  if (has("blocks")) {
    if (!Array.isArray(body.blocks)) {
      throw previewError(400, "invalid_project_update", "Screenplay blocks must be an array.");
    }
    patch.blocks = body.blocks;
  }
  if (has("chat")) {
    if (!Array.isArray(body.chat)) {
      throw previewError(400, "invalid_project_update", "Screenplay chat must be an array.");
    }
    patch.chat = body.chat.slice(0, 250)
      .map((message) => ({
        who: message?.who === "w" ? "w" : "l",
        text: String(message?.text || "").slice(0, 10_000),
      }))
      .filter((message) => message.text.trim());
  }
  for (const [requestName, columnName] of [
    ["titleRoom", "title_room"],
    ["characterNames", "character_names"],
  ]) {
    if (!has(requestName)) continue;
    const value = body[requestName];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw previewError(400, "invalid_project_update", `${requestName} must be an object.`);
    }
    if (jsonSize(value) > SCRIPT_METADATA_BYTES) {
      throw previewError(413, "request_too_large", `${requestName} data is too large.`);
    }
    patch[columnName] = value;
  }
  if (!Object.keys(patch).length) {
    throw previewError(400, "invalid_project_update", "A supported project field is required.");
  }

  const changesDocument = ["blocks", "chat", "title_room", "character_names"]
    .some((column) => Object.prototype.hasOwnProperty.call(patch, column));
  let expectedUpdatedAt = null;
  if (changesDocument) {
    expectedUpdatedAt = typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt.trim() : "";
    if (!PROJECT_VERSION.test(expectedUpdatedAt) || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
      throw previewError(
        428,
        "project_version_required",
        "The current project updatedAt value is required for document updates.",
      );
    }
  }
  return { patch, expectedUpdatedAt };
}

async function updateProject(client, context, projectId, req) {
  const body = await jsonBody(req, SCRIPT_DOCUMENT_BYTES);
  const { patch, expectedUpdatedAt } = projectPatch(body);
  const permission = await client.rpc("has_project_permission", {
    requested_project_id: projectId,
    requested_module: "script",
    needed_level: "edit",
  }, context.token);
  if (permission !== true) {
    throw previewError(404, "project_not_found", "The project was not found.");
  }
  const result = await client.rpc("preview_update_project_document", {
    requested_project_id: projectId,
    requested_expected_updated_at: expectedUpdatedAt,
    requested_patch: patch,
  }, context.token);
  if (result?.status === "conflict") {
    throw previewError(409, "project_version_conflict", "The project changed before this update was saved.");
  }
  if (result?.status !== "updated" || !result.project?.id) {
    throw previewError(502, "supabase_preview_unavailable", "The project update could not be confirmed.");
  }
  return normalizeProject(result.project, null, { currentUserId: context.profile.id });
}

async function uploadFile(client, config, context, projectId, req, randomBytes) {
  requireStorageService(config);
  const permission = await client.rpc("has_project_permission", {
    requested_project_id: projectId,
    requested_module: "files",
    needed_level: "edit",
  }, context.token);
  if (permission !== true) {
    throw previewError(403, "permission_denied", "Project file edit permission is required.");
  }
  const filename = safeFilename(header(req, "x-filmscript-filename"));
  const contentType = mimeType(req);
  const bytes = await readBytes(req, config.maxUploadBytes);
  if (!bytes.length) throw previewError(400, "empty_upload", "The uploaded file is empty.");
  const mediaId = `med_${randomBytes(16).toString("hex")}`;
  const objectPath = `projects/${projectId}/files/${context.profile.id}/${mediaId}/${filename.stored}`;
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  await client.uploadObject(config.privateBucket, objectPath, bytes, contentType);
  try {
    const media = await client.rpc("preview_register_upload", {
      requested_project_id: projectId,
      requested_media_id: mediaId,
      requested_object_path: objectPath,
      requested_original_filename: filename.original,
      requested_mime_type: contentType,
      requested_size_bytes: bytes.length,
      requested_sha256: sha256,
    }, context.token);
    return media;
  } catch (error) {
    try {
      await client.deleteObject(config.privateBucket, objectPath);
    } catch {
      console.error("Supabase preview upload compensation failed; reconciliation is required.");
    }
    throw error;
  }
}

async function downloadFile(client, config, context, projectId, mediaId) {
  requireStorageService(config);
  const rows = await client.table("media_objects", {
    select: "id,project_id,bucket_id,object_path,original_filename,mime_type,size_bytes,sha256",
    id: `eq.${mediaId}`,
    project_id: `eq.${projectId}`,
    limit: "1",
  }, context.token);
  if (!rows[0]) throw previewError(404, "file_not_found", "The file was not found.");
  return client.signedObjectUrl(
    rows[0].bucket_id,
    rows[0].object_path,
    safeFilename(rows[0].original_filename || "download.bin").original,
  );
}

function assertProjectId(value) {
  if (!PROJECT_ID.test(value || "")) throw previewError(404, "project_not_found", "The project was not found.");
  return value;
}

export function createSupabasePreviewHandler({
  environment = process.env,
  fetchImpl = (...args) => globalThis.fetch(...args),
  randomBytes = crypto.randomBytes,
} = {}) {
  return async function supabasePreviewHandler(req, res) {
    const method = String(req.method || "GET").toUpperCase();
    try {
      const config = loadPreviewConfig(environment);
      const client = new SupabasePreviewClient(config, fetchImpl);
      const segments = requestedSegments(req);

      if (segments.length === 1 && segments[0] === "health") {
        if (!READ_METHODS.has(method)) return methodNotAllowed(res, method, ["GET", "HEAD"]);
        return sendJson(res, 200, { ok: true, backend: "supabase-preview", isolated: true }, method);
      }

      const context = await authenticatedContext(client, req);
      if (segments.length === 1 && segments[0] === "me") {
        if (!READ_METHODS.has(method)) return methodNotAllowed(res, method, ["GET", "HEAD"]);
        return sendJson(res, 200, { user: context.profile }, method);
      }
      if (segments.length === 1 && segments[0] === "projects") {
        if (READ_METHODS.has(method)) return sendJson(res, 200, await listProjects(client, context, req), method);
        if (method === "POST") {
          const body = await jsonBody(req);
          const project = await client.rpc("preview_create_project", {
            requested_title: String(body.title || "Untitled project"),
          }, context.token);
          return sendJson(res, 201, { project }, method);
        }
        return methodNotAllowed(res, method, ["GET", "HEAD", "POST"]);
      }
      if (segments[0] === "projects" && segments.length >= 2) {
        const projectId = assertProjectId(segments[1]);
        if (segments.length === 2) {
          if (READ_METHODS.has(method)) return sendJson(res, 200, { project: await readProject(client, context, projectId) }, method);
          if (method === "PATCH") return sendJson(res, 200, { project: await updateProject(client, context, projectId, req) }, method);
          return methodNotAllowed(res, method, ["GET", "HEAD", "PATCH"]);
        }
        if (segments.length === 3 && new Set(["archive", "restore"]).has(segments[2])) {
          if (method !== "POST") return methodNotAllowed(res, method, ["POST"]);
          const project = await client.rpc("preview_set_project_archived", {
            requested_project_id: projectId,
            requested_archived: segments[2] === "archive",
          }, context.token);
          return sendJson(res, 200, { project }, method);
        }
        if (segments.length === 3 && segments[2] === "files") {
          if (method !== "POST") return methodNotAllowed(res, method, ["POST"]);
          const media = await uploadFile(client, config, context, projectId, req, randomBytes);
          return sendJson(res, 201, { file: media }, method);
        }
        if (segments.length === 5 && segments[2] === "files" && segments[4] === "download") {
          if (!READ_METHODS.has(method)) return methodNotAllowed(res, method, ["GET", "HEAD"]);
          if (!MEDIA_ID.test(segments[3])) throw previewError(404, "file_not_found", "The file was not found.");
          const location = await downloadFile(client, config, context, projectId, segments[3]);
          const requestQuery = new URL(req.url || "/", "https://filmscript.local").searchParams;
          if (requestQuery.get("redirect") === "0") {
            return sendJson(res, 200, { downloadUrl: location, expiresIn: 60 }, method);
          }
          res.statusCode = 303;
          res.setHeader("Location", location);
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Content-Type-Options", "nosniff");
          return res.end();
        }
      }
      throw previewError(404, "not_found", "Not found.");
    } catch (rawError) {
      const error = normalizePreviewError(rawError);
      if (error.status >= 500) console.error(`Supabase preview request failed (${error.code}).`);
      return sendJson(res, error.status, {
        error: error.code,
        message: error.expose ? error.message : "The request could not be completed.",
      }, method);
    }
  };
}

export default createSupabasePreviewHandler();
