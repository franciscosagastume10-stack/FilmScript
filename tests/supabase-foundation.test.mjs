import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

test("Supabase local configuration is stable and never exposes private schemas", () => {
  const config = read("supabase/config.toml");
  assert.match(config, /project_id = "filmscript"/);
  assert.match(config, /schemas = \["public", "graphql_public"\]/);
  assert.doesNotMatch(config, /schemas = \[[^\]]*"private"/);
  assert.doesNotMatch(config, /schemas = \[[^\]]*"billing"/);
  assert.match(config, /site_url = "http:\/\/127\.0\.0\.1:4173"/);
});

test("production migrations target only the paid FilmScript project and require approval", () => {
  const workflow = read(".github/workflows/supabase-production.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /inputs\.confirmation == 'DEPLOY'/);
  assert.ok((workflow.match(/environment: supabase-production/g) || []).length >= 2, "plan and apply require separate protected-environment approvals");
  assert.match(workflow, /SUPABASE_PROJECT_REF: nkuyfryxookojkvductn/);
  assert.doesNotMatch(workflow, /bslvwnaqlriraudlpkxm/);
  const planJob = workflow.indexOf("\n  plan:");
  const applyJob = workflow.indexOf("\n  apply:");
  const firstDryRun = workflow.indexOf("supabase db push --dry-run", planJob);
  const apply = workflow.indexOf("supabase db push --include-all", applyJob);
  assert.ok(planJob >= 0 && applyJob > planJob, "apply must be a separate job after plan");
  assert.ok(firstDryRun > planJob && firstDryRun < applyJob && apply > applyJob, "reviewed dry-run must finish before the apply approval");
  assert.match(workflow, /apply:[\s\S]*?needs: plan[\s\S]*?environment: supabase-production/);
});

test("pull requests rebuild and lint a local database without production secrets", () => {
  const workflow = read(".github/workflows/supabase-check.yml");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /version: 2\.115\.0/);
  assert.match(workflow, /supabase db reset/);
  assert.match(workflow, /supabase db lint --local --level warning --fail-on warning/);
  assert.doesNotMatch(workflow, /SUPABASE_ACCESS_TOKEN/);
  assert.doesNotMatch(workflow, /SUPABASE_DB_PASSWORD/);
});
