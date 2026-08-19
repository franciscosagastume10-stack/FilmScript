import * as Y from "yjs";

const apiUrl = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
const bytesToBase64 = (bytes) => { let value = ""; for (let index = 0; index < bytes.length; index += 0x8000) value += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(value); };
const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const makeId = () => `blk_${crypto.randomUUID().replaceAll("-", "")}`;
const textPatch = (shared, next) => {
  const current = shared.toString(); if (current === next) return;
  let prefix = 0; while (prefix < current.length && prefix < next.length && current[prefix] === next[prefix]) prefix++;
  let suffix = 0; while (suffix < current.length - prefix && suffix < next.length - prefix && current[current.length - suffix - 1] === next[next.length - suffix - 1]) suffix++;
  if (current.length - prefix - suffix) shared.delete(prefix, current.length - prefix - suffix);
  if (next.length - prefix - suffix) shared.insert(prefix, next.slice(prefix, next.length - suffix));
};

class ScriptSession {
  constructor(projectId, clientId, onBlocks) { this.projectId = projectId; this.clientId = clientId; this.onBlocks = onBlocks; this.doc = new Y.Doc(); this.pending = []; this.sending = false; this.ready = false; }
  blocks() { return this.doc.getArray("blocks").toArray().map((item) => ({ id: String(item.get("id") || makeId()), type: String(item.get("type") || "action"), text: item.get("text")?.toString?.() || "" })); }
  async connect() {
    const response = await fetch(apiUrl(`/api/projects/${this.projectId}/collaboration/script`), { credentials:"include", cache:"no-store" });
    if (!response.ok) throw new Error("Could not connect screenplay collaboration");
    const data = await response.json(); Y.applyUpdate(this.doc, base64ToBytes(data.update), "remote"); this.ready = true;
    this.doc.on("update", (update, origin) => { if (origin === "local") { this.pending.push(update); this.flush(); } this.onBlocks?.(this.blocks(), origin); });
    this.onBlocks?.(this.blocks(), "initial");
    this.remoteListener = (event) => { if (event.detail?.documentId === `script:${this.projectId}` && event.detail?.update) Y.applyUpdate(this.doc, base64ToBytes(event.detail.update), "remote"); };
    window.addEventListener("filmscript:script.crdt", this.remoteListener);
    window.addEventListener("online", () => this.flush(), { passive:true });
    return this;
  }
  syncBlocks(input = []) {
    if (!this.ready) return;
    const next = input.map((block) => ({ id: String(block.id || makeId()), type: String(block.type || "action"), text: String(block.text || "") }));
    this.doc.transact(() => {
      const array = this.doc.getArray("blocks"); const existing = new Map(array.toArray().map((item) => [String(item.get("id")), item]));
      const sameOrder = array.length === next.length && array.toArray().every((item, index) => String(item.get("id")) === next[index].id);
      if (!sameOrder) {
        const items = next.map((block) => {
          const old = existing.get(block.id); if (old) { old.set("type", block.type); textPatch(old.get("text"), block.text); return old.clone(); }
          const item = new Y.Map(); item.set("id", block.id); item.set("type", block.type); item.set("text", new Y.Text(block.text)); return item;
        });
        if (array.length) array.delete(0, array.length); if (items.length) array.insert(0, items);
      } else for (let index = 0; index < next.length; index++) { const item = array.get(index); item.set("type", next[index].type); textPatch(item.get("text"), next[index].text); }
    }, "local");
  }
  async flush() {
    if (this.sending || !this.pending.length || !navigator.onLine) return;
    this.sending = true; const update = Y.mergeUpdates(this.pending.splice(0));
    try {
      const response = await fetch(apiUrl(`/api/projects/${this.projectId}/collaboration/script`), { method:"POST", credentials:"include", headers:{ "Content-Type":"application/json", "X-FilmScript-Client-Id":this.clientId }, body:JSON.stringify({ update:bytesToBase64(update) }) });
      if (!response.ok) throw new Error("CRDT update was rejected");
    } catch { this.pending.unshift(update); window.setTimeout(() => this.flush(), 2000); }
    finally { this.sending = false; if (this.pending.length) this.flush(); }
  }
  destroy() { if (this.remoteListener) window.removeEventListener("filmscript:script.crdt", this.remoteListener); this.doc.destroy(); }
}

window.FilmScriptRealtime = {
  async connectScript(projectId, options = {}) { return new ScriptSession(projectId, options.clientId || window.filmscriptPlatform?.clientId, options.onBlocks).connect(); },
};
