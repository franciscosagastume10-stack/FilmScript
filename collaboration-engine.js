import crypto from "node:crypto";

export const COLLABORATOR_COLORS = Object.freeze(["#2E7D5B", "#2F6FED", "#9B51E0", "#D35400", "#C74440", "#007C91", "#8A6D00", "#AD3D78"]);

export function collaboratorColor(userId) {
  const digest = crypto.createHash("sha256").update(String(userId || "guest")).digest();
  return COLLABORATOR_COLORS[digest[0] % COLLABORATOR_COLORS.length];
}

export function applyVersionedPatch(entity, operation) {
  const current = entity && typeof entity === "object" ? structuredClone(entity) : { id: operation.entityId, version: 0 };
  const currentVersion = Number(current.version) || 0;
  const baseVersion = Number(operation.baseVersion) || 0;
  const patch = operation.patch && typeof operation.patch === "object" && !Array.isArray(operation.patch) ? operation.patch : {};
  const previous = operation.previous && typeof operation.previous === "object" ? operation.previous : {};
  const changedFields = [];
  const conflicts = [];
  for (const [field, value] of Object.entries(patch)) {
    if (baseVersion < currentVersion && Object.prototype.hasOwnProperty.call(previous, field) && !Object.is(current[field], previous[field]) && !Object.is(current[field], value)) {
      conflicts.push({ field, currentValue: current[field], incomingValue: value, previousValue: previous[field] });
      continue;
    }
    current[field] = value;
    changedFields.push(field);
  }
  current.version = currentVersion + (changedFields.length ? 1 : 0);
  current.updatedAt = new Date().toISOString();
  return { entity: current, changedFields, conflicts, stale: baseVersion < currentVersion };
}

export function throttleIntervalForEvent(type) {
  if (type === "cursor.updated") return 80;
  if (type === "selection.updated") return 120;
  if (type === "presence.updated") return 15_000;
  return 0;
}

export class CollaborationRooms {
  constructor({ idleMs = 90_000, expireMs = 5 * 60_000, now = () => Date.now() } = {}) {
    this.rooms = new Map(); this.idleMs = idleMs; this.expireMs = expireMs; this.now = now;
  }
  room(projectId) {
    if (!this.rooms.has(projectId)) this.rooms.set(projectId, { projectId, clients: new Map(), lastActiveAt: this.now(), sequence: 0 });
    return this.rooms.get(projectId);
  }
  join(projectId, client) {
    const room = this.room(projectId); const timestamp = this.now();
    room.clients.set(client.clientId, { ...client, color: collaboratorColor(client.userId || client.clientId), state: "active", lastSeenAt: timestamp });
    room.lastActiveAt = timestamp; room.sequence += 1;
    return room.clients.get(client.clientId);
  }
  update(projectId, clientId, patch) {
    const room = this.rooms.get(projectId); const client = room?.clients.get(clientId);
    if (!client) return null;
    Object.assign(client, patch, { lastSeenAt: this.now(), state: "active" }); room.lastActiveAt = this.now(); room.sequence += 1;
    return client;
  }
  leave(projectId, clientId) {
    const room = this.rooms.get(projectId); if (!room) return false;
    const removed = room.clients.delete(clientId); room.lastActiveAt = this.now(); room.sequence += removed ? 1 : 0; return removed;
  }
  sweep() {
    const timestamp = this.now(); const expired = [];
    for (const [projectId, room] of this.rooms) {
      for (const client of room.clients.values()) if (timestamp - client.lastSeenAt >= this.idleMs) client.state = "idle";
      if (!room.clients.size && timestamp - room.lastActiveAt >= this.expireMs) { this.rooms.delete(projectId); expired.push(projectId); }
    }
    return expired;
  }
  presence(projectId) { return [...(this.rooms.get(projectId)?.clients.values() || [])]; }
}

