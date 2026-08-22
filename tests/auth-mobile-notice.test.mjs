import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'auth-mobile-notice.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'auth-complete.html'), 'utf8');

function harness({
  userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  userAgentData,
  platform = 'MacIntel',
  maxTouchPoints = 0,
  language = 'en-US',
  savedLanguage = null,
} = {}) {
  const redirects = [];
  const documentHandlers = new Map();
  const makeElement = () => {
    const handlers = new Map();
    const classes = new Set();
    return {
      hidden: false,
      disabled: false,
      focused: false,
      textContent: '',
      classList: {
        add: (...values) => values.forEach((value) => classes.add(value)),
        remove: (...values) => values.forEach((value) => classes.delete(value)),
        contains: (value) => classes.has(value),
      },
      addEventListener: (type, handler) => handlers.set(type, handler),
      focus() { this.focused = true; },
      trigger: (type, event = {}) => handlers.get(type)?.(event),
    };
  };
  const elements = Object.fromEntries([
    'auth-shell',
    'auth-loader',
    'auth-loading',
    'message',
    'retry',
    'auth-loading-title',
    'phone-notice',
    'phone-notice-eyebrow',
    'phone-notice-title',
    'phone-notice-message',
    'phone-notice-note',
    'phone-notice-continue',
  ].map((id) => [id, makeElement()]));
  elements['phone-notice'].hidden = true;
  elements.retry.hidden = true;

  const document = {
    documentElement: { lang: 'en' },
    getElementById: (id) => elements[id] || null,
    addEventListener: (type, handler) => documentHandlers.set(type, handler),
    removeEventListener: (type, handler) => {
      if (documentHandlers.get(type) === handler) documentHandlers.delete(type);
    },
  };
  const window = {
    navigator: { userAgent, userAgentData, platform, maxTouchPoints, language },
    localStorage: { getItem: (key) => key === 'filmscript_language' ? savedLanguage : null },
    location: { replace: (value) => redirects.push(value) },
    requestAnimationFrame: (callback) => callback(),
  };
  vm.runInNewContext(source, { window, document });
  return {
    api: window.filmscriptMobileAuthNotice,
    elements,
    redirects,
    sendKey: (key) => {
      const event = { key, prevented: false, preventDefault() { this.prevented = true; } };
      documentHandlers.get('keydown')?.(event);
      return event;
    },
  };
}

test('phone detection excludes tablets and desktop browsers', () => {
  const { api } = harness();
  const cases = [
    { expected: true, userAgentData: { mobile: true }, userAgent: '' },
    { expected: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' },
    { expected: true, userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', platform: 'Linux armv8l' },
    { expected: false, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130.0 Safari/537.36', platform: 'Linux armv8l' },
    { expected: false, userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', platform: 'iPad' },
    { expected: false, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Mobile/15E148', platform: 'MacIntel', maxTouchPoints: 5 },
    { expected: false, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36' },
  ];
  for (const testCase of cases) {
    assert.equal(api.isPhoneDevice({ navigator: {
      userAgent: testCase.userAgent,
      userAgentData: testCase.userAgentData,
      platform: testCase.platform ?? 'MacIntel',
      maxTouchPoints: testCase.maxTouchPoints ?? 0,
    } }), testCase.expected, testCase.userAgent || 'userAgentData.mobile');
  }
});

test('a successful Google handoff waits for acknowledgement on a phone', () => {
  const state = harness({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    language: 'es-GT',
  });
  const destination = '/App.dc.html?invitation=invite_123';

  assert.equal(state.api.finish(destination), true);
  assert.deepEqual(state.redirects, []);
  assert.equal(state.elements['auth-loading'].hidden, true);
  assert.equal(state.elements['phone-notice'].hidden, false);
  assert.equal(state.elements['phone-notice-continue'].focused, true);
  assert.equal(state.elements['phone-notice-title'].textContent, 'FilmScript se disfruta mejor en tu computadora');

  state.elements['phone-notice-continue'].trigger('click');
  assert.deepEqual(state.redirects, [destination]);
});

test('a successful Google handoff continues immediately on a computer', () => {
  const state = harness();
  assert.equal(state.api.finish('/App.dc.html'), false);
  assert.deepEqual(state.redirects, ['/App.dc.html']);
  assert.equal(state.elements['phone-notice'].hidden, true);
});

test('the notice keeps its single phone action reachable by keyboard', () => {
  const state = harness({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  state.api.finish('/App.dc.html');

  assert.equal(state.sendKey('Tab').prevented, true);
  assert.equal(state.elements['phone-notice-continue'].focused, true);
  assert.equal(state.sendKey('Escape').prevented, true);
  assert.deepEqual(state.redirects, ['/App.dc.html']);
});

test('the phone notice is accessible, motion safe, bilingual, and included in builds', () => {
  assert.match(source, /FilmScript works best on your computer/);
  assert.match(source, /FilmScript se disfruta mejor en tu computadora/);
  assert.match(page, /id="phone-notice" hidden role="dialog" aria-modal="true"/);
  assert.match(page, /aria-labelledby="phone-notice-title"/);
  assert.match(page, /aria-describedby="phone-notice-message phone-notice-note"/);
  assert.match(page, /aria-keyshortcuts="Escape"/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.match(page, /prefers-reduced-transparency: reduce/);
  assert.match(page, /auth-mobile-notice\.js\?v=20260822-phone-experience2/);
  assert.match(page, /@keyframes fs-page-loop/);
  assert.match(page, /animation: fs-page-loop 1\.55s/);
  assert.doesNotMatch(page, /phone-notice__spark/);
  assert.doesNotMatch(page, /fs-page-line-loop/);
  assert.match(page, /backdrop-filter: blur\(30px\) saturate\(1\.28\)/);
  assert.match(page, /filmscript_auth_handoff_identity_v1/);
  assert.match(page, /filmscriptMobileAuthNotice\.finish\(destination\)/);
  assert.match(fs.readFileSync(path.join(root, 'scripts/build-netlify.mjs'), 'utf8'), /"auth-mobile-notice\.js"/);
});
