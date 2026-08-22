import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('screenplay module APIs use the neutral first-party route', async () => {
  const [runtime, vercel] = await Promise.all([
    fs.readFile(path.join(ROOT, 'runtime-config.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'vercel.json'), 'utf8').then(JSON.parse),
  ]);

  assert.match(runtime, /film-data\/document/);
  assert.doesNotMatch(runtime, /return `\$\{apiUrl\}\/workspace\/projects/);

  const exact = vercel.rewrites.find((entry) => entry.source === '/film-data/document');
  const nested = vercel.rewrites.find((entry) => entry.source === '/film-data/document/:path*');
  assert.equal(exact?.destination, '/api/scripts-proxy');
  assert.equal(nested?.destination, '/api/scripts-proxy?path=:path*');
});

test('project invitations use a neutral first-party route', async () => {
  const [runtime, vercel] = await Promise.all([
    fs.readFile(path.join(ROOT, 'runtime-config.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'vercel.json'), 'utf8').then(JSON.parse),
  ]);

  assert.match(runtime, /film-data\/access-list/);

  const exact = vercel.rewrites.find((entry) => entry.source === '/film-data/access-list');
  const nested = vercel.rewrites.find((entry) => entry.source === '/film-data/access-list/:path*');
  assert.deepEqual(exact, {
    source: '/film-data/access-list',
    destination: '/api/access-proxy',
  });
  assert.deepEqual(nested, {
    source: '/film-data/access-list/:path*',
    destination: '/api/access-proxy?path=:path*',
  });
  const proxy = await fs.readFile(path.join(ROOT, 'api', 'access-proxy.js'), 'utf8');
  assert.match(proxy, /https:\/\/api\.filmscript\.app\/api\/invitations/);
  assert.match(proxy, /Cookie: String\(req\.headers\?\.cookie/);
  assert.match(proxy, /headers\.Origin = String\(req\.headers\.origin\)/);
  assert.match(proxy, /ALLOWED_METHODS = new Set\(\["GET", "HEAD", "POST"\]\)/);
  assert.equal(
    vercel.rewrites.some((entry) => entry.source === '/api/:path((?!auth-complete|scripts-proxy|access-proxy).*)'),
    true,
  );
});

test('project collaboration APIs retain their project namespace at the Vercel edge', async () => {
  const vercel = JSON.parse(await fs.readFile(path.join(ROOT, 'vercel.json'), 'utf8'));
  const projectRoute = vercel.rewrites.find((entry) => entry.source === '/workspace/projects/:path*');

  assert.deepEqual(projectRoute, {
    source: '/workspace/projects/:path*',
    destination: 'https://api.filmscript.app/api/projects/:path*',
  });
});

test('Breakdown split view binds iframe readiness without an inline load handler', async () => {
  const editor = await fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8');

  assert.match(editor, /ref="\{\{ bindBreakdownScriptFrame \}\}"/);
  assert.match(editor, /bindBreakdownScriptFrame = \(el\) =>/);
  assert.match(editor, /addEventListener\('load'/);
  assert.match(editor, /removeEventListener\('load', this\._onBreakdownScriptFrameLoad\)/);
  assert.doesNotMatch(editor, /onLoad="\{\{ breakdownScriptLoaded \}\}"/);

  const stripboardBinding = editor.slice(
    editor.indexOf('bindStripboardBoard = (el) =>'),
    editor.indexOf('_startStripboardDrag(event)'),
  );
  const unmount = editor.slice(
    editor.indexOf('componentWillUnmount()'),
    editor.indexOf('_hexA(hex, a)'),
  );
  assert.doesNotMatch(stripboardBinding, /_breakdownScriptFrame\.removeEventListener/);
  assert.match(unmount, /_breakdownScriptFrame\.removeEventListener\('load', this\._onBreakdownScriptFrameLoad\)/);
});

test('Canvas and Imagine use the same neutral screenplay API resolver', async () => {
  const [client, editor] = await Promise.all([
    fs.readFile(path.join(ROOT, 'canvas-client.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8'),
  ]);

  assert.match(client, /window\.filmscriptApiUrl \? window\.filmscriptApiUrl\(path\) : path/);
  assert.doesNotMatch(client, /FILMSCRIPT_CONFIG\?\.apiUrl/);
  assert.match(editor, /canvas-client\.js\?v=20260821-imagine-gallery1/);
});

test('Breakdown, Stripboard, Shot List, Budget, and Calendar use the active screenplay API', async () => {
  const [preproduction, budget, calendar, editor] = await Promise.all([
    fs.readFile(path.join(ROOT, 'preproduction-client.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'budget-client.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'calendar-client.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8'),
  ]);

  for (const client of [preproduction, budget, calendar]) {
    assert.match(client, /\/api\/scripts\/\$\{encodeURIComponent\(scriptId\)\}/);
    assert.doesNotMatch(client, /\/api\/project-files/);
  }
  assert.match(editor, /preproduction-client\.js\?v=20260820-module-routes3/);
  assert.match(editor, /budget-client\.js\?v=20260820-module-routes3/);
  assert.match(editor, /calendar-client\.js\?v=20260820-module-routes3/);
});

test('production stack preserves the shared OAuth session cookie domain', async () => {
  const stack = await fs.readFile(path.join(ROOT, 'aws', 'filmscript-backend.yml'), 'utf8');

  assert.match(stack, /SessionCookieDomain:\n\s+Type: String/);
  assert.match(stack, /Name: SESSION_COOKIE_DOMAIN\n\s+Value: !Ref SessionCookieDomain/);
});

test('primary production pages request the cache-busted route resolver', async () => {
  const pages = await Promise.all([
    'App.dc.html',
    'Editor v5.dc.html',
    'Features.dc.html',
    'Pricing.dc.html',
    'Subscription.dc.html',
  ].map((name) => fs.readFile(path.join(ROOT, name), 'utf8')));

  for (const page of pages) {
    assert.match(page, /runtime-config\.js\?v=20260821-invitation-route2/);
  }
});
