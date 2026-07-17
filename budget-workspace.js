import { computeBudget, normalizeBudget, PHASES } from './budget-model.js?v=20260716-budgetinteger1';

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
    this.calendarConnected = false;
    this.productionSchedule = {};
    this.cashFlowFocusPeriod = '';
    this.cashFlowSearch = '';
    this.cashFlowVisibleWeekCount = 0;
    this.showAllAccounts = false;
    this.openAccounts = new Set();
    this.scheduleItemId = '';
    this.expensePickerId = '';
    this.expenseLineSearch = '';
    this._saveRevision = 0;
    this._animateView = true;
    this._animateModal = false;
    this.importOpen = false;
    this.importBusy = false;
    this.importError = '';
    this.importFile = null;
    this.importUrl = '';
    this.importPreview = null;
        this._moneyAnimationFrame = 0;
        this._moneySoundTimer = 0;
        this._onLanguageChange = () => this.render();
  }

  connectedCallback() {
    this.shadowRoot.addEventListener('click', this._onClick);
    this.shadowRoot.addEventListener('change', this._onChange);
    this.shadowRoot.addEventListener('input', this._onInput);
    this.shadowRoot.addEventListener('keydown', this._onKeyDown);
        window.filmscriptSounds?.preload('formatControl');
        window.filmscriptSounds?.preload('budgetCount');
        window.addEventListener('filmscript:language-change', this._onLanguageChange);
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
        window.removeEventListener('filmscript:language-change', this._onLanguageChange);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'script-id' && oldValue && oldValue !== newValue && this.isConnected) this.load();
  }

    get scriptId() { return this.getAttribute('script-id') || ''; }
    get projectTitle() { return this.getAttribute('project-title') || 'Untitled screenplay'; }
    displayLabel(value) {
      const text = String(value ?? '');
      return window.filmscriptLanguage?.get?.() === 'es'
        ? (window.filmscriptLanguage?.t?.(text, 'es') || text)
        : text;
    }

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
      this.calendarConnected = Boolean(result.calendarConnected);
      this.productionSchedule = result.productionSchedule || {};
      this.cashFlowSearch = '';
      this.cashFlowVisibleWeekCount = 0;
      this.cashFlowFocusPeriod = this.budget.periods.find((period) => period.id.startsWith('shoot_'))?.id
        || this.budget.periods[0]?.id
        || '';
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
        this.calendarConnected = Boolean(result.calendarConnected);
        this.productionSchedule = result.productionSchedule || this.productionSchedule || {};
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
    const importUrl = event.target.closest('[data-import-url]');
    if (importUrl) {
      this.importUrl = importUrl.value;
      return;
    }
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
    const cashFlowSearch = event.target.closest('[data-cashflow-search]');
    if (cashFlowSearch) {
      this.cashFlowSearch = cashFlowSearch.value;
      this.render();
      requestAnimationFrame(() => {
        const next = this.shadowRoot.querySelector('[data-cashflow-search]');
        if (next) { next.focus(); next.setSelectionRange(this.cashFlowSearch.length, this.cashFlowSearch.length); }
      });
      return;
    }
    const cashFlowWindow = event.target.closest('[data-cashflow-window]');
    if (cashFlowWindow) {
      const maximum = Math.max(1, finite(cashFlowWindow.max, 1));
      const requested = Math.max(1, Math.min(maximum, Math.trunc(finite(cashFlowWindow.value, maximum))));
      this.cashFlowVisibleWeekCount = requested >= maximum ? 0 : requested;
      const output = this.shadowRoot.querySelector('[data-cashflow-window-value]');
      if (output) output.textContent = requested >= maximum ? `All ${maximum} weeks` : `${requested} of ${maximum} weeks`;
      return;
    }
    const expenseLineSearch = event.target.closest('[data-expense-line-search]');
    if (expenseLineSearch) {
      this.expenseLineSearch = expenseLineSearch.value;
      this.render();
      requestAnimationFrame(() => {
        const next = this.shadowRoot.querySelector('[data-expense-line-search]');
        if (next) { next.focus(); next.setSelectionRange(this.expenseLineSearch.length, this.expenseLineSearch.length); }
      });
      return;
    }
    const input = event.target;
    if (!input.dataset.model || input.tagName !== 'INPUT' || input.type === 'file') return;
    if (input.dataset.model === 'item' && input.dataset.field === 'quantity') {
      const raw = String(input.value ?? '');
      const normalized = raw.replace(',', '.').split('.')[0].replace(/[^0-9]/g, '');
      if (raw !== normalized) input.value = normalized;
    }
    this.updateModelInput(input, false);
  };

  _onKeyDown = (event) => {
    const quantityInput = event.target.closest?.('input[data-model="item"][data-field="quantity"]');
    if (quantityInput && !event.ctrlKey && !event.metaKey && !event.altKey
      && ['.', ',', 'e', 'E', '+', '-', 'Decimal'].includes(event.key)) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && (this.scheduleItemId || this.expensePickerId)) {
      this.scheduleItemId = '';
      this.expensePickerId = '';
      this.expenseLineSearch = '';
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
      this.expensePickerId = '';
      this.expenseLineSearch = '';
      if (this.importOpen && !this.importBusy) this.importOpen = false;
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
      this.expensePickerId = '';
      this.expenseLineSearch = '';
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
    if (action === 'open-import') { this.importOpen = true; this.importError = ''; this._animateModal = true; this.render(); }
    if (action === 'close-import') { if (!this.importBusy) { this.importOpen = false; this.importPreview = null; this.importFile = null; this.importUrl = ''; this.importError = ''; this.render(); } }
    if (action === 'analyze-import') this.analyzeImport();
    if (action === 'commit-import') this.commitImport();
    if (action === 'reset-import') { this.importPreview = null; this.importError = ''; this.importFile = null; this.importUrl = ''; this.render(); }
    if (action === 'toggle-empty-accounts') { this.showAllAccounts = !this.showAllAccounts; this.render(); }
    if (action === 'add-item') this.addItem(target.dataset.account);
    if (action === 'remove-item') this.removeItem(target.dataset.id);
    if (action === 'open-schedule') { this.scheduleItemId = target.dataset.id; this._animateModal = true; this.render(); }
    if (action === 'close-schedule') { this.scheduleItemId = ''; this.render(); }
    if (action === 'auto-schedule') this.autoSchedule(target.dataset.id);
    if (action === 'clear-schedule') this.clearSchedule(target.dataset.id);
    if (action === 'focus-cash-week') {
      this.cashFlowFocusPeriod = target.dataset.period || '';
      this.render();
      requestAnimationFrame(() => this.shadowRoot.querySelector(`[data-cash-week="${this.cashFlowFocusPeriod}"]`)?.scrollIntoView?.({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      }));
    }
    if (action === 'add-funding') this.addFunding();
    if (action === 'remove-funding') this.removeFunding(target.dataset.id);
    if (action === 'add-expense') this.addExpense();
    if (action === 'remove-expense') this.removeExpense(target.dataset.id);
    if (action === 'open-expense-picker') {
      this.expensePickerId = target.dataset.id || '';
      this.expenseLineSearch = '';
      this._animateModal = true;
      this.render();
      requestAnimationFrame(() => this.shadowRoot.querySelector('[data-expense-line-search]')?.focus());
    }
    if (action === 'close-expense-picker') {
      this.expensePickerId = '';
      this.expenseLineSearch = '';
      this.render();
    }
    if (action === 'select-expense-line') {
      const expense = this.findExpense(target.dataset.id);
      if (expense) {
        expense.lineItemId = target.dataset.lineId || '';
        this.expensePickerId = '';
        this.expenseLineSearch = '';
        this.queueSave();
      }
    }
    if (action === 'add-tax') this.addTax();
    if (action === 'remove-tax') this.removeTax(target.dataset.id);
    if (action === 'view-receipt') window.open(window.filmscriptBudget.receiptUrl(this.scriptId, target.dataset.receipt), '_blank', 'noopener');
  };

  _onChange = (event) => {
    const input = event.target;
    if (input.dataset.importFile !== undefined) {
      this.importFile = input.files?.[0] || null;
      this.importError = '';
      this.render();
      return;
    }
    if (input.dataset.cashflowWindow !== undefined) {
      const maximum = Math.max(1, finite(input.max, 1));
      const requested = Math.max(1, Math.min(maximum, Math.trunc(finite(input.value, maximum))));
      this.cashFlowVisibleWeekCount = requested >= maximum ? 0 : requested;
      this.render();
      requestAnimationFrame(() => this.shadowRoot.querySelector('[data-cashflow-window]')?.focus());
      return;
    }
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
    } else if (field === 'quantity') {
      found.item[field] = Math.max(0, Math.trunc(finite(input.value)));
    } else if (['multiplier', 'unitCost'].includes(field)) {
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
    const row = computeBudget(this.budget, this.projectTitle).itemMap.get(input.dataset.id);
    const otherScheduled = this.budget.periods.reduce((sum, period) => {
      if (period.id === input.dataset.period) return sum;
      return sum + Math.max(0, finite(found.item.schedule?.[period.id]));
    }, 0);
    const maximum = Math.max(0, finite(row?.total) - otherScheduled);
    const requested = Math.max(0, finite(input.value));
    const amount = Math.min(requested, maximum);
    found.item.schedule[input.dataset.period] = amount;
    if (requested > maximum + 0.005) {
      input.value = String(amount);
      this.uploadStatus = 'Schedule limited to the budget line total';
    }
    this.queueSave(render);
  }

  autoSchedule(itemId) {
    const found = this.findItem(itemId);
    const row = computeBudget(this.budget, this.projectTitle).itemMap.get(itemId);
    if (!found || !row) return;
    const stageByPhase = {
      above_line: 'prep',
      production: 'shoot',
      postproduction: 'post',
      other: 'wrap',
    };
    const preferredStage = stageByPhase[found.account.phaseId] || 'shoot';
    let targetPeriods = this.budget.periods.filter((period) => period.stage === preferredStage);
    if (!targetPeriods.length) targetPeriods = this.budget.periods.filter((period) => period.stage === 'shoot');
    if (!targetPeriods.length) return;
    this.budget.periods.forEach((period) => { found.item.schedule[period.id] = 0; });
    const cents = Math.max(0, Math.round(finite(row.total) * 100));
    const baseCents = Math.floor(cents / targetPeriods.length);
    let placedCents = 0;
    targetPeriods.forEach((period, index) => {
      const periodCents = index === targetPeriods.length - 1 ? cents - placedCents : baseCents;
      found.item.schedule[period.id] = periodCents / 100;
      placedCents += periodCents;
    });
    this.uploadStatus = `Scheduled across ${targetPeriods.length} ${preferredStage} week${targetPeriods.length === 1 ? '' : 's'}`;
    this.queueSave();
  }

  clearSchedule(itemId) {
    const found = this.findItem(itemId);
    if (!found) return;
    this.budget.periods.forEach((period) => { found.item.schedule[period.id] = 0; });
    this.uploadStatus = 'Schedule cleared';
    this.queueSave();
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
    if (input.dataset.field === 'shootingDates' && this.calendarConnected) return;
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
    const id = uid('expense');
    this.budget.expenses.push({
      id, lineItemId: '', paymentNumber: String(this.budget.expenses.length + 1),
      paymentDate: new Date().toISOString().slice(0, 10), vendor: '', concept: '', amount: 0, notes: '',
      receiptId: '', receiptName: '', receiptType: '', receiptSize: 0,
    });
    this.expensePickerId = id;
    this.expenseLineSearch = '';
    this._animateModal = true;
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
    const language = String(window.filmscriptLanguage?.get?.() || document.documentElement.lang || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
    link.href = window.filmscriptBudget.exportUrl(this.scriptId, language);
    link.download = `${this.projectTitle || 'FilmScript'} budget.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => { this.uploadStatus = ''; this.render(); }, 900);
  }

  async fileToBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
    }
    return btoa(binary);
  }

  async analyzeImport() {
    if (this.importBusy) return;
    const url = this.importUrl.trim();
    if (!this.importFile && !url) {
      this.importError = 'Choose a PDF, Excel, CSV or text file, or paste a shared Google Docs link.';
      this.render();
      return;
    }
    if (this.importFile && this.importFile.size > 10 * 1024 * 1024) {
      this.importError = 'Files must be 10 MB or smaller.';
      this.render();
      return;
    }
    this.importBusy = true;
    this.importError = '';
    this.uploadStatus = 'Lumiere is analyzing the budget';
    this.render();
    try {
      const language = String(window.filmscriptLanguage?.get?.() || document.documentElement.lang || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
      const payload = url
        ? { sourceType: 'google_docs', url, language }
        : { sourceType: 'file', filename: this.importFile.name, mimeType: this.importFile.type, dataBase64: await this.fileToBase64(this.importFile), language };
      this.importPreview = await window.filmscriptBudget.importBudget(this.scriptId, payload);
      this.uploadStatus = '';
    } catch (error) {
      this.importError = error.message || 'Lumiere could not analyze this source.';
      this.uploadStatus = '';
    } finally {
      this.importBusy = false;
      this.render();
    }
  }

  async commitImport() {
    const proposalId = this.importPreview?.proposalId;
    if (!proposalId || this.importBusy) return;
    this.importBusy = true;
    this.importError = '';
    this.uploadStatus = 'Applying approved budget lines';
    this.render();
    try {
      const result = await window.filmscriptBudget.importBudget(this.scriptId, { commit: true, proposalId });
      this.budget = normalizeBudget(result.budget, this.projectTitle);
      this.productionSchedule = result.productionSchedule || this.productionSchedule || {};
      this.importOpen = false;
      this.importPreview = null;
      this.importFile = null;
      this.importUrl = '';
      this.saveStatus = 'Imported and saved';
      this.uploadStatus = '';
      const computed = computeBudget(this.budget, this.projectTitle);
      this.openAccounts = new Set(computed.accounts.filter((account) => account.total > 0 || account.spent > 0).map((account) => account.code));
    } catch (error) {
      this.importError = error.message || 'The budget import could not be applied.';
      this.uploadStatus = '';
    } finally {
      this.importBusy = false;
      this.render();
    }
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
      ['quick', 'Quick View'], ['breakdown', 'Breakdown'], ['summary', 'Summary'],
      ['cashflow', 'Cash Flow'], ['finance', 'Finance'], ['expenses', 'Expenses'], ['settings', 'Settings'],
    ];
    const tabs = views.map(([id, label]) => `<button type="button" role="tab" data-view="${id}" aria-selected="${this.view === id}" aria-pressed="${this.view === id}" tabindex="${this.view === id ? '0' : '-1'}">${label}</button>`).join('');
    let content = this.renderQuick(computed);
    if (this.view === 'summary') content = this.renderSummary(computed);
    if (this.view === 'breakdown') content = this.renderBreakdown(computed);
    if (this.view === 'cashflow') content = this.renderCashFlow(computed);
    if (this.view === 'finance') content = this.renderFinance(computed);
    if (this.view === 'expenses') content = this.renderExpenses(computed);
    if (this.view === 'settings') content = this.renderSettings(computed);
    this.shadowRoot.innerHTML = `${styles}
      <div class="fs-budget">
        <div class="budget-nav">
          <div class="tabs" role="tablist" aria-label="Budget views">${tabs}</div>
          <div class="budget-actions"><span aria-live="polite">${escapeHtml(this.saveStatus || this.uploadStatus)}</span><button type="button" class="secondary import-trigger" data-action="open-import">${escapeHtml(this.displayLabel('Import Budget'))}</button><button type="button" class="export" data-action="export">${escapeHtml(this.displayLabel('Export'))}</button></div>
        </div>
        ${this.error ? `<div class="notice error" role="alert">${escapeHtml(this.error)}</div>` : ''}
        ${content}
        ${this.renderScheduleModal(computed)}
        ${this.renderExpensePicker(computed)}
        ${this.renderImportModal()}
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
    const donutTotal = this.moneyValue(computed.total);
    const donutTotalLength = this.formatMoney(computed.total).length;
    const donutDensity = donutTotalLength > 17 ? 'is-compact' : donutTotalLength > 13 ? 'is-tight' : '';
    const legend = phasesWithValue.length
      ? phasesWithValue.map((phase) => `<div><i style="background:${phase.color}"></i><span>${phase.name}</span><strong>${this.formatPercent(phase.share)}</strong></div>`).join('')
      : '<div class="chart-empty-copy"><strong>No allocation yet</strong><span>Add the first cost in Breakdown.</span></div>';
    const bars = phasesWithValue.length ? phasesWithValue.map((phase) => {
      const spentShare = phase.total > 0 ? Math.min(1, phase.spent / phase.total) : 0;
      return `<div class="phase-bar"><div><strong>${phase.name}</strong><span>${this.formatMoney(phase.spent)} of ${this.formatMoney(phase.total)}</span></div><div class="bar"><i style="width:${(spentShare * 100).toFixed(2)}%;background:${phase.color}"></i></div></div>`;
    }).join('') : '<div class="chart-empty-copy centered"><strong>Nothing to compare yet</strong><span>Progress appears as costs are planned.</span></div>';
    const topPhase = [...phasesWithValue].sort((a, b) => b.total - a.total)[0];
    const insight = computed.unbudgetedSpent > 0.005
      ? `${this.formatMoney(computed.unbudgetedSpent)} in unexpected costs is included in actual spend and needs review.`
      : computed.total > 0
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
        <article class="panel allocation"><div class="panel-head"><div><span>Allocation</span><h3>Where the budget goes</h3></div><small>Total by production phase</small></div><div class="donut-wrap"><div class="donut" style="--budget-donut:${donut}" role="img" aria-label="Budget allocation by production phase"><span class="donut-center ${donutDensity}"><strong>${donutTotal}</strong><small>Total</small></span></div><div class="legend">${legend}</div></div></article>
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
    const phaseCards = `${activePhases.map((phase) => `<article class="phase-card" style="--phase:${phase.color}"><span>${phase.name}</span><strong>${this.moneyValue(phase.total)}</strong><small>${this.formatMoney(phase.spent)} spent</small></article>`).join('')}${computed.unassignedSpent > 0.005 ? `<article class="phase-card unexpected-phase" style="--phase:#BA7517"><span>Unexpected Costs</span><strong>${this.moneyValue(computed.unassignedSpent)}</strong><small>Actual spend without an approved line</small></article>` : ''}`;
    const activeAccounts = computed.accounts.filter((account) => account.total > 0 || account.spent > 0);
    const displayedAccounts = this.showAllAccounts ? computed.accounts : activeAccounts;
    const accountRows = displayedAccounts.map((account) => `<tr><td><span class="account-code">${account.code}</span></td><td>${escapeHtml(account.name)}</td><td>${this.formatMoney(account.subtotal)}</td><td>${this.formatMoney(account.tax)}</td><td><strong>${this.formatMoney(account.total)}</strong></td><td>${this.formatMoney(account.spent)}</td><td class="${account.remaining < 0 ? 'negative' : ''}">${this.formatMoney(account.remaining)}</td></tr>`).join('');
    const unexpectedRow = computed.unassignedSpent > 0.005
      ? `<tr class="summary-unexpected"><td><span class="account-code">—</span></td><td><strong>Unexpected costs</strong></td><td>${this.formatMoney(0)}</td><td>${this.formatMoney(0)}</td><td><strong>${this.formatMoney(0)}</strong></td><td>${this.formatMoney(computed.unassignedSpent)}</td><td class="negative">${this.formatMoney(-computed.unassignedSpent)}</td></tr>`
      : '';
    const rows = `${accountRows}${unexpectedRow}`;
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
    const unexpectedAlert = computed.unbudgetedSpent > 0.005
      ? `<div class="unexpected-alert"><span><strong>${this.formatMoney(computed.unbudgetedSpent)} in unexpected costs</strong><small>These payments are included in actual spend but are not part of the approved budget.</small></span><button type="button" data-view="expenses">Review Expenses</button></div>`
      : '';
    return `<section class="view" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Cost detail</span><h2>Budget Breakdown</h2><p>Open an account, change any driver and every report updates together.</p></div></div>
      ${unexpectedAlert}
      <div class="filters"><label><span>Search</span><input data-budget-search value="${escapeHtml(this.search)}" placeholder="Account, code or cost item"></label><label><span>Phase</span><select data-phase-filter>${phaseOptions}</select></label><div class="formula-note"><strong>Live formula</strong><span>Quantity × times × unit cost, then tax</span></div></div>
      <div class="account-stack">${sections || '<div class="empty small"><strong>No matching cost items</strong><p>Clear the filters to see the complete budget.</p></div>'}</div>
    </section>`;
  }

  renderBreakdownRow(item) {
    const calculation = item.calculation === 'contingency';
    const input = (field, value, type = 'text', extra = '') => calculation
      ? `<span class="calculated">${field === 'unitCost' ? this.formatPercent(this.budget.settings.contingencyRate) : escapeHtml(value)}</span>`
      : `<input data-model="item" data-id="${item.id}" data-field="${field}" type="${type}" value="${escapeHtml(field === 'name' ? this.displayLabel(value) : value)}" ${extra}>`;
    return `<tr class="${calculation ? 'contingency-row' : ''}">
      <td>${input('code', item.code)}</td><td>${input('name', item.name)}</td><td>${input('quantity', item.quantity, 'number', 'min="0" step="1" inputmode="numeric" pattern="[0-9]*" data-integer-only="true"')}</td><td>${input('unit', item.unit)}</td><td>${input('multiplier', item.multiplier, 'number', 'min="0" step="0.01"')}</td><td>${input('unitCost', item.unitCost, 'number', 'min="0" step="0.01"')}</td>
      <td>${calculation ? '<span class="calculated">Exempt</span>' : `<select data-model="item" data-id="${item.id}" data-field="tax">${this.taxOptions(item)}</select>`}</td>
      <td>${calculation ? '<span class="calculated">Fixed</span>' : `<select data-model="item" data-id="${item.id}" data-field="costType"><option value="fixed" ${item.costType === 'fixed' ? 'selected' : ''}>Fixed</option><option value="variable" ${item.costType === 'variable' ? 'selected' : ''}>Variable</option></select>`}</td>
      <td>${calculation ? '<span class="calculated">Cash</span>' : `<select data-model="item" data-id="${item.id}" data-field="fundingKind"><option value="cash" ${item.fundingKind === 'cash' ? 'selected' : ''}>Cash</option><option value="in_kind" ${item.fundingKind === 'in_kind' ? 'selected' : ''}>In kind</option></select>`}</td>
      <td><strong>${this.formatMoney(item.total)}</strong></td><td>${this.formatMoney(item.spent)}</td><td class="${item.remaining < 0 ? 'negative' : ''}">${this.formatMoney(item.remaining)}</td>
      <td><button type="button" class="mini" data-action="open-schedule" data-id="${item.id}">Schedule</button></td><td>${calculation ? '' : `<button type="button" class="icon" data-action="remove-item" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.name)}">×</button>`}</td>
    </tr>`;
  }

  parseIsoDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    if (Number.isNaN(date.getTime())
      || date.getUTCFullYear() !== Number(match[1])
      || date.getUTCMonth() !== Number(match[2]) - 1
      || date.getUTCDate() !== Number(match[3])) return null;
    return date;
  }

  addDateDays(value, days) {
    const date = value instanceof Date ? new Date(value.getTime()) : this.parseIsoDate(value);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() + Math.trunc(days));
    return date;
  }

  locale() {
    return globalThis.window?.filmscriptLanguage?.get?.() === 'es' ? 'es-GT' : 'en-GB';
  }

  formatWeekRange(start, end, { includeYear = false } = {}) {
    if (!start || !end) return 'Relative production week';
    const locale = this.locale();
    const isSpanish = locale.startsWith('es');
    const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    const day = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });
    const monthName = (date) => month.format(date).replace(/\.$/, '');
    const startDay = day.format(start);
    const endDay = day.format(end);
    const sameMonth = start.getUTCMonth() === end.getUTCMonth();
    const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
    let range = sameMonth
      ? `${startDay}–${endDay}${isSpanish ? ' de ' : ' '}${monthName(end)}`
      : `${startDay} ${monthName(start)}–${endDay} ${monthName(end)}`;
    if (includeYear) {
      range += sameYear
        ? ` ${end.getUTCFullYear()}`
        : ` ${start.getUTCFullYear()}–${end.getUTCFullYear()}`;
    }
    return range;
  }

  formatCalendarDate(value) {
    const date = value instanceof Date ? value : this.parseIsoDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat(this.locale(), {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  parseCashFlowSearchDate(value) {
    const query = String(value || '').trim();
    const iso = query.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) return this.parseIsoDate(`${iso[1]}-${iso[2]}-${iso[3]}`);
    const local = query.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
    if (!local) return null;
    return this.parseIsoDate(`${local[3]}-${String(local[2]).padStart(2, '0')}-${String(local[1]).padStart(2, '0')}`);
  }

  cashFlowWeekMatches(week, value = this.cashFlowSearch) {
    const query = String(value || '').trim().toLocaleLowerCase(this.locale());
    if (!query) return true;
    const queryDate = this.parseCashFlowSearchDate(query);
    if (queryDate && week.startDate && week.endDate) {
      const time = queryDate.getTime();
      if (time >= week.startDate.getTime() && time <= week.endDate.getTime()) return true;
    }
    const scheduledText = week.scheduledItems.flatMap(({ item }) => [
      item.accountCode, item.accountName, item.code, item.name,
    ]);
    const actualText = week.actualRows.flatMap((expense) => [
      expense.paymentNumber, expense.paymentDate, expense.vendor, expense.concept, expense.notes,
      expense.accountCode, expense.accountName, expense.lineItemCode, expense.lineItemName, expense.receiptName,
    ]);
    return [
      week.id, week.label, week.stage, week.dateLabel, week.longDateLabel,
      week.startDate?.toISOString().slice(0, 10), week.endDate?.toISOString().slice(0, 10),
      ...scheduledText, ...actualText,
    ].join(' ').toLocaleLowerCase(this.locale()).includes(query);
  }

  visibleCashFlowWeeks(weeks) {
    if (this.cashFlowSearch.trim()) return weeks.filter((week) => this.cashFlowWeekMatches(week));
    const requested = Math.trunc(finite(this.cashFlowVisibleWeekCount));
    if (!requested || requested >= weeks.length) return weeks;
    const count = Math.max(1, requested);
    let focusIndex = weeks.findIndex((week) => week.id === this.cashFlowFocusPeriod);
    if (focusIndex < 0) focusIndex = Math.max(0, weeks.findIndex((week) => week.id === 'shoot_1'));
    const start = Math.max(0, Math.min(weeks.length - count, focusIndex - Math.floor(count / 2)));
    return weeks.slice(start, start + count);
  }

  cashFlowWeeks(computed) {
    const periods = this.budget.periods || [];
    const shootIndex = Math.max(0, periods.findIndex((period) => period.id === 'shoot_1'));
    const shootStart = this.parseIsoDate(this.productionSchedule?.shootStartDate);
    const itemRows = computed.accounts.flatMap((account) => account.items);
    return periods.map((period, index) => {
      const startDate = shootStart ? this.addDateDays(shootStart, (index - shootIndex) * 7) : null;
      const endDate = startDate ? this.addDateDays(startDate, 6) : null;
      const startTime = startDate?.getTime();
      const endTime = endDate?.getTime();
      const actualRows = startDate ? computed.expenseRows.filter((expense) => {
        const paid = this.parseIsoDate(expense.paymentDate);
        return expense.fundingKind !== 'in_kind'
          && paid
          && paid.getTime() >= startTime
          && paid.getTime() <= endTime;
      }) : [];
      const scheduledItems = itemRows.flatMap((item) => {
        const amount = Math.max(0, finite(item.schedule?.[period.id]));
        return amount > 0 && item.fundingKind !== 'in_kind' ? [{ item, amount }] : [];
      }).sort((a, b) => b.amount - a.amount);
      const shootDetail = period.stage === 'shoot'
        ? this.productionSchedule?.shootWeekDetails?.find((entry) => Number(entry.week) === Number(period.week))
        : null;
      return {
        ...period,
        startDate,
        endDate,
        dateLabel: this.formatWeekRange(startDate, endDate),
        longDateLabel: this.formatWeekRange(startDate, endDate, { includeYear: true }),
        planned: Math.max(0, finite(computed.scheduleCashTotals?.[period.id])),
        inKind: Math.max(0, finite(computed.scheduleInKindTotals?.[period.id])),
        actual: actualRows.reduce((sum, expense) => sum + finite(expense.amount), 0),
        actualRows,
        scheduledItems,
        shootDetail,
      };
    });
  }

  renderCashFlow(computed) {
    const cashItems = computed.accounts.flatMap((account) => account.items)
      .filter((item) => item.fundingKind !== 'in_kind' && item.total > 0);
    const needsScheduling = cashItems.filter((item) => item.unscheduled > 0.005)
      .sort((a, b) => b.unscheduled - a.unscheduled);
    const overScheduled = cashItems.filter((item) => item.overScheduled > 0.005)
      .sort((a, b) => b.overScheduled - a.overScheduled);
    const allWeeks = this.cashFlowWeeks(computed);
    const weeks = this.visibleCashFlowWeeks(allWeeks);
    const cashExpenses = computed.expenseRows.filter((expense) => expense.fundingKind !== 'in_kind');
    const cashExpenseCount = cashExpenses.length;
    const undatedCashExpenses = cashExpenses.filter((expense) => !this.parseIsoDate(expense.paymentDate));
    const datedCashExpenseCount = cashExpenseCount - undatedCashExpenses.length;
    const datedWeeks = allWeeks.filter((week) => week.startDate && week.endDate);
    const timelineStart = datedWeeks[0]?.startDate?.getTime();
    const timelineEnd = datedWeeks.at(-1)?.endDate?.getTime();
    const outsideTimelineExpenses = timelineStart != null && timelineEnd != null
      ? cashExpenses.filter((expense) => {
        const paid = this.parseIsoDate(expense.paymentDate);
        return paid && (paid.getTime() < timelineStart || paid.getTime() > timelineEnd);
      })
      : [];
    const outsideIds = new Set(outsideTimelineExpenses.map((expense) => expense.id));
    const unplacedCashExpenses = cashExpenses.filter((expense) => !this.parseIsoDate(expense.paymentDate) || outsideIds.has(expense.id));
    const cashQuery = this.cashFlowSearch.trim().toLocaleLowerCase(this.locale());
    const matchingUnplacedExpenses = cashQuery
      ? unplacedCashExpenses.filter((expense) => [
        expense.paymentNumber, expense.paymentDate, expense.vendor, expense.concept, expense.notes,
        expense.accountCode, expense.accountName, expense.lineItemCode, expense.lineItemName,
      ].join(' ').toLocaleLowerCase(this.locale()).includes(cashQuery))
      : [];
    if (!cashItems.length && !cashExpenses.length) {
      return `<section class="view" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Weekly timing</span><h2>Cash Flow</h2><p>See when production cash is expected to leave the project.</p></div></div>
        <article class="panel cashflow-empty"><span class="timeline-glyph" aria-hidden="true"><svg viewBox="0 0 42 42" fill="none"><path d="M7 30.5h28M10 25l6-6 5 3 10-11M28 11h3v3"/></svg></span><div><span class="eyebrow">Budget Breakdown</span><h3>Build the cash budget first</h3><p>Add the first cash cost in Breakdown, then use Schedule to place it on the weekly production timeline.</p></div><button type="button" class="secondary" data-view="breakdown">Open Breakdown</button></article>
      </section>`;
    }
    const peakWeek = weeks.reduce((peak, week) => week.planned > peak.planned ? week : peak, weeks[0] || { planned: 0, label: 'No matching week' });
    const maximum = Math.max(1, ...weeks.flatMap((week) => [week.planned, week.actual]));
    const chartWidth = Math.max(260, weeks.length * 64);
    const chartColumns = weeks.map((week, index) => {
      const plannedHeight = week.planned > 0 ? Math.max(3, week.planned / maximum * 100) : 0;
      const actualHeight = week.actual > 0 ? Math.max(3, week.actual / maximum * 100) : 0;
      const focused = this.cashFlowFocusPeriod === week.id;
      const stageLabel = week.stage === 'shoot' ? 'Shoot' : week.stage === 'post' ? 'Post' : week.stage === 'wrap' ? 'Wrap' : 'Prep';
      return `<button type="button" class="cash-column ${focused ? 'is-focused' : ''}" style="--cash-index:${Math.min(index, 10)}" data-action="focus-cash-week" data-period="${week.id}" aria-label="${escapeHtml(`${week.label}. ${this.formatMoney(week.planned)} planned${week.startDate ? `, ${week.longDateLabel}` : ''}`)}"><span class="cash-column-date">${escapeHtml(week.startDate ? week.dateLabel : 'Relative')}</span><span class="cash-column-value">${week.planned > 0 ? this.formatMoney(week.planned) : '—'}</span><span class="cash-column-bars"><i style="height:${plannedHeight.toFixed(2)}%"></i><b style="height:${actualHeight.toFixed(2)}%"></b></span><span class="cash-column-stage">${stageLabel}</span><small>W${week.week}</small></button>`;
    }).join('');
    const connectionCopy = this.productionSchedule?.connected
      ? `${finite(this.productionSchedule.breakdownSceneCount)} breakdown scene${finite(this.productionSchedule.breakdownSceneCount) === 1 ? '' : 's'} · ${finite(this.productionSchedule.shootDays)} shoot day${finite(this.productionSchedule.shootDays) === 1 ? '' : 's'} · ${finite(this.productionSchedule.shootWeeks, 1)} shoot week${finite(this.productionSchedule.shootWeeks, 1) === 1 ? '' : 's'}`
      : 'Build the Script Breakdown and Stripboard to add scene and shoot-day context.';
    const dateCopy = this.productionSchedule?.shootStartDate
      ? `Production Calendar starts ${this.formatCalendarDate(this.productionSchedule.shootStartDate)}.`
      : 'Weeks are relative until Production Calendar dates are available.';
    const bridge = `<div class="cashflow-bridge"><span class="bridge-mark" aria-hidden="true"><svg viewBox="0 0 42 42" fill="none"><path d="M7 12h8v8H7zM27 22h8v8h-8zM15 16h7c4 0 5 4 5 7"/></svg></span><div><span>Connected workflow</span><h3>Script Breakdown → Stripboard → Budget Schedule</h3><p>${escapeHtml(connectionCopy)} ${escapeHtml(dateCopy)}</p></div><button type="button" data-view="breakdown">Edit schedules</button></div>`;
    const issueRows = [
      ...overScheduled.slice(0, 3).map((item) => `<button type="button" class="needs-row is-over" data-action="open-schedule" data-id="${item.id}"><span><small>${escapeHtml(item.code)} · Over scheduled</small><strong>${escapeHtml(item.name)}</strong></span><b>${this.formatMoney(item.overScheduled)}</b></button>`),
      ...needsScheduling.slice(0, Math.max(0, 6 - overScheduled.length)).map((item) => `<button type="button" class="needs-row" data-action="open-schedule" data-id="${item.id}"><span><small>${escapeHtml(item.code)} · Needs scheduling</small><strong>${escapeHtml(item.name)}</strong></span><b>${this.formatMoney(item.unscheduled)}</b></button>`),
    ].join('');
    const cashChecks = [
      undatedCashExpenses.length
        ? `<button type="button" class="cash-check" data-view="expenses"><span><strong>${undatedCashExpenses.length} payment${undatedCashExpenses.length === 1 ? '' : 's'} need a date</strong><small>Add payment dates to place actual cash by week.</small></span><b>Review</b></button>`
        : '',
      outsideTimelineExpenses.length
        ? `<button type="button" class="cash-check" data-view="expenses"><span><strong>${outsideTimelineExpenses.length} payment${outsideTimelineExpenses.length === 1 ? '' : 's'} outside the timeline</strong><small>Review the date or extend the Production Calendar.</small></span><b>Review</b></button>`
        : '',
    ].join('');
    const needsPanel = issueRows || cashChecks
      ? `${issueRows ? `<div class="needs-list">${issueRows}</div><button type="button" class="needs-more" data-view="breakdown">Review Budget Breakdown</button>` : ''}<div class="cash-checks">${cashChecks}</div>`
      : `<div class="needs-complete"><span aria-hidden="true">✓</span><strong>Every cash cost is placed</strong><p>The weekly plan matches the cash budget.</p></div>`;
    const attentionCount = needsScheduling.length + overScheduled.length + undatedCashExpenses.length + outsideTimelineExpenses.length;
    const weeklyRows = weeks.map((week, index) => {
      const focused = this.cashFlowFocusPeriod === week.id;
      const variance = week.planned - week.actual;
      const stageLabel = week.stage === 'shoot' ? 'Production' : week.stage === 'post' ? 'Postproduction' : week.stage === 'wrap' ? 'Wrap' : 'Preproduction';
      const shootContext = week.shootDetail
        ? `<span>${week.shootDetail.startDay === week.shootDetail.endDay ? `Shoot day ${week.shootDetail.startDay}` : `Shoot days ${week.shootDetail.startDay}–${week.shootDetail.endDay}`}${week.shootDetail.sceneCount ? ` · ${week.shootDetail.sceneCount} scene${week.shootDetail.sceneCount === 1 ? '' : 's'}` : ''}</span>`
        : '';
      const plannedRows = week.scheduledItems.map(({ item, amount }) => `<button type="button" class="week-item" data-action="open-schedule" data-id="${item.id}"><span><small>${escapeHtml(item.accountCode)} · ${escapeHtml(item.code)}</small><strong>${escapeHtml(item.name)}</strong></span><b>${this.formatMoney(amount)}</b><em>Edit schedule</em></button>`).join('');
      const actualRows = week.actualRows.map((expense) => `<div class="week-actual ${expense.isUnbudgeted ? 'is-unbudgeted' : ''}"><span><small>${escapeHtml(expense.paymentDate)} · ${escapeHtml(expense.isUnbudgeted ? 'Unexpected cost' : expense.lineItemCode)}</small><strong>${escapeHtml(expense.vendor || expense.concept || expense.lineItemName)}</strong></span><b>${this.formatMoney(expense.amount)}</b></div>`).join('');
      const plannedContent = plannedRows || '<div class="week-empty">No cash outflow scheduled in this week.</div>';
      const actualContent = this.productionSchedule?.shootStartDate
        ? actualRows || '<div class="week-empty">No dated expenses in this week.</div>'
        : '<div class="week-empty">Connect Production Calendar dates to compare actual payments by week.</div>';
      return `<details class="cash-week" style="--cash-index:${Math.min(index, 10)}" data-cash-week="${week.id}" ${focused ? 'open' : ''}><summary><span class="week-stage ${week.stage}">${stageLabel}</span><span class="week-name"><strong>${escapeHtml(week.label)}</strong><small>${escapeHtml(week.dateLabel)}</small>${shootContext}</span><span><small>Planned</small><strong>${this.formatMoney(week.planned)}</strong></span><span><small>Actual</small><strong>${this.productionSchedule?.shootStartDate ? this.formatMoney(week.actual) : '—'}</strong></span><span class="${variance < -0.005 ? 'negative' : ''}"><small>Variance</small><strong>${this.productionSchedule?.shootStartDate ? this.formatMoney(variance) : '—'}</strong></span></summary><div class="cash-week-body"><section><h4>Scheduled from Budget Breakdown</h4>${plannedContent}</section><section><h4>Actual payments</h4>${actualContent}</section></div></details>`;
    }).join('');
    const unscheduledLabel = computed.overScheduledCashTotal > 0.005 ? 'Over Scheduled' : 'Cash Unscheduled';
    const unscheduledValue = computed.overScheduledCashTotal > 0.005 ? computed.overScheduledCashTotal : computed.unscheduledCashTotal;
    const unscheduledNote = computed.overScheduledCashTotal > 0.005
      ? 'Rebalance highlighted cost items'
      : computed.unscheduledCashTotal > 0.005
        ? 'Still needs a production week'
        : 'Every cash cost has a week';
    const actualSpendNote = undatedCashExpenses.length
      ? `${datedCashExpenseCount} dated · ${undatedCashExpenses.length} need dates`
      : `${cashExpenseCount} dated payment${cashExpenseCount === 1 ? '' : 's'}`;
    const selectedWeekCount = this.cashFlowVisibleWeekCount > 0
      ? Math.min(allWeeks.length, this.cashFlowVisibleWeekCount)
      : allWeeks.length;
    const windowLabel = selectedWeekCount >= allWeeks.length
      ? `All ${allWeeks.length} weeks`
      : `${selectedWeekCount} of ${allWeeks.length} weeks`;
    const resultsLabel = this.cashFlowSearch.trim()
      ? `${weeks.length} matching week${weeks.length === 1 ? '' : 's'}${matchingUnplacedExpenses.length ? ` · ${matchingUnplacedExpenses.length} unplaced` : ''}`
      : windowLabel;
    const profileTools = `<div class="cash-profile-tools"><label class="cash-profile-search"><span>Find a cost or date</span><input type="search" data-cashflow-search value="${escapeHtml(this.cashFlowSearch)}" placeholder="Cost, vendor or date (YYYY-MM-DD)" aria-label="Search weekly cash flow"></label><label class="cash-profile-window"><span>Weeks visible <output data-cashflow-window-value>${escapeHtml(windowLabel)}</output></span><input type="range" min="1" max="${allWeeks.length}" value="${selectedWeekCount}" data-cashflow-window aria-label="Number of weeks visible" aria-valuetext="${escapeHtml(windowLabel)}" ${this.cashFlowSearch.trim() ? 'disabled' : ''}><small>${this.cashFlowSearch.trim() ? 'Search scans the full production timeline.' : 'Move left for a focused window; move right for every week.'}</small></label></div>`;
    const unplacedResults = matchingUnplacedExpenses.length
      ? `<div class="cash-unplaced-results"><span>Unplaced actual payments</span>${matchingUnplacedExpenses.map((expense) => `<button type="button" data-view="expenses"><span><small>${escapeHtml(expense.paymentDate || 'Date needed')} · ${escapeHtml(expense.isUnbudgeted ? 'Unexpected cost' : expense.lineItemCode)}</small><strong>${escapeHtml(expense.vendor || expense.concept || expense.lineItemName)}</strong></span><b>${this.formatMoney(expense.amount)}</b></button>`).join('')}</div>`
      : '';
    const chartContent = chartColumns
      ? `<div class="cash-chart-scroll"><div class="cash-chart" style="min-width:${chartWidth}px">${chartColumns}</div></div>${unplacedResults}`
      : unplacedResults || `<div class="cash-filter-empty"><strong>No weekly cash flow matches this search.</strong><span>Try a budget code, vendor, concept or a date inside the production timeline.</span></div>`;
    const ledgerContent = weeklyRows
      ? `<div class="cash-week-stack">${weeklyRows}</div>`
      : `<div class="cash-filter-empty ledger-filter-empty"><strong>No matching weeks.</strong><span>Clear the search to restore the complete weekly ledger.</span></div>`;
    return `<section class="view cashflow-view ${this.cashFlowSearch.trim() || selectedWeekCount < allWeeks.length ? 'is-filtered' : ''}" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Weekly timing</span><h2>Cash Flow</h2><p>See exactly when cash is planned to leave the production. Every amount comes from Schedule in Budget Breakdown.</p></div><span class="updated" aria-live="polite">${escapeHtml(resultsLabel)}</span></div>
      ${bridge}
      <div class="kpi-grid compact">${this.kpi('Cash Scheduled', this.moneyValue(computed.scheduledCashTotal), `${this.formatPercent(computed.cashTotal > 0 ? computed.scheduledCashTotal / computed.cashTotal : 0)} placed`, 'planned')}${this.kpi(unscheduledLabel, this.moneyValue(unscheduledValue), unscheduledNote, computed.overScheduledCashTotal > 0.005 ? 'danger' : 'warning')}${this.kpi('Peak Cash Week', this.moneyValue(peakWeek.planned), peakWeek.label || 'No scheduled week', 'remaining')}${this.kpi('Actual Cash Spend', this.moneyValue(computed.cashSpent), actualSpendNote, 'spent')}</div>
      <div class="cashflow-layout"><article class="panel cashflow-chart"><div class="panel-head"><div><span>Weekly profile</span><h3>Planned versus actual cash</h3></div><div class="cash-chart-key"><i></i>Planned <b></b>Actual</div></div>${profileTools}${chartContent}</article><article class="panel needs-panel"><div class="panel-head"><div><span>Attention</span><h3>Cash flow checks</h3></div><small>${attentionCount} issue${attentionCount === 1 ? '' : 's'}</small></div>${needsPanel}</article></div>
      <div class="table-card cashflow-ledger"><div class="table-title"><div><h3>Weekly Cash Ledger</h3><p>Open a week to see every scheduled cost and dated payment behind it.</p></div><span class="cash-ledger-note">${this.productionSchedule?.shootStartDate ? 'Calendar dates connected' : 'Relative weeks'}</span></div>${ledgerContent}</div>
    </section>`;
  }

  renderFinance(computed) {
    const sources = this.budget.fundingSources.map((source) => `<tr><td><input data-model="funding" data-id="${source.id}" data-field="name" value="${escapeHtml(source.name)}"></td><td><select data-model="funding" data-id="${source.id}" data-field="type"><option value="cash" ${source.type === 'cash' ? 'selected' : ''}>Cash</option><option value="in_kind" ${source.type === 'in_kind' ? 'selected' : ''}>In kind</option><option value="partner" ${source.type === 'partner' ? 'selected' : ''}>Partner</option></select></td><td><input type="number" min="0" step="0.01" data-model="funding" data-id="${source.id}" data-field="amount" value="${source.amount}"></td><td><input type="number" min="0" step="0.01" data-model="funding" data-id="${source.id}" data-field="paid" value="${source.paid}"></td><td><select data-model="funding" data-id="${source.id}" data-field="status">${['Planned','Pending','Partially paid','Received'].map((status) => `<option ${source.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></td><td><input type="date" data-model="funding" data-id="${source.id}" data-field="paymentDate" value="${escapeHtml(source.paymentDate)}"></td><td>${this.receiptControl('funding', source)}</td><td><button type="button" class="icon" data-action="remove-funding" data-id="${source.id}" aria-label="Delete contributor">×</button></td></tr>`).join('');
    const hasGap = computed.fundingGap > 0.005;
    const hasSurplus = computed.fundingGap < -0.005;
    const fundingLabel = hasGap ? 'Funding Gap' : hasSurplus ? 'Funding Surplus' : 'Fully Funded';
    const fundingNote = hasGap ? 'Still to finance' : hasSurplus ? 'Available above the plan' : 'Plan is fully financed';
    return `<section class="view" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Funding sources</span><h2>Finance Plan</h2><p>Track cash, in kind support, contributor status and received funding.</p></div></div>
      <div class="kpi-grid compact">${this.kpi('Cash Budget', this.moneyValue(computed.cashTotal), 'Costs paid in cash', 'planned')}${this.kpi('In Kind Budget', this.moneyValue(computed.inKindTotal), 'Contributed resources', 'remaining')}${this.kpi('Funding Planned', this.moneyValue(computed.fundingPlanned), `${this.formatMoney(computed.fundingReceived)} received`, 'funded')}${this.kpi(fundingLabel, this.moneyValue(Math.abs(computed.fundingGap)), fundingNote, hasGap ? 'warning' : 'funded')}</div>
      <div class="table-card"><div class="table-title"><div><h3>Contributors</h3><p>Planned and received funding with proof of payment.</p></div><button type="button" class="secondary" data-action="add-funding">Add contributor</button></div><div class="table-scroll"><table class="funding-table"><thead><tr><th>Contributor</th><th>Type</th><th>Planned</th><th>Received</th><th>Status</th><th>Payment Date</th><th>Proof</th><th></th></tr></thead><tbody>${sources || '<tr><td colspan="8" class="table-empty">No contributors yet. Add the first funding source.</td></tr>'}</tbody><tfoot><tr><td colspan="2">Total</td><td>${this.formatMoney(computed.fundingPlanned)}</td><td>${this.formatMoney(computed.fundingReceived)}</td><td colspan="4"></td></tr></tfoot></table></div></div>
    </section>`;
  }

  renderExpenses(computed) {
    const rows = computed.expenseRows.map((expense) => {
      const status = expense.isUnbudgeted ? 'unbudgeted' : expense.isOverBudget ? 'over' : 'within';
      const statusLabel = expense.isUnbudgeted ? 'Unexpected cost' : expense.isOverBudget ? 'Over budget' : 'Within budget';
      const lineTitle = expense.isUnbudgeted
        ? expense.lineItemCode
          ? `${expense.lineItemCode} · No approved amount`
          : 'Choose line or keep unexpected'
        : `${expense.lineItemCode} · ${expense.lineItemName}`;
      const balance = expense.isUnbudgeted ? -expense.amount : expense.lineBalance;
      return `<tr class="expense-row is-${status}"><td><input data-model="expense" data-id="${expense.id}" data-field="paymentNumber" value="${escapeHtml(expense.paymentNumber)}" aria-label="Payment number"></td><td><input type="date" data-model="expense" data-id="${expense.id}" data-field="paymentDate" value="${escapeHtml(expense.paymentDate)}" aria-label="Payment date"></td><td><button type="button" class="expense-line-button is-${status}" data-action="open-expense-picker" data-id="${expense.id}"><i aria-hidden="true"></i><span><small>${escapeHtml(statusLabel)}</small><strong>${escapeHtml(lineTitle)}</strong></span></button></td><td><input data-model="expense" data-id="${expense.id}" data-field="vendor" value="${escapeHtml(expense.vendor)}" placeholder="Vendor or beneficiary"></td><td><input data-model="expense" data-id="${expense.id}" data-field="concept" value="${escapeHtml(expense.concept)}" placeholder="${expense.isUnbudgeted ? 'Describe the unexpected cost' : 'What was paid'}"></td><td>${expense.isUnbudgeted ? '<span class="not-budgeted">Not budgeted</span>' : this.formatMoney(expense.budgeted)}</td><td><input type="number" min="0" step="0.01" inputmode="decimal" data-model="expense" data-id="${expense.id}" data-field="amount" value="${expense.amount}" aria-label="Amount paid"></td><td><span class="variance-badge is-${status}"><small>${escapeHtml(statusLabel)}</small><strong>${this.formatMoney(balance)}</strong></span></td><td>${this.receiptControl('expense', expense)}</td><td><button type="button" class="icon" data-action="remove-expense" data-id="${expense.id}" aria-label="Delete expense">×</button></td></tr>`;
    }).join('');
    const withinCount = computed.expenseRows.filter((expense) => !expense.isUnbudgeted && !expense.isOverBudget).length;
    const statusGuide = `<div class="expense-status-guide" aria-label="Expense status guide"><span class="is-within"><i></i><strong>Within budget</strong><small>${withinCount} payment${withinCount === 1 ? '' : 's'}</small></span><span class="is-over"><i></i><strong>Over budget</strong><small>${computed.overBudgetLineCount} line${computed.overBudgetLineCount === 1 ? '' : 's'}</small></span><span class="is-unbudgeted"><i></i><strong>Unexpected</strong><small>${computed.unbudgetedCount} payment${computed.unbudgetedCount === 1 ? '' : 's'}</small></span></div>`;
    const ledger = rows
      ? `<div class="table-card expense-card"><div class="table-title"><div><h3>Payment Ledger</h3><p>Compare every payment with its approved line. Unexpected costs stay visible instead of changing the approved budget.</p></div><span class="compression-note">Photos compress before upload</span></div>${statusGuide}<div class="table-scroll"><table class="expense-table"><thead><tr><th>Payment</th><th>Date</th><th>Budget Line</th><th>Vendor</th><th>Concept</th><th>Line Budget</th><th>Paid</th><th>Line Balance</th><th>Receipt</th><th></th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="6">Total Paid · ${escapeHtml(computed.remaining < 0 ? 'Overall over budget' : 'Overall remaining')}</td><td>${this.formatMoney(computed.spent)}</td><td>${this.formatMoney(computed.remaining)}</td><td colspan="2"></td></tr></tfoot></table></div></div>`
      : `<article class="panel ledger-empty"><span class="receipt-glyph" aria-hidden="true"><svg viewBox="0 0 42 42" fill="none"><path d="M12 6.5h18v29l-3-2-3 2-3-2-3 2-3-2-3 2zM16 15h10M16 20h10M16 25h6"/></svg></span><div><span class="eyebrow">Payment ledger</span><h3>No expenses yet</h3><p>Use Add expense when production spending begins. Receipt photos are compressed before upload.</p></div></article>`;
    return `<section class="view expenses-view" role="tabpanel" tabindex="0"><div class="section-head"><div><span class="eyebrow">Actuals</span><h2>Expense Report</h2><p>See what was paid, what exceeded the plan and which costs appeared during production.</p></div><button type="button" class="primary" data-action="add-expense">Add expense</button></div>
      <div class="kpi-grid compact">${this.kpi('Approved Budget', this.moneyValue(computed.total), 'Budget Breakdown total', 'planned')}${this.kpi('Total Paid', this.moneyValue(computed.spent), `${computed.expenseRows.length} payment${computed.expenseRows.length === 1 ? '' : 's'}`, 'spent')}${this.kpi('Over Budget', this.moneyValue(computed.overBudgetSpent), `${computed.overBudgetLineCount} approved line${computed.overBudgetLineCount === 1 ? '' : 's'} exceeded`, computed.overBudgetSpent > 0.005 ? 'danger' : 'remaining')}${this.kpi('Unexpected Costs', this.moneyValue(computed.unbudgetedSpent), `${computed.unbudgetedCount} not in the approved plan`, computed.unbudgetedSpent > 0.005 ? 'warning' : 'funded')}</div>
      ${ledger}
    </section>`;
  }

  renderExpensePicker(computed) {
    if (!this.expensePickerId) return '';
    const expense = computed.expenseRows.find((row) => row.id === this.expensePickerId);
    if (!expense) return '';
    const query = this.expenseLineSearch.trim().toLocaleLowerCase(this.locale());
    const populatedItems = computed.accounts.flatMap((account) => account.items)
      .filter((item) => item.calculation !== 'contingency' && item.total > 0.005)
      .filter((item) => !query || `${item.code} ${item.name} ${item.accountCode} ${item.accountName}`.toLocaleLowerCase(this.locale()).includes(query))
      .slice(0, 160);
    const options = populatedItems.map((item) => {
      const selected = expense.lineItemId === item.id && !expense.isUnbudgeted;
      const availability = item.remaining < -0.005
        ? `Over by ${this.formatMoney(Math.abs(item.remaining))}`
        : item.remaining <= 0.005
          ? 'Fully used'
          : `${this.formatMoney(item.remaining)} available`;
      return `<button type="button" class="expense-line-option ${selected ? 'is-selected' : ''} ${item.remaining < -0.005 ? 'is-over' : ''}" data-action="select-expense-line" data-id="${expense.id}" data-line-id="${item.id}"><span><small>${escapeHtml(item.accountCode)} · ${escapeHtml(item.accountName)}</small><strong>${escapeHtml(item.code)} · ${escapeHtml(item.name)}</strong></span><span><small>${escapeHtml(availability)}</small><b>${this.formatMoney(item.total)}</b></span></button>`;
    }).join('');
    const resultNote = query
      ? `${populatedItems.length} matching budget line${populatedItems.length === 1 ? '' : 's'}`
      : `${populatedItems.length} approved budget line${populatedItems.length === 1 ? '' : 's'}`;
    return `<div class="modal-backdrop" role="presentation"><div class="schedule-modal expense-picker-modal" role="dialog" aria-modal="true" aria-labelledby="expense-picker-title"><div class="modal-head"><div><span>Payment ${escapeHtml(expense.paymentNumber || '')}</span><h3 id="expense-picker-title">Choose a budget line</h3><p>Only cost items with an approved amount in Budget Breakdown appear here.</p></div><button type="button" class="icon" data-action="close-expense-picker" aria-label="Close budget line picker">×</button></div><div class="expense-picker-search"><label><span>Search approved costs</span><input type="search" data-expense-line-search value="${escapeHtml(this.expenseLineSearch)}" placeholder="Code, account or cost item"></label><small aria-live="polite">${escapeHtml(resultNote)}</small></div><button type="button" class="unexpected-option ${expense.isUnbudgeted ? 'is-selected' : ''}" data-action="select-expense-line" data-id="${expense.id}" data-line-id=""><i aria-hidden="true">+</i><span><strong>Record as unexpected cost</strong><small>No approved line. Enter the vendor, concept and amount manually.</small></span><b>${expense.isUnbudgeted ? 'Selected' : 'Choose'}</b></button><div class="expense-line-results">${options || '<div class="expense-picker-empty"><strong>No approved lines match.</strong><span>Try another search or record this as an unexpected cost.</span></div>'}</div><div class="modal-foot"><span>Changing the link never changes the approved budget.</span><button type="button" class="primary" data-action="close-expense-picker">Done</button></div></div></div>`;
  }

  renderImportModal() {
    if (!this.importOpen) return '';
    const T = (value) => escapeHtml(this.displayLabel(value));
    const preview = this.importPreview;
    const rows = preview?.proposal?.accounts?.flatMap((account) => account.items.map((item) => ({ ...item, account }))) || [];
    const previewRows = rows.slice(0, 80).map((row) => `<tr><td><span class="account-code">${escapeHtml(row.account.code)}</span></td><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.code)}</small></td><td>${escapeHtml(String(row.quantity))}</td><td>${escapeHtml(row.unit || 'flat')}</td><td>${this.formatMoney(row.unitCost)}</td><td>${escapeHtml(row.account.name)}</td></tr>`).join('');
    const warningList = preview?.proposal?.warnings?.length
      ? `<div class="import-warnings"><strong>Review notes</strong>${preview.proposal.warnings.map((warning) => `<span>• ${escapeHtml(warning)}</span>`).join('')}</div>`
      : '';
    if (preview) {
      const count = preview.counts?.items || 0;
      const foundMessage = T('Lumiere found {count} cost items. Nothing is saved until you confirm.').replace('{count}', String(count));
      const importMessage = T('Import {count} items').replace('{count}', String(count));
      return `<div class="modal-backdrop" role="presentation"><div class="schedule-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="budget-import-title"><div class="modal-head"><div><span>${T('Preview')} · ${escapeHtml(preview.source?.filename || 'Budget source')}</span><h3 id="budget-import-title">${T('Review imported budget')}</h3><p>${foundMessage}</p></div><button type="button" class="icon" data-action="close-import" aria-label="${T('Close budget import')}">×</button></div><div class="import-summary"><div><span>${T('Accounts')}</span><strong>${preview.counts?.accounts || 0}</strong></div><div><span>${T('Cost items')}</span><strong>${count}</strong></div><div><span>${T('Budget total after import')}</span><strong>${this.formatMoney(preview.computedPreview?.total || 0)}</strong></div></div>${warningList}<div class="import-preview-scroll"><table class="import-preview-table"><thead><tr><th>${T('Account')}</th><th>${T('Cost item')}</th><th>${T('Qty')}</th><th>${T('Unit')}</th><th>${T('Unit cost')}</th><th>${T('Mapped to')}</th></tr></thead><tbody>${previewRows || `<tr><td colspan="6" class="table-empty">${T('No cost items were confidently mapped.')}</td></tr>`}</tbody></table></div><div class="modal-foot"><button type="button" class="secondary" data-action="reset-import">${T('Choose another source')}</button><div class="schedule-actions"><button type="button" class="primary" data-action="commit-import">${importMessage}</button></div></div></div></div>`;
    }
    const fileName = this.importFile?.name || 'No file selected';
    const busy = this.importBusy ? '<span class="import-spinner" aria-hidden="true"></span>' : '';
    const description = T('Bring in a PDF, Excel, CSV, DOCX, text file or a shared Google Doc. Lumiere maps it to Budget Breakdown, Cash Flow, Finance and Expenses.');
    return `<div class="modal-backdrop" role="presentation"><div class="schedule-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="budget-import-title"><div class="modal-head"><div><span>${T('Connected production')}</span><h3 id="budget-import-title">${T('Import Budget')}</h3><p>${description}</p></div><button type="button" class="icon" data-action="close-import" aria-label="${T('Close budget import')}">×</button></div><div class="import-body"><label class="import-dropzone"><input type="file" data-import-file accept=".pdf,.xlsx,.xls,.csv,.tsv,.txt,.md,.docx,text/plain,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document"><span class="import-file-icon">↑</span><strong>${escapeHtml(fileName === 'No file selected' ? this.displayLabel(fileName) : fileName)}</strong><small>${T('Choose a file up to 10 MB')}</small></label><div class="import-or"><span>${T('or')}</span></div><label class="import-url"><span>${T('Shared Google Docs link')}</span><input type="url" data-import-url value="${escapeHtml(this.importUrl)}" placeholder="https://docs.google.com/document/d/..." autocomplete="url"><small>${T('Set sharing to “Anyone with the link” so Lumiere can read it.')}</small></label>${this.importError ? `<div class="notice error" role="alert">${escapeHtml(this.importError)}</div>` : ''}</div><div class="modal-foot"><span>${busy ? T('Lumiere is reading the source…') : T('You will review every mapped line before it is saved.')}</span><div class="schedule-actions"><button type="button" class="secondary" data-action="close-import" ${this.importBusy ? 'disabled' : ''}>${T('Cancel')}</button><button type="button" class="primary import-analyze" data-action="analyze-import" ${this.importBusy ? 'disabled' : ''}>${busy}${T('Analyze with Lumiere')}</button></div></div></div></div>`;
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
      const managed = field === 'shootingDates' && this.calendarConnected;
      return `<label><span>${label}${managed ? '<small class="calendar-managed">Managed in Calendar</small>' : ''}</span><input data-model="metadata" data-field="${field}" value="${escapeHtml(this.budget.metadata[field])}" placeholder="${examples[field] || label}" ${managed ? 'disabled title="Managed in Calendar"' : ''}></label>`;
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
    const weeks = new Map(this.cashFlowWeeks(computed).map((week) => [week.id, week]));
    const stages = [
      ['prep', 'Preproduction'],
      ['shoot', 'Production'],
      ['wrap', 'Wrap'],
      ['post', 'Postproduction'],
    ];
    const stageGroups = stages.map(([stageId, stageLabel]) => {
      const periods = this.budget.periods.filter((period) => period.stage === stageId);
      if (!periods.length) return '';
      const inputs = periods.map((period) => {
        const otherScheduled = Math.max(0, row.scheduled - finite(found.item.schedule?.[period.id]));
        const maximum = Math.max(0, row.total - otherScheduled);
        const dateLabel = weeks.get(period.id)?.startDate ? weeks.get(period.id).dateLabel : '';
        return `<label><span>${escapeHtml(period.label)}${dateLabel ? `<small>${escapeHtml(dateLabel)}</small>` : ''}</span><input class="manual-number" type="number" min="0" max="${maximum}" step="0.01" inputmode="decimal" data-model="schedule" data-id="${row.id}" data-period="${period.id}" value="${finite(found.item.schedule?.[period.id])}"></label>`;
      }).join('');
      return `<section class="schedule-stage"><div class="schedule-stage-head"><span class="week-stage ${stageId}">${stageLabel}</span><small>${periods.length} week${periods.length === 1 ? '' : 's'}</small></div><div class="schedule-grid">${inputs}</div></section>`;
    }).join('');
    const differenceLabel = row.overScheduled > 0.005 ? 'Over scheduled' : 'Unscheduled';
    const differenceValue = row.overScheduled > 0.005 ? row.overScheduled : row.unscheduled;
    const differenceClass = row.overScheduled > 0.005 ? 'negative' : '';
    const fundingNote = row.fundingKind === 'in_kind'
      ? '<div class="schedule-warning">This is an in-kind cost. It stays on the production timeline but is excluded from cash totals.</div>'
      : '';
    return `<div class="modal-backdrop" role="presentation"><div class="schedule-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-title"><div class="modal-head"><div><span>${escapeHtml(row.code)}</span><h3 id="schedule-title">Schedule ${escapeHtml(row.name)}</h3><p>Place this budget line in the weeks when the production expects to use the money.</p></div><button type="button" class="icon" data-action="close-schedule" aria-label="Close schedule">×</button></div><div class="schedule-summary"><div><span>Budget</span><strong>${this.formatMoney(row.total)}</strong></div><div><span>Scheduled</span><strong>${this.formatMoney(row.scheduled)}</strong></div><div><span>${differenceLabel}</span><strong class="${differenceClass}">${this.formatMoney(differenceValue)}</strong></div></div>${fundingNote}<div class="schedule-stages">${stageGroups}</div><div class="modal-foot"><span>${escapeHtml(this.saveStatus || this.uploadStatus || 'Changes save automatically')}</span><div class="schedule-actions"><button type="button" class="secondary" data-action="clear-schedule" data-id="${row.id}">Clear</button><button type="button" class="secondary" data-action="auto-schedule" data-id="${row.id}">Auto schedule</button><button type="button" class="primary" data-action="close-schedule">Done</button></div></div></div></div>`;
  }

  styles() {
    return `<style>
      :host{--fs-font-text:"SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;--fs-font-display:"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
      :host,:host *{font-family:var(--fs-font-text)!important}
      :host h1,:host h2,:host h3,:host h4,:host h5,:host h6{font-family:var(--fs-font-display)!important}:host h1,:host h2{font-weight:900!important}:host h3{font-weight:800!important}
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
      th,td{vertical-align:middle}.table-card table td{text-align:left}input[type="number"]{text-align:right;font-variant-numeric:tabular-nums}.fs-budget input[type="number"],.fs-budget .manual-number{-moz-appearance:textfield;-webkit-appearance:none!important;appearance:textfield}.fs-budget input[type="number"]::-webkit-inner-spin-button,.fs-budget input[type="number"]::-webkit-outer-spin-button,.fs-budget .manual-number::-webkit-inner-spin-button,.fs-budget .manual-number::-webkit-outer-spin-button{-webkit-appearance:none!important;display:none!important;margin:0}
      .summary-table th:first-child,.summary-table td:first-child{width:106px;text-align:left}.summary-table thead th:nth-child(n+3),.summary-table tbody td:nth-child(n+3){text-align:right}.summary-table th:last-child,.summary-table td:last-child{min-width:126px;white-space:nowrap}.summary-table tfoot td:first-child{text-align:left}.summary-table tfoot td:not(:first-child){text-align:right}
      .breakdown-table th,.breakdown-table td{text-align:left}.breakdown-table th:nth-child(3),.breakdown-table th:nth-child(5),.breakdown-table th:nth-child(6),.breakdown-table th:nth-child(10),.breakdown-table th:nth-child(11),.breakdown-table th:nth-child(12),.breakdown-table td:nth-child(3),.breakdown-table td:nth-child(5),.breakdown-table td:nth-child(6),.breakdown-table td:nth-child(10),.breakdown-table td:nth-child(11),.breakdown-table td:nth-child(12){text-align:right}.breakdown-table th:nth-child(10),.breakdown-table td:nth-child(10),.breakdown-table th:nth-child(11),.breakdown-table td:nth-child(11),.breakdown-table th:nth-child(12),.breakdown-table td:nth-child(12){min-width:116px;width:116px;white-space:nowrap}.breakdown-table th:nth-child(12){min-width:126px;width:126px}.breakdown-table td:nth-child(12){white-space:nowrap}.breakdown-table th:nth-child(13),.breakdown-table th:nth-child(14),.breakdown-table td:nth-child(13),.breakdown-table td:nth-child(14){text-align:center}
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
      @keyframes budgetCashColumnIn{from{transform:scaleY(0)}to{transform:scaleY(1)}}
      @keyframes budgetStrokeIn{from{stroke-dashoffset:120}to{stroke-dashoffset:0}}
      @keyframes budgetLineIn{from{opacity:0;transform:scaleX(.3) rotate(-.05deg)}to{opacity:1;transform:scaleX(1) rotate(-.05deg)}}
      @keyframes budgetStatusIn{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
      @keyframes budgetBackdropIn{from{opacity:0}to{opacity:1}}
      @keyframes budgetModalIn{from{opacity:0;transform:translateY(7px) scale(.985)}to{opacity:1;transform:none}}
      .tabs button{transition:color .14s ease,background-color .14s ease,border-color .14s ease,box-shadow .14s ease,transform .12s cubic-bezier(.2,.8,.2,1)}.tabs button:hover{background:color-mix(in srgb,var(--surface,#FFFEF9) 72%,transparent);color:var(--ink,#2C2C2A);transform:translateY(-1px)}.tabs button:active{transform:scale(.97)}.tabs button.is-switching{animation:budgetTabIn .16s cubic-bezier(.2,.8,.2,1) both}
      .view.is-entering .section-head{animation:budgetElementIn .18s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .kpi,.view.is-entering .phase-card,.view.is-entering .visual-grid>*{animation:budgetElementIn .22s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .kpi-grid>:nth-child(2),.view.is-entering .phase-card-grid>:nth-child(2){animation-delay:.025s}.view.is-entering .kpi-grid>:nth-child(3),.view.is-entering .phase-card-grid>:nth-child(3){animation-delay:.05s}.view.is-entering .kpi-grid>:nth-child(4),.view.is-entering .phase-card-grid>:nth-child(4){animation-delay:.075s}.view.is-entering .visual-grid>:nth-child(1){animation-delay:.055s}.view.is-entering .visual-grid>:nth-child(2){animation-delay:.08s}.view.is-entering .table-card,.view.is-entering .account-stack,.view.is-entering .settings-grid,.view.is-entering .filters{animation:budgetElementIn .22s .07s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .insight{animation:budgetElementIn .2s .1s cubic-bezier(.2,.8,.2,1) both}
      .view.is-entering .donut{animation:budgetScaleIn .24s .06s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .donut:before{animation:budgetDonutLoad .68s .08s cubic-bezier(.65,0,.35,1) both}.view.is-entering .bar i,.view.is-entering .cash-period b{transform-origin:left;animation:budgetChartIn .24s .09s cubic-bezier(.2,.8,.2,1) both}.view.is-entering .budget-glyph svg path{stroke-dasharray:120;animation:budgetStrokeIn .24s ease-out both}.view.is-entering .table-title:after{transform-origin:left;animation:budgetLineIn .22s .08s cubic-bezier(.2,.8,.2,1) both}
      .view.is-entering .cash-column-bars i,.view.is-entering .cash-column-bars b{transform-origin:bottom;animation:budgetCashColumnIn .34s .08s cubic-bezier(.2,.8,.2,1) both}
      .budget-actions span:not(:empty){animation:budgetStatusIn .14s ease-out both}tbody tr{transition:background-color .12s ease}.account summary{transition:background-color .14s ease}.account summary:hover{background:color-mix(in srgb,var(--soft,#EFEBE1) 72%,transparent)}input,select{transition:border-color .14s ease,box-shadow .14s ease,background-color .14s ease}.kpi:after,.panel:after,.table-card:after,.account:after{transition:opacity .18s ease,transform .18s cubic-bezier(.2,.8,.2,1)}.export:active,.primary:active,.secondary:active,.mini:active,.icon:active,.add-row:active{transform:translateY(0) scale(.97)}
      .budget-nav{margin-bottom:24px;padding:10px 0;background:color-mix(in srgb,var(--bg,#F5F0E8) 96%,transparent);backdrop-filter:blur(10px)}.tabs button{padding-inline:12px}.phase-card-grid{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
      .chart-empty-copy{display:grid!important;grid-template-columns:1fr!important;gap:5px!important;padding:16px 0;color:var(--muted,#888780)}.chart-empty-copy strong{font-size:11px!important;color:var(--ink,#2C2C2A)}.chart-empty-copy span{font-size:10.5px!important}.chart-empty-copy.centered{align-content:center;min-height:126px;text-align:center}
      .phase-overview-empty{display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:14px 16px;border:1px dashed color-mix(in srgb,var(--ink,#2C2C2A) 28%,transparent);border-radius:13px 11px 15px 10px;background:color-mix(in srgb,var(--surface,#FFFEF9) 74%,transparent)}.phase-overview-empty strong{font-size:11px}.phase-overview-empty span{font-size:10.5px;color:var(--muted,#888780)}.summary-toggle{min-height:34px;font-size:10.5px}.summary-empty{display:grid;justify-items:center;padding:42px 24px 46px;text-align:center}.summary-empty .empty-mark{position:relative;width:36px;height:30px;margin-bottom:4px;border:1.5px solid var(--accent,#FFB703);border-radius:8px 10px 7px 9px;transform:rotate(-1deg)}.summary-empty .empty-mark:before,.summary-empty .empty-mark:after{content:"";position:absolute;left:7px;right:7px;border-top:1.5px solid var(--accent,#FFB703)}.summary-empty .empty-mark:before{top:9px}.summary-empty .empty-mark:after{top:17px;right:13px}.summary-empty strong{margin-top:10px;font-size:15px}.summary-empty p{max-width:390px;margin:7px 0 0;color:var(--muted,#888780);font-size:11.5px;line-height:1.5}.summary-empty .primary{margin-top:17px}
      .account summary{position:relative;padding-right:44px}.account summary:after{content:"";position:absolute;right:20px;width:7px;height:7px;border-right:1.5px solid var(--accent,#FFB703);border-bottom:1.5px solid var(--accent,#FFB703);transform:rotate(45deg);transition:transform .16s cubic-bezier(.2,.8,.2,1)}.account[open] summary:after{transform:rotate(225deg) translate(-2px,-2px)}.account summary>div:last-child{margin-left:auto}.account-detail{transform-origin:top;animation:budgetDetailIn .18s cubic-bezier(.2,.8,.2,1) both}@keyframes budgetDetailIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
      .cashflow-empty,.ledger-empty{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:18px;margin-top:14px;padding:24px}.cashflow-empty h3,.ledger-empty h3{margin-top:5px;font-size:17px}.cashflow-empty p,.ledger-empty p{max-width:620px;margin:7px 0 0;color:var(--muted,#888780);font-size:11.5px;line-height:1.5}.timeline-glyph,.receipt-glyph{display:grid;place-items:center;width:48px;height:48px;color:var(--accent,#FFB703)}.timeline-glyph svg,.receipt-glyph svg{width:42px;height:42px;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.ledger-empty{grid-template-columns:auto 1fr;margin-top:2px;min-height:154px}.ledger-empty:before{content:"";position:absolute;left:25px;right:28px;bottom:17px;border-bottom:1px solid color-mix(in srgb,var(--accent,#FFB703) 42%,transparent);border-radius:50%;transform:rotate(-.2deg)}.tax-layout,.tax-layout>*{min-width:0}.table-card .tax-table{min-width:0;table-layout:fixed}
      .cashflow-bridge{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:15px;margin-bottom:18px;padding:15px 17px;border:1px solid color-mix(in srgb,var(--accent,#FFB703) 78%,var(--ink,#2C2C2A));border-radius:15px 12px 17px 11px / 12px 16px 11px 15px;background:var(--accent-soft,rgba(255,183,3,.13));overflow:hidden}.cashflow-bridge:after{content:"";position:absolute;inset:3px 5px 4px 3px;pointer-events:none;border:1px solid color-mix(in srgb,var(--accent,#FFB703) 48%,transparent);border-radius:12px 10px 14px 9px;transform:rotate(-.05deg)}.bridge-mark{display:grid;place-items:center;width:42px;height:42px;color:var(--accent,#FFB703)}.bridge-mark svg{width:37px;height:37px;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.cashflow-bridge>div>span{font-size:9px;font-weight:850;letter-spacing:1.25px;text-transform:uppercase;color:var(--accent,#BA7517)}.cashflow-bridge h3{font-size:14px}.cashflow-bridge p{margin:5px 0 0;color:var(--muted,#888780);font-size:10.5px;line-height:1.45}.cashflow-bridge button,.needs-more{position:relative;z-index:5;min-height:36px;padding:0 10px;border:0;background:transparent;color:var(--accent,#BA7517);font-size:10.5px;font-weight:800;cursor:pointer;white-space:nowrap}
      .cashflow-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr);gap:14px;margin-bottom:14px}.cashflow-chart{min-width:0}.cash-chart-key{display:flex;align-items:center;gap:6px;color:var(--muted,#888780);font-size:9px;white-space:nowrap}.cash-chart-key i,.cash-chart-key b{display:inline-block;width:9px;height:9px;border-radius:3px}.cash-chart-key i{background:var(--accent,#FFB703)}.cash-chart-key b{margin-left:5px;background:var(--ink,#2C2C2A)}.cash-chart-scroll{margin-top:18px;padding:2px 1px 7px;overflow-x:auto;scrollbar-width:thin}.cash-chart{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(52px,1fr);align-items:end;height:226px}.cash-column{position:relative;display:grid;grid-template-rows:28px 148px 18px 15px;align-items:end;min-width:0;height:220px;padding:0 5px 3px;border:0;border-radius:10px 8px 12px 7px;background:transparent;color:inherit;cursor:pointer}.cash-column:hover,.cash-column.is-focused{background:color-mix(in srgb,var(--accent-soft,rgba(255,183,3,.13)) 70%,transparent)}.cash-column.is-focused{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent,#FFB703) 58%,transparent)}.cash-column:focus-visible{outline-offset:-1px}.cash-column-value{align-self:start;overflow:hidden;color:var(--muted,#888780);font-size:7.5px;font-weight:750;text-align:center;text-overflow:ellipsis;white-space:nowrap}.cash-column-bars{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:3px;height:145px;border-bottom:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 22%,transparent)}.cash-column-bars i,.cash-column-bars b{display:block;min-height:0;border-radius:5px 5px 1px 1px}.cash-column-bars i{width:12px;background:var(--accent,#FFB703)}.cash-column-bars b{width:6px;background:var(--ink,#2C2C2A);opacity:.84}.cash-column-stage{align-self:end;overflow:hidden;font-size:8.5px;font-weight:800;text-align:center;text-overflow:ellipsis;white-space:nowrap}.cash-column small{align-self:end;color:var(--muted,#888780);font-size:8px;text-align:center}
      .needs-panel{min-height:302px}.needs-panel .panel-head{align-items:center}.needs-list{display:grid;gap:7px;margin-top:15px}.needs-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;min-height:47px;padding:8px 9px;border:1px solid var(--hair,#E7E4DA);border-radius:10px 8px 11px 7px;background:color-mix(in srgb,var(--soft,#EFEBE1) 70%,transparent);text-align:left;cursor:pointer}.needs-row:hover{border-color:color-mix(in srgb,var(--accent,#FFB703) 55%,var(--hair,#E7E4DA))}.needs-row.is-over{border-color:color-mix(in srgb,#C74440 42%,var(--hair,#E7E4DA));background:rgba(199,68,64,.08)}.needs-row span,.needs-row strong,.needs-row small{display:block;min-width:0}.needs-row small{color:var(--muted,#888780);font-size:8px}.needs-row strong{margin-top:3px;overflow:hidden;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.needs-row b{font-size:9.5px;font-variant-numeric:tabular-nums}.needs-more{margin-top:7px;padding-left:1px}.needs-complete{display:grid;justify-items:center;align-content:center;min-height:218px;text-align:center}.needs-complete>span{display:grid;place-items:center;width:42px;height:42px;border:1px solid #5B7A4A;border-radius:50%;color:#5B7A4A;font-size:20px}.needs-complete strong{margin-top:11px;font-size:12px}.needs-complete p{margin:5px 0 0;color:var(--muted,#888780);font-size:10px}
      .cash-checks{display:grid;gap:7px;margin-top:10px}.cash-check{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;min-height:49px;padding:8px 9px;border:1px dashed color-mix(in srgb,var(--accent,#FFB703) 58%,var(--hair,#E7E4DA));border-radius:10px 8px 11px 7px;background:var(--accent-soft,rgba(255,183,3,.13));text-align:left;cursor:pointer}.cash-check span,.cash-check strong,.cash-check small{display:block;min-width:0}.cash-check strong{font-size:9.5px}.cash-check small{margin-top:3px;color:var(--muted,#888780);font-size:8px;line-height:1.35}.cash-check b{color:var(--accent,#BA7517);font-size:8.5px}
      .cashflow-ledger{margin-top:14px}.cash-ledger-note{padding:6px 9px;border:1px solid color-mix(in srgb,var(--accent,#FFB703) 45%,var(--hair,#E7E4DA));border-radius:999px;background:var(--accent-soft,rgba(255,183,3,.13));color:var(--accent,#BA7517);font-size:8.5px;font-weight:800}.cash-week-stack{display:grid}.cash-week{border-bottom:1px solid var(--hair,#E7E4DA)}.cash-week:last-child{border-bottom:0}.cash-week summary{position:relative;display:grid;grid-template-columns:90px minmax(220px,1fr) repeat(3,minmax(90px,110px));align-items:center;gap:12px;min-height:67px;padding:11px 44px 11px 16px;cursor:pointer;list-style:none}.cash-week summary::-webkit-details-marker{display:none}.cash-week summary:after{content:"";position:absolute;right:21px;width:7px;height:7px;border-right:1.5px solid var(--accent,#FFB703);border-bottom:1.5px solid var(--accent,#FFB703);transform:rotate(45deg);transition:transform .16s cubic-bezier(.2,.8,.2,1)}.cash-week[open] summary:after{transform:rotate(225deg) translate(-2px,-2px)}.cash-week summary:hover{background:color-mix(in srgb,var(--soft,#EFEBE1) 66%,transparent)}.week-stage{display:inline-grid;place-items:center;justify-self:start;min-height:25px;padding:0 8px;border-radius:8px 7px 9px 6px;background:var(--soft,#EFEBE1);font-size:8px;font-weight:850;white-space:nowrap}.week-stage.prep{color:#9A651B;background:rgba(186,117,23,.12)}.week-stage.shoot{color:#416536;background:rgba(91,122,74,.13)}.week-stage.wrap{color:#725072;background:rgba(138,90,138,.12)}.week-stage.post{color:#3E607E;background:rgba(74,107,138,.13)}.week-name strong,.week-name small,.week-name>span,.cash-week summary>span>small,.cash-week summary>span>strong{display:block}.week-name>strong{font-size:11.5px}.week-name small,.week-name>span,.cash-week summary>span>small{margin-top:3px;color:var(--muted,#888780);font-size:8.5px;line-height:1.3}.cash-week summary>span:nth-last-child(-n+3){text-align:right}.cash-week summary>span:nth-last-child(-n+3)>strong{margin-top:4px;font-size:10.5px;font-variant-numeric:tabular-nums}.cash-week-body{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:2px 16px 17px 118px;background:color-mix(in srgb,var(--soft,#EFEBE1) 52%,transparent)}.cash-week-body h4{margin:12px 0 7px;font-size:9px;letter-spacing:.75px;text-transform:uppercase}.week-item,.week-actual{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:9px;width:100%;min-height:43px;padding:7px 8px;border:0;border-bottom:1px solid var(--hair,#E7E4DA);background:transparent;text-align:left}.week-item{cursor:pointer}.week-item:hover{background:var(--surface,#FFFEF9)}.week-item span,.week-item strong,.week-item small,.week-actual span,.week-actual strong,.week-actual small{display:block;min-width:0}.week-item small,.week-actual small{color:var(--muted,#888780);font-size:8px}.week-item strong,.week-actual strong{margin-top:2px;overflow:hidden;font-size:9.5px;text-overflow:ellipsis;white-space:nowrap}.week-item b,.week-actual b{font-size:9px;font-variant-numeric:tabular-nums}.week-item em{color:var(--accent,#BA7517);font-size:8px;font-style:normal;font-weight:800}.week-actual{grid-template-columns:minmax(0,1fr) auto}.week-empty{padding:14px 8px;color:var(--muted,#888780);font-size:9.5px}
      .schedule-modal{width:min(860px,100%)}.schedule-stages{display:grid}.schedule-stage{border-top:1px solid var(--hair,#E7E4DA)}.schedule-stage:first-child{border-top:0}.schedule-stage-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px 0}.schedule-stage-head small{color:var(--muted,#888780);font-size:9px}.schedule-stage .schedule-grid{grid-template-columns:repeat(auto-fit,minmax(165px,1fr));padding:12px 20px 18px}.schedule-stage .schedule-grid label>span{display:flex;align-items:flex-start;justify-content:space-between;gap:7px}.schedule-stage .schedule-grid label>span>small{color:var(--muted,#888780);font-size:7.5px;font-weight:500;text-align:right}.schedule-warning{margin:14px 20px 0;padding:10px 12px;border:1px solid color-mix(in srgb,var(--accent,#FFB703) 46%,var(--hair,#E7E4DA));border-radius:10px 8px 11px 7px;background:var(--accent-soft,rgba(255,183,3,.13));color:var(--muted,#888780);font-size:9.5px;line-height:1.45}.schedule-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px}.schedule-actions .secondary,.schedule-actions .primary{min-height:36px;font-size:10px}.import-trigger{min-height:40px}.import-modal{width:min(980px,100%);max-height:min(840px,92vh)}.import-body{padding:20px}.import-dropzone{display:grid;justify-items:center;gap:7px;padding:30px 20px;border:1px dashed color-mix(in srgb,var(--accent,#FFB703) 70%,var(--hair,#E7E4DA));border-radius:15px 12px 16px 11px;background:var(--accent-soft,rgba(255,183,3,.08));cursor:pointer;text-align:center}.import-dropzone input{display:none}.import-file-icon{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--accent,#FFB703);border-radius:10px;color:var(--accent,#FFB703);font-size:20px;font-weight:700}.import-dropzone strong{font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis}.import-dropzone small,.import-url small{color:var(--muted,#888780);font-size:9.5px}.import-or{display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--muted,#888780);font-size:10px}.import-or:before,.import-or:after{content:"";height:1px;flex:1;background:var(--hair,#E7E4DA)}.import-or span{padding:0 4px}.import-url{display:grid;gap:7px}.import-url>span{font-size:9.5px;font-weight:750;color:var(--muted,#888780)}.import-url input{width:100%;background:var(--surface,#FFFEF9)}.import-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px 20px;background:var(--soft,#EFEBE1)}.import-summary div{padding:11px;background:var(--surface,#FFFEF9);border:1px solid var(--hair,#E7E4DA);border-radius:9px}.import-summary span,.import-summary strong{display:block}.import-summary span{font-size:9.5px;color:var(--muted,#888780)}.import-summary strong{margin-top:6px;font-size:15px}.import-preview-scroll{max-height:380px;overflow:auto}.import-preview-table{width:100%;min-width:720px;border-collapse:collapse}.import-preview-table th,.import-preview-table td{padding:9px 11px;text-align:left;vertical-align:middle}.import-preview-table td strong,.import-preview-table td small{display:block}.import-preview-table td small{margin-top:3px;color:var(--muted,#888780);font-size:8.5px}.import-warnings{display:grid;gap:5px;margin:14px 20px 0;padding:11px 13px;border:1px solid color-mix(in srgb,var(--accent,#FFB703) 45%,var(--hair,#E7E4DA));border-radius:10px;background:var(--accent-soft,rgba(255,183,3,.09));font-size:9.5px;line-height:1.35}.import-warnings strong{font-size:10px}.import-spinner{display:inline-block;width:12px;height:12px;margin-right:5px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;vertical-align:-2px;animation:spin .7s linear infinite}.import-analyze{display:inline-flex;align-items:center;justify-content:center}
      .modal-backdrop.is-entering{animation:budgetBackdropIn .14s ease-out both}.modal-backdrop.is-entering .schedule-modal{animation:budgetModalIn .18s cubic-bezier(.2,.8,.2,1) both}
      @media(prefers-reduced-motion:reduce){.view.is-entering,.tabs button.is-switching,.view.is-entering .section-head,.view.is-entering .kpi,.view.is-entering .phase-card,.view.is-entering .visual-grid>*,.view.is-entering .table-card,.view.is-entering .account-stack,.view.is-entering .settings-grid,.view.is-entering .filters,.view.is-entering .insight,.view.is-entering .donut,.view.is-entering .donut:before,.view.is-entering .bar i,.view.is-entering .cash-period b,.view.is-entering .cash-column-bars i,.view.is-entering .cash-column-bars b,.view.is-entering .budget-glyph svg path,.view.is-entering .table-title:after,.budget-actions span:not(:empty),.modal-backdrop.is-entering,.modal-backdrop.is-entering .schedule-modal,.account-detail{animation:none!important}.tabs button,tbody tr,.account summary,.account summary:after,.cash-week summary:after,input,select,.kpi:after,.panel:after,.table-card:after,.account:after{transition-duration:.01ms!important}}
      @media(prefers-reduced-motion:reduce){.kpi,.panel,.account,.table-card,.export,.primary,.secondary,.mini,.icon{transition-duration:.01ms!important}}
      @media(max-width:980px){.kpi-grid,.phase-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.visual-grid,.settings-grid,.cashflow-layout{grid-template-columns:1fr}.filters{grid-template-columns:1fr 160px}.formula-note{grid-column:1 / -1}.finance-grid{grid-template-columns:1fr}.tax-layout{grid-template-columns:minmax(0,1fr)}.donut-wrap{grid-template-columns:150px 1fr}.budget-nav{top:-24px}.needs-panel{min-height:0}.cash-week summary{grid-template-columns:84px minmax(190px,1fr) repeat(3,minmax(78px,94px))}.cash-week-body{padding-left:110px}}
      @media(max-width:640px){.fs-budget{padding-top:10px}.budget-nav{align-items:flex-start;flex-direction:column}.tabs{width:100%}.budget-actions{width:100%;justify-content:space-between}.budget-actions span{display:none}.section-head{align-items:flex-start;flex-direction:column}h2{font-size:23px}.kpi-grid,.phase-card-grid{grid-template-columns:1fr}.cashflow-view .kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cashflow-view .kpi strong{font-size:17px}.visual-grid{grid-template-columns:1fr}.donut-wrap{grid-template-columns:1fr;justify-items:center}.legend{width:100%}.insight{grid-template-columns:1fr}.filters{grid-template-columns:1fr}.form-grid,.schedule-grid{grid-template-columns:1fr}.form-grid label:nth-child(5){grid-column:auto}.schedule-summary,.import-summary{grid-template-columns:repeat(3,minmax(0,1fr));padding:12px}.schedule-summary div,.import-summary div{padding:8px}.schedule-summary strong,.import-summary strong{font-size:11px}.tax-layout{padding:12px}.cashflow-empty,.ledger-empty,.cashflow-bridge{grid-template-columns:1fr;justify-items:start}.cashflow-empty .secondary{margin-top:2px}.cashflow-bridge button{padding-left:0}.cashflow-layout{gap:10px}.cashflow-chart{padding-inline:14px}.cash-chart{grid-auto-columns:56px}.cash-week summary{grid-template-columns:72px minmax(0,1fr) 82px;gap:8px;padding:10px 36px 10px 10px}.cash-week summary>span:nth-last-child(2),.cash-week summary>span:last-child{display:none}.cash-week summary>span:nth-last-child(3){text-align:right}.cash-week-body{grid-template-columns:1fr;padding:2px 10px 14px}.cash-ledger-note{display:none}.week-item{grid-template-columns:minmax(0,1fr) auto}.week-item em{display:none}.schedule-stage .schedule-grid{grid-template-columns:1fr;padding-inline:14px}.schedule-stage-head{padding-inline:14px}.modal-foot{align-items:flex-start;flex-direction:column}.schedule-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}.schedule-actions .primary{grid-column:1 / -1}.modal-backdrop{padding:10px}}
      /* Keep the two dense production tables readable without horizontal scrolling. */
      .breakdown-table th:first-child,.breakdown-table td:first-child{padding-left:12px!important}.breakdown-table th:nth-child(1){width:6%!important}.breakdown-table th:nth-child(2){width:17%!important}
      .settings-panel input::placeholder{color:var(--muted,#888780);opacity:.48}.calendar-managed{display:inline-block;margin-left:7px;color:var(--accent,#FFB703);font-size:8.5px;font-weight:800;letter-spacing:.2px;text-transform:none}.settings-panel input:disabled{color:var(--muted,#888780);background:var(--soft,#EFEBE1);cursor:not-allowed}
      .expense-table th:nth-child(1),.expense-table td:nth-child(1){width:7%!important}.expense-table th:nth-child(2),.expense-table td:nth-child(2){width:10%!important}.expense-table th:nth-child(3),.expense-table td:nth-child(3){width:18%!important}.expense-table th:nth-child(4),.expense-table td:nth-child(4){width:10%!important}.expense-table th:nth-child(5),.expense-table td:nth-child(5){width:12%!important}.expense-table th:nth-child(6),.expense-table td:nth-child(6){width:9%!important}.expense-table th:nth-child(7),.expense-table td:nth-child(7){width:8%!important}.expense-table th:nth-child(8),.expense-table td:nth-child(8){width:10%!important}.expense-table th:nth-child(9),.expense-table td:nth-child(9){width:11%!important}.expense-table th:nth-child(10),.expense-table td:nth-child(10){width:5%!important}.receipt-compact{justify-content:flex-start;gap:5px}.receipt-compact .receipt-preview-wrap{flex:0 0 auto}.receipt-compact .receipt-view,.receipt-compact label{min-width:48px;justify-content:center}.receipt-compact label{border-style:solid;border-color:var(--hair,#E7E4DA);background:var(--soft,#EFEBE1);color:var(--muted,#888780);font-size:9px}
      .expense-table th:nth-child(6),.expense-table td:nth-child(6){width:9%}.expense-table th:nth-child(7),.expense-table td:nth-child(7){width:8%}.expense-table th:nth-child(8),.expense-table td:nth-child(8){width:10%;text-align:right}.expense-table th:nth-child(9),.expense-table td:nth-child(9){width:12%;white-space:nowrap}.expense-table th:nth-child(10),.expense-table td:nth-child(10){width:5%;text-align:center}.variance-badge{display:inline-flex;align-items:center;justify-content:flex-end;min-height:27px;padding:0 8px;border:1px solid color-mix(in srgb,#5B7A4A 42%,var(--hair,#E7E4DA));border-radius:8px 7px 9px 6px;background:color-mix(in srgb,#5B7A4A 10%,var(--surface,#FFFEF9));color:#416536;font-size:9.5px;font-weight:800;white-space:nowrap}.variance-badge.negative{border-color:color-mix(in srgb,#C74440 42%,var(--hair,#E7E4DA));background:rgba(199,68,64,.1);color:#C74440!important}.expense-table .receipt{max-width:none;min-width:0;white-space:nowrap}.expense-table .receipt>span:not(.receipt-preview-wrap){max-width:84px!important;white-space:nowrap}.expense-table .receipt label{white-space:nowrap}
      .breakdown-table,.expense-table{min-width:0!important;width:100%;table-layout:fixed}.breakdown-table th,.breakdown-table td,.expense-table th,.expense-table td{padding:7px 5px;font-size:9.5px;white-space:normal;overflow-wrap:anywhere;line-height:1.25}.breakdown-table input,.breakdown-table select,.expense-table input,.expense-table select{min-width:0;width:100%;padding:0 4px;font-size:9px}.breakdown-table th:nth-child(1){width:5%}.breakdown-table th:nth-child(2){width:16%}.breakdown-table th:nth-child(n+3){width:auto}.expense-table th:nth-child(1),.expense-table td:nth-child(1){width:6%}.expense-table th:nth-child(2),.expense-table td:nth-child(2){width:10%}.expense-table th:nth-child(3),.expense-table td:nth-child(3){width:17%}.expense-table th:nth-child(4),.expense-table td:nth-child(4){width:13%}.expense-table th:nth-child(5),.expense-table td:nth-child(5){width:14%}.expense-table th:nth-child(n+6){width:auto}.table-scroll{overflow-x:hidden}
      .receipt-preview-wrap{position:relative;display:inline-flex;align-items:center}.receipt-view{min-height:29px!important;padding:0 9px!important;border:1px solid var(--accent,#FFB703)!important;border-radius:9px 8px 10px 7px!important;background:var(--accent-soft,rgba(255,183,3,.12))!important;color:var(--accent,#BA7517)!important;font-size:10px!important;font-weight:800!important;transition:transform .16s ease,background-color .16s ease,box-shadow .16s ease!important}.receipt-view:hover{transform:translateY(-1px);background:var(--accent-soft,rgba(255,183,3,.22))!important;box-shadow:0 4px 12px rgba(35,35,34,.12)}.receipt-preview{position:absolute;left:0;bottom:calc(100% + 9px);z-index:50;display:block;width:156px!important;height:116px!important;max-width:none!important;padding:5px!important;overflow:hidden;border:1px solid var(--ink,#2C2C2A);border-radius:11px 9px 12px 8px;background:var(--surface,#FFFEF9);box-shadow:0 14px 28px rgba(35,35,34,.22);opacity:0;pointer-events:none;transform:translateY(5px) scale(.96);transition:opacity .16s ease,transform .18s cubic-bezier(.2,.8,.2,1)}.receipt-preview img{display:block;width:100%;height:100%;object-fit:cover;border-radius:7px}.receipt-preview-wrap:hover .receipt-preview,.receipt-preview-wrap:focus-within .receipt-preview{opacity:1;transform:none}
      .cash-profile-tools{display:grid;grid-template-columns:minmax(220px,1fr) minmax(230px,.8fr);gap:12px;margin-top:17px;padding:12px;border:1px solid color-mix(in srgb,var(--ink,#2C2C2A) 16%,transparent);border-radius:13px 11px 15px 10px;background:color-mix(in srgb,var(--soft,#EFEBE1) 56%,transparent)}.cash-profile-tools label{display:grid;align-content:start;gap:6px;min-width:0}.cash-profile-tools label>span{display:flex;align-items:center;justify-content:space-between;gap:9px;color:var(--muted,#888780);font-size:8.5px;font-weight:750}.cash-profile-tools output{color:var(--ink,#2C2C2A);font-size:8.5px;font-weight:850}.cash-profile-tools input[type="search"]{width:100%;min-height:34px;background:var(--surface,#FFFEF9);font-size:10px}.cash-profile-window small{color:var(--muted,#888780);font-size:7.5px;line-height:1.35}.cash-profile-tools input[type="range"]{width:100%;min-height:16px;height:16px;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;cursor:pointer;accent-color:var(--accent,#FFB703)}.cash-profile-tools input[type="range"]::-webkit-slider-runnable-track{height:4px;border-radius:99px;background:color-mix(in srgb,var(--accent,#FFB703) 30%,var(--hair,#E7E4DA))}.cash-profile-tools input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-6px;border:2px solid var(--surface,#FFFEF9);border-radius:50%;background:var(--accent,#FFB703);box-shadow:0 1px 5px rgba(35,35,34,.22);transition:transform .14s cubic-bezier(.2,.8,.2,1)}.cash-profile-tools input[type="range"]:hover::-webkit-slider-thumb{transform:scale(1.08)}.cash-profile-tools input[type="range"]:disabled{cursor:not-allowed;opacity:.46}.cash-filter-empty{display:grid;place-content:center;min-height:238px;padding:30px;text-align:center}.cash-filter-empty strong{font-size:11px}.cash-filter-empty span{max-width:420px;margin-top:6px;color:var(--muted,#888780);font-size:9px;line-height:1.45}.ledger-filter-empty{min-height:150px}.cash-unplaced-results{display:grid;gap:1px;margin-top:10px;padding:10px;border:1px dashed color-mix(in srgb,#BA7517 52%,var(--hair,#E7E4DA));border-radius:12px 10px 14px 9px;background:rgba(255,183,3,.07)}.cash-unplaced-results>span{padding:2px 4px 6px;color:#9A651B;font-size:8px;font-weight:850;letter-spacing:.7px;text-transform:uppercase}.cash-unplaced-results button{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;min-height:44px;padding:7px 8px;border:0;border-top:1px solid color-mix(in srgb,#BA7517 25%,transparent);background:transparent;text-align:left;cursor:pointer}.cash-unplaced-results button span,.cash-unplaced-results button small,.cash-unplaced-results button strong{display:block}.cash-unplaced-results button small{color:var(--muted,#888780);font-size:7px}.cash-unplaced-results button strong{margin-top:2px;font-size:9px}.cash-unplaced-results button b{font-size:8.5px}.cash-column-date{align-self:end;overflow:hidden;color:var(--muted,#888780);font-size:7px;font-weight:750;text-align:center;text-overflow:ellipsis;white-space:nowrap}.cashflow-view.is-filtered .cash-column,.cashflow-view.is-filtered .cash-week{animation:cashFilterIn .2s calc(var(--cash-index) * 12ms) cubic-bezier(.2,.8,.2,1) both}@keyframes cashFilterIn{from{opacity:0;transform:translateY(5px) scale(.985)}to{opacity:1;transform:none}}.week-actual.is-unbudgeted{border-bottom-color:color-mix(in srgb,#BA7517 38%,var(--hair,#E7E4DA));background:rgba(255,183,3,.07)}
      .cash-chart{height:242px}.cash-column{grid-template-rows:19px 25px 148px 18px 15px;height:238px}.cash-chart-scroll{margin-top:10px}
      .unexpected-alert{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:15px;padding:12px 14px;border:1px solid color-mix(in srgb,#BA7517 54%,var(--hair,#E7E4DA));border-radius:13px 11px 15px 10px;background:rgba(255,183,3,.09)}.unexpected-alert span,.unexpected-alert strong,.unexpected-alert small{display:block}.unexpected-alert strong{font-size:10.5px}.unexpected-alert small{margin-top:3px;color:var(--muted,#888780);font-size:9px}.unexpected-alert button{border:0;background:transparent;color:#9A651B;font-size:9px;font-weight:850;cursor:pointer}.summary-unexpected{background:rgba(255,183,3,.075)}.unexpected-phase{background:rgba(255,183,3,.075)}
      .expense-status-guide{position:relative;z-index:5;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;padding:0 18px 13px;background:var(--surface,#FFFEF9)}.expense-status-guide>span{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:6px;padding:9px 10px;border:1px solid var(--hair,#E7E4DA);background:color-mix(in srgb,var(--soft,#EFEBE1) 46%,transparent)}.expense-status-guide>span:first-child{border-radius:10px 0 0 8px}.expense-status-guide>span:last-child{border-radius:0 8px 10px 0}.expense-status-guide i{width:7px;height:7px;border-radius:50%;background:#5B7A4A}.expense-status-guide .is-over i{background:#C74440}.expense-status-guide .is-unbudgeted i{background:#BA7517}.expense-status-guide strong{font-size:9px}.expense-status-guide small{color:var(--muted,#888780);font-size:8px}.expense-row{position:relative}.expense-row.is-within{background:rgba(91,122,74,.025)}.expense-row.is-over{background:rgba(199,68,64,.055)}.expense-row.is-unbudgeted{background:rgba(255,183,3,.065)}.expense-row:hover{background:var(--soft,#EFEBE1)}.expense-line-button{display:grid;grid-template-columns:8px minmax(0,1fr);align-items:center;gap:7px;width:100%;min-height:36px;padding:5px 7px;border:1px solid var(--hair,#E7E4DA);border-radius:9px 7px 10px 6px;background:var(--surface,#FFFEF9);text-align:left;cursor:pointer;transition:transform .14s cubic-bezier(.2,.8,.2,1),border-color .14s ease,background-color .14s ease}.expense-line-button:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--accent,#FFB703) 55%,var(--hair,#E7E4DA))}.expense-line-button i{width:7px;height:7px;border-radius:50%;background:#5B7A4A}.expense-line-button.is-over i{background:#C74440}.expense-line-button.is-unbudgeted i{background:#BA7517}.expense-line-button span,.expense-line-button small,.expense-line-button strong{display:block;min-width:0}.expense-line-button small{color:var(--muted,#888780);font-size:7px}.expense-line-button strong{margin-top:2px;overflow:hidden;font-size:8.5px;text-overflow:ellipsis;white-space:nowrap}.not-budgeted{display:inline-flex;min-height:25px;align-items:center;padding:0 7px;border:1px dashed color-mix(in srgb,#BA7517 56%,var(--hair,#E7E4DA));border-radius:8px 7px 9px 6px;color:#9A651B;font-size:8px;font-weight:800;white-space:nowrap}.variance-badge{display:inline-grid!important;justify-items:end;min-height:34px!important;height:auto!important;padding:5px 7px!important}.variance-badge small,.variance-badge strong{display:block}.variance-badge small{font-size:6.5px;font-weight:750}.variance-badge strong{margin-top:2px;font-size:8.5px}.variance-badge.is-within{border-color:color-mix(in srgb,#5B7A4A 42%,var(--hair,#E7E4DA));background:rgba(91,122,74,.08);color:#416536}.variance-badge.is-over{border-color:color-mix(in srgb,#C74440 46%,var(--hair,#E7E4DA));background:rgba(199,68,64,.1);color:#C74440}.variance-badge.is-unbudgeted{border-color:color-mix(in srgb,#BA7517 52%,var(--hair,#E7E4DA));background:rgba(255,183,3,.11);color:#9A651B}.expense-picker-modal{width:min(720px,100%);overflow:hidden}.expense-picker-search{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:14px;padding:15px 20px;background:color-mix(in srgb,var(--soft,#EFEBE1) 58%,transparent)}.expense-picker-search label{display:grid;gap:6px}.expense-picker-search label>span{color:var(--muted,#888780);font-size:8.5px;font-weight:750}.expense-picker-search input{width:100%;background:var(--surface,#FFFEF9)}.expense-picker-search>small{padding-bottom:10px;color:var(--muted,#888780);font-size:8px}.unexpected-option{position:relative;z-index:5;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:11px;width:calc(100% - 40px);min-height:60px;margin:14px 20px 8px;padding:9px 12px;border:1px solid color-mix(in srgb,#BA7517 48%,var(--hair,#E7E4DA));border-radius:13px 11px 15px 10px;background:rgba(255,183,3,.09);text-align:left;cursor:pointer;transition:transform .16s cubic-bezier(.2,.8,.2,1),background-color .16s ease}.unexpected-option:hover{transform:translateY(-1px);background:rgba(255,183,3,.15)}.unexpected-option.is-selected{box-shadow:0 0 0 2px rgba(255,183,3,.24)}.unexpected-option>i{display:grid;place-items:center;width:32px;height:32px;border:1px solid #BA7517;border-radius:10px 8px 11px 7px;color:#9A651B;font-size:18px;font-style:normal}.unexpected-option span,.unexpected-option strong,.unexpected-option small{display:block}.unexpected-option strong{font-size:10.5px}.unexpected-option small{margin-top:3px;color:var(--muted,#888780);font-size:8.5px;line-height:1.35}.unexpected-option>b{color:#9A651B;font-size:8.5px}.expense-line-results{position:relative;z-index:5;display:grid;max-height:390px;padding:6px 20px 16px;overflow:auto}.expense-line-option{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,auto);align-items:center;gap:14px;width:100%;min-height:54px;padding:9px 11px;border:0;border-bottom:1px solid var(--hair,#E7E4DA);background:transparent;text-align:left;cursor:pointer;transition:background-color .12s ease,transform .14s cubic-bezier(.2,.8,.2,1)}.expense-line-option:hover{background:var(--soft,#EFEBE1);transform:translateX(2px)}.expense-line-option.is-selected{background:rgba(91,122,74,.09);box-shadow:inset 3px 0 #5B7A4A}.expense-line-option.is-over{background:rgba(199,68,64,.045)}.expense-line-option span,.expense-line-option small,.expense-line-option strong,.expense-line-option b{display:block}.expense-line-option>span:last-child{text-align:right}.expense-line-option small{color:var(--muted,#888780);font-size:7.5px}.expense-line-option strong{margin-top:3px;font-size:9.5px}.expense-line-option b{margin-top:3px;font-size:9px;font-variant-numeric:tabular-nums}.expense-picker-empty{display:grid;justify-items:center;padding:38px 20px;text-align:center}.expense-picker-empty strong{font-size:11px}.expense-picker-empty span{margin-top:6px;color:var(--muted,#888780);font-size:9px}.expense-picker-modal .modal-foot{position:relative;z-index:6;background:var(--surface,#FFFEF9)}
      @media(max-width:760px){.cash-profile-tools{grid-template-columns:1fr}.expense-status-guide{grid-template-columns:1fr;padding-inline:12px}.expense-status-guide>span:first-child,.expense-status-guide>span:last-child{border-radius:9px}.expense-picker-search{grid-template-columns:1fr}.expense-picker-search>small{padding-bottom:0}.expense-line-option{grid-template-columns:minmax(0,1fr) auto}.unexpected-option{grid-template-columns:32px minmax(0,1fr)}.unexpected-option>b{display:none}}
      @media(prefers-reduced-motion:reduce){.cashflow-view.is-filtered .cash-column,.cashflow-view.is-filtered .cash-week{animation:none!important}.cash-profile-tools input[type="range"]::-webkit-slider-thumb,.expense-line-button,.unexpected-option,.expense-line-option{transition-duration:.01ms!important}}
      /* Allocation chart: keep the total readable first, then let the ring
         breathe. The legend has a stable value column so long totals never
         push the card past its right margin. */
      .allocation{overflow:hidden;contain:paint}.allocation .panel-head{min-width:0}.allocation .panel-head>div{min-width:0}.allocation .panel-head h3{overflow-wrap:anywhere}.allocation .panel-head small{max-width:42%;text-align:right;white-space:normal}
      .donut-wrap{grid-template-columns:minmax(146px,168px) minmax(0,1fr);gap:clamp(18px,3vw,30px);min-width:0;margin-top:20px}.donut{width:clamp(146px,18vw,168px);height:auto;aspect-ratio:1;transition:transform .24s cubic-bezier(.2,.8,.2,1),box-shadow .24s ease;box-shadow:0 0 0 1px color-mix(in srgb,var(--ink,#2C2C2A) 9%,transparent),0 10px 24px rgba(35,35,34,.09)}.donut-wrap:hover .donut{transform:translateY(-2px) scale(1.018);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent,#BA7517) 32%,transparent),0 14px 30px rgba(35,35,34,.13)}.donut-center{width:calc(100% - 18px)!important;height:calc(100% - 18px)!important;min-width:0!important;min-height:0!important;max-width:calc(100% - 18px);padding:0 7px;box-shadow:0 0 0 1px color-mix(in srgb,var(--hair,#E7E4DA) 80%,transparent),0 4px 12px rgba(35,35,34,.04)!important}.donut-center strong{display:block;max-width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.05}.donut-center .budget-count{font-size:clamp(10px,1.25vw,14px);letter-spacing:-.35px}.donut-center.is-tight .budget-count{font-size:clamp(9.5px,1.08vw,12px);letter-spacing:-.45px}.donut-center.is-compact .budget-count{font-size:clamp(9px,.95vw,10.5px);letter-spacing:-.5px}.donut-center small{margin-top:5px;font-size:9px;letter-spacing:.55px;text-transform:uppercase;color:var(--muted,#888780)}
      .legend{min-width:0;gap:3px}.legend div{min-width:0;grid-template-columns:9px minmax(0,1fr) auto;gap:9px;padding:7px 8px;border:1px solid transparent;border-radius:9px 8px 10px 7px;font-size:10.5px;transition:transform .16s cubic-bezier(.2,.8,.2,1),background-color .16s ease,border-color .16s ease}.legend div:hover{transform:translateX(3px);background:color-mix(in srgb,var(--soft,#EFEBE1) 72%,transparent);border-color:color-mix(in srgb,var(--hair,#E7E4DA) 72%,transparent)}.legend i{width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 8%,transparent)}.legend span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink,#2C2C2A)}.legend strong{min-width:3ch;text-align:right;font-size:10px;font-variant-numeric:tabular-nums;color:var(--ink,#2C2C2A)}
      @media(max-width:980px){.donut-wrap{grid-template-columns:minmax(136px,150px) minmax(0,1fr);gap:18px}.donut{width:150px}.donut-center .budget-count{font-size:clamp(9.5px,1.6vw,12px)}}
      @media(max-width:640px){.allocation .panel-head small{max-width:46%}.donut-wrap{grid-template-columns:minmax(136px,150px) minmax(0,1fr);justify-items:stretch;gap:16px}.legend{width:auto}.donut{width:150px;justify-self:center}.donut-center .budget-count{font-size:clamp(9.5px,3.2vw,12px)}}
      @media(prefers-reduced-motion:reduce){.donut,.donut-wrap:hover .donut,.legend div{transition-duration:.01ms!important;transform:none!important}}
    </style>`;
  }
}

if (!customElements.get('filmscript-budget')) customElements.define('filmscript-budget', FilmScriptBudget);
