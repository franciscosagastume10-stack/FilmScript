import { computeBudget, normalizeBudget, PHASES } from './budget-model.js';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

class FilmScriptBudget extends HTMLElement {
  static get observedAttributes() { return ['script-id', 'project-title']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.view = 'quick';
    this.loading = true;
    this.error = '';
    this.saveStatus = '';
    this.uploadStatus = '';
    this.search = '';
    this.phaseFilter = 'all';
    this.showAllAccounts = false;
    this.openAccounts = new Set();
    this.scheduleItemId = '';
    this._saveRevision = 0;
    this._animateView = true;
    this._animateModal = false;
    this._moneyAnimationFrame = 0;
    this._moneySoundTimer = 0;
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this._onClick);
    this.shadowRoot.addEventListener('change', this._onChange);
    this.shadowRoot.addEventListener('input', this._onInput);
    this.shadowRoot.addEventListener('keydown', this._onKeyDown);
    window.filmscriptSounds?.preload('formatControl');
    window.filmscriptSounds?.preload('budgetCount');
    this.load();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener('click', this._onClick);
    this.shadowRoot.removeEventListener('change', this._onChange);
    this.shadowRoot.removeEventListener('input', this._onInput);
    this.shadowRoot.removeEventListener('keydown', this._onKeyDown);
    clearTimeout(this._saveTimer);
    cancelAnimationFrame(this._moneyAnimationFrame);
    this.stopMoneySound();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'script-id' && oldValue && oldValue !== newValue && this.isConnected) this.load();
  }

  get scriptId() { return this.getAttribute('script-id') || ''; }
  get projectTitle() { return this.getAttribute('project-title') || 'Untitled screenplay'; }

  async load() {
    if (!this.scriptId || !window.filmscriptBudget) {
      this.loading = false;
      this.error = 'Budget is not available for this screenplay.';
      this.render();
      return;
    }
    this.loading = true;
    this.error = '';
    this.render();
    try {
      const result = await window.filmscriptBudget.get(this.scriptId);
      this.budget = normalizeBudget(result.budget, this.projectTitle);
      const computed = computeBudget(this.budget, this.projectTitle);
      this.openAccounts = new Set(computed.accounts
        .filter((account) => account.total > 0 || account.spent > 0)
        .map((account) => account.code));
      this.showAllAccounts = false;
      this.loading = false;
      this.render();
    } catch (error) {
      this.loading = false;
      this.error = error.message || 'Could not load this budget.';
      this.render();
    }
  }

  formatMoney(value) {
    const budget = this.budget || {};
    const code = budget.settings?.currencyCode || 'GTQ';
    const symbol = budget.settings?.currencySymbol || 'Q';
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(finite(value));
    } catch {
      return `${symbol}${finite(value).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  moneyValue(value) {
    const amount = finite(value);
    const formatted = this.formatMoney(amount);
    return `<span class="budget-count" data-budget-count="${amount}" aria-label="${escapeHtml(formatted)}">${escapeHtml(formatted)}</span>`;
  }

  stopMoneySound() {
    clearTimeout(this._moneySoundTimer);
    this._moneySoundTimer = 0;
    window.filmscriptSounds?.stop('budgetCount');
  }

  animateMoneyValues() {
    const nodes = Array.from(this.shadowRoot.querySelectorAll('[data-budget-count]'));
    this.stopMoneySound();
    if (!nodes.length || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    cancelAnimationFrame(this._moneyAnimationFrame);
    nodes.forEach((node) => { node.textContent = this.formatMoney(0); });
    const duration = 320;
    window.filmscriptSounds?.play('budgetCount', { volume: 0.11 });
    this._moneySoundTimer = window.setTimeout(() => this.stopMoneySound(), duration + 80);
    const startedAt = performance.now();
    const easeInOut = (progress) => progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = easeInOut(progress);
      nodes.forEach((node) => {
        node.textContent = this.formatMoney(finite(node.dataset.budgetCount) * eased);
      });
      if (progress < 1) this._moneyAnimationFrame = requestAnimationFrame(tick);
      else {
        this._moneyAnimationFrame = 0;
        this.stopMoneySound();
      }
    };
    this._moneyAnimationFrame = requestAnimationFrame(tick);
  }

  formatPercent(value, digits = 0) {
    return `${(finite(value) * 100).toFixed(digits)}%`;
  }

  queueSave(render = true) {
    if (!this.budget || !this.scriptId) return;
    this.budget.updatedAt = new Date().toISOString();
    this.saveStatus = 'Saving';
    const revision = ++this._saveRevision;
    clearTimeout(this._saveTimer);
    if (render) this.render();
    else this.syncStatusText();
    this._saveTimer = window.setTimeout(async () => {
      try {
        const result = await window.filmscriptBudget.save(this.scriptId, this.budget);
        if (revision !== this._saveRevision) return;
        this.budget = normalizeBudget(result.budget, this.projectTitle);
        this.saveStatus = 'Saved';
        this.error = '';
        const keepEditing = !render && this.shadowRoot.activeElement?.matches?.('[data-model]');
        if (keepEditing) this.syncStatusText();
        else this.render();
      } catch (error) {
        if (revision !== this._saveRevision) return;
        this.saveStatus = 'Save failed';
        this.error = error.message || 'Could not save this budget.';
        const keepEditing = !render && this.shadowRoot.activeElement?.matches?.('[data-model]');
        if (keepEditing) this.syncStatusText();
        else this.render();
      }
    }, 420);
  }

  syncStatusText() {
    const status = this.shadowRoot.querySelector('.budget-actions span');
    if (status) status.textContent = this.saveStatus || this.uploadStatus;
  }

  findItem(itemId) {
    for (const account of this.budget?.accounts || []) {
      const item = account.items.find((entry) => entry.id === itemId);
      if (item) return { account, item };
    }
    return null;
  }

  findFunding(sourceId) { return this.budget?.fundingSources?.find((source) => source.id === sourceId); }
  findExpense(expenseId) { return this.budget?.expenses?.find((expense) => expense.id === expenseId); }

  _onInput = (event) => {
    const search = event.target.closest('[data-budget-search]');
    if (search) {
      this.search = search.value;
      this.render();
      requestAnimationFrame(() => {
        const next = this.shadowRoot.querySelector('[data-budget-search]');
        if (next) { next.focus(); next.setSelectionRange(this.search.length, this.search.length); }
      });
      return;
    }
    const input = event.target;
    if (!input.dataset.model || input.tagName !== 'INPUT' || input.type === 'file') return;
    this.updateModelInput(input, false);
  };

  _onKeyDown = (event) => {
    if (event.key === 'Escape' && this.scheduleItemId) {
      this.scheduleItemId = '';
      this.render();
      return;
    }
    const activeTab = event.target.closest('.tabs [data-view]');
    if (!activeTab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(this.shadowRoot.querySelectorAll('.tabs [data-view]'));
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < 0) return;
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };

  _onClick = (event) => {
    if (event.target.classList?.contains('modal-backdrop')) {
      this.scheduleItemId = '';
      this.render();
      return;
    }
    const target = event.target.closest('[data-action], [data-view]');
    if (!target) return;
    if (target.dataset.view) {
      const nextView = target.dataset.view;
      if (nextView === this.view) return;
      window.filmscriptSounds?.play('formatControl');
      this.view = nextView;
      this.scheduleItemId = '';
      this._animateView = true;
      this.render();
      return;
    }
    const action = target.dataset.action;
    if (action === 'toggle-account') {
      event.preventDefault();
      const accountCode = target.dataset.account;
      if (this.openAccounts.has(accountCode)) this.openAccounts.delete(accountCode);
      else this.openAccounts.add(accountCode);
      this.render();
      return;
    }
    if (action === 'retry') this.load();
    if (action === 'export') this.exportPdf();
    if (action === 'toggle-empty-accounts') { this.showAllAccounts = !this.showAllAccounts; this.render(); }
    if (action === 'add-item') this.addItem(target.dataset.account);
    if (action === 'remove-item') this.removeItem(target.dataset.id);
    if (action === 'open-schedule') { this.scheduleItemId = target.dataset.id; this._animateModal = true; this.render(); }
    if (action === 'close-schedule') { this.scheduleItemId = ''; this.render(); }
    if (action === 'add-funding') this.addFunding();
    if (action === 'remove-funding') this.removeFunding(target.dataset.id);
    if (action === 'add-expense') this.addExpense();
    if (action === 'remove-expense') this.removeExpense(target.dataset.id);
    if (action === 'add-tax') this.addTax();
    if (action === 'remove-tax') this.removeTax(target.dataset.id);
    if (action === 'view-receipt') window.open(window.filmscriptBudget.receiptUrl(this.scriptId, target.dataset.receipt), '_blank', 'noopener');
  };

  _onChange = (event) => {
    const input = event.target;
    if (input.dataset.phaseFilter !== undefined) {
      this.phaseFilter = input.value;
      this.render();
      return;
    }
    this.updateModelInput(input, true);
    if (input.dataset.receiptFor) this.attachReceipt(input);
  };

  updateModelInput(input, render = true) {
    if (input.dataset.model === 'item') this.updateItem(input, render);
    if (input.dataset.model === 'schedule') this.updateSchedule(input, render);
    if (input.dataset.model === 'funding') this.updateFunding(input, render);
    if (input.dataset.model === 'expense') this.updateExpense(input, render);
    if (input.dataset.model === 'setting') this.updateSetting(input, render);
    if (input.dataset.model === 'metadata') this.updateMetadata(input, render);
    if (input.dataset.model === 'tax') this.updateTax(input, render);
  }

  updateItem(input, render = true) {
    const found = this.findItem(input.dataset.id);
    if (!found || found.item.calculation === 'contingency') return;
    const field = input.dataset.field;
    if (field === 'tax') {
      const [taxRateId, taxMode] = input.value.split(':');
      found.item.taxRateId = taxRateId;
      found.item.taxMode = taxMode === 'included' ? 'included' : 'exclusive';
    } else if (['quantity', 'multiplier', 'unitCost'].includes(field)) {
      found.item[field] = Math.max(0, finite(input.value));
    } else if (['costType', 'fundingKind', 'origin'].includes(field)) {
      found.item[field] = input.value;
    } else {
      found.item[field] = input.value.slice(0, field === 'name' ? 180 : 80);
    }
    this.queueSave(render);
  }

  updateSchedule(input, render = true) {
    const found = this.findItem(input.dataset.id);
    if (!found) return;
    found.item.schedule[input.dataset.period] = Math.max(0, finite(input.value));
    this.queueSave(render);
  }

  updateFunding(input, render = true) {
    const source = this.findFunding(input.dataset.id);
    if (!source) return;
    const field = input.dataset.field;
    source[field] = ['amount', 'paid'].includes(field) ? Math.max(0, finite(input.value)) : input.value.slice(0, 240);
    if (source.amount > 0 && source.paid >= source.amount) source.status = 'Received';
    else if (source.paid > 0 && source.status === 'Planned') source.status = 'Partially paid';
    this.queueSave(render);
  }

  updateExpense(input, render = true) {
    const expense = this.findExpense(input.dataset.id);
    if (!expense) return;
    const field = input.dataset.field;
    expense[field] = field === 'amount' ? Math.max(0, finite(input.value)) : input.value.slice(0, 240);
    this.queueSave(render);
  }

  updateSetting(input, render = true) {
    const field = input.dataset.field;
    if (field === 'contingencyRate') this.budget.settings[field] = Math.max(0, Math.min(0.5, finite(input.value) / 100));
    else this.budget.settings[field] = input.value.slice(0, 8);
    this.queueSave(render);
  }

  updateMetadata(input, render = true) {
    this.budget.metadata[input.dataset.field] = input.value.slice(0, 180);
    this.queueSave(render);
  }

  updateTax(input, render = true) {
    const rate = this.budget.settings.taxRates.find((entry) => entry.id === input.dataset.id);
    if (!rate) return;
    if (input.dataset.field === 'rate') rate.rate = Math.max(0, Math.min(1, finite(input.value) / 100));
    else rate.name = input.value.slice(0, 60);
    this.queueSave(render);
  }

  addItem(accountCode) {
    const account = this.budget.accounts.find((entry) => entry.code === accountCode) || this.budget.accounts[0];
    if (!account) return;
    this.openAccounts.add(account.code);
    const nextNumber = account.items.length + 1;
    account.items.push({
      id: uid(`li_${account.code}`),
      code: `${account.code.slice(0, 2)}${String(nextNumber).padStart(2, '0')}`,
      name: 'New cost',
      quantity: 1,
      unit: 'flat',
      multiplier: 1,
      unitCost: 0,
      taxRateId: 'tax_exempt',
      taxMode: 'exclusive',
      costType: 'fixed',
      fundingKind: 'cash',
      origin: 'producer',
      invoiceNumber: '',
      schedule: {},
      calculation: '',
    });
    this.queueSave();
  }

  removeItem(itemId) {
    for (const account of this.budget.accounts) {
      const index = account.items.findIndex((item) => item.id === itemId);
      if (index < 0 || account.items[index].calculation === 'contingency') continue;
      account.items.splice(index, 1);
      this.budget.expenses = this.budget.expenses.map((expense) => expense.lineItemId === itemId ? { ...expense, lineItemId: '' } : expense);
      this.queueSave();
      return;
    }
  }

  addFunding() {
    this.budget.fundingSources.push({
      id: uid('fund'), name: 'New contributor', type: 'cash', amount: 0, paid: 0,
      status: 'Planned', paymentDate: '', notes: '', receiptId: '', receiptName: '', receiptType: '', receiptSize: 0,
    });
    this.queueSave();
  }

  removeFunding(sourceId) {
    this.budget.fundingSources = this.budget.fundingSources.filter((source) => source.id !== sourceId);
    this.queueSave();
  }

  addExpense() {
    const firstItem = this.budget.accounts.flatMap((account) => account.items).find((item) => item.calculation !== 'contingency');
    this.budget.expenses.push({
      id: uid('expense'), lineItemId: firstItem?.id || '', paymentNumber: String(this.budget.expenses.length + 1),
      paymentDate: new Date().toISOString().slice(0, 10), vendor: '', concept: '', amount: 0, notes: '',
      receiptId: '', receiptName: '', receiptType: '', receiptSize: 0,
    });
    this.queueSave();
  }

  removeExpense(expenseId) {
    this.budget.expenses = this.budget.expenses.filter((expense) => expense.id !== expenseId);
    this.queueSave();
  }

  addTax() {
    const id = uid('tax');
    this.budget.settings.taxRates.push({ id, name: 'New tax', rate: 0 });
    this.queueSave();
  }

  removeTax(taxId) {
    if (taxId === 'tax_exempt') return;
    this.budget.settings.taxRates = this.budget.settings.taxRates.filter((rate) => rate.id !== taxId);
    this.budget.accounts.forEach((account) => account.items.forEach((item) => {
      if (item.taxRateId === taxId) { item.taxRateId = 'tax_exempt'; item.taxMode = 'exclusive'; }
    }));
    this.queueSave();
  }

  async attachReceipt(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.uploadStatus = 'Choose a photo or image file.';
      this.render();
      return;
    }
    this.uploadStatus = 'Compressing receipt';
    this.render();
    try {
      const blob = await this.compressImage(file);
      this.uploadStatus = 'Uploading receipt';
      this.render();
      const filename = `${file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'receipt'}.webp`;
      const uploaded = await window.filmscriptBudget.uploadReceipt(this.scriptId, blob, filename);
      const target = input.dataset.receiptFor === 'funding' ? this.findFunding(input.dataset.id) : this.findExpense(input.dataset.id);
      if (!target) return;
      target.receiptId = uploaded.receipt.id;
      target.receiptName = uploaded.receipt.filename;
      target.receiptType = uploaded.receipt.mimeType;
      target.receiptSize = uploaded.receipt.size;
      this.uploadStatus = `Receipt compressed to ${Math.max(1, Math.round(uploaded.receipt.size / 1024))} KB`;
      this.queueSave();
    } catch (error) {
      this.uploadStatus = error.message || 'Could not attach this receipt.';
      this.render();
    }
  }

  async compressImage(file) {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      const url = URL.createObjectURL(file);
      element.onload = () => { URL.revokeObjectURL(url); resolve(element); };
      element.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
      element.src = url;
    });
    let width = image.naturalWidth;
    let height = image.naturalHeight;
    const maxDimension = 1600;
    if (Math.max(width, height) > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    const encode = (targetWidth, targetHeight, quality) => new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, targetWidth, targetHeight);
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not compress this image.')), 'image/webp', quality);
    });
    let quality = 0.78;
    let blob = await encode(width, height, quality);
    while (blob.size > 420 * 1024 && quality > 0.46) {
      quality -= 0.08;
      blob = await encode(width, height, quality);
    }
    if (blob.size > 520 * 1024) {
      width = Math.max(1, Math.round(width * 0.78));
      height = Math.max(1, Math.round(height * 0.78));
      blob = await encode(width, height, 0.58);
    }
    return blob;
  }

  exportPdf() {
    if (!this.scriptId) return;
    this.uploadStatus = 'Preparing export';
    this.render();
    const link = document.createElement('a');
    link.href = window.filmscriptBudget.exportUrl(this.scriptId);
    link.download = `${this.projectTitle || 'FilmScript'} budget.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => { this.uploadStatus = ''; this.render(); }, 900);
  }

  render() {
    if (!this.shadowRoot) return;
    const styles = this.styles();
    if (this.loading) {
      this.shadowRoot.innerHTML = `${styles}<div class="fs-budget"><div class="loading" role="status"><span></span><strong>Loading Budget</strong><small>Connecting this financial plan to your screenplay.</small></div></div>`;
      return;
    }
    if (this.error && !this.budget) {
      this.shadowRoot.innerHTML = `${styles}<div class="fs-budget"><div class="empty"><strong>Budget could not be opened</strong><p>${escapeHtml(this.error)}</p><button class="primary" data-action="retry">Try again</button></div></div>`;
      return;
    }
    const computed = computeBudget(this.budget, this.projectTitle);
    const views = [
      ['quick', 'Quick View'], ['summary', 'Summary'], ['breakdown', 'Breakdown'],
      ['finance', 'Finance'], ['expenses', 'Expenses'], ['settings', 'Settings'],
    ];
    const tabs = views.map(([id, label]) => `<button type="button" role="tab" data-view="${id}" aria-selected="${this.view === id}" aria-pressed="${this.view === id}" tabindex="${this.view === id ? '0' : '-1'}">${label}</button>`).join('');
    let content = this.renderQuick(computed);
    if (this.view === 'summary') content = this.renderSummary(computed);
    if (this.view === 'breakdown') content = this.renderBreakdown(computed);
    if (this.view === 'finance') content = this.renderFinance(computed);
    if (this.view === 'expenses') content = this.renderExpenses(computed);
    if (this.view === 'settings') content = this.renderSettings(computed);
    this.shadowRoot.innerHTML = `${styles}
      <div class="fs-budget">
        <div class="budget-nav">
          <div class="tabs" role="tablist" aria-label="Budget views">${tabs}</div>
          <div class="budget-actions"><span aria-live="polite">${escapeHtml(this.saveStatus || this.uploadStatus)}</span><button type="button" class="export" data-action="export">Export</button></div>
        </div>
        ${this.error ? `<div class="notice error" role="alert">${escapeHtml(this.error)}</div>` : ''}
        ${content}
        ${this.renderScheduleModal(computed)}
      </div>`;
    if (this._animateView) {
      this.shadowRoot.querySelector('.view')?.classList.add('is-entering');
      this.shadowRoot.querySelector('.tabs button[aria-pressed="true"]')?.classList.add('is-switching');
      this._animateView = false;
      this.animateMoneyValues();
    }
    if (this._animateModal) {
      this.shadowRoot.querySelector('.modal-backdrop')?.classList.add('is-entering');
      this._animateModal = false;
    }
  }

  renderQuick(computed) {
    const phasesWithValue = computed.phases.filter((phase) => phase.total > 0 || phase.spent > 0);
    let cursor = 0;
    const stops = phasesWithValue.map((phase) => {
      const start = cursor;
      cursor += phase.share * 100;
      return `${phase.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    const donut = stops.length ? `conic-gradient(${stops.join(',')})` : 'conic-gradient(var(--hair) 0 100%)';
    const legend = phasesWithValue.length
      ? phasesWithValue.map((phase) => `<div><i style="background:${phase.color}"></i><span>${phase.name}</span><strong>${this.formatPercent(phase.share)}</strong></div>`).join('')
      : '<div class="chart-empty-copy"><strong>No allocation yet</strong><span>Add the first cost in Breakdown.</span></div>';
    const bars = phasesWithValue.length ? phasesWithValue.map((phase) => {
      const spentShare = phase.total > 0 ? Math.min(1, phase.spent / phase.total) : 0;
      return `<div class="phase-bar"><div><strong>${phase.name}</strong><span>${this.formatMoney(phase.spent)} of ${this.formatMoney(phase.total)}</span></div><div class="bar"><i style="width:${(spentShare * 100).toFixed(2)}%;background:${phase.color}"></i></div></div>`;
    }).join('') : '<div class="chart-empty-copy centered"><strong>Nothing to compare yet</strong><span>Progress appears as costs are planned.</span></div>';
    const topPhase = [...phasesWithValue].sort((a, b) => b.total - a.total)[0];
    const insight = computed.total > 0
      ? `${topPhase.name} holds the largest share at ${this.formatPercent(topPhase.share)}. ${this.formatMoney(computed.remaining)} remains available.`
      : 'Start in Budget Breakdown. Add quantities and rates, then Quick View will update automatically.';
    const hasGap = computed.fundingGap > 0.005;
    const hasSurplus = computed.fundingGap < -0.005;
    const fundingLabel = hasGap ? 'Funding Gap' : hasSurplus ? 'Funding Surplus' : 'Fully Funded';
    const fundingNote = hasGap ? 'Still to finance' : hasSurplus ? `${this.formatMoney(computed.fundingReceived)} received` : 'Plan is fully financed';
    return `<section class="view quick-view" role="tabpanel" tabindex="0" aria-labelledby="budget-quick-title">
      <div class="section-head"><div class="section-title"><span class="budget-glyph" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M6.5 5.5h19v21h-19zM6.5 10.5h19M12.5 10.5v16M19.5 10.5v16M12.5 16.5h13M12.5 21.5h13"/></svg></span><div><span class="eyebrow">First look</span><h2 id="budget-quick-title">Budget Quick View</h2><p>See the production plan, actual spending and funding position at a glance.</p></div></div><span class="updated">${escapeHtml(this.budget.projectTitle)}</span></div>
      <div class="kpi-grid">
        ${this.kpi('Planned Budget', this.moneyValue(computed.total), `${this.formatMoney(computed.tax)} in tax`, 'planned')}
        ${this.kpi('Actual Spend', this.moneyValue(computed.spent), `${this.formatPercent(computed.spentShare)} used`, 'spent')}
        ${this.kpi('Remaining', this.moneyValue(computed.remaining), computed.remaining < 0 ? 'Over budget' : 'Available to allocate', computed.remaining < 0 ? 'danger' : 'remaining')}
        ${this.kpi(fundingLabel, this.moneyValue(Math.abs(computed.fundingGap)), fundingNote, hasGap ? 'warning' : 'funded')}
      </div>
      <div class="visual-grid">
        <article class="panel allocation"><div class="panel-head"><div><span>Allocation</span><h3>Where the budget goes</h3></div><small>Total by production phase</small></div><div class="donut-wrap"><div class="donut" style="--budget-donut:${donut}"><span><strong>${this.moneyValue(computed.total)}</strong><small>Total</small></span></div><div class="legend">${legend}</div></div></article>
        <article class="panel"><div class="panel-head"><div><span>Progress</span><h3>Planned and spent</h3></div><small>Actual spend by phase</small></div><div class="phase-bars">${bars}</div></article>
      </div>
      <div class="insight"><span>Production note</span><p>${escapeHtml(insight)}</p><button type="button" data-view="breakdown">Open Budget Breakdown</button></div>
    </section>`;
  }

  kpi(label, value, note, tone) {
    return `<article class="kpi ${tone}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
  }

  renderSummary(computed) {
    const activePhases = computed.phases.filter((phase) => phase.total > 0 || phase.spent > 0);
    const phaseCards = activePhases.map((phase) => `<article class="phase-card" style="--phase:${phase.color}"><span>${phase.name}</span><strong>${this.moneyValue(phase.total)}</strong><small>${this.formatMoney(phase.spent)} spent</small></article>`).join('');
    const activeAccounts = computed.accounts.filter((account) => account.total > 0 || account.spent > 0);
    const displayedAccounts = this.showAllAccounts ? computed.accounts : activeAccounts;
    const rows = displayedAccounts.map((account) => `<tr><td><span class="account-code">${account.code}</span></td><td>${escapeHtml(account.name)}</td><td>${this.formatMoney(account.subtotal)}</td><td>${this.formatMoney(account.tax)}</td><td><strong>${this.formatMoney(account.total)}</strong></td><td>${this.formatMoney(account.spent)}</td><td class="${account.remaining < 0 ? 'negative' : ''}">${this.formatMoney(account.remaining)}</td></tr>`).join('');
    const accountToggle = activeAccounts.length < computed.accounts.length
      ? `<button type="button" class="secondary summary-toggle" data-action="toggle-empty-accounts">${this.showAllAccounts ? 'Show active accounts' : 'Show all accounts'}</button>`
      : '';
    const phaseOverview = phaseCards
      ? `<div class="phase-card-grid">${phaseCards}</div>`
      : '<div class="phase-overview-empty"><strong>No phase totals yet</strong><span>Your production mix will appear after the first cost is entered.</span></div>';
    const accountTable = rows
      ? `<div class="table-scroll"><table class="summary-table"><thead><tr><th>Account</th><th>Concept</th><th>Subtotal</th><th>Tax</th><th>Total</th><th>Spent</th><th>Remaining</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2">Grand Total</td><td>${this.formatMoney(computed.subtotal)}</td><td>${this.formatMoney(computed.tax)}</td><td>${this.formatMoney(computed.total)}</td><td>${this.formatMoney(computed.spent)}</td><td>${this.formatMoney(computed.remaining)}</td></tr></tfoot></table></div>`
      : '<div class="summary-empty"><span class="empty-mark" aria-hidden="true"></span><strong>No active accounts yet</strong><p>Add a cost in Breakdown and this summary will update automatically.</p><button type="button" class="primary" data-view="breakdown">Open Breakdown</button></div>';
    return `<section class="view" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Rollup</span><h2>Budget Summary</h2><p>Every active account rolls into one auditable production total.</p></div></div>
      ${phaseOverview}
      <div class="table-card"><div class="table-title"><div><h3>Account Summary</h3><p>${this.showAllAccounts ? 'All accounts are visible.' : 'Configured accounts appear first.'}</p></div>${accountToggle}</div>${accountTable}</div>
    </section>`;
  }

  taxOptions(item) {
    return this.budget.settings.taxRates.flatMap((rate) => {
      if (rate.rate === 0) return [`<option value="${rate.id}:exclusive" ${item.taxRateId === rate.id ? 'selected' : ''}>${escapeHtml(rate.name)}</option>`];
      const selectedAdded = item.taxRateId === rate.id && item.taxMode !== 'included' ? 'selected' : '';
      const selectedIncluded = item.taxRateId === rate.id && item.taxMode === 'included' ? 'selected' : '';
      return [
        `<option value="${rate.id}:exclusive" ${selectedAdded}>${escapeHtml(rate.name)} ${this.formatPercent(rate.rate)} added</option>`,
        `<option value="${rate.id}:included" ${selectedIncluded}>${escapeHtml(rate.name)} ${this.formatPercent(rate.rate)} included</option>`,
      ];
    }).join('');
  }

  renderBreakdown(computed) {
    const query = this.search.trim().toLowerCase();
    const phaseOptions = `<option value="all">All phases</option>${PHASES.map((phase) => `<option value="${phase.id}" ${this.phaseFilter === phase.id ? 'selected' : ''}>${phase.name}</option>`).join('')}`;
    const sections = computed.accounts.flatMap((account) => {
      if (this.phaseFilter !== 'all' && account.phaseId !== this.phaseFilter) return [];
      const visibleItems = account.items.filter((item) => !query || `${item.code} ${item.name} ${account.name}`.toLowerCase().includes(query));
      if (query && !visibleItems.length) return [];
      const isOpen = Boolean(query) || this.openAccounts.has(account.code);
      const rows = isOpen ? visibleItems.map((item) => this.renderBreakdownRow(item)).join('') : '';
      const detail = isOpen ? `<div class="account-detail"><div class="table-scroll"><table class="breakdown-table"><thead><tr><th>Code</th><th>Cost Item</th><th>Qty</th><th>Unit</th><th>Times</th><th>Unit Cost</th><th>Tax</th><th>Type</th><th>Funding</th><th>Total</th><th>Spent</th><th>Remaining</th><th>Plan</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><button type="button" class="add-row" data-action="add-item" data-account="${account.code}">Add cost item</button></div>` : '';
      return [`<details class="account" data-account="${account.code}" ${isOpen ? 'open' : ''}><summary data-action="toggle-account" data-account="${account.code}"><div><span>${account.code}</span><strong>${escapeHtml(account.name)}</strong><small>${visibleItems.length} cost item${visibleItems.length === 1 ? '' : 's'}</small></div><div><span>${this.formatMoney(account.spent)} spent</span><strong>${this.formatMoney(account.total)}</strong></div></summary>${detail}</details>`];
    }).join('');
    return `<section class="view" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Cost detail</span><h2>Budget Breakdown</h2><p>Open an account, change any driver and every report updates together.</p></div></div>
      <div class="filters"><label><span>Search</span><input data-budget-search value="${escapeHtml(this.search)}" placeholder="Account, code or cost item"></label><label><span>Phase</span><select data-phase-filter>${phaseOptions}</select></label><div class="formula-note"><strong>Live formula</strong><span>Quantity × times × unit cost, then tax</span></div></div>
      <div class="account-stack">${sections || '<div class="empty small"><strong>No matching cost items</strong><p>Clear the filters to see the complete budget.</p></div>'}</div>
    </section>`;
  }

  renderBreakdownRow(item) {
    const calculation = item.calculation === 'contingency';
    const input = (field, value, type = 'text', extra = '') => calculation
      ? `<span class="calculated">${field === 'unitCost' ? this.formatPercent(this.budget.settings.contingencyRate) : escapeHtml(value)}</span>`
      : `<input data-model="item" data-id="${item.id}" data-field="${field}" type="${type}" value="${escapeHtml(value)}" ${extra}>`;
    return `<tr class="${calculation ? 'contingency-row' : ''}">
      <td>${input('code', item.code)}</td><td>${input('name', item.name)}</td><td>${input('quantity', item.quantity, 'number', 'min="0" step="0.01"')}</td><td>${input('unit', item.unit)}</td><td>${input('multiplier', item.multiplier, 'number', 'min="0" step="0.01"')}</td><td>${input('unitCost', item.unitCost, 'number', 'min="0" step="0.01"')}</td>
      <td>${calculation ? '<span class="calculated">Exempt</span>' : `<select data-model="item" data-id="${item.id}" data-field="tax">${this.taxOptions(item)}</select>`}</td>
      <td>${calculation ? '<span class="calculated">Fixed</span>' : `<select data-model="item" data-id="${item.id}" data-field="costType"><option value="fixed" ${item.costType === 'fixed' ? 'selected' : ''}>Fixed</option><option value="variable" ${item.costType === 'variable' ? 'selected' : ''}>Variable</option></select>`}</td>
      <td>${calculation ? '<span class="calculated">Cash</span>' : `<select data-model="item" data-id="${item.id}" data-field="fundingKind"><option value="cash" ${item.fundingKind === 'cash' ? 'selected' : ''}>Cash</option><option value="in_kind" ${item.fundingKind === 'in_kind' ? 'selected' : ''}>In kind</option></select>`}</td>
      <td><strong>${this.formatMoney(item.total)}</strong></td><td>${this.formatMoney(item.spent)}</td><td class="${item.remaining < 0 ? 'negative' : ''}">${this.formatMoney(item.remaining)}</td>
      <td><button type="button" class="mini" data-action="open-schedule" data-id="${item.id}">Schedule</button></td><td>${calculation ? '' : `<button type="button" class="icon" data-action="remove-item" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.name)}">×</button>`}</td>
    </tr>`;
  }

  renderFinance(computed) {
    const sources = this.budget.fundingSources.map((source) => `<tr><td><input data-model="funding" data-id="${source.id}" data-field="name" value="${escapeHtml(source.name)}"></td><td><select data-model="funding" data-id="${source.id}" data-field="type"><option value="cash" ${source.type === 'cash' ? 'selected' : ''}>Cash</option><option value="in_kind" ${source.type === 'in_kind' ? 'selected' : ''}>In kind</option><option value="partner" ${source.type === 'partner' ? 'selected' : ''}>Partner</option></select></td><td><input type="number" min="0" step="0.01" data-model="funding" data-id="${source.id}" data-field="amount" value="${source.amount}"></td><td><input type="number" min="0" step="0.01" data-model="funding" data-id="${source.id}" data-field="paid" value="${source.paid}"></td><td><select data-model="funding" data-id="${source.id}" data-field="status">${['Planned','Pending','Partially paid','Received'].map((status) => `<option ${source.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></td><td><input data-model="funding" data-id="${source.id}" data-field="paymentDate" value="${escapeHtml(source.paymentDate)}" placeholder="Date or note"></td><td>${this.receiptControl('funding', source)}</td><td><button type="button" class="icon" data-action="remove-funding" data-id="${source.id}" aria-label="Delete contributor">×</button></td></tr>`).join('');
    const scheduledPeriods = this.budget.periods
      .map((period) => ({ ...period, amount: computed.scheduleTotals[period.id] || 0 }))
      .filter((period) => period.amount > 0);
    const maxPeriod = Math.max(1, ...scheduledPeriods.map((period) => period.amount));
    const timeline = scheduledPeriods.map((period) => `<div class="cash-period"><div><span>${period.label}</span><strong>${this.formatMoney(period.amount)}</strong></div><i><b style="width:${Math.min(100, period.amount / maxPeriod * 100).toFixed(2)}%"></b></i></div>`).join('');
    const hasGap = computed.fundingGap > 0.005;
    const hasSurplus = computed.fundingGap < -0.005;
    const fundingLabel = hasGap ? 'Funding Gap' : hasSurplus ? 'Funding Surplus' : 'Fully Funded';
    const fundingNote = hasGap ? 'Still to finance' : hasSurplus ? 'Available above the plan' : 'Plan is fully financed';
    const cashFlow = timeline
      ? `<div class="visual-grid finance-grid"><article class="panel"><div class="panel-head"><div><span>Cash flow</span><h3>Planned execution</h3></div><small>Scheduled cost items</small></div><div class="cash-timeline">${timeline}</div></article><article class="panel finance-note"><span>Timing guide</span><h3>Plan payments at their source</h3><p>Open Breakdown, choose Schedule on a cost item, then place payments across production.</p><button type="button" data-view="breakdown">Open Breakdown</button></article></div>`
      : `<article class="panel cashflow-empty"><span class="timeline-glyph" aria-hidden="true"><svg viewBox="0 0 42 42" fill="none"><path d="M7 30.5h28M10 25l6-6 5 3 10-11M28 11h3v3"/></svg></span><div><span class="eyebrow">Cash flow</span><h3>No payments scheduled</h3><p>Schedule costs in Breakdown and the production timeline will build itself.</p></div><button type="button" class="secondary" data-view="breakdown">Schedule costs</button></article>`;
    return `<section class="view" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Sources and timing</span><h2>Finance Plan</h2><p>Track cash, in kind support, payment status and the production cash flow.</p></div></div>
      <div class="kpi-grid compact">${this.kpi('Cash Budget', this.moneyValue(computed.cashTotal), 'Costs paid in cash', 'planned')}${this.kpi('In Kind Budget', this.moneyValue(computed.inKindTotal), 'Contributed resources', 'remaining')}${this.kpi('Funding Planned', this.moneyValue(computed.fundingPlanned), `${this.formatMoney(computed.fundingReceived)} received`, 'funded')}${this.kpi(fundingLabel, this.moneyValue(Math.abs(computed.fundingGap)), fundingNote, hasGap ? 'warning' : 'funded')}</div>
      <div class="table-card"><div class="table-title"><div><h3>Contributors</h3><p>Planned and received funding with proof of payment.</p></div><button type="button" class="secondary" data-action="add-funding">Add contributor</button></div><div class="table-scroll"><table class="funding-table"><thead><tr><th>Contributor</th><th>Type</th><th>Planned</th><th>Received</th><th>Status</th><th>Payment Date</th><th>Proof</th><th></th></tr></thead><tbody>${sources || '<tr><td colspan="8" class="table-empty">No contributors yet. Add the first funding source.</td></tr>'}</tbody><tfoot><tr><td colspan="2">Total</td><td>${this.formatMoney(computed.fundingPlanned)}</td><td>${this.formatMoney(computed.fundingReceived)}</td><td colspan="4"></td></tr></tfoot></table></div></div>
      ${cashFlow}
    </section>`;
  }

  renderExpenses(computed) {
    const itemOptions = this.budget.accounts.map((account) => `<optgroup label="${escapeHtml(account.code)} ${escapeHtml(account.name)}">${account.items.filter((item) => item.calculation !== 'contingency').map((item) => `<option value="${item.id}">${escapeHtml(item.code)} ${escapeHtml(item.name)}</option>`).join('')}</optgroup>`).join('');
    const rows = computed.expenseRows.map((expense) => `<tr><td><input data-model="expense" data-id="${expense.id}" data-field="paymentNumber" value="${escapeHtml(expense.paymentNumber)}"></td><td><input type="date" data-model="expense" data-id="${expense.id}" data-field="paymentDate" value="${escapeHtml(expense.paymentDate)}"></td><td><select data-model="expense" data-id="${expense.id}" data-field="lineItemId">${itemOptions.replace(`value="${expense.lineItemId}"`, `value="${expense.lineItemId}" selected`)}</select></td><td><input data-model="expense" data-id="${expense.id}" data-field="vendor" value="${escapeHtml(expense.vendor)}" placeholder="Vendor or beneficiary"></td><td><input data-model="expense" data-id="${expense.id}" data-field="concept" value="${escapeHtml(expense.concept)}" placeholder="What was paid"></td><td>${this.formatMoney(expense.budgeted)}</td><td><input type="number" min="0" step="0.01" data-model="expense" data-id="${expense.id}" data-field="amount" value="${expense.amount}"></td><td><span class="variance-badge ${expense.variance < 0 ? 'negative' : ''}">${this.formatMoney(expense.variance)}</span></td><td>${this.receiptControl('expense', expense)}</td><td><button type="button" class="icon" data-action="remove-expense" data-id="${expense.id}" aria-label="Delete expense">×</button></td></tr>`).join('');
    const ledger = rows
      ? `<div class="table-card expense-card"><div class="table-title"><div><h3>Payment Ledger</h3><p>Budgeted amount, actual spend and live variance.</p></div><span class="compression-note">Photos are compressed before upload</span></div><div class="table-scroll"><table class="expense-table"><thead><tr><th>Payment</th><th>Date</th><th>Budget Line</th><th>Vendor</th><th>Concept</th><th>Budgeted</th><th>Spent</th><th>Variance</th><th>Receipt</th><th></th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="6">Total Spent</td><td>${this.formatMoney(computed.spent)}</td><td>${this.formatMoney(computed.remaining)}</td><td colspan="2"></td></tr></tfoot></table></div></div>`
      : `<article class="panel ledger-empty"><span class="receipt-glyph" aria-hidden="true"><svg viewBox="0 0 42 42" fill="none"><path d="M12 6.5h18v29l-3-2-3 2-3-2-3 2-3-2-3 2zM16 15h10M16 20h10M16 25h6"/></svg></span><div><span class="eyebrow">Payment ledger</span><h3>No expenses yet</h3><p>Use Add expense when production spending begins. Receipt photos are compressed before upload.</p></div></article>`;
    return `<section class="view" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Actuals</span><h2>Expense Report</h2><p>Link every payment to its budget line and keep a compressed receipt with it.</p></div><button type="button" class="primary" data-action="add-expense">Add expense</button></div>
      <div class="kpi-grid compact">${this.kpi('Budget', this.moneyValue(computed.total), 'Approved production plan', 'planned')}${this.kpi('Spent', this.moneyValue(computed.spent), `${computed.expenseRows.length} payment${computed.expenseRows.length === 1 ? '' : 's'}`, 'spent')}${this.kpi('Remaining', this.moneyValue(computed.remaining), computed.remaining < 0 ? 'Over budget' : 'Available', computed.remaining < 0 ? 'danger' : 'remaining')}${this.kpi('Receipts', String(computed.expenseRows.filter((row) => row.receiptId).length), 'Compressed image files', 'funded')}</div>
      ${ledger}
    </section>`;
  }

  receiptControl(type, entry) {
    if (entry.receiptId) {
      const previewUrl = window.filmscriptBudget.receiptUrl(this.scriptId, entry.receiptId);
      const fileName = type === 'expense' ? '' : `<span title="${escapeHtml(entry.receiptName)}">${escapeHtml(entry.receiptName)}</span>`;
      return `<div class="receipt ${type === 'expense' ? 'receipt-compact' : ''}"><span class="receipt-preview-wrap"><button type="button" class="receipt-view" data-action="view-receipt" data-receipt="${entry.receiptId}">View</button><span class="receipt-preview"><img src="${escapeHtml(previewUrl)}" alt="Preview of ${escapeHtml(entry.receiptName)}"></span></span>${fileName}<label>Replace<input type="file" accept="image/*" data-receipt-for="${type}" data-id="${entry.id}"></label></div>`;
    }
    return `<label class="attach">Attach<input type="file" accept="image/*" data-receipt-for="${type}" data-id="${entry.id}"></label>`;
  }

  renderSettings(computed) {
    const metadataFields = [
      ['producer', 'Producer'], ['director', 'Director'], ['format', 'Format'], ['locations', 'Locations'], ['shootingDates', 'Shooting Dates'],
    ].map(([field, label]) => {
      const examples = { producer: 'Emma Thomas', director: 'Greta Gerwig', format: 'Feature film', locations: 'Los Angeles, CA', shootingDates: 'June 2026' };
      return `<label><span>${label}</span><input data-model="metadata" data-field="${field}" value="${escapeHtml(this.budget.metadata[field])}" placeholder="${examples[field] || label}"></label>`;
    }).join('');
    const taxRows = this.budget.settings.taxRates.map((rate) => `<tr><td><input data-model="tax" data-id="${rate.id}" data-field="name" value="${escapeHtml(rate.name)}" ${rate.id === 'tax_exempt' ? 'disabled' : ''}></td><td><input type="number" min="0" max="100" step="0.01" data-model="tax" data-id="${rate.id}" data-field="rate" value="${(rate.rate * 100).toFixed(2)}" ${rate.id === 'tax_exempt' ? 'disabled' : ''}></td><td>${rate.id === 'tax_exempt' ? '<span class="locked">Required</span>' : `<button type="button" class="icon" data-action="remove-tax" data-id="${rate.id}" aria-label="Delete tax">×</button>`}</td></tr>`).join('');
    return `<section class="view" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Editable drivers</span><h2>Budget Settings</h2><p>Set project details, currency, contingency and every tax rate in one place.</p></div></div>
      <div class="settings-grid"><article class="panel settings-panel"><div class="panel-head"><div><span>Production</span><h3>Project Details</h3></div></div><div class="form-grid">${metadataFields}</div></article><article class="panel settings-panel"><div class="panel-head"><div><span>Calculation</span><h3>Financial Drivers</h3></div></div><div class="form-grid"><label><span>Currency Code</span><input data-model="setting" data-field="currencyCode" value="${escapeHtml(this.budget.settings.currencyCode)}" maxlength="8"></label><label><span>Currency Symbol</span><input data-model="setting" data-field="currencySymbol" value="${escapeHtml(this.budget.settings.currencySymbol)}" maxlength="8"></label><label><span>Contingency Rate</span><div class="suffix"><input type="number" min="0" max="50" step="0.1" data-model="setting" data-field="contingencyRate" value="${(this.budget.settings.contingencyRate * 100).toFixed(1)}"><b>%</b></div></label><div class="driver-result"><span>Calculated contingency</span><strong>${this.moneyValue(computed.contingencyAmount)}</strong><small>Based on ${this.formatMoney(computed.contingencyBase)} in eligible cash costs</small></div></div></article></div>
      <div class="table-card"><div class="table-title"><div><h3>Tax Rates</h3><p>Create as many rates as the production needs. Each cost can use tax added, tax included or exempt.</p></div><button type="button" class="secondary" data-action="add-tax">Add tax rate</button></div><div class="tax-layout"><table class="tax-table"><thead><tr><th>Name</th><th>Rate</th><th></th></tr></thead><tbody>${taxRows}</tbody></table><div class="formula-card"><span>Formula Guide</span><p><strong>Tax added</strong> applies the selected rate on top of the net subtotal.</p><p><strong>Tax included</strong> extracts the tax from the entered cost.</p><p><strong>Contingency</strong> applies the selected rate to cash costs in Above the Line and Production.</p></div></div></div>
    </section>`;
  }

  renderScheduleModal(computed) {
    if (!this.scheduleItemId) return '';
    const found = this.findItem(this.scheduleItemId);
    const row = computed.itemMap.get(this.scheduleItemId);
    if (!found || !row) return '';
    const inputs = this.budget.periods.map((period) => `<label><span>${period.label}</span><input type="number" min="0" step="0.01" data-model="schedule" data-id="${row.id}" data-period="${period.id}" value="${finite(found.item.schedule?.[period.id])}"></label>`).join('');
    return `<div class="modal-backdrop" role="presentation"><div class="schedule-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-title"><div class="modal-head"><div><span>${escapeHtml(row.code)}</span><h3 id="schedule-title">Schedule ${escapeHtml(row.name)}</h3><p>Place planned payments across the production timeline.</p></div><button type="button" class="icon" data-action="close-schedule" aria-label="Close schedule">×</button></div><div class="schedule-summary"><div><span>Budget</span><strong>${this.formatMoney(row.total)}</strong></div><div><span>Scheduled</span><strong>${this.formatMoney(row.scheduled)}</strong></div><div><span>Unscheduled</span><strong>${this.formatMoney(row.total - row.scheduled)}</strong></div></div><div class="schedule-grid">${inputs}</div><div class="modal-foot"><span>${escapeHtml(this.saveStatus || 'Changes save automatically')}</span><button type="button" class="primary" data-action="close-schedule">Done</button></div></div></div>`;
  }

  styles() {
    return `<style>
      :host{display:block;min-width:0;width:100%;color:var(--ink,#2C2C2A);font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
      *{box-sizing:border-box}button,input,select{font:inherit}button{color:inherit}.fs-budget{padding:24px 0 72px}.budget-nav{position:sticky;top:-38px;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 28px;padding:12px 0;background:var(--bg,#F5F0E8);border-bottom:1px solid var(--hair,#E7E4DA)}.tabs{display:flex;gap:4px;overflow:auto;scrollbar-width:none}.tabs button{min-height:38px;padding:0 13px;border:1px solid transparent;border-radius:9px 10px 8px 9px;background:transparent;color:var(--muted,#888780);white-space:nowrap;cursor:pointer}.tabs button[aria-pressed="true"]{border-color:var(--hair,#E7E4DA);background:var(--surface,#FFFEF9);color:var(--ink,#2C2C2A);box-shadow:1px 2px 0 var(--hair,#E7E4DA)}.tabs button:focus-visible,.export:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent,#BA7517);outline-offset:2px}.budget-actions{display:flex;align-items:center;gap:10px}.budget-actions span{font-size:10.5px;color:var(--muted,#888780);white-space:nowrap}.export,.primary{min-height:40px;padding:0 16px;border:0;border-radius:9px 10px 8px 9px;background:var(--accent,#BA7517);color:#181816;font-weight:750;cursor:pointer}.export{background:var(--ink,#2C2C2A);color:var(--surface,#FFFEF9)}.secondary{min-height:38px;padding:0 14px;border:1px solid var(--hair,#E7E4DA);border-radius:9px;background:var(--surface,#FFFEF9);font-weight:700;cursor:pointer}.view{animation:budgetRise .22s ease both}@keyframes budgetRise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}.eyebrow,.panel-head span,.finance-note>span,.formula-card>span,.insight>span{display:block;font-size:10px;font-weight:800;letter-spacing:1.45px;text-transform:uppercase;color:var(--accent,#BA7517)}h2{margin:6px 0 0;font-size:27px;line-height:1.1;letter-spacing:-.7px}h3{margin:4px 0 0;font-size:16px;letter-spacing:-.2px}.section-head p,.table-title p,.panel-head small,.modal-head p{margin:7px 0 0;color:var(--muted,#888780);font-size:12px;line-height:1.45}.updated{font-size:11px;color:var(--muted,#888780)}.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kpi{position:relative;min-height:126px;padding:19px 19px 17px;background:var(--surface,#FFFEF9);border:1px solid var(--hair,#E7E4DA);border-radius:15px 13px 16px 12px;box-shadow:2px 3px 0 var(--hair,#E7E4DA);overflow:hidden}.kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent,#BA7517)}.kpi.remaining:before,.kpi.funded:before{background:#5B7A4A}.kpi.spent:before{background:#4A6B8A}.kpi.warning:before{background:#BA7517}.kpi.danger:before{background:#C74440}.kpi span{display:block;font-size:10.5px;font-weight:700;color:var(--muted,#888780)}.kpi strong{display:block;margin-top:17px;font-size:21px;letter-spacing:-.55px;font-variant-numeric:tabular-nums}.kpi small{display:block;margin-top:8px;color:var(--muted,#888780);font-size:10.5px}.compact{margin-bottom:20px}.compact .kpi{min-height:110px}.visual-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.panel,.table-card{background:var(--surface,#FFFEF9);border:1px solid var(--hair,#E7E4DA);border-radius:17px 14px 18px 13px;box-shadow:2px 3px 0 var(--hair,#E7E4DA)}.panel{padding:20px}.panel-head,.table-title{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.donut-wrap{display:grid;grid-template-columns:168px 1fr;align-items:center;gap:24px;margin-top:22px}.donut{width:164px;height:164px;border-radius:50%;display:grid;place-items:center}.donut:before{content:"";position:absolute}.donut>span{width:104px;height:104px;border-radius:50%;display:grid;place-content:center;text-align:center;background:var(--surface,#FFFEF9);box-shadow:0 0 0 1px var(--hair,#E7E4DA)}.donut strong{font-size:14px}.donut small{margin-top:4px;font-size:9.5px;color:var(--muted,#888780)}.legend{display:grid;gap:11px}.legend div{display:grid;grid-template-columns:9px 1fr auto;align-items:center;gap:8px;font-size:11px}.legend i{width:9px;height:9px;border-radius:3px}.legend strong{font-size:10.5px}.phase-bars{display:grid;gap:18px;margin-top:25px}.phase-bar>div:first-child{display:flex;justify-content:space-between;gap:12px;margin-bottom:7px}.phase-bar strong{font-size:11px}.phase-bar span{font-size:10px;color:var(--muted,#888780)}.bar{height:8px;border-radius:99px;background:var(--soft,#EFEBE1);overflow:hidden}.bar i{display:block;height:100%;min-width:0;border-radius:99px}.insight{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;margin-top:14px;padding:16px 18px;background:var(--accent-soft,rgba(186,117,23,.11));border:1px solid var(--accent,#BA7517);border-radius:12px 14px 11px 13px}.insight p{margin:0;font-size:11.5px;line-height:1.45}.insight button,.finance-note button{border:0;background:transparent;color:var(--accent,#BA7517);font-weight:750;font-size:11px;cursor:pointer}.phase-card-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.phase-card{padding:17px 18px;background:var(--surface,#FFFEF9);border:1px solid var(--hair,#E7E4DA);border-top:3px solid var(--phase);border-radius:12px}.phase-card span,.phase-card small{display:block;font-size:10.5px;color:var(--muted,#888780)}.phase-card strong{display:block;margin:10px 0 7px;font-size:17px}.table-card{overflow:hidden}.table-title{align-items:center;padding:18px 19px;border-bottom:1px solid var(--hair,#E7E4DA)}.table-title h3{margin:0}.table-scroll{overflow:auto}.table-card table{width:100%;border-collapse:collapse;min-width:820px}th{padding:11px 12px;border-bottom:1px solid var(--hair,#E7E4DA);color:var(--muted,#888780);font-size:9px;letter-spacing:1.05px;text-transform:uppercase;text-align:left;white-space:nowrap}td{padding:11px 12px;border-bottom:1px solid var(--hair,#E7E4DA);font-size:10.8px;white-space:nowrap;font-variant-numeric:tabular-nums}td:not(:nth-child(2)){text-align:right}tbody tr:hover{background:var(--soft,#EFEBE1)}tfoot td{background:var(--chrome,#232322);color:var(--surface,#FFFEF9);font-weight:750;border:0}.account-code{display:inline-grid;place-items:center;min-width:43px;height:23px;padding:0 6px;border-radius:7px;background:var(--soft,#EFEBE1);font-weight:750}.negative{color:#C74440!important;font-weight:750}.filters{display:grid;grid-template-columns:minmax(240px,1fr) 180px minmax(260px,auto);align-items:end;gap:12px;margin-bottom:16px}.filters label,.form-grid label,.schedule-grid label{display:grid;gap:6px}.filters label span,.form-grid label>span,.schedule-grid label>span{font-size:9.5px;font-weight:700;color:var(--muted,#888780)}input,select{min-height:36px;border:1px solid var(--hair,#E7E4DA);border-radius:8px;background:var(--bg,#F5F0E8);color:var(--ink,#2C2C2A);padding:0 9px;outline:none}input:focus,select:focus{border-color:var(--accent,#BA7517)}.formula-note{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:58px;padding:10px 13px;border:1px solid var(--hair,#E7E4DA);border-radius:10px;background:var(--surface,#FFFEF9)}.formula-note strong{font-size:10px}.formula-note span{font-size:10px;color:var(--muted,#888780)}.account-stack{display:grid;gap:10px}.account{background:var(--surface,#FFFEF9);border:1px solid var(--hair,#E7E4DA);border-radius:13px 15px 12px 14px;overflow:hidden}.account summary{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:15px 17px;cursor:pointer;list-style:none}.account summary::-webkit-details-marker{display:none}.account summary>div{display:flex;align-items:center;gap:11px}.account summary>div:first-child>span{display:grid;place-items:center;min-width:45px;height:25px;border-radius:7px;background:var(--soft,#EFEBE1);font-size:10px;font-weight:800}.account summary strong{font-size:12px}.account summary small,.account summary>div:last-child>span{font-size:10px;color:var(--muted,#888780)}.breakdown-table{min-width:1510px;width:100%;border-collapse:collapse}.breakdown-table th,.breakdown-table td{padding:7px 6px}.breakdown-table td{text-align:right}.breakdown-table td:nth-child(2){text-align:left}.breakdown-table input,.breakdown-table select{width:100%;min-height:32px;padding:0 6px;font-size:10.5px}.breakdown-table th:nth-child(1){width:74px}.breakdown-table th:nth-child(2){width:210px}.breakdown-table th:nth-child(3),.breakdown-table th:nth-child(5){width:67px}.breakdown-table th:nth-child(4){width:82px}.breakdown-table th:nth-child(6){width:92px}.breakdown-table th:nth-child(7){width:150px}.breakdown-table th:nth-child(8),.breakdown-table th:nth-child(9){width:96px}.calculated{display:block;padding:8px 6px;color:var(--muted,#888780);font-size:10px}.contingency-row{background:var(--accent-soft,rgba(186,117,23,.11))}.mini{min-height:30px;border:1px solid var(--hair,#E7E4DA);border-radius:7px;background:transparent;font-size:9.5px;cursor:pointer}.icon{width:30px;height:30px;padding:0;border:1px solid var(--hair,#E7E4DA);border-radius:8px;background:transparent;color:var(--muted,#888780);cursor:pointer}.add-row{min-height:36px;margin:10px 12px 12px;padding:0 13px;border:1px dashed var(--muted,#888780);border-radius:8px;background:transparent;font-weight:700;font-size:10.5px;cursor:pointer}.funding-table{min-width:1120px!important}.funding-table input,.funding-table select,.expense-table input,.expense-table select{width:100%;min-height:32px;padding:0 6px;font-size:10.5px}.funding-table td,.expense-table td{text-align:left;padding:7px 6px}.funding-table td:nth-child(3),.funding-table td:nth-child(4),.expense-table td:nth-child(n+6):nth-child(-n+8){text-align:right}.finance-grid{grid-template-columns:1.4fr .6fr}.cash-timeline{display:grid;gap:12px;margin-top:20px}.cash-period>div{display:flex;justify-content:space-between;gap:12px;font-size:10.5px}.cash-period i{display:block;height:6px;margin-top:5px;border-radius:99px;background:var(--soft,#EFEBE1);overflow:hidden}.cash-period b{display:block;height:100%;border-radius:99px;background:var(--accent,#BA7517)}.finance-note{display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.finance-note p{font-size:11.5px;line-height:1.55;color:var(--muted,#888780)}.finance-note button{padding:8px 0}.expense-card{margin-top:2px}.expense-table{min-width:1500px!important}.expense-table th:nth-child(3){width:250px}.expense-table th:nth-child(4),.expense-table th:nth-child(5){width:180px}.compression-note{padding:7px 10px;border-radius:99px;background:var(--accent-soft,rgba(186,117,23,.11));font-size:9.5px;color:var(--accent,#BA7517);font-weight:700}.table-empty{text-align:center!important;padding:34px!important;color:var(--muted,#888780)}.attach,.receipt label{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border:1px dashed var(--muted,#888780);border-radius:7px;font-size:9.5px;font-weight:700;cursor:pointer}.attach input,.receipt label input{display:none}.receipt{display:flex;align-items:center;gap:6px;max-width:190px}.receipt button{border:0;background:transparent;color:var(--accent,#BA7517);font-size:9.5px;font-weight:800;cursor:pointer}.receipt span{max-width:74px;overflow:hidden;text-overflow:ellipsis;font-size:9px}.receipt label{min-height:25px;padding:0 6px}.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}.settings-panel{padding:20px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:20px}.form-grid label:nth-child(5){grid-column:1 / -1}.suffix{display:grid;grid-template-columns:1fr 34px}.suffix input{border-radius:8px 0 0 8px}.suffix b{display:grid;place-items:center;border:1px solid var(--hair,#E7E4DA);border-left:0;border-radius:0 8px 8px 0;background:var(--soft,#EFEBE1);font-size:11px}.driver-result{grid-column:1 / -1;padding:12px 13px;border-radius:10px;background:var(--soft,#EFEBE1)}.driver-result span,.driver-result small{display:block;font-size:9.5px;color:var(--muted,#888780)}.driver-result strong{display:block;margin:5px 0;font-size:16px}.tax-layout{display:grid;grid-template-columns:minmax(420px,1fr) minmax(300px,.75fr);gap:16px;padding:18px}.tax-table{width:100%;border-collapse:collapse}.tax-table input{width:100%}.tax-table td:nth-child(2){width:130px}.tax-table td:last-child{width:42px}.formula-card{padding:16px;border:1px solid var(--hair,#E7E4DA);border-radius:12px;background:var(--soft,#EFEBE1)}.formula-card p{margin:11px 0 0;font-size:10.5px;line-height:1.5;color:var(--muted,#888780)}.formula-card strong{color:var(--ink,#2C2C2A)}.locked{font-size:9px;color:var(--muted,#888780)}.modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:rgba(20,20,19,.58)}.schedule-modal{width:min(720px,100%);max-height:min(760px,90vh);overflow:auto;background:var(--surface,#FFFEF9);border:1px solid var(--hair,#E7E4DA);border-radius:19px 16px 20px 14px;box-shadow:0 24px 80px rgba(0,0,0,.25)}.modal-head{display:flex;justify-content:space-between;gap:18px;padding:20px;border-bottom:1px solid var(--hair,#E7E4DA)}.modal-head>div>span{font-size:10px;font-weight:800;color:var(--accent,#BA7517)}.modal-head h3{font-size:19px}.schedule-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px 20px;background:var(--soft,#EFEBE1)}.schedule-summary div{padding:11px;background:var(--surface,#FFFEF9);border:1px solid var(--hair,#E7E4DA);border-radius:9px}.schedule-summary span,.schedule-summary strong{display:block}.schedule-summary span{font-size:9.5px;color:var(--muted,#888780)}.schedule-summary strong{margin-top:6px;font-size:14px}.schedule-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:20px}.modal-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 20px;border-top:1px solid var(--hair,#E7E4DA)}.modal-foot span{font-size:10px;color:var(--muted,#888780)}.notice{margin-bottom:16px;padding:11px 13px;border-radius:9px;font-size:11px}.notice.error{background:rgba(199,68,64,.12);color:#C74440}.loading,.empty{display:grid;justify-items:center;max-width:560px;margin:50px auto;padding:42px;text-align:center;background:var(--surface,#FFFEF9);border:1px solid var(--hair,#E7E4DA);border-radius:17px 14px 18px 13px}.loading span{width:26px;height:26px;border:2px solid var(--hair,#E7E4DA);border-top-color:var(--accent,#BA7517);border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.loading strong,.empty strong{margin-top:15px;font-size:17px}.loading small,.empty p{margin:7px 0 0;color:var(--muted,#888780);font-size:11.5px}.empty .primary{margin-top:18px}.empty.small{margin:20px auto;padding:26px}
      :host{--accent:#FFB703;--accent-soft:rgba(255,183,3,.13)}
      .section-title{display:flex;align-items:flex-start;gap:15px}.budget-glyph{position:relative;display:grid;place-items:center;width:43px;height:43px;flex:0 0 43px;margin-top:1px;color:var(--accent,#FFB703)}.budget-glyph svg{width:32px;height:32px;overflow:visible;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.budget-glyph:after{content:"";position:absolute;left:6px;right:3px;bottom:1px;height:3px;border-bottom:1.5px solid currentColor;border-radius:50%;transform:rotate(-1.2deg);opacity:.62}
      .kpi,.panel,.table-card,.account,.formula-card,.schedule-modal,.loading,.empty{position:relative;isolation:isolate;border-color:color-mix(in srgb,var(--ink,#2C2C2A) 30%,transparent);border-radius:20px 17px 22px 16px / 18px 21px 17px 20px;box-shadow:1px 2px 0 color-mix(in srgb,var(--ink,#2C2C2A) 15%,transparent)}
      .kpi:after,.panel:after,.table-card:after,.account:after,.formula-card:after,.schedule-modal:after,.loading:after,.empty:after{content:"";position:absolute;z-index:4;pointer-events:none;inset:3px 4px 3px 3px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 28%,transparent);border-radius:17px 15px 18px 14px / 15px 18px 14px 17px;opacity:.38;transform:rotate(.08deg)}
      .panel:hover:after,.account:hover:after,.table-card:hover:after{opacity:.56;transform:rotate(-.06deg)}
      .kpi,.panel,.account,.table-card{transition:transform .18s cubic-bezier(.2,.8,.2,1),border-color .18s ease}.kpi:hover,.panel:hover{transform:translateY(-1px)}
      .export,.primary,.secondary,.mini,.icon,.add-row,.tabs button[aria-pressed="true"]{border-radius:12px 10px 13px 9px / 10px 13px 9px 12px;transition:transform .18s cubic-bezier(.2,.8,.2,1),color .18s ease,background-color .18s ease}.export,.primary{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink,#2C2C2A) 60%,transparent),inset 0 0 0 4px color-mix(in srgb,var(--surface,#FFFEF9) 22%,transparent),1px 2px 0 color-mix(in srgb,var(--ink,#2C2C2A) 20%,transparent)}.secondary,.mini,.icon{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink,#2C2C2A) 32%,transparent),inset 0 0 0 3px color-mix(in srgb,var(--surface,#FFFEF9) 55%,transparent)}.export:hover,.primary:hover,.secondary:hover,.mini:hover,.icon:hover{transform:translateY(-1px)}
      input,select{border-color:color-mix(in srgb,var(--ink,#2C2C2A) 27%,transparent);border-radius:10px 8px 11px 7px / 8px 11px 7px 10px;box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--ink,#2C2C2A) 12%,transparent)}input:focus,select:focus{box-shadow:0 0 0 2px color-mix(in srgb,var(--accent,#FFB703) 30%,transparent)}
      .phase-card,.formula-note,.schedule-summary div,.driver-result,.insight{border-radius:13px 11px 15px 10px / 11px 14px 10px 13px}.table-title{position:relative}.table-title:after{content:"";position:absolute;left:18px;right:22px;bottom:-1px;border-bottom:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 18%,transparent);transform:rotate(-.05deg)}
      /* Table alignment: labels left, financial values right, row actions centered. */
      th,td{vertical-align:middle}.table-card table td{text-align:left}input[type="number"]{text-align:right;font-variant-numeric:tabular-nums}
      .summary-table th:first-child,.summary-table td:first-child{width:106px;text-align:left}.summary-table thead th:nth-child(n+3),.summary-table tbody td:nth-child(n+3){text-align:right}.summary-table tfoot td:first-child{text-align:left}.summary-table tfoot td:not(:first-child){text-align:right}
      .breakdown-table th,.breakdown-table td{text-align:left}.breakdown-table th:nth-child(3),.breakdown-table th:nth-child(5),.breakdown-table th:nth-child(6),.breakdown-table th:nth-child(10),.breakdown-table th:nth-child(11),.breakdown-table th:nth-child(12),.breakdown-table td:nth-child(3),.breakdown-table td:nth-child(5),.breakdown-table td:nth-child(6),.breakdown-table td:nth-child(10),.breakdown-table td:nth-child(11),.breakdown-table td:nth-child(12){text-align:right}.breakdown-table th:nth-child(13),.breakdown-table th:nth-child(14),.breakdown-table td:nth-child(13),.breakdown-table td:nth-child(14){text-align:center}
      .funding-table th,.funding-table td,.expense-table th,.expense-table td{text-align:left}.funding-table th:nth-child(3),.funding-table th:nth-child(4),.funding-table tbody td:nth-child(3),.funding-table tbody td:nth-child(4),.funding-table tfoot td:nth-child(2),.funding-table tfoot td:nth-child(3){text-align:right}.funding-table th:last-child,.funding-table tbody td:last-child{width:42px;text-align:center}.funding-table tfoot td:first-child{text-align:left}
      .expense-table th:nth-child(n+6):nth-child(-n+8),.expense-table tbody td:nth-child(n+6):nth-child(-n+8),.expense-table tfoot td:nth-child(-n+3){text-align:right}.expense-table th:last-child,.expense-table tbody td:last-child{width:42px;text-align:center}
      .tax-table th,.tax-table td{text-align:left}.tax-table th:nth-child(2),.tax-table td:nth-child(2){width:130px;text-align:right}.tax-table th:last-child,.tax-table td:last-child{width:42px;text-align:center}
      @property --budget-donut-progress{syntax:"<percentage>";inherits:false;initial-value:100%}
      .budget-count{display:inline;color:inherit;font-size:inherit;font-weight:inherit;line-height:inherit;letter-spacing:inherit;font-variant-numeric:tabular-nums;white-space:nowrap}.kpi strong .budget-count,.phase-card strong .budget-count,.donut strong .budget-count,.driver-result strong .budget-count{display:inline;color:inherit;font-size:inherit;font-weight:inherit;line-height:inherit}
      .donut{position:relative;isolation:isolate;overflow:visible;background:var(--hair,#E7E4DA);box-shadow:0 0 0 1px color-mix(in srgb,var(--ink,#2C2C2A) 10%,transparent),0 8px 18px rgba(35,35,34,.08);transform-origin:center}.donut:before{content:"";position:absolute;inset:0;z-index:0;border-radius:50%;background:var(--budget-donut);--budget-donut-progress:100%;-webkit-mask:radial-gradient(circle,#000 0 52%,transparent 53%),conic-gradient(from -90deg at 50% 50%,#000 0 var(--budget-donut-progress),transparent var(--budget-donut-progress) 100%);-webkit-mask-composite:source-in;mask:radial-gradient(circle,#000 0 52%,transparent 53%),conic-gradient(from -90deg at 50% 50%,#000 0 var(--budget-donut-progress),transparent var(--budget-donut-progress) 100%);mask-composite:intersect;filter:saturate(1.05)}.donut:after{content:"";position:absolute;inset:7px;border:1px solid color-mix(in srgb,var(--surface,#FFFEF9) 42%,transparent);border-radius:50%;pointer-events:none;opacity:.6}.donut>span{position:relative;z-index:1}
      /* Motion is attached only when a view or modal is intentionally opened, so autosave never flashes the workspace. */
      .view{animation:none}.view.is-entering{animation:budgetViewIn .18s cubic-bezier(.2,.8,.2,1) both}
      @keyframes budgetViewIn{from{opacity:0;transform:translateY(7px) scale(.997)}to{opacity:1;transform:none}}
      @keyframes budgetElementIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      @keyframes budgetTabIn{from{opacity:.62;transform:scale(.96)}to{opacity:1;transform:none}}
      @keyframes budgetScaleIn{from{opacity:.45;transform:scale(.96)}to{opacity:1;transform:none}}
      @keyframes budgetDonutLoad{from{--budget-donut-progress:0%;transform:rotate(-2deg)}to{--budget-donut-progress:100%;transform:rotate(0deg)}}
      @keyframes budgetChartIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}
      @keyframes budgetStrokeIn{from{stroke-dashoffset:120}to{stroke-dashoffset:0}}
      @keyframes budgetLineIn{from{opacity:0;transform:scaleX(.3) rotate(-.05deg)}to{opacity:1;transform:scaleX(1) rotate(-.05deg)}}
      @keyframes budgetStatusIn{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
      @keyframes budgetBackdropIn{from{opacity:0}to{opacity:1}}
      @keyframes budgetModalIn{from{opacity:0;transform:translateY(7px) scale(.985)}to{opacity:1;transform:none}}
      .tabs button{transition:color .14s ease,background-color .14s ease,border-color .14s ease,box-shadow .14s ease,transform .12s cubic-bezier(.2,.8,.2,1)}.tabs button:hover{background:color-mix(in srgb,var(--surface,#FFFEF9) 72%,transparent);color:var(--ink,#2C2C2A);transform:translateY(-1px)}.tabs button:active{transform:scale(.97)}.tabs button.is-switching{animation:budgetTabIn .16s cubic-bezier(.2,.8,.2,1) both}
      .view.is-entering .section-head{animation:budgetElementIn .18s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .kpi,.view.is-entering .phase-card,.view.is-entering .visual-grid>*{animation:budgetElementIn .22s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .kpi-grid>:nth-child(2),.view.is-entering .phase-card-grid>:nth-child(2){animation-delay:.025s}.view.is-entering .kpi-grid>:nth-child(3),.view.is-entering .phase-card-grid>:nth-child(3){animation-delay:.05s}.view.is-entering .kpi-grid>:nth-child(4),.view.is-entering .phase-card-grid>:nth-child(4){animation-delay:.075s}.view.is-entering .visual-grid>:nth-child(1){animation-delay:.055s}.view.is-entering .visual-grid>:nth-child(2){animation-delay:.08s}.view.is-entering .table-card,.view.is-entering .account-stack,.view.is-entering .settings-grid,.view.is-entering .filters{animation:budgetElementIn .22s .07s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .insight{animation:budgetElementIn .2s .1s cubic-bezier(.2,.8,.2,1) both}
      .view.is-entering .donut{animation:budgetScaleIn .24s .06s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .donut:before{animation:budgetDonutLoad .68s .08s cubic-bezier(.65,0,.35,1) both}.view.is-entering .bar i,.view.is-entering .cash-period b{transform-origin:left;animation:budgetChartIn .24s .09s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .budget-glyph svg path{stroke-dasharray:120;animation:budgetStrokeIn .24s ease-out both}.view.is-entering .table-title:after{transform-origin:left;animation:budgetLineIn .22s .08s cubic-bezier(.2,.8,.2,1) both}
      .budget-actions span:not(:empty){animation:budgetStatusIn .14s ease-out both}tbody tr{transition:background-color .12s ease}.account summary{transition:background-color .14s ease}.account summary:hover{background:color-mix(in srgb,var(--soft,#EFEBE1) 72%,transparent)}input,select{transition:border-color .14s ease,box-shadow .14s ease,background-color .14s ease}.kpi:after,.panel:after,.table-card:after,.account:after{transition:opacity .18s ease,transform .18s cubic-bezier(.2,.8,.2,1)}.export:active,.primary:active,.secondary:active,.mini:active,.icon:active,.add-row:active{transform:translateY(0) scale(.97)}
      .budget-nav{margin-bottom:24px;padding:10px 0;background:color-mix(in srgb,var(--bg,#F5F0E8) 96%,transparent);backdrop-filter:blur(10px)}.tabs button{padding-inline:12px}.phase-card-grid{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
      .chart-empty-copy{display:grid!important;grid-template-columns:1fr!important;gap:5px!important;padding:16px 0;color:var(--muted,#888780)}.chart-empty-copy strong{font-size:11px!important;color:var(--ink,#2C2C2A)}.chart-empty-copy span{font-size:10.5px!important}.chart-empty-copy.centered{align-content:center;min-height:126px;text-align:center}
      .phase-overview-empty{display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:14px 16px;border:1px dashed color-mix(in srgb,var(--ink,#2C2C2A) 28%,transparent);border-radius:13px 11px 15px 10px;background:color-mix(in srgb,var(--surface,#FFFEF9) 74%,transparent)}.phase-overview-empty strong{font-size:11px}.phase-overview-empty span{font-size:10.5px;color:var(--muted,#888780)}.summary-toggle{min-height:34px;font-size:10.5px}.summary-empty{display:grid;justify-items:center;padding:42px 24px 46px;text-align:center}.summary-empty .empty-mark{position:relative;width:36px;height:30px;margin-bottom:4px;border:1.5px solid var(--accent,#FFB703);border-radius:8px 10px 7px 9px;transform:rotate(-1deg)}.summary-empty .empty-mark:before,.summary-empty .empty-mark:after{content:"";position:absolute;left:7px;right:7px;border-top:1.5px solid var(--accent,#FFB703)}.summary-empty .empty-mark:before{top:9px}.summary-empty .empty-mark:after{top:17px;right:13px}.summary-empty strong{margin-top:10px;font-size:15px}.summary-empty p{max-width:390px;margin:7px 0 0;color:var(--muted,#888780);font-size:11.5px;line-height:1.5}.summary-empty .primary{margin-top:17px}
      .account summary{position:relative;padding-right:44px}.account summary:after{content:"";position:absolute;right:20px;width:7px;height:7px;border-right:1.5px solid var(--accent,#FFB703);border-bottom:1.5px solid var(--accent,#FFB703);transform:rotate(45deg);transition:transform .16s cubic-bezier(.2,.8,.2,1)}.account[open] summary:after{transform:rotate(225deg) translate(-2px,-2px)}.account summary>div:last-child{margin-left:auto}.account-detail{transform-origin:top;animation:budgetDetailIn .18s cubic-bezier(.2,.8,.2,1) both}@keyframes budgetDetailIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
      .cashflow-empty,.ledger-empty{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:18px;margin-top:14px;padding:24px}.cashflow-empty h3,.ledger-empty h3{margin-top:5px;font-size:17px}.cashflow-empty p,.ledger-empty p{max-width:620px;margin:7px 0 0;color:var(--muted,#888780);font-size:11.5px;line-height:1.5}.timeline-glyph,.receipt-glyph{display:grid;place-items:center;width:48px;height:48px;color:var(--accent,#FFB703)}.timeline-glyph svg,.receipt-glyph svg{width:42px;height:42px;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.ledger-empty{grid-template-columns:auto 1fr;margin-top:2px;min-height:154px}.ledger-empty:before{content:"";position:absolute;left:25px;right:28px;bottom:17px;border-bottom:1px solid color-mix(in srgb,var(--accent,#FFB703) 42%,transparent);border-radius:50%;transform:rotate(-.2deg)}.tax-layout,.tax-layout>*{min-width:0}.table-card .tax-table{min-width:0;table-layout:fixed}
      .modal-backdrop.is-entering{animation:budgetBackdropIn .14s ease-out both}.modal-backdrop.is-entering .schedule-modal{animation:budgetModalIn .18s cubic-bezier(.2,.8,.2,1) both}
      @media(prefers-reduced-motion:reduce){.view.is-entering,.tabs button.is-switching,.view.is-entering .section-head,.view.is-entering .kpi,.view.is-entering .phase-card,.view.is-entering .visual-grid>*,.view.is-entering .table-card,.view.is-entering .account-stack,.view.is-entering .settings-grid,.view.is-entering .filters,.view.is-entering .insight,.view.is-entering .donut,.view.is-entering .donut:before,.view.is-entering .bar i,.view.is-entering .cash-period b,.view.is-entering .budget-glyph svg path,.view.is-entering .table-title:after,.budget-actions span:not(:empty),.modal-backdrop.is-entering,.modal-backdrop.is-entering .schedule-modal,.account-detail{animation:none!important}.tabs button,tbody tr,.account summary,.account summary:after,input,select,.kpi:after,.panel:after,.table-card:after,.account:after{transition-duration:.01ms!important}}
      @media(prefers-reduced-motion:reduce){.kpi,.panel,.account,.table-card,.export,.primary,.secondary,.mini,.icon{transition-duration:.01ms!important}}
      @media(max-width:980px){.kpi-grid,.phase-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.visual-grid,.settings-grid{grid-template-columns:1fr}.filters{grid-template-columns:1fr 160px}.formula-note{grid-column:1 / -1}.finance-grid{grid-template-columns:1fr}.tax-layout{grid-template-columns:minmax(0,1fr)}.donut-wrap{grid-template-columns:150px 1fr}.budget-nav{top:-24px}}
      @media(max-width:640px){.fs-budget{padding-top:10px}.budget-nav{align-items:flex-start;flex-direction:column}.tabs{width:100%}.budget-actions{width:100%;justify-content:space-between}.section-head{align-items:flex-start;flex-direction:column}h2{font-size:23px}.kpi-grid,.phase-card-grid{grid-template-columns:1fr}.visual-grid{grid-template-columns:1fr}.donut-wrap{grid-template-columns:1fr;justify-items:center}.legend{width:100%}.insight{grid-template-columns:1fr}.filters{grid-template-columns:1fr}.form-grid,.schedule-grid{grid-template-columns:1fr}.form-grid label:nth-child(5){grid-column:auto}.schedule-summary{grid-template-columns:1fr}.tax-layout{padding:12px}.cashflow-empty,.ledger-empty{grid-template-columns:1fr;justify-items:start}.cashflow-empty .secondary{margin-top:2px}.modal-backdrop{padding:10px}}
      /* Keep the two dense production tables readable without horizontal scrolling. */
      .breakdown-table th:first-child,.breakdown-table td:first-child{padding-left:12px!important}.breakdown-table th:nth-child(1){width:6%!important}.breakdown-table th:nth-child(2){width:17%!important}
      .settings-panel input::placeholder{color:var(--muted,#888780);opacity:.48}
      .expense-table th:nth-child(1),.expense-table td:nth-child(1){width:7%!important}.expense-table th:nth-child(2),.expense-table td:nth-child(2){width:10%!important}.expense-table th:nth-child(3),.expense-table td:nth-child(3){width:18%!important}.expense-table th:nth-child(4),.expense-table td:nth-child(4){width:10%!important}.expense-table th:nth-child(5),.expense-table td:nth-child(5){width:12%!important}.expense-table th:nth-child(6),.expense-table td:nth-child(6){width:9%!important}.expense-table th:nth-child(7),.expense-table td:nth-child(7){width:8%!important}.expense-table th:nth-child(8),.expense-table td:nth-child(8){width:10%!important}.expense-table th:nth-child(9),.expense-table td:nth-child(9){width:11%!important}.expense-table th:nth-child(10),.expense-table td:nth-child(10){width:5%!important}.receipt-compact{justify-content:flex-start;gap:5px}.receipt-compact .receipt-preview-wrap{flex:0 0 auto}.receipt-compact .receipt-view,.receipt-compact label{min-width:48px;justify-content:center}.receipt-compact label{border-style:solid;border-color:var(--hair,#E7E4DA);background:var(--soft,#EFEBE1);color:var(--muted,#888780);font-size:9px}
      .expense-table th:nth-child(6),.expense-table td:nth-child(6){width:9%}.expense-table th:nth-child(7),.expense-table td:nth-child(7){width:8%}.expense-table th:nth-child(8),.expense-table td:nth-child(8){width:10%;text-align:right}.expense-table th:nth-child(9),.expense-table td:nth-child(9){width:12%;white-space:nowrap}.expense-table th:nth-child(10),.expense-table td:nth-child(10){width:5%;text-align:center}.variance-badge{display:inline-flex;align-items:center;justify-content:flex-end;min-height:27px;padding:0 8px;border:1px solid color-mix(in srgb,#5B7A4A 42%,var(--hair,#E7E4DA));border-radius:8px 7px 9px 6px;background:color-mix(in srgb,#5B7A4A 10%,var(--surface,#FFFEF9));color:#416536;font-size:9.5px;font-weight:800;white-space:nowrap}.variance-badge.negative{border-color:color-mix(in srgb,#C74440 42%,var(--hair,#E7E4DA));background:rgba(199,68,64,.1);color:#C74440!important}.expense-table .receipt{max-width:none;min-width:0;white-space:nowrap}.expense-table .receipt>span:not(.receipt-preview-wrap){max-width:84px!important;white-space:nowrap}.expense-table .receipt label{white-space:nowrap}
      .breakdown-table,.expense-table{min-width:0!important;width:100%;table-layout:fixed}.breakdown-table th,.breakdown-table td,.expense-table th,.expense-table td{padding:7px 5px;font-size:9.5px;white-space:normal;overflow-wrap:anywhere;line-height:1.25}.breakdown-table input,.breakdown-table select,.expense-table input,.expense-table select{min-width:0;width:100%;padding:0 4px;font-size:9px}.breakdown-table th:nth-child(1){width:5%}.breakdown-table th:nth-child(2){width:16%}.breakdown-table th:nth-child(n+3){width:auto}.expense-table th:nth-child(1),.expense-table td:nth-child(1){width:6%}.expense-table th:nth-child(2),.expense-table td:nth-child(2){width:10%}.expense-table th:nth-child(3),.expense-table td:nth-child(3){width:17%}.expense-table th:nth-child(4),.expense-table td:nth-child(4){width:13%}.expense-table th:nth-child(5),.expense-table td:nth-child(5){width:14%}.expense-table th:nth-child(n+6){width:auto}.table-scroll{overflow-x:hidden}
      .receipt-preview-wrap{position:relative;display:inline-flex;align-items:center}.receipt-view{min-height:29px!important;padding:0 9px!important;border:1px solid var(--accent,#FFB703)!important;border-radius:9px 8px 10px 7px!important;background:var(--accent-soft,rgba(255,183,3,.12))!important;color:var(--accent,#BA7517)!important;font-size:10px!important;font-weight:800!important;transition:transform .16s ease,background-color .16s ease,box-shadow .16s ease!important}.receipt-view:hover{transform:translateY(-1px);background:var(--accent-soft,rgba(255,183,3,.22))!important;box-shadow:0 4px 12px rgba(35,35,34,.12)}.receipt-preview{position:absolute;left:0;bottom:calc(100% + 9px);z-index:50;display:block;width:156px!important;height:116px!important;max-width:none!important;padding:5px!important;overflow:hidden;border:1px solid var(--ink,#2C2C2A);border-radius:11px 9px 12px 8px;background:var(--surface,#FFFEF9);box-shadow:0 14px 28px rgba(35,35,34,.22);opacity:0;pointer-events:none;transform:translateY(5px) scale(.96);transition:opacity .16s ease,transform .18s cubic-bezier(.2,.8,.2,1)}.receipt-preview img{display:block;width:100%;height:100%;object-fit:cover;border-radius:7px}.receipt-preview-wrap:hover .receipt-preview,.receipt-preview-wrap:focus-within .receipt-preview{opacity:1;transform:none}
    </style>`;
  }
}

if (!customElements.get('filmscript-budget')) customElements.define('filmscript-budget', FilmScriptBudget);
