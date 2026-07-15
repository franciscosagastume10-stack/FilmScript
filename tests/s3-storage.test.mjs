import assert from "node:assert/strict";
import test from "node:test";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { S3ObjectStorage } from "../s3-storage.js";

class FakeS3Client {
  commands = [];

  async send(command) {
    this.commands.push(command);
    if (command instanceof GetObjectCommand) {
      return { Body: { transformToByteArray: async () => Uint8Array.from([1, 2, 3]) } };
    }
    return {};
  }
}

test("S3 storage keeps private assets in scoped deterministic keys", async () => {
  const client = new FakeS3Client();
  const storage = new S3ObjectStorage({
    namespace: "shot-references",
    bucket: "filmscript-private",
    prefix: "/production/filmscript/",
    region: "us-east-1",
    client,
  });

  const stored = await storage.put({
    scriptId: "scr_123",
    assetId: "ref_456",
    mimeType: "image/png",
    data: Buffer.from([1, 2, 3]),
  });

  assert.deepEqual(stored, {
    provider: "s3",
    key: "production/filmscript/shot-references/scr_123/ref_456.png",
  });
  assert.ok(client.commands[0] instanceof PutObjectCommand);
  assert.equal(client.commands[0].input.Bucket, "filmscript-private");
  assert.equal(client.commands[0].input.ContentType, "image/png");
  assert.equal(client.commands[0].input.ServerSideEncryption, "AES256");

  const data = await storage.get(stored);
  assert.deepEqual(data, Buffer.from([1, 2, 3]));
  assert.ok(client.commands[1] instanceof GetObjectCommand);

  await storage.remove(stored);
  assert.ok(client.commands[2] instanceof DeleteObjectCommand);
  assert.equal(client.commands[2].input.Key, stored.key);
});

test("S3 storage rejects unsafe ids, unsupported media, and foreign keys", async () => {
  const storage = new S3ObjectStorage({
    namespace: "canvas",
    bucket: "filmscript-private",
    client: new FakeS3Client(),
  });

  await assert.rejects(
    storage.put({ scriptId: "../other", assetId: "asset", mimeType: "image/png", data: Buffer.alloc(0) }),
    /invalid script id/,
  );
  await assert.rejects(
    storage.put({ scriptId: "scr_1", assetId: "asset", mimeType: "image/svg+xml", data: Buffer.alloc(0) }),
    /unsupported S3 image type/,
  );
  await assert.rejects(
    storage.get({ key: "filmscript/shot-references/scr_1/asset.png" }),
    /invalid S3 storage key/,
  );
});
