#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  STORAGE_MANIFEST_VERSION,
  createExclusiveDirectory,
  isMain,
  normalizeRelativePath,
  parseArgs,
  requiredArg,
  resolveInside,
  sha256,
  sha256File,
  stableStringify,
  storageContractDataSha256,
  writeJsonExclusive,
} from "./lib/common.mjs";
import { loadStoragePlan } from "./lib/bundle.mjs";

export function createStorageManifest({ bundleDirectory, outputDirectory }) {
  const { bundle, plan } = loadStoragePlan(bundleDirectory);
  const output = createExclusiveDirectory(outputDirectory);
  const entries = [];
  for (const entry of plan.entries.filter((candidate) => candidate.source.type === "file")) {
    const source = resolveInside(bundle.root, entry.source.path, `${entry.id} source`);
    const relative = normalizeRelativePath(path.posix.join("objects", entry.source.sha256.slice(0, 2), `${entry.source.sha256}.bin`));
    const destination = resolveInside(output, relative, `${entry.id} staged object`);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    if (!fs.existsSync(destination)) {
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(destination, 0o600);
    }
    if (sha256File(destination) !== entry.source.sha256) throw new Error(`Staged checksum mismatch for ${entry.id}`);
    entries.push({ ...entry, source: { ...entry.source, path: relative } });
  }
  entries.push(...plan.entries.filter((entry) => entry.source.type === "s3"));
  entries.sort((left, right) => `${left.target.bucket}/${left.target.path}`.localeCompare(`${right.target.bucket}/${right.target.path}`));
  const targets = new Set();
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate Storage manifest id: ${entry.id}`);
    ids.add(entry.id);
    entry.target.path = normalizeRelativePath(entry.target.path, `${entry.id} target path`);
    const target = `${entry.target.bucket}/${entry.target.path}`;
    if (targets.has(target)) throw new Error(`Two sources map to the same Storage object: ${target}`);
    targets.add(target);
  }
  const manifest = {
    format: "filmscript-storage-manifest",
    formatVersion: STORAGE_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    sourceBundleValidationMode: bundle.manifest.validationMode,
    sourceS3Inventory: bundle.manifest.source?.s3Inventory || null,
    sourceDatabaseDataSha256: bundle.manifest.source.dataSha256,
    sourceBundleDataSha256: bundle.manifest.databaseDataSha256,
    sourceStoragePlanSha256: plan.dataSha256,
    sourceStorageContractSha256: plan.contractSha256,
    objectCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.source.bytes, 0),
    dataSha256: sha256(stableStringify(entries.map((entry) => ({
      id: entry.id,
      sourceSha256: entry.source.sha256,
      bytes: entry.source.bytes,
      bucket: entry.target.bucket,
      path: entry.target.path,
    })))),
    contractSha256: storageContractDataSha256(entries),
    entries,
  };
  writeJsonExclusive(path.join(output, "manifest.json"), manifest, 0o600);
  return manifest;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = createStorageManifest({
    bundleDirectory: requiredArg(args, "bundle"),
    outputDirectory: requiredArg(args, "output"),
  });
  process.stdout.write(`${JSON.stringify({ ok: true, objectCount: manifest.objectCount, totalBytes: manifest.totalBytes, dataSha256: manifest.dataSha256 }, null, 2)}\n`);
}

if (isMain(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Storage manifest failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
