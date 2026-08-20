import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeConfig = fs.readFileSync(path.join(root, 'runtime-config.js'), 'utf8');
const billingClient = fs.readFileSync(path.join(root, 'billing-client.js'), 'utf8');
const featuresPage = fs.readFileSync(path.join(root, 'Features.dc.html'), 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const vercelIgnore = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8');

function runBillingClient(pathname, search = '') {
  const redirects = [];
  const history = [];
  const href = `http://localhost:4173${pathname}${search}`;
  const window = {
    location: {
      pathname,
      search,
      href,
      replace: (value) => redirects.push(value),
    },
    history: {
      replaceState: (_state, _title, value) => history.push(value),
    },
    dispatchEvent: () => {},
  };
  vm.runInNewContext(billingClient, {
    window,
    URL,
    URLSearchParams,
    CustomEvent: class CustomEvent {},
    fetch: async () => { throw new Error('Unexpected fetch'); },
  });
  return { window, redirects, history };
}

test('Google login defaults to the Scripts page', () => {
  const { window } = runBillingClient('/Features.dc.html');
  assert.equal(window.filmscriptBilling.googleSignInUrl(), '/auth/google?returnTo=%2FApp.dc.html');
});

test('Google login never resolves to file:/// when FilmScript is opened directly', () => {
  const window = {
    location: {
      protocol: 'file:',
      pathname: '/Users/writer/FilmScript/Features.dc.html',
      search: '',
      href: 'file:///Users/writer/FilmScript/Features.dc.html',
    },
    history: { replaceState: () => {} },
    dispatchEvent: () => {},
  };
  const context = {
    window,
    URL,
    URLSearchParams,
    CustomEvent: class CustomEvent {},
    fetch: async () => { throw new Error('Unexpected fetch'); },
  };
  vm.runInNewContext(runtimeConfig, context);
  vm.runInNewContext(billingClient, context);
  assert.equal(
    window.filmscriptBilling.googleSignInUrl(),
    'http://localhost:4173/auth/google?returnTo=%2FApp.dc.html',
  );
});

test('a successful login on a marketing page redirects to Scripts', () => {
  const { redirects } = runBillingClient('/Features.dc.html', '?signin=success');
  assert.deepEqual(redirects, ['http://localhost:4173/App.dc.html']);
});

test('the Scripts page removes the temporary sign-in query', () => {
  const { window, history } = runBillingClient('/App.dc.html', '?signin=success');
  assert.ok(window.filmscriptBilling);
  assert.deepEqual(history, ['/App.dc.html']);
});

test('the Features landing opens one clean Google authentication panel', () => {
  assert.match(featuresPage, /data-testid="landing-login-top"[^>]*>Log in<\/button>/);
  assert.match(featuresPage, /landingPrimaryLabel: this\.state\.user \? 'Open Scripts' : 'Sign up free'/);
  assert.match(featuresPage, /data-testid="google-login"[^>]+onClick="\{\{ googleLogIn \}\}"/);
  assert.match(featuresPage, /Log in with your Google account/);
  assert.equal(featuresPage.includes('<div class="fs-auth-brand">FilmScript</div>'), false);
  assert.equal(featuresPage.includes('<div class="fs-auth-eyebrow">Your writing workspace</div>'), false);
  assert.equal(featuresPage.includes('Create your account'), false);
});

test('Vercel completes the Google handoff through a same-origin cookie proxy', async (t) => {
  assert.equal(vercelConfig.rewrites[0].source, '/api/:path((?!auth-complete).*)');
  assert.match(vercelIgnore, /^api\/\*$/m);
  assert.match(vercelIgnore, /^!api\/auth-complete\.js$/m);
  assert.doesNotMatch(vercelIgnore, /^api$/m);
  assert.match(fs.readFileSync(path.join(root, 'auth-complete.html'), 'utf8'),
    /fetch\(`\/api\/auth-complete\?handoff=/);

  const originalFetch = globalThis.fetch;
  const sid = 'filmscript_sid=authenticated; Path=/; HttpOnly; SameSite=Lax';
  const shared = 'filmscript_shared_sid=authenticated; Domain=.filmscript.app; Path=/; HttpOnly; SameSite=Lax';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.filmscript.app/api/auth/complete?handoff=abcdefghijklmnopqrstuvwx');
    assert.equal(options.redirect, 'manual');
    return {
      status: 200,
      headers: {
        get: (name) => name === 'content-type' ? 'application/json; charset=utf-8' : null,
        getSetCookie: () => [sid, shared],
      },
      arrayBuffer: async () => Buffer.from('{"ok":true}'),
    };
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const headers = new Map();
  let body = null;
  const req = {
    method: 'GET',
    url: '/api/auth/complete?handoff=abcdefghijklmnopqrstuvwx',
    headers: { 'user-agent': 'FilmScript test' },
  };
  const res = {
    statusCode: 0,
    setHeader: (name, value) => headers.set(name.toLowerCase(), value),
    end: (value) => { body = value; },
  };
  const { default: authComplete } = await import(`../api/auth-complete.js?test=${Date.now()}`);
  await authComplete(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(headers.get('set-cookie'), [sid, shared]);
  assert.equal(Buffer.from(body).toString(), '{"ok":true}');
});
