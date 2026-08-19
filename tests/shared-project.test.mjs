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

async function startServer(dataDir) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT:String(port), API_URL:url, PUBLIC_APP_URL:url, CORS_ORIGINS:url, FILMSCRIPT_DATA_DIR:dataDir },
    stdio:"ignore",
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

const json = async (response) => ({ response, body:await response.json() });

test("Shared Project keeps a live, scoped, revocable read-only projection", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-shared-project-test-"));
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { connectGoogleIdentity, createSession } from "./database.js";
    const owner = createSession(); const invited = createSession(); const unverified = createSession();
    connectGoogleIdentity(owner.session.id, { sub:"shared_owner", email:"owner@example.com", name:"Shared Owner", email_verified:true });
    connectGoogleIdentity(invited.session.id, { sub:"shared_invited", email:"viewer@example.com", name:"Invited Viewer", email_verified:true });
    connectGoogleIdentity(unverified.session.id, { sub:"shared_unverified", email:"unverified@example.com", name:"Unverified Viewer", email_verified:false });
    console.log(JSON.stringify({ owner:owner.token, invited:invited.token, unverified:unverified.token }));
  `], { cwd:ROOT, env:{ ...process.env, FILMSCRIPT_DATA_DIR:dataDir }, encoding:"utf8" });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const tokens = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));
  const running = await startServer(dataDir);
  t.after(async () => { await stopServer(running.child); await fs.rm(dataDir, { recursive:true, force:true }); });

  const ownerCookie = `filmscript_sid=${encodeURIComponent(tokens.owner)}`;
  const createScript = await json(await fetch(`${running.url}/api/project-files`, { method:"POST", headers:{ Cookie:ownerCookie, "Content-Type":"application/json" }, body:JSON.stringify({ title:"Shared Source" }) }));
  assert.equal(createScript.response.status, 201);
  const projectId = createScript.body.script.id;
  const publicCreated = await json(await fetch(`${running.url}/api/projects/${projectId}/shared-projects`, { method:"POST", headers:{ Cookie:ownerCookie, "Content-Type":"application/json" }, body:JSON.stringify({ accessMode:"public", sections:[{ module:"script", canView:true, canExport:false }] }) }));
  assert.equal(publicCreated.response.status, 201);
  const publicSlug = publicCreated.body.sharedProject.slug;
  assert.match(publicSlug, /^[A-Za-z0-9_-]{24,}$/);

  const changeTitle = await fetch(`${running.url}/api/project-files/${projectId}`, { method:"POST", headers:{ Cookie:ownerCookie, "Content-Type":"application/json" }, body:JSON.stringify({ title:"Shared Source — Latest" }) });
  assert.equal(changeTitle.status, 200);

  const sharedView = await json(await fetch(`${running.url}/api/shared/${publicSlug}`));
  assert.equal(sharedView.response.status, 200, JSON.stringify(sharedView.body));
  assert.equal(sharedView.body.sharedProject.projectName, "Shared Source — Latest");
  assert.deepEqual(Object.keys(sharedView.body.sharedProject.content), ["script"]);
  assert.equal("projectId" in sharedView.body.sharedProject, false);
  assert.equal(JSON.stringify(sharedView.body).includes("password_hash"), false);
  assert.equal((await fetch(`${running.url}/api/shared/${publicSlug}/export`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ section:"script" }) })).status, 403);

  const updatePublic = await json(await fetch(`${running.url}/api/projects/${projectId}/shared-projects/${publicCreated.body.sharedProject.id}`, { method:"PATCH", headers:{ Cookie:ownerCookie, "Content-Type":"application/json" }, body:JSON.stringify({ accessMode:"public", sections:[{ module:"script", canView:true, canExport:true }] }) }));
  assert.equal(updatePublic.response.status, 200);
  const exportView = await json(await fetch(`${running.url}/api/shared/${publicSlug}/export`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ section:"script" }) }));
  assert.equal(exportView.response.status, 200);
  assert.equal(exportView.body.section, "script");
  assert.equal(exportView.body.content.title, "Shared Source — Latest");

  const passwordCreated = await json(await fetch(`${running.url}/api/projects/${projectId}/shared-projects`, { method:"POST", headers:{ Cookie:ownerCookie, "Content-Type":"application/json" }, body:JSON.stringify({ accessMode:"password", password:"a safe shared password", sections:[{ module:"script", canView:true, canExport:false }] }) }));
  assert.equal(passwordCreated.response.status, 201);
  const passwordSlug = passwordCreated.body.sharedProject.slug;
  const passwordGate = await json(await fetch(`${running.url}/api/shared/${passwordSlug}`));
  assert.equal(passwordGate.response.status, 401);
  assert.equal(passwordGate.body.error, "shared_password_required");
  const passwordOpen = await json(await fetch(`${running.url}/api/shared/${passwordSlug}`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ password:"a safe shared password" }) }));
  assert.equal(passwordOpen.response.status, 200);
  const passwordCookie = passwordOpen.response.headers.get("set-cookie") || "";
  assert.match(passwordCookie, /filmscript_shared_project_access=/);
  assert.match(passwordCookie, /HttpOnly/);
  const passwordTicket = passwordCookie.match(/filmscript_shared_project_access=([^;]+)/)?.[1];
  assert.ok(passwordTicket);
  assert.equal((await fetch(`${running.url}/api/shared/${passwordSlug}`, { headers:{ Cookie:`filmscript_shared_project_access=${passwordTicket}` } })).status, 200);
  assert.equal((await fetch(`${running.url}/api/shared/${passwordSlug}`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ password:"wrong password" }) })).status, 401);

  const emailCreated = await json(await fetch(`${running.url}/api/projects/${projectId}/shared-projects`, { method:"POST", headers:{ Cookie:ownerCookie, "Content-Type":"application/json" }, body:JSON.stringify({ accessMode:"email_restricted", allowedEmails:["viewer@example.com"], sections:[{ module:"script", canView:true, canExport:false }] }) }));
  assert.equal(emailCreated.response.status, 201);
  const emailSlug = emailCreated.body.sharedProject.slug;
  const emailGate = await json(await fetch(`${running.url}/api/shared/${emailSlug}`));
  assert.equal(emailGate.response.status, 401);
  assert.equal(emailGate.body.error, "shared_email_sign_in_required");
  assert.equal((await fetch(`${running.url}/api/shared/${emailSlug}`, { headers:{ Cookie:`filmscript_sid=${encodeURIComponent(tokens.invited)}` } })).status, 200);
  const unverifiedGate = await json(await fetch(`${running.url}/api/shared/${emailSlug}`, { headers:{ Cookie:`filmscript_sid=${encodeURIComponent(tokens.unverified)}` } }));
  assert.equal(unverifiedGate.response.status, 403);
  assert.equal(unverifiedGate.body.error, "shared_email_unverified");

  const accessRequest = await json(await fetch(`${running.url}/api/shared/${emailSlug}/access-requests`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ email:"requester@example.com", note:"Please invite me to the review." }) }));
  assert.equal(accessRequest.response.status, 202);
  assert.equal(accessRequest.body.accepted, true);
  for (let index = 0; index < 4; index += 1) {
    assert.equal((await fetch(`${running.url}/api/shared/${emailSlug}/access-requests`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ email:`requester${index}@example.com` }) })).status, 202);
  }
  assert.equal((await fetch(`${running.url}/api/shared/${emailSlug}/access-requests`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ email:"rate-limited@example.com" }) })).status, 429);

  const revoked = await fetch(`${running.url}/api/projects/${projectId}/shared-projects/${publicCreated.body.sharedProject.id}`, { method:"DELETE", headers:{ Cookie:ownerCookie } });
  assert.equal(revoked.status, 200);
  const revokedView = await json(await fetch(`${running.url}/api/shared/${publicSlug}`));
  assert.equal(revokedView.response.status, 410);
  assert.equal(revokedView.body.error, "shared_project_revoked");
});
