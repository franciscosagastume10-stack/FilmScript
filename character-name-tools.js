// Safe, deterministic character-name utilities shared by the editor and tests.
// The AI proposes names; these helpers decide exactly which screenplay text can
// be changed after the writer explicitly confirms a replacement.
(() => {
  'use strict';

  const GENERIC_ROLES = new Set([
    'MAN', 'WOMAN', 'BOY', 'GIRL', 'CHILD', 'MOTHER', 'FATHER', 'MOM', 'DAD',
    'GUARD', 'WAITER', 'WAITRESS', 'DRIVER', 'COP', 'OFFICER', 'NURSE', 'DOCTOR',
    'VOICE', 'ANNOUNCER', 'CLERK', 'SERVER', 'CASHIER', 'BARTENDER', 'TEACHER',
  ]);
  const CUE_SUFFIX = /\s*(?:\((?:CONT['’]?D|V\.?\s*O\.?|O\.?\s*S\.?|OFF|FILTERED|PRE[- ]?LAP)\)|:)\s*$/i;

  const canonicalCue = (value) => {
    let name = String(value || '').replace(/\u00a0/g, ' ').trim();
    let previous = '';
    while (name && name !== previous) {
      previous = name;
      name = name.replace(CUE_SUFFIX, '').trim();
    }
    return name;
  };

  const titleCase = (value) => String(value || '').toLocaleLowerCase().replace(/(^|[\s\-’'])(\p{L})/gu, (match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase()}`);
  const keyFor = (value) => canonicalCue(value).normalize('NFC').toLocaleUpperCase();
  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const caseMatchedName = (newName, matched) => {
    if (matched === matched.toLocaleUpperCase()) return String(newName).toLocaleUpperCase();
    if (matched === matched.toLocaleLowerCase()) return String(newName).toLocaleLowerCase();
    return titleCase(newName);
  };

  const mentionVariants = (oldName) => {
    const canonical = canonicalCue(oldName);
    if (!canonical) return [];
    const variants = [canonical];
    if (!GENERIC_ROLES.has(keyFor(canonical))) variants.push(titleCase(canonical));
    return Array.from(new Set(variants)).sort((a, b) => b.length - a.length);
  };

  const replaceMentions = (value, oldName, newName) => {
    const variants = mentionVariants(oldName);
    if (!variants.length || !String(newName || '').trim()) return { text: String(value || ''), count: 0 };
    const pattern = variants.map(escapeRegExp).join('|');
    const matcher = new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=$|[^\\p{L}\\p{N}_])`, 'gu');
    let count = 0;
    const text = String(value || '').replace(matcher, (full, prefix, matched) => {
      count += 1;
      return `${prefix}${caseMatchedName(String(newName).trim(), matched)}`;
    });
    return { text, count };
  };

  const renameBlock = (block, oldName, newName) => {
    const type = String(block?.type || 'action');
    const original = String(block?.text || '');
    if (type === 'character') {
      const base = canonicalCue(original);
      if (!base || keyFor(base) !== keyFor(oldName)) return { text: original, count: 0 };
      const trimmed = original.trim();
      const suffix = trimmed.slice(base.length);
      return { text: `${caseMatchedName(String(newName).trim(), base)}${suffix}`, count: 1 };
    }
    if (!['action', 'dialogue', 'paren'].includes(type)) return { text: original, count: 0 };
    return replaceMentions(original, oldName, newName);
  };

  const summarizeCues = (blocks) => {
    const characters = new Map();
    let sceneNumber = 0;
    (Array.isArray(blocks) ? blocks : []).forEach((block, blockIndex) => {
      const type = String(block?.type || 'action');
      if (type === 'scene') sceneNumber += 1;
      if (type !== 'character') return;
      const currentName = canonicalCue(block?.text);
      if (!currentName || currentName.length > 60) return;
      const key = keyFor(currentName);
      if (!characters.has(key)) {
        characters.set(key, {
          currentName,
          cueCount: 0,
          firstScene: Math.max(1, sceneNumber),
          firstPage: Math.max(1, Number(block?.pageNumber) || 1),
          firstBlockIndex: blockIndex,
        });
      }
      characters.get(key).cueCount += 1;
    });
    return Array.from(characters.values()).sort((a, b) => a.firstBlockIndex - b.firstBlockIndex);
  };

  window.filmscriptCharacterNames = Object.freeze({
    canonicalCue,
    keyFor,
    titleCase,
    isGenericRole: (value) => GENERIC_ROLES.has(keyFor(value)),
    replaceMentions,
    renameBlock,
    summarizeCues,
  });
})();
