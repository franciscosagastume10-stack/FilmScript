import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

async function startServer(dataDir, environment = {}) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: { ...process.env, ...environment, PORT: String(port), API_URL: url, PUBLIC_APP_URL: url, CORS_ORIGINS: url, FILMSCRIPT_DATA_DIR: dataDir },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}`);
    try { if ((await fetch(`${url}/api/health`)).ok) return { child, url }; } catch {}
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

test("project-files aliases retain authenticated screenplay and production routes", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-project-files-test-"));
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { connectGoogleIdentity, createSession } from "./database.js";
    const session = createSession();
    connectGoogleIdentity(session.session.id, { sub: "project_files_owner", email: "project-files@example.com", name: "Project Files Owner", email_verified: true });
    console.log(session.token);
  `], { cwd: ROOT, env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir }, encoding: "utf8" });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const cookie = `filmscript_sid=${encodeURIComponent(bootstrap.stdout.trim().split("\n").at(-1))}`;
  const running = await startServer(dataDir, { SESSION_COOKIE_DOMAIN: "filmscript.test" });
  t.after(async () => { await stopServer(running.child); await fs.rm(dataDir, { recursive: true, force: true }); });

  const create = await fetch(`${running.url}/api/project-files`, {
    method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Alias screenplay" }),
  });
  assert.equal(create.status, 201);
  const sharedCookieHeader = create.headers.get("set-cookie") || "";
  assert.match(sharedCookieHeader, /filmscript_shared_sid=/);
  assert.match(sharedCookieHeader, /Domain=.filmscript.test/);
  const scriptId = (await create.json()).script.id;

  const list = await fetch(`${running.url}/api/project-files`, { headers: { Cookie: cookie } });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).scripts[0].id, scriptId);

  const sharedToken = sharedCookieHeader.match(/filmscript_shared_sid=([^;]+)/)?.[1];
  assert.ok(sharedToken);
  const sharedOnlyList = await fetch(`${running.url}/api/project-files`, { headers: { Cookie: `filmscript_shared_sid=${sharedToken}` } });
  assert.equal(sharedOnlyList.status, 200);

  const screenplay = await fetch(`${running.url}/api/project-files/${scriptId}`, { headers: { Cookie: cookie } });
  assert.equal(screenplay.status, 200);
  assert.equal((await screenplay.json()).script.title, "Alias screenplay");

  const preproduction = await fetch(`${running.url}/api/project-files/${scriptId}/preproduction`, { headers: { Cookie: cookie } });
  assert.equal(preproduction.status, 200);
});
