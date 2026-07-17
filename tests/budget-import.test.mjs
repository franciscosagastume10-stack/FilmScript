import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBudgetTemplate, computeBudget } from '../budget-model.js';
import { applyBudgetImport, normalizeBudgetImportProposal } from '../budget-import-model.js';

test('budget import normalizes source rows and keeps quantities whole', () => {
  const budget = createBudgetTemplate('Import test');
  const proposal = normalizeBudgetImportProposal({
    source: { filename: 'production.xlsx', type: 'excel' },
    accounts: [{
      code: '1900', name: 'Camera Equipment', phaseId: 'production', items: [{
        code: '1901', name: 'Camera package', quantity: 2.8, unit: 'day', multiplier: 3, unitCost: 1250,
        tax: 'VAT', schedule: { prep_1: 2000, unknown_week: 4000 }, confidence: 0.92,
      }],
    }],
  }, budget);
  const item = proposal.accounts[0].items[0];
  assert.equal(item.quantity, 2);
  assert.equal(item.taxRateId, 'tax_standard');
  assert.deepEqual(item.schedule, { prep_1: 2000 });
  assert.equal(proposal.source.type, 'excel');
});

test('budget import merges matched lines, creates new lines, and links imported expenses', () => {
  const budget = createBudgetTemplate('Import test');
  const merged = applyBudgetImport(budget, {
    accounts: [{
      code: '1900', name: 'Camera Equipment', phaseId: 'production', items: [
        { code: '1901', name: 'Camera package with lenses', quantity: 2, multiplier: 3, unitCost: 1000, schedule: { shoot_1: 6000 } },
        { code: '1999', name: 'Drone rental', quantity: 1, multiplier: 2, unitCost: 500 },
      ],
    }],
    fundingSources: [{ name: 'Guatemala Film Fund', amount: 5000, paid: 2500 }],
    expenses: [{ code: '1999', concept: 'Drone deposit', amount: 300 }],
  }, 'Import test');
  const camera = merged.accounts.find((account) => account.code === '1900');
  assert.equal(camera.items.find((item) => item.code === '1901').unitCost, 1000);
  assert.equal(camera.items.find((item) => item.code === '1999').unitCost, 500);
  assert.equal(merged.fundingSources[0].name, 'Guatemala Film Fund');
  assert.equal(merged.expenses[0].lineItemId, camera.items.find((item) => item.code === '1999').id);
  assert.equal(computeBudget(merged, 'Import test').spent, 300);
});

test('Budget exposes a Lumiere import preview and confirmation path', () => {
  const workspace = fs.readFileSync(new URL('../budget-workspace.js', import.meta.url), 'utf8');
  const client = fs.readFileSync(new URL('../budget-client.js', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(workspace, /Import Budget/);
  assert.match(workspace, /Analyze with Lumiere/);
  assert.match(workspace, /commit-import/);
  assert.match(client, /importBudget[\s\S]*budgetPath\(scriptId, '\/import'\)/);
  assert.match(server, /googleDocsExportUrl/);
  assert.match(server, /spreadsheetText/);
  assert.match(server, /handleBudgetImport/);
  assert.match(server, /budgetImportProposals/);
});
