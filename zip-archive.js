const UTF8_FLAG = 0x0800;
const STORE_METHOD = 0;
const VERSION_20 = 20;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value) {
  const input = new Date(value || Date.now());
  const date = Number.isFinite(input.getTime()) ? input : new Date();
  const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()));
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);
  return {
    time: ((hours << 11) | (minutes << 5) | seconds) & 0xffff,
    date: (((year - 1980) << 9) | (month << 5) | day) & 0xffff,
  };
}

function localHeader({ name, data, modifiedAt }) {
  const filename = Buffer.from(name, "utf8");
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  const checksum = crc32(payload);
  const timestamp = dosDateTime(modifiedAt);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(VERSION_20, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(STORE_METHOD, 8);
  header.writeUInt16LE(timestamp.time, 10);
  header.writeUInt16LE(timestamp.date, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(payload.length, 18);
  header.writeUInt32LE(payload.length, 22);
  header.writeUInt16LE(filename.length, 26);
  header.writeUInt16LE(0, 28);
  return { header, filename, payload, checksum, timestamp };
}

function centralHeader({ filename, payload, checksum, timestamp, offset }) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(VERSION_20, 4);
  header.writeUInt16LE(VERSION_20, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(STORE_METHOD, 10);
  header.writeUInt16LE(timestamp.time, 12);
  header.writeUInt16LE(timestamp.date, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(payload.length, 20);
  header.writeUInt32LE(payload.length, 24);
  header.writeUInt16LE(filename.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, filename]);
}

function endOfCentralDirectory({ count, size, offset }) {
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50, 0);
  footer.writeUInt16LE(0, 4);
  footer.writeUInt16LE(0, 6);
  footer.writeUInt16LE(count, 8);
  footer.writeUInt16LE(count, 10);
  footer.writeUInt32LE(size, 12);
  footer.writeUInt32LE(offset, 16);
  footer.writeUInt16LE(0, 20);
  return footer;
}

function writeChunk(writable, chunk) {
  if (writable.destroyed) return Promise.reject(new Error("ZIP output closed"));
  if (writable.write(chunk)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      writable.off("drain", onDrain);
      writable.off("error", onError);
      writable.off("close", onClose);
    };
    const onDrain = () => { cleanup(); resolve(); };
    const onError = (error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error("ZIP output closed")); };
    writable.once("drain", onDrain);
    writable.once("error", onError);
    writable.once("close", onClose);
  });
}

async function writeStoredZip(writable, entries, { maxBytes = 160 * 1024 * 1024 } = {}) {
  if (!writable || typeof writable.write !== "function") throw new Error("ZIP output is required");
  if (!Array.isArray(entries) || !entries.length || entries.length > 0xffff) {
    throw new Error("ZIP entries are required");
  }
  const central = [];
  let offset = 0;
  let totalBytes = 0;
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : await entry.load();
    if (!Buffer.isBuffer(data)) throw new Error("ZIP entry data must be a Buffer");
    totalBytes += data.length;
    if (totalBytes > maxBytes) {
      throw Object.assign(new Error("Imagine download is too large."), {
        status: 413,
        code: "imaging_download_too_large",
      });
    }
    const local = localHeader({ name: entry.name, data, modifiedAt: entry.modifiedAt });
    await writeChunk(writable, local.header);
    await writeChunk(writable, local.filename);
    await writeChunk(writable, local.payload);
    central.push(centralHeader({ ...local, offset }));
    offset += local.header.length + local.filename.length + local.payload.length;
  }
  const centralOffset = offset;
  let centralSize = 0;
  for (const part of central) {
    await writeChunk(writable, part);
    centralSize += part.length;
  }
  writable.end(endOfCentralDirectory({ count: entries.length, size: centralSize, offset: centralOffset }));
  return { count: entries.length, totalBytes };
}

export { crc32, writeStoredZip };
