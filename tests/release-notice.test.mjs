import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'filmscript-release-notice-'));
process.env.FILMSCRIPT_DB_PATH = path.join(dataDirectory, 'release-notice.sqlite');

const platform = await import(`../platform-database.js?release-notice=${Date.now()}`);
const db = platform.__platformDb;
const timestamp = new Date().toISOString();

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}.`);
    try { if ((await fetch(`${url}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error('FilmScript server did not become ready.');
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await exited;
}

db.prepare(`INSERT INTO users (id,google_sub,email,name,email_verified,username,created_at,updated_at)
  VALUES (?,?,?,?,1,?,?,?)`).run(
  'usr_release_owner', 'google_release_owner', 'release@example.com', 'Release owner', 'release_owner', timestamp, timestamp,
);

after(() => {
  db.close();
  fs.rmSync(dataDirectory, { recursive:true, force:true });
});

test('FilmScript 2.0 is claimed once per account across devices and acknowledgement persists', () => {
  // The two calls represent two independently authenticated browsers. The
  // primary key is scoped to the account rather than a browser/session token.
  const firstBrowser = platform.claimReleaseNotice('usr_release_owner', '2.0');
  const secondBrowser = platform.claimReleaseNotice('usr_release_owner', '2.0');

  assert.equal(firstBrowser.shouldPresent, true);
  assert.equal(secondBrowser.shouldPresent, false);
  assert.equal(firstBrowser.acknowledgedAt, null);

  const acknowledgement = platform.acknowledgeReleaseNotice('usr_release_owner', '2.0');
  assert.equal(acknowledgement.releaseVersion, '2.0');
  assert.ok(acknowledgement.presentedAt);
  assert.ok(acknowledgement.acknowledgedAt);
  assert.equal(platform.claimReleaseNotice('usr_release_owner', '2.0').shouldPresent, false);

  // A future product version receives its own single welcome.
  assert.equal(platform.claimReleaseNotice('usr_release_owner', '2.1').shouldPresent, true);
  assert.throws(() => platform.claimReleaseNotice('usr_release_owner', '2.0<script>'), /invalid/i);
});

test('release notice endpoint uses the signed-in account instead of a browser-local acknowledgement', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmscript-release-notice-http-'));
  const databasePath = path.join(dataDir, 'release-notice.sqlite');
  const bootstrap = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { connectGoogleIdentity, createSession } from './database.js';
    const first = createSession();
    connectGoogleIdentity(first.session.id, { sub:'google_release_http_owner', email:'release-http@example.com', name:'Release HTTP owner', email_verified:true });
    const second = createSession();
    connectGoogleIdentity(second.session.id, { sub:'google_release_http_owner', email:'release-http@example.com', name:'Release HTTP owner', email_verified:true });
    console.log(JSON.stringify({ first:first.token, second:second.token }));
  `], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR:dataDir, FILMSCRIPT_DB_PATH:databasePath },
    encoding: 'utf8',
  });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const tokens = JSON.parse(bootstrap.stdout.trim().split('\n').at(-1));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT:String(port), API_URL:url, PUBLIC_APP_URL:url, CORS_ORIGINS:url, FILMSCRIPT_DATA_DIR:dataDir, FILMSCRIPT_DB_PATH:databasePath, OPENAI_API_KEY:'' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => { await stopServer(child); fs.rmSync(dataDir, { recursive:true, force:true }); });
  await waitForServer(url, child);

  const firstCookie = `filmscript_sid=${encodeURIComponent(tokens.first)}`;
  const secondCookie = `filmscript_sid=${encodeURIComponent(tokens.second)}`;
  const first = await fetch(`${url}/api/release-notice`, { headers:{ Cookie:firstCookie } });
  assert.equal(first.status, 200);
  assert.deepEqual((await first.json()).notice, { version:'2.0' });

  const second = await fetch(`${url}/api/release-notice`, { headers:{ Cookie:secondCookie } });
  assert.equal(second.status, 200);
  assert.equal((await second.json()).notice, null);

  const acknowledged = await fetch(`${url}/api/release-notice`, { method:'POST', headers:{ Cookie:firstCookie } });
  assert.equal(acknowledged.status, 200);
  assert.ok((await acknowledged.json()).acknowledgement.acknowledgedAt);
  assert.equal((await fetch(`${url}/api/release-notice`, { headers:{ Cookie:secondCookie } })).status, 200);
  assert.equal((await fetch(`${url}/api/release-notice`)).status, 401);
});

test('release notice is wired after the canonical migration sequence and guarded by the signed-in account', () => {
  const database = fs.readFileSync(path.join(ROOT, 'platform-database.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const migration = fs.readFileSync(path.join(ROOT, 'migrations/016_release_notice.sql'), 'utf8');

  assert.match(database, /\[13, "013_activity_comments_notifications\.sql"\]/);
  assert.match(database, /\[14, "014_lumiere_ai_infrastructure\.sql"\]/);
  assert.match(database, /\[15, "015_project_messages\.sql"\]/);
  assert.match(database, /\[16, "016_release_notice\.sql"\]/);
  assert.match(migration, /release_notice_acknowledgements/);
  assert.match(migration, /PRIMARY KEY \(user_id, release_version\)/);
  assert.match(server, /FILMSCRIPT_RELEASE_NOTICE_VERSION = "2\.0"/);
  assert.match(server, /pathname === "\/api\/release-notice"/);
  assert.match(server, /if \(!sid\) return googleRequired\(res\)/);
});

test('release update UI has bilingual copy, accessible fast dismissal, Liquid Glass, and waits for language selection', () => {
  const client = fs.readFileSync(path.join(ROOT, 'platform-client.js'), 'utf8');
  const styles = fs.readFileSync(path.join(ROOT, 'platform-ui.css'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'App.dc.html'), 'utf8');
  const editor = fs.readFileSync(path.join(ROOT, 'Editor v5.dc.html'), 'utf8');

  assert.match(client, /FilmScript 2\.0 ya está aquí/);
  assert.match(client, /FilmScript 2\.0 is here/);
  assert.match(client, /Vista dividida en Desglose/);
  assert.match(client, /Split view in Breakdown/);
  assert.match(client, /Conversaciones en tu proyecto/);
  assert.match(client, /Conversations in your project/);
  assert.match(client, /needsInitialChoice\?\.\(\)/);
  assert.match(client, /filmscript:initial-language-choice/);
  assert.match(client, /hasReleaseNoticeCollision/);
  assert.match(client, /data-i18n-skip/);
  assert.match(client, /aria-label', copy\.close/);
  assert.match(client, /acknowledgeReleaseNotice/);
  assert.match(styles, /fs-release-notice-dialog/);
  assert.match(styles, /prefers-reduced-transparency:reduce/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  for (const page of [app, editor]) {
    assert.match(page, /platform-client\.js\?v=20260821-(?:personal-name1|mobile-nav1)/);
    assert.match(page, /platform-ui\.css\?v=20260821-(?:invitations1|mobile-nav1)/);
  }
});
