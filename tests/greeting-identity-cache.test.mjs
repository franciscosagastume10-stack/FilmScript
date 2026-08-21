import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (file) => fs.readFile(path.join(ROOT, file), 'utf8');

test('the OAuth greeting handoff is account-bound, short-lived and consumed once', async () => {
  const [handoff, app, server] = await Promise.all([
    read('auth-complete.html'),
    read('App.dc.html'),
    read('server.js'),
  ]);

  assert.match(server, /userId:\s*user\?\.id \|\| null[\s\S]*firstName:\s*user\?\.firstName \|\| null/);
  assert.match(handoff, /const userId = String\(data\.userId \|\| ''\)\.trim\(\)/);
  assert.match(handoff, /sessionStorage\.setItem\('filmscript_auth_handoff_identity_v1', JSON\.stringify\(\{[\s\S]*userId,[\s\S]*firstName,[\s\S]*issuedAt: Date\.now\(\)/);
  assert.doesNotMatch(handoff, /localStorage\.setItem\('filmscript_account_first_name'/);

  assert.match(app, /sessionStorage\.removeItem\('filmscript_auth_handoff_identity_v1'\)/);
  assert.match(app, /Date\.now\(\) - issuedAt > 2 \* 60 \* 1000/);
  assert.match(app, /this\._handoffIdentity = \{ userId, firstName \}/);
});

test('anonymous, failed and signed-out sessions clear every greeting identity', async () => {
  const [app, billing, handoff, onboarding, platform] = await Promise.all([
    read('App.dc.html'),
    read('billing-client.js'),
    read('auth-complete.html'),
    read('profile-onboarding.js'),
    read('platform-client.js'),
  ]);

  assert.match(app, /scriptsAccessGranted === false[\s\S]*this\._clearGreetingIdentity\(\)/);
  assert.match(app, /catch \(e\) \{[\s\S]*this\._clearGreetingIdentity\(\)[\s\S]*this\.setState\(\{ user: null/);
  assert.match(app, /requiresLogin[\s\S]*this\._clearGreetingIdentity\(\)/);
  assert.match(billing, /finally \{[\s\S]*sessionStorage\.removeItem\('filmscript_auth_handoff_identity_v1'\)/);
  assert.match(handoff, /const fail = \(\) => \{[\s\S]*sessionStorage\.removeItem\('filmscript_auth_handoff_identity_v1'\)/);

  for (const source of [onboarding, platform]) {
    assert.doesNotMatch(source, /localStorage\.setItem\('filmscript_account_first_name'/);
  }
});

test('legacy global first-name data is deleted without ever being read', async () => {
  const app = await read('App.dc.html');
  assert.match(app, /localStorage\.removeItem\('filmscript_account_first_name'\)/);
  assert.doesNotMatch(app, /localStorage\.getItem\('filmscript_account_first_name'\)/);
});
