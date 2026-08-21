const INVITATIONS_ENDPOINT = "https://api.filmscript.app/api/invitations";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST"]);

function upstreamUrl(req) {
  const rawPath = Array.isArray(req.query?.path)
    ? req.query.path.join("/")
    : String(req.query?.path || "");
  const segments = rawPath.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === ".." || segment.includes("\\") || segment.includes("\0"))) {
    return null;
  }
  const url = new URL(`${INVITATIONS_ENDPOINT}${segments.length ? `/${segments.map(encodeURIComponent).join("/")}` : ""}`);
  const incoming = new URL(req.url || "/api/access-proxy", "https://filmscript.app");
  incoming.searchParams.delete("path");
  for (const [key, value] of incoming.searchParams) url.searchParams.append(key, value);
  return url;
}

async function requestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function accessProxy(req, res) {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.statusCode = 405;
    res.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    return res.end("Method Not Allowed");
  }

  try {
    const target = upstreamUrl(req);
    if (!target) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ error: "invalid_access_path" }));
    }
    const body = await requestBody(req);
    const headers = {
      Accept: String(req.headers?.accept || "application/json"),
      Cookie: String(req.headers?.cookie || ""),
      "User-Agent": String(req.headers?.["user-agent"] || "FilmScript Access Proxy"),
    };
    if (req.headers?.["content-type"]) headers["Content-Type"] = String(req.headers["content-type"]);
    if (req.headers?.["x-filmscript-client-id"]) headers["X-FilmScript-Client-Id"] = String(req.headers["x-filmscript-client-id"]);
    if (req.headers?.["idempotency-key"]) headers["Idempotency-Key"] = String(req.headers["idempotency-key"]);
    if (req.headers?.["x-idempotency-key"]) headers["X-Idempotency-Key"] = String(req.headers["x-idempotency-key"]);
    if (req.headers?.origin) headers.Origin = String(req.headers.origin);

    const upstream = await fetch(target, {
      method: req.method,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers,
      body,
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    if (!upstream.ok) {
      let errorCode = "unknown";
      try { errorCode = JSON.parse(payload.toString("utf8"))?.error || errorCode; } catch {}
      console.error(`FilmScript access upstream returned ${upstream.status}: ${errorCode}`);
    }

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", String(payload.length));
    return res.end(req.method === "HEAD" ? undefined : payload);
  } catch (error) {
    console.error(`FilmScript access proxy failed: ${error?.message || "unknown error"}`);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "access_upstream_unavailable", message: "We could not reach your project invitations. Please try again." }));
  }
}
