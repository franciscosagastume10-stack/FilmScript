import assert from "node:assert/strict";
import test from "node:test";

import { computeBudget, createBudgetTemplate, normalizeBudget } from "../budget-model.js";

class TestElement {
  attachShadow() {
    this.shadowRoot = {};
    return this.shadowRoot;
  }

  getAttribute(name) {
    if (name === "project-title") return "Cash Flow UI Test";
    return "";
  }
}

const registry = new Map();
globalThis.HTMLElement = TestElement;
globalThis.customElements = {
  define: (name, value) => registry.set(name, value),
  get: (name) => registry.get(name),
};

await import("../budget-workspace.js?cash-flow-ui-test");

const BudgetWorkspace = registry.get("filmscript-budget");

function lineItem(budget, accountCode, itemCode) {
  return budget.accounts.find((account) => account.code === accountCode)
    .items.find((item) => item.code === itemCode);
}

test("Cash Flow renders every production week and the weekly Schedule editor", () => {
  let budget = createBudgetTemplate("Cash Flow UI Test");
  budget.timeline.shootWeeks = 2;
  budget = normalizeBudget(budget, "Cash Flow UI Test");
  budget.settings.contingencyRate = 0;
  const cost = lineItem(budget, "1600", "1601");
  Object.assign(cost, { quantity: 1, multiplier: 1, unitCost: 1000 });
  cost.schedule.shoot_1 = 400;
  cost.schedule.shoot_2 = 600;
  budget.expenses = [
    {
      id: "expense_cashflow_ui",
      lineItemId: cost.id,
      paymentNumber: "1",
      paymentDate: "2026-08-10",
      vendor: "Production payroll",
      amount: 550,
    },
    {
      id: "expense_without_date",
      lineItemId: cost.id,
      paymentNumber: "2",
      paymentDate: "",
      vendor: "Late invoice",
      amount: 25,
    },
  ];

  const workspace = new BudgetWorkspace();
  workspace.budget = budget;
  workspace.productionSchedule = {
    connected: true,
    breakdownSceneCount: 8,
    shootDays: 8,
    shootWeeks: 2,
    shootStartDate: "2026-08-03",
    shootWeekDetails: [
      { week: 1, startDay: 1, endDay: 6, sceneCount: 6 },
      { week: 2, startDay: 7, endDay: 8, sceneCount: 2 },
    ],
  };
  workspace.cashFlowFocusPeriod = "shoot_2";
  const computed = computeBudget(budget, "Cash Flow UI Test");
  const cashFlow = workspace.renderCashFlow(computed);

  assert.match(cashFlow, /Script Breakdown → Stripboard → Budget Schedule/);
  assert.match(cashFlow, /Actual Cash Spend/);
  assert.match(cashFlow, /Shoot days 7–8 · 2 scenes/);
  assert.match(cashFlow, /Production payroll/);
  assert.match(cashFlow, /3–9 Aug/);
  assert.match(cashFlow, /10–16 Aug/);
  assert.match(cashFlow, /data-cashflow-search/);
  assert.match(cashFlow, /data-cashflow-window/);
  assert.match(cashFlow, /cash-column-date/);
  assert.equal((cashFlow.match(/data-cash-week=/g) || []).length, budget.periods.length);

  workspace.cashFlowSearch = "Production payroll";
  const searchedCashFlow = workspace.renderCashFlow(computed);
  assert.equal((searchedCashFlow.match(/data-cash-week=/g) || []).length, 1);
  assert.match(searchedCashFlow, /1 matching week/);

  workspace.cashFlowSearch = "2026-08-09";
  const dateSearch = workspace.renderCashFlow(computed);
  assert.match(dateSearch, /Shoot Week 1/);
  assert.doesNotMatch(dateSearch, /Shoot days 7–8/);

  workspace.cashFlowSearch = "Late invoice";
  const unplacedSearch = workspace.renderCashFlow(computed);
  assert.match(unplacedSearch, /Unplaced actual payments/);
  assert.match(unplacedSearch, /Date needed/);

  workspace.cashFlowSearch = "";
  workspace.cashFlowVisibleWeekCount = 3;
  const focusedWindow = workspace.renderCashFlow(computed);
  assert.equal((focusedWindow.match(/data-cash-week=/g) || []).length, 3);
  assert.match(focusedWindow, /3 of \d+ weeks/);

  workspace.scheduleItemId = cost.id;
  const modal = workspace.renderScheduleModal(computed);
  assert.match(modal, /Preproduction/);
  assert.match(modal, /Production/);
  assert.match(modal, /Postproduction/);
  assert.match(modal, /Auto schedule/);
  assert.match(modal, /data-period="shoot_2"/);
  assert.match(modal, /class="manual-number" type="number"/);

  workspace.queueSave = () => {};
  workspace.clearSchedule(cost.id);
  workspace.autoSchedule(cost.id);
  assert.equal(cost.schedule.shoot_1 + cost.schedule.shoot_2, 1000);
  assert.equal(cost.schedule.prep_1, 0);
});

test("Budget Breakdown quantity accepts whole numbers only", () => {
  globalThis.window = globalThis.window || {};
  const budget = normalizeBudget(createBudgetTemplate("Integer Quantity UI Test"), "Integer Quantity UI Test");
  const cost = lineItem(budget, "1600", "1601");
  cost.quantity = 2.75;
  const normalized = normalizeBudget(budget, "Integer Quantity UI Test");
  const normalizedCost = lineItem(normalized, "1600", "1601");
  assert.equal(normalizedCost.quantity, 2);

  const workspace = new BudgetWorkspace();
  workspace.budget = normalized;
  const row = workspace.renderBreakdownRow(computeBudget(normalized, "Integer Quantity UI Test").itemMap.get(normalizedCost.id));
  assert.match(row, /data-field="quantity"[^>]+step="1"/);
  assert.match(row, /data-integer-only="true"/);
  assert.match(row, /inputmode="numeric"/);

  workspace.updateItem({ dataset: { id: normalizedCost.id, field: "quantity" }, value: "4.9" }, false);
  assert.equal(normalizedCost.quantity, 4);
});

test("Expense Report separates approved overruns from unexpected costs and searches populated lines", () => {
  const budget = createBudgetTemplate("Expense UI Test");
  budget.settings.contingencyRate = 0;
  const populated = lineItem(budget, "1000", "1001");
  const empty = lineItem(budget, "1000", "1002");
  Object.assign(populated, { quantity: 1, multiplier: 1, unitCost: 500 });
  budget.expenses = [
    { id: "approved_payment", lineItemId: populated.id, paymentNumber: "1", vendor: "Crew vendor", amount: 650 },
    { id: "unexpected_payment", lineItemId: "", paymentNumber: "2", concept: "Emergency battery", amount: 75 },
  ];

  const workspace = new BudgetWorkspace();
  workspace.budget = normalizeBudget(budget, "Expense UI Test");
  const computed = computeBudget(workspace.budget, "Expense UI Test");
  const report = workspace.renderExpenses(computed);

  assert.match(report, /Approved Budget/);
  assert.match(report, /Over Budget/);
  assert.match(report, /Unexpected Costs/);
  assert.match(report, /Emergency battery/);
  assert.match(report, /is-over/);
  assert.match(report, /is-unbudgeted/);

  workspace.expensePickerId = "unexpected_payment";
  const picker = workspace.renderExpensePicker(computed);
  assert.match(picker, /Record as unexpected cost/);
  assert.match(picker, new RegExp(populated.code));
  assert.doesNotMatch(picker, new RegExp(`${empty.code} · ${empty.name}`));
  assert.match(picker, /Only cost items with an approved amount/);

  workspace.expenseLineSearch = "breakdown preparation";
  const searchedPicker = workspace.renderExpensePicker(computed);
  assert.match(searchedPicker, /1 matching budget line/);

  const styles = workspace.styles();
  assert.match(styles, /input\[type="number"\][^{]*\{-moz-appearance:textfield;-webkit-appearance:none!important;appearance:textfield\}/);
  assert.match(styles, /::-webkit-inner-spin-button.*display:none!important/);
  assert.match(styles, /::-webkit-outer-spin-button/);
});
