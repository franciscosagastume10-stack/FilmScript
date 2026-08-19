import * as Y from "yjs";

const cleanBlock = (block = {}, fallbackId = "") => ({
  id: String(block.id || fallbackId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96),
  type: String(block.type || "action").slice(0, 24),
  text: String(block.text || "").slice(0, 20000),
});

export function stableBlockId(block, index) {
  if (block?.id) return cleanBlock(block).id;
  return `blk_${String(index).padStart(5, "0")}`;
}

export function createScriptDocument(blocks = [], snapshot = null) {
  const doc = new Y.Doc();
  if (snapshot?.length) Y.applyUpdate(doc, snapshot, "storage");
  if (!doc.getArray("blocks").length) {
    doc.transact(() => {
      const items = blocks.slice(0, 5000).map((block, index) => {
        const clean = cleanBlock(block, stableBlockId(block, index));
        const item = new Y.Map(); item.set("id", clean.id); item.set("type", clean.type); item.set("text", new Y.Text(clean.text)); return item;
      });
      doc.getArray("blocks").insert(0, items);
    }, "seed");
  }
  return doc;
}

export function scriptBlocksFromDocument(doc) {
  return doc.getArray("blocks").toArray().map((item, index) => cleanBlock({ id: item.get("id"), type: item.get("type"), text: item.get("text")?.toString?.() || "" }, `blk_${index}`));
}

export function encodeUpdate(update) { return Buffer.from(update).toString("base64"); }
export function decodeUpdate(value) {
  if (typeof value !== "string" || value.length > 12 * 1024 * 1024) throw Object.assign(new Error("invalid CRDT update"), { status: 400 });
  const update = new Uint8Array(Buffer.from(value, "base64"));
  if (!update.length || update.length > 8 * 1024 * 1024) throw Object.assign(new Error("invalid CRDT update"), { status: 400 });
  return update;
}

export class ScriptDocumentRegistry {
  constructor({ load, save, initialBlocks, materialize }) { this.documents = new Map(); this.load = load; this.save = save; this.initialBlocks = initialBlocks; this.materialize = materialize; }
  key(projectId, documentId) { return `${projectId}:${documentId}`; }
  open(projectId, documentId) {
    const key = this.key(projectId, documentId); if (this.documents.has(key)) return this.documents.get(key);
    const stored = this.load(projectId, documentId); const doc = createScriptDocument(this.initialBlocks(projectId), stored?.snapshot);
    const entry = { doc, touchedAt: Date.now() }; this.documents.set(key, entry); return entry;
  }
  snapshot(projectId, documentId) { const entry = this.open(projectId, documentId); entry.touchedAt = Date.now(); return Y.encodeStateAsUpdate(entry.doc); }
  apply(projectId, documentId, update) {
    const entry = this.open(projectId, documentId); Y.applyUpdate(entry.doc, update, "remote"); entry.touchedAt = Date.now();
    const snapshot = Y.encodeStateAsUpdate(entry.doc); const blocks = scriptBlocksFromDocument(entry.doc); const stored = this.save(projectId, documentId, "script", snapshot); this.materialize(projectId, blocks); return { blocks, snapshot, ...stored };
  }
  replace(projectId, documentId, blocks = []) {
    const entry = this.open(projectId, documentId); const before = Y.encodeStateVector(entry.doc); const array = entry.doc.getArray("blocks");
    entry.doc.transact(() => {
      const current = array.toArray(); const next = blocks.slice(0, 5000).map((block, index) => cleanBlock(block, current[index]?.get("id") || stableBlockId(block, index)));
      if (current.length !== next.length || current.some((item, index) => String(item.get("id")) !== next[index]?.id)) {
        const items = next.map((block) => { const item = new Y.Map(); item.set("id", block.id); item.set("type", block.type); item.set("text", new Y.Text(block.text)); return item; });
        if (array.length) array.delete(0, array.length); if (items.length) array.insert(0, items);
      } else next.forEach((block, index) => { const item = array.get(index); item.set("type", block.type); const text = item.get("text"); const existing = text.toString(); if (existing !== block.text) { let prefix=0; while(prefix<existing.length&&prefix<block.text.length&&existing[prefix]===block.text[prefix])prefix++; let suffix=0; while(suffix<existing.length-prefix&&suffix<block.text.length-prefix&&existing[existing.length-suffix-1]===block.text[block.text.length-suffix-1])suffix++; if(existing.length-prefix-suffix)text.delete(prefix,existing.length-prefix-suffix); if(block.text.length-prefix-suffix)text.insert(prefix,block.text.slice(prefix,block.text.length-suffix)); } });
    }, "legacy");
    const snapshot = Y.encodeStateAsUpdate(entry.doc); const update = Y.encodeStateAsUpdate(entry.doc, before); const materialized = scriptBlocksFromDocument(entry.doc); const stored = this.save(projectId, documentId, "script", snapshot); this.materialize(projectId, materialized); return { blocks:materialized, update, ...stored };
  }
  closeProject(projectId) { for (const key of this.documents.keys()) if (key.startsWith(`${projectId}:`)) this.documents.delete(key); }
}
