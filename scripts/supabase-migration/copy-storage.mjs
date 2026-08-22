#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  assertLocalEndpoint,
  assertSupabaseProjectRef,
  STORAGE_MANIFEST_VERSION,
  assertRegularFile,
  isMain,
  normalizeRelativePath,
  parseArgs,
  readJson,
  requiredArg,
  requireProductionConfirmation,
  resolveInside,
  sha256,
  sha256File,
  stableStringify,
  storageContractDataSha256,
  validateSupabaseServiceUrl,
  writeJsonExclusive,
} from "./lib/common.mjs";

const REQUIRED_FULL_S3_SOURCE_BUCKET = "filmscript-production-mediabucket-xzgdb1rat94u";

export function validateStorageManifest(manifestDirectory) {
  const root = path.resolve(manifestDirectory);
  const manifest = readJson(path.join(root, "manifest.json"), "Storage manifest");
  if (manifest.format !== "filmscript-storage-manifest" || manifest.formatVersion !== STORAGE_MANIFEST_VERSION) throw new Error("Unsupported Storage manifest format");
  if (manifest.sourceBundleValidationMode !== "full" && manifest.sourceBundleValidationMode !== "partial") {
    throw new Error("Storage manifest must declare its source bundle validation mode");
  }
  if (manifest.entries.length !== manifest.objectCount) throw new Error("Storage object count mismatch");
  const targets = new Set();
  for (const entry of manifest.entries) {
    if (!/^[0-9a-f]{64}$/i.test(entry.source?.sha256 || "")) throw new Error(`Invalid SHA-256 for ${entry.id}`);
    if (!Number.isSafeInteger(entry.source.bytes) || entry.source.bytes < 0) throw new Error(`Invalid byte count for ${entry.id}`);
    entry.target.path = normalizeRelativePath(entry.target.path, `${entry.id} target path`);
    const target = `${entry.target.bucket}/${entry.target.path}`;
    if (targets.has(target)) throw new Error(`Duplicate Storage target: ${target}`);
    targets.add(target);
    if (entry.source.type === "file") {
      const filename = resolveInside(root, entry.source.path, `${entry.id} local source`);
      const stats = assertRegularFile(filename, `${entry.id} local source`);
      if (stats.size !== entry.source.bytes || sha256File(filename) !== entry.source.sha256) throw new Error(`Local source checksum mismatch for ${entry.id}`);
    } else if (entry.source.type !== "s3" || !entry.source.bucket || !entry.source.key) {
      throw new Error(`Unsupported Storage source for ${entry.id}`);
    }
  }
  const totalBytes = manifest.entries.reduce((sum, entry) => sum + entry.source.bytes, 0);
  if (totalBytes !== manifest.totalBytes) throw new Error("Storage total byte count mismatch");
  const dataSha256 = sha256(stableStringify(manifest.entries.map((entry) => ({
    id: entry.id,
    sourceSha256: entry.source.sha256,
    bytes: entry.source.bytes,
    bucket: entry.target.bucket,
    path: entry.target.path,
  }))));
  if (dataSha256 !== manifest.dataSha256) throw new Error("Storage manifest checksum mismatch");
  const contractSha256 = storageContractDataSha256(manifest.entries);
  if (contractSha256 !== manifest.contractSha256 || contractSha256 !== manifest.sourceStorageContractSha256) {
    throw new Error("Storage manifest no longer matches its source bundle contract");
  }
  if (manifest.sourceBundleValidationMode === "full") {
    const inventory = manifest.sourceS3Inventory;
    const s3Entries = manifest.entries.filter((entry) => entry.source.type === "s3");
    const inventoryEntries = [...s3Entries].sort((left, right) => left.source.key.localeCompare(right.source.key));
    const inventoryDataSha256 = sha256(stableStringify(inventoryEntries.map((entry) => ({
      key: entry.source.key,
      bytes: entry.source.bytes,
      sha256: entry.source.sha256,
    }))));
    if (inventory?.bucket !== REQUIRED_FULL_S3_SOURCE_BUCKET
      || inventory.prefix !== ""
      || inventory.objectCount !== s3Entries.length
      || inventory.totalBytes !== s3Entries.reduce((sum, entry) => sum + entry.source.bytes, 0)
      || inventory.dataSha256 !== inventoryDataSha256
      || s3Entries.some((entry) => entry.source.bucket !== inventory.bucket)) {
      throw new Error("Full Storage manifest does not match the complete production S3 inventory");
    }
  }
  return { root, manifest };
}

export function assertFullStorageManifestForRemoteApply(manifest) {
  if (manifest?.sourceBundleValidationMode !== "full") {
    throw new Error("Refusing remote Storage copy from a partial-schema bundle");
  }
  return manifest;
}

async function loadSource(entry, root, s3Client) {
  if (entry.source.type === "file") return fs.readFileSync(resolveInside(root, entry.source.path, `${entry.id} local source`));
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const response = await s3Client.send(new GetObjectCommand({ Bucket: entry.source.bucket, Key: entry.source.key }));
  const bytes = Buffer.from(await response.Body.transformToByteArray());
  return bytes;
}

async function verifiedExistingObject({ baseUrl, serviceRoleKey, entry }) {
  const pathSegments = entry.target.path.split("/").map(encodeURIComponent).join("/");
  const endpoint = new URL(`/storage/v1/object/authenticated/${encodeURIComponent(entry.target.bucket)}/${pathSegments}`, baseUrl);
  const response = await fetch(endpoint, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!response.ok) return false;
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.length === entry.source.bytes && sha256(bytes) === entry.source.sha256;
}

async function uploadObject({ baseUrl, serviceRoleKey, entry, bytes }) {
  const pathSegments = entry.target.path.split("/").map(encodeURIComponent).join("/");
  const endpoint = new URL(`/storage/v1/object/${encodeURIComponent(entry.target.bucket)}/${pathSegments}`, baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": entry.contentType || "application/octet-stream",
      "x-upsert": "false",
      "x-metadata": JSON.stringify({ ...entry.metadata, sha256: entry.source.sha256, migratedBy: "filmscript-supabase-migration-v1" }),
    },
    body: bytes,
  });
  if (!response.ok) {
    const message = (await response.text()).slice(0, 500);
    if ((response.status === 400 || response.status === 409) && /duplicate|already exists/i.test(message)) {
      if (await verifiedExistingObject({ baseUrl, serviceRoleKey, entry })) return "already_verified";
      throw new Error(`Storage target already exists with different bytes for ${entry.id}`);
    }
    throw new Error(`Storage upload failed for ${entry.id} (${response.status}): ${message}`);
  }
  return "uploaded";
}

export async function copyStorage({ manifestDirectory, baseUrl, serviceRoleKey }) {
  const { root, manifest } = validateStorageManifest(manifestDirectory);
  const { S3Client } = await import("@aws-sdk/client-s3");
  const s3Client = new S3Client({});
  const copied = [];
  for (const entry of manifest.entries) {
    const bytes = await loadSource(entry, root, s3Client);
    const digest = sha256(bytes);
    if (bytes.length !== entry.source.bytes || digest !== entry.source.sha256) throw new Error(`Source changed before copy: ${entry.id}`);
    const status = await uploadObject({ baseUrl, serviceRoleKey, entry, bytes });
    copied.push({ id: entry.id, bucket: entry.target.bucket, path: entry.target.path, bytes: bytes.length, sha256: digest, status });
  }
  return {
    format: "filmscript-storage-copy-report",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    expectedDataSha256: manifest.dataSha256,
    copiedCount: copied.length,
    totalBytes: copied.reduce((sum, entry) => sum + entry.bytes, 0),
    copied,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply && args["dry-run"]) throw new Error("Choose either --dry-run or --apply, not both");
  const validated = validateStorageManifest(requiredArg(args, "manifest"));
  if (!args.apply || args["dry-run"]) {
    process.stdout.write(`${JSON.stringify({ ok: true, dryRun: true, objectCount: validated.manifest.objectCount, totalBytes: validated.manifest.totalBytes, dataSha256: validated.manifest.dataSha256 }, null, 2)}\n`);
    return;
  }
  if (!args.environment) throw new Error("--apply requires an explicit --environment local, preview, staging, or production");
  const environment = requireProductionConfirmation(args, "Storage copy");
  const urlVariable = requiredArg(args, "supabase-url-env");
  const keyVariable = requiredArg(args, "service-role-key-env");
  const baseUrl = process.env[urlVariable];
  const serviceRoleKey = process.env[keyVariable];
  if (!baseUrl || !serviceRoleKey) throw new Error(`Environment variables ${urlVariable} and ${keyVariable} must both be set`);
  const parsedUrl = validateSupabaseServiceUrl(baseUrl);
  if (environment === "local") assertLocalEndpoint(baseUrl);
  else {
    assertFullStorageManifestForRemoteApply(validated.manifest);
    assertSupabaseProjectRef(baseUrl, requiredArg(args, "project-ref"));
  }
  const report = await copyStorage({ manifestDirectory: args.manifest, baseUrl, serviceRoleKey });
  if (args.output) writeJsonExclusive(args.output, report, 0o600);
  process.stdout.write(`${JSON.stringify({ ok: true, dryRun: false, host: parsedUrl.hostname, copiedCount: report.copiedCount, totalBytes: report.totalBytes }, null, 2)}\n`);
}

if (isMain(import.meta.url)) main().catch((error) => {
  process.stderr.write(`Storage copy failed: ${error.message}\n`);
  process.exitCode = 1;
});
