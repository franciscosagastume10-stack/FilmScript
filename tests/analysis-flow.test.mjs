import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildAnalysisSnapshot, normalizeEmotionalArc } from "../analysis-model.js";

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

test("Analysis derives live metrics and preserves stable scene IDs when scenes move", () => {
  const firstBlocks = [
    { type: "scene", text: "INT. WRITING ROOM - DAY" },
    { type: "action", text: "RENE opens the notebook and studies the last page." },
    { type: "character", text: "RENE" },
    { type: "dialogue", text: "We need a better ending before sunrise." },
    { type: "pagebreak", text: "" },
    { type: "scene", text: "EXT. EMPTY STREET - NIGHT" },
    { type: "action", text: "SAMUEL runs through the rain with the notebook." },
    { type: "character", text: "SAMUEL" },
    { type: "dialogue", text: "Then let us write it now." },
  ];
  const first = buildAnalysisSnapshot({ id: "scr_analysis", updatedAt: "v1", blocks: firstBlocks });
  assert.equal(first.metrics.pages, 2);
  assert.equal(first.metrics.scenes, 2);
  assert.equal(first.metrics.interiorScenes, 1);
  assert.equal(first.metrics.exteriorScenes, 1);
  assert.equal(first.metrics.dayScenes, 1);
  assert.equal(first.metrics.nightScenes, 1);
  assert.ok(first.metrics.dialogueWords > 0);
  assert.ok(first.metrics.actionWords > 0);

  const secondScene = firstBlocks.slice(5);
  const firstScene = firstBlocks.slice(0, 4);
  const moved = buildAnalysisSnapshot({ id: "scr_analysis", updatedAt: "v2", blocks: [...secondScene, { type: "pagebreak", text: "" }, ...firstScene] }, first);
  const oldByHeading = new Map(first.sceneIndex.map((scene) => [scene.heading, scene.id]));
  const movedByHeading = new Map(moved.sceneIndex.map((scene) => [scene.heading, scene.id]));
  assert.equal(movedByHeading.get("INT. WRITING ROOM - DAY"), oldByHeading.get("INT. WRITING ROOM - DAY"));
  assert.equal(movedByHeading.get("EXT. EMPTY STREET - NIGHT"), oldByHeading.get("EXT. EMPTY STREET - NIGHT"));

  const withCover = buildAnalysisSnapshot({
    id: "scr_analysis_cover",
    updatedAt: "v1",
    blocks: [
      { type: "title", text: "THE NOTEBOOK" },
      { type: "title_credit", text: "Written by" },
      { type: "title_author", text: "A Writer" },
      { type: "pagebreak", text: "" },
      ...firstBlocks,
    ],
  });
  assert.equal(withCover.metrics.pages, 2, "the cover is not counted as a screenplay page");
  assert.equal(withCover.sceneIndex[0].page, 1, "the first scene starts on screenplay page 1");
  assert.equal(withCover.metrics.words, first.metrics.words, "cover words are excluded from screenplay analysis");
});

test("Emotional Arc detects valence-shaped data and restores dramatic intensity", () => {
  const corrected = normalizeEmotionalArc([
    { sceneNumber: 1, value: 65, label: "Content / Playful", explanation: "A tender father-son moment.", marker: "" },
    { sceneNumber: 2, value: 35, label: "Anxious / Threatened", explanation: "A threat places the family in danger.", marker: "" },
    { sceneNumber: 3, value: 10, label: "Horror / Helpless", explanation: "Violence erupts and all control is lost.", marker: "Emotional Peak" },
    { sceneNumber: 4, value: 5, label: "Uncontrolled Rage", explanation: "He beats the attacker in a near-death confrontation.", marker: "Emotional Peak" },
    { sceneNumber: 5, value: 20, label: "Hollow / Hunted", explanation: "Alone and bloodied, he is pursued by police with no resolution.", marker: "Final dread" },
  ]);

  assert.ok(corrected[0].value < corrected[1].value, "threat is more intense than the playful opening");
  assert.ok(corrected[3].value >= 90, "violent rage remains a dramatic peak");
  assert.equal(corrected.at(-1).value, 100, "an unresolved high-pressure ending becomes the highest point");
  assert.equal(corrected.filter((point) => point.marker === "Emotional Peak").length, 1, "duplicate peak labels are removed");

  const alreadyIntensity = normalizeEmotionalArc([
    { value: 25, label: "Quiet", explanation: "The room settles." },
    { value: 72, label: "Threatened", explanation: "Danger closes in." },
    { value: 94, label: "Rage", explanation: "The confrontation explodes." },
  ]);
  assert.deepEqual(alreadyIntensity.map((point) => point.value), [25, 72, 94], "a valid intensity curve is preserved");

  const unresolvedEnding = normalizeEmotionalArc([
    { value: 40, label: "Playful", explanation: "A quiet opening." },
    { value: 98, label: "Catastrophic loss", explanation: "Violence destroys the relationship." },
    { value: 90, label: "Hunted and hollow", explanation: "He remains alone and pursued with no resolution." },
  ]);
  assert.deepEqual(unresolvedEnding.map((point) => point.value), [40, 98, 100], "a high-pressure unresolved finale becomes the culmination");
});

test("account Analysis persists feedback, stays owner-scoped, and exports the current A4 report", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-analysis-test-"));
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { connectGoogleIdentity, createSession } from "./database.js";
    const owner = createSession();
    connectGoogleIdentity(owner.session.id, { sub: "google_analysis_owner", email: "analysis@example.com", name: "Analysis Owner", email_verified: true });
    const other = createSession();
    connectGoogleIdentity(other.session.id, { sub: "google_analysis_other", email: "other-analysis@example.com", name: "Other", email_verified: true });
    console.log(JSON.stringify({ ownerToken: owner.token, otherToken: other.token }));
  `], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir },
    encoding: "utf8",
  });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const identity = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));
  const ownerCookie = `filmscript_sid=${encodeURIComponent(identity.ownerToken)}`;
  const otherCookie = `filmscript_sid=${encodeURIComponent(identity.otherToken)}`;
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const runtimePython = "/Users/franciscosagastume/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
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
      PDF_PYTHON: runtimePython,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(url, child);
  t.after(async () => {
    await stopServer(child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const importedResponse = await fetch(`${url}/api/scripts/import`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "X-Filename": "Analysis Test.fs", Cookie: ownerCookie },
    body: "INT. ROOM - DAY\nA writer opens a notebook.\nEXT. STREET - NIGHT\nThe writer runs through rain.",
  });
  assert.equal(importedResponse.status, 201);
  const scriptId = (await importedResponse.json()).script.id;
  const blocks = [
    { type: "scene", text: "INT. WRITING ROOM - DAY" },
    { type: "action", text: "RENE opens the notebook and studies the ending while a clock ticks beside him." },
    { type: "character", text: "RENE" },
    { type: "dialogue", text: "The story needs one honest decision before morning arrives." },
    { type: "action", text: "He tears out the false ending and leaves the real page on the desk." },
    { type: "pagebreak", text: "" },
    { type: "scene", text: "EXT. EMPTY STREET - NIGHT" },
    { type: "action", text: "SAMUEL runs through hard rain, carrying the missing notebook beneath his coat." },
    { type: "character", text: "SAMUEL" },
    { type: "dialogue", text: "If he reads this page, everything between us changes tonight." },
    { type: "action", text: "A bus turns the corner. Samuel chooses the alley and disappears." },
  ];
  const saveResponse = await fetch(`${url}/api/scripts/${scriptId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ blocks }),
  });
  assert.equal(saveResponse.status, 200);

  const analysisResponse = await fetch(`${url}/api/scripts/${scriptId}/analysis`, { headers: { Cookie: ownerCookie } });
  assert.equal(analysisResponse.status, 200);
  const analysis = (await analysisResponse.json()).analysis;
  assert.equal(analysis.scriptId, scriptId);
  assert.equal(analysis.metrics.pages, 2);
  assert.equal(analysis.metrics.scenes, 2);
  assert.equal(analysis.metrics.interiorScenes, 1);
  assert.equal(analysis.metrics.exteriorScenes, 1);
  assert.equal(analysis.metrics.dayScenes, 1);
  assert.equal(analysis.metrics.nightScenes, 1);
  assert.equal(analysis.hasEnoughContent, true);
  assert.equal(analysis.deep, null);

  const foreignResponse = await fetch(`${url}/api/scripts/${scriptId}/analysis`, { headers: { Cookie: otherCookie } });
  assert.equal(foreignResponse.status, 404);

  const generationResponse = await fetch(`${url}/api/scripts/${scriptId}/analysis`, { method: "POST", headers: { Cookie: ownerCookie } });
  assert.equal(generationResponse.status, 403);
  assert.equal((await generationResponse.json()).error, "filmscript_pro_required");

  const feedbackResponse = await fetch(`${url}/api/scripts/${scriptId}/analysis`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({ action: "genre", label: "Thriller" }),
  });
  assert.equal(feedbackResponse.status, 200);
  assert.equal((await feedbackResponse.json()).analysis.feedback.intendedGenre, "Thriller");

  const decisionResponse = await fetch(`${url}/api/scripts/${scriptId}/analysis`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: ownerCookie },
    body: JSON.stringify({
      action: "artisticDecision",
      key: "Ambiguous ending",
      observationId: "att_example",
      observationTitle: "Ambiguous ending",
      decision: "The ambiguity is intentional for this screenplay.",
      sceneId: analysis.sceneIds[0],
      sceneIds: [analysis.sceneIds[0]],
    }),
  });
  assert.equal(decisionResponse.status, 200);
  const decisionAnalysis = (await decisionResponse.json()).analysis;
  assert.equal(decisionAnalysis.feedback.artisticDecisions[0].observationId, "att_example");
  assert.equal(decisionAnalysis.feedback.artisticDecisions[0].observationTitle, "Ambiguous ending");

  const reloadedResponse = await fetch(`${url}/api/scripts/${scriptId}/analysis`, { headers: { Cookie: ownerCookie } });
  assert.equal((await reloadedResponse.json()).analysis.feedback.intendedGenre, "Thriller");

  const pdfResponse = await fetch(`${url}/api/scripts/${scriptId}/analysis.pdf`, { headers: { Cookie: ownerCookie } });
  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 2500);
});
