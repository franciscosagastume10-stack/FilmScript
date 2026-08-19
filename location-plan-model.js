const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const point = (value = {}) => ({ x: finite(value.x), y: finite(value.y) });

export function pointDistance(a, b) {
  return Math.hypot(finite(b?.x) - finite(a?.x), finite(b?.y) - finite(a?.y));
}

export function segmentLength(segment) {
  return pointDistance(segment?.start, segment?.end);
}

export function polylineLength(points) {
  return (Array.isArray(points) ? points : []).slice(1).reduce((sum, current, index) => sum + pointDistance(points[index], current), 0);
}

export function pointToSegmentDistance(target, start, end) {
  const p = point(target); const a = point(start); const b = point(end);
  const dx = b.x - a.x; const dy = b.y - a.y;
  if (!dx && !dy) return pointDistance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return pointDistance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function snapAngle(start, end, increments = [0, 45, 90, 135, 180, 225, 270, 315], thresholdDegrees = 6) {
  const a = point(start); const b = point(end);
  const length = pointDistance(a, b);
  if (!length) return b;
  const angle = ((Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) + 360) % 360;
  const nearest = increments.map((candidate) => ({ candidate, delta: Math.min(Math.abs(angle - candidate), 360 - Math.abs(angle - candidate)) })).sort((x, y) => x.delta - y.delta)[0];
  if (!nearest || nearest.delta > thresholdDegrees) return b;
  const radians = nearest.candidate * Math.PI / 180;
  return { x: a.x + Math.cos(radians) * length, y: a.y + Math.sin(radians) * length };
}

export function snapPoint(target, candidates, threshold = 10) {
  const p = point(target);
  const nearest = (Array.isArray(candidates) ? candidates : []).map((candidate) => ({ point: point(candidate), distance: pointDistance(p, candidate) })).sort((a, b) => a.distance - b.distance)[0];
  return nearest && nearest.distance <= threshold ? { ...nearest.point, snapped: true, distance: nearest.distance } : { ...p, snapped: false };
}

export function polygonArea(points) {
  const vertices = Array.isArray(points) ? points.map(point) : [];
  if (vertices.length < 3) return 0;
  return Math.abs(vertices.reduce((sum, current, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + current.x * next.y - next.x * current.y;
  }, 0)) / 2;
}

export function boundingBox(points) {
  const vertices = (Array.isArray(points) ? points : []).map(point);
  if (!vertices.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = vertices.map((entry) => entry.x); const ys = vertices.map((entry) => entry.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function canvasToReal(distance, scale) {
  return finite(distance) * Math.max(0.000001, finite(scale?.realWorldUnitsPerCanvasUnit, 1));
}

export function realToCanvas(distance, scale) {
  return finite(distance) / Math.max(0.000001, finite(scale?.realWorldUnitsPerCanvasUnit, 1));
}

export function calibrateScale(wall, realWorldLength, currentScale = {}) {
  if (currentScale.locked) throw Object.assign(new Error("Unlock the scale before recalibrating."), { code: "scale_locked" });
  const canvasLength = segmentLength(wall);
  const real = finite(realWorldLength);
  if (canvasLength <= 0 || real <= 0) throw Object.assign(new Error("Choose a wall and enter a valid length."), { code: "invalid_calibration" });
  return { realWorldUnitsPerCanvasUnit: real / canvasLength, calibrated: true, locked: !!currentScale.locked };
}

export function wallWithExactLength(wall, realWorldLength, scale) {
  const start = point(wall?.start); const end = point(wall?.end);
  const current = pointDistance(start, end);
  const canvasLength = realToCanvas(realWorldLength, scale);
  if (!current || canvasLength <= 0) throw Object.assign(new Error("Draw a wall direction before entering its length."), { code: "invalid_wall" });
  const ratio = canvasLength / current;
  return { ...wall, start, end: { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio } };
}

export function recommendedCableLength(points, slackPercentage = 10) {
  const routeLength = polylineLength(points);
  const slack = Math.max(0, finite(slackPercentage, 10));
  return { routeLength, slackPercentage: slack, recommendedLength: routeLength * (1 + slack / 100) };
}

export function suggestExtensions(requiredLength, presets = [5, 10, 15, 25, 15.24, 30.48]) {
  const target = Math.max(0, finite(requiredLength));
  const lengths = [...new Set(presets.map((value) => finite(value)).filter((value) => value > 0))].sort((a, b) => b - a);
  if (!target || !lengths.length) return [];
  const maxPieces = 8;
  let best = null;
  function search(combo, total, start) {
    if (total >= target) {
      const candidate = { lengths: [...combo], total, excess: total - target };
      if (!best || candidate.excess < best.excess || (candidate.excess === best.excess && combo.length < best.lengths.length)) best = candidate;
      return;
    }
    if (combo.length >= maxPieces || (best && total > best.total)) return;
    for (let i = start; i < lengths.length; i += 1) search([...combo, lengths[i]], total + lengths[i], i);
  }
  search([], 0, 0);
  return best ? [best] : [];
}

export function detectClosedRooms(walls, tolerance = 0.5) {
  const entries = (Array.isArray(walls) ? walls : []).filter((wall) => wall?.id && wall.start && wall.end);
  const key = (p) => `${Math.round(finite(p.x) / tolerance)}:${Math.round(finite(p.y) / tolerance)}`;
  const adjacency = new Map();
  for (const wall of entries) {
    const a = key(wall.start); const b = key(wall.end);
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a).push({ key: b, wall, point: point(wall.end) });
    adjacency.get(b).push({ key: a, wall, point: point(wall.start) });
  }
  const rooms = []; const seen = new Set();
  function walk(startKey, currentKey, pathKeys, pathPoints, usedWalls) {
    if (pathKeys.length > entries.length + 1) return;
    for (const edge of adjacency.get(currentKey) || []) {
      if (usedWalls.has(edge.wall.id)) continue;
      if (edge.key === startKey && pathKeys.length >= 3) {
        const signature = [...usedWalls, edge.wall.id].sort().join(":");
        if (!seen.has(signature)) {
          seen.add(signature);
          const points = [...pathPoints];
          rooms.push({ id: `room_${signature.replace(/[^a-z0-9]/gi, "_")}`, wallIds: [...usedWalls, edge.wall.id], points, area: polygonArea(points), bounds: boundingBox(points) });
        }
      } else if (!pathKeys.includes(edge.key)) {
        walk(startKey, edge.key, [...pathKeys, edge.key], [...pathPoints, edge.point], new Set([...usedWalls, edge.wall.id]));
      }
    }
  }
  for (const [startKey, edges] of adjacency) for (const edge of edges) walk(startKey, edge.key, [startKey, edge.key], [point(edge.wall.start), edge.point], new Set([edge.wall.id]));
  return rooms.filter((room, index, all) => room.area > tolerance && all.findIndex((candidate) => candidate.wallIds.slice().sort().join(":") === room.wallIds.slice().sort().join(":")) === index);
}

export const LOCATION_PLAN_LAYERS = Object.freeze(["architecture", "measurements", "camera", "lighting", "grip", "power", "art", "production", "routes", "notes"]);
export const LOCATION_PLAN_VIEWS = Object.freeze({
  all: LOCATION_PLAN_LAYERS,
  director: ["architecture", "measurements", "camera", "lighting", "art", "notes"],
  camera: ["architecture", "measurements", "camera", "lighting", "grip", "notes"],
  lighting: ["architecture", "measurements", "lighting", "grip", "power", "notes"],
  art: ["architecture", "measurements", "art", "production", "notes"],
  production: ["architecture", "measurements", "production", "routes", "notes"],
});

export function createLocationPlan({ id, projectId, name = "Location Plan", unitSystem = "metric" }) {
  return {
    id, projectId, name, unitSystem: unitSystem === "imperial" ? "imperial" : "metric",
    scale: { realWorldUnitsPerCanvasUnit: 1, calibrated: false, locked: false },
    walls: [], doors: [], windows: [], rooms: [], equipment: [], cables: [], measurements: [], zones: [], routes: [], comments: [],
    layers: LOCATION_PLAN_LAYERS.map((layer) => ({ id: layer, visible: true, locked: false })),
    version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export function updatePinnedMeasurements(plan) {
  const entities = new Map([
    ...(plan.walls || []).map((item) => [item.id, item]), ...(plan.equipment || []).map((item) => [item.id, item]),
    ...(plan.doors || []).map((item) => [item.id, item]), ...(plan.windows || []).map((item) => [item.id, item]),
  ]);
  const anchor = (ref) => {
    const entity = entities.get(ref?.entityId);
    if (!entity) return point(ref);
    if (entity.position) return point(entity.position);
    if (entity.start && entity.end) return { x: (finite(entity.start.x) + finite(entity.end.x)) / 2, y: (finite(entity.start.y) + finite(entity.end.y)) / 2 };
    return point(ref);
  };
  return { ...plan, measurements: (plan.measurements || []).map((measurement) => measurement.pinned ? { ...measurement, start: anchor(measurement.startRef || measurement.start), end: anchor(measurement.endRef || measurement.end), distance: pointDistance(anchor(measurement.startRef || measurement.start), anchor(measurement.endRef || measurement.end)) } : measurement) };
}

