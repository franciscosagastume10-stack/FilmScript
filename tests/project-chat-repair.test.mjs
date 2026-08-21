import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFile = promisify(execFileCallback);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmscript-project-chat-'));
process.env.FILMSCRIPT_DB_PATH = path.join(dataDir, 'project-chat.sqlite');

const platform = await import(`../platform-database.js?project-chat=${Date.now()}`);
const db = platform.__platformDb;
const timestamp = new Date().toISOString();

function addUser(id, email, name) {
  db.prepare(`INSERT INTO users (id,google_sub,email,name,email_verified,username,created_at,updated_at)
    VALUES (?,?,?,?,1,?,?,?)`).run(id, `google_${id}`, email, name, id.slice(4), timestamp, timestamp);
}

addUser('usr_chat_owner', 'owner@example.com', 'Owner');
addUser('usr_chat_peer', 'peer@example.com', 'Peer');
addUser('usr_chat_editor', 'editor@example.com', 'Editor');
addUser('usr_chat_commenter', 'commenter@example.com', 'Commenter');
addUser('usr_chat_hidden', 'hidden@example.com', 'Hidden');
db.prepare(`INSERT INTO scripts (id,user_id,title,blocks_json,chat_json,title_room_json,character_names_json,created_at,updated_at)
  VALUES ('scr_chat','usr_chat_owner','Project chat','[]','[]','{}','{}',?,?)`).run(timestamp, timestamp);
platform.backfillOwners();

const peerInvite = platform.createInvitation('scr_chat', 'usr_chat_owner', {
  email: 'peer@example.com', projectRole: 'viewer', modulePermissions: { script: 'view' },
});
platform.acceptInvitation(peerInvite.token, 'usr_chat_peer');
const editorInvite = platform.createInvitation('scr_chat', 'usr_chat_owner', {
  email: 'editor@example.com', projectRole: 'editor', modulePermissions: { script: 'edit' },
});
platform.acceptInvitation(editorInvite.token, 'usr_chat_editor');
const commenterInvite = platform.createInvitation('scr_chat', 'usr_chat_owner', {
  email: 'commenter@example.com', projectRole: 'commenter', modulePermissions: { script: 'comment' },
});
platform.acceptInvitation(commenterInvite.token, 'usr_chat_commenter');
const hiddenInvite = platform.createInvitation('scr_chat', 'usr_chat_owner', {
  email: 'hidden@example.com', projectRole: 'viewer', modulePermissions: { script: 'no_access' },
});
platform.acceptInvitation(hiddenInvite.token, 'usr_chat_hidden');

after(() => { db.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('chat peers are available to screenplay viewers without exposing membership or finance data', () => {
  const peers = platform.listProjectMessagePeers('scr_chat', 'usr_chat_owner');
  assert.deepEqual(peers.map((peer) => peer.userId), ['usr_chat_commenter', 'usr_chat_editor', 'usr_chat_peer']);
  assert.deepEqual(Object.keys(peers[0]).sort(), ['avatarBackground', 'avatarPreset', 'email', 'name', 'picture', 'userId']);
  assert.throws(() => platform.listProjectMessagePeers('scr_chat', 'usr_chat_hidden'), /permission/i);
});

test('editors and commenters can use peers without members:view access', () => {
  const editorPeers = platform.listProjectMessagePeers('scr_chat', 'usr_chat_editor');
  const commenterPeers = platform.listProjectMessagePeers('scr_chat', 'usr_chat_commenter');
  assert.deepEqual(editorPeers.map((peer) => peer.userId), ['usr_chat_commenter', 'usr_chat_owner', 'usr_chat_peer']);
  assert.deepEqual(commenterPeers.map((peer) => peer.userId), ['usr_chat_editor', 'usr_chat_owner', 'usr_chat_peer']);

  const message = platform.createProjectMessage('scr_chat', 'usr_chat_commenter', {
    recipientId: 'usr_chat_editor', body: 'Can you review the scene?',
  });
  assert.equal(message.senderId, 'usr_chat_commenter');
  assert.equal(platform.listProjectMessages('scr_chat', 'usr_chat_editor', 'usr_chat_commenter').length, 1);
});

test('private chat rejects screenplay-hidden recipients and uses an editor deep link', () => {
  const message = platform.createProjectMessage('scr_chat', 'usr_chat_owner', { recipientId: 'usr_chat_peer', body: 'Private production note.' });
  assert.equal(message.recipientId, 'usr_chat_peer');
  assert.equal(platform.listProjectMessages('scr_chat', 'usr_chat_peer', 'usr_chat_owner').length, 1);
  assert.throws(() => platform.createProjectMessage('scr_chat', 'usr_chat_owner', { recipientId: 'usr_chat_hidden', body: 'Do not send.' }), /not available/i);
  const notification = platform.listNotifications('usr_chat_peer').find((item) => item.type === 'message');
  assert.match(notification.deepLink, /view=editor/);
  assert.match(notification.deepLink, /chat=usr_chat_owner/);
});

test('chat uses an idempotent migration after the pre-chat schema and keeps SSE payloads body-free', async () => {
  const [database, migration, server, client] = await Promise.all([
    fsp.readFile(path.join(ROOT, 'platform-database.js'), 'utf8'),
    fsp.readFile(path.join(ROOT, 'migrations/015_project_messages.sql'), 'utf8'),
    fsp.readFile(path.join(ROOT, 'server.js'), 'utf8'),
    fsp.readFile(path.join(ROOT, 'platform-client.js'), 'utf8'),
  ]);
  assert.match(database, /\[15, "015_project_messages\.sql"\]/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS project_messages/);
  assert.match(migration, /schema_version', '15'/);
  assert.match(server, /handleProjectMessagePeers/);
  assert.match(server, /audienceUserIds/);
  const privateMessageBroadcast = server.match(/const messageEvent = \{ id: message\.id, projectId, senderId: message\.senderId, recipientId: message\.recipientId, createdAt: message\.createdAt \};\s*broadcastCollaboration\(projectId, "message\.created", messageEvent, String\(req\.headers\["x-filmscript-client-id"\] \|\| ""\), \[message\.senderId, message\.recipientId\]\);/s)?.[0] || '';
  assert.ok(privateMessageBroadcast, 'message events must target only the sender and recipient');
  assert.doesNotMatch(privateMessageBroadcast, /\bbody\b/, 'message bodies must stay out of SSE payloads');
  assert.match(server, /if \(audience && !audience\.has\(String\(subscriber\.userId \|\| ""\)\)\) continue;/);
  assert.match(server, /subscribers\.set\(identity\.clientId, \{ response: res, access, userId: sid \}\)/);
  assert.match(client, /chatPeers: \(\) => request\(`\/api\/projects\/\$\{projectId\}\/chat\/peers`\)/);
  assert.match(client, /openChatFromDeepLink/);
});

test('a production-shaped schema version 14 database migrates project messages safely', async () => {
  const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmscript-schema14-chat-'));
  const legacyDbPath = path.join(legacyDir, 'legacy.sqlite');
  const seedLegacyDatabase = `
    import fs from 'node:fs';
    import path from 'node:path';
    import Database from 'better-sqlite3';
    await import('./database.js');
    const db = new Database(process.env.FILMSCRIPT_DB_PATH);
    for (const filename of ['010_collaboration_platform.sql', '011_collaboration_access_foundation.sql', '012_realtime_collaboration.sql', '013_activity_comments_notifications.sql', '014_lumiere_ai_infrastructure.sql']) {
      db.exec(fs.readFileSync(path.join('migrations', filename), 'utf8'));
    }
    db.prepare("INSERT OR REPLACE INTO schema_meta(key,value) VALUES('schema_version','14')").run();
    db.close();
  `;
  try {
    const childOptions = { cwd: ROOT, env: { ...process.env, FILMSCRIPT_DB_PATH: legacyDbPath } };
    await execFile(process.execPath, ['--input-type=module', '--eval', seedLegacyDatabase], childOptions);
    let legacy = new Database(legacyDbPath, { readonly: true });
    assert.equal(legacy.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value, '14');
    assert.equal(legacy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_messages'").get(), undefined);
    legacy.close();

    await execFile(process.execPath, ['--input-type=module', '--eval', "await import('./platform-database.js');"], childOptions);
    legacy = new Database(legacyDbPath, { readonly: true });
    assert.ok(legacy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_messages'").get());
    assert.equal(legacy.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value, '18');
    legacy.close();
  } finally {
    fs.rmSync(legacyDir, { recursive: true, force: true });
  }
});
