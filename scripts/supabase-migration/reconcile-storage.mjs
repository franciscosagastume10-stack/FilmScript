#!/usr/bin/env node
import path from "node:path";
import { assertCaptureTarget, isMain, normalizeMigrationEnvironment, parseArgs, readJson, requiredArg } from "./lib/common.mjs";
import { validateStorageManifest } from "./copy-storage.mjs";

export function reconcileStorage({ manifestDirectory, captureManifest, expectedEnvironment = null, expectedProjectRef = null }) {
  const { manifest } = validateStorageManifest(manifestDirectory);
  const destinationEnvironment = expectedEnvironment == null
    ? null
    : normalizeMigrationEnvironment(expectedEnvironment, "expected capture environment");
  const capture = typeof captureManifest === "string" ? readJson(path.resolve(captureManifest), "Storage capture manifest") : captureManifest;
  if (capture.format !== "filmscript-storage-capture" || capture.formatVersion !== 1) throw new Error("Unsupported Storage capture manifest");
  if (expectedEnvironment != null || expectedProjectRef != null) {
    assertCaptureTarget(capture.target, { expectedEnvironment: destinationEnvironment, expectedProjectRef });
  }
  if ((expectedProjectRef != null || (destinationEnvironment && destinationEnvironment !== "local"))
    && manifest.sourceBundleValidationMode !== "full") {
    throw new Error("Refusing remote Storage reconciliation for a partial-schema bundle");
  }
  const actual = new Map((capture.entries || []).map((entry) => [entry.id, entry]));
  const expectedIds = new Set(manifest.entries.map((entry) => entry.id));
  const differences = [];
  for (const expected of manifest.entries) {
    const entry = actual.get(expected.id);
    if (!entry) differences.push({ id: expected.id, issue: "missing_capture" });
    else if (entry.bucket !== expected.target.bucket || entry.path !== expected.target.path) {
      differences.push({ id: expected.id, issue: "target", expected: expected.target, actual: { bucket: entry.bucket, path: entry.path } });
    } else if (entry.bytes !== expected.source.bytes || entry.sha256 !== expected.source.sha256) {
      differences.push({ id: expected.id, issue: "content", expected: { bytes: expected.source.bytes, sha256: expected.source.sha256 }, actual: { bytes: entry.bytes, sha256: entry.sha256, status: entry.status } });
    }
  }
  for (const id of actual.keys()) if (!expectedIds.has(id)) differences.push({ id, issue: "unexpected_capture" });
  if (capture.objectCount !== manifest.objectCount) differences.push({ issue: "object_count", expected: manifest.objectCount, actual: capture.objectCount });
  if (capture.totalBytes !== manifest.totalBytes) differences.push({ issue: "total_bytes", expected: manifest.totalBytes, actual: capture.totalBytes });
  if (capture.dataSha256 !== manifest.dataSha256) differences.push({ issue: "manifest_checksum", expected: manifest.dataSha256, actual: capture.dataSha256 });
  return { ok: differences.length === 0, differences };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const expectedEnvironment = normalizeMigrationEnvironment(requiredArg(args, "expected-environment"), "expected capture environment");
  if (expectedEnvironment === "local" && args["expected-project-ref"]) {
    throw new Error("--expected-project-ref is not valid with --expected-environment local");
  }
  const expectedProjectRef = expectedEnvironment === "local" ? null : requiredArg(args, "expected-project-ref");
  const result = reconcileStorage({
    manifestDirectory: requiredArg(args, "manifest"),
    captureManifest: requiredArg(args, "capture"),
    expectedEnvironment,
    expectedProjectRef,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 2;
}

if (isMain(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Storage reconciliation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
