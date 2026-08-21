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
  assert.equal(nested?.destination, 'https://api.filmscript.app/api/scripts/:path*');
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
  assert.match(editor, /canvas-client\.js\?v=20260820-module-routes2/);
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
    assert.match(page, /runtime-config\.js\?v=20260820-module-routes2/);
  }
});
