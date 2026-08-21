import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('standalone Imaging has an account-only, project-free shell', () => {
  const page = read('Imaging.dc.html');
  const header = page.slice(page.indexOf('<header class="v5-topbar">'), page.indexOf('</header>') + 9);

  assert.match(page, /<film-script-canvas scope="account" initial-view="imagine" aria-label="Imaging"><\/film-script-canvas>/);
  assert.doesNotMatch(page, /script-id=/);
  assert.doesNotMatch(page, /[?&]script=/);
  assert.match(header, /<nav class="imaging-only-nav"[^>]*><span aria-current="page">Imaging<\/span><\/nav>/);
  assert.doesNotMatch(header, />\s*(?:Scripts|Guiones|Editor|Analysis|Análisis|Breakdown|Desglose|Canvas|Boards|Vault)\s*</);
  assert.match(page, /scripts-access-guard\.js\?v=/);
  assert.match(page, /platform-client\.js\?v=/);
  assert.match(page, /canvas-client\.js\?v=20260821-account-imaging1/);
  assert.match(page, /canvas-workspace\.js\?v=20260821-account-imaging1/);
});

test('standalone Imaging preserves accessible navigation, localization, and mobile targets', () => {
  const page = read('Imaging.dc.html');

  assert.match(page, /<a class="imaging-skip" href="#imaging-workspace">/);
  assert.match(page, /<main class="imaging-main" id="imaging-workspace">/);
  assert.match(page, /<nav class="imaging-only-nav" aria-label="Imaging workspace">/);
  assert.match(page, /button class="imaging-chrome-button" type="button"[^>]*aria-label=/);
  assert.match(page, /button type="button" data-testid="account-avatar" aria-label=/);
  assert.match(page, /Cambiar tema/);
  assert.match(page, /Abrir cuenta/);
  assert.match(page, /Ir a Imaging/);
  assert.match(page, /width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important/);
  assert.match(page, /\.fs-mobile-global\{display:none!important\}/);
  assert.match(page, /prefers-reduced-transparency:reduce/);
  assert.match(page, /prefers-reduced-motion:reduce/);
});

test('account Imaging client uses account endpoints without a synthetic screenplay', () => {
  const client = read('canvas-client.js');
  const accountApi = client.slice(client.indexOf('window.filmscriptCanvas = {'), client.indexOf('get: async (scriptId)'));

  assert.match(client, /const accountImagingPath = \(suffix = ''\) => `\/api\/me\/imaging\$\{suffix\}`/);
  assert.match(accountApi, /getAccountImaging: \(\) => request\(accountImagingPath\(\)\)/);
  assert.match(accountApi, /generateAccountImagingImage/);
  assert.match(accountApi, /uploadAccountImagingAsset/);
  assert.match(accountApi, /accountImagingAssetUrl/);
  assert.doesNotMatch(accountApi, /scriptId|sentinel|standalone_/);
});

test('account scope locks the workspace to Imaging and hides project affordances', () => {
  const workspace = read('canvas-workspace.js');

  assert.match(workspace, /get accountScoped\(\) \{ return this\.getAttribute\('scope'\) === 'account'; \}/);
  assert.match(workspace, /\['imagine', 'account_imaging', 'standalone_imaging'\]/);
  assert.match(workspace, /if \(!this\.accountScoped && !this\.scriptId\)/);
  assert.match(workspace, /this\.accountScoped\s*\? window\.filmscriptCanvas\.getAccountImaging\(\)/);
  assert.match(workspace, /if \(this\._isImagineOnlyWorkspace\(\) && view !== 'imagine'\) view = 'imagine'/);
  assert.match(workspace, /:host\(\[scope="account"\]\) \.cv-imagine-tile:after\{display:none\}/);
  assert.match(workspace, /Every image you create will stay in your personal gallery\./);
  assert.match(workspace, /Cada imagen que crees quedará en tu galería personal\./);
  assert.match(workspace, /Loading your Imaging gallery/);
  assert.match(workspace, /Cargando tu galería de Imaging/);
  assert.match(workspace, /Describe la imagen que quieres crear…/);
  assert.match(workspace, /Relación de aspecto/);
  assert.match(workspace, /Suelta para agregar como referencia/);
  assert.match(workspace, /imagineStyleLabel\(value\)/);
  assert.match(workspace, /imagineQualityLabel\(value\)/);
  assert.match(workspace, /filmscript_imaging_jobs_account_\$\{ownerUserId\}/);
  assert.match(workspace, /String\(job\?\.ownerUserId \|\| ''\) === ownerUserId/);
  assert.match(workspace, /ownerUserId: this\.accountScoped \? this\._imagineJobsOwnerId\(\) : ''/);
  assert.doesNotMatch(workspace, /_imagineJobsStorageKey\(\) \{ return this\.accountScoped \? 'filmscript_imaging_jobs_account'/);
});

test('neutral Imaging route resolves first-party and is rewritten at the edge', () => {
  const runtime = read('runtime-config.js');
  const sandbox = {
    window: {
      FILMSCRIPT_CONFIG: {},
      location: { protocol: 'https:', hostname: 'filmscript.app' },
    },
  };
  vm.runInNewContext(runtime, sandbox);

  assert.equal(sandbox.window.filmscriptApiUrl('/api/me/imaging'), '/visual-library');
  assert.equal(sandbox.window.filmscriptApiUrl('/api/me/imaging/assets/asset%201'), '/visual-library/assets/asset%201');

  const vercel = JSON.parse(read('vercel.json'));
  assert.deepEqual(vercel.rewrites.find(({ source }) => source === '/visual-library'), {
    source: '/visual-library',
    destination: 'https://api.filmscript.app/api/me/imaging',
  });
  assert.deepEqual(vercel.rewrites.find(({ source }) => source === '/visual-library/:path*'), {
    source: '/visual-library/:path*',
    destination: 'https://api.filmscript.app/api/me/imaging/:path*',
  });
});

test('production frontend build includes standalone Imaging as a required output', () => {
  const build = read('scripts/build-netlify.mjs');
  const server = read('server.js');

  assert.match(build, /const frontendFiles = \[[\s\S]*"Imaging\.dc\.html"/);
  assert.match(build, /for \(const required of \[[^\]]*"Imaging\.dc\.html"/);
  assert.match(server, /PUBLIC_STATIC_FILES = new Set\(\[[\s\S]*"Imaging\.dc\.html"/);
});
