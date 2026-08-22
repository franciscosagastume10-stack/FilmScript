import { previewError } from "./errors.js";

const CLOUD_HOST_SUFFIX = ".supabase.co";

function required(environment, key) {
  const value = String(environment[key] || "").trim();
  if (!value) {
    throw previewError(
      503,
      "supabase_preview_not_configured",
      "The Supabase preview is not configured.",
    );
  }
  return value;
}

function normalizedBaseUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw previewError(503, "supabase_preview_not_configured", "The Supabase preview URL is invalid.");
  }
  const isLoopback = new Set(["127.0.0.1", "localhost", "::1"]).has(parsed.hostname);
  if (parsed.protocol !== "https:" && !(isLoopback && parsed.protocol === "http:")) {
    throw previewError(503, "supabase_preview_not_configured", "The Supabase preview URL is not trusted.");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return { baseUrl: parsed.toString().replace(/\/$/, ""), hostname: parsed.hostname, isLoopback };
}

export function loadPreviewConfig(environment = process.env) {
  if (environment.FILMSCRIPT_SUPABASE_PREVIEW_ENABLED !== "true"
    || environment.FILMSCRIPT_SUPABASE_PREVIEW_MODE !== "isolated"
    || environment.VERCEL_ENV === "production") {
    throw previewError(404, "not_found", "Not found.");
  }

  const target = normalizedBaseUrl(required(environment, "SUPABASE_URL"));
  if (!target.isLoopback) {
    if (!target.hostname.endsWith(CLOUD_HOST_SUFFIX)) {
      throw previewError(503, "supabase_preview_not_configured", "The Supabase preview host is invalid.");
    }
    const targetRef = target.hostname.slice(0, -CLOUD_HOST_SUFFIX.length);
    const previewRef = required(environment, "FILMSCRIPT_SUPABASE_PREVIEW_PROJECT_REF");
    const productionRef = required(environment, "FILMSCRIPT_SUPABASE_PRODUCTION_PROJECT_REF");
    if (targetRef !== previewRef || previewRef === productionRef) {
      throw previewError(
        503,
        "supabase_preview_target_rejected",
        "The Supabase preview target is not isolated from production.",
      );
    }
  }

  return Object.freeze({
    ...target,
    anonKey: required(environment, "SUPABASE_ANON_KEY"),
    serviceRoleKey: String(environment.SUPABASE_SERVICE_ROLE_KEY || "").trim() || null,
    privateBucket: "filmscript-private",
    maxUploadBytes: 10 * 1024 * 1024,
  });
}

export function requireStorageService(config) {
  if (!config.serviceRoleKey) {
    throw previewError(
      503,
      "supabase_preview_storage_not_configured",
      "Private preview uploads are not configured.",
    );
  }
  return config.serviceRoleKey;
}
