#!/usr/bin/env node
import {
  assertCaptureTarget,
  assertLocalEndpoint,
  assertSupabaseProjectRef,
  isMain,
  parseArgs,
  requiredArg,
  requireProductionConfirmation,
  sha256,
  stableStringify,
  validateSupabaseServiceUrl,
  writeJsonExclusive,
} from "./lib/common.mjs";
import { validateStorageManifest } from "./copy-storage.mjs";

function authenticatedObjectUrl(baseUrl, entry) {
  const pathSegments = entry.target.path.split("/").map(encodeURIComponent).join("/");
  return new URL(`/storage/v1/object/authenticated/${encodeURIComponent(entry.target.bucket)}/${pathSegments}`, baseUrl);
}

export async function captureStorage({ manifestDirectory, baseUrl, serviceRoleKey, environment = null, projectRef = null, fetchImpl = fetch }) {
  const { manifest } = validateStorageManifest(manifestDirectory);
  const entries = [];
  for (const expected of manifest.entries) {
    const response = await fetchImpl(authenticatedObjectUrl(baseUrl, expected), {
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!response.ok) {
      entries.push({ id: expected.id, bucket: expected.target.bucket, path: expected.target.path, status: response.status, bytes: null, sha256: null });
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    entries.push({
      id: expected.id,
      bucket: expected.target.bucket,
      path: expected.target.path,
      status: response.status,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  const dataSha256 = sha256(stableStringify(entries.map((entry) => ({
    id: entry.id,
    sourceSha256: entry.sha256,
    bytes: entry.bytes,
    bucket: entry.bucket,
    path: entry.path,
  }))));
  const capture = {
    format: "filmscript-storage-capture",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    objectCount: entries.filter((entry) => entry.status >= 200 && entry.status < 300).length,
    totalBytes: entries.reduce((sum, entry) => sum + (entry.bytes || 0), 0),
    dataSha256,
    entries,
  };
  if (environment) {
    capture.target = assertCaptureTarget({
      host: new URL(baseUrl).hostname,
      projectRef,
      environment,
    });
  }
  return capture;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const validated = validateStorageManifest(requiredArg(args, "manifest"));
  if (args["dry-run"]) {
    process.stdout.write(`${JSON.stringify({ ok: true, dryRun: true, objectCount: validated.manifest.objectCount, totalBytes: validated.manifest.totalBytes }, null, 2)}\n`);
    return;
  }
  if (!args.environment) throw new Error("Storage capture requires --environment local, preview, staging, or production");
  const environment = requireProductionConfirmation(args, "Storage reconciliation read");
  const urlVariable = requiredArg(args, "supabase-url-env");
  const keyVariable = requiredArg(args, "service-role-key-env");
  const baseUrl = process.env[urlVariable];
  const serviceRoleKey = process.env[keyVariable];
  if (!baseUrl || !serviceRoleKey) throw new Error(`Environment variables ${urlVariable} and ${keyVariable} must both be set`);
  validateSupabaseServiceUrl(baseUrl);
  const projectRef = environment === "local" ? null : requiredArg(args, "project-ref");
  if (environment === "local") assertLocalEndpoint(baseUrl);
  else assertSupabaseProjectRef(baseUrl, projectRef);
  const capture = await captureStorage({ manifestDirectory: args.manifest, baseUrl, serviceRoleKey, environment, projectRef });
  writeJsonExclusive(requiredArg(args, "output"), capture, 0o600);
  process.stdout.write(`${JSON.stringify({ ok: true, dryRun: false, host: new URL(baseUrl).hostname, objectCount: capture.objectCount, totalBytes: capture.totalBytes, dataSha256: capture.dataSha256 }, null, 2)}\n`);
}

if (isMain(import.meta.url)) main().catch((error) => {
  process.stderr.write(`Storage capture failed: ${error.message}\n`);
  process.exitCode = 1;
});
