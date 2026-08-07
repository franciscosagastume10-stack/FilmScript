import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const features = fs.readFileSync(path.join(root, 'Features.dc.html'), 'utf8');
const landingStyles = fs.readFileSync(path.join(root, 'filmscript-landing.css'), 'utf8');
const language = fs.readFileSync(path.join(root, 'language-preference.js'), 'utf8');

test('landing hero balances the headline and exposes one clear Pro CTA', () => {
  assert.match(features, /class="fs-home-title"/);
  assert.match(features, /Write it\. See it\. Make it\./);
  assert.match(landingStyles, /\.fs-home-title[\s\S]*?text-wrap: balance/);
  assert.match(features, /data-testid="landing-plan-cta"/);
  assert.match(features, /Start writing with FilmScript Pro · \$19\.99\/month/);
  assert.doesNotMatch(features, /FilmScript Pro · \$20 a month\. Cancel any time\./);
  assert.match(language, /'Start writing with FilmScript Pro · \$19\.99\/month': 'Empieza a escribir con FilmScript Pro · \$19\.99\/mes'/);
});

test('landing presents the complete FilmScript workflow with asymmetric frames', () => {
  for (const feature of [
    'editor',
    'lumiere',
    'imagine',
    'analysis',
    'breakdown',
    'stripboard',
    'shot-list',
    'budget',
    'calendar',
  ]) {
    assert.match(features, new RegExp(`id="${feature}"`));
  }

  assert.match(features, /filmscript-landing\.css/);
  assert.match(features, /class="fs-card-frame"/);
  assert.match(landingStyles, /font-family: var\(--fs-font-text\)/);
  assert.match(landingStyles, /\.fs-screenplay-ink/);
  assert.match(landingStyles, /"Courier Prime"/);
  assert.match(landingStyles, /@media \(max-width: 700px\)/);
});
