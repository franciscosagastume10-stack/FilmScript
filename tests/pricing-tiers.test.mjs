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

test('pricing exposes Free, Creator and Full with distinct prices and actions', () => {
  assert.match(pricing, /data-testid="pricing-free"/);
  assert.match(pricing, /data-testid="pricing-creator"/);
  assert.match(pricing, /data-testid="pricing-full"/);
  assert.match(pricing, /\$0/);
  assert.match(pricing, /\$24\.99/);
  assert.match(pricing, /\$39\.99/);
  assert.match(pricing, /onClick="\{\{ chooseCreator \}\}"/);
  assert.match(pricing, /onClick="\{\{ chooseFull \}\}"/);
  assert.match(pricing, /planCreator:/);
  assert.match(pricing, /planFull:/);
});

test('Creator includes 100 image credits while Full adds the complete image-credit workflow', () => {
  assert.match(pricing, /100 image credits in every monthly billing cycle/);
  assert.match(pricing, /Everything in Creator/);
  assert.match(pricing, /1,000 image credits in every monthly billing cycle/);
  assert.match(pricing, /Every AI image uses 3 credits/);
  assert.match(pricing, /Connected Budget, Cash Flow, expense reporting, and A4 exports/);
  assert.match(pricing, /The full production studio, with image generation across FilmScript/);
});

test('marketing headers do not render the decorative three-line menu', () => {
  for (const page of [pricing, features]) {
    assert.doesNotMatch(page, /flex-direction: column; gap: 3px; cursor: pointer; padding: 6px/);
  }
});

test('the current billing and entitlement layer recognizes Creator and Full without clearing an active plan', () => {
  assert.match(server, /BILLING_PLAN_KEYS = Object\.freeze\(\["creator", "full"\]\)/);
  assert.match(server, /function paidPlanHasTextAccess\(userId\)/);
  assert.match(server, /\["creator", "full"\]\.includes\(lumierePlanKey\(userId\)\)/);
  assert.doesNotMatch(app, /setState\(\{ plan: null, paywallOpen/);
  assert.doesNotMatch(editor, /setState\(\{ plan: null, paywallOpen/);
});

test('a Google account can hold only one paid plan and confirms a plan change', () => {
  assert.match(server, /error: "plan_change_required"/);
  assert.match(server, /async function handlePlanSwitch/);
  assert.match(server, /\/api\/subscription\/switch/);
  assert.match(server, /method: "DELETE"/);
  assert.match(pricing, /checkoutIsPlanChange/);
  assert.match(pricing, /switchPlan\(this\.state\.checkoutPlan, language\)/);
});

test('legacy billing plans use the explicit switch flow when moving to Creator or Full', () => {
  for (const source of [pricing, features, app]) {
    assert.match(source, /billingPlan: null/);
    assert.match(source, /billingPlan: String\(me\.billingPlan \|\| me\.plan \|\| ''\)\.trim\(\)\.toLowerCase\(\) \|\| null/);
    assert.match(source, /const changingPlan = !!billingPlan && billingPlan !== this\.state\.checkoutPlan/);
  }
  assert.match(pricing, /const checkoutIsPlanChange = !!billingPlan && !!checkoutPlanKey && billingPlan !== checkoutPlanKey/);
  assert.match(server, /function mayApplySubscriptionCreate/);
});
