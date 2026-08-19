import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { AI_MODELS, modelForTask, publicAIJob, routeAIRequest } from "../ai-router.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Lumière uses Terra for Analysis and Breakdown, while Sol keeps retryable fallback coverage", async () => {
  assert.equal(modelForTask("analysis", {}), AI_MODELS.terra);
  assert.equal(modelForTask("breakdown", {}), AI_MODELS.terra);
  assert.equal(modelForTask("translation", {}), AI_MODELS.sol);
  assert.equal(modelForTask("chat", {}), AI_MODELS.luna);
  assert.equal(modelForTask("unknown", {}), AI_MODELS.luna);

  const calls = [];
  const fallback = await routeAIRequest({
    task: "translation",
    request: { prompt: "scene" },
    invoke: async ({ model }) => {
      calls.push(model);
      if (model === AI_MODELS.sol) throw Object.assign(new Error("temporarily unavailable"), { status: 503, code: "provider_busy" });
      return { ok: true };
    },
  });
  assert.deepEqual(calls, [AI_MODELS.sol, AI_MODELS.terra]);
  assert.equal(fallback.completedModel, AI_MODELS.terra);
  assert.equal(fallback.usedFallback, true);

  const noFallbackCalls = [];
  await assert.rejects(routeAIRequest({
    task: "analysis",
    request: {},
    invoke: async ({ model }) => {
      noFallbackCalls.push(model);
      throw Object.assign(new Error("bad input"), { status: 422, code: "invalid_input" });
    },
  }), /bad input/);
  assert.deepEqual(noFallbackCalls, [AI_MODELS.terra]);

  const publicJob = publicAIJob({ id: "job_safe", input: { creditReservationId: "private" }, internalPrimaryModel: AI_MODELS.sol, internalCompletedModel: AI_MODELS.terra, usedFallback: true });
  assert.deepEqual(publicJob, { id: "job_safe" });
});

test("durable jobs are idempotent, permission scoped, and build context without Budget data", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-ai-infrastructure-"));
  const source = `
    import { connectGoogleIdentity, createSession, savePreproductionSnapshot, saveScriptsSnapshot } from "./database.js";

    const ownerSession = createSession();
    const owner = connectGoogleIdentity(ownerSession.session.id, { sub: "ai-owner", email: "owner@example.test", name: "Owner", email_verified: true });
    const otherSession = createSession();
    const other = connectGoogleIdentity(otherSession.session.id, { sub: "ai-other", email: "other@example.test", name: "Other", email_verified: true });
    const projectId = "scr_a1b2c3d4e5f6";
    const now = new Date().toISOString();
    saveScriptsSnapshot({ scripts: { [projectId]: {
      id: projectId, userId: owner.id, title: "Private Screenplay", text: "INT. OFFICE - DAY", createdAt: now, updatedAt: now,
      blocks: [{ id: "blk_1", type: "scene", text: "INT. OFFICE - DAY" }, { id: "blk_2", type: "action", text: "A writer works quietly." }], chat: [], titleRoom: {}, characterNames: {},
    } } });
    savePreproductionSnapshot({ projects: { [projectId]: { scenes: {
      sc_1: { id: "sc_1", title: "INT. OFFICE - DAY", breakdown: { elements: [{ category: "props", name: "Notebook", cost: 999 }] }, shots: [{ description: "Close shot", cost: 50 }] },
    } } } });

    const server = await import("./server.js");
    const platform = await import("./platform-database.js");
    const sourceHash = "source-hash";
    const created = platform.createAIJob({ projectId, requestedByUserId: owner.id, type: "analysis", sourceScriptId: projectId, sourceScriptVersionId: now, sourceContentHash: sourceHash, internalPrimaryModel: "gpt-5.6-terra", reservedCredits: 1, idempotencyKey: "same-request", input: { language: "en", creditReservationId: "private" }, outputSchemaVersion: 1 });
    const duplicate = platform.createAIJob({ projectId, requestedByUserId: owner.id, type: "analysis", sourceScriptId: projectId, sourceScriptVersionId: now, sourceContentHash: sourceHash, internalPrimaryModel: "gpt-5.6-terra", reservedCredits: 1, idempotencyKey: "same-request", input: { language: "en" }, outputSchemaVersion: 1 });
    platform.updateAIJob(created.id, { status: "failed", stage: "failed", errorCode: "provider_unavailable" });
    const retried = platform.retryAIJob(created.id, owner.id);
    const context = server.__aiInfrastructureTesting.buildAuthorizedLumiereContext(owner.id, projectId);
    let denied = null;
    try { server.__aiInfrastructureTesting.buildAuthorizedLumiereContext(other.id, projectId); } catch (error) { denied = error.code; }
    const reservation = server.__aiInfrastructureTesting.reserveTextCredits(owner.id, 1, "durable-credit");
    const duplicateReservation = server.__aiInfrastructureTesting.reserveTextCredits(owner.id, 1, "durable-credit");
    const settled = server.__aiInfrastructureTesting.settleTextCredits(owner.id, "durable-credit", 1);
    console.log(JSON.stringify({
      created: created.created, duplicate: duplicate.created, sameId: created.id === duplicate.id,
      retried: retried.created, retryIdChanged: retried.id !== created.id,
      otherJob: platform.getAIJob(created.id, other.id), context, denied,
      reservation, duplicateReservation, settled,
    }));
  `;
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir, FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE", FILMSCRIPT_PREVIEW_MODE: "false" },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout.trim().split("\n").at(-1));
    assert.equal(output.created, true);
    assert.equal(output.duplicate, false);
    assert.equal(output.sameId, true);
    assert.equal(output.retried, true);
    assert.equal(output.retryIdChanged, true);
    assert.equal(output.otherJob, null);
    assert.equal(output.denied, "permission_denied");
    assert.equal(output.reservation.allowed, true);
    assert.equal(output.duplicateReservation.duplicate, true);
    assert.equal(output.settled, true);
    assert.match(output.context, /Private Screenplay/);
    assert.doesNotMatch(output.context, /\"budget\"|999|\"cost\"/i);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
