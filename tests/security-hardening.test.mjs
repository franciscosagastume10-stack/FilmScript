import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

async function startServer(dataDir) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      API_URL: "https://api.filmscript.app",
      PUBLIC_APP_URL: "https://filmscript.app",
      CORS_ORIGINS: "https://filmscript.app",
      FILMSCRIPT_DATA_DIR: dataDir,
      GOOGLE_CLIENT_ID: "test-client",
      GOOGLE_CLIENT_SECRET: "test-secret",
      SESSION_COOKIE_SAMESITE: "None",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return { child, url };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error("FilmScript server did not start");
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  const stopped = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await stopped;
}

test("production API blocks internal files, cross-site writes, and anonymous session amplification", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-security-test-"));
  const running = await startServer(dataDir);
  t.after(async () => {
    await stopServer(running.child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const health = await fetch(`${running.url}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal(health.headers.get("x-frame-options"), "DENY");
  assert.match(health.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);

  for (const internalPath of ["/requirements.txt", "/server.js", "/docs/DEPLOYMENT.md", "/data-preview/filmscript.sqlite"]) {
    const response = await fetch(`${running.url}${internalPath}`);
    assert.equal(response.status, 404, internalPath);
  }

  const account = await fetch(`${running.url}/api/me`);
  assert.equal(account.status, 200);
  assert.equal(account.headers.get("set-cookie"), null);

  const blocked = await fetch(`${running.url}/auth/logout`, {
    method: "POST",
    headers: {
      Origin: "https://attacker.example",
      "Sec-Fetch-Site": "cross-site",
    },
  });
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).error, "cross_site_request_blocked");

  const login = await fetch(`${running.url}/auth/google?returnTo=%2FApp.dc.html`, {
    redirect: "manual",
  });
  assert.equal(login.status, 302);
  assert.match(login.headers.get("set-cookie") || "", /SameSite=Lax/);
  assert.doesNotMatch(login.headers.get("set-cookie") || "", /SameSite=None/);
});

test("frontend build manifest excludes ERP and includes every required runtime", async () => {
  const build = await fs.readFile(path.join(ROOT, "scripts", "build-netlify.mjs"), "utf8");
  const index = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  assert.match(build, /"seamless-navigation\.js"/);
  assert.doesNotMatch(build, /erp(?:-shell)?\.(?:html|js|css)/i);
  assert.match(index, /Features\.dc\.html/);
  assert.doesNotMatch(index, /erp/i);
});
