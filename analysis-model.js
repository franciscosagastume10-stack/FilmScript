const COVER_TYPES = new Set(['title', 'title_credit', 'title_author', 'title_date', 'title_contact']);
const CONTENT_TYPES = new Set(['scene', 'action', 'character', 'paren', 'dialogue', 'transition', 'fadein', 'end']);

const cleanText = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').trim();
const normalized = (value) => cleanText(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/\s+/g, ' ')
  .toUpperCase();

const words = (value) => cleanText(value).match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];
const wordCount = (value) => words(value).length;

const EMOTIONAL_SIGNAL_TERMS = {
  extreme: [
    'ABDUCT', 'KIDNAP', 'MURDER', 'KILL', 'DEATH', 'DEAD', 'DYING', 'BLOOD', 'BLEED', 'STAB', 'GUNSHOT',
    'TERROR', 'HORROR', 'RAGE', 'FURY', 'VIOLENCE', 'HELLPLESS', 'HELPLESS', 'LOSS OF HUMANITY', 'LIFE-THREATENING',
    'SECUESTR', 'ASESIN', 'MUERTE', 'MUERTO', 'MATAR', 'SANGR', 'APUNAL', 'APUÑAL', 'DISPARO', 'TERROR',
    'HORROR', 'IRA', 'FURIA', 'VIOLENCIA', 'IMPOTENCIA',
  ],
  high: [
    'THREAT', 'FEAR', 'PANIC', 'ANXIOUS', 'CONFRONT', 'DANGER', 'ATTACK', 'ASSAULT', 'DESPERAT', 'GRIEF',
    'SHOCK', 'HUNTED', 'PURSUED', 'CORNERED', 'COERCED', 'DREAD', 'UNRESOLVED', 'NO RESOLUTION', 'COLLAPSE',
    'AMENAZ', 'MIEDO', 'PANICO', 'PÁNICO', 'PELIGRO', 'ATAQUE', 'AGRES', 'DESESPER', 'DUELO', 'IMPACTO',
    'PERSEGUID', 'ACORRAL', 'OBLIGAD', 'SIN RESOLVER',
  ],
  medium: [
    'TENSION', 'CONFLICT', 'ARGUE', 'UNCERTAIN', 'WORRIED', 'SAD', 'SHAME', 'COMPLICIT', 'PRESSURE', 'UNEASY',
    'TENSIÓN', 'CONFLICTO', 'DISCUT', 'INCIERT', 'PREOCUP', 'TRIST', 'VERGUENZA', 'VERGÜENZA', 'PRESION', 'PRESIÓN',
  ],
  calm: [
    'CALM', 'QUIET', 'CONTENT', 'PLAYFUL', 'RELIEF', 'TENDER', 'ROUTINE', 'PEACEFUL',
    'CALMA', 'TRANQUIL', 'CONTENT', 'JUGUET', 'ALIVIO', 'TIERNO', 'RUTINA', 'PAZ',
  ],
  ending: [
    'ENDING', 'FINAL', 'HUNTED', 'PURSUED', 'BLOOD', 'POLICE', 'DREAD', 'UNRESOLVED', 'NO RESOLUTION', 'ALONE',
    'FIN', 'PERSEGUID', 'SANGR', 'POLICIA', 'POLICÍA', 'SIN RESOLVER', 'SOLO', 'SOLITARIO',
  ],
};

function emotionalSignalScore(point, index, length) {
  const text = normalized(`${point?.label || ''} ${point?.explanation || ''} ${point?.marker || ''}`);
  const includesAny = (terms) => terms.some((term) => text.includes(normalized(term)));
  let score = 48;
  if (includesAny(EMOTIONAL_SIGNAL_TERMS.calm)) score = 38;
  if (includesAny(EMOTIONAL_SIGNAL_TERMS.medium)) score = 68;
  if (includesAny(EMOTIONAL_SIGNAL_TERMS.high)) score = 84;
  if (includesAny(EMOTIONAL_SIGNAL_TERMS.extreme)) score = 96;
  if (/\b(?:PEAK|CLIMAX|NADIR|TURNING POINT|PUNTO DE GIRO|CLIMAX)\b/.test(text)) score = Math.max(score, 92);
  if (index === length - 1 && score >= 80 && includesAny(EMOTIONAL_SIGNAL_TERMS.ending)) score = 100;
  return score;
}

function normalizeEmotionalArc(points) {
  const source = (Array.isArray(points) ? points : []).map((point) => ({
    ...point,
    value: Math.max(0, Math.min(100, Number.isFinite(Number(point?.value)) ? Number(point.value) : 50)),
  }));
  if (source.length < 2) return source;

  const signals = source.map((point, index) => emotionalSignalScore(point, index, source.length));
  const intenseShownAsLow = source.filter((point, index) => point.value <= 42 && signals[index] >= 80).length;
  const calmShownAsHigh = source.filter((point, index) => point.value >= 58 && signals[index] <= 45).length;
  const valenceScaleDetected = intenseShownAsLow >= Math.max(2, Math.ceil(source.length * .22)) && calmShownAsHigh >= 1;
  const scaled = valenceScaleDetected ? source.map((point, index) => {
    const invertedValence = 100 - point.value;
    let value = Math.round(signals[index] * .65 + invertedValence * .35);
    if (index === source.length - 1 && signals[index] >= 90) value = Math.max(value, signals[index]);
    return { ...point, value: Math.max(0, Math.min(100, value)), scaleCorrected: true };
  }) : source;

  // A high-pressure unresolved ending is the culmination of the arc even when
  // the model already returned an otherwise valid intensity scale. This keeps
  // finales such as "hunted and hollow" from being plotted below earlier beats.
  const endingIndex = scaled.length - 1;
  if (signals[endingIndex] === 100 && scaled[endingIndex].value < 100) {
    scaled[endingIndex] = { ...scaled[endingIndex], value: 100, endingPeakCorrected: true };
  }

  const markerWinner = new Map();
  scaled.forEach((point, index) => {
    const marker = cleanText(point.marker);
    if (!marker || point.value < 72) return;
    const key = normalized(marker);
    const current = markerWinner.get(key);
    if (!current || point.value > current.value || point.value === current.value && index > current.index) {
      markerWinner.set(key, { index, value: point.value });
    }
  });
  return scaled.map((point, index) => {
    const marker = cleanText(point.marker);
    if (!marker) return { ...point, marker: '' };
    const winner = markerWinner.get(normalized(marker));
    return { ...point, marker: winner?.index === index ? marker : '' };
  });
}

function hashText(value) {
  const text = String(value ?? '');
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 0x01000193);
    second ^= code + index;
    second = Math.imul(second, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function fallbackBlocks(text) {
  return cleanText(text).split('\n').flatMap((line) => {
    const value = line.trim();
    if (!value) return [];
    const isHeading = /^(?:INT\.?\s*\/\s*EXT\.?|INT\.?\/EXT\.?|I\.?\/E\.?|INT\.?|EXT\.?)\b/i.test(value);
    return [{ type: isHeading ? 'scene' : 'action', text: value }];
  });
}

function screenplayBlocks(script) {
  const source = Array.isArray(script?.blocks) && script.blocks.length ? script.blocks : fallbackBlocks(script?.text || '');
  return source.map((block) => {
    const type = String(block?.type || '').toLowerCase();
    return {
      type: CONTENT_TYPES.has(type) || COVER_TYPES.has(type) || type === 'pagebreak' ? type : 'action',
      text: cleanText(block?.text),
    };
  });
}

function headingMetadata(value) {
  const heading = cleanText(value).replace(/\s+\d+\s*$/, '');
  const upper = normalized(heading);
  let intExt = 'UNKNOWN';
  if (/^(?:INT\.?\s*\/\s*EXT\.?|INT\.?\/EXT\.?|I\.?\/E\.?)\b/.test(upper)) intExt = 'INT./EXT.';
  else if (/^INT\.?\b/.test(upper)) intExt = 'INT.';
  else if (/^EXT\.?\b/.test(upper)) intExt = 'EXT.';

  let dayNight = 'UNKNOWN';
  if (/\b(?:NIGHT|NOCHE|MIDNIGHT|MEDIANOCHE)\b/.test(upper)) dayNight = 'NIGHT';
  else if (/\b(?:DAWN|DUSK|SUNRISE|SUNSET|AMANECER|ATARDECER|CREPUSCULO)\b/.test(upper)) dayNight = 'DAWN / DUSK';
  else if (/\b(?:DAY|DIA|MORNING|AFTERNOON|EVENING|MANANA|TARDE)\b/.test(upper)) dayNight = 'DAY';

  const location = heading
    .replace(/^(?:INT\.?\s*\/\s*EXT\.?|INT\.?\/EXT\.?|I\.?\/E\.?|INT\.?|EXT\.?)\s*[-.]?\s*/i, '')
    .replace(/\s+(?:-|—)\s+(?:DAY|NIGHT|DAWN|DUSK|SUNRISE|SUNSET|MORNING|AFTERNOON|EVENING|LATER|CONTINUOUS|D[IÍ]A|NOCHE|AMANECER|ATARDECER|MAÑANA|TARDE).*$/i, '')
    .trim();

  return {
    intExt,
    dayNight,
    location,
    continuous: /\b(?:CONTINUOUS|CONTINUO)\b/.test(upper),
    later: /\b(?:LATER|MAS TARDE)\b/.test(upper),
    flashback: /\bFLASHBACK\b/.test(upper),
    montage: /\b(?:MONTAGE|MONTAJE)\b/.test(upper),
    dream: /\b(?:DREAM|SUENO)\b/.test(upper),
  };
}

function parseScreenplay(script) {
  const blocks = screenplayBlocks(script);
  const contentBlocks = [];
  const scenes = [];
  let current = null;
  let page = 1;
  let contentStarted = false;

  blocks.forEach((block) => {
    if (COVER_TYPES.has(block.type)) return;
    if (block.type === 'pagebreak') {
      if (contentStarted) page += 1;
      return;
    }
    contentStarted = true;
    const item = { ...block, page };
    contentBlocks.push(item);
    if (block.type === 'scene') {
      current = { heading: block.text || 'Untitled scene', page, blocks: [item] };
      scenes.push(current);
    } else if (current) current.blocks.push(item);
  });

  return { blocks: contentBlocks, scenes, pages: contentStarted ? Math.max(1, page) : 0 };
}

function previousList(previous, key) {
  return Array.isArray(previous?.[key]) ? previous[key] : [];
}

function reconcileSceneIds(scriptId, scenes, previous) {
  const old = previousList(previous, 'sceneIndex');
  const used = new Set();
  const assignments = new Array(scenes.length).fill(null);
  const byHash = new Map();
  const byHeading = new Map();
  old.forEach((entry, index) => {
    const hash = String(entry?.contentHash || '');
    const heading = normalized(entry?.heading);
    if (hash) (byHash.get(hash) || byHash.set(hash, []).get(hash)).push(index);
    if (heading) (byHeading.get(heading) || byHeading.set(heading, []).get(heading)).push(index);
  });

  const claim = (sceneIndex, candidates) => {
    const available = (candidates || []).filter((index) => !used.has(index));
    if (!available.length) return false;
    available.sort((a, b) => Math.abs(a - sceneIndex) - Math.abs(b - sceneIndex));
    const match = available[0];
    used.add(match);
    assignments[sceneIndex] = old[match]?.id || null;
    return true;
  };

  scenes.forEach((scene, index) => claim(index, byHash.get(scene.contentHash)));
  scenes.forEach((scene, index) => { if (!assignments[index]) claim(index, byHeading.get(normalized(scene.heading))); });
  scenes.forEach((scene, index) => {
    if (assignments[index]) return;
    const available = old.map((entry, oldIndex) => ({ entry, oldIndex })).filter(({ oldIndex }) => !used.has(oldIndex));
    if (!available.length) return;
    available.sort((a, b) => Math.abs(a.oldIndex - index) - Math.abs(b.oldIndex - index));
    if (Math.abs(available[0].oldIndex - index) <= 2 || old.length === scenes.length) {
      used.add(available[0].oldIndex);
      assignments[index] = available[0].entry?.id || null;
    }
  });

  const claimedIds = new Set(assignments.filter(Boolean));
  return scenes.map((scene, index) => {
    let id = assignments[index];
    let salt = 0;
    while (!id || claimedIds.has(id) && assignments.indexOf(id) !== index) {
      id = `asc_${hashText(`${scriptId}:${scene.heading}:${scene.contentHash}:${index}:${salt}`).slice(0, 16)}`;
      salt += 1;
      if (!claimedIds.has(id)) break;
    }
    claimedIds.add(id);
    return { ...scene, id };
  });
}

function sceneStats(scene) {
  let dialogueWords = 0;
  let actionWords = 0;
  let allWords = 0;
  const characterCues = [];
  scene.blocks.forEach((block, blockIndex) => {
    const count = wordCount(block.text);
    allWords += count;
    if (block.type === 'dialogue' || block.type === 'paren') dialogueWords += count;
    if (block.type === 'action') actionWords += count;
    if (block.type === 'character') {
      const name = cleanText(block.text).replace(/\s*\([^)]*\)\s*$/g, '').trim();
      if (name) characterCues.push({ name, blockIndex });
    }
  });
  const estimatedSeconds = Math.max(8, Math.round(dialogueWords / 2.25 + actionWords / 2.65 + Math.max(0, allWords - dialogueWords - actionWords) / 3.2 + 2));
  return { dialogueWords, actionWords, words: allWords, characterCues, estimatedSeconds };
}

function reconcileNamedEntities(prefix, entries, previousEntries, positionKey) {
  const previousByName = new Map((previousEntries || []).map((entry) => [normalized(entry.name), entry]));
  const previousByPosition = new Map((previousEntries || []).map((entry) => [String(entry[positionKey] || ''), entry]));
  const used = new Set();
  return entries.map((entry, index) => {
    const exact = previousByName.get(normalized(entry.name));
    const positioned = previousByPosition.get(String(entry[positionKey] || ''));
    const previous = exact && !used.has(exact.id) ? exact : positioned && !used.has(positioned.id) ? positioned : null;
    const id = previous?.id || `${prefix}_${hashText(`${entry.name}:${entry[positionKey]}:${index}`).slice(0, 14)}`;
    used.add(id);
    return { ...entry, id };
  });
}

function createEntityIndexes(scenes, previous) {
  const characterMap = new Map();
  const locationMap = new Map();
  scenes.forEach((scene) => {
    scene.characterCues.forEach((cue) => {
      const key = normalized(cue.name);
      if (!key) return;
      const entry = characterMap.get(key) || { name: cue.name, sceneIds: [], firstSceneId: scene.id, firstCueIndex: cue.blockIndex };
      if (!entry.sceneIds.includes(scene.id)) entry.sceneIds.push(scene.id);
      characterMap.set(key, entry);
    });
    if (scene.headingMeta.location) {
      const key = normalized(scene.headingMeta.location);
      const entry = locationMap.get(key) || { name: scene.headingMeta.location, sceneIds: [], firstSceneId: scene.id };
      if (!entry.sceneIds.includes(scene.id)) entry.sceneIds.push(scene.id);
      locationMap.set(key, entry);
    }
  });
  return {
    characterIndex: reconcileNamedEntities('chr', Array.from(characterMap.values()), previousList(previous, 'characterIndex'), 'firstSceneId'),
    locationIndex: reconcileNamedEntities('loc', Array.from(locationMap.values()), previousList(previous, 'locationIndex'), 'firstSceneId'),
  };
}

function lengthBucket(seconds) {
  if (seconds < 60) return 'under_1';
  if (seconds < 120) return '1_2';
  if (seconds < 180) return '2_3';
  if (seconds < 240) return '3_4';
  if (seconds < 360) return '4_6';
  return 'over_6';
}

function computeMetrics(parsed, scenes, entities) {
  const totalWords = parsed.blocks.reduce((sum, block) => sum + wordCount(block.text), 0);
  const dialogueWords = scenes.reduce((sum, scene) => sum + scene.dialogueWords, 0);
  const actionWords = scenes.reduce((sum, scene) => sum + scene.actionWords, 0);
  const balanceWords = dialogueWords + actionWords;
  const readingSeconds = scenes.reduce((sum, scene) => sum + scene.estimatedSeconds, 0);
  const pageSeconds = parsed.pages * 60;
  const estimatedRuntimeSeconds = scenes.length
    ? Math.max(1, Math.round(pageSeconds ? pageSeconds * 0.72 + readingSeconds * 0.28 : readingSeconds))
    : 0;
  const rawSceneSeconds = scenes.reduce((sum, scene) => sum + scene.estimatedSeconds, 0) || 1;
  const sceneLengths = scenes.map((scene, index) => {
    const seconds = Math.max(1, Math.round((scene.estimatedSeconds / rawSceneSeconds) * estimatedRuntimeSeconds));
    return {
      sceneId: scene.id,
      sceneNumber: index + 1,
      heading: scene.heading,
      page: scene.page,
      seconds,
      words: scene.words,
      dialogueWords: scene.dialogueWords,
      actionWords: scene.actionWords,
      bucket: lengthBucket(seconds),
    };
  });
  const sortedLengths = [...sceneLengths].sort((a, b) => b.seconds - a.seconds);
  const bucketLabels = [
    ['under_1', 'Under 1 minute'], ['1_2', '1–2 minutes'], ['2_3', '2–3 minutes'],
    ['3_4', '3–4 minutes'], ['4_6', '4–6 minutes'], ['over_6', 'Over 6 minutes'],
  ];
  const lengthDistribution = bucketLabels.map(([key, label]) => {
    const matches = sceneLengths.filter((scene) => scene.bucket === key);
    return { key, label, count: matches.length, sceneIds: matches.map((scene) => scene.sceneId), examples: matches.slice(0, 4) };
  });

  const categories = {
    total: scenes.map((scene) => scene.id),
    int: scenes.filter((scene) => scene.headingMeta.intExt === 'INT.').map((scene) => scene.id),
    ext: scenes.filter((scene) => scene.headingMeta.intExt === 'EXT.').map((scene) => scene.id),
    mixed: scenes.filter((scene) => scene.headingMeta.intExt === 'INT./EXT.').map((scene) => scene.id),
    day: scenes.filter((scene) => scene.headingMeta.dayNight === 'DAY').map((scene) => scene.id),
    night: scenes.filter((scene) => scene.headingMeta.dayNight === 'NIGHT').map((scene) => scene.id),
    dawn_dusk: scenes.filter((scene) => scene.headingMeta.dayNight === 'DAWN / DUSK').map((scene) => scene.id),
    continuous: scenes.filter((scene) => scene.headingMeta.continuous).map((scene) => scene.id),
    later: scenes.filter((scene) => scene.headingMeta.later).map((scene) => scene.id),
    flashback: scenes.filter((scene) => scene.headingMeta.flashback).map((scene) => scene.id),
    montage: scenes.filter((scene) => scene.headingMeta.montage).map((scene) => scene.id),
    dream: scenes.filter((scene) => scene.headingMeta.dream).map((scene) => scene.id),
    unknown: scenes.filter((scene) => scene.headingMeta.intExt === 'UNKNOWN' || scene.headingMeta.dayNight === 'UNKNOWN').map((scene) => scene.id),
  };
  const categoryLabels = [
    ['total', 'Total Scenes'], ['int', 'INT.'], ['ext', 'EXT.'], ['mixed', 'INT./EXT.'], ['day', 'DAY'], ['night', 'NIGHT'],
    ['dawn_dusk', 'DAWN / DUSK'], ['continuous', 'CONTINUOUS'], ['later', 'LATER'], ['flashback', 'FLASHBACK'],
    ['montage', 'MONTAGE'], ['dream', 'DREAM'], ['unknown', 'UNKNOWN'],
  ];
  const sceneBreakdown = categoryLabels
    .map(([key, label]) => ({ key, label, count: categories[key].length, sceneIds: categories[key] }))
    .filter((item) => item.key === 'total' || item.count > 0);
  const mostDialogueScenes = [...sceneLengths].filter((scene) => scene.dialogueWords > 0).sort((a, b) => b.dialogueWords - a.dialogueWords).slice(0, 3);
  const mostActionScenes = [...sceneLengths].filter((scene) => scene.actionWords > 0).sort((a, b) => b.actionWords - a.actionWords).slice(0, 3);

  return {
    pages: parsed.pages,
    scenes: scenes.length,
    words: totalWords,
    estimatedRuntimeSeconds,
    interiorScenes: categories.int.length,
    exteriorScenes: categories.ext.length,
    mixedScenes: categories.mixed.length,
    dayScenes: categories.day.length,
    nightScenes: categories.night.length,
    dawnDuskScenes: categories.dawn_dusk.length,
    dialogueWords,
    actionWords,
    dialoguePercentage: balanceWords ? Math.round((dialogueWords / balanceWords) * 100) : 0,
    actionPercentage: balanceWords ? 100 - Math.round((dialogueWords / balanceWords) * 100) : 0,
    mostDialogueScenes,
    mostActionScenes,
    averageSceneSeconds: scenes.length ? Math.round(estimatedRuntimeSeconds / scenes.length) : 0,
    longestScene: sortedLengths[0] || null,
    shortestScene: sortedLengths.at(-1) || null,
    sceneLengths,
    lengthDistribution,
    sceneBreakdown,
    characters: entities.characterIndex,
    locations: entities.locationIndex,
  };
}

function buildAnalysisSnapshot(script, previous = {}) {
  const parsed = parseScreenplay(script || {});
  const rawScenes = parsed.scenes.map((scene) => {
    const text = scene.blocks.map((block) => block.text).filter(Boolean).join('\n');
    return { ...scene, text, contentHash: hashText(scene.blocks.map((block) => `${block.type}:${block.text}`).join('\n')) };
  });
  const identified = reconcileSceneIds(script?.id || 'script', rawScenes, previous).map((scene, index) => ({
    ...scene,
    ...sceneStats(scene),
    sceneNumber: index + 1,
    headingMeta: headingMetadata(scene.heading),
  }));
  const entities = createEntityIndexes(identified, previous);
  const metrics = computeMetrics(parsed, identified, entities);
  const contentHash = hashText(parsed.blocks.map((block) => `${block.type}:${block.text}`).join('\n'));
  const sceneIndex = identified.map((scene) => ({
    id: scene.id,
    sceneNumber: scene.sceneNumber,
    heading: scene.heading,
    page: scene.page,
    contentHash: scene.contentHash,
    words: scene.words,
    dialogueWords: scene.dialogueWords,
    actionWords: scene.actionWords,
    intExt: scene.headingMeta.intExt,
    dayNight: scene.headingMeta.dayNight,
    location: scene.headingMeta.location,
  }));
  return {
    projectId: script?.id || '',
    scriptId: script?.id || '',
    scriptVersion: script?.updatedAt || contentHash,
    contentHash,
    sceneIds: sceneIndex.map((scene) => scene.id),
    sceneIndex,
    characterIndex: entities.characterIndex,
    locationIndex: entities.locationIndex,
    metrics,
    hasEnoughContent: metrics.scenes >= 2 && metrics.words >= 80,
    sourceScenes: identified,
  };
}

export {
  buildAnalysisSnapshot,
  cleanText,
  hashText,
  headingMetadata,
  normalizeEmotionalArc,
  normalized,
  wordCount,
};
