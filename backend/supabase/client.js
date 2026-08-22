import { previewError } from "./errors.js";

function encodedObjectPath(objectPath) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

export class SupabasePreviewClient {
  constructor(config, fetchImpl = (...args) => globalThis.fetch(...args)) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async request(pathname, {
    method = "GET",
    token = null,
    serviceRole = false,
    body,
    headers = {},
    expected = null,
  } = {}) {
    const credential = serviceRole ? this.config.serviceRoleKey : this.config.anonKey;
    const authorization = serviceRole ? credential : token;
    const response = await this.fetchImpl(new URL(pathname, `${this.config.baseUrl}/`), {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      headers: {
        apikey: credential,
        ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
        ...(body !== undefined && !Buffer.isBuffer(body) ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)),
    });

    if (expected && expected.includes(response.status)) return response;
    if (!expected && response.ok) return response;

    const status = response.status === 401 ? 401
      : response.status === 403 ? 403
        : response.status === 404 ? 404
          : response.status === 409 ? 409
          : response.status >= 400 && response.status < 500 ? 400
            : 502;
    const code = status === 401 ? "invalid_access_token"
      : status === 403 ? "permission_denied"
        : status === 404 ? "not_found"
          : status === 409 ? "profile_claim_conflict"
          : status === 400 ? "invalid_request"
            : "supabase_preview_unavailable";
    const fallback = status === 403 ? "You do not have permission to perform this action."
      : status === 404 ? "The requested resource was not found."
        : status === 409 ? "This verified account requires manual profile review."
        : status === 400 ? "The request could not be completed."
          : "The Supabase preview is temporarily unavailable.";
    // Do not relay PostgREST/Auth/Storage error bodies. They can contain table,
    // policy, provider, or deployment details that do not belong in the UI.
    throw previewError(status, code, fallback);
  }

  async json(pathname, options) {
    const response = await this.request(pathname, options);
    if (response.status === 204) return null;
    return response.json();
  }

  authUser(token) {
    return this.json("/auth/v1/user", { token });
  }

  rpc(name, args, token) {
    return this.json(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
      method: "POST",
      token,
      body: args,
      headers: { Prefer: "return=representation" },
    });
  }

  table(table, searchParams, token, { method = "GET", body, prefer } = {}) {
    const url = new URL(`/rest/v1/${encodeURIComponent(table)}`, `${this.config.baseUrl}/`);
    for (const [key, value] of Object.entries(searchParams || {})) {
      if (value != null) url.searchParams.set(key, String(value));
    }
    return this.json(`${url.pathname}${url.search}`, {
      method,
      token,
      body,
      headers: prefer ? { Prefer: prefer } : {},
    });
  }

  uploadObject(bucket, objectPath, bytes, mimeType) {
    const target = `/storage/v1/object/${encodeURIComponent(bucket)}/${encodedObjectPath(objectPath)}`;
    return this.request(target, {
      method: "POST",
      serviceRole: true,
      body: bytes,
      headers: { "content-type": mimeType, "x-upsert": "false" },
    });
  }

  deleteObject(bucket, objectPath) {
    const target = `/storage/v1/object/${encodeURIComponent(bucket)}/${encodedObjectPath(objectPath)}`;
    return this.request(target, {
      method: "DELETE",
      serviceRole: true,
      expected: [200, 204, 404],
    });
  }

  async signedObjectUrl(bucket, objectPath, filename) {
    const target = `/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedObjectPath(objectPath)}`;
    const payload = await this.json(target, {
      method: "POST",
      serviceRole: true,
      body: { expiresIn: 60 },
    });
    const raw = payload?.signedURL || payload?.signedUrl;
    if (typeof raw !== "string" || !raw) {
      throw previewError(502, "supabase_preview_unavailable", "A private download link could not be created.");
    }
    const signed = new URL(raw, `${this.config.baseUrl}/`);
    if (signed.origin !== new URL(this.config.baseUrl).origin) {
      throw previewError(502, "supabase_preview_unavailable", "The private download link was rejected.");
    }
    signed.searchParams.set("download", filename);
    return signed.toString();
  }
}
