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

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}`);
    try { if ((await fetch(`${url}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error("FilmScript server did not start");
}

async function startServer(dataDir) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      API_URL: url,
      PUBLIC_APP_URL: url,
      CORS_ORIGINS: url,
      FILMSCRIPT_DATA_DIR: dataDir,
      OPENAI_API_KEY: "",
      FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(url, child);
  return { child, url };
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  const stopped = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await stopped;
}

async function requestJson(url, cookie, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Cookie: cookie, ...(options.headers || {}) },
  });
  return { response, data: await response.json().catch(() => ({})) };
}

function bootstrapVisualLibrary(dataDir) {
  const source = `
    import {
      connectGoogleIdentity,
      createSession,
      getCanvasLibrary,
      saveCanvasLibrary,
      saveScriptsSnapshot,
    } from "./database.js";
    import { __canvasTesting as canvas } from "./server.js";

    const timestamp = new Date().toISOString();
    const ownerSession = createSession();
    const owner = connectGoogleIdentity(ownerSession.session.id, {
      sub: "canvas-reference-owner",
      email: "canvas-reference-owner@example.test",
      name: "Canvas reference owner",
      email_verified: true,
    });
    const foreignSession = createSession();
    const foreign = connectGoogleIdentity(foreignSession.session.id, {
      sub: "canvas-reference-foreign",
      email: "canvas-reference-foreign@example.test",
      name: "Canvas reference foreign",
      email_verified: true,
    });
    const ownerSourceScriptId = "scr_a11ce000000000000001";
    const ownerTargetScriptId = "scr_a11ce000000000000002";
    const foreignSourceScriptId = "scr_b00b5000000000000001";
    const script = (id, userId, title, blocks = []) => ({
      id, userId, title, text: "", blocks, chat: [], titleRoom: {}, characterNames: {},
      createdAt: timestamp, updatedAt: timestamp,
    });
    saveScriptsSnapshot({
      scripts: {
        [ownerSourceScriptId]: script(ownerSourceScriptId, owner.id, "Owner visual source"),
        [ownerTargetScriptId]: script(ownerTargetScriptId, owner.id, "Owner shot list", [
          { type: "scene", text: "INT. REFERENCE TEST ROOM - DAY" },
          { type: "action", text: "A writer selects a visual reference." },
        ]),
        [foreignSourceScriptId]: script(foreignSourceScriptId, foreign.id, "Foreign visual source"),
      },
    });

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const ownerContext = canvas.canvasContext(ownerSourceScriptId, owner.id);
    const imagine = await canvas.storeGeneratedCanvasAsset(ownerContext, ownerSourceScriptId, jpeg, "Owner Imagine frame", {
      source: "imagine",
      size: "1536x1024",
    });
    const vault = await canvas.storeGeneratedCanvasAsset(ownerContext, ownerSourceScriptId, jpeg, "Owner Vault upload", {
      source: "upload",
      size: "1024x1536",
    });
    const library = getCanvasLibrary(owner.id);
    saveCanvasLibrary(owner.id, {
      ...library,
      vaultItems: [{
        id: "vlt_a11ce000000000000001",
        name: "Owner Vault image",
        mainImageId: vault.id,
        imageIds: [vault.id],
        category: "References",
        createdAt: timestamp,
      }],
    });

    const foreignContext = canvas.canvasContext(foreignSourceScriptId, foreign.id);
    const foreignAsset = await canvas.storeGeneratedCanvasAsset(foreignContext, foreignSourceScriptId, jpeg, "Foreign Imagine frame", {
      source: "imagine",
      size: "1536x1024",
    });
    console.log(JSON.stringify({
      ownerToken: ownerSession.token,
      foreignToken: foreignSession.token,
      ownerTargetScriptId,
      imagineAssetId: imagine.id,
      vaultAssetId: vault.id,
      foreignAssetId: foreignAsset.id,
    }));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      FILMSCRIPT_DATA_DIR: dataDir,
      FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim().split("\n").at(-1));
}

test("Shot List can copy user-owned Imagine and Vault assets but rejects foreign Canvas images", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-shot-reference-canvas-"));
  const identity = bootstrapVisualLibrary(dataDir);
  const ownerCookie = `filmscript_sid=${encodeURIComponent(identity.ownerToken)}`;
  const foreignCookie = `filmscript_sid=${encodeURIComponent(identity.foreignToken)}`;
  const running = await startServer(dataDir);
  t.after(async () => {
    await stopServer(running.child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const project = await requestJson(`${running.url}/api/scripts/${identity.ownerTargetScriptId}/preproduction`, ownerCookie);
  assert.equal(project.response.status, 200);
  const sceneId = project.data.project.scenes[0]?.id;
  assert.match(sceneId, /^sc_[a-f0-9]+$/);

  const attach = (assetId, cookie = ownerCookie) => requestJson(
    `${running.url}/api/scripts/${identity.ownerTargetScriptId}/preproduction/shotlist/references/from-canvas`,
    cookie,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneId, assetId }),
    },
  );

  const imagine = await attach(identity.imagineAssetId);
  assert.equal(imagine.response.status, 201);
  assert.equal(imagine.data.target, "scene");
  assert.match(imagine.data.asset?.id || "", /^ref_[a-f0-9]+$/);

  // This file was uploaded and linked to a Vault item in another project.
  // It must be selectable through the same account-wide Canvas library.
  const vault = await attach(identity.vaultAssetId);
  assert.equal(vault.response.status, 201);
  assert.equal(vault.data.target, "scene");
  assert.match(vault.data.asset?.id || "", /^ref_[a-f0-9]+$/);

  const foreignAsset = await attach(identity.foreignAssetId);
  assert.equal(foreignAsset.response.status, 404);
  assert.equal(foreignAsset.data.error, "Canvas image not found");

  const foreignUser = await attach(identity.imagineAssetId, foreignCookie);
  assert.equal(foreignUser.response.status, 404);
  assert.equal(foreignUser.data.error, "script not found");

  const invalid = await attach("cas_not-a-valid-id");
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.data.error, "valid scene and Canvas image are required");
});
