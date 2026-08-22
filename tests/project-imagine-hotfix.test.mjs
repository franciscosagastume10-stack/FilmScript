import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'canvas-workspace.js'), 'utf8');

const loadWorkspace = () => {
  const registry = new Map();
  class FakeImageElement {
    constructor(src = '') {
      this.src = src;
      this.dataset = {};
      this.complete = false;
      this.naturalWidth = 0;
    }
  }
  class FakeHTMLElement {
    constructor() { this._attrs = {}; }
    attachShadow() {
      this.shadowRoot = { querySelector: () => null, querySelectorAll: () => [] };
      return this.shadowRoot;
    }
    getAttribute(name) { return this._attrs[name] || ''; }
    setAttribute(name, value) { this._attrs[name] = String(value); }
  }
  const sandbox = {
    HTMLElement: FakeHTMLElement,
    HTMLImageElement: FakeImageElement,
    customElements: {
      get: (name) => registry.get(name),
      define: (name, value) => registry.set(name, value),
    },
    window: {
      addEventListener() {},
      removeEventListener() {},
      innerWidth: 1280,
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      filmscriptCanvas: {},
    },
    document: { activeElement: null },
    console,
    crypto: { getRandomValues: (bytes) => bytes.fill(3) },
    requestAnimationFrame: (callback) => callback(),
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(SOURCE, sandbox);
  return { Workspace: registry.get('film-script-canvas'), sandbox, FakeImageElement };
};

const sampleAsset = {
  id: 'asset_1',
  source: 'imagine',
  prompt: 'A quiet practical-location portrait at dusk',
  width: 1536,
  height: 1024,
  createdAt: '2026-08-21T18:00:00.000Z',
};

test('project Imagine prioritizes the visible row and defers distant image URLs', () => {
  const { Workspace } = loadWorkspace();
  const element = new Workspace();
  element.assetUrl = (id) => `/images/${id}`;
  element.state.workspace = { assets: [sampleAsset] };

  const visible = element.renderImagineTile({ type: 'image', asset: sampleAsset, ratio: 1.5 }, 4, true);
  assert.match(visible, /loading="eager" fetchpriority="high" decoding="async" src="\/images\/asset_1"/);
  assert.match(visible, /width="1536" height="1024"/);

  const later = element.renderImagineTile({ type: 'image', asset: sampleAsset, ratio: 1.5 }, 5, false);
  assert.match(later, /loading="lazy" fetchpriority="low" decoding="async" data-src="\/images\/asset_1"/);
  assert.doesNotMatch(later, /decoding="async" src=/);
  assert.match(SOURCE, /renderImagineTile\(entry, tileIndex\+\+, rowIndex === 0\)/);
  assert.match(SOURCE, /\.cv-imagine-gallery-row\{[^}]*content-visibility:auto;contain-intrinsic-size:auto 220px/);
});

test('project Imagine hydrates only images approaching the viewport', () => {
  const { Workspace, sandbox, FakeImageElement } = loadWorkspace();
  const element = new Workspace();
  const observers = [];
  sandbox.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = [];
      observers.push(this);
    }
    observe(image) { this.observed.push(image); }
    unobserve(image) { this.observed = this.observed.filter((entry) => entry !== image); }
    disconnect() { this.disconnected = true; }
  };
  const near = new FakeImageElement();
  near.dataset.src = '/images/near';
  const distant = new FakeImageElement();
  distant.dataset.src = '/images/distant';
  element.shadowRoot.querySelectorAll = () => [near, distant];

  element._hydrateImagineImages();
  const observer = observers.at(-1);
  assert.equal(observer.options.root, null);
  assert.equal(observer.options.rootMargin, '720px 0px');
  observer.callback([
    { target: near, isIntersecting: true },
    { target: distant, isIntersecting: false },
  ]);
  assert.equal(near.src, '/images/near');
  assert.equal(near.dataset.src, undefined);
  assert.equal(distant.src, '');
  assert.equal(distant.dataset.src, '/images/distant');
});

test('project Imagine uses one flashing loader for metadata and image decode', () => {
  assert.match(SOURCE, /\.cv-imagine-skeleton:after\{content:none\}/);
  assert.match(SOURCE, /\.cv-imagine-skeleton:before\{[^}]*animation:cvImageTileShimmer 1\.35s ease-in-out infinite/);
  assert.match(SOURCE, /\.cv-imagine-tile\.is-image-loading:before\{[^}]*animation:cvImageTileShimmer 1\.35s ease-in-out infinite/);
  assert.doesNotMatch(SOURCE, /@keyframes cvImagineSkeletonFloat/);
});

test('project Imagine synchronously guards entitlement checks against duplicate submits', async () => {
  const { Workspace } = loadWorkspace();
  const element = new Workspace();
  element.state.workspace = { assets: [] };
  const button = { disabled: false, textContent: '3 credits' };
  const composer = {
    busy: false,
    querySelector: (selector) => selector === '.cv-imagine-generate[type="submit"]' ? button : null,
    toggleAttribute: (name, value) => { if (name === 'aria-busy') composer.busy = Boolean(value); },
  };
  element.shadowRoot.querySelector = (selector) => selector === '[data-form="imagine-image"]' ? composer : null;
  let allowEntitlement;
  element.ensureImageGeneration = () => new Promise((resolve) => { allowEntitlement = resolve; });
  element.render = () => {};
  element._saveImagineJobs = () => {};
  const submitted = [];
  element._submitImagineJob = (job) => { submitted.push(job); };
  const values = new Map([
    ['prompt', 'A quiet practical-location portrait at dusk'],
    ['size', '1536x1024'],
    ['style', 'cinematic'],
    ['quality', 'low'],
  ]);
  const data = { get: (name) => values.get(name) || '' };

  const click = element.generateImagineImage(data);
  const enter = element.generateImagineImage(data);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'Checking…');
  assert.equal(composer.busy, true);
  assert.equal(element.state.imaginePendingJobs.length, 0);

  allowEntitlement(true);
  await Promise.all([click, enter]);
  assert.equal(element.state.imaginePendingJobs.length, 1);
  assert.equal(submitted.length, 1);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '3 credits');
  assert.equal(composer.busy, false);
});
