import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'Features.dc.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'filmscript-landing.css'), 'utf8');

test('mobile landing leads with the promise and an illustration instead of repeated copy', () => {
  assert.match(html, /filmscript-landing\.css\?v=20260821-mobile-carousel1/);
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

test('feature names form a touch-native continuous carousel with safe motion preferences', () => {
  assert.match(html, /ref="\{\{ suiteNavRef \}\}"[^>]*aria-live="off"/);
  assert.equal((html.match(/class="fs-suite-nav-track/g) || []).length, 2);
  assert.match(html, /fs-suite-nav-track--clone" aria-hidden="true" inert/);
  assert.equal((html.match(/tabindex="-1"/g) || []).length, 9);
  assert.match(html, /const targetSpeed = canMove \? 22 : 0/);
  assert.match(html, /resumeAt = performance\.now\(\) \+ 1000/);
  assert.match(html, /requestAnimationFrame\(tick\)/);
  assert.match(html, /new ResizeObserver\(measure\)/);
  assert.match(html, /new IntersectionObserver/);
  assert.match(html, /pointerdown/);
  assert.match(html, /pointerup/);
  assert.match(html, /wheel/);
  assert.match(html, /focus-visible/);
  assert.match(html, /this\._suiteMarqueeCleanup/);
  assert.match(html, /componentDidUpdate\(\) \{\s*this\._armSuiteMarquee\(\);/);
  assert.match(html, /this\._suiteMarqueeCleanup && this\._suiteMarqueeNode === nav/);
  assert.match(html, /this\._suiteMarqueeCleanup\?\.\(\);\s*this\._suiteMarqueeNode = nav;/);
  assert.match(css, /touch-action: pan-x pan-y;/);
  assert.match(css, /overscroll-behavior-inline: contain;/);
  assert.match(css, /\.fs-suite-nav \.fs-suite-nav-track--clone \{\s*display: none;/);
  assert.match(css, /\.fs-suite-nav\[data-carousel-ready="true"\] \.fs-suite-nav-track--clone \{\s*display: flex;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.fs-suite-nav-track--clone \{[\s\S]*display: none !important;/);
});
