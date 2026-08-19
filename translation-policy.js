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

export function translatedProjectName(title, language) {
  const target = TRANSLATION_LANGUAGES.includes(language) ? language : "English";
  return `${String(title || "Untitled Screenplay").trim()}: ${target} Version`;
}

export function screenplayTranslationPacket(blocks, entityMap = {}) {
  return (Array.isArray(blocks) ? blocks : []).map((block, index) => ({
    id: String(block?.id || `block_${index + 1}`),
    type: String(block?.type || "action"),
    text: String(block?.text || ""),
    preserve: block?.type === "character" ? true : undefined,
    entities: Object.entries(entityMap).filter(([, occurrences]) => Array.isArray(occurrences) && occurrences.includes(index)).map(([id]) => id),
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
