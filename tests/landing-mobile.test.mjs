import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'Features.dc.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'filmscript-landing.css'), 'utf8');

test('mobile landing leads with the promise and an illustration instead of repeated copy', () => {
  assert.match(html, /filmscript-landing\.css\?v=20260821-mobile-carousel2/);
  assert.doesNotMatch(html, /id="filmscript-compact-landing-login"/);
  assert.match(html, /<header class="fs-home-hero">[\s\S]*Write it\.[\s\S]*See it\.[\s\S]*Make it\.[\s\S]*<\/header>[\s\S]*class="fs-hero-actions"[\s\S]*class="fs-hero-stage"/);
  assert.doesNotMatch(html, /class="fs-connection-section"/);
  assert.doesNotMatch(html, /FilmScript connected workflow/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.fs-home-eyebrow,[\s\S]*\.fs-home-lede,[\s\S]*display: none;/);
  assert.match(css, /\.fs-home-hero \{[\s\S]*order: 1;/);
  assert.match(css, /\.fs-hero-stage \{[\s\S]*order: 2;/);
  assert.match(css, /\.fs-suite-nav \{[\s\S]*order: 3;/);
  assert.match(css, /\.fs-hero-actions \{[\s\S]*order: 4;/);
  assert.match(css, /\.fs-suite-section \{[\s\S]*order: 5;[\s\S]*padding: 24px 16px 0;/);
  assert.match(css, /\.fs-section-heading \{\s*display: none;/);
});

test('mobile sign in stays visually compact while retaining a large touch target', () => {
  assert.match(css, /\.fs-topbar \{[\s\S]*height: 44px !important;/);
  assert.match(css, /\.fs-top-actions \.fs-home-login \{[\s\S]*height: 32px;[\s\S]*min-height: 32px;[\s\S]*padding: 0 12px;/);
  assert.match(css, /\.fs-top-actions \.fs-home-login::after \{[\s\S]*inset: -6px;/);
});

test('mobile landing keeps both top and final actions comfortably separated', () => {
  assert.match(html, /data-testid="landing-primary-hero"[\s\S]*fs-landing-cta--secondary/);
  assert.match(html, /data-testid="landing-primary-final"[\s\S]*fs-landing-cta--secondary/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.fs-cta-row \{[\s\S]*gap: 12px !important;[\s\S]*flex-wrap: wrap;/);
  assert.match(css, /\.fs-hero-actions \.fs-landing-cta--secondary \{\s*display: inline-flex;/);
  assert.doesNotMatch(css, /\.fs-hero-audience,\s*\.fs-hero-actions \.fs-landing-cta--secondary \{\s*display: none;/);
  assert.match(css, /@media \(max-width: 360px\) \{[\s\S]*\.fs-cta-row \{\s*flex-direction: column;/);
});

test('shot list illustration uses a compact language-neutral movement label', () => {
  assert.match(html, /class="fs-svg-text fs-shot-move-label"[^>]*data-i18n-skip>Dolly<\/text>/);
  assert.doesNotMatch(html, /class="fs-svg-text"[^>]*>Dolly in<\/text>/);
});

test('feature names form a touch-native ping-pong carousel with safe motion preferences', () => {
  assert.match(html, /ref="\{\{ suiteNavRef \}\}"[^>]*aria-live="off"/);
  assert.equal((html.match(/class="fs-suite-nav-track/g) || []).length, 1);
  assert.doesNotMatch(html, /fs-suite-nav-track--clone/);
  assert.match(html, /let direction = 1/);
  assert.match(html, /let position = nav\.scrollLeft/);
  assert.match(html, /const syncPosition = \(\) => \{\s*position = Math\.min\(maxScroll, Math\.max\(0, nav\.scrollLeft\)\);/);
  assert.match(html, /const targetVelocity = canMove && maxScroll > 1 \? direction \* 18 : 0/);
  assert.match(html, /position \+= velocity \* dt \/ 1000/);
  assert.match(html, /nav\.scrollLeft = position/);
  assert.match(html, /direction = -1/);
  assert.match(html, /direction = 1/);
  assert.match(html, /resumeAt = performance\.now\(\) \+ 1000/);
  assert.match(html, /requestAnimationFrame\(tick\)/);
  assert.match(html, /new ResizeObserver\(measure\)/);
  assert.match(html, /new IntersectionObserver/);
  assert.match(html, /pointerdown/);
  assert.match(html, /touchstart/);
  assert.match(html, /pointerup/);
  assert.match(html, /wheel/);
  assert.match(html, /focus-visible/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /scrollContainer\.scrollTo\(\{ top, behavior: reducedMotion\.matches \? 'auto' : 'smooth' \}\)/);
  assert.match(html, /window\.history\.replaceState\(window\.history\.state, '', link\.hash\)/);
  assert.match(html, /this\._suiteMarqueeCleanup/);
  assert.match(html, /componentDidUpdate\(\) \{\s*this\._armSuiteMarquee\(\);/);
  assert.match(html, /this\._suiteMarqueeCleanup && this\._suiteMarqueeNode === nav && this\._suiteMarqueeTrack === track && nav\.isConnected && track\.isConnected/);
  assert.match(html, /this\._suiteMarqueeCleanup\?\.\(\);\s*this\._suiteMarqueeNode = nav;\s*this\._suiteMarqueeTrack = track;/);
  assert.match(css, /touch-action: pan-x pan-y;/);
  assert.match(css, /overscroll-behavior-inline: contain;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('carousel advances even when the browser quantizes scrollLeft to whole pixels', () => {
  const method = html.match(/\n  _armSuiteMarquee\(\) \{([\s\S]*?)\n  \}\n\n  _scrollToSec\(name\)/);
  assert.ok(method, 'carousel method should be extractable for a browser-like motion check');

  let now = 0;
  let nextFrameId = 0;
  const frames = [];
  const cancelled = new Set();
  const media = (matches) => ({ matches, addEventListener() {}, removeEventListener() {} });
  const fakeWindow = {
    matchMedia(query) { return media(query === '(max-width: 700px)'); },
    requestAnimationFrame(callback) { const id = ++nextFrameId; frames.push({ id, callback }); return id; },
    cancelAnimationFrame(id) { cancelled.add(id); },
    addEventListener() {}, removeEventListener() {},
    history: { state: null, replaceState() {} },
    location: { hash: '' }
  };
  const fakeDocument = {
    hidden: false,
    addEventListener() {}, removeEventListener() {},
    getElementById() { return null; }
  };
  const fakePerformance = { now: () => now };
  const track = { isConnected: true };
  let renderedScrollLeft = 0;
  const nav = {
    isConnected: true,
    scrollWidth: 940,
    clientWidth: 320,
    dataset: {},
    querySelector() { return track; },
    addEventListener() {}, removeEventListener() {}, contains() { return true; }
  };
  Object.defineProperty(nav, 'scrollLeft', {
    get: () => renderedScrollLeft,
    set: (value) => { renderedScrollLeft = Math.trunc(value); }
  });
  class FakeResizeObserver { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} }
  class FakeIntersectionObserver {
    constructor(callback) { this.callback = callback; }
    observe() { this.callback([{ isIntersecting: true }]); }
    disconnect() {}
  }
  const Harness = new Function('window', 'document', 'performance', 'ResizeObserver', 'IntersectionObserver', `
    return class CarouselHarness {
      constructor(navNode) {
        this.suiteNavRef = { current: navNode };
        this.landingScrollRef = { current: { contains: () => false } };
      }
      _armSuiteMarquee() {${method[1]}
      }
    };
  `)(fakeWindow, fakeDocument, fakePerformance, FakeResizeObserver, FakeIntersectionObserver);

  const harness = new Harness(nav);
  harness._armSuiteMarquee();
  for (let index = 0; index < 180; index += 1) {
    const frame = frames.shift();
    assert.ok(frame, 'carousel should keep requesting animation frames while mounted');
    now += 16;
    if (!cancelled.has(frame.id)) frame.callback(now);
  }
  assert.ok(renderedScrollLeft > 0, `expected quantized scrollLeft to advance, received ${renderedScrollLeft}`);
  harness._suiteMarqueeCleanup?.();
});
