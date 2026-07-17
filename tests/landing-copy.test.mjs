import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const features = fs.readFileSync(path.join(root, 'Features.dc.html'), 'utf8');
const language = fs.readFileSync(path.join(root, 'language-preference.js'), 'utf8');

test('landing hero balances the headline and exposes one clear Pro CTA', () => {
  assert.match(features, /class="fs-hero-title"/);
  assert.match(features, /text-wrap: balance/);
  assert.match(features, /data-testid="landing-plan-cta"/);
  assert.match(features, /Start writing with FilmScript Pro · \$19\.99\/month/);
  assert.doesNotMatch(features, /FilmScript Pro · \$20 a month\. Cancel any time\./);
  assert.match(language, /'Start writing with FilmScript Pro · \$19\.99\/month': 'Empieza a escribir con FilmScript Pro · \$19\.99\/mes'/);
});
