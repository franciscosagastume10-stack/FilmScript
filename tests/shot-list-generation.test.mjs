import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { AI_MODELS, modelForTask, routeAIRequest } from "../ai-router.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function runShotListScenario() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-shot-list-test-"));
  const source = `
    import { __shotListTesting as shotLists } from "./server.js";
    const scene = {
      id: "sc_1a2b3c4d",
      text: "INT. KITCHEN - NIGHT\\nMARA grips the red notebook while JON closes the door.",
      breakdown: { elements: [{ id:"brk_notebook", name:"Red notebook", sourceExcerpt:"MARA grips the red notebook" }] },
      strip: { location:"Kitchen" },
    };
    const candidate = shotLists.validateShotList({ shots: [
      { size:"Close", angle:"Eye level", focalLength:"50mm", movement:"Push in", camera:"A camera", characters:["MARA"], description:"MARA grips the notebook as the door closes.", notes:"Keep the notebook readable.", status:"planned", sourceExcerpt:"MARA grips the red notebook" },
      { size:"Wide", angle:"Low", focalLength:"28mm", movement:"Static", camera:"B camera", characters:["JON"], description:"JON closes the door behind him.", notes:"Hold room geography.", status:"ready", sourceExcerpt:"JON closes the door" },
    ] }, scene);
    const previous = [
      { ...candidate[0], id:"sh_existing", description:"Older coverage" },
      { id:"sh_manual", shotNumber:2, size:"Insert", angle:"Top", focalLength:"85mm", movement:"Static", description:"Manual insert of Mara's hand.", sourceExcerpt:"MARA grips the red notebook", userEdited:true, camera:"Handheld", characters:["MARA"], notes:"Manual choice", status:"ready" },
      { id:"sh_removed", shotNumber:3, size:"Wide", angle:"Eye", focalLength:"35mm", movement:"Static", description:"Old door coverage", sourceExcerpt:"MARA grips the red notebook", userEdited:false },
    ];
    const merged = shotLists.mergeGeneratedShotList(previous, candidate, scene);
    console.log(JSON.stringify({ candidate, merged }));
  `;
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir, FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE" },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout.trim());
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
}

test("Shot List uses the deep generation route and falls back safely", async () => {
  assert.equal(modelForTask("shot_list"), AI_MODELS.sol);
  const attempts = [];
  const routed = await routeAIRequest({
    task: "shot_list",
    request: {},
    onAttempt: (attempt) => attempts.push(attempt.model),
    invoke: async ({ model }) => {
      if (model === AI_MODELS.sol) throw Object.assign(new Error("temporarily busy"), { status: 503 });
      return { model };
    },
  });
  assert.equal(routed.usedFallback, true);
  assert.equal(routed.completedModel, AI_MODELS.terra);
  assert.deepEqual(attempts, [AI_MODELS.sol, AI_MODELS.terra]);
});

test("Shot List candidates include the structured production fields and preserve manual coverage", async () => {
  const scenario = await runShotListScenario();
  const [candidate] = scenario.candidate;
  assert.equal(candidate.camera, "A camera");
  assert.deepEqual(candidate.characters, ["MARA"]);
  assert.equal(candidate.notes, "Keep the notebook readable.");
  assert.equal(candidate.status, "planned");
  assert.equal(candidate.source, "lumiere");

  const merged = scenario.merged;
  assert.equal(merged.shots.find((shot) => shot.id === "sh_existing").description, "MARA grips the notebook as the door closes.");
  assert.equal(merged.shots.find((shot) => shot.id === "sh_manual").description, "Manual insert of Mara's hand.");
  assert.equal(merged.shots.some((shot) => shot.id === "sh_removed"), false);
  assert.equal(merged.diff.modifiedShots.length, 1);
  assert.equal(merged.diff.newShots.length, 1);
  assert.equal(merged.diff.removedShots.length, 1);
  assert.equal(merged.diff.manualEditsPreserved.length, 1);
  assert.ok(merged.shots.find((shot) => shot.id === "sh_existing").connections.breakdownElementIds.includes("brk_notebook"));
});

test("Shot List scheduling is explicit, durable, permission-scoped, and event-driven", async () => {
  const [server, editor, client, platform] = await Promise.all([
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "preproduction-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "platform-client.js"), "utf8"),
  ]);
  assert.match(server, /projectPermission\(sid, scriptId, "script", "view"\).*projectPermission\(sid, scriptId, "shot_list", "edit"\)/);
  assert.match(server, /type: "shot_list"/);
  assert.match(server, /regenerate: !!input\.regenerate/);
  assert.match(server, /updateAndBroadcastAIJob\(aiJobId/);
  assert.match(server, /reservedCredits: access\.free \? 0 : Math\.max\(1, pending\.length\)/);
  assert.match(client, /options\?\.regenerate === true/);
  assert.match(editor, /filmscript:ai\.job\.updated/);
  assert.match(editor, /Shot List background work is driven by the collaboration event stream/);
  assert.match(editor, /shotListGenerate/);
  assert.match(platform, /'ai\.job\.updated'/);
});

test("Shot List discussion stays on the conversational route and financial context stays excluded", async () => {
  const [server, editor] = await Promise.all([
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
  ]);
  assert.match(server, /requestLumiereForTask\("chat"/);
  assert.match(server, /requestedModule === "shot_list"/);
  assert.match(server, /No Budget, receipts, rates, quotes, invoices, or financial metadata are/);
  assert.match(editor, /module: chatModule/);
});
