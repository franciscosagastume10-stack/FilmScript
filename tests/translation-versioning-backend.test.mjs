import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { translatedProjectName } from "../translation-policy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("translated project names keep the first title clean and use two-digit later versions", () => {
  assert.equal(translatedProjectName("Nila", "English"), "Nila — English Version");
  assert.equal(translatedProjectName("Nila", "English", 2), "Nila — English Version 02");
  assert.equal(translatedProjectName("Nila", "English", 12), "Nila — English Version 12");
});

test("the browser request id stays stable across autosave revisions", () => {
  const server = read("server.js");
  assert.match(server, /hashText\(`\$\{sid\}:\$\{scriptId\}:\$\{targetLanguage\}:\$\{requestId\}`\)/);
  assert.doesNotMatch(server, /hashText\(`\$\{scriptId\}:\$\{script\.updatedAt\}:\$\{targetLanguage\}:\$\{sid\}:\$\{requestId\}`\)/);
  assert.match(server, /getAIJobByIdempotencyKey\(idempotencyKey, sid, true\)/);
  assert.match(server, /finally \{[\s\S]*releaseTextCredits\(script\.userId, reservationId\)/);
  assert.match(server, /translatedProject = saveScriptRecord\(translatedProject\)/);
  assert.doesNotMatch(server, /scripts\.scripts\[translatedId\][\s\S]{0,300}saveScripts\(scripts\)/);
  const settlement = server.slice(server.indexOf("function settleTextCredits"), server.indexOf("function releaseTextCredits"));
  assert.match(settlement, /if \(reservation\.state === "settled"\) return true/);
  assert.match(settlement, /snapshot\[userId\] = next;\s*saveLumiereCreditsSnapshot\(snapshot\)/);
  assert.doesNotMatch(settlement, /consumeLumiereCredit\(/);
});

test("translation jobs reserve ordinals atomically, deduplicate a request, and persist notification metadata", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-translation-versioning-"));
  const source = `
    const database = await import("./database.js");
    const session = database.createSession();
    const owner = database.connectGoogleIdentity(session.session.id, { sub: "version-owner", email: "version-owner@example.test", name: "Owner", email_verified: true });
    const collaboratorSession = database.createSession();
    const collaborator = database.connectGoogleIdentity(collaboratorSession.session.id, { sub: "version-collaborator", email: "version-collaborator@example.test", name: "Collaborator", email_verified: true });
    const sourceId = "scr_a17a17a17a17a17a17a";
    const now = new Date().toISOString();
    database.saveScriptsSnapshot({ scripts: { [sourceId]: { id: sourceId, userId: owner.id, title: "Nila", text: "Hello", blocks: [{ id: "blk_1", type: "action", text: "Hello" }], chat: [], titleRoom: {}, characterNames: {}, createdAt: now, updatedAt: now } } });
    const platform = await import("./platform-database.js");
    const invitation = platform.createInvitation(sourceId, owner.id, { email: collaborator.email, projectRole: "editor" });
    platform.acceptAccountInvitation(invitation.id, collaborator.id);
    const base = { projectId: sourceId, requestedByUserId: owner.id, sourceScriptId: sourceId, sourceScriptVersionId: now, sourceContentHash: "source-hash", internalPrimaryModel: "test-model", reservedCredits: 10, targetLanguage: "English", translationFamilyId: sourceId, input: { sourceProjectTitle: "Nila", pageCount: 1 }, outputSchemaVersion: 1 };
    const first = platform.createTranslationAIJob({ ...base, idempotencyKey: "translation-request-one" });
    const duplicate = platform.createTranslationAIJob({ ...base, idempotencyKey: "translation-request-one" });
    const second = platform.createTranslationAIJob({ ...base, idempotencyKey: "translation-request-two" });
    const firstClaim = platform.claimQueuedAIJob(first.job.id);
    const duplicateClaim = platform.claimQueuedAIJob(first.job.id);
    const freshRecovery = platform.claimRecoverableTranslationAIJob(first.job.id, { processingStaleBefore: "1970-01-01T00:00:00.000Z", savingStaleBefore: "1970-01-01T00:00:00.000Z" });
    const staleRecovery = platform.claimRecoverableTranslationAIJob(first.job.id, { processingStaleBefore: "2999-01-01T00:00:00.000Z", savingStaleBefore: "2999-01-01T00:00:00.000Z" });
    const recoverableIds = platform.listRecoverableTranslationAIJobs({ processingStaleBefore: "1970-01-01T00:00:00.000Z", savingStaleBefore: "1970-01-01T00:00:00.000Z" }).map((job) => job.id);
    const notificationInput = { userId: owner.id, projectId: sourceId, type: "translation_completed", title: "Translation is ready", message: "Ready", deduplicationKey: "translation-completed:" + first.job.id, metadata: { i18n: { en: { title: "Translation is ready" }, es: { title: "La traducción está lista" } }, translation: { jobId: first.job.id } } };
    const notificationOne = platform.createNotification(notificationInput);
    const notificationTwo = platform.createNotification(notificationInput);
    const notifications = platform.listNotifications(owner.id);
    const translatedId = "scr_b27b27b27b27b27b27b2";
    const sourceScript = database.loadScriptsSnapshot().scripts[sourceId];
    database.saveScriptRecord({ ...sourceScript, id: translatedId, title: "Nila — English Version", source: "translation", translatedFromProjectId: sourceId, translatedFromScriptId: sourceId, sourceLanguage: "Spanish", targetLanguage: "English", translationVersion: 1, translationJobId: first.job.id, translatedAt: now, createdAt: now, updatedAt: now });
    const persisted = database.loadScriptsSnapshot().scripts[translatedId];
    platform.backfillOwners();
    const inheritedAccess = platform.inheritTranslationProjectAccess(sourceId, translatedId, collaborator.id, owner.id);
    const fromTranslation = platform.createTranslationAIJob({ ...base, projectId: translatedId, sourceScriptId: translatedId, translationFamilyId: sourceId, idempotencyKey: "translation-request-three" });
    console.log(JSON.stringify({
      schemaVersion: database.databaseHealth().schemaVersion,
      firstJobId: first.job.id,
      firstCreated: first.created,
      duplicateCreated: duplicate.created,
      sameJob: first.job.id === duplicate.job.id,
      firstVersion: first.job.input.translationVersion,
      secondVersion: second.job.input.translationVersion,
      firstClaim: Boolean(firstClaim),
      duplicateClaim: Boolean(duplicateClaim),
      freshRecovery: Boolean(freshRecovery),
      staleRecovery: Boolean(staleRecovery),
      queuedRecoveryListed: recoverableIds.includes(second.job.id),
      notificationOne,
      notificationTwo,
      notificationCount: notifications.filter((entry) => entry.type === "translation_completed").length,
      notificationMetadata: notifications.find((entry) => entry.id === notificationOne)?.metadata,
      persisted,
      inheritedAccess,
      collaboratorRole: platform.projectAccess(collaborator.id, translatedId)?.projectRole,
      collaboratorCanList: platform.listAccessibleProjectIds(collaborator.id).includes(translatedId),
      fromTranslationVersion: fromTranslation.job.input.translationVersion,
      fromTranslationTitle: (await import("./translation-policy.js")).translatedProjectName(fromTranslation.job.input.sourceProjectTitle, fromTranslation.job.input.targetLanguage, fromTranslation.job.input.translationVersion),
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
    assert.equal(output.schemaVersion, 19);
    assert.equal(output.firstCreated, true);
    assert.equal(output.duplicateCreated, false);
    assert.equal(output.sameJob, true);
    assert.equal(output.firstVersion, 1);
    assert.equal(output.secondVersion, 2);
    assert.equal(output.firstClaim, true);
    assert.equal(output.duplicateClaim, false);
    assert.equal(output.freshRecovery, false);
    assert.equal(output.staleRecovery, true);
    assert.equal(output.queuedRecoveryListed, true);
    assert.equal(output.notificationOne, output.notificationTwo);
    assert.equal(output.notificationCount, 1);
    assert.equal(output.notificationMetadata.i18n.es.title, "La traducción está lista");
    assert.equal(output.persisted.translatedFromProjectId, "scr_a17a17a17a17a17a17a");
    assert.equal(output.persisted.targetLanguage, "English");
    assert.equal(output.persisted.translationVersion, 1);
    assert.equal(output.persisted.translationJobId, output.firstJobId);
    assert.equal(output.inheritedAccess, true);
    assert.equal(output.collaboratorRole, "editor");
    assert.equal(output.collaboratorCanList, true);
    assert.equal(output.fromTranslationVersion, 3);
    assert.equal(output.fromTranslationTitle, "Nila — English Version 03");
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("a restart never renumbers durable modern translation jobs", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-translation-restart-"));
  const env = { ...process.env, FILMSCRIPT_DATA_DIR: dataDir, FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE", FILMSCRIPT_PREVIEW_MODE: "false" };
  const create = `
    const database = await import("./database.js");
    const session = database.createSession();
    const owner = database.connectGoogleIdentity(session.session.id, { sub: "restart-owner", email: "restart@example.test", name: "Owner", email_verified: true });
    const sourceId = "scr_c37c37c37c37c37c37c3"; const now = new Date().toISOString();
    database.saveScriptsSnapshot({ scripts: { [sourceId]: { id: sourceId, userId: owner.id, title: "Root", text: "Hello", blocks: [], createdAt: now, updatedAt: now } } });
    const platform = await import("./platform-database.js");
    const base = { projectId: sourceId, requestedByUserId: owner.id, sourceScriptId: sourceId, sourceScriptVersionId: now, sourceContentHash: "hash", internalPrimaryModel: "test", reservedCredits: 1, targetLanguage: "English", translationFamilyId: sourceId, input: { sourceProjectTitle: "Root" }, outputSchemaVersion: 1 };
    const first = platform.createTranslationAIJob({ ...base, idempotencyKey: "restart-request-one" });
    const second = platform.createTranslationAIJob({ ...base, idempotencyKey: "restart-request-two" });
    platform.updateAIJob(first.job.id, { status: "failed", stage: "failed", errorCode: "test" });
    console.log(JSON.stringify({ secondId: second.job.id, version: second.job.input.translationVersion }));
  `;
  try {
    const firstRun = spawnSync(process.execPath, ["--input-type=module", "--eval", create], { cwd: ROOT, encoding: "utf8", env });
    assert.equal(firstRun.status, 0, firstRun.stderr || firstRun.stdout);
    const before = JSON.parse(firstRun.stdout.trim().split("\n").at(-1));
    assert.equal(before.version, 2);
    const inspect = `
      const database = await import("./database.js");
      const platform = await import("./platform-database.js");
      const owner = database.loadScriptsSnapshot().scripts["scr_c37c37c37c37c37c37c3"].userId;
      const job = platform.getAIJob(${JSON.stringify(before.secondId)}, owner, true);
      console.log(JSON.stringify({ schemaVersion: database.databaseHealth().schemaVersion, columnVersion: job.input.translationVersion }));
    `;
    const secondRun = spawnSync(process.execPath, ["--input-type=module", "--eval", inspect], { cwd: ROOT, encoding: "utf8", env });
    assert.equal(secondRun.status, 0, secondRun.stderr || secondRun.stdout);
    const after = JSON.parse(secondRun.stdout.trim().split("\n").at(-1));
    assert.equal(after.schemaVersion, 19);
    assert.equal(after.columnVersion, 2);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test("migration 019 deterministically backfills multiple legacy translations before adding unique indexes", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-translation-migration-"));
  const databasePath = path.join(dataDir, "legacy.sqlite");
  const db = new Database(databasePath);
  try {
    db.exec(`
      CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO schema_meta VALUES ('schema_version','18');
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE scripts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, source TEXT);
      CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT, type TEXT, title TEXT, message TEXT, actor_user_id TEXT, deep_link TEXT, contains_financial_data INTEGER DEFAULT 0, financial_department_id TEXT, aggregation_key TEXT, read_at TEXT, metadata_json TEXT DEFAULT '{}', created_at TEXT, updated_at TEXT);
      CREATE TABLE ai_jobs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, requested_by_user_id TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, progress INTEGER DEFAULT 0, stage TEXT, source_script_id TEXT NOT NULL, source_script_version_id TEXT, source_content_hash TEXT, internal_primary_model TEXT, internal_completed_model TEXT, used_fallback INTEGER DEFAULT 0, reserved_credits INTEGER DEFAULT 0, settled_credits INTEGER DEFAULT 0, idempotency_key TEXT NOT NULL UNIQUE, input_json TEXT DEFAULT '{}', output_json TEXT, output_schema_version INTEGER DEFAULT 1, error_code TEXT, created_at TEXT, started_at TEXT, completed_at TEXT, updated_at TEXT);
    `);
    db.prepare("INSERT INTO users VALUES (?)").run("usr_owner");
    for (const row of [["scr_source", "Original", "new"], ["scr_one", "Old English A", "translation"], ["scr_two", "Old English B", "translation"]]) {
      db.prepare("INSERT INTO scripts (id,user_id,title,source) VALUES (?,'usr_owner',?,?)").run(...row);
    }
    const insertJob = db.prepare(`INSERT INTO ai_jobs (id,project_id,requested_by_user_id,type,status,stage,source_script_id,source_script_version_id,source_content_hash,internal_primary_model,idempotency_key,input_json,output_json,created_at,completed_at,updated_at)
      VALUES (?,'scr_source','usr_owner','translation','completed','completed','scr_source','v1','hash','model',?,?,?,?,?,?)`);
    insertJob.run("job_one", "key_one", JSON.stringify({ targetLanguage: "English" }), JSON.stringify({ scriptId: "scr_one" }), "2026-01-01T00:00:00.000Z", "2026-01-01T00:01:00.000Z", "2026-01-01T00:01:00.000Z");
    insertJob.run("job_two", "key_two", JSON.stringify({ targetLanguage: "English" }), JSON.stringify({ scriptId: "scr_two" }), "2026-01-02T00:00:00.000Z", "2026-01-02T00:01:00.000Z", "2026-01-02T00:01:00.000Z");
    const sql = fs.readFileSync(path.join(ROOT, "migrations", "019_translation_lineage.sql"), "utf8");
    for (const statement of sql.split(/;\s*(?:\n|$)/).map((entry) => entry.trim()).filter(Boolean)) db.exec(`${statement};`);
    const versions = db.prepare("SELECT id,translation_version FROM scripts WHERE source='translation' ORDER BY translation_version").all();
    assert.deepEqual(versions, [{ id: "scr_one", translation_version: 1 }, { id: "scr_two", translation_version: 2 }]);
    assert.equal(db.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value, "19");
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='scripts_translation_version_idx'").get());
  } finally {
    db.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
