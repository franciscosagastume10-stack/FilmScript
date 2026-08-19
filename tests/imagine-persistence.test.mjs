import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runConcurrentGeneratedAssetScenario() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-imagine-persistence-"));
  const source = `
    import {
      connectGoogleIdentity,
      createSession,
      getCanvasLibrary,
      getCanvasWorkspace,
      saveScriptsSnapshot,
    } from "./database.js";
    import { __canvasTesting as canvas } from "./server.js";

    const session = createSession();
    const user = connectGoogleIdentity(session.session.id, {
      sub: "imagine-persistence-user",
      email: "imagine-persistence@example.test",
      name: "Imagine persistence writer",
    });
    const scriptId = "scr_imagine_persistence";
    const timestamp = new Date().toISOString();
    saveScriptsSnapshot({
      scripts: {
        [scriptId]: {
          id: scriptId,
          userId: user.id,
          title: "Imagine persistence test",
          text: "INT. TEST ROOM - DAY",
          blocks: [],
          chat: [],
          titleRoom: {},
          characterNames: {},
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    });

    // These intentionally capture the same empty workspace, just as two
    // image requests do before their independent provider calls finish.
    const firstStaleContext = canvas.canvasContext(scriptId, user.id);
    const secondStaleContext = canvas.canvasContext(scriptId, user.id);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const [first, second] = await Promise.all([
      canvas.storeGeneratedCanvasAsset(firstStaleContext, scriptId, jpeg, "First generated frame", {
        size: "1536x1024",
        source: "imagine",
      }),
      canvas.storeGeneratedCanvasAsset(secondStaleContext, scriptId, jpeg, "Second generated frame", {
        size: "1024x1536",
        source: "imagine",
      }),
    ]);
    const workspace = getCanvasWorkspace(scriptId, user.id);
    const library = getCanvasLibrary(user.id);
    console.log(JSON.stringify({
      returnedIds: [first.id, second.id],
      workspaceIds: workspace.assets.map((asset) => asset.id),
      libraryIds: library.assets.map((asset) => asset.id),
      prompts: workspace.assets.map((asset) => asset.prompt).sort(),
    }));
  `;
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        FILMSCRIPT_DATA_DIR: dataDir,
        FILMSCRIPT_PREVIEW_MODE: "false",
        FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout.trim());
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

test("parallel Imagine results retain every generated asset", () => {
  const scenario = runConcurrentGeneratedAssetScenario();
  assert.equal(new Set(scenario.returnedIds).size, 2);
  assert.deepEqual(new Set(scenario.workspaceIds), new Set(scenario.returnedIds));
  assert.deepEqual(new Set(scenario.libraryIds), new Set(scenario.returnedIds));
  assert.deepEqual(scenario.prompts, ["First generated frame", "Second generated frame"]);
});
