import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const server = read('server.js');
const client = read('lumiere-client.js');
const editor = read('Editor v5.dc.html');
const app = read('App.dc.html');
const analysisClient = read('analysis-client.js');

test('each completed Lumiere request reserves, settles, and can safely replay exactly one use', () => {
  const implementation = server.slice(server.indexOf('async function handleLumiere(req, res)'), server.indexOf('const collaborationRooms'));
  assert.match(implementation, /const reservationId = `lumiere:\$\{requestKey\}`/);
  assert.match(implementation, /const previousReply = textCreditReceipt/);
  assert.match(implementation, /const reservation = reserveTextCredits\(sid, 1, reservationId\)/);
  assert.match(implementation, /settled = settleTextCredits\(sid, reservationId/);
  assert.match(implementation, /if \(!settled\) releaseTextCredits\(sid, reservationId\)/);
  assert.match(implementation, /requiredCredits: 1/);
  assert.match(implementation, /serverValidated: true/);
  assert.match(implementation, /Your Creator Lumiere prompt allowance is used/);
  assert.match(implementation, /Your Full Lumiere prompt allowance is used/);
});

test('the browser assigns every deliberate Lumiere action an idempotency key and updates its credit state', () => {
  assert.match(client, /const requestId = idempotencyKey\(\)/);
  assert.match(client, /"Idempotency-Key": requestId/);
  assert.match(client, /idempotencyKey: requestId/);
  assert.match(client, /filmscript:credits-updated/);
  assert.match(client, /error\.serverValidated = data\.serverValidated === true/);
  assert.match(client, /lumiere_credits_exhausted/);
});

test('Title Room and other text tools use the same credit gate without silently spending a second use', () => {
  for (const entry of ['openFormatCheck()', 'openTitleRoom()', 'openCharacterNameRoom()', 'moreCharacterNames(characterId)']) {
    const start = editor.indexOf(entry);
    assert.ok(start >= 0, `${entry} is present`);
    const segment = editor.slice(start, start + 1800);
    assert.match(segment, /_requireLumiereChat\(/, `${entry} uses the shared text-use gate`);
  }
  const scheduleStart = editor.indexOf('\n  _scheduleTitleRoomSync() {');
  const schedule = editor.slice(scheduleStart, editor.indexOf('\n  // ---------- Character Name Generator ----------', scheduleStart));
  assert.match(schedule, /titleRoomOutdated: true/);
  assert.doesNotMatch(schedule, /this\.analyzeTitleRoom\(/);
  const titleOpen = editor.slice(editor.indexOf('openTitleRoom()'), editor.indexOf('closeTitleRoom()', editor.indexOf('openTitleRoom()')));
  assert.match(titleOpen, /autoRegenerate: false/);
});

test('all validated plan and credit denials reach the shared access surface instead of a fake AI reply', () => {
  assert.match(app, /if \(detail\.serverValidated === true\) return/);
  assert.match(app, /_presentLumiereAccess\(/);
  assert.match(analysisClient, /filmscript:upgrade-required/);
  assert.match(analysisClient, /data\.serverValidated === true/);
  const sendMessage = editor.slice(editor.indexOf('async sendMessage('), editor.indexOf('runTool(label)', editor.indexOf('async sendMessage(')));
  assert.match(sendMessage, /serverValidated/);
});
