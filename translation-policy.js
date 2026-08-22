export const TRANSLATION_LANGUAGES = Object.freeze(["English", "Spanish", "French", "Portuguese", "German"]);
export const TRANSLATION_CREDIT_TIERS = Object.freeze([
  { minPages: 1, maxPages: 30, credits: 10 },
  { minPages: 31, maxPages: 60, credits: 20 },
  { minPages: 61, maxPages: 100, credits: 50 },
  { minPages: 101, maxPages: 150, credits: 75 },
  { minPages: 151, maxPages: 200, credits: 100 },
]);

export function translationCreditCost(pageCount) {
  const pages = Math.max(1, Math.ceil(Number(pageCount) || 1));
  const tier = TRANSLATION_CREDIT_TIERS.find((entry) => pages >= entry.minPages && pages <= entry.maxPages);
  if (tier) return tier.credits;
  return 100 + Math.ceil((pages - 200) / 50) * 25;
}

export function translatedProjectName(title, language, version = 1) {
  const target = TRANSLATION_LANGUAGES.includes(language) ? language : "English";
  const base = `${String(title || "Untitled Screenplay").trim()} — ${target} Version`;
  const ordinal = Math.max(1, Math.floor(Number(version) || 1));
  return ordinal === 1 ? base : `${base} ${String(ordinal).padStart(2, "0")}`;
}

// PDF imports retain their authored page boundaries. For original web scripts
// without them, use the same lightweight screenplay-pagination model as the
// editor so the quoted translation price is stable before a job is created.
const PAGE_LINE_CAPACITY = 44;
const BLOCK_LINE_WIDTHS = Object.freeze({ dialogue: 38, paren: 42 });
const BLOCK_VERTICAL_SPACE = Object.freeze({ scene: 1.1, character: 0.7, action: 0.6, transition: 0.7, fadein: 0.6, end: 3, paren: 0, dialogue: 0 });

function estimatedBlockLines(block) {
  const type = String(block?.type || "action");
  const width = BLOCK_LINE_WIDTHS[type] || 74;
  return Math.max(1, Math.ceil(String(block?.text || "").length / width)) + (BLOCK_VERTICAL_SPACE[type] || 0);
}

export function screenplayPageCount(blocks, fallbackText = "") {
  const source = Array.isArray(blocks) ? blocks : [];
  if (!source.length) return Math.max(1, Math.ceil(String(fallbackText || "").length / 3000));
  if (source.some((block) => block?.type === "pagebreak")) {
    return Math.max(1, source.filter((block) => block?.type === "pagebreak").length + 1);
  }
  let pages = 1;
  let currentLines = 0;
  let hasContent = false;
  for (const block of source) {
    if (!block || block.type === "pagebreak") continue;
    const lines = estimatedBlockLines(block);
    if (hasContent && currentLines + lines > PAGE_LINE_CAPACITY) {
      pages += 1;
      currentLines = 0;
    }
    currentLines += lines;
    hasContent = true;
  }
  return Math.max(1, pages);
}

export function screenplayTranslationPacket(blocks, entityMap = {}) {
  return (Array.isArray(blocks) ? blocks : []).map((block, index) => ({
    id: String(block?.id || `block_${index + 1}`),
    type: String(block?.type || "action"),
    text: String(block?.text || ""),
    preserve: block?.type === "character" ? true : undefined,
    entities: Object.entries(entityMap)
      .filter(([, entry]) => (Array.isArray(entry) ? entry : entry?.occurrences || []).includes(index))
      .map(([id]) => id),
  }));
}

export function validateTranslatedBlocks(value, sourceBlocks) {
  if (!Array.isArray(value) || value.length !== (sourceBlocks || []).length) throw Object.assign(new Error("Translation structure did not match the screenplay."), { code: "unsupported_structure", status: 422 });
  return value.map((block, index) => {
    const source = sourceBlocks[index] || {};
    if (!block || block.id !== String(source.id || `block_${index + 1}`) || block.type !== String(source.type || "action") || typeof block.text !== "string") {
      throw Object.assign(new Error("Translation structure did not match the screenplay."), { code: "unsupported_structure", status: 422 });
    }
    return { ...source, text: block.text.slice(0, 20000) };
  });
}
