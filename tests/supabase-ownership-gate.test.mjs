import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  databaseStableStringify,
  sha256,
  stableStringify,
} from "../scripts/supabase-migration/lib/common.mjs";
import { validateBundle } from "../scripts/supabase-migration/lib/bundle.mjs";
import { validateProjectOwnershipGraph } from "../scripts/supabase-migration/lib/project-ownership.mjs";
import { reconcilePostgres } from "../scripts/supabase-migration/reconcile.mjs";

const PRODUCTION_BUCKET = "filmscript-production-mediabucket-xzgdb1rat94u";

function tableDefinition(target, order, primaryKey, rows) {
  const columns = Object.keys(rows[0] || (target === "public.scripts"
    ? { id: null, user_id: null }
    : { id: null, project_id: null, user_id: null, project_role: null, status: null })).sort();
  const rowSha256 = sha256(rows.map((row) => `${stableStringify(row)}\n`).join(""));
  const databaseRowSha256 = sha256(rows.map((row) => `${databaseStableStringify(row)}\n`).join(""));
  return {
    target,
    order,
    dataFile: `tables/${target.replace(".", "/")}.ndjson`,
    primaryKey,
    columns,
    columnTypes: Object.fromEntries(columns.map((column) => [column, "scalar"])),
    rowCount: rows.length,
    rowSha256,
    databaseRowSha256,
    rows,
  };
}

function writeBundle({ scripts, memberships, validationMode = "full" }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "filmscript-ownership-gate-"));
  const tableDefinitions = [
    tableDefinition("public.scripts", 20, ["id"], scripts),
    tableDefinition("public.project_memberships", 40, ["id"], memberships),
  ];
  for (const table of tableDefinitions) {
    const filename = path.join(root, table.dataFile);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, table.rows.map((row) => `${JSON.stringify(row)}\n`).join(""));
  }
  const summaries = tableDefinitions.map(({ target, rowCount, rowSha256, databaseRowSha256 }) => ({
    target, rowCount, rowSha256, databaseRowSha256,
  }));
  const projectOwnership = validationMode === "full"
    ? { status: "verified", projectCount: scripts.length, activeOwnerCount: scripts.length }
    : { status: "not_enforced_partial_schema" };
  fs.writeFileSync(path.join(root, "manifest.json"), `${JSON.stringify({
    format: "filmscript-postgres-bundle",
    formatVersion: 1,
    validationMode,
    projectOwnership,
    source: {
      dataSha256: "a".repeat(64),
      s3Inventory: validationMode === "full" ? {
        bucket: PRODUCTION_BUCKET,
        prefix: "",
        objectCount: 0,
        totalBytes: 0,
        dataSha256: sha256(stableStringify([])),
      } : null,
    },
    dataSha256: sha256(stableStringify(summaries.map(({ target, rowCount, rowSha256 }) => ({ target, rowCount, rowSha256 })))),
    databaseDataSha256: sha256(stableStringify(summaries.map(({ target, rowCount, databaseRowSha256 }) => ({ target, rowCount, databaseRowSha256 })))),
    tables: tableDefinitions.map(({ rows: _rows, ...table }) => table),
  }, null, 2)}\n`);
  return root;
}

const script = { id: "scr_1", user_id: "usr_owner" };
const owner = {
  id: "mem_owner",
  project_id: "scr_1",
  user_id: "usr_owner",
  project_role: "owner",
  status: "active",
};

test("full bundle accepts exactly one active owner matching scripts.user_id", () => {
  const root = writeBundle({ scripts: [script], memberships: [owner] });
  try {
    const bundle = validateBundle(root);
    assert.equal(bundle.manifest.projectOwnership.status, "verified");
    assert.deepEqual(validateProjectOwnershipGraph({ scripts: [script], memberships: [owner] }), {
      projectCount: 1,
      activeOwnerCount: 1,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("full bundle rejects a project with no active owner", () => {
  const root = writeBundle({ scripts: [script], memberships: [] });
  try {
    assert.throws(() => validateBundle(root), /has 0 active owner memberships; expected exactly 1/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("full bundle rejects duplicate active owners", () => {
  const root = writeBundle({
    scripts: [script],
    memberships: [owner, { ...owner, id: "mem_second_owner", user_id: "usr_second" }],
  });
  try {
    assert.throws(() => validateBundle(root), /has 2 active owner memberships; expected exactly 1/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("full bundle rejects an active owner that differs from scripts.user_id", () => {
  const root = writeBundle({ scripts: [script], memberships: [{ ...owner, user_id: "usr_wrong" }] });
  try {
    assert.throws(() => validateBundle(root), /owner membership does not match scripts\.user_id/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("full bundle rejects an owner membership for a nonexistent project", () => {
  const root = writeBundle({ scripts: [script], memberships: [{ ...owner, project_id: "scr_missing" }] });
  try {
    assert.throws(() => validateBundle(root), /owner membership .* references nonexistent project scr_missing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("partial fixtures may omit ownership, but cannot reconcile as a remote cutover", () => {
  const root = writeBundle({ scripts: [script], memberships: [], validationMode: "partial" });
  try {
    assert.equal(validateBundle(root).manifest.validationMode, "partial");
    assert.throws(() => reconcilePostgres({
      bundleDirectory: root,
      captureManifest: {
        format: "filmscript-postgres-capture",
        formatVersion: 1,
        target: {
          host: "aaaaaaaaaaaaaaaaaaaa.supabase.co",
          environment: "staging",
          projectRef: "aaaaaaaaaaaaaaaaaaaa",
        },
      },
      expectedEnvironment: "staging",
      expectedProjectRef: "aaaaaaaaaaaaaaaaaaaa",
    }), /partial-schema bundle/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
