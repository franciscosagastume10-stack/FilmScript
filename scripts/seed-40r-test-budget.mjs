import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import { computeBudget, normalizeBudget } from "../budget-model.js";

const SCRIPT_ID = "scr_ba18814992c9e5605c50";
const SCRIPT_TITLE = "40R - GUIÓN FINAL";
const DRY_RUN = process.argv.includes("--dry-run");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_PATH = process.env.FILMSCRIPT_DATABASE_PATH
  ? path.resolve(process.env.FILMSCRIPT_DATABASE_PATH)
  : path.resolve(HERE, "../data/filmscript.sqlite");
const BACKUP_PATH = path.resolve(HERE, "../data/backups/40r-before-test-budget.json");

const definitions = {
  "1000:1001": [1, "flat", 1, 1800, "X"],
  "1000:1002": [1, "flat", 1, 1500, "X"],
  "1000:1003": [2, "days", 1, 700, "X"],
  "1000:1004": [2, "days", 1, 650, "I"],
  "1000:1005": [1, "flat", 1, 600, "I"],
  "1000:1006": [6, "persons", 2, 70, "I"],
  "1100:1101": [1, "flat", 1, 4500, "X"],
  "1100:1102": [1, "flat", 1, 250, "X"],
  "1200:1201": [1, "flat", 1, 7500, "X"],
  "1200:1203": [6, "weeks", 1, 1800, "X"],
  "1300:1301": [1, "flat", 1, 9000, "X"],
  "1400:1401": [1, "flat", 1, 6000, "X"],
  "1400:1402": [1, "flat", 1, 5000, "X"],
  "1400:1404": [1, "flat", 1, 3000, "X"],
  "1400:1407": [1, "day", 1, 1200, "X"],
  "1500:1501": [1, "flat", 1, 2200, "X"],
  "1500:1502": [8, "persons", 1, 250, "X"],
  "1600:1601": [3, "days", 1, 350, "X"],
  "1600:1602": [6, "weeks", 1, 1000, "X"],
  "1600:1603": [3, "days", 1, 900, "X"],
  "1600:1605": [3, "days", 1, 700, "X"],
  "1600:1606": [3, "days", 1, 350, "X"],
  "1600:1609": [1, "flat", 1, 800, "I"],
  "1600:1610": [1, "flat", 1, 700, "I"],
  "1700:1701": [5, "weeks", 1, 1000, "X"],
  "1700:1703": [5, "days", 1, 350, "X"],
  "1700:1704": [1, "flat", 1, 5000, "E"],
  "1700:1707": [1, "flat", 1, 2800, "I"],
  "1700:1708": [1, "flat", 1, 2200, "I"],
  "1800:1801": [3, "days", 1, 1500, "X"],
  "1800:1802": [3, "days", 1, 700, "X"],
  "1800:1803": [3, "days", 1, 450, "X"],
  "1800:1804": [3, "days", 1, 600, "X"],
  "1900:1901": [1, "package", 1, 10000, "I"],
  "1900:1903": [3, "days", 1, 350, "I"],
  "1900:1906": [2, "drives", 1, 800, "I"],
  "1900:1907": [1, "flat", 1, 1800, "I"],
  "2000:2001": [3, "days", 1, 1000, "X"],
  "2000:2002": [3, "days", 1, 550, "X"],
  "2000:2003": [3, "days", 1, 850, "I"],
  "2100:2101": [3, "days", 1, 800, "X"],
  "2100:2102": [3, "days", 1, 500, "X"],
  "2100:2103": [3, "days", 1, 500, "X"],
  "2200:2201": [3, "days", 1, 1600, "I"],
  "2200:2204": [3, "days", 1, 650, "I"],
  "2200:2205": [1, "flat", 1, 900, "I"],
  "2300:2301": [1, "flat", 1, 2500, "X"],
  "2300:2303": [1, "flat", 1, 3000, "I"],
  "2400:2401": [3, "days", 1, 650, "X"],
  "2400:2403": [1, "flat", 1, 1200, "I"],
  "2700:2701": [1, "flat", 1, 2500, "X"],
  "2700:2704": [3, "days", 1, 1200, "I"],
  "2700:2705": [1, "flat", 1, 1500, "I"],
  "2700:2709": [1, "flat", 1, 700, "X"],
  "2700:2710": [3, "days", 1, 300, "X"],
  "2900:2901": [22, "persons", 3, 75, "I"],
  "2900:2902": [3, "days", 1, 450, "I"],
  "2900:2904": [3, "days", 1, 250, "I"],
  "2900:2905": [3, "days", 1, 450, "X"],
  "2900:2906": [1, "flat", 1, 500, "I"],
  "3000:3001": [3, "days", 1, 650, "I"],
  "3000:3002": [3, "days", 1, 750, "I"],
  "3000:3005": [1, "flat", 1, 1400, "I"],
  "3000:3007": [3, "days", 1, 350, "X"],
  "3000:3008": [1, "flat", 1, 600, "I"],
  "3200:3201": [4, "weeks", 1, 2500, "X"],
  "3200:3202": [2, "weeks", 1, 1200, "X"],
  "3200:3203": [4, "weeks", 1, 450, "I"],
  "3300:3302": [1, "flat", 1, 4500, "E"],
  "3300:3304": [1, "flat", 1, 800, "X"],
  "3300:3305": [1, "flat", 1, 1200, "X"],
  "3300:3306": [1, "flat", 1, 1800, "I"],
  "3300:3307": [1, "flat", 1, 1600, "I"],
  "3400:3401": [1, "flat", 1, 4000, "X"],
  "3400:3402": [1, "flat", 1, 3000, "X"],
  "3400:3404": [1, "flat", 1, 3500, "I"],
  "3500:3501": [1, "flat", 1, 4500, "X"],
  "3600:3601": [10, "submissions", 1, 350, "X"],
  "3600:3604": [1, "flat", 1, 1800, "I"],
  "3800:3801": [1, "flat", 1, 3500, "X"],
};

const allocations = {
  "1000:1001": ["prep_5"], "1000:1002": ["prep_5"],
  "1000:1003": ["prep_4"], "1000:1004": ["prep_4"], "1000:1005": ["prep_4"], "1000:1006": ["prep_4"],
  "1100:1101": ["prep_5", "prep_4"], "1100:1102": ["prep_5"],
  "1200:1201": ["prep_5", "prep_4", "prep_3", "prep_2", "prep_1", "shoot_1"],
  "1200:1203": ["prep_5", "prep_4", "prep_3", "prep_2", "prep_1", "shoot_1"],
  "1300:1301": ["prep_2", "shoot_1"],
  "1400:1401": ["prep_2", "shoot_1"], "1400:1402": ["prep_2", "shoot_1"],
  "1400:1404": ["prep_2", "shoot_1"], "1400:1407": ["shoot_1"],
  "1500:1501": ["prep_3"], "1500:1502": ["shoot_1"],
  "1600:1602": ["prep_5", "prep_4", "prep_3", "prep_2", "prep_1", "shoot_1"],
  "1600:1609": ["prep_2"], "1600:1610": ["prep_1"],
  "1700:1701": ["prep_5", "prep_4", "prep_3", "prep_2", "prep_1"],
  "1700:1703": ["prep_3", "prep_2", "prep_1"],
  "1700:1704": ["prep_2", "prep_1"], "1700:1707": ["prep_2", "prep_1"], "1700:1708": ["prep_1", "shoot_1"],
  "1900:1901": ["prep_1", "shoot_1"], "1900:1903": ["prep_1", "shoot_1"],
  "1900:1906": ["prep_1"], "1900:1907": ["prep_1"],
  "2200:2201": ["prep_1", "shoot_1"], "2200:2204": ["shoot_1"], "2200:2205": ["shoot_1"],
  "2300:2301": ["prep_2", "prep_1"], "2300:2303": ["prep_2", "prep_1"],
  "2400:2401": ["prep_1", "shoot_1"], "2400:2403": ["prep_1"],
  "2700:2701": ["prep_3", "prep_2", "prep_1"], "2700:2704": ["prep_1", "shoot_1"],
  "2700:2705": ["prep_1"], "2700:2709": ["prep_2"], "2700:2710": ["shoot_1"],
  "3200:3201": ["post_1", "post_2", "post_3", "post_4"], "3200:3202": ["post_1", "post_2"],
  "3200:3203": ["post_1", "post_2", "post_3", "post_4"],
  "3300:3302": ["post_8"], "3300:3304": ["post_9"], "3300:3305": ["post_9"],
  "3300:3306": ["post_7", "post_8"], "3300:3307": ["post_10"],
  "3400:3401": ["post_5", "post_6", "post_7", "post_8"],
  "3400:3402": ["post_5", "post_6", "post_7", "post_8"], "3400:3404": ["post_9"],
  "3500:3501": ["post_5", "post_6", "post_7", "post_8"],
  "3600:3601": ["post_12"], "3600:3604": ["post_10"], "3800:3801": ["prep_2"],
};

const shootOnlyAccounts = new Set(["1800", "2000", "2100", "2900", "3000"]);

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function distribute(amount, periods) {
  if (!periods.length) throw new Error("A scheduled budget line has no periods");
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / periods.length);
  const remainder = cents % periods.length;
  return Object.fromEntries(periods.map((periodId, index) => [periodId, (base + (index < remainder ? 1 : 0)) / 100]));
}

function assertClose(actual, expected, label, tolerance = 0.011) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function upsertById(entries, entry) {
  const index = entries.findIndex((candidate) => candidate.id === entry.id);
  if (index >= 0) entries[index] = { ...entries[index], ...entry };
  else entries.push(entry);
}

const db = new Database(DATABASE_PATH, { readonly: DRY_RUN, fileMustExist: true });
db.pragma("busy_timeout = 5000");
const row = db.prepare(`
  SELECT scripts.id, scripts.title, preproduction_projects.data_json
  FROM scripts
  JOIN preproduction_projects ON preproduction_projects.script_id = scripts.id
  WHERE scripts.id = ?
`).get(SCRIPT_ID);

if (!row || row.id !== SCRIPT_ID || row.title !== SCRIPT_TITLE) {
  throw new Error(`Refusing to seed: expected ${SCRIPT_ID} / ${SCRIPT_TITLE}`);
}

const project = JSON.parse(row.data_json);
let budget = normalizeBudget(project.budget, SCRIPT_TITLE);
budget.settings.currencyCode = "GTQ";
budget.settings.currencySymbol = "Q";
budget.settings.contingencyRate = 0.05;
budget.metadata.format ||= "Short film · 3 shooting days";
budget.metadata.locations ||= "Guatemala City, Guatemala";

const itemByKey = new Map();
for (const account of budget.accounts) {
  for (const item of account.items) {
    const key = `${account.code}:${item.code}`;
    if (!itemByKey.has(key)) itemByKey.set(key, item);
    item.schedule = Object.fromEntries(budget.periods.map((period) => [period.id, 0]));
  }
}

for (const [key, [quantity, unit, multiplier, unitCost, taxMode]] of Object.entries(definitions)) {
  const item = itemByKey.get(key);
  if (!item) throw new Error(`Budget line ${key} does not exist`);
  item.quantity = quantity;
  item.unit = unit;
  item.multiplier = multiplier;
  item.unitCost = unitCost;
  item.taxRateId = taxMode === "X" ? "tax_exempt" : "tax_standard";
  item.taxMode = taxMode === "I" ? "included" : "exclusive";
  item.fundingKind = "cash";
}

budget = normalizeBudget(budget, SCRIPT_TITLE);
let computed = computeBudget(budget, SCRIPT_TITLE);
const validPeriodIds = new Set(budget.periods.map((period) => period.id));

for (const [key] of Object.entries(definitions)) {
  const [accountCode, itemCode] = key.split(":");
  const account = budget.accounts.find((candidate) => candidate.code === accountCode);
  const item = account?.items.find((candidate) => candidate.code === itemCode);
  const result = item && computed.itemMap.get(item.id);
  if (!item || !result) throw new Error(`Could not calculate ${key}`);
  const periodIds = allocations[key] || (shootOnlyAccounts.has(accountCode) ? ["shoot_1"] : ["prep_1"]);
  if (periodIds.some((periodId) => !validPeriodIds.has(periodId))) throw new Error(`Invalid period for ${key}`);
  item.schedule = { ...item.schedule, ...distribute(result.total, periodIds) };
}

const contingency = budget.accounts.find((account) => account.code === "3700")?.items.find((item) => item.calculation === "contingency");
if (!contingency) throw new Error("Contingency line is missing");
contingency.schedule = { ...contingency.schedule, wrap_1: computed.contingencyAmount };

const idFor = (accountCode, itemCode) => {
  const item = budget.accounts.find((account) => account.code === accountCode)?.items.find((candidate) => candidate.code === itemCode);
  if (!item) throw new Error(`Expense line ${accountCode}:${itemCode} is missing`);
  return item.id;
};

const cameraExpense = budget.expenses.find((expense) => expense.id === "expense_mrjs1d3b_ifc5h8");
if (cameraExpense) {
  cameraExpense.lineItemId = idFor("1900", "1901");
  cameraExpense.vendor ||= "Cine Rental Guatemala";
  cameraExpense.concept ||= "Camera package reservation and lenses";
}

const emptyExpense = budget.expenses.find((expense) => expense.id === "expense_mrlmoemi_amo8sl");
if (emptyExpense && emptyExpense.amount === 0 && !emptyExpense.receiptId && !emptyExpense.vendor && !emptyExpense.concept) {
  Object.assign(emptyExpense, {
    lineItemId: idFor("1500", "1501"), paymentNumber: "2", paymentDate: "2026-12-03",
    vendor: "Casting Guatemala", concept: "Casting coordination deposit", amount: 1100,
  });
}

const expenses = [
  ["demo_40r_breakdown", "1000", "1001", "3", "2026-11-18", "Producción 40R", "Script breakdown preparation", 1800],
  ["demo_40r_rights", "1100", "1101", "4", "2026-11-20", "Author agreement", "Screenplay rights deposit", 2250],
  ["demo_40r_scout", "1000", "1003", "5", "2026-11-25", "Location Services GT", "Two-day location scout", 1400],
  ["demo_40r_line_producer", "1200", "1203", "6", "2026-12-04", "Producción 40R", "Line producer first installment", 3600],
  ["demo_40r_art", "1700", "1704", "7", "2026-12-09", "Mercado de Utilería", "Art purchases and rentals", 3200],
  ["demo_40r_insurance", "3800", "3801", "8", "2026-12-10", "Seguros Producción GT", "Production insurance policy", 3500],
  ["demo_40r_catering", "2900", "2901", "9", "2026-12-21", "Catering Chapín", "Crew catering — shooting day one", 5250],
  ["demo_40r_fuel", "3000", "3005", "10", "2026-12-22", "Estación Central", "Production transportation fuel", 1450],
  ["demo_40r_unexpected", "", "", "11", "2026-12-23", "Mensajería Express", "Unexpected adapter and urgent courier", 680],
  ["demo_40r_editor", "3200", "3201", "12", "2027-01-06", "Post Lab Guatemala", "Picture editor first installment", 2500],
];

for (const [id, accountCode, itemCode, paymentNumber, paymentDate, vendor, concept, amount] of expenses) {
  upsertById(budget.expenses, {
    id,
    lineItemId: accountCode ? idFor(accountCode, itemCode) : "",
    paymentNumber,
    paymentDate,
    vendor,
    concept,
    amount,
    notes: accountCode ? "Test production payment" : "Unbudgeted cost recorded during principal photography",
    receiptId: "", receiptName: "", receiptType: "", receiptSize: 0,
  });
}

for (const source of [
  { id: "demo_40r_equity", name: "Producer equity", type: "cash", amount: 90000, paid: 90000, status: "Received", paymentDate: "2026-11-16", notes: "Initial production capitalization" },
  { id: "demo_40r_investor", name: "Private investor", type: "partner", amount: 70000, paid: 35000, status: "Partially paid", paymentDate: "2026-12-07", notes: "Second installment pending" },
  { id: "demo_40r_grant", name: "Cultural production grant", type: "cash", amount: 30000, paid: 0, status: "Pending", paymentDate: "2027-01-15", notes: "Expected during postproduction" },
]) {
  upsertById(budget.fundingSources, { ...source, receiptId: "", receiptName: "", receiptType: "", receiptSize: 0 });
}

budget.updatedAt = new Date().toISOString();
budget = normalizeBudget(budget, SCRIPT_TITLE);
computed = computeBudget(budget, SCRIPT_TITLE);

assertClose(computed.total, 225984.5, "Total budget");
assertClose(computed.tax, 8365.714285, "Tax", 0.00001);
assertClose(computed.contingencyAmount, 8454.5, "Contingency");
assertClose(computed.scheduledCashTotal, computed.cashTotal, "Scheduled cash");
assertClose(computed.unscheduledCashTotal, 0, "Unscheduled cash");
assertClose(computed.overScheduledCashTotal, 0, "Over-scheduled cash");
assertClose(computed.spent, 36730, "Actual spend");
assertClose(computed.unbudgetedSpent, 680, "Unexpected spend");
assertClose(computed.overBudgetSpent, 350, "Over budget");
assertClose(computed.fundingPlanned, 210000, "Planned funding");
assertClose(computed.fundingReceived, 145000, "Received funding");
assertClose(computed.fundingGap, 15984.5, "Funding gap");

const summary = {
  mode: DRY_RUN ? "dry-run" : "saved",
  scriptId: SCRIPT_ID,
  title: SCRIPT_TITLE,
  currency: budget.settings.currencyCode,
  budget: money(computed.total),
  scheduled: money(computed.scheduledCashTotal),
  spent: money(computed.spent),
  unexpected: money(computed.unbudgetedSpent),
  overBudget: money(computed.overBudgetSpent),
  fundingPlanned: money(computed.fundingPlanned),
  fundingReceived: money(computed.fundingReceived),
};

if (!DRY_RUN) {
  fs.mkdirSync(path.dirname(BACKUP_PATH), { recursive: true });
  if (!fs.existsSync(BACKUP_PATH)) fs.writeFileSync(BACKUP_PATH, `${JSON.stringify(project, null, 2)}\n`, { mode: 0o600 });
  project.budget = budget;
  project.updatedAt = budget.updatedAt;
  const nextJson = JSON.stringify(project);
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db.prepare(`
      UPDATE preproduction_projects
      SET data_json = ?, updated_at = ?
      WHERE script_id = ? AND data_json = ?
    `).run(nextJson, budget.updatedAt, SCRIPT_ID, row.data_json);
    if (result.changes !== 1) throw new Error("Budget changed while the seed was running; nothing was overwritten");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

db.close();
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
