import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pricing = fs.readFileSync(path.join(root, 'Pricing.dc.html'), 'utf8');
const features = fs.readFileSync(path.join(root, 'Features.dc.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'App.dc.html'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'Editor v5.dc.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('pricing exposes Free, Basic and Pro with distinct prices and actions', () => {
  assert.match(pricing, /data-testid="pricing-free"/);
  assert.match(pricing, /data-testid="pricing-basic"/);
  assert.match(pricing, /data-testid="pricing-pro"/);
  assert.match(pricing, /\$0/);
  assert.match(pricing, /\$12\.99/);
  assert.match(pricing, /\$19\.99/);
  assert.match(pricing, /onClick="\{\{ chooseBasic \}\}"/);
  assert.match(pricing, /planBasic:/);
  assert.match(pricing, /planPro:/);
});

test('Basic keeps manual production language while Pro lists the complete workflow', () => {
  assert.match(pricing, /The complete manual production desk, without AI/);
  assert.match(pricing, /No Analysis, Lumiere chat or AI generation/);
  assert.match(pricing, /Cash Flow by week with payment timing and search/);
  assert.match(pricing, /Compressed receipt uploads linked to budget lines/);
});

test('marketing headers do not render the decorative three-line menu', () => {
  for (const page of [pricing, features]) {
    assert.doesNotMatch(page, /flex-direction: column; gap: 3px; cursor: pointer; padding: 6px/);
  }
});

test('Lumiere entitlement stays Pro-only without clearing the Basic tier', () => {
  assert.match(server, /subscription\?\.plan === "lumiere" && subscription\?\.status === "active"/);
  assert.doesNotMatch(app, /setState\(\{ plan: null, paywallOpen/);
  assert.doesNotMatch(editor, /setState\(\{ plan: null, paywallOpen/);
});
