import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

function languageApi(language = 'en') {
  const values = new Map([['filmscript_language', language]]);
  const document = {
    readyState: 'loading',
    documentElement: { setAttribute() {} },
    addEventListener() {},
    querySelectorAll() { return []; },
  };
  const window = {
    location: { search: '', pathname: '/Features.dc.html' },
    addEventListener() {},
    dispatchEvent() {},
  };
  const context = vm.createContext({
    window,
    document,
    localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
    URLSearchParams,
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_NODE: 9, DOCUMENT_FRAGMENT_NODE: 11 },
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setTimeout() {},
    clearTimeout() {},
  });
  vm.runInContext(read('language-preference.js'), context);
  return window.filmscriptLanguage;
}

const critical = new Map([
  ['FilmScript | Write it. See it. Make it.', 'FilmScript | Escríbelo. Visualízalo. Hazlo.'],
  ['From first page to final delivery', 'De la primera página a la entrega final'],
  ['Compare plans', 'Comparar planes'],
  ['One connected workspace', 'Un espacio de trabajo conectado'],
  ['Write in a production-ready screenplay editor with smart formatting, autosave, imports and PDF export.', 'Escribe en un editor de guion listo para producción, con formato inteligente, guardado automático, importación y exportación a PDF.'],
  ['One change moves through the whole production.', 'Un cambio recorre toda la producción.'],
  ['A screenplay connected to FilmScript production tools', 'Un guion conectado con las herramientas de producción de FilmScript'],
  ['Go to Script Editor', 'Ir al Editor de guion'],
  ['Pricing · FilmScript', 'Precios · FilmScript'],
  ['Start free, create with 100 monthly image credits in Creator, or unlock Full with 1,000.', 'Empieza gratis, crea con 100 créditos de imagen mensuales en Creator o desbloquea Full con 1,000.'],
  ['100 image credits', '100 créditos de imagen'],
  ['Everything in the Free workspace', 'Todo lo incluido en el espacio del plan Free'],
  ['Choose Low, Medium, or High image quality for each generation', 'Elige calidad de imagen baja, media o alta para cada generación'],
  ['Plan and billing · FilmScript', 'Plan y facturación · FilmScript'],
  ['Use the same Google account connected to your FilmScript subscription.', 'Usa la misma cuenta de Google vinculada a tu suscripción de FilmScript.'],
  ['Membership', 'Membresía'],
  ['Plan & billing', 'Plan y facturación'],
  ['Plan highlights', 'Aspectos destacados del plan'],
  ['Screenplay and translation', 'Guion y traducción'],
  ['Production planning', 'Planificación de producción'],
  ['Plan canceled', 'Plan cancelado'],
  ['Finishing your subscription', 'Finalizando tu suscripción'],
]);

test('public Features, Pricing and Subscription copy has an exact ES/EN contract', () => {
  const spanish = languageApi('es').t;
  const english = languageApi('en').t;
  for (const [source, translated] of critical) {
    assert.equal(spanish(source), translated, source);
    assert.equal(english(source), source, source);
  }
});

test('critical public literals are present on the surfaces they localize', () => {
  const features = read('Features.dc.html');
  const pricing = read('Pricing.dc.html');
  const subscription = read('Subscription.dc.html');
  for (const literal of ['From first page to final delivery', 'Compare plans', 'One connected workspace', 'Go to Script Editor']) {
    assert.ok(features.includes(literal), `Features: ${literal}`);
  }
  for (const literal of ['Pricing · FilmScript', 'Start free, create with 100 monthly image credits in Creator, or unlock Full with 1,000.', 'Everything in the Free workspace']) {
    assert.ok(pricing.includes(literal), `Pricing: ${literal}`);
  }
  for (const literal of ['Use the same Google account connected to your FilmScript subscription.', 'Membership', 'Plan highlights', 'Screenplay and translation', 'Finishing your subscription']) {
    assert.ok(subscription.includes(literal), `Subscription: ${literal}`);
  }
});

test('public pages load localization and billing errors cannot leak raw English into Spanish UI', () => {
  const features = read('Features.dc.html');
  const pricing = read('Pricing.dc.html');
  const subscription = read('Subscription.dc.html');

  for (const [name, source] of [['Features', features], ['Pricing', pricing], ['Subscription', subscription]]) {
    assert.match(source, /language-preference\.js\?v=20260820-i18n2/, `${name} localization loader`);
  }
  assert.match(pricing, /<title>Pricing · FilmScript<\/title>/);
  assert.match(features, /FilmScript no pudo abrir el pago seguro\. Inténtalo de nuevo\./);
  assert.match(pricing, /FilmScript no pudo completar esta acción\. No se realizó ningún cobro\./);
  assert.match(subscription, /const localizedBillingError = \(error,/);
  assert.match(subscription, /const localizedProviderMessage = \(message\)/);
  assert.doesNotMatch(subscription, /textContent = error\.message/);
});

test('FilmScript plan names and Lumiere remain product names in Spanish', () => {
  const spanish = languageApi('es').t;
  for (const name of ['FilmScript', 'Lumiere', 'FilmScript Creator', 'FilmScript Full']) {
    assert.equal(spanish(name), name);
  }
});
