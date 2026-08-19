import crypto from "node:crypto";

const ROLE_IDS = new Set([
  "director",
  "producer",
  "director_of_photography",
  "production_designer",
  "sound_recordist",
]);
const BOARD_TYPES = new Set(["art", "photo", "video", "blank"]);
const BOARD_ELEMENT_TYPES = new Set([
  "image", "text", "note", "title", "link", "color", "shape", "frame",
  "section", "scene", "shot", "vault", "checklist", "table", "audio", "video", "pdf",
]);
const AVAILABILITY = new Set(["available", "limited", "reserved", "unavailable"]);
const CONDITIONS = new Set(["new", "excellent", "good", "fair", "damaged", "needs_repair"]);
const QUOTE_TYPES = new Set(["visual_proposal", "rental_quote", "inventory_pull_list", "art_department_package"]);

const nowIso = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
const text = (value, max = 4000) => String(value ?? "").replace(/\0/g, "").trim().slice(0, max);
const plainText = (value, max = 4000) => String(value ?? "").replace(/\0/g, "").slice(0, max);
const finite = (value, fallback = 0, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const integer = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => Math.round(finite(value, fallback, min, max));
const boolean = (value, fallback = false) => typeof value === "boolean" ? value : fallback;
const strings = (value, limit = 60, max = 120) => {
  const seen = new Set();
  return (Array.isArray(value) ? value : String(value || "").split(",")).flatMap((entry) => {
    const clean = text(entry, max);
    const key = clean.toLocaleLowerCase("en");
    if (!clean || seen.has(key)) return [];
    seen.add(key);
    return [clean];
  }).slice(0, limit);
};
const dateText = (value, fallback = "") => {
  const clean = text(value, 40);
  return clean && Number.isFinite(Date.parse(clean)) ? clean : fallback;
};
const objectValue = (value, max = 100000) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= max ? JSON.parse(serialized) : {};
  } catch {
    return {};
  }
};

function normalizeAsset(value = {}) {
  const assetId = /^cas_[a-f0-9]+$/.test(String(value.id || "")) ? String(value.id) : id("cas");
  const mimeType = ["image/jpeg", "image/png", "image/webp"].includes(String(value.mimeType || "").toLowerCase())
    ? String(value.mimeType).toLowerCase()
    : "image/jpeg";
  return {
    id: assetId,
    provider: text(value.provider || "local", 32).toLowerCase(),
    key: text(value.key, 500),
    mimeType,
    filename: text(value.filename || "Canvas image", 160),
    size: integer(value.size, 0, 0, 12 * 1024 * 1024),
    width: integer(value.width, 0, 0, 12000),
    height: integer(value.height, 0, 0, 12000),
    source: text(value.source || "upload", 40).toLowerCase(),
    prompt: text(value.prompt, 3200),
    generation: objectValue(value.generation, 12000),
    createdAt: dateText(value.createdAt, nowIso()),
  };
}

function normalizeVaultItem(value = {}, options = {}) {
  const createdAt = dateText(value.createdAt || value.dateAdded, nowIso());
  const quantityOwned = integer(value.quantityOwned, 1, 0, 100000);
  const quantityAvailable = integer(value.quantityAvailable, quantityOwned, 0, quantityOwned || 100000);
  const mainImageId = /^cas_[a-f0-9]+$/.test(String(value.mainImageId || "")) ? String(value.mainImageId) : "";
  const imageIds = strings(value.imageIds, 24, 80).filter((entry) => /^cas_[a-f0-9]+$/.test(entry));
  if (mainImageId && !imageIds.includes(mainImageId)) imageIds.unshift(mainImageId);
  return {
    id: /^vlt_[a-f0-9]+$/.test(String(value.id || "")) ? String(value.id) : id("vlt"),
    name: text(value.name || "Untitled item", 160) || "Untitled item",
    mainImageId: mainImageId || imageIds[0] || "",
    imageIds,
    category: text(value.category || "Uncategorized", 80) || "Uncategorized",
    subcategory: text(value.subcategory, 80),
    description: text(value.description, 5000),
    code: text(value.code, 80),
    quantityOwned,
    quantityAvailable,
    condition: CONDITIONS.has(value.condition) ? value.condition : "good",
    color: text(value.color, 80),
    material: text(value.material, 120),
    dimensions: text(value.dimensions, 160),
    weight: text(value.weight, 80),
    storageLocation: text(value.storageLocation, 180),
    dailyPrice: finite(value.dailyPrice, 0, 0, 100000000),
    weeklyPrice: finite(value.weeklyPrice, 0, 0, 100000000),
    replacementValue: finite(value.replacementValue, 0, 0, 100000000),
    depositRequired: boolean(value.depositRequired),
    depositAmount: finite(value.depositAmount, 0, 0, 100000000),
    availability: AVAILABILITY.has(value.availability) ? value.availability : "available",
    ownerSupplier: text(value.ownerSupplier, 180),
    contactInformation: text(value.contactInformation, 500),
    tags: strings(value.tags, 40, 80),
    productionNotes: text(value.productionNotes, 5000),
    damageNotes: text(value.damageNotes, 5000),
    includedAccessories: text(value.includedAccessories, 3000),
    archived: boolean(value.archived),
    projectOverrides: {
      requestedQuantity: integer(value.projectOverrides?.requestedQuantity, 0, 0, 100000),
      negotiatedPrice: finite(value.projectOverrides?.negotiatedPrice, 0, 0, 100000000),
      rentalDays: integer(value.projectOverrides?.rentalDays, 1, 1, 3650),
      usageNotes: text(value.projectOverrides?.usageNotes, 2000),
      sceneAssignment: text(value.projectOverrides?.sceneAssignment, 160),
      setAssignment: text(value.projectOverrides?.setAssignment, 160),
    },
    createdAt,
    dateAdded: createdAt,
    lastUsedAt: dateText(value.lastUsedAt),
    updatedAt: dateText(value.updatedAt, options.preserveUpdatedAt ? createdAt : nowIso()),
  };
}

function normalizeBoardElement(value = {}, index = 0) {
  const type = BOARD_ELEMENT_TYPES.has(value.type) ? value.type : "note";
  return {
    id: /^bel_[a-f0-9]+$/.test(String(value.id || "")) ? String(value.id) : id("bel"),
    type,
    positionX: finite(value.positionX, 220 + (index % 4) * 260, -100000, 100000),
    positionY: finite(value.positionY, 180 + Math.floor(index / 4) * 220, -100000, 100000),
    width: finite(value.width, type === "image" || type === "vault" ? 260 : 220, 80, 4000),
    height: finite(value.height, type === "image" || type === "vault" ? 190 : 150, 54, 4000),
    rotation: finite(value.rotation, 0, -360, 360),
    zIndex: integer(value.zIndex, index + 1, 0, 100000),
    content: plainText(value.content, 20000),
    metadata: objectValue(value.metadata),
    status: text(value.status, 40),
    locked: boolean(value.locked),
    hidden: boolean(value.hidden),
    groupId: text(value.groupId, 80),
    sceneId: text(value.sceneId, 80),
    vaultItemId: /^vlt_[a-f0-9]+$/.test(String(value.vaultItemId || "")) ? String(value.vaultItemId) : "",
    assetId: /^cas_[a-f0-9]+$/.test(String(value.assetId || "")) ? String(value.assetId) : "",
    createdBy: text(value.createdBy, 80),
    createdAt: dateText(value.createdAt, nowIso()),
    updatedAt: dateText(value.updatedAt, nowIso()),
  };
}

function normalizeBoard(value = {}, options = {}) {
  const createdAt = dateText(value.createdAt, nowIso());
  return {
    id: /^brd_[a-f0-9]+$/.test(String(value.id || "")) ? String(value.id) : id("brd"),
    title: text(value.title || "Untitled Board", 180) || "Untitled Board",
    type: BOARD_TYPES.has(value.type) ? value.type : "blank",
    description: text(value.description, 1200),
    elements: (Array.isArray(value.elements) ? value.elements : []).slice(0, 2500).map(normalizeBoardElement),
    viewport: {
      x: finite(value.viewport?.x, 0, -100000, 100000),
      y: finite(value.viewport?.y, 0, -100000, 100000),
      zoom: finite(value.viewport?.zoom, 1, 0.15, 4),
    },
    settings: {
      snapToGrid: boolean(value.settings?.snapToGrid),
      gridSize: integer(value.settings?.gridSize, 16, 4, 128),
    },
    connections: (Array.isArray(value.connections) ? value.connections : []).slice(0, 200).map((entry) => ({
      type: text(entry?.type, 40),
      id: text(entry?.id, 100),
      label: text(entry?.label, 180),
    })).filter((entry) => entry.type && entry.id),
    archived: boolean(value.archived),
    createdAt,
    updatedAt: dateText(value.updatedAt, options.preserveUpdatedAt ? createdAt : nowIso()),
  };
}

function normalizeQuoteItem(value = {}) {
  return {
    id: /^qti_[a-f0-9]+$/.test(String(value.id || "")) ? String(value.id) : id("qti"),
    vaultItemId: /^vlt_[a-f0-9]+$/.test(String(value.vaultItemId || "")) ? String(value.vaultItemId) : "",
    name: text(value.name || "Vault item", 180) || "Vault item",
    code: text(value.code, 80),
    imageId: /^cas_[a-f0-9]+$/.test(String(value.imageId || "")) ? String(value.imageId) : "",
    quantity: integer(value.quantity, 1, 1, 100000),
    rentalDays: integer(value.rentalDays, 1, 1, 3650),
    pricePerDay: finite(value.pricePerDay, 0, 0, 100000000),
    description: text(value.description, 1200),
    notes: text(value.notes, 1200),
    sceneAssignment: text(value.sceneAssignment, 160),
    setAssignment: text(value.setAssignment, 160),
  };
}

function normalizeQuote(value = {}, options = {}) {
  const createdAt = dateText(value.createdAt, nowIso());
  return {
    id: /^qte_[a-f0-9]+$/.test(String(value.id || "")) ? String(value.id) : id("qte"),
    documentType: QUOTE_TYPES.has(value.documentType) ? value.documentType : "rental_quote",
    clientName: text(value.clientName, 180),
    companyName: text(value.companyName, 180),
    productionName: text(value.productionName, 180),
    projectName: text(value.projectName, 180),
    contactInformation: text(value.contactInformation, 800),
    quoteNumber: text(value.quoteNumber || `FS-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, 80),
    issueDate: text(value.issueDate || new Date().toISOString().slice(0, 10), 20),
    validityDate: text(value.validityDate, 20),
    rentalStartDate: text(value.rentalStartDate, 20),
    rentalEndDate: text(value.rentalEndDate, 20),
    items: (Array.isArray(value.items) ? value.items : []).slice(0, 500).map(normalizeQuoteItem),
    discount: finite(value.discount, 0, 0, 100000000),
    taxRate: finite(value.taxRate, 0, 0, 100),
    deposit: finite(value.deposit, 0, 0, 100000000),
    transportationCosts: finite(value.transportationCosts, 0, 0, 100000000),
    laborCosts: finite(value.laborCosts, 0, 0, 100000000),
    additionalFees: finite(value.additionalFees, 0, 0, 100000000),
    notes: text(value.notes, 5000),
    terms: text(value.terms, 8000),
    display: {
      imageStyle: value.display?.imageStyle === "large" ? "large" : "compact",
      prices: value.display?.prices !== false,
      itemCodes: value.display?.itemCodes !== false,
      quantities: value.display?.quantities !== false,
      descriptions: value.display?.descriptions !== false,
      notes: value.display?.notes !== false,
      assignments: value.display?.assignments !== false,
      companyBranding: value.display?.companyBranding !== false,
      logoAssetId: /^cas_[a-f0-9]+$/.test(String(value.display?.logoAssetId || "")) ? String(value.display.logoAssetId) : "",
    },
    status: ["draft", "final"].includes(value.status) ? value.status : "draft",
    createdAt,
    updatedAt: dateText(value.updatedAt, options.preserveUpdatedAt ? createdAt : nowIso()),
  };
}

function normalizeSelection(value = {}) {
  return {
    id: /^vsel_[a-f0-9]+$/.test(String(value.id || "")) ? String(value.id) : id("vsel"),
    name: text(value.name || "Project selection", 160),
    itemIds: strings(value.itemIds, 500, 80).filter((entry) => /^vlt_[a-f0-9]+$/.test(entry)),
    context: objectValue(value.context, 40000),
    createdAt: dateText(value.createdAt, nowIso()),
    updatedAt: dateText(value.updatedAt, nowIso()),
  };
}

function createCanvasWorkspace({ scriptId, userId }) {
  const timestamp = nowIso();
  return {
    version: 1,
    scriptId,
    userId,
    role: null,
    settings: { lastTool: "home", vaultView: "grid" },
    vaultItems: [],
    vaultCategories: [],
    vaultSelections: [],
    quotes: [],
    boards: [],
    assets: [],
    generatedAssets: [],
    presentations: [],
    exportTemplates: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeCanvasWorkspace(value, { scriptId, userId } = {}) {
  const base = createCanvasWorkspace({ scriptId, userId });
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    ...base,
    version: 1,
    scriptId: scriptId || text(input.scriptId, 80),
    userId: userId || text(input.userId, 80),
    role: ROLE_IDS.has(input.role) ? input.role : null,
    settings: {
      lastTool: ["home", "vault", "boards"].includes(input.settings?.lastTool) ? input.settings.lastTool : "home",
      vaultView: input.settings?.vaultView === "list" ? "list" : "grid",
    },
    vaultItems: (Array.isArray(input.vaultItems) ? input.vaultItems : []).slice(0, 10000).map((item) => normalizeVaultItem(item, { preserveUpdatedAt: true })),
    vaultCategories: strings(input.vaultCategories, 300, 80),
    vaultSelections: (Array.isArray(input.vaultSelections) ? input.vaultSelections : []).slice(0, 1000).map(normalizeSelection),
    quotes: (Array.isArray(input.quotes) ? input.quotes : []).slice(0, 2000).map((quote) => normalizeQuote(quote, { preserveUpdatedAt: true })),
    boards: (Array.isArray(input.boards) ? input.boards : []).slice(0, 2000).map((board) => normalizeBoard(board, { preserveUpdatedAt: true })),
    assets: (Array.isArray(input.assets) ? input.assets : []).slice(0, 20000).map(normalizeAsset),
    generatedAssets: Array.isArray(input.generatedAssets) ? input.generatedAssets.slice(0, 5000) : [],
    presentations: Array.isArray(input.presentations) ? input.presentations.slice(0, 2000) : [],
    exportTemplates: Array.isArray(input.exportTemplates) ? input.exportTemplates.slice(0, 200) : [],
    createdAt: dateText(input.createdAt, base.createdAt),
    updatedAt: dateText(input.updatedAt, base.updatedAt),
  };
}

function publicCanvasWorkspace(value, context) {
  const workspace = normalizeCanvasWorkspace(value, context);
  return {
    ...workspace,
    assets: workspace.assets.map(({ key: _key, ...asset }) => asset),
  };
}

export {
  BOARD_TYPES,
  QUOTE_TYPES,
  ROLE_IDS,
  createCanvasWorkspace,
  id as createCanvasId,
  normalizeAsset,
  normalizeBoard,
  normalizeBoardElement,
  normalizeCanvasWorkspace,
  normalizeQuote,
  normalizeQuoteItem,
  normalizeSelection,
  normalizeVaultItem,
  publicCanvasWorkspace,
};
