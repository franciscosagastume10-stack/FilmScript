import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guardSource = fs.readFileSync(path.join(root, 'scripts-access-guard.js'), 'utf8');

function runGuard({ account = null, ok = true, failure = null } = {}) {
  const redirects = [];
  const requests = [];
  const handlers = {};
  const attributes = new Set(['data-filmscript-auth-pending']);
  const window = {
    location: {
      href: 'http://localhost:4173/App.dc.html',
      replace: (value) => redirects.push(value),
    },
    filmscriptApiUrl: (value) => value,
    addEventListener: (name, handler) => { handlers[name] = handler; },
  };
  const document = {
    documentElement: {
      setAttribute: (name) => attributes.add(name),
      removeAttribute: (name) => attributes.delete(name),
    },
  };
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (failure) throw failure;
    return { ok, json: async () => account };
  };
  vm.runInNewContext(guardSource, { window, document, fetch, URL });
  return { window, redirects, requests, handlers, attributes };
}

test('Scripts becomes visible only for an authenticated Google account', async () => {
  const result = runGuard({ account: { authenticated: true, provider: 'google', email: 'writer@example.com' } });
  assert.equal(await result.window.filmscriptScriptsAccess.ready, true);
  assert.deepEqual(result.redirects, []);
  assert.equal(result.attributes.has('data-filmscript-auth-pending'), false);
  assert.equal(result.requests[0].url, '/api/me');
  assert.equal(result.requests[0].options.credentials, 'include');
});

test('an anonymous visitor is redirected to the Features landing page', async () => {
  const result = runGuard({ account: { authenticated: false, provider: null, email: null } });
  assert.equal(await result.window.filmscriptScriptsAccess.ready, false);
  assert.deepEqual(result.redirects, ['http://localhost:4173/Features.dc.html']);
  assert.equal(result.attributes.has('data-filmscript-auth-pending'), true);
});

test('Scripts fails closed when account verification is unavailable', async () => {
  const result = runGuard({ failure: new Error('offline') });
  assert.equal(await result.window.filmscriptScriptsAccess.ready, false);
  assert.deepEqual(result.redirects, ['http://localhost:4173/Features.dc.html']);
});

test('an expired session redirects as soon as an API requests authentication', async () => {
  const result = runGuard({ account: { authenticated: true, provider: 'google', email: 'writer@example.com' } });
  assert.equal(await result.window.filmscriptScriptsAccess.ready, true);
  result.handlers['filmscript:auth-required']();
  assert.deepEqual(result.redirects, ['http://localhost:4173/Features.dc.html']);
});
