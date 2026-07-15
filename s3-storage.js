import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function safeSegment(value, label) {
  const segment = String(value || "").trim();
  if (!segment || !/^[A-Za-z0-9._-]+$/.test(segment)) {
    throw new Error(`invalid ${label}`);
  }
  return segment;
}

function cleanPrefix(value) {
  const segments = String(value || "filmscript")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => safeSegment(segment, "S3 prefix"));
  return segments.join("/") || "filmscript";
}

async function bodyToBuffer(body) {
  if (!body) throw new Error("S3 object has no body");
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  if (typeof body.arrayBuffer === "function") {
    return Buffer.from(await body.arrayBuffer());
  }
  if (body[Symbol.asyncIterator]) {
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  throw new Error("unsupported S3 response body");
}

class S3ObjectStorage {
  name = "s3";

  constructor({
    namespace,
    bucket = process.env.FILMSCRIPT_S3_BUCKET,
    prefix = process.env.FILMSCRIPT_S3_PREFIX || "filmscript",
    region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
    client,
  } = {}) {
    this.namespace = safeSegment(namespace, "S3 namespace");
    this.bucket = String(bucket || "").trim();
    if (!this.bucket) throw new Error("FILMSCRIPT_S3_BUCKET is required for S3 storage");
    this.prefix = cleanPrefix(prefix);
    this.client = client || new S3Client(region ? { region } : {});
  }

  keyFor({ scriptId, assetId, mimeType }) {
    const extension = EXTENSIONS.get(mimeType);
    if (!extension) throw new Error("unsupported S3 image type");
    return [
      this.prefix,
      this.namespace,
      safeSegment(scriptId, "script id"),
      `${safeSegment(assetId, "asset id")}${extension}`,
    ].join("/");
  }

  async put({ scriptId, assetId, mimeType, data }) {
    const key = this.keyFor({ scriptId, assetId, mimeType });
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
    }));
    return { provider: this.name, key };
  }

  async get({ key }) {
    const objectKey = String(key || "");
    const expectedPrefix = `${this.prefix}/${this.namespace}/`;
    if (!objectKey.startsWith(expectedPrefix) || objectKey.includes("..")) {
      throw new Error("invalid S3 storage key");
    }
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    }));
    return bodyToBuffer(result.Body);
  }

  async remove({ key }) {
    if (!key) return;
    const objectKey = String(key);
    const expectedPrefix = `${this.prefix}/${this.namespace}/`;
    if (!objectKey.startsWith(expectedPrefix) || objectKey.includes("..")) {
      throw new Error("invalid S3 storage key");
    }
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    }));
  }
}

export { S3ObjectStorage, bodyToBuffer };
