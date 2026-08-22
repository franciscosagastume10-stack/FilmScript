#!/usr/bin/env node
import crypto from "node:crypto";
import { isMain, normalizeRelativePath, parseArgs, requiredArg, requireProductionConfirmation, stableStringify, writeJsonExclusive } from "./lib/common.mjs";

async function hashBody(body) {
  if (!body) throw new Error("S3 returned an object without a body");
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  for await (const chunk of body) {
    const buffer = Buffer.from(chunk);
    hash.update(buffer);
    bytes += buffer.length;
  }
  return { bytes, sha256: hash.digest("hex") };
}

export async function inventoryS3({ bucket, prefix = "", targetBucket = "filmscript-private", s3Client = null }) {
  const { GetObjectCommand, ListObjectsV2Command, S3Client } = await import("@aws-sdk/client-s3");
  const client = s3Client || new S3Client({});
  const listed = [];
  let continuationToken;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined, ContinuationToken: continuationToken }));
    for (const object of page.Contents || []) if (object.Key) listed.push(object);
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  listed.sort((left, right) => left.Key.localeCompare(right.Key));
  const entries = [];
  for (const object of listed) {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: object.Key }));
    const digest = await hashBody(response.Body);
    if (Number(object.Size) !== digest.bytes) throw new Error(`S3 object changed while inventorying: ${object.Key}`);
    entries.push({
      id: `s3:${object.Key}`,
      source: {
        type: "s3",
        bucket,
        key: object.Key,
        bytes: digest.bytes,
        sha256: digest.sha256,
        etag: String(object.ETag || "").replace(/^"|"$/g, "") || null,
      },
      target: { bucket: targetBucket, path: normalizeRelativePath(object.Key, "S3 object key") },
      contentType: response.ContentType || "application/octet-stream",
      lastModified: object.LastModified ? new Date(object.LastModified).toISOString() : null,
      metadata: { legacyS3Bucket: bucket, legacyS3Key: object.Key },
    });
  }
  return {
    format: "filmscript-s3-inventory",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    bucket,
    prefix,
    objectCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.source.bytes, 0),
    dataSha256: crypto.createHash("sha256").update(stableStringify(entries.map((entry) => ({ key: entry.source.key, bytes: entry.source.bytes, sha256: entry.source.sha256 })))).digest("hex"),
    entries,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  requireProductionConfirmation(args, "S3 inventory read");
  const plan = {
    bucket: requiredArg(args, "bucket"),
    prefix: typeof args.prefix === "string" ? args.prefix : "",
    targetBucket: typeof args["target-bucket"] === "string" ? args["target-bucket"] : "filmscript-private",
  };
  if (args["dry-run"]) {
    process.stdout.write(`${JSON.stringify({ ok: true, dryRun: true, ...plan }, null, 2)}\n`);
    return;
  }
  const inventory = await inventoryS3(plan);
  writeJsonExclusive(requiredArg(args, "output"), inventory, 0o600);
  process.stdout.write(`${JSON.stringify({ ok: true, dryRun: false, objectCount: inventory.objectCount, totalBytes: inventory.totalBytes, dataSha256: inventory.dataSha256 }, null, 2)}\n`);
}

if (isMain(import.meta.url)) main().catch((error) => {
  process.stderr.write(`S3 inventory failed: ${error.message}\n`);
  process.exitCode = 1;
});
