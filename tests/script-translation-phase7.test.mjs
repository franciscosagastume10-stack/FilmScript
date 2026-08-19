import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  TRANSLATION_LANGUAGES,
  screenplayPageCount,
  screenplayTranslationPacket,
  translatedProjectName,
  translationCreditCost,
  validateTranslatedBlocks,
} from "../translation-policy.js";
import { AI_MODELS, routeAIRequest } from "../ai-router.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("translation supports only the five approved languages and quotes stable screenplay page pricing", () => {
  assert.deepEqual(TRANSLATION_LANGUAGES, ["English", "Spanish", "French", "Portuguese", "German"]);
  assert.deepEqual([30, 31, 60, 61, 100, 101, 150, 151, 200, 201, 250, 251].map(translationCreditCost), [10, 20, 20, 50, 50, 75, 75, 100, 100, 125, 125, 150]);
  assert.equal(screenplayPageCount([{ type: "action", text: "x".repeat(3000) }]), 1);
  assert.equal(screenplayPageCount([{ type: "action", text: "x" }, { type: "pagebreak", text: "" }, { type: "action", text: "x" }]), 2);
  assert.equal(translatedProjectName("Test Script", "Spanish"), "Test Script — Spanish Version");
});

test("translation packets preserve screenplay block metadata, entities, notes, and revision structure", () => {
  const source = [
    { id: "blk_1", type: "scene", text: "INT. CASA DE NILA - NIGHT", sceneNumber: "12", note: "Keep the rain", revision: "blue" },
    { id: "blk_2", type: "character", text: "NILA", revision: "blue" },
  ];
  const packet = screenplayTranslationPacket(source, { entity_1: { name: "NILA", occurrences: [0, 1] } });
  assert.deepEqual(packet.map((block) => block.entities), [["entity_1"], ["entity_1"]]);
  const result = validateTranslatedBlocks([
    { id: "blk_1", type: "scene", text: "INT. NILA'S HOUSE - NIGHT" },
    { id: "blk_2", type: "character", text: "NILA" },
  ], source);
  assert.equal(result[0].sceneNumber, "12");
  assert.equal(result[0].note, "Keep the rain");
  assert.equal(result[0].revision, "blue");
  assert.equal(result[1].text, "NILA");
});

test("translation prepares protected entities and keeps a distinct durable job for each target language", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-translation-phase7-"));
  const source = `
    import { connectGoogleIdentity, createSession, saveScriptsSnapshot } from "./database.js";
    const session = createSession();
    const owner = connectGoogleIdentity(session.session.id, { sub: "translation-owner", email: "translation-owner@example.test", name: "Owner", email_verified: true });
    const projectId = "scr_a17a17a17a17a17a17a";
    const now = new Date().toISOString();
    saveScriptsSnapshot({ scripts: { [projectId]: { id: projectId, userId: owner.id, title: "Nila's Test", text: "", createdAt: now, updatedAt: now, chat: [], titleRoom: {}, characterNames: {}, blocks: [
      { id: "blk_1", type: "scene", text: "INT. CASA DE NILA - NIGHT" },
      { id: "blk_2", type: "action", text: "NILA parks an ACME truck outside." },
      { id: "blk_3", type: "character", text: "NILA" },
      { id: "blk_4", type: "dialogue", text: "Meet me at ACME." },
    ] } } });
    const server = await import("./server.js");
    const args = { type: "translation", projectId, requesterId: owner.id, sourceScriptVersionId: now, sourceContentHash: "translation-source", reservedCredits: 0 };
    const spanish = server.__aiInfrastructureTesting.createDurableAIJob({ ...args, input: { targetLanguage: "Spanish" } });
    const spanishRepeat = server.__aiInfrastructureTesting.createDurableAIJob({ ...args, input: { targetLanguage: "Spanish" } });
    const french = server.__aiInfrastructureTesting.createDurableAIJob({ ...args, input: { targetLanguage: "French" } });
    const entities = server.__translationTesting.translationEntityMap({ blocks: [
      { id: "blk_1", type: "scene", text: "INT. CASA DE NILA - NIGHT" },
      { id: "blk_2", type: "action", text: "NILA parks an ACME truck outside." },
      { id: "blk_3", type: "character", text: "NILA" },
    ] });
    console.log(JSON.stringify({ spanish, spanishRepeat, french, entities }));
  `;
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir, FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE", FILMSCRIPT_PREVIEW_MODE: "false" },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout.trim().split("\n").at(-1));
    assert.equal(output.spanish.created, true);
    assert.equal(output.spanishRepeat.created, false);
    assert.equal(output.spanish.job.id, output.spanishRepeat.job.id);
    assert.equal(output.french.created, true);
    assert.notEqual(output.spanish.job.id, output.french.job.id);
    const names = Object.values(output.entities).map((entry) => entry.name);
    assert.ok(names.includes("NILA"));
    assert.ok(names.includes("ACME"));
    assert.ok(!names.includes("CASA"));
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("the translation flow confirms price before work and keeps source access, reservations, fallback, and independent-project safeguards", async () => {
  const client = read("platform-client.js");
  const server = read("server.js");
  const router = read("ai-router.js");
  assert.match(client, /Confirm translation —/);
  assert.match(client, /Remaining after translation/);
  assert.match(client, /Future edits will not sync/);
  assert.match(server, /canUseLumiereAction\(access, "translation"\)/);
  assert.match(server, /reservedCredits: requiredCredits/);
  assert.match(server, /targetLanguage: input\.targetLanguage/);
  assert.match(server, /translationRelationship: \{ mode: "independent", synchronization: "none" \}/);
  assert.match(server, /backfillOwners\(\)/);
  assert.match(server, /requestLumiereForTask\("translation"/);
  assert.match(router, /translation: "sol"/);
  const attempts = [];
  const routed = await routeAIRequest({
    task: "translation",
    request: {},
    invoke: async ({ model }) => {
      attempts.push(model);
      if (model === AI_MODELS.sol) throw Object.assign(new Error("temporarily unavailable"), { status: 503 });
      return { ok: true };
    },
  });
  assert.deepEqual(attempts, [AI_MODELS.sol, AI_MODELS.terra]);
  assert.equal(routed.usedFallback, true);
});
