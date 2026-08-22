const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const labels = {
  cast: 'Cast', extras: 'Background', props: 'Props', wardrobe: 'Wardrobe', makeup_hair: 'Makeup',
  locations: 'Locations', vehicles: 'Vehicles', animals: 'Animals', visual_effects: 'VFX',
  special_effects: 'SFX', stunts: 'Stunts', sound: 'Sound', camera: 'Camera', lighting: 'Lighting',
  grip: 'Grip', equipment: 'Special Equipment', production_notes: 'Production Notes',
  safety_notes: 'Safety Notes', set_dressing: 'Set Dressing', greenery: 'Greenery', music: 'Music',
};

// These are presentation groups only. Every card retains a reference to the
// original Breakdown element; switching views never makes a copy of it.
const categoryCards = [
  ['cast', ['cast']], ['extras', ['extras']], ['props', ['props']], ['wardrobe', ['wardrobe']],
  ['makeup_hair', ['makeup_hair']], ['locations', ['locations']], ['vehicles', ['vehicles']],
  ['animals', ['animals']], ['visual_effects', ['visual_effects']], ['special_effects', ['special_effects']],
  ['stunts', ['stunts']], ['sound', ['sound']], ['camera', ['camera']], ['lighting', ['lighting']],
  ['grip', ['grip']], ['equipment', ['equipment']], ['production_notes', ['production_notes', 'safety_notes']],
];

const categoryTone = {
  cast: '#ff907e', extras: '#eeae64', props: '#f0c767', wardrobe: '#d9a4bd', makeup_hair: '#ed9aa4',
  locations: '#8fc6b0', vehicles: '#7bc5cb', animals: '#8dbd7c', visual_effects: '#ad9ce8',
  special_effects: '#d596e2', stunts: '#ef8297', sound: '#7ec3de', camera: '#85aeea', lighting: '#f1c86d',
  grip: '#a8adba', equipment: '#9aadc3', production_notes: '#d7ad84', safety_notes: '#e59c87',
  set_dressing: '#c7a281', greenery: '#96ba8d', music: '#ada9e4',
};

const normalCategory = (value) => ({ character: 'cast', characters: 'cast', makeup: 'makeup_hair', effects: 'special_effects', safety: 'safety_notes', production_note: 'production_notes' }[String(value || '').toLowerCase()] || String(value || '').toLowerCase());
const word = (value, fallback = '—') => String(value ?? '').trim() || fallback;
const absoluteTime = (value) => {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const slugParts = (heading) => {
  const title = word(heading, 'UNTITLED SCENE');
  const intExt = (title.match(/^(INT\.?\s*\/\s*EXT\.?|INT\.?\/?EXT\.?|INT\.?|EXT\.?)/i) || [])[0]?.replace(/\s+/g, '').toUpperCase() || '—';
  const dayNight = (title.match(/\b(DAY|NIGHT|DAWN|MORNING|AFTERNOON|SUNSET|D[IÍ]A|NOCHE|AMANECER|MAÑANA|TARDE|ATARDECER)\b/i) || [])[0]?.toUpperCase() || '—';
  const location = title.replace(/^(INT\.?\s*\/\s*EXT\.?|INT\.?\/?EXT\.?|INT\.?|EXT\.?)\s*[-.]?\s*/i, '')
    .replace(/\s+-\s+(DAY|NIGHT|DAWN|MORNING|AFTERNOON|SUNSET|D[IÍ]A|NOCHE|AMANECER|MAÑANA|TARDE|ATARDECER).*$/i, '').trim() || '—';
  return { intExt, dayNight, location };
};
const clone = (value) => JSON.parse(JSON.stringify(value));

class FilmScriptBreakdown extends HTMLElement {
  static get observedAttributes() { return ['script-id', 'project-title', 'pro-active']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.project = null;
    this.loading = true;
    this.error = '';
    this.view = 'scene';
    this.expanded = new Set();
    this.focusSceneId = '';
    this.editing = null;
    this.addingSceneId = '';
    this._versions = new Map();
    this._refreshTimer = 0;
    this._remoteOperation = (event) => this.applyRemoteOperation(event.detail);
    this._progress = (event) => this.onProgress(event.detail);
    this._language = () => this.render();
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this.onClick);
    this.shadowRoot.addEventListener('keydown', this.onKeydown);
    this.shadowRoot.addEventListener('input', this.onInput);
    this.shadowRoot.addEventListener('change', this.onChange);
    window.addEventListener('filmscript:content.operation', this._remoteOperation);
    window.addEventListener('filmscript:breakdown.progress', this._progress);
    window.addEventListener('filmscript:language-change', this._language);
    this.load();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener('click', this.onClick);
    this.shadowRoot.removeEventListener('keydown', this.onKeydown);
    this.shadowRoot.removeEventListener('input', this.onInput);
    this.shadowRoot.removeEventListener('change', this.onChange);
    window.removeEventListener('filmscript:content.operation', this._remoteOperation);
    window.removeEventListener('filmscript:breakdown.progress', this._progress);
    window.removeEventListener('filmscript:language-change', this._language);
    clearTimeout(this._refreshTimer);
  }

  attributeChangedCallback(name, previous, next) {
    if (!this.isConnected || previous === next) return;
    if (name === 'script-id') { this.project = null; this.loading = true; this.focusSceneId = ''; this.load(); }
    else this.render();
  }

  get scriptId() { return this.getAttribute('script-id') || ''; }
  get projectTitle() { return this.getAttribute('project-title') || 'Untitled screenplay'; }
  get spanish() { return window.filmscriptLanguage?.get?.() === 'es'; }
  t(english, spanish) { return this.spanish ? spanish : english; }
  scenes() { return Array.isArray(this.project?.scenes) ? this.project.scenes : []; }
  active() { return ['queued', 'running'].includes(this.project?.analysis?.status); }

  async load({ quiet = false } = {}) {
    if (!this.scriptId || !window.filmscriptPreproduction) return;
    if (!quiet) { this.loading = true; this.render(); }
    try {
      const result = await window.filmscriptPreproduction.get(this.scriptId);
      this.project = result.project || null;
      this.error = '';
    } catch (error) {
      this.error = error.message || this.t('Breakdown could not be loaded.', 'No se pudo cargar el desglose.');
    } finally { this.loading = false; this.render(); }
  }

  refreshSoon() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = window.setTimeout(() => this.load({ quiet: true }), 90);
  }

  onProgress(detail) {
    if (detail?.module !== 'breakdown' || detail?.scriptId && detail.scriptId !== this.scriptId) return;
    // A progression event is emitted once per durable scene commit. It causes
    // one read, rather than timer polling, and makes completed cards usable
    // while the remaining scenes are still being generated.
    this.refreshSoon();
  }

  applyRemoteOperation(detail) {
    if (detail?.module !== 'breakdown' || !detail.entityId || !detail.entity) return;
    const document = String(detail.documentId || '');
    const versionKey = `${document}:${detail.entityId}`;
    this._versions.set(versionKey, Number(detail.entity.version) || 0);
    const sceneId = String(detail.metadata?.sceneId || document.split(':')[1] || '');
    const scene = this.scenes().find((candidate) => candidate.id === sceneId);
    if (!scene) return this.refreshSoon();
    if (detail.entityType === 'breakdown_element') {
      const element = (scene.breakdown?.elements || []).find((candidate) => candidate.id === detail.entityId);
      if (element) Object.assign(element, ...detail.changedFields.map((field) => ({ [field]: detail.entity[field] })));
      else this.refreshSoon();
    } else if (detail.entityType === 'breakdown_card') {
      const section = document.split(':')[2] || 'metadata';
      scene.breakdownForm ||= { metadata: {}, cells: {} };
      scene.breakdownForm[section] ||= {};
      detail.changedFields.forEach((field) => { scene.breakdownForm[section][field] = detail.entity[field]; });
    }
    this.render();
  }

  sceneInfo(scene, index) {
    const elements = Array.isArray(scene?.breakdown?.elements) ? scene.breakdown.elements : [];
    const form = scene?.breakdownForm?.metadata || {};
    const parts = slugParts(scene?.title);
    const locationElement = elements.find((element) => normalCategory(element.category) === 'locations');
    const status = scene?.status === 'generating' ? this.t('Generating', 'Generando')
      : scene?.status === 'outdated' ? this.t('Stale', 'Pendiente')
        : scene?.status === 'needs_review' ? this.t('Needs review', 'Revisar')
          : this.t('Ready', 'Listo');
    return {
      id: scene.id, scene, number: index + 1, heading: word(scene.title, `Scene ${index + 1}`), headingIsProjectContent: !!String(scene?.title || '').trim(), elements,
      pageLength: word(form.pageCount || scene.pageCount || scene.page), intExt: word(form.intExt || parts.intExt),
      dayNight: word(form.dayNight || parts.dayNight), location: word(form.location || locationElement?.name || parts.location),
      castCount: elements.filter((element) => normalCategory(element.category) === 'cast').length,
      elementCount: elements.length, status, generated: !!scene?.breakdown && scene.breakdown.generated !== false,
      loading: scene?.status === 'generating' || (this.active() && this.project?.analysis?.currentSceneId === scene.id),
      stale: scene?.status === 'outdated', updatedAt: scene?.breakdownDiff?.generatedAt || scene?.breakdownForm?.updatedAt || scene?.updatedAt || this.project?.scriptVersion,
      diff: scene?.breakdownDiff || null,
    };
  }

  elementGroups(info) {
    const cards = categoryCards.map(([key, categories]) => ({
      key, label: labels[key] || key,
      elements: [
        ...info.elements.filter((element) => categories.includes(normalCategory(element.category))),
        ...(key === 'production_notes' ? [
          ...(Array.isArray(info.scene?.breakdown?.productionNotes) ? info.scene.breakdown.productionNotes : []).map((note, index) => ({ id: `note_production_${index}`, category: 'production_notes', name: String(note), _note: true })),
          ...(Array.isArray(info.scene?.breakdown?.safetyNotes) ? info.scene.breakdown.safetyNotes : []).map((note, index) => ({ id: `note_safety_${index}`, category: 'safety_notes', name: String(note), _note: true })),
        ] : []),
      ],
    }));
    const represented = new Set(categoryCards.flatMap(([, categories]) => categories));
    const additional = new Map();
    info.elements.filter((element) => !represented.has(normalCategory(element.category))).forEach((element) => {
      const key = normalCategory(element.category) || 'production_notes';
      if (!additional.has(key)) additional.set(key, { key, label: labels[key] || key.replaceAll('_', ' '), elements: [] });
      additional.get(key).elements.push(element);
    });
    return [...cards, ...additional.values()];
  }

  renderDiff(diff) {
    if (!diff) return '';
    const bits = [
      diff.newElements?.length ? `${diff.newElements.length} ${this.t('new', 'nuevos')}` : '',
      diff.modifiedElements?.length ? `${diff.modifiedElements.length} ${this.t('modified', 'modificados')}` : '',
      diff.removedElements?.length ? `${diff.removedElements.length} ${this.t('removed', 'eliminados')}` : '',
      diff.manualEditsPreserved?.length ? this.t('manual edits preserved', 'ediciones manuales preservadas') : '',
    ].filter(Boolean);
    return bits.length ? `<div class="diff" title="${this.t('Latest regeneration diff', 'Cambios de la última regeneración')}">${escapeHtml(bits.join(' · '))}</div>` : '';
  }

  renderMeta(info) {
    return `<div class="scene-meta">
      <span>${this.t('Pages', 'Páginas')} <b>${escapeHtml(info.pageLength)}</b></span><span data-project-content>${escapeHtml(info.intExt)}</span>
      <span data-project-content>${escapeHtml(info.dayNight)}</span><span>${this.t('Cast', 'Reparto')} <b>${info.castCount}</b></span>
      <span>${this.t('Elements', 'Elementos')} <b>${info.elementCount}</b></span><span>${this.t('Updated', 'Actualizado')} <b>${escapeHtml(absoluteTime(info.updatedAt))}</b></span>
    </div>`;
  }

  renderElement(element, info, card) {
    const key = `${info.id}:${element.id}`;
    const isEditing = this.editing === key;
    const tone = categoryTone[card.key] || '#b7acdb';
    const status = String(element.status || 'open').trim().toLowerCase() || 'open';
    const statusLabel = {
      open: this.t('To do', 'Por hacer'),
      in_progress: this.t('In progress', 'En curso'),
      ready: this.t('Ready', 'Listo'),
      blocked: this.t('Blocked', 'Bloqueado'),
    }[status] || this.t('To do', 'Por hacer');
    const links = [
      ['budget', this.t('Budget', 'Presupuesto')], ['calendar', this.t('Calendar', 'Calendario')], ['canvas', this.t('Canvas', 'Canvas')],
    ].map(([view, label]) => `<a href="Editor%20v5.dc.html?script=${encodeURIComponent(this.scriptId)}&view=${view}">${label}</a>`).join('');
    if (element._note) return `<article class="element is-note" style="--tone:${tone}"><div class="element-main"><div class="element-top"><strong data-project-content>${escapeHtml(element.name)}</strong></div></div></article>`;
    if (isEditing) return `<article class="element is-editing" style="--tone:${tone}" data-element-id="${escapeHtml(element.id)}" data-scene-id="${escapeHtml(info.id)}">
      <div class="element-edit-head"><strong data-project-content>${escapeHtml(element.name)}</strong><button type="button" class="quiet" data-action="cancel-element">${this.t('Cancel', 'Cancelar')}</button></div>
      <div class="element-edit-grid"><label>${this.t('Name', 'Nombre')}<input data-field="name" value="${escapeHtml(element.name)}"></label><label>${this.t('Qty', 'Cant.')}<input data-field="quantity" inputmode="numeric" value="${escapeHtml(element.quantity || 1)}"></label>
      <label>${this.t('Owner', 'Responsable')}<input data-field="assignee" value="${escapeHtml(element.assignee || '')}" placeholder="${this.t('Assign collaborator', 'Asignar colaborador')}"></label><label>${this.t('Status', 'Estado')}<select data-field="status"><option value="open"${status === 'open' ? ' selected' : ''}>${this.t('To do', 'Por hacer')}</option><option value="in_progress"${status === 'in_progress' ? ' selected' : ''}>${this.t('In progress', 'En curso')}</option><option value="ready"${status === 'ready' ? ' selected' : ''}>${this.t('Ready', 'Listo')}</option><option value="blocked"${status === 'blocked' ? ' selected' : ''}>${this.t('Blocked', 'Bloqueado')}</option></select></label></div>
      <label class="wide">${this.t('Notes', 'Notas')}<textarea data-field="notes" placeholder="${this.t('Production note', 'Nota de producción')}">${escapeHtml(element.notes || '')}</textarea></label>
      <label class="attachment-label">${this.t('Reference image', 'Imagen de referencia')}<input type="file" accept="image/png,image/jpeg,image/webp" data-image-input="1"></label>
      <nav class="element-connections" aria-label="${this.t('Connected production tools', 'Herramientas de producción conectadas')}">${links}</nav>
      <div class="element-actions"><button type="button" class="primary" data-action="save-element">${this.t('Save changes', 'Guardar cambios')}</button></div>
    </article>`;
    const image = element.imageAsset?.id ? `<img src="${escapeHtml(window.filmscriptPreproduction?.breakdownImageUrl?.(this.scriptId, element.imageAsset.id) || '')}" alt="${escapeHtml(`${this.t('Reference image for', 'Imagen de referencia de')} ${element.name}`)}">` : '';
    const scriptLinkLabel = this.t('Open exact source in screenplay for', 'Abrir fuente exacta en el guion para');
    return `<article class="element is-script-link" style="--tone:${tone}" data-action="open-script-reference" data-category-key="${escapeHtml(card.key)}" data-element-id="${escapeHtml(element.id)}" data-scene-id="${escapeHtml(info.id)}" role="link" tabindex="0" title="${escapeHtml(`${scriptLinkLabel} ${element.name}`)}" aria-label="${escapeHtml(`${scriptLinkLabel} ${element.name}`)}">
      ${image ? `<div class="element-image">${image}</div>` : ''}<div class="element-main"><div class="element-top"><strong data-project-content>${escapeHtml(element.name)}</strong><span class="qty">×${Math.max(1, Number(element.quantity) || 1)}</span></div>
      ${element.description ? `<p data-project-content>${escapeHtml(element.description)}</p>` : ''}${element.notes ? `<small data-project-content>${escapeHtml(element.notes)}</small>` : ''}
      ${element.assignee || status !== 'open' ? `<footer>${element.assignee ? `<span class="owner" data-project-content>${escapeHtml(element.assignee)}</span>` : ''}${status !== 'open' ? `<span class="state ${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>` : ''}</footer>` : ''}</div>
      <button type="button" class="element-open" data-action="edit-element" aria-label="${escapeHtml(`${this.t('Open details for', 'Abrir detalles de')} ${element.name}`)}">${this.t('Open details', 'Abrir')}</button>
    </article>`;
  }

  renderCategory(card, info) {
    const tone = categoryTone[card.key] || '#b7acdb';
    const elements = card.elements.map((element) => this.renderElement(element, info, card)).join('');
    return `<section class="category" style="--tone:${tone}"><header><span class="category-dot"></span><h4>${escapeHtml(card.label)}</h4><span>${card.elements.length}</span></header>
      <div class="category-elements">${elements}</div>
    </section>`;
  }

  renderAddForm(info) {
    if (this.addingSceneId !== info.id) return `<button type="button" class="add-element" data-action="show-add" data-scene-id="${escapeHtml(info.id)}" aria-label="${this.t('Add a production element', 'Añadir un elemento de producción')}">＋ ${this.t('Add element', 'Añadir elemento')}</button>`;
    const options = categoryCards.map(([key]) => `<option value="${key}">${escapeHtml(labels[key] || key)}</option>`).join('');
    return `<form class="new-element" data-scene-id="${escapeHtml(info.id)}"><select data-new-field="category">${options}</select><input data-new-field="name" placeholder="${this.t('Element name', 'Nombre del elemento')}" autofocus><input data-new-field="quantity" value="1" inputmode="numeric"><button type="button" class="quiet" data-action="cancel-add">${this.t('Cancel', 'Cancelar')}</button><button type="button" class="primary" data-action="save-add">${this.t('Add', 'Añadir')}</button></form>`;
  }

  renderScene(info) {
    const expanded = this.expanded.has(info.id) || this.focusSceneId === info.id;
    const statusClass = info.loading ? ' is-generating' : info.stale ? ' is-stale' : '';
    const groups = this.elementGroups(info).filter((card) => card.elements.length);
    return `<article class="scene-container${expanded ? ' is-expanded' : ''}${statusClass}" data-scene-id="${escapeHtml(info.id)}">
      <header class="scene-head"><button type="button" class="scene-open" data-action="toggle-scene" data-scene-id="${escapeHtml(info.id)}" aria-expanded="${expanded}" aria-label="${this.t(expanded ? 'Collapse' : 'Expand', expanded ? 'Contraer' : 'Expandir')} ${escapeHtml(info.heading)}"><span class="scene-number">${String(info.number).padStart(2, '0')}</span><span class="scene-title"><strong${info.headingIsProjectContent ? ' data-project-content' : ''}>${escapeHtml(info.heading)}</strong><small data-project-content>${escapeHtml(info.location)}</small></span><span class="scene-status">${escapeHtml(info.status)}</span><span class="chevron">⌄</span></button>
      <button type="button" class="focus" data-action="focus-scene" data-scene-id="${escapeHtml(info.id)}" aria-label="${this.t('Focus scene', 'Enfocar escena')} ${escapeHtml(info.number)}">${this.t('Focus', 'Enfocar')}</button></header>
      ${this.renderMeta(info)}${this.renderDiff(info.diff)}
      ${expanded ? `<div class="scene-content">${info.loading ? `<div class="scene-loading"><i></i><span>${this.t('Lumiere is finishing this scene', 'Lumiere está terminando esta escena')}</span></div>` : ''}<div class="category-grid">${groups.length ? groups.map((card) => this.renderCategory(card, info)).join('') : `<div class="scene-empty">${this.t('No production elements in this scene yet.', 'Esta escena aún no tiene elementos de producción.')}</div>`}</div>${this.renderAddForm(info)}</div>` : ''}
    </article>`;
  }

  renderDepartment(infos) {
    const departments = new Map(categoryCards.map(([key]) => [key, { key, label: labels[key] || key, items: [] }]));
    infos.forEach((info) => this.elementGroups(info).forEach((card) => {
      if (!departments.has(card.key)) departments.set(card.key, { key: card.key, label: card.label, items: [] });
      card.elements.forEach((element) => departments.get(card.key).items.push({ element, info }));
    }));
    const populatedDepartments = [...departments.values()].filter((department) => department.items.length);
    return `<section class="department-view">${populatedDepartments.length ? populatedDepartments.map((department) => `<article class="department-card" style="--tone:${categoryTone[department.key] || '#b7acdb'}"><header><span></span><h3>${escapeHtml(department.label)}</h3><b>${department.items.length}</b></header><div>${department.items.map(({ element, info }) => `<button type="button" class="department-item" data-action="open-script-reference" data-category-key="${escapeHtml(department.key)}" data-element-id="${escapeHtml(element.id)}" data-scene-id="${escapeHtml(info.id)}" aria-label="${escapeHtml(`${this.t('Open exact source for', 'Abrir fuente exacta de')} ${element.name}, ${this.t('scene', 'escena')} ${info.number}`)}"><span data-project-content>${escapeHtml(element.name)}</span><small>${this.t('Scene', 'Escena')} ${info.number} · <span${info.headingIsProjectContent ? ' data-project-content' : ''}>${escapeHtml(info.heading)}</span></small></button>`).join('')}</div></article>`).join('') : `<div class="department-empty">${this.t('No production elements have been added yet.', 'Aún no se han añadido elementos de producción.')}</div>`}</section>`;
  }

  renderProgress() {
    const analysis = this.project?.analysis || {};
    if (!this.active()) return '';
    const total = Math.max(1, Number(analysis.total) || this.scenes().length || 1);
    const completed = Math.max(0, Math.min(total, Number(analysis.completed) || 0));
    const percent = Math.round((completed / total) * 100);
    return `<section class="progress" aria-live="polite"><div class="lumiere-orb"><i></i><i></i><i></i></div><div><strong>${this.t('Generating Breakdown', 'Generando Desglose')}</strong><span>${escapeHtml(analysis.message || `${this.t('Generating Breakdown', 'Generando Desglose')} · ${completed} ${this.t('of', 'de')} ${total} ${this.t('scenes', 'escenas')}`)}</span><div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div></div><b>${percent}%</b></section>`;
  }

  renderEmpty() {
    return `<section class="empty-state"><div class="empty-orb"><i></i><i></i></div><span>FILMSCRIPT · BREAKDOWN</span><h2>${this.t('Build the production view of your screenplay.', 'Construye la visión de producción de tu guion.')}</h2><p>${this.t('Generate the first pass with Lumiere, then assign, annotate and attach production details in the same shared project.', 'Genera la primera pasada con Lumiere y después asigna, anota y adjunta detalles de producción en el mismo proyecto compartido.')}</p><div><button type="button" class="primary" data-action="generate">${this.t('Generate Breakdown', 'Generar Desglose')}</button><button type="button" class="quiet" data-action="manual">${this.t('Start manually', 'Empezar manualmente')}</button></div></section>`;
  }

  render() {
    const infos = this.scenes().map((scene, index) => this.sceneInfo(scene, index));
    const hasBreakdown = infos.some((info) => info.generated || info.elements.length || info.scene?.breakdownForm);
    const focus = this.focusSceneId ? infos.filter((info) => info.id === this.focusSceneId) : infos;
    this.shadowRoot.innerHTML = `<style>${this.styles()}</style><main class="breakdown-shell">
      <header class="breakdown-top"><p class="breakdown-context">${this.t('Production elements, organized for the next decision.', 'Elementos de producción, organizados para la próxima decisión.')}</p><div class="top-actions"><div class="view-switch" role="tablist" aria-label="${this.t('Breakdown view', 'Vista de desglose')}"><button type="button" role="tab" aria-selected="${this.view === 'scene'}" data-action="view-scene" class="${this.view === 'scene' ? 'is-current' : ''}">${this.t('By Scene', 'Por escena')}</button><button type="button" role="tab" aria-selected="${this.view === 'department'}" data-action="view-department" class="${this.view === 'department' ? 'is-current' : ''}">${this.t('By Department', 'Por departamento')}</button></div><button type="button" class="generate" data-action="generate" aria-label="${this.t('Generate breakdown', 'Generar desglose')}" ${this.active() ? 'disabled' : ''}>${this.active() ? this.t('Generating…', 'Generando…') : this.t('Generate', 'Generar')}</button></div></header>
      ${this.error ? `<div class="error">${escapeHtml(this.error)}</div>` : ''}${this.loading ? `<div class="loading"><i></i>${this.t('Loading Breakdown…', 'Cargando desglose…')}</div>` : ''}
      ${!this.loading ? `${this.renderProgress()}${!hasBreakdown && !this.active() ? this.renderEmpty() : this.view === 'department' ? this.renderDepartment(infos) : `<section class="scene-list${this.focusSceneId ? ' is-focused' : ''}">${this.focusSceneId ? `<button type="button" class="back" data-action="clear-focus">← ${this.t('All scenes', 'Todas las escenas')}</button>` : ''}${(this.focusSceneId ? focus : infos).map((info) => this.renderScene(info)).join('')}</section>`}` : ''}
    </main>`;
  }

  async startGeneration({ manual = false, sceneId = '' } = {}) {
    if (!this.scriptId || this.active()) return;
    this.error = '';
    try {
      const result = manual ? await window.filmscriptPreproduction.createManualBreakdown(this.scriptId) : await window.filmscriptPreproduction.analyze(this.scriptId, { sceneId });
      this.project = result.project || this.project;
      this.render();
    } catch (error) { this.error = error.message || this.t('Could not start Breakdown.', 'No se pudo iniciar el desglose.'); this.render(); }
  }

  clientElementId() {
    const bytes = new Uint8Array(10); crypto.getRandomValues(bytes);
    return `brk_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  async commitElement(sceneId, element, patch, operationType = 'field.set') {
    const documentId = `breakdown:${sceneId}:elements`;
    const versionKey = `${documentId}:${element.id}`;
    const baseVersion = this._versions.get(versionKey) || 0;
    const previous = Object.fromEntries(Object.keys(patch).map((field) => [field, element[field] ?? '']));
    try {
      if (window.filmscriptPlatform?.sendOperation) {
        const result = await window.filmscriptPlatform.sendOperation({ module: 'breakdown', documentId, entityType: 'breakdown_element', entityId: element.id, baseVersion, current: { id: element.id, version: baseVersion, ...previous }, previous, patch, operationType, metadata: { sceneId, sceneLabel: this.scenes().find((scene) => scene.id === sceneId)?.title || '' } });
        this._versions.set(versionKey, result.entity?.version || baseVersion);
      }
      await window.filmscriptPreproduction.saveScene(this.scriptId, sceneId, { elementOperations: [{ action: operationType === 'entity.add' ? 'add' : 'patch', id: element.id, element, patch }] });
      this.refreshSoon();
    } catch (error) {
      this.error = error.status === 409 ? this.t('Someone else changed this field. The latest version is shown.', 'Otra persona cambió este campo. Se muestra la versión más reciente.') : error.message;
      this.refreshSoon();
    }
  }

  openScriptReference(sceneId, elementId, categoryKey = '') {
    const index = this.scenes().findIndex((scene) => scene.id === sceneId);
    const scene = this.scenes()[index];
    const element = scene?.breakdown?.elements?.find((candidate) => candidate.id === elementId);
    if (!scene || !element) return;
    const references = [...new Set([element.sourceExcerpt, element.name]
      .map((value) => String(value || '').trim()).filter(Boolean))];
    window.dispatchEvent(new CustomEvent('filmscript:breakdown-open-reference', {
      detail: {
        scriptId: this.scriptId,
        sceneId,
        sceneNumber: index + 1,
        categoryKey: categoryKey || normalCategory(element.category),
        references,
        label: element.name,
      },
    }));
  }

  onClick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const sceneId = button.dataset.sceneId || button.closest('[data-scene-id]')?.dataset.sceneId || '';
    if (action === 'view-scene') { this.view = 'scene'; this.render(); }
    if (action === 'view-department') { this.view = 'department'; this.render(); }
    if (action === 'generate') this.startGeneration();
    if (action === 'manual') this.startGeneration({ manual: true });
    if (action === 'toggle-scene') { this.expanded.has(sceneId) ? this.expanded.delete(sceneId) : this.expanded.add(sceneId); this.focusSceneId = ''; this.render(); }
    if (action === 'focus-scene') { this.focusSceneId = sceneId; this.expanded.add(sceneId); this.view = 'scene'; window.filmscriptPlatform?.sendPresence?.({ type: 'selection.updated', module: 'breakdown', sceneId, selectedObjectId: sceneId, selection: { kind: 'scene' } }); this.render(); }
    if (action === 'clear-focus') { this.focusSceneId = ''; this.render(); }
    if (action === 'show-add') { this.addingSceneId = sceneId; this.expanded.add(sceneId); this.render(); }
    if (action === 'cancel-add') { this.addingSceneId = ''; this.render(); }
    if (action === 'open-script-reference') this.openScriptReference(sceneId, button.dataset.elementId, button.dataset.categoryKey);
    if (action === 'edit-element') { const id = button.closest('[data-element-id]')?.dataset.elementId; this.editing = `${sceneId}:${id}`; window.filmscriptPlatform?.sendPresence?.({ type: 'selection.updated', module: 'breakdown', sceneId, selectedObjectId: id, selection: { kind: 'element' } }); this.render(); }
    if (action === 'cancel-element') { this.editing = null; this.render(); }
    if (action === 'save-element') this.saveEditingElement(button.closest('[data-element-id]'));
    if (action === 'save-add') this.saveNewElement(button.closest('.new-element'));
  };

  onKeydown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const link = event.target.closest?.('[data-action="open-script-reference"]');
    if (!link) return;
    // Buttons and form controls inside a reference card own Enter/Space. For
    // example, opening Edit must never also jump the screenplay underneath it.
    if (event.target !== link && event.target.closest?.('button,input,textarea,select,label,[contenteditable="true"]')) return;
    event.preventDefault();
    this.openScriptReference(link.dataset.sceneId, link.dataset.elementId, link.dataset.categoryKey);
  };

  onInput = () => {};
  onChange = (event) => {
    if (event.target.matches('[data-image-input]') && event.target.files?.[0]) this.uploadImage(event.target);
  };

  saveEditingElement(root) {
    const sceneId = root?.dataset.sceneId; const id = root?.dataset.elementId;
    const scene = this.scenes().find((candidate) => candidate.id === sceneId);
    const element = scene?.breakdown?.elements?.find((candidate) => candidate.id === id);
    if (!element) return;
    const patch = Object.fromEntries([...root.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.value]));
    this.editing = null; this.commitElement(sceneId, element, patch); this.render();
  }

  saveNewElement(form) {
    const sceneId = form?.dataset.sceneId; if (!sceneId) return;
    const values = Object.fromEntries([...form.querySelectorAll('[data-new-field]')].map((input) => [input.dataset.newField, input.value]));
    if (!String(values.name || '').trim()) return;
    const element = { id: this.clientElementId(), category: values.category, name: values.name, quantity: values.quantity || 1, description: '', notes: '', assignee: '', status: 'open' };
    this.addingSceneId = ''; this.commitElement(sceneId, element, element, 'entity.add'); this.render();
  }

  async uploadImage(input) {
    const root = input.closest('[data-element-id]'); const sceneId = root?.dataset.sceneId; const elementId = root?.dataset.elementId;
    const file = input.files?.[0];
    if (!file || !window.filmscriptPreproduction?.uploadBreakdownImage) return;
    try {
      await window.filmscriptPreproduction.uploadBreakdownImage(this.scriptId, { sceneId, elementId, file });
      this.refreshSoon();
    } catch (error) { this.error = error.message || this.t('Image could not be attached.', 'No se pudo adjuntar la imagen.'); this.render(); }
  }

  styles() { return `
    :host{display:block;min-height:100%;color:var(--ink,#2c2c2a);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.breakdown-shell{max-width:1440px;margin:0 auto;padding:8px 0 54px}.breakdown-top{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;padding:12px 2px 25px}.breakdown-top>div>span{display:block;color:var(--accent,#ba7517);font-size:10px;font-weight:800;letter-spacing:.16em}.breakdown-top h1{margin:7px 0 3px;font-size:34px;letter-spacing:-.055em;line-height:1}.breakdown-top p{margin:0;color:var(--muted,#77766f);font-size:13px}.top-actions{display:flex;align-items:center;gap:10px}.view-switch{display:flex;padding:3px;border:1px solid color-mix(in srgb,var(--hair,#e7e4da) 78%,transparent);border-radius:12px;background:color-mix(in srgb,var(--surface,#fffef9) 64%,transparent);box-shadow:inset 0 1px rgba(255,255,255,.48);backdrop-filter:blur(18px) saturate(150%)}button{font:inherit}.view-switch button,.generate,.primary,.quiet,.focus,.add-element{border:0;cursor:pointer}.view-switch button{padding:8px 10px;background:transparent;color:var(--muted,#77766f);font-size:11px;font-weight:750;border-radius:9px}.view-switch button.is-current{background:color-mix(in srgb,var(--accent,#ba7517) 16%,var(--surface,#fffef9));color:var(--ink,#2c2c2a);box-shadow:0 1px 8px rgba(38,30,20,.08)}.generate,.primary{padding:10px 13px;border-radius:11px;background:linear-gradient(135deg,#f7c65e,var(--accent,#ba7517));color:#281c0e;font-size:12px;font-weight:850;box-shadow:0 8px 20px rgba(160,104,19,.19)}.generate:disabled{opacity:.55;cursor:wait}.quiet{padding:9px 11px;border-radius:10px;background:color-mix(in srgb,var(--surface,#fffef9) 65%,transparent);color:var(--ink,#2c2c2a);border:1px solid var(--hair,#e7e4da);font-size:12px;font-weight:700}.error{margin:0 0 14px;padding:11px 13px;border:1px solid rgba(195,65,55,.25);border-radius:12px;background:rgba(215,80,63,.1);color:#a1352a;font-size:12px}.loading{display:flex;align-items:center;justify-content:center;gap:9px;min-height:220px;color:var(--muted,#77766f);font-size:13px}.loading i{width:17px;height:17px;border:2px solid var(--hair,#e7e4da);border-top-color:var(--accent,#ba7517);border-radius:50%;animation:spin .8s linear infinite}.progress{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:13px;margin:0 0 18px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--accent,#ba7517) 28%,var(--hair,#e7e4da));border-radius:17px;background:linear-gradient(125deg,color-mix(in srgb,var(--surface,#fffef9) 78%,transparent),color-mix(in srgb,var(--accent,#ba7517) 8%,transparent));box-shadow:0 12px 30px rgba(54,43,26,.06),inset 0 1px rgba(255,255,255,.7);backdrop-filter:blur(24px) saturate(145%)}.progress strong,.progress span{display:block}.progress strong{font-size:12px}.progress span{margin-top:3px;color:var(--muted,#77766f);font-size:11px}.progress>b{font-size:15px;color:var(--accent,#ba7517)}.track{height:4px;margin-top:9px;overflow:hidden;border-radius:999px;background:rgba(122,104,73,.12)}.track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#edb742,#fff0b3);transition:width .35s ease}.lumiere-orb,.empty-orb{position:relative;width:31px;height:31px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff4bf 0 7%,#edbd54 24%,#aa6a19 73%);box-shadow:0 0 0 5px rgba(221,174,62,.09),0 8px 17px rgba(169,103,17,.2);overflow:hidden}.lumiere-orb i,.empty-orb i{position:absolute;inset:-20%;border:1px solid rgba(255,255,255,.62);border-radius:45%;animation:orb 3.4s linear infinite}.lumiere-orb i:nth-child(2),.empty-orb i:nth-child(2){animation-direction:reverse;animation-duration:2.6s}.lumiere-orb i:nth-child(3){inset:-6%;animation-duration:4.2s}.scene-list{display:grid;gap:12px}.back{justify-self:start;border:0;background:transparent;color:var(--accent,#ba7517);font-size:12px;font-weight:750;cursor:pointer}.scene-container{overflow:hidden;border:1px solid color-mix(in srgb,var(--hair,#e7e4da) 80%,transparent);border-radius:19px;background:linear-gradient(140deg,color-mix(in srgb,var(--surface,#fffef9) 77%,transparent),color-mix(in srgb,var(--bg,#f5f0e8) 72%,transparent));box-shadow:0 12px 30px rgba(47,39,23,.045),inset 0 1px rgba(255,255,255,.7);backdrop-filter:blur(22px) saturate(135%)}.scene-container.is-stale{border-color:rgba(202,93,62,.4)}.scene-container.is-generating{border-color:rgba(212,162,57,.4)}.scene-head{display:flex;align-items:center;gap:9px;padding:13px 14px}.scene-open{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:11px;flex:1;min-width:0;border:0;background:transparent;text-align:left;color:inherit;cursor:pointer}.scene-number{font-size:10px;font-weight:900;letter-spacing:.08em;color:var(--accent,#ba7517)}.scene-title{min-width:0}.scene-title strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.scene-title small{display:block;overflow:hidden;margin-top:3px;color:var(--muted,#77766f);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.scene-status{padding:4px 7px;border-radius:999px;background:color-mix(in srgb,var(--accent,#ba7517) 12%,transparent);color:var(--accent,#9a5f0d);font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.05em}.chevron{color:var(--muted,#77766f);transition:transform .18s}.is-expanded .chevron{transform:rotate(180deg)}.focus{padding:7px 9px;border:1px solid var(--hair,#e7e4da);border-radius:9px;background:rgba(255,255,255,.36);font-size:10px;font-weight:750;color:var(--ink,#2c2c2a)}.scene-meta{display:flex;gap:5px;flex-wrap:wrap;padding:0 14px 12px}.scene-meta span{padding:4px 7px;border-radius:7px;background:rgba(111,100,82,.065);color:var(--muted,#77766f);font-size:9px}.scene-meta b{color:var(--ink,#2c2c2a);font-weight:750}.diff{margin:0 14px 12px;color:#9d6522;font-size:10px;font-weight:650}.scene-content{padding:0 14px 15px;border-top:1px solid rgba(128,113,86,.09)}.scene-loading{display:flex;align-items:center;gap:9px;margin:12px 0;padding:9px 11px;border-radius:10px;background:rgba(230,177,55,.09);color:#936010;font-size:10px;font-weight:700}.scene-loading i{width:12px;height:12px;border:2px solid rgba(172,116,20,.24);border-right-color:#a96b14;border-radius:50%;animation:spin .8s linear infinite}.category-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:13px}.category{min-width:0;min-height:110px;padding:10px;border:1px solid color-mix(in srgb,var(--tone) 25%,var(--hair,#e7e4da));border-radius:13px;background:linear-gradient(145deg,color-mix(in srgb,var(--surface,#fffef9) 74%,transparent),color-mix(in srgb,var(--tone) 7%,transparent));box-shadow:inset 0 1px rgba(255,255,255,.54);backdrop-filter:blur(12px)}.category>header{display:flex;align-items:center;gap:7px;margin-bottom:8px}.category-dot{width:7px;height:7px;border-radius:50%;background:var(--tone);box-shadow:0 0 0 4px color-mix(in srgb,var(--tone) 13%,transparent)}.category h4{flex:1;margin:0;font-size:10px;letter-spacing:.025em}.category header>span:last-child{color:var(--muted,#77766f);font-size:9px}.category-elements{display:grid;gap:6px}.empty-category{padding:5px 0;color:var(--muted,#77766f);font-size:9px}.element{position:relative;display:flex;gap:7px;padding:7px;border:1px solid rgba(126,109,79,.09);border-radius:9px;background:rgba(255,255,255,.42);transition:box-shadow .16s,transform .16s}.element:hover{z-index:1;box-shadow:0 8px 16px rgba(47,38,24,.08);transform:translateY(-1px)}.element-main{min-width:0;flex:1}.element-top{display:flex;align-items:baseline;gap:5px}.element strong{overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.qty{color:var(--muted,#77766f);font-size:9px}.element p,.element small{display:block;margin:3px 0 0;color:var(--muted,#77766f);font-size:9px;line-height:1.35}.element footer{display:flex;gap:4px;align-items:center;margin-top:5px}.owner{max-width:100px;overflow:hidden;color:var(--tone);font-size:8px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}.state{margin-left:auto;padding:2px 4px;border-radius:4px;background:rgba(108,101,88,.07);color:#716b61;font-size:7px;text-transform:capitalize}.state.ready{color:#267457;background:rgba(52,141,97,.1)}.state.blocked{color:#a84a3c;background:rgba(195,71,57,.1)}.element-links{position:absolute;right:6px;top:5px;display:flex;align-items:center;gap:3px;opacity:0;transition:opacity .15s}.element:hover .element-links{opacity:1}.element-links a,.element-links button{padding:2px;border:0;background:rgba(255,255,255,.84);color:var(--accent,#9a5f0d);font-size:7px;text-decoration:none;cursor:pointer}.element-image{width:36px;height:36px;overflow:hidden;border-radius:6px;background:#e8e1d5}.element-image img{width:100%;height:100%;object-fit:cover}.element.is-editing{display:block;padding:9px;background:color-mix(in srgb,var(--tone) 7%,var(--surface,#fffef9));box-shadow:0 10px 24px rgba(50,38,24,.1)}.element-edit-grid{display:grid;grid-template-columns:1fr 72px;gap:7px}.element label{display:grid;gap:3px;color:var(--muted,#77766f);font-size:8px;font-weight:750;text-transform:uppercase;letter-spacing:.04em}.element input,.element select,.element textarea,.new-element input,.new-element select{width:100%;box-sizing:border-box;min-width:0;padding:6px 7px;border:1px solid rgba(124,109,84,.2);border-radius:7px;background:rgba(255,255,255,.75);color:var(--ink,#2c2c2a);font:600 10px inherit;outline:none}.element textarea{min-height:49px;resize:vertical}.element .wide{margin-top:7px}.element-actions{display:flex;justify-content:flex-end;align-items:center;gap:6px;margin-top:7px}.element-actions .primary,.element-actions .quiet{padding:6px 8px;border-radius:7px;font-size:9px}.attach{margin-right:auto;color:var(--accent,#9a5f0d)!important;cursor:pointer}.attach input{display:none}.add-element{margin-top:11px;padding:7px 0;background:transparent;color:var(--accent,#9a5f0d);font-size:10px;font-weight:800}.new-element{display:grid;grid-template-columns:140px 1fr 70px auto auto;gap:6px;margin-top:11px;padding:8px;border-radius:11px;background:rgba(128,107,67,.06)}.new-element .primary,.new-element .quiet{padding:7px 9px;border-radius:8px;font-size:9px}.department-view{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.department-card{overflow:hidden;border:1px solid color-mix(in srgb,var(--tone) 22%,var(--hair,#e7e4da));border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--surface,#fffef9) 78%,transparent),color-mix(in srgb,var(--tone) 6%,transparent));box-shadow:0 12px 25px rgba(44,37,24,.045);backdrop-filter:blur(18px)}.department-card>header{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid rgba(122,108,86,.08)}.department-card header>span{width:8px;height:8px;border-radius:50%;background:var(--tone)}.department-card h3{flex:1;margin:0;font-size:12px}.department-card b{font-size:10px;color:var(--muted,#77766f)}.department-card>div{display:grid;gap:1px;padding:6px}.department-item{display:grid;gap:2px;padding:7px;border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer}.department-item:hover{background:rgba(255,255,255,.58)}.department-item span{font-size:10px;font-weight:750}.department-item small,.department-card p{margin:0;color:var(--muted,#77766f);font-size:9px}.empty-state{max-width:620px;margin:55px auto;padding:39px 32px;border:1px solid color-mix(in srgb,var(--accent,#ba7517) 25%,var(--hair,#e7e4da));border-radius:24px;background:radial-gradient(circle at 72% 10%,rgba(241,195,91,.15),transparent 32%),color-mix(in srgb,var(--surface,#fffef9) 76%,transparent);box-shadow:0 22px 48px rgba(48,38,20,.07),inset 0 1px rgba(255,255,255,.76);text-align:center;backdrop-filter:blur(28px) saturate(145%)}.empty-orb{width:52px;height:52px;margin:0 auto 17px}.empty-state>span{color:var(--accent,#ba7517);font-size:9px;font-weight:850;letter-spacing:.15em}.empty-state h2{margin:9px auto;font-size:24px;letter-spacing:-.045em;line-height:1.08}.empty-state p{max-width:480px;margin:0 auto 20px;color:var(--muted,#77766f);font-size:12px;line-height:1.55}.empty-state>div{display:flex;justify-content:center;gap:8px}@keyframes spin{to{transform:rotate(360deg)}}@keyframes orb{to{transform:rotate(360deg)}}@media(max-width:1080px){.category-grid,.department-view{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.breakdown-shell{padding:2px 0 34px}.breakdown-top{align-items:flex-start;flex-direction:column;padding-bottom:18px}.breakdown-top h1{font-size:29px}.top-actions{width:100%;justify-content:space-between}.category-grid,.department-view{grid-template-columns:1fr}.scene-head{align-items:flex-start}.scene-open{grid-template-columns:auto 1fr auto}.scene-status{display:none}.focus{padding:6px}.scene-meta{gap:4px}.new-element{grid-template-columns:1fr 1fr}.new-element input:nth-child(2){grid-column:span 2}.progress{grid-template-columns:auto 1fr}.progress>b{grid-column:2}.element-links{opacity:1}.empty-state{margin:26px 0;padding:31px 20px}.empty-state h2{font-size:21px}}
    /* Liquid Glass refinement: prioritizes clear, touch-friendly actions. */
    .breakdown-shell{max-width:1480px;padding:12px 0 64px}
    .breakdown-top{align-items:center;padding:8px 2px 22px}
    .breakdown-context{max-width:460px;margin:0;color:var(--muted,#77766f);font-size:13px;line-height:1.45}
    .top-actions{gap:12px}
    .view-switch{padding:4px;border-radius:16px;background:color-mix(in srgb,var(--surface,#fffef9) 58%,transparent);box-shadow:inset 0 1px rgba(255,255,255,.85),0 10px 28px rgba(56,45,25,.06);backdrop-filter:blur(26px) saturate(150%)}
    .view-switch button{min-height:42px;padding:0 15px;border-radius:12px;font-size:12px}
    .generate,.primary{min-height:42px;padding:0 17px;border-radius:13px;font-size:12px}
    .quiet,.focus{min-height:40px;padding:0 13px;border-radius:12px;font-size:12px}
    button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--accent,#ba7517) 56%,white);outline-offset:2px}
    .scene-list{gap:14px}
    .scene-container{border-radius:22px;box-shadow:0 16px 40px rgba(47,39,23,.055),inset 0 1px rgba(255,255,255,.82)}
    .scene-head{gap:13px;padding:17px 18px}
    .scene-open{min-height:46px;gap:13px}
    .scene-number{font-size:11px}
    .scene-title strong{font-size:15px}
    .scene-title small{font-size:11px}
    .scene-status{padding:5px 9px;font-size:10px}
    .focus{border-color:color-mix(in srgb,var(--hair,#e7e4da) 70%,transparent);background:rgba(255,255,255,.52)}
    .scene-meta{gap:7px;padding:0 18px 16px}
    .scene-meta span{padding:5px 8px;border-radius:8px;font-size:10px}
    .diff{margin:0 18px 14px;font-size:11px}
    .scene-content{padding:0 18px 18px}
    .category-grid{grid-template-columns:repeat(auto-fit,minmax(278px,1fr));gap:14px;margin-top:16px}
    .category{min-height:0;padding:14px;border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--surface,#fffef9) 82%,transparent),color-mix(in srgb,var(--tone) 6%,transparent));box-shadow:inset 0 1px rgba(255,255,255,.76),0 8px 22px rgba(52,42,24,.035);backdrop-filter:blur(20px) saturate(135%)}
    .category>header{margin-bottom:11px}
    .category-dot{width:8px;height:8px}
    .category h4{font-size:12px}
    .category header>span:last-child{font-size:10px}
    .category-elements{gap:9px}
    .element{align-items:flex-start;gap:10px;min-height:64px;padding:11px;border-radius:12px;background:rgba(255,255,255,.56)}
    .element:hover{box-shadow:0 10px 22px rgba(47,38,24,.1);transform:translateY(-1px)}
    .element strong{font-size:12px}
    .qty{font-size:10px}
    .element p,.element small{font-size:10px;line-height:1.45}
    .element footer{gap:6px;margin-top:7px}
    .owner{max-width:160px;font-size:9px}
    .state{margin-left:0;padding:3px 6px;border-radius:6px;font-size:8px}
    .element-image{width:56px;height:56px;flex:0 0 56px;border-radius:9px}
    .element-open{flex:0 0 auto;align-self:center;min-height:38px;padding:0 11px;border:1px solid color-mix(in srgb,var(--tone) 35%,var(--hair,#e7e4da));border-radius:10px;background:rgba(255,255,255,.76);color:var(--ink,#2c2c2a);font:750 11px inherit;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.72)}
    .element-open:hover{background:color-mix(in srgb,var(--tone) 12%,white)}
    .element.is-script-link{cursor:pointer;isolation:isolate;transition:border-color .24s ease,background-color .24s ease,box-shadow .24s cubic-bezier(.2,.8,.2,1),transform .24s cubic-bezier(.2,.8,.2,1)}
    .element.is-script-link::after{content:'↗';position:absolute;right:12px;top:10px;z-index:-1;color:var(--tone);font-size:13px;font-weight:850;opacity:0;transform:translate3d(-4px,4px,0) scale(.92);transition:opacity .2s ease,transform .24s cubic-bezier(.2,.8,.2,1)}
    .element.is-script-link:hover,.element.is-script-link:focus-visible{border-color:color-mix(in srgb,var(--tone) 52%,var(--hair,#e7e4da));background:color-mix(in srgb,var(--tone) 8%,rgba(255,255,255,.64));box-shadow:0 13px 26px color-mix(in srgb,var(--tone) 17%,transparent),inset 0 1px rgba(255,255,255,.86);transform:translateY(-2px)}
    .element.is-script-link:focus-visible{outline:3px solid color-mix(in srgb,var(--tone) 48%,white);outline-offset:3px}
    .element.is-script-link:hover::after,.element.is-script-link:focus-visible::after{opacity:.94;transform:translate3d(0,0,0) scale(1)}
    .element.is-script-link .element-top strong{position:relative;text-decoration-line:underline;text-decoration-color:transparent;text-decoration-thickness:2px;text-underline-offset:4px;transition:color .22s ease,text-decoration-color .22s ease}
    .element.is-script-link:hover .element-top strong,.element.is-script-link:focus-visible .element-top strong{color:color-mix(in srgb,var(--tone) 82%,var(--ink,#2c2c2a));text-decoration-color:var(--tone)}
    .element-links{display:none}
    .scene-empty,.department-empty{padding:24px;border:1px dashed color-mix(in srgb,var(--hair,#e7e4da) 85%,transparent);border-radius:15px;color:var(--muted,#77766f);font-size:12px;text-align:center}
    .add-element{min-height:42px;margin-top:14px;padding:0 3px;font-size:12px;text-align:left}
    .new-element{gap:9px;margin-top:14px;padding:12px;border-radius:14px}
    .new-element .primary,.new-element .quiet{min-height:38px;padding:0 11px;font-size:10px}
    .element.is-editing{padding:14px;border-radius:14px}
    .element-edit-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
    .element-edit-head strong{font-size:13px}
    .element-edit-head .quiet{min-height:34px;padding:0 10px;font-size:10px}
    .element-edit-grid{grid-template-columns:minmax(0,1fr) 88px;gap:9px}
    .element label{gap:5px;font-size:9px}
    .element input,.element select,.element textarea,.new-element input,.new-element select{padding:8px 9px;border-radius:9px;font-size:11px}
    .element textarea{min-height:72px}
    .attachment-label{display:flex!important;align-items:center;justify-content:space-between;min-height:40px;margin-top:10px;padding:0 10px;border:1px dashed color-mix(in srgb,var(--tone) 44%,var(--hair,#e7e4da));border-radius:10px;cursor:pointer}
    .attachment-label input{position:absolute;width:1px!important;height:1px!important;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;padding:0!important;border:0!important;background:transparent!important}
    .element-connections{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
    .element-connections a{min-height:34px;display:inline-flex;align-items:center;padding:0 10px;border:1px solid color-mix(in srgb,var(--hair,#e7e4da) 85%,transparent);border-radius:9px;background:rgba(255,255,255,.56);color:var(--accent,#9a5f0d);font-size:10px;font-weight:750;text-decoration:none}
    .element-actions{margin-top:12px}
    .element-actions .primary{min-height:40px;padding:0 13px;font-size:11px}
    .department-view{grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
    .department-card{border-radius:18px}
    .department-card>header{padding:14px}
    .department-card h3{font-size:13px}
    .department-card>div{gap:4px;padding:8px}
    .department-item{min-height:58px;padding:10px;border-radius:10px}
    .department-item{transition:background-color .2s ease,box-shadow .2s ease,transform .2s cubic-bezier(.2,.8,.2,1),color .2s ease}
    .department-item:hover,.department-item:focus-visible{background:color-mix(in srgb,var(--tone) 11%,rgba(255,255,255,.62));box-shadow:0 7px 16px color-mix(in srgb,var(--tone) 14%,transparent);outline:2px solid color-mix(in srgb,var(--tone) 42%,white);outline-offset:1px;transform:translateX(2px)}
    .department-item span{text-decoration-line:underline;text-decoration-color:transparent;text-decoration-thickness:2px;text-underline-offset:4px;transition:color .2s ease,text-decoration-color .2s ease}
    .department-item:hover span,.department-item:focus-visible span{color:color-mix(in srgb,var(--tone) 82%,var(--ink,#2c2c2a));text-decoration-color:var(--tone)}
    .department-item span{font-size:12px}
    .department-item small{font-size:10px}
    @media(prefers-reduced-motion:reduce){.element.is-script-link,.element.is-script-link::after,.element.is-script-link .element-top strong,.department-item,.department-item span{transition-duration:.01ms!important}}
    @media(max-width:720px){.breakdown-top{align-items:flex-start;gap:14px}.breakdown-context{font-size:12px}.top-actions{width:100%;justify-content:space-between}.view-switch button{padding:0 11px}.scene-head{padding:14px}.scene-content{padding:0 14px 16px}.scene-meta{padding:0 14px 14px}.category-grid{grid-template-columns:1fr}.element{align-items:stretch;flex-wrap:wrap}.element-main{min-width:calc(100% - 70px)}.element-open{width:100%}.element-edit-grid{grid-template-columns:1fr}.new-element{grid-template-columns:1fr 1fr}.new-element input:nth-child(2){grid-column:span 2}}
  `; }
}

if (!customElements.get('film-script-breakdown')) customElements.define('film-script-breakdown', FilmScriptBreakdown);
