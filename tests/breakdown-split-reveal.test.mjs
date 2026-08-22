import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

const readSources = async () => Promise.all([
  fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8'),
  fs.readFile(path.join(ROOT, 'breakdown-workspace.js'), 'utf8'),
]);

const sourceSection = (source, start, next) => {
  const from = source.indexOf(`  ${start}`);
  const to = source.indexOf(`\n  ${next}`, from + start.length);
  assert.notEqual(from, -1, `Missing source section: ${start}`);
  assert.notEqual(to, -1, `Missing source boundary: ${next}`);
  return source.slice(from, to);
};

const compileHarness = (source, sections, globals = {}) => vm.runInNewContext(
  `class Harness {\n${sections.map(([start, next]) => sourceSection(source, start, next)).join('\n')}\n}\nHarness`,
  globals,
);

test('Breakdown Split View waits for a secure rendered-screenplay handshake', async () => {
  const [editor] = await readSources();
  assert.match(editor, /filmscript:breakdown-split:v1/);
  assert.match(editor, /event\.origin === origin/);
  assert.match(editor, /event\.source === expectedSource/);
  assert.match(editor, /String\(data\.scriptId \|\| ''\) === scriptId/);
  assert.match(editor, /String\(data\.session \|\| ''\) === session/);
  assert.match(editor, /target\.postMessage\(\{ channel: this\._breakdownEmbedChannel\(\), scriptId, session, \.\.\.message \}, origin\)/);
  assert.doesNotMatch(editor, /target\.postMessage\([^,]+, ['"]\*['"]\)/s);
  assert.match(editor, /screenplayBlocks\.some\(\(block\) => this\._blockTextWithoutMarkers\(block\)\.trim\(\)\)/);
  assert.match(editor, /type: 'request-ready'/);
  assert.match(editor, /type: 'ready'/);
  assert.match(editor, /_pendingBreakdownSplitReveal/);
  assert.match(editor, /_pendingBreakdownEmbedCommand/);
  assert.match(editor, /_latestBreakdownEmbedRevealSequence/);
  assert.match(editor, /splitSession=\$\{encodeURIComponent\(this\.state\.breakdownSplitSession/);
  assert.match(editor, /breakdownSplitSession: this\._newBreakdownSplitSession\(\)/);
  assert.match(editor, /breakdownSplitLoaded: !positioningFailed/);
  assert.match(editor, /pointer-events: none; transition: opacity/);
  assert.match(editor, /\.v5-breakdown-script-frame\.is-ready \{ opacity: 1; pointer-events: auto; \}/);
  assert.match(editor, /aria-busy="\{\{ breakdownScriptAriaBusy \}\}"/);
  assert.match(editor, /aria-hidden="\{\{ breakdownScriptAriaHidden \}\}" tabindex="\{\{ breakdownScriptTabIndex \}\}"/);

  const frameLoad = editor.slice(editor.indexOf('_onBreakdownScriptFrameLoad ='), editor.indexOf('bindBreakdownScriptFrame ='));
  assert.match(frameLoad, /breakdownSplitLoaded: false/);
  assert.match(frameLoad, /_requestBreakdownEmbedReady/);
  assert.doesNotMatch(frameLoad, /breakdownSplitLoaded: true/);
});

test('Breakdown reference clicks stay in Breakdown and reveal the exact split-view source', async () => {
  const [editor] = await readSources();
  const openReference = editor.slice(editor.indexOf('async openBreakdownReference'), editor.indexOf('async openCastReference'));
  assert.ok(openReference.indexOf('_queueBreakdownSplitReveal') < openReference.indexOf("switchWorkMode('editor')"));
  const openCast = editor.slice(editor.indexOf('async openCastReference'), editor.indexOf('_updateBreakdownFormLocal'));
  assert.ok(openCast.indexOf('_queueBreakdownSplitReveal') < openCast.indexOf("switchWorkMode('editor')"));
  assert.match(editor, /filmscript:breakdown-open-reference/);
  assert.match(editor, /splitLinkable = this\.state\.breakdownSplitView/);
  assert.match(editor, /this\._syncBreakdownSplitScene\(nextIndex \+ 1/);
  assert.match(editor, /this\._syncBreakdownSplitScene\(sceneNumber, productionScenesRaw\[breakdownSceneIndex\]/);
  assert.match(editor, /Array\.from\(document\.querySelectorAll\('\[data-fs-page\] \[data-type\]'\)\)/);
  assert.match(editor, /if \(index > startIndex && block\.dataset\?\.type === 'scene'\) break/);
  assert.match(editor, /_normalizeBreakdownCategoryKey/);
  for (const alias of ['locations', 'vehicles', 'animals', 'special_effects', 'visual_effects', 'production_notes', 'safety_notes', 'camera', 'lighting', 'grip']) {
    assert.match(editor, new RegExp(`${alias}:`));
  }
  assert.match(editor, /behavior: reducedMotion \|\| options\.instant \? 'auto' : 'smooth'/);
  assert.match(editor, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(editor, /v5-breakdown-split-target/);
  assert.match(editor, /_findBreakdownTextRangesAcrossBlocks\(sceneBlocks, reference\)/);
  assert.match(editor, /if \(!pageBlocks\.length && !this\._isBreakdownEmbed\)/);
  assert.match(editor, /if \(attempt === 0\) this\._clearBreakdownReferenceHighlight\(\)/);
});

test('Split protocol dynamically queues the latest click and rejects spoofed or stale messages', async () => {
  const [editor] = await readSources();
  const sent = [];
  const scheduled = [];
  const frameWindow = { postMessage: (message, origin) => sent.push({ message, origin }) };
  const windowStub = {
    location: { origin: 'https://filmscript.test', search: '?script=scr_1' },
    filmscriptLanguage: { get: () => 'en' },
    setTimeout: (callback) => { scheduled.push(callback); return scheduled.length; },
  };
  const Harness = compileHarness(editor, [
    ['_breakdownEmbedChannel() {', '_breakdownUi(english, spanish) {'],
    ['_breakdownUi(english, spanish) {', '_breakdownEmbedScriptId() {'],
    ['_breakdownEmbedScriptId() {', '_newBreakdownSplitSession() {'],
    ['_breakdownEmbedSession() {', '_breakdownEmbedOrigin() {'],
    ['_breakdownEmbedOrigin() {', '_postBreakdownEmbedMessage(target, message) {'],
    ['_postBreakdownEmbedMessage(target, message) {', '_trustedBreakdownEmbedMessage(event, expectedSource) {'],
    ['_trustedBreakdownEmbedMessage(event, expectedSource) {', '_scheduleBreakdownEmbedReady(attempt = 0) {'],
    ['_postPendingBreakdownSplitReveal() {', '_queueBreakdownSplitReveal(command = {}) {'],
    ['_queueBreakdownSplitReveal(command = {}) {', '_syncBreakdownSplitScene(sceneNumber, scene = {}) {'],
    ['_handleBreakdownEmbedMessage = (event) => {', '_retryBreakdownScriptFrame() {'],
  ], {
    window: windowStub,
    document: { documentElement: { lang: 'en' } },
    URLSearchParams,
    clearTimeout: () => {},
  });
  const instance = new Harness();
  instance.state = {
    activeScriptId: 'scr_1',
    breakdownSplitSession: 'session_new',
    workMode: 'breakdown',
    breakdownSplitView: true,
    breakdownSplitLoaded: false,
    breakdownSceneIndex: 0,
  };
  instance._activeScriptId = 'scr_1';
  instance._breakdownScriptFrame = { contentWindow: frameWindow };
  instance._normalizeBreakdownCategoryKey = (key) => String(key || 'notes');
  instance._breakdownSceneAt = () => ({ title: 'INT. ROOM - DAY' });
  instance._toast = () => {};
  instance.setState = (patch) => {
    const update = typeof patch === 'function' ? patch(instance.state) : patch;
    Object.assign(instance.state, update || {});
  };

  instance._queueBreakdownSplitReveal({ sceneNumber: 1, references: ['first'], label: 'First' });
  const firstRequestId = instance._latestBreakdownSplitRequestId;
  instance._queueBreakdownSplitReveal({ sceneNumber: 2, references: ['second'], label: 'Second' });
  const secondRequestId = instance._latestBreakdownSplitRequestId;
  assert.notEqual(firstRequestId, secondRequestId);
  assert.equal(sent.length, 0, 'pre-ready clicks must stay queued');

  const ready = {
    channel: instance._breakdownEmbedChannel(),
    scriptId: 'scr_1',
    session: 'session_new',
    type: 'ready',
  };
  instance._handleBreakdownEmbedMessage({ origin: 'https://evil.test', source: frameWindow, data: ready });
  instance._handleBreakdownEmbedMessage({ origin: 'https://filmscript.test', source: {}, data: ready });
  instance._handleBreakdownEmbedMessage({ origin: 'https://filmscript.test', source: frameWindow, data: { ...ready, scriptId: 'scr_other' } });
  instance._handleBreakdownEmbedMessage({ origin: 'https://filmscript.test', source: frameWindow, data: { ...ready, session: 'session_old' } });
  assert.equal(instance._breakdownSplitReady, undefined);
  assert.equal(sent.length, 0);

  instance._handleBreakdownEmbedMessage({ origin: 'https://filmscript.test', source: frameWindow, data: ready });
  assert.equal(instance._breakdownSplitReady, true);
  assert.equal(instance.state.breakdownSplitLoaded, false, 'loader remains until positioning acknowledgement');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].origin, 'https://filmscript.test');
  assert.equal(sent[0].message.requestId, secondRequestId);
  assert.deepEqual(Array.from(sent[0].message.references), ['second']);
  assert.equal(sent[0].message.session, 'session_new');

  instance._handleBreakdownEmbedMessage({
    origin: 'https://filmscript.test', source: frameWindow,
    data: { ...ready, type: 'revealed', requestId: firstRequestId, found: true, exact: true, label: 'First' },
  });
  assert.equal(instance._pendingBreakdownSplitReveal.requestId, secondRequestId, 'stale acknowledgement must not clear the latest click');
  instance._handleBreakdownEmbedMessage({
    origin: 'https://filmscript.test', source: frameWindow,
    data: { ...ready, type: 'revealed', requestId: secondRequestId, found: true, exact: true, label: 'Second' },
  });
  assert.equal(instance._pendingBreakdownSplitReveal, null);
  assert.equal(instance.state.breakdownSplitLoaded, true);
});

test('Split click branch dynamically stays in Breakdown without switching work modes', async () => {
  const [editor] = await readSources();
  const scheduled = [];
  const Harness = compileHarness(editor, [
    ['async openBreakdownReference(sceneNumber, categoryKey, references, label, context = {}) {', 'async openCastReference(appearances, name) {'],
  ], {
    window: { setTimeout: (callback) => { scheduled.push(callback); return scheduled.length; } },
  });
  const instance = new Harness();
  let switches = 0;
  instance.state = { breakdownEditing: true };
  instance.setState = (patch) => Object.assign(instance.state, patch);
  instance._queueBreakdownSplitReveal = () => true;
  instance.switchWorkMode = async () => { switches += 1; };
  await instance.openBreakdownReference(3, 'cast', ['MARA'], 'Mara', { sceneId: 'scene_3' });
  assert.equal(switches, 0);
  assert.equal(instance.state.breakdownEditing, false);

  const fallback = new Harness();
  let fallbackSwitches = 0;
  fallback.state = { breakdownEditing: true };
  fallback.setState = (patch) => Object.assign(fallback.state, patch);
  fallback._queueBreakdownSplitReveal = () => false;
  fallback.switchWorkMode = async (mode) => {
    fallbackSwitches += 1;
    assert.equal(mode, 'editor');
  };
  fallback.jumpScene = () => {};
  fallback._highlightBreakdownReference = () => true;
  fallback._toast = () => {};
  await fallback.openBreakdownReference(4, 'props', ['KEY'], 'Key', { sceneId: 'scene_4' });
  assert.equal(fallbackSwitches, 1, 'outside Split View the existing editor navigation remains active');
  assert.equal(scheduled.length, 1);
});

test('Split View preserves cover blocks without rendering or inventing a title page', async () => {
  const [editor] = await readSources();
  assert.match(editor, /_refreshBreakdownEmbedCoverPrefix\(blocks\)/);
  assert.match(editor, /this\._refreshBreakdownEmbedCoverPrefix\(this\._importedBlocks\)/);
  assert.match(editor, /this\._refreshBreakdownEmbedCoverPrefix\(blocks\);\s*this\._importedBlocks = blocks/);
  assert.match(editor, /if \(this\._isBreakdownEmbed\) \{\s*\/\/ Split view hides title-page UI/s);
  assert.match(editor, /return \[\.\.\.\(this\._breakdownEmbedCoverPrefix \|\| \[\]\)\.map/);
  assert.match(editor, /tpEnabled: !this\._isBreakdownEmbed/);
  assert.match(editor, /cover\.hasCover\s*\?\s*list\.slice/);
  assert.match(editor, /:\s*\[\];/);

  const Harness = compileHarness(editor, [
    ['_coverMeta(blocks) {', '_coverBlocksFromState() {'],
    ['_refreshBreakdownEmbedCoverPrefix(blocks) {', 'async _loadImportedScript() {'],
    ['_scriptBlocksForSave() {', '_scriptRecoveryKey(scriptId = this.state.activeScriptId || this._activeScriptId) {'],
  ]);
  const instance = new Harness();
  instance._isBreakdownEmbed = true;
  instance.state = {};
  instance._collectEditorBlocks = () => [{ id: 'scene_edited', type: 'scene', text: 'INT. ROOM - NIGHT' }];
  const originalPrefix = [
    { id: 'title_1', type: 'title', text: 'Original title', metadata: { untouched: true } },
    { id: 'credit_1', type: 'title_credit', text: 'Written by' },
    { id: 'break_1', type: 'pagebreak', text: '' },
  ];
  instance._refreshBreakdownEmbedCoverPrefix([
    ...originalPrefix,
    { id: 'scene_1', type: 'scene', text: 'INT. ROOM - DAY' },
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(instance._scriptBlocksForSave())),
    [...originalPrefix, { id: 'scene_edited', type: 'scene', text: 'INT. ROOM - NIGHT' }],
  );

  instance._refreshBreakdownEmbedCoverPrefix([{ id: 'scene_1', type: 'scene', text: 'INT. ROOM - DAY' }]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(instance._scriptBlocksForSave())),
    [{ id: 'scene_edited', type: 'scene', text: 'INT. ROOM - NIGHT' }],
  );
});

test('Scene resolver dynamically uses the numbered duplicate and rejects ambiguous stale fallbacks', async () => {
  const [editor] = await readSources();
  const one = { sceneNo: 1, text: 'INT. OFFICE - DAY' };
  const two = { sceneNo: 2, text: 'INT. OFFICE - DAY' };
  const three = { sceneNo: 3, text: 'EXT. PARK - NIGHT' };
  const headings = [one, two, three];
  const documentStub = {
    querySelectorAll: (selector) => selector === '[data-scene-no]' ? headings : [],
    querySelector: (selector) => {
      const match = selector.match(/^\[data-scene-no="(\d+)"\]$/);
      if (match) return headings.find((heading) => heading.sceneNo === Number(match[1])) || null;
      return null;
    },
  };
  const Harness = compileHarness(editor, [
    ['_normalizeBreakdownHeadingText(value) {', '_findBreakdownSceneHeading(sceneNumber, expectedHeading = \'\') {'],
    ['_findBreakdownSceneHeading(sceneNumber, expectedHeading = \'\') {', '_performBreakdownEmbedReveal(command, attempt = 0) {'],
  ], { document: documentStub });
  const instance = new Harness();
  instance._blockTextWithoutMarkers = (node) => node.text;
  assert.equal(instance._findBreakdownSceneHeading(2, 'INT. OFFICE - DAY'), two);
  assert.equal(instance._findBreakdownSceneHeading(9, 'INT. OFFICE - DAY'), null);
  assert.equal(instance._findBreakdownSceneHeading(9, 'EXT. PARK'), three);
});

test('Breakdown reference ranges can span screenplay blocks and page boundaries', async () => {
  const [editor] = await readSources();
  const firstRoot = { textNodes: [] };
  const secondRoot = { textNodes: [] };
  const firstText = { data: 'MARA picks up the', parentElement: { closest: () => null } };
  const secondText = { data: ' RED TELEPHONE.', parentElement: { closest: () => null } };
  firstRoot.textNodes = [firstText];
  secondRoot.textNodes = [secondText];
  const createdRanges = [];
  const documentStub = {
    createTreeWalker: (root) => {
      let index = 0;
      return { nextNode: () => root.textNodes[index++] || null };
    },
    createRange: () => {
      const range = {
        setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
        setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
      };
      createdRanges.push(range);
      return range;
    },
  };
  const Harness = compileHarness(editor, [
    ['_breakdownSearchableText(value) {', '_findBreakdownTextRangesAcrossBlocks(blocks, reference) {'],
    ['_findBreakdownTextRangesAcrossBlocks(blocks, reference) {', '_findBreakdownTextRanges(block, reference) {'],
  ], {
    document: documentStub,
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
  });
  const ranges = new Harness()._findBreakdownTextRangesAcrossBlocks(
    [firstRoot, secondRoot],
    'the red telephone',
  );
  assert.equal(ranges.length, 1);
  assert.equal(createdRanges.length, 1);
  assert.equal(ranges[0].startContainer, firstText);
  assert.equal(ranges[0].startOffset, 14);
  assert.equal(ranges[0].endContainer, secondText);
  assert.equal(ranges[0].endOffset, 14);
});

test('Nested Breakdown controls keep their own keyboard activation', async () => {
  const [, workspace] = await readSources();
  assert.match(workspace, /event\.target !== link && event\.target\.closest\?\.\('button,input,textarea,select,label,\[contenteditable="true"\]'\)/);
  assert.match(workspace, /if \(event\.key !== 'Enter' && event\.key !== ' '\) return/);
  assert.match(workspace, /this\.openScriptReference\(link\.dataset\.sceneId/);
});
