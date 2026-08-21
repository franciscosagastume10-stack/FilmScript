import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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
      API_URL: url,
      PUBLIC_APP_URL: url,
      CORS_ORIGINS: url,
      FILMSCRIPT_DATA_DIR: dataDir,
      FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      OPENAI_API_KEY: "",
    },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}.`);
    try {
      if ((await fetch(`${url}/api/health`)).ok) return { child, url };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  child.kill("SIGTERM");
  throw new Error("FilmScript server did not become ready.");
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  const stopped = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await stopped;
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function postJson(url, cookie, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await readJson(response) };
}

function bootstrapCanvasProject(dataDir) {
  const source = `
    import {
      connectGoogleIdentity,
      createSession,
      saveCanvasWorkspace,
      saveScriptsSnapshot,
    } from "./database.js";
    import { __canvasTesting as canvas } from "./server.js";

    const ownerSession = createSession();
    const imagineSession = createSession();
    const canvasSession = createSession();
    const owner = connectGoogleIdentity(ownerSession.session.id, {
      sub: "imagine_permission_owner",
      email: "imagine-owner@example.test",
      name: "Imagine Owner",
      email_verified: true,
    });
    connectGoogleIdentity(imagineSession.session.id, {
      sub: "imagine_permission_viewer",
      email: "imagine-only@example.test",
      name: "Imagine Viewer",
      email_verified: true,
    });
    connectGoogleIdentity(canvasSession.session.id, {
      sub: "canvas_permission_viewer",
      email: "canvas-only@example.test",
      name: "Canvas Viewer",
      email_verified: true,
    });

    const projectId = "scr_a11ce00000000000cafe";
    const timestamp = new Date().toISOString();
    saveScriptsSnapshot({ scripts: {
      [projectId]: {
        id: projectId,
        userId: owner.id,
        title: "Visual permissions",
        text: "",
        blocks: [],
        chat: [],
        titleRoom: {},
        characterNames: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    } });

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const initial = canvas.canvasContext(projectId, owner.id);
    const imagineAsset = await canvas.storeGeneratedCanvasAsset(initial, projectId, jpeg, "PRIVATE SHOT DESCRIPTION", {
      source: "imagine",
      size: "1536x1024",
      generation: {
        origin: "shotlist",
        sceneId: "sc_private",
        shotId: "sh_private",
        sceneTitle: "PRIVATE SCENE TITLE",
        shotSize: "Close-up",
        revisedPrompt: "FULL PRIVATE SCREENPLAY CONTEXT",
      },
    });
    const refreshed = canvas.canvasContext(projectId, owner.id);
    const uploadAsset = await canvas.storeGeneratedCanvasAsset(refreshed, projectId, jpeg, "Private Vault upload", {
      source: "upload",
      size: "1024x1536",
    });
    const context = canvas.canvasContext(projectId, owner.id);
    context.workspace.vaultItems = [{
      id: "vlt_a11ce00000000000cafe",
      name: "Private wardrobe reference",
      mainImageId: uploadAsset.id,
      imageIds: [uploadAsset.id],
      category: "Wardrobe",
      dailyPrice: 250,
      createdAt: timestamp,
      updatedAt: timestamp,
    }];
    context.workspace.vaultCategories = ["Wardrobe"];
    context.workspace.vaultSelections = [{
      id: "vsel_a11ce0000000000cafe",
      name: "Private pull list",
      itemIds: ["vlt_a11ce00000000000cafe"],
      createdAt: timestamp,
      updatedAt: timestamp,
    }];
    context.workspace.boards = [{
      id: "brd_a11ce00000000000cafe",
      title: "Private production board",
      type: "art",
      elements: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }];
    context.workspace.quotes = [{
      id: "qte_a11ce00000000000cafe",
      documentType: "rental_quote",
      quoteNumber: "PRIVATE-QUOTE",
      items: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }];
    saveCanvasWorkspace(projectId, owner.id, context.workspace);

    console.log(JSON.stringify({
      ownerToken: ownerSession.token,
      imagineToken: imagineSession.token,
      canvasToken: canvasSession.token,
      projectId,
      imagineAssetId: imagineAsset.id,
      uploadAssetId: uploadAsset.id,
      jpeg: jpeg.toString("base64"),
    }));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: ROOT,
    env: {
      ...process.env,
      FILMSCRIPT_DATA_DIR: dataDir,
      FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim().split("\n").at(-1));
}

test("Imagine-only access opens a filtered visual workspace while Canvas-only access remains complete", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-imagine-permission-"));
  const identity = bootstrapCanvasProject(dataDir);
  const ownerCookie = `filmscript_sid=${encodeURIComponent(identity.ownerToken)}`;
  const imagineCookie = `filmscript_sid=${encodeURIComponent(identity.imagineToken)}`;
  const canvasCookie = `filmscript_sid=${encodeURIComponent(identity.canvasToken)}`;
  const running = await startServer(dataDir);
  t.after(async () => {
    await stopServer(running.child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const imagineInvitation = await postJson(`${running.url}/api/projects/${identity.projectId}/members`, ownerCookie, {
    email: "imagine-only@example.test",
    projectRole: "department_editor",
    modulePermissions: { canvas: "no_access", imagine: "edit" },
  });
  assert.equal(imagineInvitation.response.status, 201, JSON.stringify(imagineInvitation.body));
  const imagineAccept = await postJson(`${running.url}/api/invitations/${imagineInvitation.body.invitation.id}/accept`, imagineCookie, {});
  assert.equal(imagineAccept.response.status, 200, JSON.stringify(imagineAccept.body));
  assert.equal(imagineAccept.body.project.preferredView, "imagine");

  const imagineScripts = await fetch(`${running.url}/api/scripts`, { headers: { Cookie: imagineCookie } });
  assert.equal(imagineScripts.status, 200);
  const imagineCard = (await readJson(imagineScripts)).scripts.find((script) => script.id === identity.projectId);
  assert.equal(imagineCard.preferredView, "imagine");
  assert.equal(imagineCard.canOpenProject, true);
  assert.equal(imagineCard.canOpenScript, false);

  const imagineWorkspaceResponse = await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas`, { headers: { Cookie: imagineCookie } });
  assert.equal(imagineWorkspaceResponse.status, 200);
  const imagineWorkspace = (await readJson(imagineWorkspaceResponse)).workspace;
  assert.deepEqual(imagineWorkspace.assets.map(({ id, source }) => ({ id, source })), [{ id: identity.imagineAssetId, source: "imagine" }]);
  assert.equal(imagineWorkspace.assets[0].filename, "Shot List frame.jpg");
  assert.equal(imagineWorkspace.assets[0].prompt, "");
  assert.deepEqual(imagineWorkspace.assets[0].generation, {
    origin: "shotlist",
    requestedSize: "1536x1024",
    actualSize: "1536x1024",
    aspectRatio: 1.5,
    dimensionsVerified: false,
    dimensionsVerifiedAt: "",
  });
  assert.equal(JSON.stringify(imagineWorkspace).includes("PRIVATE"), false, "Imagine access must not expose Shot List or screenplay metadata");
  for (const forbidden of ["boards", "vaultItems", "vaultCategories", "vaultSelections", "quotes", "generatedAssets", "presentations", "exportTemplates", "userId", "role"]) {
    assert.equal(forbidden in imagineWorkspace, false, `Imagine-only workspace must hide ${forbidden}`);
  }

  const imagineAsset = await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas/assets/${identity.imagineAssetId}`, { headers: { Cookie: imagineCookie } });
  assert.equal(imagineAsset.status, 200);
  assert.deepEqual(Buffer.from(await imagineAsset.arrayBuffer()), Buffer.from(identity.jpeg, "base64"));
  const privateUpload = await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas/assets/${identity.uploadAssetId}`, { headers: { Cookie: imagineCookie } });
  assert.equal(privateUpload.status, 404, "Imagine-only access must not turn a known Vault upload ID into an oracle");

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const imagineReferenceResponse = await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas/assets`, {
    method: "POST",
    headers: {
      Cookie: imagineCookie,
      "Content-Type": "image/png",
      "X-Canvas-Scope": "imagine",
      "X-Filename": encodeURIComponent("imagine-reference.png"),
      "X-Image-Width": "1",
      "X-Image-Height": "1",
    },
    body: png,
  });
  assert.equal(imagineReferenceResponse.status, 201);
  const imagineReference = (await readJson(imagineReferenceResponse)).asset;
  assert.equal(imagineReference.source, "imagine_reference");

  const normalCanvasUpload = await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas/assets`, {
    method: "POST",
    headers: { Cookie: imagineCookie, "Content-Type": "image/png", "X-Filename": encodeURIComponent("canvas-private.png") },
    body: png,
  });
  assert.equal(normalCanvasUpload.status, 403);
  assert.equal((await readJson(normalCanvasUpload)).error, "permission_denied");

  const blockedWorkspacePatch = await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas`, {
    method: "PATCH",
    headers: { Cookie: imagineCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ settings: { lastTool: "boards" } }),
  });
  assert.equal(blockedWorkspacePatch.status, 403);
  const blockedBoardCreate = await postJson(`${running.url}/api/scripts/${identity.projectId}/canvas/boards`, imagineCookie, { title: "Must not exist", type: "art" });
  assert.equal(blockedBoardCreate.response.status, 403);

  const generationPath = await postJson(`${running.url}/api/scripts/${identity.projectId}/canvas/images/generate`, imagineCookie, {
    mode: "imagine-freeform",
    prompt: "A quiet amber room with a single empty chair",
    size: "1536x1024",
    quality: "low",
  });
  assert.equal(generationPath.response.status, 403);
  assert.equal(generationPath.body.error, "image_generation_plan_required", "Imagine edit must reach credit entitlement instead of failing Canvas permission");

  const refreshedImagineResponse = await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas`, { headers: { Cookie: imagineCookie } });
  const refreshedImagine = (await readJson(refreshedImagineResponse)).workspace;
  assert.equal(refreshedImagine.assets.some((asset) => asset.id === identity.imagineAssetId && asset.source === "imagine"), true);
  assert.equal(refreshedImagine.assets.some((asset) => asset.id === imagineReference.id && asset.source === "imagine_reference"), true);
  assert.equal(refreshedImagine.assets.some((asset) => asset.id === identity.uploadAssetId), false);
  assert.equal((await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas/assets/${imagineReference.id}`, { headers: { Cookie: imagineCookie } })).status, 200);

  const canvasInvitation = await postJson(`${running.url}/api/projects/${identity.projectId}/members`, ownerCookie, {
    email: "canvas-only@example.test",
    projectRole: "department_editor",
    modulePermissions: { canvas: "view", imagine: "no_access" },
    financialPermissions: ["financial.view_all"],
  });
  assert.equal(canvasInvitation.response.status, 201, JSON.stringify(canvasInvitation.body));
  const canvasAccept = await postJson(`${running.url}/api/invitations/${canvasInvitation.body.invitation.id}/accept`, canvasCookie, {});
  assert.equal(canvasAccept.response.status, 200, JSON.stringify(canvasAccept.body));
  assert.equal(canvasAccept.body.project.preferredView, "canvas");

  const canvasOnlyFreeform = await postJson(`${running.url}/api/scripts/${identity.projectId}/canvas/images/generate`, canvasCookie, {
    mode: "imagine-freeform",
    prompt: "A quiet amber room with a single empty chair",
  });
  assert.equal(canvasOnlyFreeform.response.status, 403);
  assert.equal(canvasOnlyFreeform.body.error, "permission_denied", "Canvas access alone must not authorize Imagine generation");

  const canvasScripts = await fetch(`${running.url}/api/scripts`, { headers: { Cookie: canvasCookie } });
  const canvasCard = (await readJson(canvasScripts)).scripts.find((script) => script.id === identity.projectId);
  assert.equal(canvasCard.preferredView, "canvas");
  const canvasWorkspaceResponse = await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas`, { headers: { Cookie: canvasCookie } });
  assert.equal(canvasWorkspaceResponse.status, 200);
  const canvasWorkspace = (await readJson(canvasWorkspaceResponse)).workspace;
  assert.equal(canvasWorkspace.assets.some((asset) => asset.id === identity.imagineAssetId), true);
  assert.equal(canvasWorkspace.assets.some((asset) => asset.id === identity.uploadAssetId), true);
  assert.equal(canvasWorkspace.assets.some((asset) => asset.id === imagineReference.id), true);
  assert.equal(canvasWorkspace.vaultItems[0].name, "Private wardrobe reference");
  assert.equal(canvasWorkspace.vaultSelections[0].name, "Private pull list");
  assert.equal(canvasWorkspace.boards[0].title, "Private production board");
  assert.equal(canvasWorkspace.quotes[0].quoteNumber, "PRIVATE-QUOTE");
  assert.equal((await fetch(`${running.url}/api/scripts/${identity.projectId}/canvas/assets/${identity.uploadAssetId}`, { headers: { Cookie: canvasCookie } })).status, 200);
});
