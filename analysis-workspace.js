import { buildAnalysisSnapshot } from './analysis-model.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, finite(value)));

const runtimeLabel = (seconds) => {
  const total = Math.max(0, Math.round(finite(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
};

const relativeTime = (value) => {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 15) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const language = typeof window !== 'undefined' && window.filmscriptLanguage?.get?.() === 'es' ? 'es-GT' : undefined;
  return date.toLocaleString(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const icon = (name) => {
  const paths = {
    pages: '<path d="M6 3.5h8.3L18 7.2v13.3H6z"/><path d="M14.3 3.5v3.8H18M9 11h6M9 14h6M9 17h4"/>',
    scenes: '<path d="M4 9h16v10H4zM4 9l2.4-5H20l-2.3 5M8 6.5 9.5 4M13 6.5 14.5 4"/>',
    words: '<path d="M5 6h14M5 10h12M5 14h14M5 18h9"/>',
    runtime: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    interior: '<path d="M4 11 12 4l8 7v9H4zM9 20v-6h6v6"/>',
    exterior: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="4"/>',
    day: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    night: '<path d="M18.5 15.5A8 8 0 0 1 8.5 5.2 8.2 8.2 0 1 0 18.5 15.5Z"/>',
    sparkle: '<path d="m12 3 1.4 4.2L18 9l-4.6 1.7L12 15l-1.4-4.3L6 9l4.6-1.8zM18.5 15l.6 1.8 1.9.7-1.9.7-.6 1.8-.6-1.8-1.9-.7 1.9-.7z"/>',
    download: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
    insight: '<path d="M9 18h6M10 21h4M8.5 15.5C6.9 14.4 6 12.7 6 10.7a6 6 0 0 1 12 0c0 2-.9 3.7-2.5 4.8-.6.4-.9.9-1 1.5h-5c-.1-.6-.4-1.1-1-1.5Z"/>',
    arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
    check: '<path d="m5 12 4.2 4.2L19 6.8"/>',
    alert: '<path d="M12 3.8 21 20H3zM12 9v4.5M12 17h.01"/>',
    location: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
    people: '<path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 20v-2.2c0-2.7 2.2-4.8 5-4.8s5 2.1 5 4.8V20M16 12a2.5 2.5 0 1 0 0-5M15.5 14c2.8 0 5 1.8 5 4.2V20"/>',
    flow: '<path d="M3 16c3-1 4-8 7-8s4 7 7 7c1.5 0 2.5-2 4-5"/><path d="m18 8 3 2-2 3"/>',
    production: '<path d="M4 7h16v12H4zM8 7l2-3h4l2 3M8 12h8M8 15h5"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.sparkle}</svg>`;
};

class FilmScriptAnalysis extends HTMLElement {
  static get observedAttributes() { return ['script-id', 'project-title', 'pro-active']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.analysis = null;
    this.job = null;
    this.loading = true;
    this.error = '';
    this.filterKey = '';
    this.productionFocus = 'complex';
    this.detailOpen = false;
    this.genreFeedbackOpen = false;
    this.selectedContext = null;
    this.analysisRequested = false;
    this.analysisStarting = false;
    this.deepAnswers = { visualStyle: '', references: '', genre: '', color: '', other: '' };
    this._animateEntry = true;
    this._requestedHashes = new Set();
    this._onWindowChange = (event) => this.onScriptChange(event);
    this._onWindowSaved = (event) => this.onScriptSaved(event);
    this._onLanguageChange = () => this.render();
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this._onClick);
    this.shadowRoot.addEventListener('change', this._onChange);
    this.shadowRoot.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('filmscript:script-change', this._onWindowChange);
    window.addEventListener('filmscript:script-saved', this._onWindowSaved);
    window.addEventListener('filmscript:language-change', this._onLanguageChange);
    this.load();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener('click', this._onClick);
    this.shadowRoot.removeEventListener('change', this._onChange);
    this.shadowRoot.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('filmscript:script-change', this._onWindowChange);
    window.removeEventListener('filmscript:script-saved', this._onWindowSaved);
    window.removeEventListener('filmscript:language-change', this._onLanguageChange);
    clearTimeout(this._metricTimer);
    clearTimeout(this._syncTimer);
    clearTimeout(this._quietAnalysisTimer);
    clearTimeout(this._pollTimer);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.isConnected || oldValue === newValue) return;
    if (name === 'script-id') {
      this.analysisRequested = false;
      this.analysisStarting = false;
      this.load();
    }
    if (name === 'pro-active') this.render();
  }

  get scriptId() { return this.getAttribute('script-id') || ''; }
  get projectTitle() { return this.getAttribute('project-title') || 'Untitled screenplay'; }
  get proActive() { return this.getAttribute('pro-active') === 'true'; }

  // The server owns the analysis job, so this component can disappear when the
  // writer returns to the script without cancelling the reading. The editor
  // shell listens for this small status signal and keeps polling in the
  // background until the job reaches a terminal state.
  publishBackgroundStatus() {
    if (!this.scriptId) return;
    const status = this.analysisStarting ? 'starting' : String(this.analysis?.status || 'idle');
    const active = ['starting', 'queued', 'running'].includes(status);
    const spanish = window.filmscriptLanguage?.get?.() === 'es';
    const label = active
      ? (spanish ? 'Lumiere está analizando' : 'Lumiere is analyzing')
      : status === 'complete'
        ? (spanish ? 'Análisis listo' : 'Analysis ready')
        : status === 'stale'
          ? (spanish ? 'El guion cambió durante el análisis' : 'The screenplay changed during analysis')
          : status === 'error' || status === 'interrupted'
            ? (spanish ? 'El análisis necesita atención' : 'Analysis needs attention')
            : '';
    const detail = {
      scriptId: this.scriptId,
      status,
      active,
      label,
      message: this.analysis?.statusMessage || '',
      updatedAt: this.analysis?.updatedAt || new Date().toISOString(),
    };
    const key = [detail.scriptId, detail.status, detail.message, detail.updatedAt].join('|');
    if (key === this._backgroundStatusKey) return;
    this._backgroundStatusKey = key;
    window.dispatchEvent(new CustomEvent('filmscript:analysis-background', { detail }));
  }

  collectLiveBlocks() {
    const pages = Array.from(document.querySelectorAll('[data-fs-page]'));
    const blocks = [];
    pages.forEach((page, pageIndex) => {
      Array.from(page.children).filter((node) => node.dataset?.type).forEach((node) => {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('[data-marker]').forEach((marker) => marker.remove());
        blocks.push({ type: String(node.dataset.type || 'action'), text: String(clone.innerText || clone.textContent || '').replace(/\u00a0/g, ' ').trim() });
      });
      if (pageIndex < pages.length - 1) blocks.push({ type: 'pagebreak', text: '' });
    });
    return blocks;
  }

  onScriptChange(event) {
    if (event?.detail?.scriptId !== this.scriptId || !this.analysis) return;
    clearTimeout(this._metricTimer);
    this._metricTimer = window.setTimeout(() => {
      const blocks = this.collectLiveBlocks();
      if (!blocks.length) return;
      const snapshot = buildAnalysisSnapshot({ id: this.scriptId, updatedAt: new Date().toISOString(), blocks }, this.analysis);
      if (snapshot.contentHash === this.analysis.contentHash) return;
      const currentDeep = this.analysis.deep || this.analysis.previousDeep || null;
      this.analysis = {
        ...this.analysis,
        ...snapshot,
        deep: null,
        previousDeep: currentDeep ? { ...currentDeep, current: false } : null,
        status: 'updating',
        statusMessage: 'Updating live screenplay metrics',
        updatedAt: new Date().toISOString(),
      };
      this.render();
    }, 420);
  }

  onScriptSaved(event) {
    if (event?.detail?.scriptId !== this.scriptId) return;
    clearTimeout(this._syncTimer);
    this._syncTimer = window.setTimeout(() => this.refreshAfterSave(), 2600);
  }

  async refreshAfterSave() {
    if (!this.scriptId || !window.filmscriptAnalysis) return;
    try {
      const result = await window.filmscriptAnalysis.get(this.scriptId);
      this.analysis = result.analysis;
      this.job = result.job || null;
      this.loading = false;
      this.error = ['error', 'interrupted'].includes(this.analysis?.status)
        ? this.analysis.statusMessage || ''
        : '';
      this.render();
      // Saving a screenplay only refreshes its metrics. A new Lumiere pass
      // must always be started intentionally from Start analysis or Refresh.
      clearTimeout(this._quietAnalysisTimer);
    } catch (error) {
      this.error = error.message || 'Could not refresh Analysis.';
      this.render();
    }
  }

  isMeaningfulChange() {
    const baseline = this._deepBaseline;
    const metrics = this.analysis?.metrics || {};
    if (!baseline) return true;
    return metrics.scenes !== baseline.scenes
      || Math.abs(finite(metrics.words) - finite(baseline.words)) >= 18
      || metrics.interiorScenes !== baseline.interiorScenes
      || metrics.exteriorScenes !== baseline.exteriorScenes
      || metrics.dayScenes !== baseline.dayScenes
      || metrics.nightScenes !== baseline.nightScenes;
  }

  rememberDeepBaseline() {
    if (!this.analysis?.deep) return;
    const metrics = this.analysis.metrics || {};
    this._deepBaseline = {
      hash: this.analysis.deep.contentHash,
      words: metrics.words,
      scenes: metrics.scenes,
      interiorScenes: metrics.interiorScenes,
      exteriorScenes: metrics.exteriorScenes,
      dayScenes: metrics.dayScenes,
      nightScenes: metrics.nightScenes,
    };
  }

  async load({ startAnalysis = false } = {}) {
    clearTimeout(this._pollTimer);
    this._animateEntry = true;
    if (!this.scriptId || !window.filmscriptAnalysis) {
      this.loading = false;
      this.analysisStarting = false;
      this.error = 'Analysis is not available for this screenplay.';
      this.render();
      return;
    }
    this.loading = true;
    this.error = '';
    this.render();
    try {
      const result = await window.filmscriptAnalysis.get(this.scriptId);
      this.analysis = result.analysis;
      this.job = result.job || null;
      this.loading = false;
      this.error = ['error', 'interrupted'].includes(this.analysis?.status)
        ? this.analysis.statusMessage || ''
        : '';
      this.rememberDeepBaseline();
      this.render();
      if (['queued', 'running'].includes(this.analysis?.status)) this.poll();
      else if (startAnalysis) this.maybeStartAnalysis(true);
    } catch (error) {
      this.loading = false;
      this.analysisStarting = false;
      this.error = error.message || 'Could not load Analysis.';
      this.render();
    }
  }

  async refreshFromEditor() {
    this.analysisRequested = true;
    this.analysisStarting = true;
    this.render();
    await this.load({ startAnalysis: true });
  }

  async maybeStartAnalysis(force = false) {
    if (!this.analysisRequested && !force) return;
    const analysis = this.analysis;
    if (!analysis || !analysis.hasEnoughContent || !this.proActive || !window.filmscriptAnalysis) {
      this.analysisStarting = false;
      this.render();
      return;
    }
    if (analysis.deep?.contentHash === analysis.contentHash || ['queued', 'running'].includes(analysis.status)) {
      this.analysisStarting = false;
      this.render();
      return;
    }
    if (!force && !this.isMeaningfulChange() && analysis.previousDeep) {
      this.analysisStarting = false;
      this.render();
      return;
    }
    if (this._requestedHashes.has(analysis.contentHash)) return;
    this._requestedHashes.add(analysis.contentHash);
    try {
      const language = window.filmscriptLanguage?.get?.() === 'es' ? 'es' : 'en';
      const result = await window.filmscriptAnalysis.analyze(this.scriptId, { mode: this.analysisMode || 'quick', answers: this.deepAnswers, language });
      this.analysis = result.analysis;
      this.job = result.job || null;
      this.error = '';
      this.analysisStarting = false;
      this.render();
      if (['queued', 'running'].includes(this.analysis?.status)) this.poll();
    } catch (error) {
      this._requestedHashes.delete(analysis.contentHash);
      this.analysisStarting = false;
      this.error = error.message || 'Lumiere could not start this analysis.';
      this.render();
    }
  }

  poll() {
    clearTimeout(this._pollTimer);
    this._pollTimer = window.setTimeout(async () => {
      try {
        const result = await window.filmscriptAnalysis.get(this.scriptId);
        this.analysis = result.analysis;
        this.job = result.job || null;
        this.error = ['error', 'interrupted'].includes(this.analysis?.status)
          ? this.analysis.statusMessage || ''
          : '';
        this.render();
        if (['queued', 'running'].includes(this.analysis?.status)) this.poll();
        else {
          this.analysisStarting = false;
          this.rememberDeepBaseline();
          this._requestedHashes.delete(this.analysis?.contentHash);
        }
      } catch (error) {
        this.analysisStarting = false;
        this.error = error.message || 'Could not update Analysis.';
        this.render();
      }
    }, 1450);
  }

  async patch(change) {
    try {
      const result = await window.filmscriptAnalysis.update(this.scriptId, change);
      this.analysis = result.analysis;
      this.render();
    } catch (error) {
      this.error = error.message || 'Could not save that Analysis change.';
      this.render();
    }
  }

  openScene(sceneId) {
    const scene = (this.analysis?.sceneIndex || []).find((item) => item.id === sceneId);
    if (!scene) return;
    this.dispatchEvent(new CustomEvent('filmscript:analysis-open-scene', { bubbles: true, composed: true, detail: { sceneId, sceneNumber: scene.sceneNumber } }));
  }

  askLumiere(context = null) {
    const selected = context || this.selectedContext || {};
    const analysis = this.analysis || {};
    const deep = analysis.deep || analysis.previousDeep || {};
    const lines = [
      spanish ? 'Ayúdame a entender este resultado del análisis sin reescribir mi guion.' : 'Help me understand this Analysis result without rewriting my screenplay.',
      spanish ? `Versión actual del guion: ${analysis.scriptVersion || 'actual'}.` : `Current script version: ${analysis.scriptVersion || 'current'}.`,
    ];
    if (selected.label) lines.push(spanish ? `Contexto seleccionado del análisis: ${selected.label}.` : `Selected Analysis context: ${selected.label}.`);
    if (selected.question) lines.push(spanish ? `Pregunta del guionista: ${selected.question}` : `Writer's question: ${selected.question}`);
    if (selected.text) lines.push(spanish ? `Observación: ${selected.text}` : `Observation: ${selected.text}`);
    if (selected.sceneIds?.length) lines.push(spanish ? `Escenas relevantes: ${selected.sceneIds.join(', ')}.` : `Relevant scenes: ${selected.sceneIds.join(', ')}.`);
    if (!selected.text && deep.insight?.text) lines.push(spanish ? `Observación actual de Lumiere: ${deep.insight.text}` : `Current Lumiere Insight: ${deep.insight.text}`);
    this.dispatchEvent(new CustomEvent('filmscript:analysis-ask-lumiere', { bubbles: true, composed: true, detail: { prompt: lines.join('\n'), context: selected } }));
  }

  _onClick = (event) => {
    const target = event.target.closest?.('[data-action], [data-scene-id]');
    if (!target) return;
    const action = target.dataset.action;
    if (!action && target.dataset.sceneId) return this.openScene(target.dataset.sceneId);
    if (action === 'open-editor') this.dispatchEvent(new CustomEvent('filmscript:analysis-open-editor', { bubbles: true, composed: true }));
    if (action === 'retry') {
      this.analysisRequested = true;
      this.analysisStarting = true;
      this.render();
      this.maybeStartAnalysis(true);
    }
    if (action === 'refresh') this.refreshFromEditor();
    if (action === 'reanalyze') this.startAnalysis('quick');
    if (action === 'start-analysis') this.startAnalysis('quick');
    if (action === 'start-quick') this.startAnalysis('quick');
    if (action === 'start-deep') this.startAnalysis('deep');
    if (action === 'export') {
      const link = document.createElement('a');
      link.href = window.filmscriptAnalysis.exportUrl(this.scriptId);
      link.download = `${this.projectTitle.replace(/[^a-z0-9 _-]+/gi, '').trim() || 'FilmScript'} Analysis.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    if (action === 'scene-filter') {
      this.filterKey = target.dataset.filterKey || '';
      this.render();
    }
    if (action === 'production-focus') {
      this.productionFocus = target.dataset.focus || 'complex';
      this.render();
    }
    if (action === 'open-mode') {
      const scene = (this.analysis?.sceneIndex || []).find((item) => item.id === target.dataset.sceneId);
      this.dispatchEvent(new CustomEvent('filmscript:analysis-open-mode', {
        bubbles: true,
        composed: true,
        detail: { mode: target.dataset.mode, sceneId: scene?.id || '', sceneNumber: scene?.sceneNumber || 1 },
      }));
    }
    if (action === 'ask-context') {
      const sourceQuestion = target.dataset.prompt || target.textContent?.trim() || '';
      const question = window.filmscriptLanguage?.get?.() === 'es'
        ? (window.filmscriptLanguage?.t?.(sourceQuestion, 'es') || sourceQuestion)
        : sourceQuestion;
      this.askLumiere({
        label: target.dataset.context || 'Analysis',
        question,
        sceneIds: target.dataset.sceneId ? [target.dataset.sceneId] : [],
      });
    }
    if (action === 'ask-lumiere') this.askLumiere();
    if (action === 'artistic-decision') {
      const spanish = window.filmscriptLanguage?.get?.() === 'es';
      const decision = window.prompt(spanish ? 'Describe la decisión artística que Lumiere debe recordar:' : 'Describe the artistic decision Lumiere should remember:', target.dataset.decision || (spanish ? 'Esta ambigüedad es intencional y no debe tratarse como un error del guion.' : 'This ambiguity is intentional and should not be treated as a script error.'));
      if (decision?.trim()) this.patch({
        action: 'artisticDecision',
        key: target.dataset.key,
        decision: decision.trim(),
        sceneId: target.dataset.sceneId,
        sceneIds: (target.dataset.sceneIds || '').split(',').map((id) => id.trim()).filter(Boolean),
        observationId: target.dataset.observationId,
        observationTitle: target.dataset.observationTitle || target.dataset.key,
      });
    }
  };

  _onChange = (event) => {
    const target = event.target;
    if (target.matches('[data-deep-answer]')) this.deepAnswers[target.dataset.deepAnswer] = target.value;
    if (target.matches('[data-moment-scene]')) this.patch({ action: 'moment', momentId: target.dataset.momentId, status: target.dataset.momentStatus || 'suggested', sceneId: target.value });
    if (target.matches('[data-structure-select]')) this.patch({ action: 'structure', label: target.value, status: 'overridden' });
    if (target.matches('[data-genre-select]')) this.patch({ action: 'genre', label: target.value });
  };

  _onKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.dataset?.sceneId) {
      event.preventDefault();
      this.openScene(event.target.dataset.sceneId);
    }
    if (event.key === 'Escape' && this.detailOpen) { this.detailOpen = false; this.render(); }
  };

  statusCopy() {
    const analysis = this.analysis || {};
    if (this.analysisStarting) return 'Reading screenplay';
    if (['queued', 'running', 'updating'].includes(analysis.status)) return this.analysisStageLabel();
    if (analysis.status === 'complete') return `Analysis updated · Last updated ${relativeTime(analysis.deep?.generatedAt || analysis.updatedAt)}`;
    if (analysis.status === 'stale') return this.proActive ? 'Updating analysis… Previous deep results are clearly marked.' : 'Live metrics are current. A previous Lumiere reading belongs to an earlier script version.';
    if (analysis.status === 'error' || analysis.status === 'interrupted') return analysis.statusMessage || 'Lumiere could not finish this pass.';
    if (analysis.status === 'insufficient') return 'Live metrics update as you write.';
    return 'Live screenplay analysis';
  }

  analysisStageLabel() {
    const stages = {
      queued: 'Reading screenplay',
      validating: 'Reading screenplay',
      reading_screenplay: 'Reading screenplay',
      identifying_scenes: 'Identifying scenes',
      mapping_characters: 'Mapping characters',
      reviewing_locations: 'Reviewing locations',
      evaluating_production_requirements: 'Evaluating production requirements',
      building_analysis: 'Building analysis',
      finalizing_results: 'Finalizing results',
    };
    return stages[this.job?.stage] || this.analysis?.statusMessage || 'Reading screenplay';
  }

  emptyState() {
    if (this.analysis?.hasEnoughContent && !this.analysis?.deep && !this.analysis?.previousDeep && !this.analysisRequested && !this.analysisStarting && !['queued', 'running'].includes(this.analysis?.status)) return `<main class="analysis-start" aria-labelledby="analysis-start-title"><div class="empty-spark">${icon('sparkle')}</div><span class="section-kicker">Lumiere</span><h1 id="analysis-start-title">Your screenplay is ready to read</h1><p>Analysis starts only when you choose it. Your edits never spend credits automatically.</p><button type="button" class="primary analysis-start-button" data-action="start-analysis">${icon('sparkle')}Analyze</button></main>`;
    return `<main class="empty" aria-labelledby="analysis-empty-title">
      <div class="empty-spark">${icon('sparkle')}</div>
      <h1 id="analysis-empty-title">Analysis</h1>
      <p>Write a few scenes and Lumiere will begin analyzing your screenplay.</p>
      <button type="button" class="primary" data-action="open-editor">Open Script Editor</button>
    </main>`;
  }

  startAnalysis(mode = 'quick') {
    this.analysisRequested = true;
    this.analysisMode = mode;
    this.analysisStarting = true;
    this.error = '';
    this.render();
    this.maybeStartAnalysis(true);
  }

  analysisProgressBar(active) {
    if (!active) return '';
    const progress = Math.max(4, Math.min(96, finite(this.job?.progress, this.analysisStarting ? 4 : 12)));
    return `<div class="analysis-progress" role="status" aria-live="polite"><div class="analysis-progress-copy"><span class="reading-dot"></span><div><strong>${escapeHtml(this.analysisStageLabel())}</strong><span>FilmScript is preparing a new analysis from the current screenplay.</span></div><b>${progress}%</b></div><div class="analysis-progress-track" aria-hidden="true"><i style="width:${progress}%"></i></div></div>`;
  }

  processingState() {
    const progress = Math.max(4, Math.min(96, finite(this.job?.progress, this.analysisStarting ? 4 : 12)));
    const stage = this.analysisStageLabel();
    const stages = ['Reading screenplay', 'Identifying scenes', 'Mapping characters', 'Reviewing locations', 'Evaluating production requirements', 'Building analysis', 'Finalizing results'];
    const activeIndex = Math.max(0, stages.indexOf(stage));
    return `<main class="analysis-processing" aria-labelledby="analysis-processing-title" aria-live="polite"><section class="analysis-processing-glass"><div class="analysis-orbit" aria-hidden="true"><i></i><i></i><i></i><span>${icon('sparkle')}</span></div><span class="section-kicker">Lumiere · Analysis</span><h1 id="analysis-processing-title">Reading the current screenplay</h1><p>${escapeHtml(stage)}</p><div class="analysis-stage-progress"><div><span>Progress</span><strong>${progress}%</strong></div><i><b style="width:${progress}%"></b></i></div><ol>${stages.map((item, index) => `<li class="${index < activeIndex ? 'is-complete' : index === activeIndex ? 'is-current' : ''}"><i></i><span>${escapeHtml(item)}</span></li>`).join('')}</ol><small>You can leave this page. Lumiere will keep working and notify you when it is ready.</small></section></main>`;
  }

  waitingBlock(label) {
    if (!this.analysis?.hasEnoughContent) return `<div class="calm-state">More screenplay context is needed before Lumiere can interpret ${escapeHtml(label.toLowerCase())}.</div>`;
    if (!this.proActive && !this.analysis?.deep && !this.analysis?.previousDeep) return `<div class="calm-state">Creator or Full unlocks a new Lumiere ${escapeHtml(label.toLowerCase())} analysis.</div>`;
    return `<div class="calm-state"><span class="reading-dot"></span>Lumiere is reading the current draft…</div>`;
  }

  localStoryFlow(metrics = {}) {
    const scenes = Array.isArray(this.analysis?.sceneIndex) ? this.analysis.sceneIndex : [];
    if (!scenes.length) return [];
    const averageWords = scenes.reduce((total, scene) => total + finite(scene.words), 0) / Math.max(1, scenes.length);
    const averageSeconds = finite(metrics.averageSceneSeconds, 0);
    return scenes.map((scene, index) => {
      const words = finite(scene.words);
      const dialogueRatio = words ? finite(scene.dialogueWords) / words : .5;
      const lengthSignal = averageWords ? (words / averageWords) * 18 : 18;
      const positionSignal = scenes.length > 1 ? (index / (scenes.length - 1)) * 11 : 5;
      const durationSignal = averageSeconds && finite(scene.estimatedSeconds) ? (finite(scene.estimatedSeconds) / averageSeconds) * 8 : 0;
      const value = Math.round(clamp(36 + lengthSignal + dialogueRatio * 14 + positionSignal + durationSignal, 14, 92));
      return {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        heading: scene.heading,
        value,
        label: 'Live draft signal',
        explanation: 'A quick rhythm signal from scene length and dialogue/action balance. Lumiere refines it when the full reading is ready.',
        marker: '',
        confidence: 0,
      };
    });
  }

  normalizeInsightData(deep, metrics) {
    const sceneMap = new Map((this.analysis?.sceneIndex || []).map((scene) => [scene.id, scene]));
    const spanish = typeof window !== 'undefined' && window.filmscriptLanguage?.get?.() === 'es';
    const migrate = (item, title, explanation, sceneIds = []) => {
      const ids = (sceneIds || []).filter((id) => sceneMap.has(id));
      const scene = sceneMap.get(ids[0]);
      return {
        id: item?.id || `${title}:${ids.join(':')}`,
        title: title || 'Screenplay observation',
        explanation: explanation || '',
        sceneId: ids[0] || '',
        sceneIds: ids,
        sceneNumber: scene?.sceneNumber,
        page: scene?.page,
        heading: scene?.heading,
        referenceText: item?.referenceText || '',
        priority: item?.priority || 'medium',
        confidence: item?.confidence,
        factors: item?.factors || [],
      };
    };
    const legacyMoments = (deep?.moments || []).filter((item) => item.status !== 'dismissed').map((item) => migrate(item, item.label, item.reason, [item.sceneId]));
    const legacySuggestions = (deep?.suggestions || []).map((item, index) => migrate(item, `Priority ${index + 1}`, item.text, item.sceneIds));
    const working = deep?.overview?.working?.length ? deep.overview.working : legacyMoments.slice(0, 3);
    const needsAttention = deep?.overview?.needsAttention?.length ? deep.overview.needsAttention : legacySuggestions.slice(0, 3);
    const productionImpact = deep?.overview?.productionImpact || [];
    const legacyClarity = (deep?.structure?.sections || []).slice(0, 4).map((item, index) => ({
      ...migrate(item, item.label, item.reason, [item.startSceneId]),
      stage: ['Start', 'Conflict', 'Peak', 'Ending'][index] || `Beat ${index + 1}`,
    }));
    const storyClarity = {
      summary: deep?.storyClarity?.summary || deep?.structure?.reason || '',
      points: deep?.storyClarity?.points?.length ? deep.storyClarity.points : legacyClarity,
    };
    const modelFlowPoints = deep?.storyFlow?.points?.length ? deep.storyFlow.points : (deep?.emotionalArc?.length ? deep.emotionalArc : deep?.pacing || []);
    const storyFlow = {
      points: modelFlowPoints.length ? modelFlowPoints : this.localStoryFlow(metrics),
      preview: !modelFlowPoints.length,
      takeaway: deep?.storyFlow?.takeaway || (deep?.insight ? migrate(deep.insight, 'What to examine next', deep.insight.text, deep.insight.sceneIds) : null),
    };
    const sceneIssues = deep?.sceneIssues?.length ? deep.sceneIssues : legacySuggestions;
    const keyMoments = deep?.keyMoments?.length ? deep.keyMoments : legacyMoments;
    const production = deep?.productionOverview || {};
    const productionOverview = {
      locations: production.locations || { count: metrics.locations?.length || 0, sceneIds: [] },
      characters: production.characters || { count: metrics.characters?.length || 0, sceneIds: [] },
      nightScenes: production.nightScenes || { count: finite(metrics.nightScenes), sceneIds: [] },
      complexScenes: production.complexScenes || [],
    };
    const contextualQuestions = deep?.contextualQuestions || {
      story: [{ label: 'Where does it slow?', prompt: 'Where does this screenplay lose momentum, and why?' }, { label: 'What can be cut?', prompt: 'Which scenes repeat information or can be cut without harming the story?' }],
      characters: [{ label: 'Who feels thin?', prompt: 'Which character needs a clearer want or stronger dramatic choice?' }],
      production: [{ label: 'What costs more?', prompt: 'Which scenes are likely to be the most complex or expensive to produce?' }],
    };
    return {
      status: deep?.statusSummary || { label: 'Developing', reason: 'Lumiere is building a screenplay-specific reading.' },
      overview: { working, needsAttention, productionImpact },
      storyClarity,
      storyFlow,
      sceneIssues,
      keyMoments,
      productionOverview,
      contextualQuestions,
    };
  }

  sceneReference(item) {
    const sceneMap = new Map((this.analysis?.sceneIndex || []).map((scene) => [scene.id, scene]));
    const scenes = Array.from(new Set([item?.sceneId, ...(item?.sceneIds || [])])).map((id) => sceneMap.get(id)).filter(Boolean);
    if (!scenes.length) return { id: '', label: 'Screenplay evidence', scenes: [] };
    const numbers = scenes.map((scene) => scene.sceneNumber);
    const pages = Array.from(new Set(scenes.map((scene) => scene.page)));
    return {
      id: scenes[0].id,
      scenes,
      label: `${scenes.length === 1 ? 'Scene' : 'Scenes'} ${numbers.join(', ')} · ${pages.length === 1 ? 'Page' : 'Pages'} ${pages.join(', ')}`,
    };
  }

  evidenceDetails(item) {
    if (!item?.referenceText) return '';
    return `<details class="evidence"><summary>Evidence</summary><blockquote>“${escapeHtml(item.referenceText)}”</blockquote></details>`;
  }

  insightRow(item, tone = 'neutral', actionLabel = 'View in Script') {
    const reference = this.sceneReference(item);
    const toneIcon = tone === 'working' ? 'check' : tone === 'attention' ? 'alert' : 'production';
    return `<article class="insight-row ${tone}">
      <span class="insight-signal">${icon(toneIcon)}</span>
      <div class="insight-copy"><h3>${escapeHtml(item.title)}</h3><p title="${escapeHtml(item.explanation)}">${escapeHtml(item.explanation)}</p>${this.evidenceDetails(item)}
        <div class="insight-foot"><span>${escapeHtml(reference.label)}</span>${tone === 'attention' ? `<button type="button" data-action="artistic-decision" data-key="${escapeHtml(item.title)}" data-decision="${escapeHtml(item.title)} is an intentional artistic choice." data-scene-id="${escapeHtml(reference.id || '')}" data-scene-ids="${escapeHtml((item.sceneIds || []).join(','))}" data-observation-id="${escapeHtml(item.id || '')}" data-observation-title="${escapeHtml(item.title || '')}">Mark intentional</button>` : ''}${reference.id ? `<button type="button" data-scene-id="${escapeHtml(reference.id)}">${escapeHtml(actionLabel)}${icon('arrow')}</button>` : ''}</div>
      </div>
    </article>`;
  }

  priorityColumn(title, items, tone, emptyCopy, deepReady) {
    const body = items?.length
      ? items.slice(0, 3).map((item) => this.insightRow(item, tone)).join('')
      : deepReady ? `<p class="quiet-empty">${escapeHtml(emptyCopy)}</p>` : this.waitingBlock(title);
    return `<section class="priority-column ${tone}" aria-labelledby="priority-${tone}"><header><span>${icon(tone === 'working' ? 'check' : tone === 'attention' ? 'alert' : 'production')}</span><h2 id="priority-${tone}">${escapeHtml(title)}</h2></header><div class="priority-list">${body}</div></section>`;
  }

  signalCard(title, items, tone, emptyCopy, deepReady) {
    const entries = Array.isArray(items) ? items : [];
    const first = entries[0];
    const toneIcon = tone === 'working' ? 'check' : tone === 'attention' ? 'alert' : 'production';
    const label = entries.length === 1 ? 'signal' : 'signals';
    const body = entries.length
      ? entries.slice(0, 4).map((item) => this.insightRow(item, tone)).join('')
      : deepReady ? `<p class="quiet-empty">${escapeHtml(emptyCopy)}</p>` : this.waitingBlock(title);
    return `<details class="signal-card ${tone}">
      <summary>
        <span class="signal-card-icon">${icon(toneIcon)}</span>
        <span class="signal-card-copy"><small>${escapeHtml(title)}</small><strong>${entries.length} ${label}</strong>${first ? `<em>${escapeHtml(first.title)}</em><span class="signal-hover-copy">${escapeHtml(first.explanation)}</span>` : ''}</span>
        <span class="signal-card-chevron">${icon('chevron')}</span>
      </summary>
      <div class="signal-card-body">${body}</div>
    </details>`;
  }

  analysisFocusPanel(data, stale, deepReady) {
    const priorities = data.overview.needsAttention || [];
    const strengths = data.overview.working || [];
    const primary = priorities[0] || data.storyFlow.takeaway || strengths[0] || null;
    const reference = this.sceneReference(primary);
    const title = primary?.title || data.status.label || 'Lumiere is reading the current draft';
    const explanation = primary?.explanation || data.status.reason || 'The screenplay needs more evidence before Lumiere can identify a useful next step.';
    const scenes = this.analysis?.sceneIndex?.length || 0;
    const focusPrompt = 'Help me understand the most important change I should consider next, using evidence from this screenplay.';
    return `<section class="analysis-focus-grid ${stale ? 'is-previous' : ''}" aria-labelledby="analysis-focus-heading">
      <article class="analysis-focus-card">
        <div class="focus-card-top"><span class="focus-spark">${icon('sparkle')}</span><span class="section-kicker">Lumiere focus</span><span class="focus-status">${escapeHtml(data.status.label || 'Developing')}</span></div>
        <h2 id="analysis-focus-heading">${escapeHtml(title)}</h2>
        <p class="focus-preview">${escapeHtml(explanation)}</p>
        <div class="focus-actions">${reference.id ? `<button type="button" class="primary" data-scene-id="${escapeHtml(reference.id)}">Open priority scene${icon('arrow')}</button>` : ''}<button type="button" class="focus-ask" data-action="ask-context" data-context="Draft focus" data-prompt="${escapeHtml(focusPrompt)}">${icon('sparkle')}Ask Lumiere</button></div>
        <div class="focus-stats" aria-label="Analysis summary"><span><strong>${strengths.length}</strong><small>strengths</small></span><span><strong>${priorities.length}</strong><small>priorities</small></span><span><strong>${scenes}</strong><small>scenes read</small></span></div>
      </article>
      <div class="signal-stack" aria-label="Screenplay signals">
        ${this.signalCard('What’s working', strengths, 'working', 'No clear strength has enough evidence yet.', deepReady)}
        ${this.signalCard('Needs attention', priorities, 'attention', 'No critical writing issue was identified in this pass.', deepReady)}
      </div>
    </section>`;
  }

  productionImpactPanel(data, deepReady) {
    const impacts = data.overview.productionImpact || [];
    const body = impacts.length
      ? impacts.slice(0, 4).map((item) => this.insightRow(item, 'production')).join('')
      : deepReady ? '<p class="quiet-empty">No material production impact was identified in this pass.</p>' : this.waitingBlock('production impact');
    return `<section class="drawer-production-impact" aria-labelledby="production-impact-heading"><div class="subsection-heading"><div><span class="section-kicker">From the screenplay</span><h3 id="production-impact-heading">Production impact</h3></div><span>${impacts.length}</span></div><div class="production-impact-grid">${body}</div></section>`;
  }

  secondaryInsightsPanel(data, stale, deepReady) {
    const issueCount = data.sceneIssues?.length || 0;
    const momentCount = data.keyMoments?.length || 0;
    const productionCount = data.overview.productionImpact?.length || 0;
    const complexCount = new Set((data.productionOverview.complexScenes || []).flatMap((item) => item.sceneIds?.length ? item.sceneIds : [item.sceneId]).filter(Boolean)).size;
    return `<section class="analysis-library ${stale ? 'is-previous' : ''}" aria-labelledby="analysis-library-heading">
      <div class="section-heading library-heading"><div><span class="section-kicker">Explore further</span><h2 id="analysis-library-heading">More from this reading</h2><p>Open only the lens you need. The essential writing decisions stay above.</p></div></div>
      <div class="analysis-drawers">
        <details class="analysis-drawer">
          <summary><span class="drawer-icon">${icon('scenes')}</span><span><strong>Scene notes</strong><small>Specific issues and moments worth revisiting</small></span><em>${issueCount} fixes · ${momentCount} moments</em>${icon('chevron')}</summary>
          <div class="drawer-body"><div class="story-pair">${this.sceneIssuesPanel(data, deepReady)}${this.keyMomentsPanel(data, deepReady)}</div></div>
        </details>
        <details class="analysis-drawer">
          <summary><span class="drawer-icon production">${icon('production')}</span><span><strong>Production lens</strong><small>Complexity that may affect how the screenplay is made</small></span><em>${productionCount} impacts · ${complexCount} complex scenes</em>${icon('chevron')}</summary>
          <div class="drawer-body">${this.productionImpactPanel(data, deepReady)}${this.productionPanel(data, stale, deepReady)}</div>
        </details>
      </div>
    </section>`;
  }

  contextualAssistant(label, questions = []) {
    if (!questions.length) return '';
    const shortLabel = (value) => {
      const text = String(value || 'Ask Lumiere').trim();
      return text.length > 72 ? `${text.slice(0, 71).replace(/\s+\S*$/, '')}…` : text;
    };
    return `<div class="contextual-assistant" aria-label="Ask Lumiere about ${escapeHtml(label)}"><span>${icon('sparkle')}Ask Lumiere</span><div>${questions.slice(0, 3).map((item) => `<button type="button" data-action="ask-context" data-context="${escapeHtml(label)}" data-prompt="${escapeHtml(item.prompt)}">${escapeHtml(shortLabel(item.label))}</button>`).join('')}</div></div>`;
  }

  storyClarityPanel(data, stale) {
    const points = data.storyClarity.points || [];
    return `<section class="analysis-section story-section ${stale ? 'is-previous' : ''}" aria-labelledby="story-heading">
      <div class="section-heading"><div><span class="section-kicker">Story</span><h2 id="story-heading">Story clarity</h2><p>${escapeHtml(data.storyClarity.summary || 'Where the screenplay begins, turns, peaks, and lands.')}</p></div>${this.contextualAssistant('Story', data.contextualQuestions.story)}</div>
      ${points.length ? `<ol class="clarity-track" aria-label="Story clarity timeline">${points.slice(0, 4).map((point, index) => {
        const reference = this.sceneReference(point);
        return `<li><button type="button" data-scene-id="${escapeHtml(reference.id)}"><span class="clarity-dot">${index + 1}</span><small>${escapeHtml(point.stage || ['Start', 'Conflict', 'Peak', 'Ending'][index])}</small><strong>${escapeHtml(point.title)}</strong><em>${escapeHtml(reference.label)}</em></button>${this.evidenceDetails(point)}</li>`;
      }).join('')}</ol>` : this.waitingBlock('story clarity')}
    </section>`;
  }

  storyFlowPanel(data, stale) {
    const points = data.storyFlow.points || [];
    if (!points.length) return `<section class="analysis-section flow-section"><div class="section-heading"><div><span class="section-kicker">Story</span><h2>Story flow</h2><p>Momentum, emotion, and dramatic pressure in one view.</p></div></div>${this.waitingBlock('story flow')}</section>`;
    const width = Math.max(720, points.length * 68);
    const height = 162;
    const left = 30;
    const right = 24;
    const top = 17;
    const bottom = 29;
    const plotBottom = height - bottom;
    const usable = width - left - right;
    const plotHeight = plotBottom - top;
    const coords = points.map((point, index) => ({
      ...point,
      x: left + (points.length === 1 ? usable / 2 : (index / (points.length - 1)) * usable),
      y: top + ((100 - clamp(point.value)) / 100) * plotHeight,
    }));
    const polyline = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const area = `${left},${plotBottom} ${polyline} ${width - right},${plotBottom}`;
    const markers = coords.filter((point) => point.marker).slice(0, 4);
    const takeaway = data.storyFlow.takeaway;
    const description = data.storyFlow.preview
      ? 'A live draft signal from scene rhythm. Lumiere refines it when the full reading is ready.'
      : 'Momentum, emotion, and dramatic pressure—combined into one readable arc.';
    return `<section class="analysis-section flow-section ${stale ? 'is-previous' : ''}" aria-labelledby="story-flow-heading">
      <div class="section-heading"><div><span class="section-kicker">Story</span><h2 id="story-flow-heading">Story flow</h2><p>${description}</p></div><span class="flow-key">${data.storyFlow.preview ? 'Live preview' : 'Quiet'} <i></i> ${data.storyFlow.preview ? 'Updating' : 'Peak'}</span></div>
      <div class="flow-frame"><div class="flow-scroll"><svg class="flow-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Story flow across ${points.length} scenes">
        <defs><linearGradient id="story-flow-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--an-accent)" stop-opacity=".18"/><stop offset="1" stop-color="var(--an-accent)" stop-opacity="0"/></linearGradient><filter id="story-flow-handdrawn" x="-2%" y="-8%" width="104%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="1" seed="17" result="paperNoise"/><feDisplacementMap in="SourceGraphic" in2="paperNoise" scale=".75" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
        <line class="flow-guide" x1="${left}" y1="${top + plotHeight * .25}" x2="${width - right}" y2="${top + plotHeight * .25}"/><line class="flow-guide" x1="${left}" y1="${top + plotHeight * .5}" x2="${width - right}" y2="${top + plotHeight * .5}"/><line class="flow-guide" x1="${left}" y1="${top + plotHeight * .75}" x2="${width - right}" y2="${top + plotHeight * .75}"/>
        <polygon class="flow-area" points="${area}"/><polyline class="story-line" points="${polyline}"/>
        ${coords.map((point) => `<g class="chart-point" tabindex="0" role="button" data-scene-id="${escapeHtml(point.sceneId)}" aria-label="Scene ${point.sceneNumber}: ${escapeHtml(point.label)}. ${escapeHtml(point.explanation)}"><circle cx="${point.x}" cy="${point.y}" r="4.5"/><title>Scene ${point.sceneNumber} · ${escapeHtml(point.heading || '')}\n${escapeHtml(point.label)}\n${escapeHtml(point.explanation)}</title></g>`).join('')}
        <text x="${left}" y="${height - 8}">Start</text><text x="${left + usable / 2}" y="${height - 8}" text-anchor="middle">Middle</text><text x="${width - right}" y="${height - 8}" text-anchor="end">End</text>
      </svg></div></div>
      ${markers.length ? `<div class="flow-markers">${markers.map((point) => `<button type="button" data-scene-id="${escapeHtml(point.sceneId)}"><i></i><span>Scene ${point.sceneNumber}</span><strong>${escapeHtml(point.marker)}</strong></button>`).join('')}</div>` : ''}
      ${takeaway ? `<details class="flow-takeaway"><summary><span>${icon('insight')}</span><span><small>Lumiere’s read</small><strong>${escapeHtml(takeaway.title)}</strong></span><em>Read note</em>${icon('chevron')}</summary><div class="flow-takeaway-body"><p>${escapeHtml(takeaway.explanation)}</p><div class="insight-foot"><span>${escapeHtml(this.sceneReference(takeaway).label)}</span><button type="button" data-scene-id="${escapeHtml(this.sceneReference(takeaway).id)}">View in Script${icon('arrow')}</button></div></div></details>` : ''}
    </section>`;
  }

  sceneIssuesPanel(data, deepReady) {
    const issues = data.sceneIssues || [];
    return `<section class="story-list" aria-labelledby="scene-issues-heading"><div class="subsection-heading"><div><span class="section-kicker">Fix first</span><h3 id="scene-issues-heading">Scenes that need attention</h3></div><span>${issues.length || 0}</span></div>${issues.length ? `<div class="compact-list">${issues.map((item) => this.insightRow(item, 'attention', 'Open Scene')).join('')}</div>` : deepReady ? '<p class="quiet-empty">No material scene issue was identified in this pass.</p>' : this.waitingBlock('scene issues')}</section>`;
  }

  keyMomentsPanel(data, deepReady) {
    const moments = data.keyMoments || [];
    return `<section class="story-list" aria-labelledby="key-moments-heading"><div class="subsection-heading"><div><span class="section-kicker">Keep an eye on</span><h3 id="key-moments-heading">Key moments</h3></div><span>${moments.length || 0}</span></div>${this.contextualAssistant('Characters', data.contextualQuestions.characters)}${moments.length ? `<div class="compact-list">${moments.map((item) => this.insightRow(item, 'working', 'Jump to Scene')).join('')}</div>` : deepReady ? '<p class="quiet-empty">Lumiere has not identified a decisive key moment yet.</p>' : this.waitingBlock('key moments')}</section>`;
  }

  productionPanel(data, stale, deepReady) {
    const production = data.productionOverview;
    const metrics = [
      ['location', 'Locations', production.locations?.count || 0],
      ['people', 'Characters', production.characters?.count || 0],
      ['night', 'Night scenes', production.nightScenes?.count || 0],
      ['complex', 'Complex scenes', new Set((production.complexScenes || []).flatMap((item) => item.sceneIds?.length ? item.sceneIds : [item.sceneId]).filter(Boolean)).size],
    ];
    const focusMap = { location: ['Locations', production.locations?.sceneIds || []], people: ['Characters', production.characters?.sceneIds || []], night: ['Night scenes', production.nightScenes?.sceneIds || []], complex: ['High complexity scenes', (production.complexScenes || []).flatMap((item) => item.sceneIds?.length ? item.sceneIds : [item.sceneId]).filter(Boolean)] };
    const [focusTitle, focusIds] = focusMap[this.productionFocus] || focusMap.complex;
    const selectedScenes = (this.analysis?.sceneIndex || []).filter((scene) => focusIds.includes(scene.id));
    const selectedComplex = (production.complexScenes || []).filter((item) => (item.sceneIds?.length ? item.sceneIds : [item.sceneId]).some((id) => focusIds.includes(id)));
    const focusList = selectedComplex.length ? focusIds.map((sceneId) => { const scene = (this.analysis?.sceneIndex || []).find((item) => item.id === sceneId); const item = selectedComplex.find((candidate) => (candidate.sceneIds?.length ? candidate.sceneIds : [candidate.sceneId]).includes(sceneId)); return scene && item ? `<button type="button" data-scene-id="${escapeHtml(scene.id)}"><span>Scene ${scene.sceneNumber} · Page ${scene.page}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.explanation)}</p></button>` : ''; }).join('') : selectedScenes.length ? selectedScenes.map((scene) => `<button type="button" data-scene-id="${escapeHtml(scene.id)}"><span>Scene ${scene.sceneNumber} · Page ${scene.page}</span><strong>${escapeHtml(scene.heading)}</strong></button>`).join('') : `<p class="quiet-empty">No scenes are associated with this selection.</p>`;
    return `<section class="analysis-section production-section ${stale ? 'is-previous' : ''}" aria-labelledby="production-heading">
      <div class="section-heading"><div><span class="section-kicker">Production</span><h2 id="production-heading">Production overview</h2><p>Only the screenplay choices that change how this film is made.</p></div>${this.contextualAssistant('Production', data.contextualQuestions.production)}</div>
      <div class="production-metrics" role="group" aria-label="Production signals">${metrics.map(([name, label, value]) => `<button type="button" data-action="production-focus" data-focus="${name}" aria-pressed="${this.productionFocus === name}" aria-label="${escapeHtml(value)} ${escapeHtml(label)}" class="production-metric${this.productionFocus === name ? ' is-selected' : ''}"><span class="production-metric-icon">${icon(name)}</span><span class="production-metric-copy"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></span><span class="production-metric-arrow">${icon('chevron')}</span></button>`).join('')}</div>
      <div class="production-focus-panel"><div class="subsection-heading"><div><span class="section-kicker">Selected production signal</span><h3>${escapeHtml(focusTitle)}</h3></div><span>${focusIds.length} scene${focusIds.length === 1 ? '' : 's'}</span></div><div class="production-focus-list">${focusList}</div></div>
    </section>`;
  }

  sceneExplorer(data) {
    const scenes = this.analysis?.sceneIndex || [];
    const issueIds = new Set((data.sceneIssues || []).flatMap((item) => item.sceneIds?.length ? item.sceneIds : [item.sceneId]));
    const complexIds = new Set((data.productionOverview.complexScenes || []).flatMap((item) => item.sceneIds?.length ? item.sceneIds : [item.sceneId]));
    const filter = ['issues', 'complex'].includes(this.filterKey) ? this.filterKey : 'all';
    const visible = scenes.filter((scene) => filter === 'issues' ? issueIds.has(scene.id) : filter === 'complex' ? complexIds.has(scene.id) : true);
    return `<details class="scene-explorer"${filter !== 'all' ? ' open' : ''}>
      <summary><span><small>Connected screenplay</small><strong>Scene explorer</strong></span><em>${scenes.length} scenes</em>${icon('chevron')}</summary>
      <div class="scene-explorer-body"><div class="scene-filters" role="group" aria-label="Filter scene explorer"><button type="button" data-action="scene-filter" data-filter-key="all" aria-pressed="${filter === 'all'}">All scenes</button><button type="button" data-action="scene-filter" data-filter-key="issues" aria-pressed="${filter === 'issues'}">Needs attention · ${issueIds.size}</button><button type="button" data-action="scene-filter" data-filter-key="complex" aria-pressed="${filter === 'complex'}">High complexity · ${complexIds.size}</button></div>
        <div class="scene-rows">${visible.length ? visible.map((scene) => `<article class="scene-row"><button type="button" class="scene-main" data-scene-id="${escapeHtml(scene.id)}"><span>Scene ${scene.sceneNumber} · Page ${scene.page}</span><strong>${escapeHtml(scene.heading)}</strong></button><div class="scene-tags">${issueIds.has(scene.id) ? '<span class="attention">Needs attention</span>' : ''}${complexIds.has(scene.id) ? '<span class="complex">High complexity</span>' : ''}</div><div class="scene-actions"><button type="button" data-scene-id="${escapeHtml(scene.id)}">Open Scene</button><button type="button" data-action="open-mode" data-mode="breakdown" data-scene-id="${escapeHtml(scene.id)}">Breakdown</button><button type="button" data-action="open-mode" data-mode="stripboard" data-scene-id="${escapeHtml(scene.id)}">Stripboard</button><button type="button" data-action="open-mode" data-mode="shotlist" data-scene-id="${escapeHtml(scene.id)}">Shot List</button></div></article>`).join('') : '<p class="quiet-empty">No scenes match this filter.</p>'}</div>
      </div>
    </details>`;
  }

  render() {
    this.publishBackgroundStatus();
    const style = `<style>
      :host{--fs-font-text:"SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;--fs-font-display:"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
      :host,:host *{font-family:var(--fs-font-text)!important}
      :host h1,:host h2,:host h3,:host h4,:host h5,:host h6{font-family:var(--fs-font-display)!important}:host h1,:host h2{font-weight:900!important}:host h3{font-weight:800!important}
      :host{--an-bg:var(--bg,#F5F0E8);--an-surface:var(--surface,#FFFEF9);--an-ink:var(--ink,#242421);--an-muted:var(--muted,#77746C);--an-line:var(--hair,#DED8CD);--an-soft:var(--soft,#F0EBE2);--an-accent:var(--accent,#BA7517);--an-positive:#4C7B5D;--an-production:#5E7089;display:block;flex:1;min-height:0;overflow:auto;background:var(--an-bg);color:var(--an-ink);font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;scrollbar-gutter:stable}
      *{box-sizing:border-box}button{font:inherit;color:inherit}svg{width:19px;height:19px}.workspace{width:min(1240px,100%);margin:0 auto;padding:44px 48px 84px}.page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:32px;margin-bottom:34px}.page-title{min-width:0}.section-kicker,.page-kicker{display:block;color:var(--an-accent);font-size:9.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}.page-header h1{max-width:720px;margin:7px 0 9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:34px;line-height:1.04;letter-spacing:-1.25px;font-weight:650}.title-meta{display:flex;align-items:center;flex-wrap:wrap;gap:9px;color:var(--an-muted);font-size:11.5px}.script-status{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:var(--an-soft);color:var(--an-ink);font-weight:600}.script-status:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--an-accent)}.script-status.production-ready:before{background:var(--an-positive)}.script-status.needs-attention:before{background:#B45F50}.header-actions{display:flex;align-items:center;gap:14px;flex:0 0 auto}.sync-state{display:flex;align-items:center;gap:7px;max-width:300px;color:var(--an-muted);font-size:10.5px;text-align:right}.sync-state i{width:6px;height:6px;border-radius:50%;background:var(--an-accent)}.sync-state.is-live i{animation:pulse 1.4s ease-in-out infinite}.export,.primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 15px;border:1px solid color-mix(in srgb,var(--an-ink) 42%,var(--an-line));border-radius:11px 9px 12px 10px/9px 12px 10px 11px;background:transparent;font-size:11.5px;font-weight:600;cursor:pointer;transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,background .16s ease}.export:hover{transform:translateY(-1px);border-color:var(--an-accent);background:color-mix(in srgb,var(--an-accent) 5%,transparent)}.export svg{width:16px;height:16px}.primary{border-color:var(--an-accent);background:var(--an-accent);color:#fff}.pro-note,.error{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 18px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--an-accent) 38%,var(--an-line));border-radius:12px 10px 13px 9px;background:color-mix(in srgb,var(--an-accent) 7%,var(--an-surface));color:var(--an-muted);font-size:11px}.pro-note svg{color:var(--an-accent);flex:0 0 18px}.error{border-color:#B95A55;background:color-mix(in srgb,#B95A55 7%,var(--an-surface));color:#B95A55}.error button{border:0;background:transparent;color:inherit;font-weight:600;cursor:pointer}
      .priority-board{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));overflow:hidden;margin-bottom:58px;background:var(--an-surface);border:1px solid color-mix(in srgb,var(--an-ink) 34%,var(--an-line));border-radius:19px 15px 21px 14px/16px 21px 14px 19px}.priority-board:after{content:"";position:absolute;inset:3px 4px 4px 3px;pointer-events:none;border:1px solid color-mix(in srgb,var(--an-ink) 11%,transparent);border-radius:16px 13px 18px 12px/14px 18px 12px 16px}.priority-column{position:relative;z-index:1;min-width:0;padding:25px 24px}.priority-column+.priority-column{border-left:1px solid var(--an-line)}.priority-column>header{display:flex;align-items:center;gap:8px;margin-bottom:18px}.priority-column>header>span{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;color:var(--an-muted);background:var(--an-soft)}.priority-column>header svg{width:14px;height:14px}.priority-column.working>header>span{color:var(--an-positive)}.priority-column.attention>header>span{color:#B45F50}.priority-column.production>header>span{color:var(--an-production)}.priority-column h2{margin:0;font-size:14px;letter-spacing:-.2px}.priority-list{display:grid}.insight-row{display:grid;grid-template-columns:18px minmax(0,1fr);gap:9px;padding:15px 0;border-top:1px solid var(--an-line)}.priority-list .insight-row:first-child,.compact-list .insight-row:first-child{padding-top:0;border-top:0}.insight-signal{display:grid;place-items:start;color:var(--an-muted);padding-top:2px}.insight-signal svg{width:14px;height:14px}.insight-row.working .insight-signal{color:var(--an-positive)}.insight-row.attention .insight-signal{color:#B45F50}.insight-row.production .insight-signal{color:var(--an-production)}.insight-copy{min-width:0}.insight-copy h3{margin:0 0 5px;font-size:12px;line-height:1.25;font-weight:650;letter-spacing:-.1px}.insight-copy>p{margin:0;color:var(--an-muted);font-size:10.5px;line-height:1.5}.priority-column .insight-copy>p{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2}.insight-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}.insight-foot>span{min-width:0;color:var(--an-muted);font-size:9px}.insight-foot button{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;padding:3px 0;border:0;background:transparent;color:var(--an-accent);font-size:9.5px;font-weight:600;cursor:pointer}.insight-foot button svg{width:12px;height:12px;transition:transform .16s ease}.insight-foot button:hover svg{transform:translateX(2px)}.evidence{margin-top:8px}.evidence summary{width:max-content;color:var(--an-muted);font-size:9px;cursor:pointer}.evidence blockquote{margin:7px 0 0;padding-left:9px;border-left:1px solid var(--an-accent);color:var(--an-muted);font-size:9.5px;line-height:1.45}.quiet-empty{margin:0;padding:16px 0;color:var(--an-muted);font-size:10.5px;line-height:1.5;text-align:center}.calm-state{display:flex;align-items:center;justify-content:center;gap:8px;min-height:100px;padding:18px;color:var(--an-muted);font-size:10.5px;line-height:1.5;text-align:center}.reading-dot{width:6px;height:6px;border-radius:50%;background:var(--an-accent);animation:pulse 1.4s ease-in-out infinite}.analysis-progress{display:grid;gap:10px;margin:0 0 24px;padding:13px 15px;border:1px solid color-mix(in srgb,var(--an-accent) 36%,var(--an-line));border-radius:13px 10px 14px 11px/10px 14px 11px 13px;background:color-mix(in srgb,var(--an-accent) 6%,var(--an-surface));box-shadow:0 7px 20px color-mix(in srgb,var(--an-ink) 4%,transparent);animation:analysisCardIn .22s cubic-bezier(.2,.8,.2,1) both}.analysis-progress-copy{display:flex;align-items:center;gap:9px;min-width:0}.analysis-progress-copy>div{display:grid;gap:2px;min-width:0}.analysis-progress-copy strong{font-size:11px;letter-spacing:-.1px}.analysis-progress-copy span:not(.reading-dot){color:var(--an-muted);font-size:9.5px;line-height:1.4}.analysis-progress-track{position:relative;overflow:hidden;height:5px;border-radius:999px;background:color-mix(in srgb,var(--an-ink) 10%,var(--an-surface))}.analysis-progress-track i{position:absolute;top:0;bottom:0;left:-34%;width:34%;border-radius:inherit;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--an-accent) 92%,#fff),transparent);animation:analysisProgress 1.15s cubic-bezier(.4,0,.6,1) infinite}
      .analysis-section{padding:46px 0;border-top:1px solid var(--an-line)}.analysis-section.is-previous{opacity:.72}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:30px;margin-bottom:28px}.section-heading h2{margin:5px 0 7px;font-size:24px;line-height:1.1;letter-spacing:-.65px;font-weight:650}.section-heading p{max-width:650px;margin:0;color:var(--an-muted);font-size:11.5px;line-height:1.55}.contextual-assistant{display:grid;justify-items:end;gap:8px;max-width:440px}.contextual-assistant>span{display:flex;align-items:center;gap:6px;color:var(--an-muted);font-size:9.5px}.contextual-assistant>span svg{width:14px;height:14px;color:var(--an-accent);animation:twinkle 2.8s ease-in-out infinite}.contextual-assistant>div{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:6px}.contextual-assistant button{min-height:29px;padding:0 9px;border:1px solid var(--an-line);border-radius:9px 8px 10px 7px;background:transparent;color:var(--an-muted);font-size:9.5px;cursor:pointer;transition:transform .16s ease,border-color .16s ease,color .16s ease,background .16s ease}.contextual-assistant button:hover{transform:translateY(-1px);border-color:var(--an-accent);color:var(--an-ink);background:color-mix(in srgb,var(--an-accent) 5%,transparent)}
      .clarity-track{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin:38px 0 0;padding:0;list-style:none}.clarity-track:before{content:"";position:absolute;left:16px;right:16px;top:13px;border-top:1px solid color-mix(in srgb,var(--an-ink) 42%,var(--an-line));transform:rotate(-.05deg)}.clarity-track li{position:relative;min-width:0}.clarity-track button{display:grid;width:100%;padding:0;border:0;background:transparent;text-align:left;cursor:pointer}.clarity-dot{position:relative;z-index:1;display:grid;place-items:center;width:27px;height:27px;border:1px solid var(--an-ink);border-radius:50%;background:var(--an-surface);color:var(--an-accent);font-size:9px;font-weight:700;transition:transform .16s ease,background .16s ease,color .16s ease}.clarity-track button:hover .clarity-dot{transform:scale(1.07);background:var(--an-accent);color:#fff;border-color:var(--an-accent)}.clarity-track small{margin-top:12px;color:var(--an-accent);font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase}.clarity-track strong{margin-top:5px;font-size:11.5px;line-height:1.35}.clarity-track em{margin-top:5px;color:var(--an-muted);font-size:9px;font-style:normal}.clarity-track .evidence{margin-left:0}
      .flow-section{overflow:hidden}.flow-key{display:flex;align-items:center;gap:7px;color:var(--an-muted);font-size:9px}.flow-key i{display:block;width:46px;height:2px;border-radius:99px;background:linear-gradient(90deg,var(--an-line),var(--an-accent))}.flow-frame{position:relative;overflow:hidden;padding:10px 8px 0;border:1px solid color-mix(in srgb,var(--an-ink) 34%,var(--an-line));border-radius:14px 12px 16px 13px;background:color-mix(in srgb,var(--an-surface) 60%,transparent)}.flow-frame::before,.flow-frame::after{content:"";position:absolute;pointer-events:none}.flow-frame::before{inset:3px 4px 4px 3px;border:1px solid color-mix(in srgb,var(--an-ink) 17%,transparent);border-radius:12px 10px 14px 11px;transform:rotate(.08deg)}.flow-frame::after{inset:-1px 2px 1px -1px;border:1px solid color-mix(in srgb,var(--an-ink) 10%,transparent);border-radius:15px 13px 17px 12px;transform:rotate(-.06deg)}.flow-scroll{position:relative;z-index:1;overflow-x:auto;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--an-ink) 22%,transparent) transparent}.flow-chart{display:block;width:100%;min-width:720px;height:auto}.flow-chart .flow-guide{stroke:var(--an-line);stroke-width:1;stroke-dasharray:3 8}.flow-chart .flow-area{fill:url(#story-flow-fill)}.flow-chart .story-line{fill:none;stroke:var(--an-ink);stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1800;stroke-dashoffset:1800;filter:url(#story-flow-handdrawn)}.flow-chart text{fill:var(--an-muted);font:9px "Helvetica Neue",Helvetica,Arial,sans-serif}.chart-point{cursor:pointer;outline:none}.chart-point circle{fill:var(--an-surface);stroke:var(--an-accent);stroke-width:2;transition:r .16s ease,fill .16s ease}.chart-point:hover circle,.chart-point:focus circle{r:6.5;fill:var(--an-accent)}.flow-markers{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.flow-markers button{display:flex;align-items:center;gap:6px;min-height:29px;padding:0 9px;border:1px solid var(--an-line);border-radius:9px 8px 10px 7px;background:transparent;font-size:9px;cursor:pointer}.flow-markers i{width:5px;height:5px;border-radius:50%;background:var(--an-accent)}.flow-markers span{color:var(--an-muted)}.flow-takeaway{display:grid;grid-template-columns:28px minmax(0,1fr);gap:12px;margin-top:20px;padding:15px 0;border-top:1px solid var(--an-line)}.flow-takeaway>span{color:var(--an-accent)}.flow-takeaway>span svg{width:21px;height:21px}.flow-takeaway small{display:block;color:var(--an-accent);font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase}.flow-takeaway strong{display:block;margin-top:4px;font-size:12.5px}.flow-takeaway p{margin:5px 0 0;color:var(--an-muted);font-size:10.5px;line-height:1.5}.story-pair{display:grid;grid-template-columns:1fr 1fr;gap:52px;padding-bottom:46px}.story-list{min-width:0}.story-list>.contextual-assistant{justify-items:start;margin:-5px 0 13px}.story-list>.contextual-assistant>div{justify-content:flex-start}.subsection-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:18px}.subsection-heading h3{margin:5px 0 0;font-size:17px;letter-spacing:-.35px}.subsection-heading>span{color:var(--an-muted);font-size:10px}.compact-list{display:grid}
      .production-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:2px}.production-metric{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr) 15px;align-items:center;gap:12px;min-width:0;min-height:82px;padding:14px 14px 14px 15px;overflow:hidden;border:1px solid color-mix(in srgb,var(--an-ink) 24%,var(--an-line));border-radius:14px 11px 15px 12px/12px 15px 11px 14px;background:color-mix(in srgb,var(--an-surface) 88%,transparent);text-align:left;cursor:pointer;transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,background .16s ease,box-shadow .16s ease}.production-metric:before{content:"";position:absolute;inset:3px;pointer-events:none;border:1px solid transparent;border-radius:11px 9px 12px 10px/10px 12px 9px 11px;transition:border-color .16s ease}.production-metric:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--an-accent) 72%,var(--an-line));background:color-mix(in srgb,var(--an-accent) 5%,var(--an-surface));box-shadow:0 8px 22px color-mix(in srgb,var(--an-ink) 7%,transparent)}.production-metric.is-selected{border-color:var(--an-accent);background:color-mix(in srgb,var(--an-accent) 9%,var(--an-surface))}.production-metric.is-selected:before{border-color:color-mix(in srgb,var(--an-accent) 26%,transparent)}.production-metric-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:12px 10px 13px 9px/10px 13px 9px 12px;background:var(--an-soft);color:var(--an-production);transition:transform .16s cubic-bezier(.2,.8,.2,1),background .16s ease,color .16s ease}.production-metric:hover .production-metric-icon,.production-metric.is-selected .production-metric-icon{transform:scale(1.04);background:color-mix(in srgb,var(--an-accent) 14%,var(--an-surface));color:var(--an-accent)}.production-metric-icon svg{width:19px;height:19px}.production-metric-copy{display:grid;align-content:center;gap:5px;min-width:0}.production-metric-copy strong{font-size:22px;line-height:.9;font-weight:650;letter-spacing:-.55px;font-variant-numeric:tabular-nums}.production-metric-copy small{overflow:hidden;color:var(--an-muted);font-size:10px;line-height:1.2;font-weight:500;text-overflow:ellipsis;white-space:nowrap}.production-metric-arrow{display:grid;place-items:center;color:color-mix(in srgb,var(--an-muted) 72%,transparent);transition:transform .16s ease,color .16s ease}.production-metric-arrow svg{width:13px;height:13px}.production-metric:hover .production-metric-arrow,.production-metric.is-selected .production-metric-arrow{transform:translateX(2px);color:var(--an-accent)}.complexity{margin-top:32px}.complexity-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 32px}.complexity-list article{padding:16px 0;border-top:1px solid var(--an-line)}.complexity-list article>button{display:grid;gap:5px;width:100%;padding:0;border:0;background:transparent;text-align:left;cursor:pointer}.complexity-list article>button>span{color:var(--an-accent);font-size:9px}.complexity-list strong{font-size:11.5px}.complexity-list p{margin:0;color:var(--an-muted);font-size:10.5px;line-height:1.45}.factor-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.factor-list span,.scene-tags span{padding:4px 7px;border-radius:999px;background:var(--an-soft);color:var(--an-muted);font-size:8.5px}.factor-list span{color:var(--an-production)}
      .scene-explorer{margin-top:6px;border-top:1px solid var(--an-line);border-bottom:1px solid var(--an-line)}.scene-explorer>summary{display:grid;grid-template-columns:minmax(0,1fr) auto 18px;align-items:center;gap:14px;padding:20px 4px;cursor:pointer;list-style:none}.scene-explorer>summary::-webkit-details-marker{display:none}.scene-explorer>summary span{display:grid;gap:4px}.scene-explorer>summary small{color:var(--an-accent);font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase}.scene-explorer>summary strong{font-size:15px}.scene-explorer>summary em{color:var(--an-muted);font-size:10px;font-style:normal}.scene-explorer>summary svg{width:16px;height:16px;transition:transform .16s ease}.scene-explorer[open]>summary svg{transform:rotate(90deg)}.scene-explorer-body{padding:0 4px 22px}.scene-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}.scene-filters button{min-height:30px;padding:0 10px;border:1px solid var(--an-line);border-radius:999px;background:transparent;color:var(--an-muted);font-size:9px;cursor:pointer}.scene-filters button[aria-pressed="true"]{border-color:var(--an-accent);color:var(--an-accent);background:color-mix(in srgb,var(--an-accent) 6%,transparent)}.scene-rows{display:grid}.scene-row{display:grid;grid-template-columns:minmax(210px,1fr) minmax(130px,.45fr) auto;align-items:center;gap:18px;padding:13px 0;border-top:1px solid var(--an-line)}.scene-main{display:grid;gap:4px;min-width:0;padding:0;border:0;background:transparent;text-align:left;cursor:pointer}.scene-main span{color:var(--an-muted);font-size:9px}.scene-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px}.scene-tags{display:flex;flex-wrap:wrap;gap:5px}.scene-tags .attention{color:#B45F50}.scene-tags .complex{color:var(--an-production)}.scene-actions{display:flex;justify-content:flex-end;gap:5px}.scene-actions button{padding:5px 7px;border:0;border-radius:7px;background:transparent;color:var(--an-muted);font-size:8.5px;cursor:pointer;transition:background .15s ease,color .15s ease}.scene-actions button:hover{background:var(--an-soft);color:var(--an-ink)}
      .empty{display:grid;place-items:center;align-content:center;min-height:calc(100vh - 44px);padding:40px;text-align:center;background:var(--an-bg)}.empty-spark{display:grid;place-items:center;width:48px;height:48px;color:var(--an-accent);margin-bottom:14px}.empty-spark svg{width:36px;height:36px;animation:twinkle 2.8s ease-in-out infinite}.empty h1{margin:0;font-size:31px;letter-spacing:-.8px}.empty p{max-width:460px;margin:13px 0 22px;color:var(--an-muted);font-size:14px;line-height:1.55}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}button:focus-visible,summary:focus-visible,.chart-point:focus-visible{outline:2px solid var(--an-accent);outline-offset:2px}
      .workspace.is-entering{animation:analysisWorkspaceIn .2s cubic-bezier(.2,.8,.2,1) both}.workspace.is-entering .priority-column,.workspace.is-entering .analysis-section{animation:analysisCardIn .24s var(--analysis-entry-delay,0ms) cubic-bezier(.2,.8,.2,1) both}.workspace.is-entering .story-line{animation:draw .72s .12s cubic-bezier(.65,0,.35,1) both}.workspace.is-entering .clarity-dot{animation:clarityIn .28s var(--analysis-entry-delay,80ms) cubic-bezier(.2,.8,.2,1) both}
      @keyframes analysisWorkspaceIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes analysisCardIn{from{opacity:0;transform:translateY(7px) scale(.985)}to{opacity:1;transform:none}}@keyframes clarityIn{from{opacity:0;transform:scale(.72)}to{opacity:1;transform:scale(1)}}@keyframes draw{from{stroke-dashoffset:1800}to{stroke-dashoffset:0}}@keyframes analysisProgress{from{transform:translateX(0)}to{transform:translateX(394%)}}@keyframes pulse{0%,100%{opacity:.42;transform:scale(.82)}50%{opacity:1;transform:scale(1)}}@keyframes twinkle{0%,100%{opacity:.58;transform:rotate(-3deg) scale(.94)}50%{opacity:1;transform:rotate(2deg) scale(1.04)}}
      @media(max-width:980px){.workspace{padding:34px 26px 70px}.priority-board{grid-template-columns:1fr}.priority-column+.priority-column{border-left:0;border-top:1px solid var(--an-line)}.story-pair{gap:30px}.production-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.scene-row{grid-template-columns:minmax(200px,1fr) auto}.scene-tags{justify-content:flex-end}.scene-actions{grid-column:1/-1;justify-content:flex-start}}
      @media(max-width:720px){.workspace{padding:26px 15px 54px}.page-header{align-items:flex-start;flex-direction:column;margin-bottom:26px}.page-header h1{font-size:28px}.header-actions{width:100%;justify-content:space-between}.sync-state{text-align:left}.priority-board{margin-bottom:42px}.priority-column{padding:21px 18px}.section-heading{flex-direction:column;gap:16px}.contextual-assistant{justify-items:start;max-width:none}.contextual-assistant>div{justify-content:flex-start}.clarity-track{grid-template-columns:1fr;margin-top:24px;gap:0}.clarity-track:before{left:13px;right:auto;top:13px;bottom:13px;border-top:0;border-left:1px solid var(--an-line)}.clarity-track li{padding:0 0 22px 42px}.clarity-track li:last-child{padding-bottom:0}.clarity-dot{position:absolute;left:0;top:0}.clarity-track small{margin-top:1px}.story-pair{grid-template-columns:1fr}.production-metric{min-height:76px;padding:12px;grid-template-columns:34px minmax(0,1fr) 13px;gap:10px}.production-metric-icon{width:34px;height:34px}.production-focus-list,.complexity-list{grid-template-columns:1fr}.scene-row{grid-template-columns:1fr}.scene-tags{justify-content:flex-start}.scene-actions{overflow-x:auto}.scene-actions button{white-space:nowrap}}
      @media(max-width:480px){.production-metrics{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
      .production-focus-panel{position:relative;margin-top:18px;padding:21px 22px;border:1px solid color-mix(in srgb,var(--an-ink) 28%,var(--an-line));border-radius:15px 12px 16px 11px/13px 16px 11px 15px;background:color-mix(in srgb,var(--an-surface) 82%,transparent)}.production-focus-panel:after{content:"";position:absolute;inset:3px 4px 4px 3px;pointer-events:none;border:1px solid color-mix(in srgb,var(--an-ink) 10%,transparent);border-radius:12px 10px 13px 9px/11px 13px 9px 12px}.production-focus-panel>*{position:relative;z-index:1}.production-focus-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px}.production-focus-list button{display:grid;gap:5px;padding:14px 0;border:0;border-top:1px solid var(--an-line);background:transparent;text-align:left;cursor:pointer}.production-focus-list button span{color:var(--an-accent);font-size:9px}.production-focus-list button strong{font-size:11.5px}.production-focus-list button p{margin:0;color:var(--an-muted);font-size:10.5px;line-height:1.45}
      .analysis-start{display:grid;place-items:center;align-content:center;min-height:calc(100vh - 44px);padding:40px;text-align:center;background:var(--an-bg)}.analysis-start h1{max-width:560px;margin:9px 0 8px;font-size:30px;letter-spacing:-.8px}.analysis-start>p{margin:0 0 24px;color:var(--an-muted);font-size:13px}.analysis-start-options{display:grid;grid-template-columns:220px minmax(360px,520px);gap:12px;width:min(760px,100%);text-align:left}.analysis-start-card{display:grid;align-content:start;gap:8px;padding:18px;border:1px solid var(--an-line);border-radius:13px 11px 14px 10px;background:var(--an-surface);color:var(--an-ink);font:inherit;cursor:pointer}.analysis-start-card:hover{border-color:var(--an-accent);background:color-mix(in srgb,var(--an-accent) 5%,var(--an-surface))}.analysis-start-card span{color:var(--an-muted);font-size:11px;line-height:1.45}.analysis-start-card em{color:var(--an-accent);font-size:9px;font-style:normal;text-transform:uppercase;letter-spacing:1px}.analysis-start-deep{cursor:default}.deep-questions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.deep-questions label{display:grid;gap:4px;color:var(--an-muted);font-size:9px}.deep-questions select,.deep-questions input{min-height:30px;border:1px solid var(--an-line);border-radius:7px;background:var(--an-bg);color:var(--an-ink);padding:0 7px;font:inherit;font-size:10px}.deep-questions input{grid-column:1/-1}.analysis-start-deep .primary{margin-top:10px;min-height:34px;font-size:10.5px}
      .analysis-focus-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.72fr);align-items:stretch;gap:14px;margin:0 0 38px}.analysis-focus-grid.is-previous{opacity:.76}.analysis-focus-card{position:relative;display:flex;flex-direction:column;min-height:306px;overflow:hidden;padding:30px 31px 25px;border:1px solid color-mix(in srgb,var(--an-ink) 38%,var(--an-line));border-radius:20px 15px 22px 16px/16px 22px 15px 20px;background:var(--an-surface);box-shadow:0 12px 34px color-mix(in srgb,var(--an-ink) 5%,transparent)}.analysis-focus-card:before{content:"";position:absolute;inset:3px 4px 4px 3px;pointer-events:none;border:1px solid color-mix(in srgb,var(--an-ink) 12%,transparent);border-radius:17px 13px 19px 13px/14px 19px 13px 17px;transform:rotate(.04deg)}.analysis-focus-card:after{content:"";position:absolute;right:26px;top:30px;width:82px;height:20px;pointer-events:none;border-top:2px solid color-mix(in srgb,var(--an-accent) 62%,transparent);border-radius:52%;transform:rotate(-2deg)}.analysis-focus-card>*{position:relative;z-index:1}.focus-card-top{display:grid;grid-template-columns:26px auto 1fr;align-items:center;gap:8px}.focus-spark{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:color-mix(in srgb,var(--an-accent) 11%,var(--an-surface));color:var(--an-accent)}.focus-spark svg{width:15px;height:15px;animation:twinkle 2.8s ease-in-out infinite}.focus-card-top .section-kicker{margin-right:auto}.focus-status{justify-self:end;padding:5px 8px;border:1px solid color-mix(in srgb,var(--an-accent) 32%,var(--an-line));border-radius:999px;color:var(--an-muted);font-size:9px;font-weight:600}.analysis-focus-card h2{max-width:760px;margin:25px 0 10px;font-size:27px;line-height:1.08;letter-spacing:-.7px;font-weight:650}.focus-preview{max-width:760px;max-height:48px;overflow:hidden;margin:0;color:var(--an-muted);font-size:12px;line-height:1.58;transition:max-height .18s cubic-bezier(.2,.8,.2,1),color .18s ease}.analysis-focus-card:hover .focus-preview,.analysis-focus-card:focus-within .focus-preview{max-height:104px;color:var(--an-ink)}.focus-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.focus-actions .primary,.focus-ask{min-height:38px;padding:0 13px}.focus-actions .primary svg,.focus-ask svg{width:14px;height:14px}.focus-ask{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--an-line);border-radius:10px 8px 11px 9px;background:transparent;color:var(--an-ink);font-size:10.5px;font-weight:600;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}.focus-ask:hover{transform:translateY(-1px);border-color:var(--an-accent);background:color-mix(in srgb,var(--an-accent) 6%,transparent)}.focus-ask svg{color:var(--an-accent)}.focus-stats{display:flex;align-items:center;gap:0;margin-top:auto;padding-top:21px}.focus-stats span{display:flex;align-items:baseline;gap:6px;min-width:100px;padding-right:22px}.focus-stats span+span{padding-left:22px;border-left:1px solid var(--an-line)}.focus-stats strong{font-size:19px;font-weight:650;font-variant-numeric:tabular-nums}.focus-stats small{color:var(--an-muted);font-size:9px}
      .signal-stack{display:grid;grid-template-rows:repeat(2,minmax(0,1fr));gap:10px;min-width:0}.signal-card{position:relative;min-width:0;overflow:hidden;border:1px solid color-mix(in srgb,var(--an-ink) 25%,var(--an-line));border-radius:15px 12px 16px 11px/12px 16px 11px 15px;background:color-mix(in srgb,var(--an-surface) 91%,transparent);transition:transform .16s cubic-bezier(.2,.8,.2,1),border-color .16s ease,background .16s ease,box-shadow .16s ease}.signal-card:after{content:"";position:absolute;inset:3px;pointer-events:none;border:1px solid color-mix(in srgb,var(--an-ink) 8%,transparent);border-radius:12px 10px 13px 9px/10px 13px 9px 12px}.signal-card:hover,.signal-card:focus-within{z-index:2;transform:translateY(-2px);border-color:color-mix(in srgb,var(--an-accent) 58%,var(--an-line));box-shadow:0 9px 24px color-mix(in srgb,var(--an-ink) 6%,transparent)}.signal-card[open]{grid-row:auto;overflow:visible;background:var(--an-surface)}.signal-card summary{position:relative;z-index:1;display:grid;grid-template-columns:38px minmax(0,1fr) 16px;align-items:center;gap:12px;height:100%;min-height:142px;padding:18px;cursor:pointer;list-style:none}.signal-card summary::-webkit-details-marker{display:none}.signal-card-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:12px 10px 13px 9px;background:var(--an-soft);color:var(--an-muted)}.signal-card.working .signal-card-icon{color:var(--an-positive)}.signal-card.attention .signal-card-icon{color:#B45F50}.signal-card-icon svg{width:18px;height:18px}.signal-card-copy{display:grid;min-width:0}.signal-card-copy small{color:var(--an-muted);font-size:9px;font-weight:600}.signal-card-copy strong{margin-top:3px;font-size:14px}.signal-card-copy em{margin-top:8px;overflow:hidden;color:var(--an-ink);font-size:10.5px;font-style:normal;font-weight:600;text-overflow:ellipsis;white-space:nowrap}.signal-hover-copy{max-height:0;overflow:hidden;margin-top:0;color:var(--an-muted);font-size:9.5px;line-height:1.45;opacity:0;transition:max-height .18s cubic-bezier(.2,.8,.2,1),margin .18s ease,opacity .16s ease}.signal-card:not([open]):hover .signal-hover-copy,.signal-card:not([open]):focus-within .signal-hover-copy{max-height:44px;margin-top:6px;opacity:1}.signal-card-chevron{color:var(--an-muted);transition:transform .16s ease}.signal-card-chevron svg{width:14px;height:14px}.signal-card[open] .signal-card-chevron{transform:rotate(90deg)}.signal-card[open] summary{height:auto;min-height:104px}.signal-card[open] .signal-hover-copy{display:none}.signal-card-body{position:relative;z-index:1;max-height:360px;overflow:auto;padding:0 18px 18px;border-top:1px solid var(--an-line)}
      .flow-takeaway{display:block;margin-top:14px;border-top:1px solid var(--an-line)}.flow-takeaway>summary{display:grid;grid-template-columns:28px minmax(0,1fr) auto 15px;align-items:center;gap:10px;padding:14px 0;cursor:pointer;list-style:none}.flow-takeaway>summary::-webkit-details-marker{display:none}.flow-takeaway>summary>span:first-child{color:var(--an-accent)}.flow-takeaway>summary>span:first-child svg{width:21px;height:21px}.flow-takeaway>summary small{display:block;color:var(--an-accent);font-size:8.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase}.flow-takeaway>summary strong{display:block;margin-top:3px;font-size:12px}.flow-takeaway>summary em{color:var(--an-muted);font-size:9px;font-style:normal}.flow-takeaway>summary>svg{width:14px;height:14px;color:var(--an-muted);transition:transform .16s ease}.flow-takeaway[open]>summary>svg{transform:rotate(90deg)}.flow-takeaway-body{padding:0 0 16px 38px}.flow-takeaway-body>p{max-width:850px;margin:0;color:var(--an-muted);font-size:10.5px;line-height:1.55}
      .analysis-library{padding:46px 0;border-top:1px solid var(--an-line)}.library-heading{margin-bottom:18px}.analysis-drawers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.analysis-drawer{position:relative;min-width:0;border:1px solid color-mix(in srgb,var(--an-ink) 25%,var(--an-line));border-radius:15px 12px 16px 11px/12px 16px 11px 15px;background:color-mix(in srgb,var(--an-surface) 86%,transparent);transition:border-color .16s ease,background .16s ease,transform .16s ease}.analysis-drawer:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--an-accent) 48%,var(--an-line))}.analysis-drawer[open]{grid-column:1/-1;background:var(--an-surface)}.analysis-drawer>summary{display:grid;grid-template-columns:38px minmax(0,1fr) auto 16px;align-items:center;gap:12px;min-height:86px;padding:16px 18px;cursor:pointer;list-style:none}.analysis-drawer>summary::-webkit-details-marker{display:none}.drawer-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:12px 10px 13px 9px;background:var(--an-soft);color:var(--an-accent)}.drawer-icon.production{color:var(--an-production)}.drawer-icon svg{width:18px;height:18px}.analysis-drawer>summary>span:nth-child(2){display:grid;gap:4px}.analysis-drawer>summary strong{font-size:13px}.analysis-drawer>summary small{color:var(--an-muted);font-size:9.5px;font-weight:400}.analysis-drawer>summary em{color:var(--an-muted);font-size:9px;font-style:normal}.analysis-drawer>summary>svg{width:14px;height:14px;color:var(--an-muted);transition:transform .16s ease}.analysis-drawer[open]>summary>svg{transform:rotate(90deg)}.drawer-body{padding:4px 22px 24px;border-top:1px solid var(--an-line)}.drawer-body .story-pair{gap:36px;padding:28px 0 0}.drawer-body>.analysis-section{padding:28px 0 0;border-top:0}.drawer-body .production-focus-panel{margin-bottom:0}.scene-explorer{margin-top:38px}
      .workspace.is-entering .analysis-focus-card,.workspace.is-entering .signal-card,.workspace.is-entering .analysis-drawer{animation:analysisCardIn .24s var(--analysis-entry-delay,0ms) cubic-bezier(.2,.8,.2,1) both}
      @media(max-width:980px){.analysis-focus-grid{grid-template-columns:1fr}.signal-stack{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:none}.signal-card[open]{grid-column:1/-1}.analysis-focus-card{min-height:286px}.analysis-drawers{grid-template-columns:1fr}.analysis-drawer[open]{grid-column:auto}}
      @media(max-width:720px){.analysis-focus-card{min-height:0;padding:23px 21px 21px}.analysis-focus-card h2{font-size:23px}.focus-card-top{grid-template-columns:26px minmax(0,1fr)}.focus-status{grid-column:1/-1;justify-self:start;margin-top:4px}.focus-stats{flex-wrap:wrap;gap:10px}.focus-stats span,.focus-stats span+span{min-width:auto;padding:0 15px 0 0;border:0}.signal-stack{grid-template-columns:1fr}.signal-card[open]{grid-column:auto}.signal-card summary{min-height:116px}.analysis-drawer>summary{grid-template-columns:34px minmax(0,1fr) 14px}.analysis-drawer>summary em{display:none}.drawer-body{padding:2px 17px 20px}.flow-takeaway>summary{grid-template-columns:26px minmax(0,1fr) 14px}.flow-takeaway>summary em{display:none}.flow-takeaway-body{padding-left:36px}}
      .flow-takeaway{padding:0}
      .pro-note{width:max-content;max-width:100%;margin:-18px 0 20px auto;padding:4px 0;border:0;background:transparent;color:var(--an-muted);font-size:9.5px}.pro-note svg{width:14px;height:14px}
      .drawer-production-impact{padding:27px 0 4px}.production-impact-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 22px}.production-impact-grid .insight-row{align-content:start}.production-impact-grid .insight-copy>p{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3}.production-impact-grid .insight-foot{align-items:flex-end;flex-wrap:wrap}
      @supports selector(:has(*)){.signal-stack:has(.signal-card[open]){grid-template-rows:auto;align-content:start;align-self:start}.signal-stack:has(.signal-card[open]) .signal-card:not([open]){display:none}.signal-stack:has(.signal-card[open]) .signal-card[open]{height:auto;overflow:hidden}.signal-stack:has(.signal-card[open]) .signal-card-body{max-height:min(216px,42vh);overscroll-behavior:contain}}
      @media(max-width:980px){.production-impact-grid{grid-template-columns:1fr}}
      @media(max-width:720px){.pro-note{width:100%;margin:-8px 0 18px}}
      .analysis-processing{display:grid;place-items:center;min-height:calc(100vh - 44px);padding:32px;background:radial-gradient(circle at 50% 28%,color-mix(in srgb,var(--an-accent) 15%,transparent),transparent 36%),var(--an-bg)}.analysis-processing-glass{width:min(540px,100%);padding:34px 38px 30px;overflow:hidden;border:1px solid color-mix(in srgb,var(--an-ink) 22%,var(--an-line));border-radius:24px 18px 26px 20px/20px 26px 18px 24px;background:color-mix(in srgb,var(--an-surface) 74%,transparent);box-shadow:0 24px 65px color-mix(in srgb,var(--an-ink) 11%,transparent),inset 0 1px 0 rgba(255,255,255,.4);backdrop-filter:blur(22px) saturate(1.18);text-align:center}.analysis-processing-glass h1{margin:10px 0 8px;font-size:27px;letter-spacing:-.75px}.analysis-processing-glass>p{margin:0;color:var(--an-accent);font-size:12px;font-weight:700}.analysis-orbit{position:relative;display:grid;place-items:center;width:116px;height:116px;margin:0 auto 22px}.analysis-orbit>i{position:absolute;inset:8px;border:1px solid color-mix(in srgb,var(--an-accent) 58%,transparent);border-radius:50%;animation:analysisOrbit 4s linear infinite}.analysis-orbit>i:nth-child(2){inset:23px;border-style:dashed;animation-direction:reverse;animation-duration:5.5s}.analysis-orbit>i:nth-child(3){inset:0;border-color:color-mix(in srgb,var(--an-ink) 16%,transparent);transform:rotateX(68deg);animation:analysisOrbitTilt 3.8s ease-in-out infinite}.analysis-orbit>span{display:grid;place-items:center;width:46px;height:46px;border-radius:16px 12px 17px 13px;background:color-mix(in srgb,var(--an-accent) 14%,var(--an-surface));color:var(--an-accent);box-shadow:0 8px 22px color-mix(in srgb,var(--an-accent) 22%,transparent)}.analysis-orbit svg{width:24px;height:24px}.analysis-stage-progress{margin:27px 0 20px;text-align:left}.analysis-stage-progress>div{display:flex;justify-content:space-between;margin-bottom:8px;color:var(--an-muted);font-size:10px}.analysis-stage-progress strong{color:var(--an-ink);font-variant-numeric:tabular-nums}.analysis-stage-progress>i{display:block;height:5px;overflow:hidden;border-radius:99px;background:color-mix(in srgb,var(--an-ink) 8%,transparent)}.analysis-stage-progress b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--an-accent),color-mix(in srgb,var(--an-accent) 45%,#fff));transition:width .3s ease}.analysis-processing ol{display:grid;grid-template-columns:1fr 1fr;gap:7px 14px;padding:0;margin:0;list-style:none;text-align:left}.analysis-processing li{display:flex;align-items:center;gap:7px;min-width:0;color:var(--an-muted);font-size:9.5px}.analysis-processing li>i{width:7px;height:7px;flex:0 0 7px;border:1px solid var(--an-line);border-radius:50%}.analysis-processing li.is-current{color:var(--an-ink);font-weight:700}.analysis-processing li.is-current>i{border-color:var(--an-accent);background:var(--an-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--an-accent) 15%,transparent);animation:pulse 1.25s ease-in-out infinite}.analysis-processing li.is-complete{color:var(--an-ink)}.analysis-processing li.is-complete>i{border-color:var(--an-positive);background:var(--an-positive)}.analysis-processing small{display:block;margin-top:23px;color:var(--an-muted);font-size:9.5px;line-height:1.45}.analysis-outdated{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin:0 0 20px;padding:15px 17px;border:1px solid #C65550;border-radius:14px 11px 15px 10px;background:color-mix(in srgb,#C65550 10%,var(--an-surface));color:#A24441}.analysis-outdated strong,.analysis-outdated p{display:block;margin:0}.analysis-outdated strong{font-size:12px}.analysis-outdated p{margin-top:4px;color:color-mix(in srgb,#A24441 83%,var(--an-ink));font-size:10.5px;line-height:1.42}.analysis-outdated button{flex:0 0 auto;min-height:34px;padding:0 12px;border:1px solid #B9504B;border-radius:9px 8px 10px 7px;background:#B9504B;color:#fff;font:700 10px/1 inherit;cursor:pointer}.analysis-metadata{display:flex;flex-wrap:wrap;gap:7px 13px;margin:0 0 20px;color:var(--an-muted);font-size:9.5px}.analysis-metadata span{display:inline-flex;gap:4px}.analysis-metadata b{color:var(--an-ink);font-weight:650}@keyframes analysisOrbit{to{transform:rotate(360deg)}}@keyframes analysisOrbitTilt{0%,100%{transform:rotateX(68deg) rotateZ(0)}50%{transform:rotateX(68deg) rotateZ(180deg)}}
    </style>`;
    if (this.loading && !this.analysis) {
      this.shadowRoot.innerHTML = `${style}<main class="empty"><div class="empty-spark">${icon('sparkle')}</div><h1>Analysis</h1><p>Lumiere is connecting to the current screenplay…</p></main>`;
      return;
    }
    if (!this.analysis || (!this.analysis.metrics?.scenes && finite(this.analysis.metrics?.words) < 10)) {
      this.shadowRoot.innerHTML = `${style}${this.emptyState()}`;
      return;
    }
    const waitingForUser = this.analysis.hasEnoughContent
      && !this.analysis.deep
      && !this.analysis.previousDeep
      && !this.analysisRequested
      && !this.analysisStarting
      && !['queued', 'running', 'error', 'interrupted'].includes(this.analysis.status);
    if (waitingForUser) {
      this.shadowRoot.innerHTML = `${style}${this.emptyState()}`;
      return;
    }
    const analysis = this.analysis;
    const metrics = analysis.metrics || {};
    const busy = this.analysisStarting || ['queued', 'running'].includes(analysis.status);
    if (busy) {
      this.shadowRoot.innerHTML = `${style}${this.processingState()}`;
      return;
    }
    const deep = analysis.deep || analysis.previousDeep || null;
    const stale = !analysis.deep && !!analysis.previousDeep;
    const analysisFailure = ['error', 'interrupted'].includes(analysis.status)
      ? (analysis.statusMessage || this.error || '')
      : analysis.failure?.message || '';
    const visibleError = this.error || analysisFailure;
    const data = this.normalizeInsightData(deep, metrics);
    const deepReady = !!deep;
    const access = !this.proActive ? `<div class="pro-note">${icon('sparkle')}<span>Your existing insights and exports remain available. Creator or Full unlocks a new Lumiere reading.</span></div>` : '';
    const shouldAnimateEntry = this._animateEntry;
    const statusClass = String(data.status.label || 'Developing').toLowerCase().replace(/[^a-z]+/g, '-');
    const updatedAt = deep?.generatedAt || analysis.updatedAt;
    const lastScene = analysis.metadata?.lastModifiedRelevantScene;
    const outdated = stale || analysis.metadata?.state === 'outdated';
    const outdatedAction = analysis.failure ? 'Retry' : 'Reanalyze';
    const metadata = `<div class="analysis-metadata"><span>Script version <b>${escapeHtml(String(analysis.metadata?.scriptVersion || analysis.scriptVersion || 'Current'))}</b></span><span>Analysis <b>${escapeHtml(analysis.metadata?.state === 'updated' ? 'Updated' : analysis.metadata?.state === 'outdated' ? 'Outdated' : 'Not generated')}</b></span>${lastScene ? `<span>Last relevant scene <b>Scene ${escapeHtml(String(lastScene.sceneNumber || '—'))}</b></span>` : ''}<span>Date <b>${escapeHtml(updatedAt ? relativeTime(updatedAt) : '—')}</b></span></div>`;
    const outdatedNotice = outdated ? `<section class="analysis-outdated" role="alert"><div><strong>Reanalyze</strong><p>Your script has changed since this analysis was generated.</p></div><button type="button" data-action="reanalyze">${outdatedAction}</button></section>` : '';
    this.shadowRoot.innerHTML = `${style}<main class="workspace${shouldAnimateEntry ? ' is-entering' : ''}">
      <header class="page-header"><div class="page-title"><span class="page-kicker">Analysis · Lumiere</span><h1>${escapeHtml(this.projectTitle)}</h1><div class="title-meta"><span class="script-status ${escapeHtml(statusClass)}">${escapeHtml(data.status.label)}</span><span>${escapeHtml(metrics.scenes || 0)} scenes · current draft</span></div></div><div class="header-actions"><div class="sync-state" role="status" aria-live="polite"><i></i><span>${analysisFailure ? escapeHtml(analysisFailure) : `Updated ${escapeHtml(relativeTime(updatedAt))}`}</span></div><button type="button" class="export" data-action="refresh">↻ <span>${outdated ? 'Reanalyze' : 'Refresh'}</span></button><button type="button" class="export" data-action="export">${icon('download')}<span>Export</span></button></div></header>
      ${outdatedNotice}${visibleError && !outdated ? `<div class="error" role="alert"><span>${escapeHtml(visibleError)}</span><button type="button" data-action="retry">Try again</button></div>` : ''}${access}${metadata}
      ${this.analysisFocusPanel(data, stale, deepReady)}
      ${this.storyFlowPanel(data, stale)}
      ${this.storyClarityPanel(data, stale)}
      ${this.secondaryInsightsPanel(data, stale, deepReady)}
      ${this.sceneExplorer(data)}
    </main>`;
    if (shouldAnimateEntry) {
      this.shadowRoot.querySelectorAll('.analysis-focus-card,.signal-card,.analysis-section,.analysis-drawer').forEach((section, index) => {
        section.style.setProperty('--analysis-entry-delay', `${Math.min(index, 10) * 24}ms`);
      });
      this._animateEntry = false;
    }
  }
}

if (!customElements.get('film-script-analysis')) customElements.define('film-script-analysis', FilmScriptAnalysis);
