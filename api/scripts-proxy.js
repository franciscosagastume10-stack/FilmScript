const SCRIPTS_ENDPOINT = "https://api.filmscript.app/api/scripts";

async function requestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function scriptsProxy(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST");
    return res.end("Method Not Allowed");
  }

  try {
    const body = await requestBody(req);
    const headers = {
      Accept: "application/json",
      Cookie: String(req.headers?.cookie || ""),
      "User-Agent": String(req.headers?.["user-agent"] || "FilmScript Scripts Proxy"),
    };
    if (req.headers?.["content-type"]) headers["Content-Type"] = String(req.headers["content-type"]);
    if (req.headers?.["x-filmscript-client-id"]) headers["X-FilmScript-Client-Id"] = String(req.headers["x-filmscript-client-id"]);
    if (req.headers?.origin) headers.Origin = String(req.headers.origin);

    const upstream = await fetch(SCRIPTS_ENDPOINT, {
      method: req.method,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers,
      body,
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    if (!upstream.ok) {
      let errorCode = "unknown";
      try { errorCode = JSON.parse(payload.toString("utf8"))?.error || errorCode; } catch {}
      console.error(`FilmScript scripts upstream returned ${upstream.status}: ${errorCode}`);
    }

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", String(payload.length));
    return res.end(payload);
  } catch (error) {
    console.error(`FilmScript scripts proxy failed: ${error?.message || "unknown error"}`);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "scripts_upstream_unavailable", message: "We could not reach your scripts. Please try again." }));
  }
}
