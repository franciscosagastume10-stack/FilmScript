import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const features = fs.readFileSync(path.join(root, 'Features.dc.html'), 'utf8');
const language = fs.readFileSync(path.join(root, 'language-preference.js'), 'utf8');

test('landing hero balances the headline and exposes one clear Full CTA', () => {
  assert.match(features, /class="fs-home-title fs-hero-title"/);
  assert.match(features, /text-wrap: balance/);
  assert.match(features, /data-testid="landing-plan-cta"/);
  assert.match(features, /Start free\. Creator \$24\.99\/month\. Full \$39\.99\/month\./);
  assert.doesNotMatch(features, /FilmScript Pro · \$20 a month\. Cancel any time\./);
  assert.match(language, /'Start free\. Creator \$24\.99\/month\. Full \$39\.99\/month\.': 'Empieza gratis\. Creator \$24\.99\/mes\. Full \$39\.99\/mes\.'/);
});
