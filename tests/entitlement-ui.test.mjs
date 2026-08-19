import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("preproduction access copy is English and explains post-cancellation ownership", async () => {
  const [editor, scripts, subscription] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "App.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "Subscription.dc.html"), "utf8"),
  ]);

  const source = `${editor}\n${scripts}`;
  for (const spanishCopy of [
    "Convierte tu guion",
    "Analiza automáticamente",
    "Organiza tu rodaje",
    "Primero necesitamos entender",
    "Planifica cómo se verá",
    "Genera automáticamente propuestas",
  ]) assert.equal(source.includes(spanishCopy), false, `unexpected Spanish UI copy: ${spanishCopy}`);

  assert.equal(/free question/i.test(source), false);
  assert.match(editor, /Your existing production work stays yours\./);
  assert.match(editor, /remain available to edit and export/);
  assert.match(subscription, /1,000 image credits/);
  assert.match(subscription, /FilmScript Full/);
  assert.match(subscription, /editable and exportable/);
});

test("Breakdown begins with a clear manual-or-Lumiere choice", async () => {
  const [editor, client, server] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "preproduction-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
  ]);

  assert.match(editor, /Build the breakdown your way\./);
  assert.match(editor, /Start manual breakdown/);
  assert.match(editor, /Analyze with Lumiere/);
  assert.match(editor, /startManualBreakdown/);
  assert.match(editor, /breakdownStartVisible/);
  assert.match(editor, /v5-breakdown-start-card/);
  assert.match(client, /createManualBreakdown/);
  assert.match(server, /handleManualBreakdown/);
  assert.match(server, /generated: 'manual'/);
  assert.match(server, /source: 'manual'/);
  assert.match(editor, /Generate with Lumiere/);
  assert.match(editor, /generateManualBreakdownWithLumiere/);
  assert.match(editor, /Generating your full breakdown/);
  assert.match(editor, /breakdownGenerationPercent/);
  assert.match(editor, /manualGenerationFinished/);
  assert.match(client, /includeManual === true/);
  assert.match(server, /preserveManualBreakdownForm/);
  assert.match(server, /sceneNeedsBreakdown\(scene, \{ includeManual \}\)/);
});

test("local preview renews only its own Lumiere session after a server restart", async () => {
  const server = await fs.readFile(path.join(ROOT, "server.js"), "utf8");
  assert.match(server, /PREVIEW_LUMIERE_SESSION_STARTED_AT/);
  assert.match(server, /previewCredits\.session = \{/);
  assert.match(server, /credits\[PREVIEW_USER_ID\] = previewCredits/);
  assert.match(server, /Restarting the local preview should make it possible to verify the real/);
});

test("Plan and billing uses a concise section heading without repeating the plan name", async () => {
  const subscription = await fs.readFile(path.join(ROOT, "Subscription.dc.html"), "utf8");
  assert.match(subscription, /<div class="eyebrow">Membership<\/div>/);
  assert.match(subscription, /<h1>Plan &amp; billing<\/h1>/);
  assert.doesNotMatch(subscription, /<h1>FilmScript Pro<\/h1>/);
});

test("legacy one-off resets are retired in favor of subscription image credits", async () => {
  const [editor, billing, server] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "billing-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
  ]);
  assert.doesNotMatch(editor, /Buy extra credits · \$5/);
  assert.doesNotMatch(editor, /Reset your Lumiere limits for \$5/);
  assert.match(billing, /\/api\/credits\/checkout/);
  assert.match(billing, /\/api\/credits\/confirm/);
  assert.match(server, /legacy_credit_reset_retired/);
  assert.match(server, /Creator includes 100 image credits and Full includes 1,000 per billing cycle/);
});

test("credits expose Free grants, Creator text limits, and Full image credits", async () => {
  const [editor, language, server, billing, indicator, app, pricing, features, subscription] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "language-preference.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "billing-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "credit-indicator.js"), "utf8"),
    fs.readFile(path.join(ROOT, "App.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "Pricing.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "Features.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "Subscription.dc.html"), "utf8"),
  ]);
  assert.match(server, /free: Object\.freeze\(\{ session: 5, week: 5, month: 5, lifetime: true \}\)/);
  assert.match(server, /creator: Object\.freeze\(\{ session: 75, week: 250, month: 600 \}\)/);
  assert.match(server, /full: Object\.freeze\(\{ session: 150, week: 500, month: 1200 \}\)/);
  assert.match(server, /LUMIERE_CREDIT_SESSION_MS = 8 \* 60 \* 60 \* 1000/);
  assert.match(server, /IMAGE_CREDITS_PER_FULL_CYCLE = 1000/);
  assert.match(server, /IMAGE_CREDITS_PER_CREATOR_CYCLE = 100/);
  assert.match(server, /OPENAI_STORYBOARD_CREDIT_COST = 3/);
  assert.match(server, /FREE_FEATURE_ALLOWANCES = Object\.freeze\(\{ analysis: 1, breakdown: 1, storyboard: 1 \}\)/);
  assert.match(server, /function imageGenerationAccess\(userId\)/);
  assert.match(server, /function reserveImageCredits\(userId, amount = OPENAI_STORYBOARD_CREDIT_COST\)/);
  assert.match(server, /function settleImageCreditReservation/);
  assert.match(server, /function refundImageCreditReservation/);
  assert.match(server, /function consumeFreeAllowance\(userId, feature\)/);
  assert.match(server, /blockedBy/);
  assert.match(editor, /data-testid="credits-usage-panel"/);
  assert.match(editor, /creditUsageRows/);
  assert.match(editor, /creditsFreeAllowanceLabel/);
  assert.match(editor, /creditsAvailableLabel/);
  assert.match(language, /Full incluye 1,000 créditos de imagen/);
  assert.match(billing, /credits: \(\) => api\('\/api\/credits'\)/);
  assert.match(indicator, /fs-avatar-credit/);
  assert.match(indicator, /image\?\.remaining/);
  assert.match(indicator, /fs-profile-credit-track/);
  assert.match(indicator, /fs-profile-credit-fill/);
  assert.match(indicator, /decorateProfilePanels/);
  assert.match(indicator, /data-filmscript-profile-panel/);
  assert.match(indicator, /3 credits per image/);
  assert.doesNotMatch(indicator, /fs-profile-credit-dot/);
  assert.doesNotMatch(indicator, /% credits available/);
  for (const source of [editor, app, pricing, features, subscription]) {
    assert.match(source, /credit-indicator\.js\?v=[^"']+/);
  }
});

test("Scene heading picker follows the interface language", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  assert.match(editor, /window\.filmscriptLanguage\?\.get\?\.\(\)/);
  assert.match(editor, /\['DAWN', 'MORNING', 'AFTERNOON', 'SUNSET', 'NIGHT'\]/);
  assert.match(editor, /\['MADRUGADA', 'MAÑANA', 'TARDE', 'ATARDECER', 'NOCHE'\]/);
  assert.match(editor, /\bNIGHT\|DAY\|DAWN\|MORNING\|AFTERNOON\|SUNSET/);
  assert.match(editor, /defaultTime = String\(language\)\.toLowerCase\(\)\.startsWith\('es'\) \? 'MAÑANA' : 'MORNING'/);
});

test("Account details stays in the foreground above editor chrome", async () => {
  const [editor, scripts] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "App.dc.html"), "utf8"),
  ]);

  for (const source of [editor, scripts]) {
    assert.match(source, /data-testid="account-details-overlay"/);
    assert.match(source, /z-index:\s*1200/);
    assert.match(source, /isolation:\s*isolate/);
    assert.match(source, /data-testid="account-details-panel"[^>]+style="[^\"]*z-index:\s*1/);
  }
  assert.match(editor, /inset: 0; z-index: 1200; isolation: isolate/);
  assert.match(editor, /padding: 66px 24px 22px/);
});

test("subscription cancellation uses distinct close and profile-menu sounds", async () => {
  const [subscription, sounds, cancelAsset] = await Promise.all([
    fs.readFile(path.join(ROOT, "Subscription.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "ui-sounds.js"), "utf8"),
    fs.stat(path.join(ROOT, "assets", "sfx", "stripboard-selection-exit.mp3")),
  ]);

  assert.match(sounds, /cancelPro:\s*\{\s*src:\s*'\.\/assets\/sfx\/stripboard-selection-exit\.mp3'/);
  assert.equal((subscription.match(/playSound\('cancelPro'\)/g) || []).length, 2);
  assert.ok((subscription.match(/playSound\('profileOption'\)/g) || []).length >= 3);
  assert.match(subscription, /preload\('cancelPro'\)/);
  assert.match(subscription, /preload\('profileOption'\)/);
  assert.ok(cancelAsset.size > 0);
});

test("the editor cover exposes directly editable title and writing credits", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");

  assert.match(editor, /data-testid="cover-title-input"[^>]+onInput="\{\{ onTpTitle \}\}"/);
  assert.match(editor, /data-testid="cover-credit-input"[^>]+onInput="\{\{ onTpCredit \}\}"/);
  assert.match(editor, /data-testid="cover-author-input"[^>]+onInput="\{\{ onTpAuthor \}\}"/);
  assert.match(editor, /\.v5-cover-field:focus\s*\{[^}]*var\(--accent/);
});

test("the screenplay cover anchors date and contact at the lower left", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  assert.match(editor, /class="v5-cover-meta" data-testid="cover-meta"/);
  assert.match(editor, /\.v5-cover-meta \{ position: absolute; left: 120px; bottom: 96px;/);
  assert.match(editor, /<div class="tpmeta">/);
  assert.match(editor, /\.tp \.tpmeta \{ position: absolute; left: 25\.4mm; bottom: 25\.4mm;/);
});

test("New script creates a blank account-owned screenplay instead of opening demo content", async () => {
  const [app, editor, client, server] = await Promise.all([
    fs.readFile(path.join(ROOT, "App.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "scripts-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
  ]);

  assert.match(app, /newScript: \(\) => this\.createNewScript\(\)/);
  assert.match(app, /window\.filmscriptScripts\.create\('Untitled screenplay'\)/);
  assert.match(app, /Editor v5\.dc\.html\?script=\$\{encodeURIComponent\(script\.id\)\}/);
  assert.match(client, /create: \(title = 'Untitled screenplay'\)/);
  assert.match(server, /pathname === "\/api\/scripts"/);
  assert.match(server, /source: "new"/);
  assert.match(server, /blocks: \[\]/);
  assert.match(editor, /stored\.source === 'new' \? \[\]/);
});

test("Scripts puts the most recently edited screenplay in the first card", async () => {
  const app = await fs.readFile(path.join(ROOT, "App.dc.html"), "utf8");
  assert.match(app, /const orderedImportedScripts = \[\.\.\.this\.state\.importedScripts\]\.sort/);
  assert.match(app, /Date\.parse\(script\.updatedAt \|\| script\.createdAt/);
  assert.match(app, /return timeOf\(b\) - timeOf\(a\)/);
  assert.match(app, /\.\.\.orderedImportedScripts\.map/);
});

test("Scripts buttons use dedicated import and new-script sounds", async () => {
  const [app, sounds] = await Promise.all([
    fs.readFile(path.join(ROOT, "App.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "ui-sounds.js"), "utf8"),
  ]);
  assert.match(app, /window\.filmscriptSounds\?\.play\('importScript'\)/);
  assert.match(app, /window\.filmscriptSounds\?\.play\('createNewScript'\)/);
  assert.match(sounds, /createNewScript: \{ src: '\.\/assets\/sfx\/create-new-script\.mp3'/);
  assert.match(sounds, /importScript: \{ src: '\.\/assets\/sfx\/import-script\.mp3'/);
});

test("Editor entry uses the dedicated typewriter bell sound", async () => {
  const [editor, sounds] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "ui-sounds.js"), "utf8"),
  ]);
  assert.match(editor, /this\._playWorkModeSound\('editor'\)/);
  assert.match(editor, /mode === 'editor' \? 'editorEnter'/);
  assert.match(sounds, /editorEnter: \{ src: '\.\/assets\/sfx\/filmscript-brand-bell\.wav'/);
});

test("Scripts is the first editor work-navigation control", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  const navigationStart = editor.indexOf('<div class="v5-work-modes"');
  const scriptsButton = editor.indexOf('aria-label="Go to scripts">Scripts</button>', navigationStart);
  const workModesLoop = editor.indexOf('<sc-for list="{{ workModes }}"', navigationStart);

  assert.ok(navigationStart >= 0);
  assert.ok(scriptsButton > navigationStart);
  assert.ok(workModesLoop > scriptsButton);
});

test("Character entry remembers screenplay names without a search field or reversed typing", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  const pickerStart = editor.indexOf('<sc-if value="{{ characterPickerOpen }}"');
  const pickerEnd = editor.indexOf('<div class="v5tipwrap" onMouseDown="{{ eatMouse }}" onClick="{{ fmtParen }}"', pickerStart);
  const picker = editor.slice(pickerStart, pickerEnd);
  const inputHandlerStart = editor.indexOf('  _onEditorInput() {');
  const inputHandlerEnd = editor.indexOf('  _normalizeSceneHeading(block) {', inputHandlerStart);
  const inputHandler = editor.slice(inputHandlerStart, inputHandlerEnd);

  assert.match(picker, /Characters in this script/);
  assert.match(picker, /characterPickerNames/);
  assert.match(picker, /aria-label="Characters in this script"/);
  assert.match(picker, /data-character-name="\{\{ character\.label \}\}" onClick="\{\{ chooseCharacterFromPicker \}\}"/);
  assert.doesNotMatch(picker, /<input|CHARACTER NAME|Use character/);
  assert.doesNotMatch(inputHandler, /_normalizeCharacterName\(block\)/);
  assert.match(editor, /type === 'character' \? text\.toLocaleUpperCase\('en-US'\) : text/);
  assert.match(editor, /const names = this\._characterNamesFromEditor\(block\);/);
  assert.match(editor, /if \(type === 'character'\) this\._openCharacterPickerMenu\(characterNames, currentBlock\);/);
  assert.match(editor, /chooseCharacterFromPicker\(event\) \{/);
  assert.match(editor, /const block = this\._characterPickerBlock\?\.isConnected \? this\._characterPickerBlock : this\._currentBlock\(\);/);
  assert.match(editor, /character: 'margin-left:211px;[^']*text-transform:uppercase;direction:ltr;unicode-bidi:plaintext;'/);
});

test("Analysis entry uses the dedicated open sound", async () => {
  const [editor, sounds] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "ui-sounds.js"), "utf8"),
  ]);
  assert.match(editor, /this\._playWorkModeSound\('analysis'\)/);
  assert.match(editor, /mode === 'analysis' \? 'analysisEnter'/);
  assert.match(sounds, /analysisEnter: \{ src: '\.\/assets\/sfx\/analysis-enter-open\.mp3'/);
});

test("Breakdown entry uses the dedicated breakdown sound", async () => {
  const [editor, sounds] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "ui-sounds.js"), "utf8"),
  ]);
  assert.match(editor, /mode === 'breakdown' \? 'breakdownEnter'/);
  assert.match(sounds, /breakdownEnter: \{ src: '\.\/assets\/sfx\/import-script\.mp3'/);
});

test("Breakdown uses direct autosaving edits without an Edit Sheet control", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  assert.doesNotMatch(editor, /Edit sheet/i);
  assert.match(editor, /onClick="\{\{ breakdownActivateEditing \}\}"/);
  assert.match(editor, /activateBreakdownEditing\(event\)/);
  assert.match(editor, /Click any field to edit/);
  assert.match(editor, /breakdownExportDisabled: this\.state\.breakdownExporting/);
});

test("Breakdown categories keep distinct colors and open their exact screenplay evidence", async () => {
  const [editor, server] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
  ]);
  assert.match(editor, /--category-color:/);
  assert.match(editor, /v5-breakdown-entry-link/);
  assert.match(editor, /entry\.sourceExcerpt/);
  assert.match(editor, /openBreakdownReference\(breakdownSceneIndex \+ 1, key/);
  assert.match(editor, /data-breakdown-reference/);
  assert.match(editor, /v5-breakdown-reference-fallback/);
  assert.match(editor, /_breakdownReferenceColor\(categoryKey\)/);
  assert.match(editor, /const matchesByKey = new Map\(\)/);
  assert.match(editor, /_dedupeBreakdownFieldValue\(section, value\)/);
  assert.doesNotMatch(editor, /<sc-if value="\{\{ entry\.linkable \}\}"/);
  assert.match(editor, /entryClass: `v5-breakdown-entry\$\{linkable \? ' v5-breakdown-entry-link' : ' is-static'\}\$\{isVisualEntry \? ' is-visual-reference' : ''\}/);
  assert.match(server, /function dedupeBreakdownElements\(value\)/);
  assert.match(server, /elements: dedupeBreakdownElements\(elements\)/);
  assert.match(server, /"greenery"/);
  assert.match(server, /"music"/);
  assert.match(server, /Every returned element must remain grounded in an exact source excerpt/);
});

test("Breakdown canonicalizes repeated production items before display, export, or budgeting", async () => {
  const [editor, server] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
  ]);
  assert.match(editor, /const breakdownNameKey = \(value\)/);
  assert.match(editor, /existing\.quantity = options\.numbered \? 1 : Math\.max/);
  assert.match(editor, /vehicles: 'vehicles_animals'/);
  assert.match(server, /function breakdownElementNameKey\(value\)/);
  assert.match(server, /function breakdownComparisonCategory\(value\)/);
  assert.match(server, /existing\.quantity = isCast \? 1 : Math\.max\(existingQuantity, nextQuantity\)/);
});

test("Lumiere structured work requests JSON and safely recovers a missed array comma", async () => {
  const server = await fs.readFile(path.join(ROOT, "server.js"), "utf8");
  assert.match(server, /jsonMode = false/);
  assert.match(server, /const jsonInstruction = "Return one valid JSON object only\."/);
  assert.match(server, /text: \{ format: \{ type: "json_object" \} \}/);
  assert.match(server, /jsonMode: true/);
  assert.match(server, /model: OPENAI_TEXT_MODEL/);
  assert.match(server, /generationFailure \|\|= lumiereFailureMessage/);

  const start = server.indexOf("function extractStructuredJson(raw)");
  const end = server.indexOf("\nfunction normalizeEvidence", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const sandbox = {};
  vm.runInNewContext(`${server.slice(start, end)}\nglobalThis.parse = parseBreakdownJson;`, sandbox);
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.parse('{"elements":[{"name":"Camera"} {"name":"Slate"}]}'))),
    { elements: [{ name: "Camera" }, { name: "Slate" }] },
  );
  assert.throws(
    () => sandbox.parse('{"elements":[{"name":"Camera"}'),
    /Lumiere returned incomplete structured data/,
  );
});

test("Breakdown refresh exposes red or green sync state and asks Lumiere only for changed scenes", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  assert.match(editor, /v5-production-sync-dot/);
  assert.match(editor, /productionSyncState/);
  assert.match(editor, /'Up to date'/);
  assert.match(editor, /'Refresh needed'/);
  assert.match(editor, /await window\.filmscriptPreproduction\.get\(scriptId\)/);
  assert.match(editor, /needsLumiereRefresh/);
  assert.match(editor, /await window\.filmscriptPreproduction\.analyze\(scriptId\)/);
  assert.match(editor, /await this\._persistScriptBlocks\(\)/);
});

test("Theme changes use a global smooth fade transition", async () => {
  const [theme, editor] = await Promise.all([
    fs.readFile(path.join(ROOT, "theme-preference.js"), "utf8"),
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
  ]);
  assert.match(theme, /filmscript-theme-transition/);
  assert.match(theme, /filmscript-theme-fading/);
  assert.match(theme, /transition-property: color, background-color, border-color/);
  assert.match(theme, /apply\(next, true\)/);
  assert.match(editor, /<script src="\.\/theme-preference\.js/);
});

test("Story flow uses a subtle imperfect hand-drawn line", async () => {
  const analysis = await fs.readFile(path.join(ROOT, "analysis-workspace.js"), "utf8");
  assert.match(analysis, /story-flow-handdrawn/);
  assert.match(analysis, /feTurbulence type="fractalNoise"/);
  assert.match(analysis, /\.story-line\{fill:none;stroke:var\(--an-ink\);stroke-width:1\.35/);
  assert.match(analysis, /stroke-dasharray:1800;stroke-dashoffset:1800/);
});

test("Account details opens in place from the editor", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  assert.match(editor, /accountDetailsOpen: false/);
  assert.match(editor, /if \(key === 'a-account'\) this\.setState\(\{ accountDetailsOpen: true \}\)/);
  assert.match(editor, /data-testid="account-avatar"/);
  assert.doesNotMatch(editor, /profile=1&returnTo=/);
});

test("Account details includes an editable Personal profile", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  assert.match(editor, /Personal profile/);
  assert.match(editor, /saveAccountPersonalProfile/);
  assert.match(editor, /accountProfileBirthDate/);
  assert.match(editor, /accountProfileGender/);
});

test("Opening Lumiere refits the screenplay to the remaining editor width", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  assert.match(editor, /_fitEditorToAvailableWidth/);
  assert.match(editor, /lumiereOpen: true \}, \(\) => this\._fitEditorToAvailableWidth\(\)/);
  assert.match(editor, /canvas\.clientWidth - 100/);
  assert.match(editor, /v5-editor-page-area/);
});

test("Character picker excludes title cards and transitions", async () => {
  const editor = await fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8");
  assert.match(editor, /_isValidCharacterCue/);
  assert.match(editor, /TITULO\|TITLE\|ESCRITO\\s\+POR/);
  assert.match(editor, /next\?\.dataset\?\.type === 'dialogue'/);
  assert.match(editor, /_characterCueLabel/);
});

test("Story flow uses the same subtle double hand-drawn frame language", async () => {
  const analysis = await fs.readFile(path.join(ROOT, "analysis-workspace.js"), "utf8");
  assert.match(analysis, /\.flow-frame\{position:relative/);
  assert.match(analysis, /\.flow-frame::before,\.flow-frame::after/);
  assert.match(analysis, /\.flow-frame::before\{inset:3px 4px 4px 3px/);
});

test("Shot List uses the latest camera shutter sound", async () => {
  const sounds = await fs.readFile(path.join(ROOT, "ui-sounds.js"), "utf8");
  assert.match(sounds, /shotlistEnter: \{ src: '\.\/assets\/sfx\/shotlist-enter-shutter\.wav'/);
});

test("Shot List is grouped by scene, connected to Stripboard time, and supports persistent manual scenes", async () => {
  const [editor, client, server, storage, pdf] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "preproduction-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "reference-storage.js"), "utf8"),
    fs.readFile(path.join(ROOT, "shotlist_pdf.py"), "utf8"),
  ]);

  assert.match(editor, /class="v5-shotlist-scenes" role="list" aria-label="Shot list scenes"/);
  assert.match(editor, /<sc-for list="\{\{ shotListScenes \}\}" as="scene"/);
  assert.match(editor, /data-testid="shotlist-add-scene"/);
  assert.match(editor, /sourceLabel: manual \? 'Manual scene' : 'Screenplay scene'/);
  assert.match(editor, /shotListSceneSource = \[/);
  assert.match(editor, /addShotListScene\(\)/);
  assert.match(client, /addShotScene:/);
  assert.match(client, /renameShotScene:/);
  assert.match(client, /deleteShotScene:/);
  assert.match(editor, /data-testid="\{\{ scene\.referenceTestId \}\}"/);
  assert.match(editor, /Stripboard time/);
  assert.match(editor, /aria-label="Set duration for shot \{\{ shot\.number \}\}"/);
  assert.match(editor, /title="Set duration in 15-minute intervals"/);
  assert.match(editor, /_shotSceneBudget\(sceneId\)/);
  assert.match(editor, /Scene time is full/);
  assert.match(editor, /addShotDisabled: timeFull/);
  assert.match(editor, /v5-shot-reference-art/);
  assert.match(editor, /M5 33 20 17l9 10 8-8 21 14/);
  assert.doesNotMatch(editor, /class="v5-shot-reference" title="Upload reference image"><span>\+<\/span>/);
  assert.match(client, /uploadShotReference:/);
  assert.match(client, /shotReferenceUrl:/);
  assert.match(server, /manualShotScenes: cleanManualShotScenes/);
  assert.match(server, /handleManualShotListScene/);
  assert.match(server, /handleShotReferenceUpload/);
  assert.match(server, /handleShotReferenceAsset/);
  assert.match(server, /shot_time_budget_exceeded/);
  assert.match(server, /estimatedMinutes: cleanShotMinutes/);
  assert.match(server, /Production time available from Stripboard/);
  assert.match(storage, /new S3ObjectStorage\(\{ namespace: "shot-references" \}\)/);
  assert.match(pdf, /"TIME"/);
  assert.match(pdf, /MIN AVAILABLE/);
});

test("Stripboard carries the cast IDs assigned by Breakdown", async () => {
  const [editor, server, pdf] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "stripboard_pdf.py"), "utf8"),
  ]);

  assert.match(server, /function stripCastIds\(scene\)/);
  assert.match(server, /castIds: stripCastIds\(scene\)/);
  assert.match(editor, /Cast IDs from Breakdown/);
  assert.match(editor, /const castIds = castNumbers\.map/);
  assert.match(editor, /v5-strip-cast-id/);
  assert.match(editor, /v5-strip-cast-tooltip/);
  assert.match(editor, /const stripboardCastById = new Map/);
  assert.match(editor, /ariaLabel: `Open Cast \$\{number\}: \$\{castName\} in scene \$\{sceneNo\}`/);
  assert.match(editor, /Most recently used/);
  assert.match(editor, /const recentShootLocation = shootLocationLibrary\[0\]/);
  assert.match(editor, /Other saved locations/);
  assert.match(editor, /Shoot location/);
  assert.match(editor, /Start time/);
  assert.match(editor, /minmax\(220px, 1\.55fr\) 80px 112px minmax\(140px, \.95fr\) 58px 76px 80px 40px/);
  assert.match(editor, /startTimeLabel = scheduleKnown \? formatClock/);
  assert.match(editor, /Estimated time/);
  assert.match(editor, /Est\. time…/);
  assert.match(editor, /const sceneNo = sceneNumberById\.get\(scene\.id\) \|\| sceneIndex \+ 1;/);
  assert.match(editor, /estimatedTimeAriaLabel: hasSavedEstimate \? `Edit estimated time for scene \$\{sceneNo\}` : 'Est\. time…'/);
  assert.match(editor, /data-testid="stripboard-time-popover"/);
  assert.match(editor, /aria-label="Increase minutes by 15"/);
  assert.match(editor, /Exact duration/);
  assert.match(editor, /stripboardTimeAnchorLeft/);
  assert.match(editor, /let scheduleKnown = true/);
  assert.match(editor, /startTimeLabel = scheduleKnown \? formatClock\(currentMinutes\) : 'Pending'/);
  assert.match(editor, /stripboardLocationPopoverSceneId/);
  assert.match(editor, /const shootLocation = savedLocation \|\| 'Assign'/);
  assert.match(editor, /Real-world location/);
  assert.match(editor, /Other saved locations/);
  assert.match(editor, /assignStripboardLocation\(sceneId, location\)/);
  assert.match(editor, /data-testid="stripboard-bulkbar"/);
  assert.match(editor, /stripboardSelectedSceneIds/);
  assert.match(editor, /toggleStripboardSelectAll\(\)/);
  assert.match(editor, /applyStripboardBulkLocation\(/);
  assert.match(editor, /applyStripboardBulkCast\(\)/);
  assert.doesNotMatch(editor, /const breakdownLocation =/);
  assert.match(server, /function cleanShootLocations\(value\)/);
  assert.match(server, /function cleanStripCastIds\(value\)/);
  assert.match(server, /shootLocations: cleanShootLocations/);
  assert.match(server, /body\.sceneLocations/);
  assert.match(server, /cleanShootLocations\(\[location, \.\.\.\(project\.shootLocations \|\| \[\]\)\]\)/);
  assert.match(server, /body\.sceneCastIds/);
  assert.match(server, /delete strip\.estimatedMinutes/);
  assert.match(pdf, /CAST IDs/);
  assert.match(pdf, /SHOOT LOCATION/);
  assert.match(pdf, /row\.get\("shootLocation"\)/);
  assert.match(pdf, /row\.get\("castIds"\)/);
});

test("budget view navigation reuses the editor format-control sound", async () => {
  const budget = await fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8");

  assert.match(budget, /preload\('formatControl'\)/);
  assert.match(budget, /if \(nextView === this\.view\) return;/);
  assert.match(budget, /filmscriptSounds\?\.play\('formatControl'\)/);
});

test("budget tables align labels, financial values, and actions by column", async () => {
  const budget = await fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8");

  assert.match(budget, /class="summary-table"/);
  assert.match(budget, /\.summary-table thead th:nth-child\(n\+3\),\.summary-table tbody td:nth-child\(n\+3\)\{text-align:right\}/);
  assert.match(budget, /\.breakdown-table th:nth-child\(13\).*text-align:center/);
  assert.match(budget, /\.breakdown-table th:nth-child\(12\).*min-width:126px;width:126px/);
  assert.match(budget, /\.breakdown-table td:nth-child\(12\).*white-space:nowrap/);
  assert.match(budget, /\.funding-table th:nth-child\(3\).*text-align:right/);
  assert.match(budget, /\.expense-table th:nth-child\(n\+6\).*text-align:right/);
  assert.match(budget, /\.tax-table th:nth-child\(2\).*text-align:right/);
  assert.match(budget, /input\[type="number"\]\{text-align:right/);
  assert.match(budget, /-webkit-appearance:none!important;appearance:textfield/);
  assert.match(budget, /::-webkit-inner-spin-button.*display:none!important/);
});

test("budget motion is snappy, intentional, and reduced-motion safe", async () => {
  const budget = await fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8");

  assert.match(budget, /this\._animateView = true/);
  assert.match(budget, /querySelector\('\.view'\)\?\.classList\.add\('is-entering'\)/);
  assert.match(budget, /querySelector\('\.tabs button\[aria-pressed="true"\]'\)\?\.classList\.add\('is-switching'\)/);
  assert.match(budget, /\.view\{animation:none\}\.view\.is-entering\{animation:budgetViewIn \.18s/);
  assert.match(budget, /\.modal-backdrop\.is-entering\{animation:budgetBackdropIn \.14s/);
  assert.match(budget, /@media\(prefers-reduced-motion:reduce\).*animation:none!important/);
});

test("budget exposes a weekly Cash Flow connected to Breakdown schedules and Stripboard context", async () => {
  const [budget, model, server, pdf] = await Promise.all([
    fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "budget-model.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "budget_pdf.py"), "utf8"),
  ]);

  assert.match(budget, /\['cashflow', 'Cash Flow'\]/);
  assert.match(budget, /if \(this\.view === 'cashflow'\) content = this\.renderCashFlow\(computed\)/);
  assert.match(budget, /Script Breakdown → Stripboard → Budget Schedule/);
  assert.match(budget, /Weekly Cash Ledger/);
  assert.match(budget, /data-action="auto-schedule"/);
  assert.match(budget, /data-action="clear-schedule"/);
  assert.match(budget, /Connect Production Calendar dates to compare actual payments by week/);
  assert.match(model, /scheduleCashTotals/);
  assert.match(model, /scheduleInKindTotals/);
  assert.match(model, /unscheduledCashTotal/);
  assert.match(server, /source: "script_breakdown_stripboard"/);
  assert.match(server, /shootWeekDetails/);
  assert.match(pdf, /heading\(labels\["weeklyTiming"\], labels\["cashFlow"\]/);
  assert.match(pdf, /WEEKLY CASH LEDGER/);
  assert.doesNotMatch(pdf, /PLANNED CASH FLOW/);
});

test("budget export follows the selected FilmScript language", async () => {
  const [client, workspace, server, pdf] = await Promise.all([
    fs.readFile(path.join(ROOT, "budget-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "budget_pdf.py"), "utf8"),
  ]);

  assert.match(client, /exportUrl: \(scriptId, language = 'en'\)/);
  assert.match(client, /lang=\$\{encodeURIComponent\(normalizedLanguage\)\}/);
  assert.match(workspace, /filmscriptLanguage\?\.get\?\.\(\) \|\| document\.documentElement\.lang/);
  assert.match(workspace, /exportUrl\(this\.scriptId, language\)/);
  assert.match(server, /searchParams\.get\("lang"\)/);
  assert.match(server, /budgetPdfPayload\(script, budget, productionSchedule, language\)/);
  assert.match(server, /language: normalizeLumiereLanguage\(language\)/);
  assert.match(pdf, /TRANSLATIONS =/);
  assert.match(pdf, /"budget": "Presupuesto"/);
  assert.match(pdf, /"budgetBreakdown": "Desglose del presupuesto"/);
  assert.match(pdf, /translations\(payload\.get\("language"\)\)/);
});

test("budget navigation leads with Quick View, Breakdown, then Summary", async () => {
  const budget = await fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8");
  const quick = budget.indexOf("['quick', 'Quick View']");
  const breakdown = budget.indexOf("['breakdown', 'Breakdown']");
  const summary = budget.indexOf("['summary', 'Summary']");
  const finance = budget.indexOf("['finance', 'Finance']");
  const expenses = budget.indexOf("['expenses', 'Expenses']");
  const settings = budget.indexOf("['settings', 'Settings']");
  assert.ok(quick >= 0 && quick < breakdown && breakdown < summary && summary < finance && finance < expenses && expenses < settings);
});

test("budget prioritizes active data and presents empty states without empty tables", async () => {
  const [budget, editor] = await Promise.all([
    fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
  ]);

  assert.match(budget, /this\.showAllAccounts = false/);
  assert.match(budget, /activeAccounts = computed\.accounts\.filter/);
  assert.match(budget, /this\.openAccounts = new Set/);
  assert.match(budget, /const isOpen = Boolean\(query\) \|\| this\.openAccounts\.has/);
  assert.match(budget, /Funding Surplus/);
  assert.match(budget, /class="panel cashflow-empty"/);
  assert.match(budget, /class="panel ledger-empty"/);
  assert.match(budget, /this\.updateModelInput\(input, false\)/);
  assert.match(budget, /syncStatusText\(\)/);
  assert.doesNotMatch(budget, /onclick="event\.stopPropagation\(\)"/);
  assert.match(budget, /event\.target\.classList\?\.contains\('modal-backdrop'\)/);
  assert.match(editor, /productionHeaderVisible: workMode !== 'budget'/);
});

test("work modes, narrative Analysis, and prominent budget totals animate without ignoring reduced motion", async () => {
  const [editor, analysis, budget] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "analysis-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8"),
  ]);

  assert.match(editor, /class="v5-editor-workspace"/);
  assert.match(editor, /@keyframes v5-mode-panel-in/);
  assert.match(editor, /_restartWorkModeMotion/);
  assert.match(editor, /void panel\.offsetWidth/);
  assert.match(editor, /prefers-reduced-motion: reduce[\s\S]*\.v5-production-shell/);
  assert.match(analysis, /this\._animateEntry = true/);
  assert.match(analysis, /class="workspace\$\{shouldAnimateEntry \? ' is-entering' : ''\}"/);
  assert.match(analysis, /class="analysis-focus-grid/);
  assert.match(analysis, /class="signal-card/);
  assert.match(analysis, /class="analysis-drawer/);
  assert.match(analysis, /Story flow/);
  assert.match(analysis, /Scene explorer/);
  assert.match(analysis, /contextual-assistant/);
  assert.match(analysis, /@keyframes analysisCardIn/);
  assert.match(analysis, /@keyframes draw/);
  assert.match(analysis, /--analysis-entry-delay/);
  assert.doesNotMatch(analysis, /Dialogue \/ Action/);
  assert.doesNotMatch(analysis, /Genre & Tone/);
  assert.doesNotMatch(analysis, /Top Moments/);
  assert.match(analysis, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(budget, /data-budget-count/);
  assert.match(budget, /animateMoneyValues\(\)/);
  assert.match(budget, /@keyframes budgetDonutLoad/);
  assert.match(budget, /prefers-reduced-motion:\s*reduce/);
});

test("Analysis uses one Lumiere insights contract with screenplay evidence and production context", async () => {
  const [analysis, server, pdf, editor] = await Promise.all([
    fs.readFile(path.join(ROOT, "analysis-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "analysis_pdf.py"), "utf8"),
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
  ]);

  assert.match(server, /SCRIPT_ANALYSIS_REVISION = 4/);
  assert.match(server, /"overview"/);
  assert.match(server, /"storyClarity"/);
  assert.match(server, /"storyFlow"/);
  assert.match(server, /"productionOverview"/);
  assert.match(server, /referenceText/);
  assert.match(server, /sourceText\.includes\(evidence\)/);
  assert.match(server, /deep: exportableDeep/);
  assert.match(analysis, /What’s working/);
  assert.match(analysis, /Scenes that need attention/);
  assert.match(analysis, /productionImpactPanel/);
  assert.match(analysis, /Production impact/);
  assert.match(analysis, /High complexity scenes/);
  assert.ok(analysis.indexOf('${this.analysisFocusPanel(data, stale, deepReady)}') < analysis.indexOf('${this.storyFlowPanel(data, stale)}'), 'Lumiere focus should lead Story Flow');
  assert.ok(analysis.indexOf('${this.storyFlowPanel(data, stale)}') < analysis.indexOf('${this.storyClarityPanel(data, stale)}'), 'Story Flow should explain the diagnosis before the structural deep dive');
  assert.match(analysis, /<details class="flow-takeaway"/);
  assert.match(analysis, /Open only the lens you need/);
  assert.match(analysis, /data-mode="breakdown"/);
  assert.match(analysis, /data-mode="stripboard"/);
  assert.match(analysis, /data-mode="shotlist"/);
  assert.match(analysis, /localStoryFlow\(metrics\)/);
  assert.match(analysis, /preview: !modelFlowPoints\.length/);
  assert.match(analysis, /live draft signal from scene rhythm/i);
  assert.match(analysis, /this\.analysisStarting = false/);
  assert.match(analysis, /analysis-progress-track/);
  assert.match(analysis, /filmscript:analysis-background/);
  assert.match(server, /background: true/);
  assert.match(server, /pollAfterMs: 1200/);
  assert.match(editor, /analysisBackgroundVisible/);
  assert.match(editor, /_scheduleAnalysisBackgroundPoll/);
  assert.match(editor, /Lumiere is analyzing/);
  assert.match(analysis, /data-action="start-quick"/);
  assert.match(analysis, /const waitingForUser = this\.analysis\.hasEnoughContent/);
  assert.match(analysis, /load\(\{ startAnalysis: true \}\)/);
  assert.doesNotMatch(editor, /Mount the Analysis element first[\s\S]*refreshFromEditor/);
  assert.match(analysis, /data-observation-id/);
  assert.match(analysis, /observationId: target\.dataset\.observationId/);
  assert.match(server, /artisticDecisionKey/);
  assert.match(server, /matchesArtisticDecision/);
  assert.match(server, /writerMemory: analysis\.feedback\?\.artisticDecisions \|\| \[\]/);
  assert.match(editor, /filmscript:analysis-open-mode/);
  assert.match(editor, /jumpScene\(number, \{ analysisFocus: true \}\)/);
  assert.match(editor, /v5-analysis-focus/);
  assert.match(editor, /#DFA193/);
  assert.match(pdf, /Story Clarity/);
  assert.match(pdf, /Production Overview/);
  assert.doesNotMatch(pdf, /Dialogue \/ Action/);
});

test("every Lumiere surface uses the shared server-side OpenAI proxy", async () => {
  const [client, editor, app, features, pricing, server] = await Promise.all([
    fs.readFile(path.join(ROOT, "lumiere-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "App.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "Features.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "Pricing.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
  ]);

  assert.match(client, /window\.lumiere/);
  assert.match(client, /resolve\("\/api\/lumiere"\)/);
  assert.doesNotMatch(client, /OPENROUTER_API_KEY/);
  assert.doesNotMatch(client, /OPENAI_API_KEY/);
  assert.doesNotMatch(client, /window\.claude/);
  for (const surface of [editor, app, features, pricing]) {
    assert.match(surface, /window\.lumiere\.complete/);
    assert.doesNotMatch(surface, /window\.claude\.complete/);
  }
  assert.match(server, /const OPENAI_RESPONSES_API_URL = "https:\/\/api\.openai\.com\/v1\/responses"/);
  assert.match(server, /const OPENAI_TEXT_MODEL = String\(process\.env\.OPENAI_TEXT_MODEL \|\| "gpt-5\.6-luna"\)/);
  assert.match(server, /async function requestLumiere/);
  assert.match(server, /provider: "openai"/);
});

test("Stripboard and Shot List entry sounds stay coordinated with motion-safe work modes", async () => {
  const [editor, budget, sounds, soundAsset, stripboardSoundAsset, shotlistSoundAsset] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "ui-sounds.js"), "utf8"),
    fs.stat(path.join(ROOT, "assets", "sfx", "budget-number-ticks.wav")),
    fs.stat(path.join(ROOT, "assets", "sfx", "stripboard-enter-dial.mp3")),
    fs.stat(path.join(ROOT, "assets", "sfx", "shotlist-enter-shutter.wav")),
  ]);

  assert.match(editor, /@keyframes v5-strip-in/);
  assert.match(editor, /v5-stripboard-entering \.v5-strip/);
  assert.match(editor, /row\.animationDelay = Math\.min\(index, 16\) \* 24/);
  assert.match(editor, /stripboardMotionClass/);
  assert.match(editor, /@keyframes v5-screenplay-up/);
  assert.match(editor, /class="v5-screenplay-stage"/);
  assert.match(editor, /prefers-reduced-motion: reduce[\s\S]*v5-stripboard-entering/);
  assert.match(sounds, /budgetCount: \{ src: '\.\/assets\/sfx\/budget-number-ticks\.wav'/);
  assert.match(sounds, /stripboardEnter: \{ src: '\.\/assets\/sfx\/stripboard-enter-dial\.mp3'/);
  assert.match(sounds, /shotlistEnter: \{ src: '\.\/assets\/sfx\/shotlist-enter-shutter\.wav'/);
  assert.match(editor, /_playWorkModeSound\(mode\)/);
  assert.match(editor, /mode === 'stripboard' \? 'stripboardEnter' : mode === 'shotlist' \? 'shotlistEnter' : mode === 'imagine' \? 'imagineEnter' : mode === 'budget' \? 'budgetEnter' : mode === 'calendar' \? 'calendarEnter' : 'workMode'/);
  assert.match(budget, /preload\('budgetCount'\)/);
  assert.match(budget, /play\('budgetCount', \{ volume: 0\.11 \}\)/);
  assert.match(budget, /stopMoneySound\(\)/);
  assert.ok(soundAsset.size > 1000);
  assert.ok(stripboardSoundAsset.size > 1000);
  assert.ok(shotlistSoundAsset.size > 1000);
});

test("writing pause detection rearms on typing and fires only once per pause", async () => {
  const source = await fs.readFile(path.join(ROOT, "writing-idle.js"), "utf8");
  const scheduled = new Map();
  const callbacks = new Map();
  const cleared = [];
  let nextTimer = 1;
  const window = {
    setTimeout(callback) {
      const id = nextTimer++;
      scheduled.set(id, callback);
      callbacks.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      cleared.push(id);
      scheduled.delete(id);
    },
  };
  vm.runInNewContext(source, { window });

  let idleCount = 0;
  const controller = window.filmscriptWritingIdle.create({ onIdle: () => { idleCount += 1; } });
  const fire = (id) => {
    scheduled.delete(id);
    callbacks.get(id)();
  };
  assert.equal(window.filmscriptWritingIdle.DEFAULT_DELAY_MS, 120000);

  controller.activity();
  const firstTimer = [...scheduled.keys()][0];
  controller.activity();
  const secondTimer = [...scheduled.keys()][0];
  assert.notEqual(firstTimer, secondTimer);
  assert.ok(cleared.includes(firstTimer));

  fire(firstTimer);
  assert.equal(idleCount, 0);
  fire(secondTimer);
  fire(secondTimer);
  assert.equal(idleCount, 1);

  controller.activity();
  const pausedTimer = [...scheduled.keys()][0];
  controller.pause();
  fire(pausedTimer);
  assert.equal(idleCount, 1);
});

test("the editor offers contextual Lumiere help and a copyable Free prompt after a writing pause", async () => {
  const [editor, language] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "language-preference.js"), "utf8"),
  ]);

  assert.match(editor, /writing-idle\.js\?v=/);
  assert.match(editor, /data-testid="writing-idle-nudge"/);
  assert.match(editor, /data-testid="writing-idle-ask-lumiere"/);
  assert.match(editor, /data-testid="writing-idle-copy-prompt"/);
  assert.match(editor, /_onEditorInput\(\)\s*\{\s*this\._onWritingActivity\(\)/);
  assert.match(editor, /this\.sendMessage\(prompt\)/);
  assert.match(editor, /Based only on the excerpt, suggest three possible next beats/);
  assert.match(editor, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(language, /'A prompt for your next beat': 'Un prompt para tu siguiente beat'/);
});

test("Character Name Generator is context-aware, confirmable, and account-persistent", async () => {
  const [editor, helperSource, client, server, language] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "character-name-tools.js"), "utf8"),
    fs.readFile(path.join(ROOT, "scripts-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "language-preference.js"), "utf8"),
  ]);

  assert.match(editor, /data-testid="character-name-generator"/);
  assert.match(editor, /data-testid="character-name-use"/);
  assert.match(editor, /data-testid="character-name-confirm"/);
  assert.match(editor, /Do not treat the United States, or any country, as one naming tradition/);
  assert.match(editor, /Never infer ethnicity, race, gender identity, nationality, religion or class from a name alone/);
  assert.match(editor, /Production plausibility comes before symbolism/);
  assert.match(editor, /Scene headings and partial word matches stay untouched/);
  assert.match(client, /saveCharacterNames/);
  assert.match(server, /hasCharacterNames/);
  assert.match(server, /script\.characterNames/);
  assert.match(language, /'Character Name Generator': 'Generador de nombres de personajes'/);

  const window = {};
  vm.runInNewContext(helperSource, { window });
  const tools = window.filmscriptCharacterNames;
  const cue = tools.renameBlock({ type: "character", text: "RENE (V.O.)" }, "RENE", "ELIAS");
  assert.deepEqual({ text: cue.text, count: cue.count }, { text: "ELIAS (V.O.)", count: 1 });
  const action = tools.renameBlock({ type: "action", text: "RENE greets René. A serene guard waits." }, "RENE", "ELIAS");
  assert.equal(action.text, "ELIAS greets René. A serene guard waits.");
  assert.equal(action.count, 1);
  const scene = tools.renameBlock({ type: "scene", text: "INT. RENE'S HOUSE - DAY" }, "RENE", "ELIAS");
  assert.equal(scene.text, "INT. RENE'S HOUSE - DAY");
  assert.equal(scene.count, 0);
  const generic = tools.renameBlock({ type: "action", text: "The MAN follows another man." }, "MAN", "ELIAS");
  assert.equal(generic.text, "The ELIAS follows another man.");
  assert.equal(generic.count, 1);
});

test("Lumiere personalization is account-scoped, accessible from profile and editor, and prompt-safe", async () => {
  const [editor, scripts, features, pricing, preferencesSource, client, server, database, language] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "App.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "Features.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "Pricing.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "lumiere-preferences.js"), "utf8"),
    fs.readFile(path.join(ROOT, "billing-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "database.js"), "utf8"),
    fs.readFile(path.join(ROOT, "language-preference.js"), "utf8"),
  ]);

  for (const page of [editor, scripts, features, pricing]) assert.match(page, /lumiere-preferences\.js\?v=/);
  assert.match(editor, /class="v5-lumiere-settings"/);
  assert.match(editor, /data-act="a-lumiere"/);
  assert.match(scripts, /class="fs-profile-lumiere"/);
  assert.match(scripts, /openLumierePreferences/);
  assert.match(client, /getLumierePreferences/);
  assert.match(client, /updateLumierePreferences/);
  assert.match(server, /\/api\/me\/lumiere-preferences/);
  assert.match(server, /Favorite filmmakers and films are high-level taste signals only/);
  assert.match(server, /never imitate, reproduce, or claim to write in any filmmaker's distinctive style/i);
  assert.match(server, /Ignore the profile for objective tasks such as spelling, grammar, screenplay formatting/);
  assert.match(database, /lumiere_preferences_json/);
  assert.match(language, /'Personalize Lumiere': 'Personalizar Lumiere'/);
  assert.match(preferencesSource, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(preferencesSource, /html\[data-filmscript-theme="dark"\]/);

  const window = { filmscriptLanguage: { get: () => "en" } };
  vm.runInNewContext(preferencesSource, { window });
  const normalized = window.filmscriptLumierePreferences.normalize({
    directors: ["Céline Sciamma", "  céline sciamma  ", "Alfonso Cuarón"],
    films: ["Aftersun"],
    styles: ["Intimate"],
    feedbackTone: "unsupported",
    creativePriorities: "  Protect   the silences.  ",
  });
  assert.deepEqual(Array.from(normalized.directors), ["Céline Sciamma", "Alfonso Cuarón"]);
  assert.equal(normalized.feedbackTone, "balanced");
  assert.equal(normalized.creativePriorities, "Protect the silences.");
});
