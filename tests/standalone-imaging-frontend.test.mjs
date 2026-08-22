import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const loadCanvasWorkspaceClass = (language = 'en') => {
  const registry = new Map();
  class FakeHTMLElement {
    attachShadow() { this.shadowRoot = {}; return this.shadowRoot; }
    getAttribute() { return ''; }
  }
  const sandbox = {
    HTMLElement: FakeHTMLElement,
    customElements: {
      get: (name) => registry.get(name),
      define: (name, value) => registry.set(name, value),
    },
    window: {
      addEventListener() {},
      removeEventListener() {},
      innerWidth: 1280,
      filmscriptLanguage: { get: () => language },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    },
    document: {},
    console,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(read('canvas-workspace.js'), sandbox);
  return registry.get('film-script-canvas');
};

test('standalone Imagine has an account-only, project-free shell', () => {
  const page = read('Imagine.dc.html');
  const header = page.slice(page.indexOf('<header class="v5-topbar">'), page.indexOf('</header>') + 9);

  assert.match(page, /<title>Imagine · FilmScript<\/title>/);
  assert.match(page, /<film-script-canvas scope="account" initial-view="imagine" aria-label="Imagine"><\/film-script-canvas>/);
  assert.doesNotMatch(page, /script-id=/);
  assert.doesNotMatch(page, /[?&]script=/);
  assert.match(header, /<nav class="imaging-only-nav"[^>]*><span aria-current="page">Imagine<\/span><\/nav>/);
  assert.doesNotMatch(header, />\s*(?:Scripts|Guiones|Editor|Analysis|Análisis|Breakdown|Desglose|Canvas|Boards|Vault)\s*</);
  assert.match(page, /scripts-access-guard\.js\?v=/);
  assert.match(page, /platform-client\.js\?v=/);
  assert.match(page, /canvas-client\.js\?v=20260821-imagine-gallery1/);
  assert.match(page, /canvas-workspace\.js\?v=20260821-imagine-gallery1/);
});

test('standalone Imagine preserves accessible navigation, localization, and mobile targets', () => {
  const page = read('Imagine.dc.html');

  assert.match(page, /<a class="imaging-skip" href="#imaging-workspace">/);
  assert.match(page, /<main class="imaging-main" id="imaging-workspace">/);
  assert.match(page, /<nav class="imaging-only-nav" aria-label="Imagine workspace">/);
  assert.match(page, /button class="imaging-chrome-button" type="button"[^>]*aria-label=/);
  assert.match(page, /button type="button" data-testid="account-avatar" aria-label=/);
  assert.match(page, /Cambiar tema/);
  assert.match(page, /Abrir cuenta/);
  assert.match(page, /Ir a Imagine/);
  assert.match(page, /width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important/);
  assert.doesNotMatch(page, /\.fs-mobile-(?:global|project)\s*\{/);
  assert.match(page, /prefers-reduced-transparency:reduce/);
  assert.match(page, /prefers-reduced-motion:reduce/);
});

test('account Imagine client uses the internal imaging endpoints without a synthetic screenplay', () => {
  const client = read('canvas-client.js');
  const accountApi = client.slice(client.indexOf('window.filmscriptCanvas = {'), client.indexOf('get: async (scriptId)'));

  assert.match(client, /const accountImagingPath = \(suffix = ''\) => `\/api\/me\/imaging\$\{suffix\}`/);
  assert.match(accountApi, /getAccountImaging: \(\) => request\(accountImagingPath\(\)\)/);
  assert.match(accountApi, /generateAccountImagingImage/);
  assert.match(accountApi, /uploadAccountImagingAsset/);
  assert.match(accountApi, /accountImagingAssetUrl/);
  assert.doesNotMatch(accountApi, /scriptId|sentinel|standalone_/);
});

test('account scope locks the workspace to Imagine and hides project affordances', () => {
  const workspace = read('canvas-workspace.js');

  assert.match(workspace, /get accountScoped\(\) \{ return this\.getAttribute\('scope'\) === 'account'; \}/);
  assert.match(workspace, /\['imagine', 'account_imaging', 'standalone_imaging'\]/);
  assert.match(workspace, /if \(!this\.accountScoped && !this\.scriptId\)/);
  assert.match(workspace, /this\.accountScoped\s*\? window\.filmscriptCanvas\.getAccountImaging\(\)/);
  assert.match(workspace, /if \(this\._isImagineOnlyWorkspace\(\) && view !== 'imagine'\) view = 'imagine'/);
  assert.match(workspace, /:host\(\[scope="account"\]\) \.cv-imagine-tile:after\{display:none\}/);
  assert.match(workspace, /Every image you create will stay in your personal gallery\./);
  assert.match(workspace, /Cada imagen que crees quedará en tu galería personal\./);
  assert.match(workspace, /Loading your Imagine gallery/);
  assert.match(workspace, /Cargando tu galería de Imagine/);
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

test('Imagine capability controls only expose enabled choices and every request pins its selection', () => {
  const workspace = read('canvas-workspace.js');

  assert.match(workspace, /imagineMediaMode: '', imagineModelId: ''/);
  assert.match(workspace, /capabilities\.mediaModes/);
  assert.match(workspace, /capabilities\.models \?\? capabilities\.imageModels/);
  assert.match(workspace, /capabilities\.imageModels/);
  assert.match(workspace, /capabilities\.defaults/);
  assert.match(workspace, /source\.enabled !== false/);
  assert.match(workspace, /source\.available !== false/);
  assert.match(workspace, /capabilities\.mediaModes\.length > 1/);
  assert.match(workspace, /modelOptionsForMode\.length > 1/);
  assert.match(workspace, /name="mediaMode"/);
  assert.match(workspace, /name="modelId"/);
  assert.match(workspace, /prompt: job\.prompt,\s+mediaMode,\s+modelId,/);
  assert.match(workspace, /mediaMode: String\(job\?\.mediaMode \|\| 'image'\)/);
  assert.match(workspace, /modelId: String\(job\?\.modelId \|\| 'imagine-image-v1'\)/);
  assert.match(workspace, /return capabilities\.models\.filter\(\(option\) => !option\.mediaMode \|\| option\.mediaMode === mediaMode\)/);
  assert.match(workspace, /const mediaModeSupported = capabilities\.mediaModes\.some/);
  assert.match(workspace, /const modelSupported = this\._imagineModelsForMode/);
  assert.match(workspace, /if \(!mediaModeSupported \|\| !modelSupported\)/);
  assert.doesNotMatch(workspace, /const mediaMode = capabilities\.mediaModes\.some\(\(option\) => option\.id === job\.mediaMode\)[\s\S]{0,120}capabilities\.defaults\.mediaMode/);
});

test('future enabled video capabilities can use the same conditional controls without exposing disabled entries', () => {
  const workspace = read('canvas-workspace.js');

  assert.match(workspace, /source\.enabled !== false[\s\S]*source\.available !== false[\s\S]*\.filter\(\(option\) => option\.id && option\.enabled\)/);
  assert.match(workspace, /capabilities\.mediaModes\.map\(\(option\) => `<option/);
  assert.match(workspace, /modelOptionsForMode\.map\(\(option\) => `<option/);
  assert.match(workspace, /option\.mediaMode === mediaMode/);
  assert.match(workspace, /if \(option\.id === 'video'\) return 'Video'/);

  const Workspace = loadCanvasWorkspaceClass();
  const element = new Workspace();
  const capabilities = element._imagineCapabilities({
    capabilities: {
      mediaModes: [
        { id: 'image', enabled: true },
        { id: 'video', enabled: true },
        { id: 'video-preview', enabled: false },
      ],
      models: [
        { id: 'still-v2', mediaMode: 'image', enabled: true },
        { id: 'motion-v1', mediaMode: 'video', enabled: true },
        { id: 'motion-disabled', mediaMode: 'video', enabled: false },
      ],
      defaults: { mediaMode: 'video', modelId: 'motion-v1' },
    },
  });
  assert.deepEqual(Array.from(capabilities.mediaModes, ({ id }) => id), ['image', 'video']);
  assert.deepEqual(Array.from(element._imagineModelsForMode(capabilities, 'video'), ({ id }) => id), ['motion-v1']);
  assert.equal(capabilities.defaults.mediaMode, 'video');
  assert.equal(capabilities.defaults.modelId, 'motion-v1');

  const SpanishWorkspace = loadCanvasWorkspaceClass('es');
  const spanishElement = new SpanishWorkspace();
  assert.equal(spanishElement._imagineCapabilityLabel({ id: 'still-v2', label: 'Imagine Image Ultra', labelEs: '' }), 'Imagen Imagine Ultra');
  assert.equal(spanishElement._imagineCapabilityLabel({ id: 'motion-v1', label: 'Imagine Motion', labelEs: 'Movimiento Imagine' }), 'Movimiento Imagine');
});

test('a persisted job is never replayed under a replacement default model', async () => {
  const Workspace = loadCanvasWorkspaceClass();
  const element = new Workspace();
  const savedJob = {
    id: 'imagine-job_abc123',
    mediaMode: 'image',
    modelId: 'imagine-image-v1',
    prompt: 'A locked-off production still',
  };
  element.state.workspace = {
    assets: [],
    capabilities: {
      mediaModes: ['image'],
      models: [{ id: 'replacement-v2', mediaMode: 'image', enabled: true }],
      defaults: { mediaMode: 'image', modelId: 'replacement-v2' },
    },
  };
  element.state.imaginePendingJobs = [savedJob];
  let generationCalls = 0;
  let retired = false;
  element._generateImage = async () => { generationCalls += 1; return { pending: true }; };
  element._getWorkspace = async () => ({ workspace: element.state.workspace });
  element._finishImagineJob = () => { retired = true; element.state.imaginePendingJobs = []; };
  element.toast = () => {};
  element.render = () => {};

  await element._submitImagineJob(savedJob, true);

  assert.equal(generationCalls, 0);
  assert.equal(retired, true);
});

test('legacy Imaging bookmarks immediately preserve query and hash while moving to Imagine', () => {
  const redirect = read('Imaging.dc.html');

  assert.match(redirect, /new URL\('\/Imagine\.dc\.html', window\.location\.origin\)/);
  assert.match(redirect, /destination\.search = window\.location\.search/);
  assert.match(redirect, /destination\.hash = window\.location\.hash/);
  assert.match(redirect, /window\.location\.replace\(destination\.href\)/);

  let replacedWith = '';
  const script = redirect.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
  vm.runInNewContext(script, {
    URL,
    window: {
      location: {
        protocol: 'https:',
        origin: 'https://filmscript.app',
        href: 'https://filmscript.app/workspace/Imaging.dc.html?from=bookmark#gallery',
        search: '?from=bookmark',
        hash: '#gallery',
        replace: (value) => { replacedWith = value; },
      },
    },
  });
  assert.equal(replacedWith, 'https://filmscript.app/Imagine.dc.html?from=bookmark#gallery');
});

test('neutral Imagine route resolves first-party and is rewritten at the edge', () => {
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

test('production frontend build includes Imagine and its compatibility redirect as required outputs', () => {
  const build = read('scripts/build-netlify.mjs');
  const server = read('server.js');

  assert.match(build, /const frontendFiles = \[[\s\S]*"Imagine\.dc\.html"[\s\S]*"Imaging\.dc\.html"/);
  assert.match(build, /for \(const required of \[[^\]]*"Imagine\.dc\.html"[^\]]*"Imaging\.dc\.html"/);
  assert.match(server, /PUBLIC_STATIC_FILES = new Set\(\[[\s\S]*"Imagine\.dc\.html"/);
  assert.match(server, /if \(relativePath === "Imaging\.dc\.html"\)[\s\S]*Location: `\/Imagine\.dc\.html\$\{query\}`/);
});
