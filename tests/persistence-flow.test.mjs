import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { computeCalendar } from "../calendar-model.js";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const waitForServer = async (url, child) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}.`);
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error("FilmScript server did not become ready.");
};

const stopServer = async (child) => {
  if (!child || child.exitCode != null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await exited;
};

const startServer = async (dataDir) => {
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
      // Keep server tests deterministic and offline. Paid/Free access is
      // tested separately; this path exercises the provider-unavailable UI.
      OPENAI_API_KEY: "",
      PDF_PYTHON: pdfPython,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(url, child);
  return { child, url };
};

const slowJsonPost = (url, cookie, payload, delayMs = 140) => new Promise((resolve, reject) => {
  const target = new URL(url);
  const body = JSON.stringify(payload);
  const split = Math.max(1, Math.floor(body.length / 2));
  const request = http.request({
    hostname: target.hostname,
    port: target.port,
    path: `${target.pathname}${target.search}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Cookie: cookie,
    },
  }, (response) => {
    let raw = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => { raw += chunk; });
    response.on("end", () => resolve({ status: response.statusCode, data: raw ? JSON.parse(raw) : {} }));
  });
  request.on("error", reject);
  request.write(body.slice(0, split));
  setTimeout(() => request.end(body.slice(split)), delayMs);
});

test("account-owned screenplay interactions survive reloads and a server restart", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-persistence-test-"));
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { connectGoogleIdentity, createSession } from "./database.js";
    const first = createSession();
    connectGoogleIdentity(first.session.id, { sub: "google_persistence_owner", email: "owner@example.com", name: "Owner", email_verified: true });
    const second = createSession();
    connectGoogleIdentity(second.session.id, { sub: "google_persistence_other", email: "other@example.com", name: "Other", email_verified: true });
    console.log(JSON.stringify({ ownerToken: first.token, otherToken: second.token }));
  `], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir },
    encoding: "utf8",
  });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const identity = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));
  const ownerCookie = `filmscript_sid=${encodeURIComponent(identity.ownerToken)}`;
  const otherCookie = `filmscript_sid=${encodeURIComponent(identity.otherToken)}`;
  let running = await startServer(dataDir);

  t.after(async () => {
    await stopServer(running?.child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const source = "INT. WRITING ROOM - DAY\nRENE opens a notebook and sits beside SAMUEL.\nEXT. STREET - NIGHT\nSAMUEL carries the notebook outside.";
  const importedResponse = await fetch(`${running.url}/api/scripts/import`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "X-Filename": "Persistence Test.fs", Cookie: ownerCookie },
    body: source,
  });
  assert.equal(importedResponse.status, 201);
  const imported = await importedResponse.json();
  const scriptId = imported.script.id;
  const blocks = [
    { type: "title", text: "Editable Cover" },
    { type: "title_credit", text: "Written by" },
    { type: "title_author", text: "A Writer" },
    { type: "pagebreak", text: "" },
    { type: "scene", text: "INT. WRITING ROOM - DAY" },
    { type: "action", text: "RENE opens a notebook and sits beside SAMUEL." },
    { type: "character", text: "RENE" },
    { type: "dialogue", text: "We keep every version." },
    { type: "scene", text: "EXT. STREET - NIGHT" },
    { type: "action", text: "SAMUEL carries the notebook outside." },
  ];
  const chat = [
    { who: "l", text: "I have read the screenplay." },
    { who: "w", text: "Where does the second act slow down?" },
    { who: "l", text: "The transition after the writing room needs a clearer turn." },
  ];
  const characterNames = {
    version: 1,
    scriptHash: "tr_character_names",
    context: {
      place: "A contemporary bilingual writing room",
      period: "Present day",
      language: "English and Spanish",
      evidence: "The characters work together and use both languages.",
      namingContext: "Names may reflect more than one naming tradition.",
      themes: ["reconciliation"],
      confidence: 0.86,
    },
    characters: [{
      id: "nmc_rene",
      currentName: "RENE",
      firstScene: 1,
      cueCount: 1,
      role: "Writer",
      arc: "Rebuilds trust with Samuel",
      nameFit: "strong",
      fitReason: "The name is plausible in the established bilingual context.",
      suggestions: [{ id: "nms_elias", name: "ELIAS", rationale: "A subtle alternative grounded in the same context.", tags: ["Bilingual"], confidence: 0.8 }],
      decision: "kept",
    }],
    warnings: [],
    updatedAt: "2026-07-13T00:00:00.000Z",
  };
  const lumierePreferences = {
    version: 1,
    enabled: true,
    directors: ["Céline Sciamma", "Alfonso Cuarón"],
    films: ["Aftersun", "Roma"],
    styles: ["Character-driven", "Intimate", "Poetic realism"],
    feedbackTone: "direct",
    creativePriorities: "Protect restrained dialogue and cultural specificity.",
    avoidances: "Do not explain every emotional beat.",
    surpriseMe: true,
  };

  const preferencesResponse = await fetch(`${running.url}/api/me/lumiere-preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify(lumierePreferences),
  });
  assert.equal(preferencesResponse.status, 200);
  const savedPreferences = (await preferencesResponse.json()).preferences;
  assert.deepEqual(savedPreferences.directors, lumierePreferences.directors);
  assert.equal(savedPreferences.feedbackTone, "direct");

  const accountResponse = await fetch(`${running.url}/api/me`, { headers: { Cookie: ownerCookie } });
  assert.equal(accountResponse.status, 200);
  const account = await accountResponse.json();
  assert.deepEqual(account.lumierePreferences.films, lumierePreferences.films);
  assert.equal(account.profile.completed, false);

  const profileResponse = await fetch(`${running.url}/api/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ gender: "woman", birthDate: "1990-07-14" }),
  });
  assert.equal(profileResponse.status, 200);
  const savedProfile = await profileResponse.json();
  assert.equal(savedProfile.profile.gender, "woman");
  assert.equal(savedProfile.profile.birthDate, "1990-07-14");
  assert.equal(savedProfile.profile.completed, true);

  const invalidProfileResponse = await fetch(`${running.url}/api/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ birthDate: "2099-01-01" }),
  });
  assert.equal(invalidProfileResponse.status, 422);

  // Hold one request body open while another autosave completes. Both fields
  // must survive instead of the later request restoring a stale script copy.
  const chatSave = slowJsonPost(`${running.url}/api/scripts/${scriptId}`, ownerCookie, { chat });
  await new Promise((resolve) => setTimeout(resolve, 45));
  const blocksResponse = await fetch(`${running.url}/api/scripts/${scriptId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ blocks }),
  });
  assert.equal(blocksResponse.status, 200);
  assert.equal((await chatSave).status, 200);
  const characterNamesResponse = await fetch(`${running.url}/api/scripts/${scriptId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ characterNames }),
  });
  assert.equal(characterNamesResponse.status, 200);

  const storedResponse = await fetch(`${running.url}/api/scripts/${scriptId}`, { headers: { Cookie: ownerCookie } });
  assert.equal(storedResponse.status, 200);
  const stored = (await storedResponse.json()).script;
  assert.deepEqual(stored.blocks.map(({ type, text }) => ({ type, text })), blocks);
  assert.ok(stored.blocks.every((block) => /^blk_/.test(block.id)), "collaborative screenplay blocks keep stable IDs");
  assert.deepEqual(stored.chat, chat);
  assert.deepEqual(stored.characterNames, characterNames);
  assert.equal(stored.title, "Editable Cover");

  const scriptsListResponse = await fetch(`${running.url}/api/scripts`, { headers: { Cookie: ownerCookie } });
  assert.equal(scriptsListResponse.status, 200);
  assert.equal((await scriptsListResponse.json()).scripts.find((script) => script.id === scriptId)?.title, "Editable Cover");

  const projectResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction`, { headers: { Cookie: ownerCookie } });
  assert.equal(projectResponse.status, 200);
  const project = (await projectResponse.json()).project;
  assert.equal(project.scenes.length, 2);
  const [firstScene, secondScene] = project.scenes;

  const manualBreakdownResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/manual-breakdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: "{}",
  });
  assert.equal(manualBreakdownResponse.status, 200);
  const manualBreakdown = await manualBreakdownResponse.json();
  assert.equal(manualBreakdown.created, 2);
  assert.ok(manualBreakdown.project.scenes.every((scene) => scene.breakdown?.source === "manual"));
  assert.ok(manualBreakdown.project.scenes.every((scene) => scene.breakdown?.generated === "manual"));
  assert.equal(manualBreakdown.project.scenes[0].breakdownForm.cells.props, "");
  assert.equal(manualBreakdown.project.scenes[0].breakdownForm.metadata.sceneDescription, "");

  const breakdownResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/scenes/${firstScene.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ metadata: { scriptDay: "3" }, cells: { props: "Notebook\nCoffee cup" } }),
  });
  assert.equal(breakdownResponse.status, 200);

  const order = [secondScene.id, firstScene.id];
  const shootLocation = "Terminal de buses, Zona 4";
  const stripboardResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/stripboard`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      order,
      events: [{ id: "sbe_aabbccdd", type: "end_day", afterSceneId: secondScene.id, durationMinutes: 0 }],
      sceneTimings: { [firstScene.id]: 75 },
      sceneLocations: { [firstScene.id]: shootLocation },
      sceneCastIds: { [firstScene.id]: [1, 2] },
    }),
  });
  assert.equal(stripboardResponse.status, 200);
  const savedStripboard = (await stripboardResponse.json()).project;
  assert.equal(savedStripboard.scenes.find((scene) => scene.id === firstScene.id).strip.location, shootLocation);
  assert.deepEqual(savedStripboard.scenes.find((scene) => scene.id === firstScene.id).strip.castIds, [1, 2]);
  assert.equal(savedStripboard.scenes.find((scene) => scene.id === firstScene.id).strip.estimatedMinutes, 75);
  assert.deepEqual(savedStripboard.shootLocations, [shootLocation]);

  const secondShootLocation = "Stage 4, Downtown Studio";
  const secondLocationResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/stripboard`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ sceneLocations: { [secondScene.id]: secondShootLocation } }),
  });
  assert.equal(secondLocationResponse.status, 200);
  assert.deepEqual((await secondLocationResponse.json()).project.shootLocations, [secondShootLocation, shootLocation]);

  const reusedLocationResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/stripboard`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ sceneLocations: { [firstScene.id]: shootLocation } }),
  });
  assert.equal(reusedLocationResponse.status, 200);
  assert.deepEqual((await reusedLocationResponse.json()).project.shootLocations, [shootLocation, secondShootLocation]);

  const shots = [{ size: "Close up", angle: "Eye level", focalLength: "50mm", estimatedMinutes: 30, movement: "Static", description: "The notebook opens.", sourceExcerpt: "opens a notebook" }];
  const shotsResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/scenes/${firstScene.id}/shots`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ shots }),
  });
  assert.equal(shotsResponse.status, 200);
  const savedShots = (await shotsResponse.json()).shots;
  const firstShotId = savedShots[0].id;
  assert.match(firstShotId, /^sh_[a-f0-9]+$/);
  assert.equal(savedShots[0].estimatedMinutes, 30);

  const overBudgetShotsResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/scenes/${firstScene.id}/shots`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ shots: [
      { ...shots[0], id: firstShotId, estimatedMinutes: 45 },
      { size: "Wide", angle: "Eye level", focalLength: "35mm", estimatedMinutes: 45, movement: "Static", description: "The room holds.", sourceExcerpt: "opens a notebook" },
    ] }),
  });
  assert.equal(overBudgetShotsResponse.status, 409);
  assert.equal((await overBudgetShotsResponse.json()).error, "shot_time_budget_exceeded");

  const referenceBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const sceneReferenceUpload = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/shotlist/references`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      "X-Scene-Id": encodeURIComponent(firstScene.id),
      "X-Filename": encodeURIComponent("scene mood.png"),
      Cookie: ownerCookie,
    },
    body: referenceBytes,
  });
  assert.equal(sceneReferenceUpload.status, 201);
  const sceneReference = (await sceneReferenceUpload.json()).asset;
  assert.match(sceneReference.id, /^ref_[a-f0-9]+$/);
  assert.equal(Object.prototype.hasOwnProperty.call(sceneReference, "key"), false);

  const shotReferenceUpload = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/shotlist/references`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      "X-Scene-Id": encodeURIComponent(firstScene.id),
      "X-Shot-Id": encodeURIComponent(firstShotId),
      "X-Filename": encodeURIComponent("shot framing.png"),
      Cookie: ownerCookie,
    },
    body: referenceBytes,
  });
  assert.equal(shotReferenceUpload.status, 201);
  const shotReference = (await shotReferenceUpload.json()).asset;
  assert.match(shotReference.id, /^ref_[a-f0-9]+$/);

  const manualSceneResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/shotlist/scenes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ title: "Pickup scene" }),
  });
  assert.equal(manualSceneResponse.status, 201);
  const manualScene = (await manualSceneResponse.json()).scene;
  assert.match(manualScene.id, /^shsc_[a-f0-9]+$/);
  assert.equal(manualScene.manual, true);

  const renamedManualSceneResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/shotlist/scenes/${manualScene.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ title: "EXT. PICKUP INSERTS - DAWN" }),
  });
  assert.equal(renamedManualSceneResponse.status, 200);

  const manualShots = [{ size: "Insert", angle: "Top down", focalLength: "85mm", estimatedMinutes: 20, movement: "Static", description: "A key turns in the lock." }];
  const manualShotsResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/scenes/${manualScene.id}/shots`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ shots: manualShots }),
  });
  assert.equal(manualShotsResponse.status, 200);

  const shotListPdfResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/shotlist.pdf`, { headers: { Cookie: ownerCookie } });
  assert.equal(shotListPdfResponse.status, 200);
  assert.equal(shotListPdfResponse.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await shotListPdfResponse.arrayBuffer()).subarray(0, 4).toString("ascii"), "%PDF");

  const initialBudgetResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/budget`, { headers: { Cookie: ownerCookie } });
  assert.equal(initialBudgetResponse.status, 200);
  const initialBudgetPayload = await initialBudgetResponse.json();
  const budget = initialBudgetPayload.budget;
  assert.equal(initialBudgetPayload.productionSchedule.connected, true);
  assert.equal(initialBudgetPayload.productionSchedule.source, "script_breakdown_stripboard");
  assert.equal(initialBudgetPayload.productionSchedule.shootDays, 2);
  budget.metadata.producer = "Budget Owner";
  budget.settings.taxRates.find((rate) => rate.id === "tax_standard").rate = 0.15;
  Object.assign(budget.accounts[0].items[0], {
    quantity: 2,
    multiplier: 1,
    unitCost: 625,
    taxRateId: "tax_standard",
    taxMode: "exclusive",
  });
  budget.accounts[0].items[0].schedule.shoot_1 = 1437.5;
  const budgetSaveResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/budget`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ budget }),
  });
  assert.equal(budgetSaveResponse.status, 200);
  const savedBudgetPayload = await budgetSaveResponse.json();
  assert.equal(savedBudgetPayload.productionSchedule.shootDays, 2);
  assert.equal(savedBudgetPayload.budget.accounts[0].items[0].schedule.shoot_1, 1437.5);

  const initialCalendarResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/calendar`, { headers: { Cookie: ownerCookie } });
  assert.equal(initialCalendarResponse.status, 200);
  const calendar = (await initialCalendarResponse.json()).calendar;
  assert.ok(calendar.tasks.length >= 40);
  calendar.settings.projectStart = "2026-08-03";
  const calendarOwnerTask = calendar.tasks[0];
  calendarOwnerTask.owner = "Calendar Owner";
  calendarOwnerTask.progress = 25;
  calendarOwnerTask.status = "in_progress";
  const calendarShootTask = calendar.tasks.find((task) => task.kind === "shoot");
  assert.ok(calendarShootTask);
  calendarShootTask.durationDays = 4;
  const calendarSaveResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/calendar`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ calendar }),
  });
  assert.equal(calendarSaveResponse.status, 200);
  const savedCalendar = (await calendarSaveResponse.json()).calendar;
  const computedCalendar = computeCalendar(savedCalendar, "Editable Cover");
  assert.equal(savedCalendar.settings.projectStart, "2026-08-03");
  assert.equal(savedCalendar.tasks.find((task) => task.id === calendarOwnerTask.id).owner, "Calendar Owner");
  assert.equal(savedCalendar.tasks.find((task) => task.id === calendarShootTask.id).durationDays, 4);

  const calendarConnectedBudgetResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/budget`, { headers: { Cookie: ownerCookie } });
  assert.equal(calendarConnectedBudgetResponse.status, 200);
  const calendarConnectedBudgetPayload = await calendarConnectedBudgetResponse.json();
  assert.equal(calendarConnectedBudgetPayload.calendarConnected, true);
  assert.equal(
    calendarConnectedBudgetPayload.budget.metadata.shootingDates,
    `${computedCalendar.shootingStart} – ${computedCalendar.shootingEnd}`,
  );

  const receiptBytes = referenceBytes;
  const receiptUploadResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/budget/receipts`, {
    method: "POST",
    headers: { "Content-Type": "image/png", "X-Filename": encodeURIComponent("budget proof.png"), Cookie: ownerCookie },
    body: receiptBytes,
  });
  assert.equal(receiptUploadResponse.status, 201);
  const receipt = (await receiptUploadResponse.json()).receipt;
  assert.equal(receipt.size, receiptBytes.length);

  await stopServer(running.child);
  running = await startServer(dataDir);

  const reloadedScriptResponse = await fetch(`${running.url}/api/scripts/${scriptId}`, { headers: { Cookie: ownerCookie } });
  assert.equal(reloadedScriptResponse.status, 200);
  const reloadedScript = (await reloadedScriptResponse.json()).script;
  assert.deepEqual(reloadedScript.chat, chat);
  assert.deepEqual(reloadedScript.blocks.map(({ type, text }) => ({ type, text })), blocks);
  assert.ok(reloadedScript.blocks.every((block) => /^blk_/.test(block.id)));
  assert.deepEqual(reloadedScript.characterNames, characterNames);
  assert.equal(reloadedScript.title, "Editable Cover");

  const reloadedPreferencesResponse = await fetch(`${running.url}/api/me/lumiere-preferences`, { headers: { Cookie: ownerCookie } });
  assert.equal(reloadedPreferencesResponse.status, 200);
  const reloadedPreferences = (await reloadedPreferencesResponse.json()).preferences;
  assert.deepEqual(reloadedPreferences.directors, lumierePreferences.directors);
  assert.deepEqual(reloadedPreferences.styles, lumierePreferences.styles);
  assert.equal(reloadedPreferences.creativePriorities, lumierePreferences.creativePriorities);

  const reloadedProjectResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction`, { headers: { Cookie: ownerCookie } });
  assert.equal(reloadedProjectResponse.status, 200);
  const reloadedProject = (await reloadedProjectResponse.json()).project;
  assert.deepEqual(reloadedProject.stripboardOrder, order);
  const reloadedFirstScene = reloadedProject.scenes.find((scene) => scene.id === firstScene.id);
  assert.equal(reloadedFirstScene.strip.location, shootLocation);
  assert.deepEqual(reloadedFirstScene.strip.castIds, [1, 2]);
  assert.equal(reloadedFirstScene.strip.estimatedMinutes, 75);
  assert.deepEqual(reloadedProject.shootLocations, [shootLocation, secondShootLocation]);
  assert.equal(reloadedFirstScene.breakdownForm.metadata.scriptDay, "3");
  assert.equal(reloadedFirstScene.breakdownForm.cells.props, "Notebook\nCoffee cup");
  assert.equal(reloadedFirstScene.shots[0].description, "The notebook opens.");
  assert.equal(reloadedFirstScene.shots[0].focalLength, "50mm");
  assert.equal(reloadedFirstScene.shots[0].estimatedMinutes, 30);
  assert.equal(reloadedFirstScene.shots[0].userEdited, true);
  assert.equal(reloadedFirstScene.referenceAsset.id, sceneReference.id);
  assert.equal(reloadedFirstScene.shots[0].referenceAsset.id, shotReference.id);
  assert.equal(reloadedProject.manualShotScenes.length, 1);
  assert.equal(reloadedProject.manualShotScenes[0].id, manualScene.id);
  assert.equal(reloadedProject.manualShotScenes[0].title, "EXT. PICKUP INSERTS - DAWN");
  assert.equal(reloadedProject.manualShotScenes[0].shots[0].description, "A key turns in the lock.");
  assert.equal(reloadedProject.manualShotScenes[0].shots[0].focalLength, "85mm");
  assert.equal(reloadedProject.manualShotScenes[0].shots[0].estimatedMinutes, 20);

  const clearStripboardTimeResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/stripboard`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ sceneTimings: { [firstScene.id]: null } }),
  });
  assert.equal(clearStripboardTimeResponse.status, 200);
  const clearedStripboard = (await clearStripboardTimeResponse.json()).project;
  const clearedFirstScene = clearedStripboard.scenes.find((scene) => scene.id === firstScene.id);
  assert.equal(Object.prototype.hasOwnProperty.call(clearedFirstScene.strip || {}, "estimatedMinutes"), false);

  const reloadedBudgetResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/budget`, { headers: { Cookie: ownerCookie } });
  assert.equal(reloadedBudgetResponse.status, 200);
  const reloadedBudgetPayload = await reloadedBudgetResponse.json();
  const reloadedBudget = reloadedBudgetPayload.budget;
  assert.equal(reloadedBudget.metadata.producer, "Budget Owner");
  assert.equal(reloadedBudget.settings.taxRates.find((rate) => rate.id === "tax_standard").rate, 0.15);
  assert.equal(reloadedBudget.accounts[0].items[0].unitCost, 625);
  assert.equal(reloadedBudget.accounts[0].items[0].schedule.shoot_1, 1437.5);
  assert.equal(reloadedBudgetPayload.calendarConnected, true);
  assert.equal(reloadedBudget.metadata.shootingDates, `${computedCalendar.shootingStart} – ${computedCalendar.shootingEnd}`);

  const reloadedCalendarResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/calendar`, { headers: { Cookie: ownerCookie } });
  assert.equal(reloadedCalendarResponse.status, 200);
  const reloadedCalendar = (await reloadedCalendarResponse.json()).calendar;
  assert.equal(reloadedCalendar.settings.projectStart, "2026-08-03");
  assert.equal(reloadedCalendar.tasks.find((task) => task.id === calendarOwnerTask.id).owner, "Calendar Owner");
  assert.equal(reloadedCalendar.tasks.find((task) => task.id === calendarOwnerTask.id).progress, 25);
  assert.equal(reloadedCalendar.tasks.find((task) => task.id === calendarShootTask.id).durationDays, 4);

  const receiptResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/budget/receipts/${receipt.id}`, { headers: { Cookie: ownerCookie } });
  assert.equal(receiptResponse.status, 200);
  assert.equal(receiptResponse.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await receiptResponse.arrayBuffer()), receiptBytes);

  for (const reference of [sceneReference, shotReference]) {
    const referenceResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/shotlist/references/${reference.id}`, { headers: { Cookie: ownerCookie } });
    assert.equal(referenceResponse.status, 200);
    assert.equal(referenceResponse.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await referenceResponse.arrayBuffer()), referenceBytes);
  }

  const budgetPdfResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/budget.pdf`, { headers: { Cookie: ownerCookie } });
  assert.equal(budgetPdfResponse.status, 200);
  assert.equal(budgetPdfResponse.headers.get("content-type"), "application/pdf");
  assert.ok((await budgetPdfResponse.arrayBuffer()).byteLength > 10_000);

  for (const documentName of ["breakdown", "stripboard", "shotlist"]) {
    const pdfResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/${documentName}.pdf`, { headers: { Cookie: ownerCookie } });
    assert.equal(pdfResponse.status, 200, `${documentName} should remain exportable without a paid plan`);
    assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
    assert.ok((await pdfResponse.arrayBuffer()).byteLength > 1_000);
  }

  const lumiereResponse = await fetch(`${running.url}/api/lumiere`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ messages: [{ role: "user", content: "Analyze this screenplay." }] }),
  });
  assert.equal(lumiereResponse.status, 503);
  assert.equal((await lumiereResponse.json()).error, "openai_unavailable");

  const analysisResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
  });
  assert.equal(analysisResponse.status, 202);

  const generationResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/shotlists`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ sceneId: secondScene.id }),
  });
  assert.equal(generationResponse.status, 202);

  const otherScriptResponse = await fetch(`${running.url}/api/scripts/${scriptId}`, { headers: { Cookie: otherCookie } });
  assert.equal(otherScriptResponse.status, 404);
  const otherProjectResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction`, { headers: { Cookie: otherCookie } });
  assert.equal(otherProjectResponse.status, 404);
  const otherReferenceResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/shotlist/references/${sceneReference.id}`, { headers: { Cookie: otherCookie } });
  assert.equal(otherReferenceResponse.status, 404);
  const otherManualSceneResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/shotlist/scenes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: otherCookie },
    body: JSON.stringify({ title: "Unauthorized scene" }),
  });
  assert.equal(otherManualSceneResponse.status, 404);
  const otherBudgetResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/budget`, { headers: { Cookie: otherCookie } });
  assert.equal(otherBudgetResponse.status, 404);
  const otherCalendarResponse = await fetch(`${running.url}/api/scripts/${scriptId}/preproduction/calendar`, { headers: { Cookie: otherCookie } });
  assert.equal(otherCalendarResponse.status, 404);
  const otherListResponse = await fetch(`${running.url}/api/scripts`, { headers: { Cookie: otherCookie } });
  assert.deepEqual((await otherListResponse.json()).scripts, []);
  const otherPreferencesResponse = await fetch(`${running.url}/api/me/lumiere-preferences`, { headers: { Cookie: otherCookie } });
  assert.equal(otherPreferencesResponse.status, 200);
  assert.deepEqual((await otherPreferencesResponse.json()).preferences.directors, []);
});
