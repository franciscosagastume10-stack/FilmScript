const translationEscapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

class FilmScriptTranslation extends HTMLElement {
  static get observedAttributes() { return ['script-id', 'job-id', 'target-language', 'project-title']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.source = null;
    this.translation = null;
    this.job = null;
    this.error = '';
    this.loading = true;
    this._onJobUpdate = (event) => this.receiveJob(event.detail?.job);
  }

  get scriptId() { return this.getAttribute('script-id') || ''; }
  get jobId() { return this.getAttribute('job-id') || ''; }
  get targetLanguage() { return this.getAttribute('target-language') || ''; }
  get projectTitle() { return this.getAttribute('project-title') || ''; }
  get spanish() { return String(document.documentElement.lang || '').toLowerCase().startsWith('es'); }
  t(english, spanish) { return this.spanish ? spanish : english; }

  connectedCallback() {
    window.addEventListener('filmscript:ai.job.updated', this._onJobUpdate);
    window.addEventListener('filmscript:ai.job.completed', this._onJobUpdate);
    this.shadowRoot.addEventListener('click', (event) => this.handleClick(event));
    this.load();
  }

  disconnectedCallback() {
    window.removeEventListener('filmscript:ai.job.updated', this._onJobUpdate);
    window.removeEventListener('filmscript:ai.job.completed', this._onJobUpdate);
  }

  attributeChangedCallback(name, previous, next) {
    if (this.isConnected && previous !== next && ['script-id', 'job-id'].includes(name)) this.load();
  }

  async requestJob(jobId = this.jobId) {
    if (!jobId) return null;
    if (window.filmscriptPlatform?.api?.aiJob) return window.filmscriptPlatform.api.aiJob(jobId);
    const response = await fetch(window.filmscriptApiUrl ? window.filmscriptApiUrl(`/api/ai-jobs/${encodeURIComponent(jobId)}`) : `/api/ai-jobs/${encodeURIComponent(jobId)}`, { credentials: 'include', cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.message || payload.error || 'Could not load translation.'), { status: response.status });
    return payload;
  }

  async load() {
    if (!this.scriptId || !this.jobId) {
      this.loading = false;
      this.error = this.t('This translation link is incomplete.', 'Este enlace de traducción está incompleto.');
      this.render();
      return;
    }
    this.loading = true;
    this.error = '';
    this.translation = null;
    this.render();
    const sourceRequest = window.filmscriptScripts?.get?.(this.scriptId);
    if (!sourceRequest) {
      this.loading = false;
      this.error = this.t('The screenplay is not available right now.', 'El guion no está disponible ahora.');
      this.render();
      return;
    }
    const [sourceResult, jobResult] = await Promise.allSettled([sourceRequest, this.requestJob()]);
    if (sourceResult.status === 'fulfilled') this.source = sourceResult.value?.script || null;
    if (jobResult.status === 'fulfilled') this.job = jobResult.value?.job || null;
    if (!this.source) this.error = this.t('The original screenplay could not be loaded.', 'No se pudo cargar el guion original.');
    if (!this.job && !this.error) this.error = this.t('The translation job could not be loaded.', 'No se pudo cargar el trabajo de traducción.');
    this.loading = false;
    await this.loadCompletedTranslation();
    this.render();
  }

  async loadCompletedTranslation() {
    const projectId = this.job?.output?.projectId || this.job?.output?.scriptId;
    if (!projectId || this.translation || !window.filmscriptScripts?.get) return;
    try { this.translation = (await window.filmscriptScripts.get(projectId))?.script || null; }
    catch (error) { this.error = this.t('The translated screenplay is ready, but could not be opened yet.', 'El guion traducido está listo, pero aún no se pudo abrir.'); }
  }

  async receiveJob(job) {
    if (!job || job.id !== this.jobId) return;
    this.job = job;
    this.error = '';
    if (job.status === 'completed') await this.loadCompletedTranslation();
    this.render();
  }

  stageLabel() {
    const stage = this.job?.stage || this.job?.status || 'queued';
    const labels = {
      queued: this.t('Preparing your translation', 'Preparando tu traducción'),
      validating: this.t('Reading the original screenplay', 'Leyendo el guion original'),
      translating: this.t('Translating screenplay beats', 'Traduciendo los momentos del guion'),
      saving: this.t('Finalizing the translated screenplay', 'Finalizando el guion traducido'),
      completed: this.t('Translation ready', 'Traducción lista'),
      failed: this.t('Translation needs another try', 'La traducción necesita otro intento'),
      cancelled: this.t('Translation was cancelled', 'La traducción fue cancelada'),
    };
    return labels[stage] || this.t('Preparing your translation', 'Preparando tu traducción');
  }

  statusCopy() {
    if (this.job?.status === 'completed') return this.t('Your translated screenplay is ready beside the original.', 'Tu guion traducido está listo junto al original.');
    if (['failed', 'cancelled'].includes(this.job?.status)) return this.t('Your original screenplay is untouched. You can safely try again.', 'Tu guion original no cambió. Puedes volver a intentarlo con seguridad.');
    return this.t('Lumiere is working in the background. You can leave this view; the result will remain here.', 'Lumiere trabaja en segundo plano. Puedes salir de esta vista; el resultado permanecerá aquí.');
  }

  renderLines(script, empty = false) {
    const blocks = Array.isArray(script?.blocks) ? script.blocks.filter((block) => block?.type !== 'pagebreak' && String(block?.text || '').trim()) : [];
    if (!blocks.length && !empty) return `<div class="document-empty">${this.t('No screenplay text is available.', 'No hay texto de guion disponible.')}</div>`;
    return `<div class="screenplay-lines">${blocks.map((block) => `<p class="line is-${translationEscapeHtml(block.type || 'action')}">${translationEscapeHtml(block.text)}</p>`).join('')}</div>`;
  }

  renderLoadingDocument() {
    const percent = Math.max(3, Math.min(96, Number(this.job?.progress || 8)));
    return `<div class="translation-loading" role="status" aria-live="polite">
      <div class="loading-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
      <strong>${translationEscapeHtml(this.stageLabel())}</strong>
      <p>${translationEscapeHtml(this.statusCopy())}</p>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div>
      <span>${percent}%</span>
      <div class="ghost-lines" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </div>`;
  }

  renderTarget() {
    if (this.translation) return this.renderLines(this.translation);
    if (['failed', 'cancelled'].includes(this.job?.status)) return `<div class="translation-failed"><div class="failed-mark">!</div><strong>${translationEscapeHtml(this.stageLabel())}</strong><p>${translationEscapeHtml(this.statusCopy())}</p><button type="button" data-action="retry">${this.t('Try again', 'Intentar de nuevo')}</button></div>`;
    return this.renderLoadingDocument();
  }

  render() {
    const completed = !!this.translation;
    const targetTitle = this.translation?.title || this.job?.output?.title || `${this.projectTitle || this.source?.title || this.t('Screenplay', 'Guion')} · ${this.targetLanguage || this.t('Translation', 'Traducción')}`;
    this.shadowRoot.innerHTML = `<style>${this.styles()}</style><main class="translation-shell">
      <header class="translation-top"><div><span>${this.t('LIVE TRANSLATION', 'TRADUCCIÓN EN VIVO')}</span><h1>${this.t('Original and translation', 'Original y traducción')}</h1><p>${translationEscapeHtml(this.statusCopy())}</p></div><div class="top-actions"><button type="button" class="back" data-action="back">${this.t('Back to editor', 'Volver al editor')}</button>${completed ? `<button type="button" class="open" data-action="open">${this.t('Open translated script', 'Abrir guion traducido')}</button>` : ''}</div></header>
      ${this.error ? `<div class="error" role="alert">${translationEscapeHtml(this.error)}</div>` : ''}
      <section class="compare-grid" aria-label="${this.t('Screenplay translation comparison', 'Comparación de traducción del guion')}">
        <article class="script-pane"><header><span class="pane-dot original"></span><div><small>${this.t('ORIGINAL', 'ORIGINAL')}</small><h2>${translationEscapeHtml(this.source?.title || this.projectTitle || this.t('Screenplay', 'Guion'))}</h2></div><span class="read-only">${this.t('Read only', 'Solo lectura')}</span></header><div class="document">${this.loading ? this.renderLoadingDocument() : this.renderLines(this.source)}</div></article>
        <article class="script-pane translated${completed ? ' is-complete' : ''}"><header><span class="pane-dot translated"></span><div><small>${translationEscapeHtml(this.targetLanguage || this.t('TRANSLATION', 'TRADUCCIÓN')).toUpperCase()}</small><h2>${translationEscapeHtml(targetTitle)}</h2></div><span class="status ${translationEscapeHtml(this.job?.status || 'queued')}">${completed ? this.t('Ready', 'Listo') : translationEscapeHtml(this.stageLabel())}</span></header><div class="document">${this.renderTarget()}</div></article>
      </section>
    </main>`;
  }

  async handleClick(event) {
    const action = event.target.closest?.('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'back') {
      window.location.assign(`Editor%20v5.dc.html?script=${encodeURIComponent(this.scriptId)}&view=editor`);
      return;
    }
    if (action === 'open' && this.translation?.id) {
      window.location.assign(`Editor%20v5.dc.html?script=${encodeURIComponent(this.translation.id)}&view=editor`);
      return;
    }
    if (action === 'retry') {
      try {
        const result = await window.filmscriptPlatform?.api?.aiJobAction?.(this.jobId, 'retry');
        const next = result?.job;
        if (!next?.id) throw new Error(this.t('Could not restart translation.', 'No se pudo reiniciar la traducción.'));
        const url = new URL(window.location.href); url.searchParams.set('translationJob', next.id); window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
        this.setAttribute('job-id', next.id);
      } catch (error) {
        this.error = error.message || this.t('Could not restart translation.', 'No se pudo reiniciar la traducción.');
        this.render();
      }
    }
  }

  styles() { return `
    :host{display:block;min-height:100%;color:var(--ink,#2c2c2a);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .translation-shell{max-width:1540px;margin:0 auto;padding:34px 48px 64px}
    .translation-top{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:4px 0 26px}
    .translation-top span,.script-pane small{display:block;color:var(--accent,#ba7517);font-size:10px;font-weight:850;letter-spacing:.15em}
    h1{margin:8px 0 5px;font-size:32px;letter-spacing:-.055em;line-height:1}p{margin:0;color:var(--muted,#77766f);font-size:13px;line-height:1.5}
    .top-actions{display:flex;gap:9px}.top-actions button,.translation-failed button{min-height:42px;padding:0 14px;border-radius:12px;font:750 12px inherit;cursor:pointer}.back{border:1px solid var(--hair,#e7e4da);background:rgba(255,255,255,.55);color:var(--ink,#2c2c2a)}.open,.translation-failed button{border:0;background:linear-gradient(135deg,#f7c65e,var(--accent,#ba7517));color:#281c0e;box-shadow:0 8px 20px rgba(160,104,19,.18)}
    button:focus-visible{outline:3px solid color-mix(in srgb,var(--accent,#ba7517) 55%,white);outline-offset:2px}.error{margin-bottom:16px;padding:12px 14px;border:1px solid rgba(195,65,55,.28);border-radius:13px;background:rgba(215,80,63,.1);color:#a1352a;font-size:12px}
    .compare-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:stretch}.script-pane{min-width:0;overflow:hidden;border:1px solid color-mix(in srgb,var(--hair,#e7e4da) 84%,transparent);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--surface,#fffef9) 84%,transparent),color-mix(in srgb,var(--bg,#f5f0e8) 66%,transparent));box-shadow:0 16px 42px rgba(47,39,23,.055),inset 0 1px rgba(255,255,255,.82);backdrop-filter:blur(24px) saturate(145%)}.script-pane.translated{border-color:color-mix(in srgb,var(--accent,#ba7517) 35%,var(--hair,#e7e4da))}.script-pane.is-complete{box-shadow:0 16px 42px rgba(47,39,23,.055),0 0 0 4px color-mix(in srgb,var(--accent,#ba7517) 8%,transparent),inset 0 1px rgba(255,255,255,.82)}
    .script-pane>header{display:flex;align-items:center;gap:10px;min-height:67px;padding:13px 16px;border-bottom:1px solid rgba(128,113,86,.1)}.pane-dot{width:9px;height:9px;flex:0 0 9px;border-radius:50%;box-shadow:0 0 0 5px color-mix(in srgb,currentColor 12%,transparent)}.pane-dot.original{color:#8293b4;background:#8293b4}.pane-dot.translated{color:var(--accent,#ba7517);background:var(--accent,#ba7517)}.script-pane header>div{min-width:0;flex:1}.script-pane small{font-size:9px}.script-pane h2{overflow:hidden;margin:4px 0 0;color:var(--ink,#2c2c2a);font-size:13px;letter-spacing:-.01em;text-overflow:ellipsis;white-space:nowrap}.read-only,.status{max-width:150px;overflow:hidden;padding:5px 8px;border-radius:999px;background:rgba(111,100,82,.07);color:var(--muted,#77766f);font-size:9px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}.status.completed{color:#267457;background:rgba(52,141,97,.1)}
    .document{min-height:620px;max-height:calc(100vh - 244px);overflow:auto;padding:42px 13%;background:linear-gradient(90deg,rgba(255,255,255,.2),transparent 16%,transparent 84%,rgba(255,255,255,.16));scrollbar-color:color-mix(in srgb,var(--accent,#ba7517) 32%,transparent) transparent}.screenplay-lines{max-width:530px;margin:0 auto;font-family:"Courier Prime","Courier New",monospace;font-size:13px;line-height:1.55}.line{margin:0 0 13px;white-space:pre-wrap}.line.is-scene{margin-top:24px;font-weight:800;text-transform:uppercase}.line.is-character{width:54%;margin-top:18px;margin-left:35%;font-weight:800;text-transform:uppercase}.line.is-dialogue,.line.is-paren{width:62%;margin-left:25%}.line.is-paren{font-style:italic}.line.is-transition{margin-left:58%;font-weight:800;text-align:right;text-transform:uppercase}.document-empty{display:grid;place-items:center;min-height:520px;color:var(--muted,#77766f);font-size:13px;text-align:center}
    .translation-loading,.translation-failed{display:flex;min-height:520px;align-items:center;justify-content:center;flex-direction:column;padding:32px;text-align:center}.translation-loading strong,.translation-failed strong{margin-top:15px;font-size:16px;letter-spacing:-.02em}.translation-loading p,.translation-failed p{max-width:370px;margin-top:7px;font-size:12px}.loading-orbit{position:relative;width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff5c6 0 7%,#edbd54 25%,#aa6a19 76%);box-shadow:0 0 0 7px rgba(221,174,62,.09),0 14px 26px rgba(169,103,17,.2);overflow:hidden}.loading-orbit i{position:absolute;inset:-22%;border:1px solid rgba(255,255,255,.72);border-radius:45%;animation:orbit 3.2s linear infinite}.loading-orbit i:nth-child(2){inset:-8%;animation-duration:2.35s;animation-direction:reverse}.loading-orbit i:nth-child(3){inset:-38%;animation-duration:4.3s}.progress{width:min(290px,90%);height:5px;overflow:hidden;margin-top:20px;border-radius:999px;background:rgba(122,104,73,.13)}.progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#edb742,#fff2b4);transition:width .45s ease}.translation-loading>span{margin-top:7px;color:var(--accent,#9a5f0d);font-size:11px;font-weight:800}.ghost-lines{display:grid;gap:10px;width:min(380px,90%);margin-top:32px}.ghost-lines i{height:9px;border-radius:999px;background:linear-gradient(90deg,rgba(186,117,23,.08),rgba(255,255,255,.76),rgba(186,117,23,.08));background-size:200% 100%;animation:shimmer 1.8s ease-in-out infinite}.ghost-lines i:nth-child(2n){width:76%;margin-left:17%}.ghost-lines i:nth-child(3n){width:58%;margin-left:30%}.failed-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:rgba(195,71,57,.11);color:#a84a3c;font-weight:900}.translation-failed button{margin-top:20px}
    @keyframes orbit{to{transform:rotate(360deg)}}@keyframes shimmer{to{background-position:-200% 0}}@media(max-width:900px){.translation-shell{padding:24px 18px 48px}.compare-grid{grid-template-columns:1fr}.document{min-height:460px;max-height:560px;padding:32px 12%}}@media(max-width:560px){.translation-top{align-items:flex-start;flex-direction:column}.top-actions{width:100%}.top-actions button{flex:1}.document{padding:28px 10%}.line.is-character{width:66%;margin-left:25%}.line.is-dialogue,.line.is-paren{width:82%;margin-left:12%}}
  `; }
}

if (!customElements.get('film-script-translation')) customElements.define('film-script-translation', FilmScriptTranslation);
