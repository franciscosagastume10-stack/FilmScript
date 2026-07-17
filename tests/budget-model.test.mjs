import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWeeklyPeriods,
  computeBudget,
  createBudgetTemplate,
  normalizeBudget,
} from "../budget-model.js";

function item(budget, accountCode, itemCode) {
  return budget.accounts.find((account) => account.code === accountCode).items.find((entry) => entry.code === itemCode);
}

test("calculates quantity, multiplier and editable added tax", () => {
  const budget = createBudgetTemplate("Tax test");
  const cost = item(budget, "1000", "1001");
  cost.quantity = 2;
  cost.multiplier = 3;
  cost.unitCost = 100;
  cost.taxRateId = "tax_standard";
  budget.settings.taxRates.find((rate) => rate.id === "tax_standard").rate = 0.15;

  const result = computeBudget(budget);
  const row = result.itemMap.get(cost.id);
  assert.equal(row.subtotal, 600);
  assert.equal(row.tax, 90);
  assert.equal(row.total, 690);
});

test("extracts included tax without increasing the entered gross total", () => {
  const budget = createBudgetTemplate("Included tax test");
  const cost = item(budget, "1000", "1001");
  cost.quantity = 1;
  cost.multiplier = 1;
  cost.unitCost = 112;
  cost.taxRateId = "tax_standard";
  cost.taxMode = "included";

  const row = computeBudget(budget).itemMap.get(cost.id);
  assert.equal(row.subtotal, 100);
  assert.equal(row.tax, 12);
  assert.equal(row.total, 112);
});

test("calculates contingency from cash costs in above the line and production only", () => {
  const budget = createBudgetTemplate("Contingency test");
  const aboveLine = item(budget, "1000", "1001");
  const production = item(budget, "1500", "1501");
  const post = item(budget, "3200", "3201");
  const inKind = item(budget, "1600", "1601");

  Object.assign(aboveLine, { quantity: 1, multiplier: 1, unitCost: 1000 });
  Object.assign(production, { quantity: 1, multiplier: 1, unitCost: 2000 });
  Object.assign(post, { quantity: 1, multiplier: 1, unitCost: 4000 });
  Object.assign(inKind, { quantity: 1, multiplier: 1, unitCost: 5000, fundingKind: "in_kind" });
  budget.settings.contingencyRate = 0.05;

  const result = computeBudget(budget);
  const contingency = item(result.budget, "3700", "3701");
  assert.equal(result.contingencyBase, 3000);
  assert.equal(result.contingencyAmount, 150);
  assert.equal(result.itemMap.get(contingency.id).total, 150);
  assert.equal(result.total, 12150);
});

test("tracks funding, expenses and cumulative variance", () => {
  const budget = createBudgetTemplate("Finance test");
  const cost = item(budget, "1000", "1001");
  Object.assign(cost, { quantity: 1, multiplier: 1, unitCost: 1000 });
  budget.settings.contingencyRate = 0;
  budget.fundingSources = [
    { id: "fund_1", name: "Partner", type: "cash", amount: 800, paid: 500, status: "Partially paid" },
  ];
  budget.expenses = [
    { id: "expense_1", lineItemId: cost.id, paymentNumber: "1", vendor: "Vendor A", amount: 250 },
    { id: "expense_2", lineItemId: cost.id, paymentNumber: "2", vendor: "Vendor B", amount: 300 },
  ];

  const result = computeBudget(budget);
  assert.equal(result.fundingPlanned, 800);
  assert.equal(result.fundingReceived, 500);
  assert.equal(result.fundingGap, 200);
  assert.equal(result.spent, 550);
  assert.equal(result.remaining, 450);
  assert.equal(result.expenseRows[0].variance, 750);
  assert.equal(result.expenseRows[1].variance, 450);
});

test("reconciles budgeted, over-budget, and unexpected production costs", () => {
  const budget = createBudgetTemplate("Actual cost reconciliation");
  const cost = item(budget, "1000", "1001");
  Object.assign(cost, { quantity: 1, multiplier: 1, unitCost: 1000 });
  budget.settings.contingencyRate = 0;
  budget.expenses = [
    { id: "linked_1", lineItemId: cost.id, paymentNumber: "1", amount: 250 },
    { id: "linked_2", lineItemId: cost.id, paymentNumber: "2", amount: 900 },
    { id: "unexpected_1", lineItemId: "", paymentNumber: "3", concept: "Last-minute permit", amount: 125 },
    { id: "unexpected_2", lineItemId: "", paymentNumber: "4", concept: "Replacement cable", amount: 200 },
  ];

  const result = computeBudget(budget);
  assert.equal(result.total, 1000);
  assert.equal(result.spent, 1475);
  assert.equal(result.remaining, -475);
  assert.equal(result.budgetedSpent, 1150);
  assert.equal(result.unbudgetedSpent, 325);
  assert.equal(result.unassignedSpent, 325);
  assert.equal(result.unbudgetedCount, 2);
  assert.equal(result.overBudgetSpent, 150);
  assert.equal(result.overBudgetLineCount, 1);
  assert.equal(result.expenseRows[0].lineBalance, -150);
  assert.equal(result.expenseRows[1].lineBalance, -150);
  assert.equal(result.expenseRows[2].variance, -125);
  assert.equal(result.expenseRows[3].variance, -200);
  assert.equal(result.expenseRows[2].varianceState, "unbudgeted");
  assert.equal(result.expenseRows[1].varianceState, "over");
});

test("exposes overfunding as a negative balance for a surplus presentation", () => {
  const budget = createBudgetTemplate("Surplus test");
  const cost = item(budget, "1000", "1001");
  Object.assign(cost, { quantity: 1, multiplier: 1, unitCost: 1000 });
  budget.settings.contingencyRate = 0;
  budget.fundingSources = [
    { id: "fund_surplus", name: "Partner", type: "cash", amount: 1500, paid: 1500, status: "Received" },
  ];

  const result = computeBudget(budget);
  assert.equal(result.total, 1000);
  assert.equal(result.fundingGap, -500);
});

test("builds a weekly timeline and safely migrates legacy shoot, wrap, and monthly post schedules", () => {
  const periods = buildWeeklyPeriods({ prepWeeks: 2, shootWeeks: 3, wrapWeeks: 1, postWeeks: 2 });
  assert.deepEqual(periods.map((period) => period.id), [
    "prep_2", "prep_1", "shoot_1", "shoot_2", "shoot_3", "wrap_1", "post_1", "post_2",
  ]);

  const legacy = createBudgetTemplate("Legacy schedule");
  legacy.version = 1;
  legacy.timeline = { shootWeeks: 2 };
  legacy.periods = [
    { id: "prep_5", label: "Prep Week 5" },
    { id: "shoot", label: "Shoot" },
    { id: "wrap", label: "Wrap" },
    { id: "post_1", label: "Post Month 1" },
    { id: "post_2", label: "Post Month 2" },
    { id: "post_3", label: "Post Month 3" },
    { id: "post_4", label: "Post Month 4" },
  ];
  const cost = item(legacy, "1000", "1001");
  cost.schedule = { shoot: 121, wrap: 30, post_1: 401, post_2: 800, post_4: 4 };

  const normalized = normalizeBudget(legacy);
  const migrated = item(normalized, "1000", "1001");
  assert.equal(normalized.version, 2);
  assert.equal(normalized.timeline.shootWeeks, 2);
  assert.equal(normalized.timeline.postWeeks, 16);
  assert.equal(migrated.schedule.shoot_1, 60.5);
  assert.equal(migrated.schedule.shoot_2, 60.5);
  assert.equal(migrated.schedule.wrap_1, 30);
  assert.deepEqual(
    [1, 2, 3, 4].map((week) => migrated.schedule[`post_${week}`]),
    [100.25, 100.25, 100.25, 100.25],
  );
  assert.deepEqual(
    [5, 6, 7, 8].map((week) => migrated.schedule[`post_${week}`]),
    [200, 200, 200, 200],
  );
  assert.deepEqual(
    [13, 14, 15, 16].map((week) => migrated.schedule[`post_${week}`]),
    [1, 1, 1, 1],
  );
  assert.equal(Object.values(migrated.schedule).reduce((sum, amount) => sum + amount, 0), 1356);
  assert.ok(normalized.periods.every((period) => ["prep", "shoot", "wrap", "post"].includes(period.stage)));
});

test("separates weekly cash from in-kind timing and reports unscheduled cash", () => {
  const budget = createBudgetTemplate("Weekly cash");
  budget.settings.contingencyRate = 0;
  const cashCost = item(budget, "1000", "1001");
  const inKindCost = item(budget, "1600", "1601");
  Object.assign(cashCost, { quantity: 1, multiplier: 1, unitCost: 1000 });
  Object.assign(inKindCost, { quantity: 1, multiplier: 1, unitCost: 500, fundingKind: "in_kind" });
  cashCost.schedule.prep_1 = 400;
  cashCost.schedule.shoot_1 = 350;
  inKindCost.schedule.shoot_1 = 500;
  budget.expenses = [
    { id: "cash_payment", lineItemId: cashCost.id, paymentDate: "2026-08-01", amount: 125 },
    { id: "in_kind_record", lineItemId: inKindCost.id, paymentDate: "2026-08-01", amount: 75 },
  ];

  const result = computeBudget(budget);
  assert.equal(result.scheduleTotals.shoot_1, 850);
  assert.equal(result.scheduleCashTotals.shoot_1, 350);
  assert.equal(result.scheduleInKindTotals.shoot_1, 500);
  assert.equal(result.scheduledCashTotal, 750);
  assert.equal(result.scheduledInKindTotal, 500);
  assert.equal(result.unscheduledCashTotal, 250);
  assert.equal(result.overScheduledCashTotal, 0);
  assert.equal(result.cashSpent, 125);
  assert.equal(result.inKindSpent, 75);
  assert.equal(result.expenseRows[1].fundingKind, "in_kind");
});

test("keeps legacy over-scheduling auditable while normalizing negative weekly amounts", () => {
  const budget = createBudgetTemplate("Schedule controls");
  budget.settings.contingencyRate = 0;
  const cost = item(budget, "1000", "1001");
  Object.assign(cost, { quantity: 1, multiplier: 1, unitCost: 1000 });
  cost.schedule.prep_1 = -50;
  cost.schedule.shoot_1 = 1200;

  const result = computeBudget(budget);
  const row = result.itemMap.get(cost.id);
  assert.equal(row.schedule.prep_1, 0);
  assert.equal(row.scheduled, 1200);
  assert.equal(row.unscheduled, 0);
  assert.equal(row.overScheduled, 200);
  assert.equal(result.overScheduledCashTotal, 200);
});
