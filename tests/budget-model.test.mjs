import assert from "node:assert/strict";
import test from "node:test";

import { computeBudget, createBudgetTemplate } from "../budget-model.js";

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
