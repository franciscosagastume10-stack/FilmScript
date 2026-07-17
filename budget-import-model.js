import { PHASES, normalizeBudget } from "./budget-model.js";

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const text = (value, limit = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const key = (value) => text(value, 180).toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const id = (value, fallback) => text(value, 80).replace(/[^a-zA-Z0-9_-]/g, "_") || fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value)));
const phaseIds = new Set(PHASES.map((phase) => phase.id));

function amountFrom(raw) {
  if (raw?.total != null && raw?.unitCost == null) {
    const quantity = Math.max(1, Math.trunc(finite(raw.quantity, 1)));
    const multiplier = Math.max(1, finite(raw.multiplier, 1));
    return Math.max(0, finite(raw.total) / quantity / multiplier);
  }
  return Math.max(0, finite(raw?.unitCost));
}

function normalizeSchedule(value, periodIds) {
  const output = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;
  for (const periodId of periodIds) {
    if (value[periodId] == null) continue;
    const amount = Math.max(0, finite(value[periodId]));
    if (amount > 0) output[periodId] = Math.round(amount * 100) / 100;
  }
  return output;
}

function matchTaxId(raw, budget) {
  const rates = Array.isArray(budget?.settings?.taxRates) ? budget.settings.taxRates : [];
  const candidate = text(raw, 60);
  if (!candidate) return "tax_exempt";
  const direct = rates.find((rate) => rate.id === candidate);
  if (direct) return direct.id;
  const byName = rates.find((rate) => key(rate.name) === key(candidate));
  if (byName) return byName.id;
  const percentage = Number(candidate.replace("%", ""));
  if (Number.isFinite(percentage)) {
    const byRate = rates.find((rate) => Math.abs(finite(rate.rate) * 100 - percentage) < 0.01);
    if (byRate) return byRate.id;
  }
  return "tax_exempt";
}

function normalizeBudgetImportProposal(raw, budget) {
  const current = normalizeBudget(budget);
  const periodIds = current.periods.map((period) => period.id);
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const accounts = Array.isArray(source.accounts) ? source.accounts : [];
  const normalizedAccounts = accounts.slice(0, 120).flatMap((account, accountIndex) => {
    if (!account || typeof account !== "object") return [];
    const code = text(account.code, 16).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 16) || `IMP${accountIndex + 1}`;
    const name = text(account.name, 120) || `Imported account ${accountIndex + 1}`;
    const phaseId = phaseIds.has(account.phaseId) ? account.phaseId : "other";
    const items = Array.isArray(account.items) ? account.items : [];
    return [{
      code,
      name,
      phaseId,
      items: items.slice(0, 250).flatMap((item, itemIndex) => {
        if (!item || typeof item !== "object") return [];
        const quantityProvided = item.quantity != null;
        const multiplierProvided = item.multiplier != null || item.times != null;
        const unitCostProvided = item.unitCost != null || item.cost != null || item.total != null;
        const quantity = Math.max(0, Math.trunc(finite(item.quantity, 1)));
        const multiplier = Math.max(0, finite(item.multiplier ?? item.times, 1));
        const unitCost = amountFrom({ ...item, unitCost: item.unitCost ?? item.cost });
        const schedule = normalizeSchedule(item.schedule, periodIds);
        const importedCode = text(item.code, 24).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 24);
        const nameValue = text(item.name || item.concept || item.description, 180) || `Imported cost ${itemIndex + 1}`;
        return [{
          code: importedCode || `${code}_${itemIndex + 1}`,
          name: nameValue,
          quantity,
          unit: text(item.unit, 40) || "flat",
          multiplier,
          unitCost,
          taxRateId: matchTaxId(item.taxRateId ?? item.tax ?? item.taxRate, current),
          taxMode: item.taxMode === "included" || item.taxIncluded === true ? "included" : "exclusive",
          costType: item.costType === "variable" ? "variable" : "fixed",
          fundingKind: item.fundingKind === "in_kind" || item.funding === "in_kind" ? "in_kind" : "cash",
          origin: ["producer", "studio", "partner", "other"].includes(item.origin) ? item.origin : "producer",
          invoiceNumber: text(item.invoiceNumber, 80),
          schedule,
          sourceText: text(item.sourceText || item.source || "", 400),
          confidence: clamp(item.confidence, 0, 1),
          _hasAmount: quantityProvided || multiplierProvided || unitCostProvided || Object.keys(schedule).length > 0,
          _hasSchedule: Object.keys(schedule).length > 0,
        }];
      }),
    }];
  });
  const fundingSources = (Array.isArray(source.fundingSources) ? source.fundingSources : []).slice(0, 300).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const name = text(entry.name || entry.source, 160);
    if (!name) return [];
    return [{
      id: id(entry.id, `import_fund_${index + 1}`),
      name,
      type: entry.type === "in_kind" ? "in_kind" : entry.type === "partner" ? "partner" : "cash",
      amount: Math.max(0, finite(entry.amount ?? entry.total)),
      paid: Math.max(0, finite(entry.paid ?? entry.received)),
      status: ["Planned", "Pending", "Partially paid", "Received"].includes(entry.status) ? entry.status : "Planned",
      paymentDate: text(entry.paymentDate || entry.date, 60),
      notes: text(entry.notes, 500),
    }];
  });
  const expenses = (Array.isArray(source.expenses) ? source.expenses : []).slice(0, 1000).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const amount = Math.max(0, finite(entry.amount ?? entry.total ?? entry.paid));
    const concept = text(entry.concept || entry.description || entry.name, 240);
    if (!concept && amount <= 0) return [];
    return [{
      id: id(entry.id, `import_expense_${index + 1}`),
      lineItemCode: text(entry.lineItemCode || entry.code, 24).replace(/[^0-9A-Za-z_-]/g, ""),
      accountCode: text(entry.accountCode, 16).replace(/[^0-9A-Za-z_-]/g, ""),
      paymentNumber: text(entry.paymentNumber || entry.number, 40),
      paymentDate: text(entry.paymentDate || entry.date, 40),
      vendor: text(entry.vendor || entry.supplier, 160),
      concept: concept || "Imported expense",
      amount,
      notes: text(entry.notes, 500),
    }];
  });
  const taxRates = Array.isArray(source.taxRates) ? source.taxRates.slice(0, 20).flatMap((rate, index) => {
    if (!rate || typeof rate !== "object") return [];
    const name = text(rate.name || rate.label, 60);
    if (!name) return [];
    return [{ id: id(rate.id, `import_tax_${index + 1}`), name, rate: clamp(finite(rate.rate ?? rate.percent) / (finite(rate.rate ?? rate.percent) > 1 ? 100 : 1), 0, 1) }];
  }) : [];
  return {
    version: 1,
    source: { filename: text(source.source?.filename || source.filename, 180), type: text(source.source?.type || source.sourceType, 40) },
    summary: text(source.summary, 800),
    accounts: normalizedAccounts.filter((account) => account.items.length > 0),
    fundingSources,
    expenses,
    taxRates,
    metadata: {
      producer: text(source.metadata?.producer, 120),
      director: text(source.metadata?.director, 120),
      format: text(source.metadata?.format, 80),
      locations: text(source.metadata?.locations, 180),
      shootingDates: text(source.metadata?.shootingDates, 120),
    },
    warnings: Array.isArray(source.warnings) ? source.warnings.map((warning) => text(warning, 300)).filter(Boolean).slice(0, 30) : [],
    periodIds,
  };
}

function nextAccountCode(accounts) {
  const used = new Set(accounts.map((account) => String(account.code)));
  for (let value = 5000; value < 9999; value += 100) if (!used.has(String(value))) return String(value);
  return `IMP_${accounts.length + 1}`;
}

function mergeSchedule(existing, incoming) {
  if (!incoming || typeof incoming !== "object") return existing || {};
  return { ...(existing || {}), ...incoming };
}

function applyBudgetImport(value, rawProposal, projectTitle = "Untitled screenplay") {
  const base = normalizeBudget(value, projectTitle);
  const proposal = normalizeBudgetImportProposal(rawProposal, base);
  const accounts = base.accounts.map((account) => ({ ...account, items: account.items.map((item) => ({ ...item, schedule: { ...(item.schedule || {}) } })) }));
  const findAccount = (candidate) => accounts.find((account) => account.code === candidate.code || key(account.name) === key(candidate.name));
  const findItem = (account, candidate) => account.items.find((item) => item.code === candidate.code || key(item.name) === key(candidate.name));
  const importedItemIds = new Map();
  proposal.accounts.forEach((candidate) => {
    let account = findAccount(candidate);
    if (!account) {
      account = { code: candidate.code || nextAccountCode(accounts), name: candidate.name, phaseId: candidate.phaseId, items: [] };
      if (accounts.some((entry) => entry.code === account.code)) account.code = nextAccountCode(accounts);
      accounts.push(account);
    }
    candidate.items.forEach((incoming, index) => {
      let item = findItem(account, incoming);
      if (!item) {
        item = {
          id: `li_${account.code}_import_${accounts.length}_${account.items.length + index}`,
          code: incoming.code || `${account.code}_${account.items.length + index + 1}`,
          name: incoming.name,
          quantity: incoming.quantity,
          unit: incoming.unit,
          multiplier: incoming.multiplier,
          unitCost: incoming.unitCost,
          taxRateId: incoming.taxRateId,
          taxMode: incoming.taxMode,
          costType: incoming.costType,
          fundingKind: incoming.fundingKind,
          origin: incoming.origin,
          invoiceNumber: incoming.invoiceNumber,
          schedule: { ...incoming.schedule },
          calculation: "",
        };
        account.items.push(item);
      } else {
        if (incoming._hasAmount) {
          item.quantity = incoming.quantity;
          item.unit = incoming.unit || item.unit;
          item.multiplier = incoming.multiplier;
          item.unitCost = incoming.unitCost;
          item.taxRateId = incoming.taxRateId;
          item.taxMode = incoming.taxMode;
        }
        item.name = incoming.name || item.name;
        item.costType = incoming.costType || item.costType;
        item.fundingKind = incoming.fundingKind || item.fundingKind;
        if (incoming.invoiceNumber) item.invoiceNumber = incoming.invoiceNumber;
        if (incoming._hasSchedule) item.schedule = mergeSchedule(item.schedule, incoming.schedule);
      }
      importedItemIds.set(`${candidate.code}:${incoming.code}`, item.id);
      importedItemIds.set(`${candidate.name}:${incoming.name}`, item.id);
    });
  });
  const taxRates = [...base.settings.taxRates];
  proposal.taxRates.forEach((rate) => {
    if (!taxRates.some((existing) => existing.id === rate.id || key(existing.name) === key(rate.name))) taxRates.push(rate);
  });
  const metadata = { ...base.metadata };
  Object.entries(proposal.metadata).forEach(([field, value]) => { if (value) metadata[field] = value; });
  const fundingSources = [...base.fundingSources];
  proposal.fundingSources.forEach((source, index) => {
    const existing = fundingSources.find((entry) => key(entry.name) === key(source.name));
    if (existing) {
      existing.amount = source.amount || existing.amount;
      existing.paid = source.paid || existing.paid;
      existing.notes = source.notes || existing.notes;
    } else fundingSources.push({ ...source, id: `${source.id}_${index}` });
  });
  const expenses = [...base.expenses];
  proposal.expenses.forEach((expense, index) => {
    const lineItem = accounts.flatMap((account) => account.items).find((item) => item.code === expense.lineItemCode);
    expenses.push({
      id: `expense_import_${Date.now()}_${index}`,
      lineItemId: lineItem?.id || "",
      paymentNumber: expense.paymentNumber,
      paymentDate: expense.paymentDate,
      vendor: expense.vendor,
      concept: expense.concept,
      amount: expense.amount,
      notes: expense.notes,
    });
  });
  return normalizeBudget({
    ...base,
    metadata,
    settings: { ...base.settings, taxRates },
    accounts,
    fundingSources,
    expenses,
    updatedAt: new Date().toISOString(),
  }, projectTitle);
}

function buildBudgetImportCatalog(budget) {
  const normalized = normalizeBudget(budget);
  return normalized.accounts.map((account) => ({
    code: account.code,
    name: account.name,
    phaseId: account.phaseId,
    items: account.items.map((item) => ({ code: item.code, name: item.name })),
  }));
}

export { applyBudgetImport, buildBudgetImportCatalog, normalizeBudgetImportProposal };
