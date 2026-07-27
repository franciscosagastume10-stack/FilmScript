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
  const envFile = await fs.readFile(path.join(ROOT, ".env"), "utf8").catch(() => "");
  const pdfPython = process.env.PDF_PYTHON || envFile.match(/^PDF_PYTHON=(.+)$/m)?.[1]?.trim() || "python3";
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      API_URL: url,
      PUBLIC_APP_URL: url,
      CORS_ORIGINS: url,
      FILMSCRIPT_DATA_DIR: dataDir,
      OPENROUTER_API_KEY: "test-key",
      PDF_PYTHON: pdfPython,
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

const requestJson = async (url, cookie, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { Cookie: cookie, ...(options.headers || {}) },
  });
  return { response, data: await response.json().catch(() => ({})) };
};

test("Canvas persists role, Vault, authenticated images, Boards, quotes, and an A4 PDF", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-canvas-test-"));
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { connectGoogleIdentity, createSession } from "./database.js";
    const owner = createSession();
    connectGoogleIdentity(owner.session.id, { sub: "canvas_owner", email: "canvas@example.com", name: "Canvas Owner", email_verified: true });
    const other = createSession();
    connectGoogleIdentity(other.session.id, { sub: "canvas_other", email: "other@example.com", name: "Other", email_verified: true });
    console.log(JSON.stringify({ owner: owner.token, other: other.token }));
  `], { cwd: ROOT, env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir }, encoding: "utf8" });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const tokens = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));
  const ownerCookie = `filmscript_sid=${encodeURIComponent(tokens.owner)}`;
  const otherCookie = `filmscript_sid=${encodeURIComponent(tokens.other)}`;
  let running = await startServer(dataDir);
  t.after(async () => {
    await stopServer(running?.child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const created = await requestJson(`${running.url}/api/scripts`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Canvas Test Film" }),
  });
  assert.equal(created.response.status, 201);
  const scriptId = created.data.script.id;

  const initial = await requestJson(`${running.url}/api/scripts/${scriptId}/canvas`, ownerCookie);
  assert.equal(initial.response.status, 200);
  assert.equal(initial.data.workspace.role, null);
  assert.deepEqual(initial.data.workspace.vaultItems, []);
  assert.deepEqual(initial.data.workspace.boards, []);

  const role = await requestJson(`${running.url}/api/scripts/${scriptId}/canvas`, ownerCookie, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "production_designer" }),
  });
  assert.equal(role.response.status, 200);
  assert.equal(role.data.workspace.role, "production_designer");

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const uploaded = await requestJson(`${running.url}/api/scripts/${scriptId}/canvas/assets`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "image/png", "X-Filename": encodeURIComponent("wooden-chair.png"), "X-Image-Width": "1", "X-Image-Height": "1" },
    body: png,
  });
  assert.equal(uploaded.response.status, 201);
  assert.match(uploaded.data.asset.id, /^cas_[a-f0-9]+$/);
  assert.equal("key" in uploaded.data.asset, false);
  const assetId = uploaded.data.asset.id;

  const itemResult = await requestJson(`${running.url}/api/scripts/${scriptId}/canvas/vault`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Distressed wooden chair",
      mainImageId: assetId,
      imageIds: [assetId],
      category: "Furniture",
      quantityOwned: 4,
      quantityAvailable: 3,
      dailyPrice: 25,
      storageLocation: "Warehouse A",
      tags: ["wood", "hero prop"],
    }),
  });
  assert.equal(itemResult.response.status, 201);
  const item = itemResult.data.item;
  assert.equal(item.quantityAvailable, 3);

  const boardResult = await requestJson(`${running.url}/api/scripts/${scriptId}/canvas/boards`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Dining Room Art",
      type: "art",
      elements: [{ type: "vault", vaultItemId: item.id, assetId, positionX: 240, positionY: 180, width: 260, height: 190, content: item.name }],
    }),
  });
  assert.equal(boardResult.response.status, 201);
  assert.equal(boardResult.data.board.type, "art");
  assert.equal(boardResult.data.board.elements[0].vaultItemId, item.id);

  const quoteResult = await requestJson(`${running.url}/api/scripts/${scriptId}/canvas/quotes`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentType: "rental_quote",
      projectName: "Canvas Test Film",
      quoteNumber: "FS-TEST-001",
      clientName: "Production Client",
      items: [{ vaultItemId: item.id, name: item.name, imageId: assetId, quantity: 2, rentalDays: 3, pricePerDay: 25 }],
      deposit: 50,
      display: { imageStyle: "compact", prices: true, itemCodes: true, descriptions: true, assignments: true },
    }),
  });
  assert.equal(quoteResult.response.status, 201);
  const quoteId = quoteResult.data.quote.id;

  const imageResponse = await fetch(`${running.url}/api/scripts/${scriptId}/canvas/assets/${assetId}`, { headers: { Cookie: ownerCookie } });
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), png);

  const pdf = await fetch(`${running.url}/api/scripts/${scriptId}/canvas/quotes/${quoteId}.pdf`, { headers: { Cookie: ownerCookie } });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");

  assert.equal((await fetch(`${running.url}/api/scripts/${scriptId}/canvas`, { headers: { Cookie: otherCookie } })).status, 404);
  assert.equal((await fetch(`${running.url}/api/scripts/${scriptId}/canvas/assets/${assetId}`, { headers: { Cookie: otherCookie } })).status, 404);

  await stopServer(running.child);
  running = await startServer(dataDir);
  const restored = await requestJson(`${running.url}/api/scripts/${scriptId}/canvas`, ownerCookie);
  assert.equal(restored.response.status, 200);
  assert.equal(restored.data.workspace.role, "production_designer");
  assert.equal(restored.data.workspace.vaultItems[0].name, "Distressed wooden chair");
  assert.equal(restored.data.workspace.boards[0].title, "Dining Room Art");
  assert.equal(restored.data.workspace.quotes[0].quoteNumber, "FS-TEST-001");
});

test("Canvas replaces standalone Shot List navigation while keeping the existing Shot List implementation nested", async () => {
  const [editor, workspace, client] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "canvas-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "canvas-client.js"), "utf8"),
  ]);
  const navigation = editor.slice(editor.indexOf("workModes: ["), editor.indexOf("editorDisplay:", editor.indexOf("workModes: [")));
  assert.match(navigation, /id: 'canvas', label: 'Canvas'/);
  assert.doesNotMatch(navigation, /id: 'shotlist'/);
  assert.match(editor, /canvasWorkspaceVisible/);
  assert.match(editor, /shotListHasData: shotListMode/);
  assert.match(editor, /filmscript:canvas-shotlist/);
  assert.match(workspace, /Shot List/);
  assert.match(workspace, /Build your production library/);
  assert.match(workspace, /Start with one visual board/);
  assert.doesNotMatch(workspace, /What is your role in this production\?/);
  assert.doesNotMatch(workspace, /data-action="role-settings"/);
  assert.match(workspace, /data-action="board-fit"/);
  assert.match(workspace, /data-file="board-image"/);
  assert.match(workspace, /stopBoundary\.contains\(trigger\)/);
  assert.match(workspace, /form\.dataset\.form === 'vault-item'/);
  assert.match(client, /pathFor\(scriptId, '\/quotes'\)/);
});
