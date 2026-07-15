// Shared account-level creative taste profile for Lumière.
// The server injects the saved profile into every subjective Lumière request.
(() => {
  'use strict';

  const MAX_ITEMS = 12;
  const DEFAULTS = Object.freeze({
    version: 1,
    enabled: true,
    directors: [],
    films: [],
    styles: [],
    feedbackTone: 'balanced',
    creativePriorities: '',
    avoidances: '',
    surpriseMe: true,
    updatedAt: '',
  });
  const STYLE_OPTIONS = [
    ['Character-driven', 'styleCharacter'],
    ['Observational', 'styleObservational'],
    ['Poetic realism', 'stylePoetic'],
    ['Dark comedy', 'styleDarkComedy'],
    ['Slow burn', 'styleSlowBurn'],
    ['Suspenseful', 'styleSuspenseful'],
    ['Minimal', 'styleMinimal'],
    ['Surreal', 'styleSurreal'],
    ['Naturalistic', 'styleNaturalistic'],
    ['Visually bold', 'styleVisual'],
    ['Intimate', 'styleIntimate'],
    ['Genre-forward', 'styleGenre'],
  ];
  const COPY = {
    en: {
      eyebrow: 'Creative taste profile', title: 'Make Lumière feel like your collaborator',
      intro: 'Share the films, filmmakers and qualities you return to. Lumière will use them as a quiet lens for feedback while protecting your own voice.',
      close: 'Close Lumière personalization', enabled: 'Use my taste profile',
      enabledHelp: 'Apply these references to subjective creative feedback.', loading: 'Opening your creative notebook…',
      directors: 'Favorite directors', directorsHelp: 'Add filmmakers whose creative decisions you admire.',
      directorsPlaceholder: 'e.g. Céline Sciamma, Alfonso Cuarón', films: 'Favorite films',
      filmsHelp: 'The films that best describe what you respond to.', filmsPlaceholder: 'e.g. Aftersun, Roma',
      qualities: 'Storytelling qualities', qualitiesHelp: 'Choose the qualities you want Lumière to understand, not a style to copy.',
      qualitiesPlaceholder: 'Add another quality', add: 'Add', feedback: 'How should feedback feel?',
      direct: 'Direct and rigorous', balanced: 'Balanced', gentle: 'Gentle and exploratory',
      protect: 'What should Lumière protect?', protectHelp: 'Your voice, ambiguity, humor, pacing, cultural detail…',
      protectPlaceholder: 'Keep the dialogue restrained and protect the silences between the characters.',
      avoid: 'What should Lumière avoid?', avoidHelp: 'Patterns of feedback that do not serve your work.',
      avoidPlaceholder: 'Do not make every emotional beat explicit or push the story toward a conventional ending.',
      surprise: 'Keep a window open', surpriseHelp: 'Offer at least one useful direction beyond my usual references.',
      guardTitle: 'Your taste is a compass, not a cage.',
      guardCopy: 'FilmScript uses these references for broad qualities such as rhythm, restraint and tone. Lumière will not imitate a filmmaker or overrule what is on the page.',
      reset: 'Start over', save: 'Save personalization', saving: 'Saving…', saved: 'Creative profile saved',
      savedHelp: 'Future Lumière feedback will use this profile when it is relevant.',
      unsaved: 'Unsaved changes', error: 'We could not save your creative profile. Try again.',
      retry: 'Try again', remove: 'Remove', summaryEmpty: 'No references yet',
      directorsCount: 'directors', filmsCount: 'films', qualitiesCount: 'qualities',
      styleCharacter: 'Character-driven', styleObservational: 'Observational', stylePoetic: 'Poetic realism',
      styleDarkComedy: 'Dark comedy', styleSlowBurn: 'Slow burn', styleSuspenseful: 'Suspenseful',
      styleMinimal: 'Minimal', styleSurreal: 'Surreal', styleNaturalistic: 'Naturalistic',
      styleVisual: 'Visually bold', styleIntimate: 'Intimate', styleGenre: 'Genre-forward',
    },
    es: {
      eyebrow: 'Perfil de gusto creativo', title: 'Haz que Lumière se sienta como tu colaborador',
      intro: 'Comparte las películas, cineastas y cualidades a las que siempre vuelves. Lumière las usará como una guía sutil para darte feedback sin perder tu propia voz.',
      close: 'Cerrar personalización de Lumière', enabled: 'Usar mi perfil de gusto',
      enabledHelp: 'Aplicar estas referencias al feedback creativo y subjetivo.', loading: 'Abriendo tu libreta creativa…',
      directors: 'Directores favoritos', directorsHelp: 'Agrega cineastas cuyas decisiones creativas admiras.',
      directorsPlaceholder: 'Ej. Céline Sciamma, Alfonso Cuarón', films: 'Películas favoritas',
      filmsHelp: 'Las películas que mejor describen lo que te conmueve.', filmsPlaceholder: 'Ej. Aftersun, Roma',
      qualities: 'Cualidades narrativas', qualitiesHelp: 'Elige las cualidades que Lumière debe comprender, no un estilo que deba copiar.',
      qualitiesPlaceholder: 'Agregar otra cualidad', add: 'Agregar', feedback: '¿Cómo debe sentirse el feedback?',
      direct: 'Directo y riguroso', balanced: 'Equilibrado', gentle: 'Suave y exploratorio',
      protect: '¿Qué debe proteger Lumière?', protectHelp: 'Tu voz, ambigüedad, humor, ritmo, detalles culturales…',
      protectPlaceholder: 'Mantén el diálogo contenido y protege los silencios entre los personajes.',
      avoid: '¿Qué debe evitar Lumière?', avoidHelp: 'Tipos de feedback que no ayudan a tu obra.',
      avoidPlaceholder: 'No hagas explícito cada momento emocional ni lleves la historia hacia un final convencional.',
      surprise: 'Mantener una ventana abierta', surpriseHelp: 'Ofrecer al menos una dirección útil fuera de mis referencias habituales.',
      guardTitle: 'Tu gusto es una brújula, no una jaula.',
      guardCopy: 'FilmScript usa estas referencias para cualidades generales como ritmo, sutileza y tono. Lumière no imitará a un cineasta ni ignorará lo que ya está en la página.',
      reset: 'Reiniciar', save: 'Guardar personalización', saving: 'Guardando…', saved: 'Perfil creativo guardado',
      savedHelp: 'El próximo feedback de Lumière usará este perfil cuando sea relevante.',
      unsaved: 'Cambios sin guardar', error: 'No pudimos guardar tu perfil creativo. Inténtalo de nuevo.',
      retry: 'Intentar de nuevo', remove: 'Eliminar', summaryEmpty: 'Aún no hay referencias',
      directorsCount: 'directores', filmsCount: 'películas', qualitiesCount: 'cualidades',
      styleCharacter: 'Centrada en personajes', styleObservational: 'Observacional', stylePoetic: 'Realismo poético',
      styleDarkComedy: 'Comedia oscura', styleSlowBurn: 'Desarrollo pausado', styleSuspenseful: 'Con suspenso',
      styleMinimal: 'Minimalista', styleSurreal: 'Surrealista', styleNaturalistic: 'Naturalista',
      styleVisual: 'Visualmente audaz', styleIntimate: 'Íntima', styleGenre: 'Con identidad de género',
    },
  };

  const cleanText = (value, max = 800) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanList = (value, maxLength = 80) => {
    const seen = new Set();
    const result = [];
    for (const raw of Array.isArray(value) ? value : []) {
      const item = cleanText(raw, maxLength);
      const key = item.toLocaleLowerCase('en-US');
      if (!item || seen.has(key)) continue;
      seen.add(key);
      result.push(item);
      if (result.length >= MAX_ITEMS) break;
    }
    return result;
  };
  const normalize = (value) => {
    const input = value && typeof value === 'object' ? value : {};
    return {
      version: 1,
      enabled: input.enabled !== false,
      directors: cleanList(input.directors),
      films: cleanList(input.films),
      styles: cleanList(input.styles, 60),
      feedbackTone: ['direct', 'balanced', 'gentle'].includes(input.feedbackTone) ? input.feedbackTone : 'balanced',
      creativePriorities: cleanText(input.creativePriorities),
      avoidances: cleanText(input.avoidances),
      surpriseMe: input.surpriseMe !== false,
      updatedAt: cleanText(input.updatedAt, 40),
    };
  };
  const comparable = (value) => JSON.stringify({ ...normalize(value), updatedAt: '' });
  const language = () => window.filmscriptLanguage?.get?.() === 'es' ? 'es' : 'en';
  const t = (key) => COPY[language()][key] || COPY.en[key] || key;

  let root = null;
  let current = normalize(DEFAULTS);
  let saved = normalize(DEFAULTS);
  let loading = false;
  let saving = false;
  let lastFocus = null;
  let previousOverflow = '';
  let statusMode = '';

  const css = `
    .fs-lp-overlay{--lp-bg:#F5F0E8;--lp-surface:#FFFEF9;--lp-soft:#EFEBE1;--lp-ink:#2C2C2A;--lp-muted:#77756F;--lp-hair:#D8D4C9;--lp-accent:#BA7517;position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(24,24,23,.42);backdrop-filter:blur(3px);opacity:0;visibility:hidden;transition:opacity .18s ease,visibility .18s ease;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:var(--lp-ink)}
    html[data-filmscript-theme="dark"] .fs-lp-overlay{--lp-bg:#111110;--lp-surface:#1B1B19;--lp-soft:#262522;--lp-ink:#F3EFE7;--lp-muted:#B5B0A7;--lp-hair:#45423B;--lp-accent:#D08A28;background:rgba(0,0,0,.62)}
    .fs-lp-overlay[data-open="true"]{opacity:1;visibility:visible}.fs-lp-modal{position:relative;isolation:isolate;width:min(760px,100%);max-height:calc(100vh - 36px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--lp-surface);border:1.3px solid var(--lp-ink);border-radius:22px 20px 23px 19px;box-shadow:0 24px 70px rgba(20,20,19,.24);animation:fs-lp-in .22s cubic-bezier(.2,.8,.25,1) both}
    .fs-lp-modal:focus{outline:none}.fs-lp-modal:after{content:"";position:absolute;inset:5px 4px 4px 5px;z-index:-1;border:1px solid color-mix(in srgb,var(--lp-ink) 34%,transparent);border-radius:18px 22px 19px 21px;pointer-events:none}.fs-lp-head{display:flex;align-items:flex-start;gap:15px;padding:24px 26px 19px;border-bottom:1px solid var(--lp-hair)}
    .fs-lp-mark{width:43px;height:43px;flex:0 0 43px;display:grid;place-items:center;color:var(--lp-accent);background:color-mix(in srgb,var(--lp-accent) 10%,transparent);border:1px solid color-mix(in srgb,var(--lp-accent) 42%,transparent);border-radius:13px 15px 12px 14px}.fs-lp-mark svg{width:24px;height:24px;transition:transform .22s ease}.fs-lp-mark:hover svg{transform:rotate(12deg)}
    .fs-lp-eyebrow{font-size:10px;line-height:1.2;text-transform:uppercase;letter-spacing:1.45px;font-weight:700;color:var(--lp-accent)}.fs-lp-title{margin:5px 0 0;font-size:22px;line-height:1.18;letter-spacing:-.45px;font-weight:700}.fs-lp-intro{margin:7px 0 0;max-width:590px;color:var(--lp-muted);font-size:12.5px;line-height:1.5}
    .fs-lp-close{width:36px;height:36px;flex:0 0 36px;border:0;background:transparent;color:var(--lp-muted);border-radius:10px;font-size:22px;cursor:pointer;transition:background .15s,color .15s,transform .12s}.fs-lp-close:hover{background:var(--lp-soft);color:var(--lp-ink)}.fs-lp-close:active{transform:scale(.95)}
    .fs-lp-scroll{min-height:0;overflow-y:auto;padding:22px 26px 28px;background:linear-gradient(180deg,var(--lp-surface),color-mix(in srgb,var(--lp-bg) 32%,var(--lp-surface)))}.fs-lp-loading{display:none;align-items:center;gap:10px;padding:13px 15px;margin-bottom:15px;border-radius:12px 14px 11px 13px;background:var(--lp-soft);color:var(--lp-muted);font-size:12px}.fs-lp-overlay[data-loading="true"] .fs-lp-loading{display:flex}.fs-lp-overlay[data-loading="true"] .fs-lp-form{opacity:.42;pointer-events:none}.fs-lp-spinner{width:14px;height:14px;border:1.5px solid var(--lp-hair);border-top-color:var(--lp-accent);border-radius:50%;animation:fs-lp-spin .7s linear infinite}
    .fs-lp-form{display:grid;gap:16px;transition:opacity .16s ease}.fs-lp-card{position:relative;padding:17px 18px 18px;background:var(--lp-surface);border:1px solid var(--lp-hair);border-radius:15px 17px 14px 16px}.fs-lp-card:after{content:"";position:absolute;inset:3px 4px 4px 3px;border:1px solid color-mix(in srgb,var(--lp-hair) 48%,transparent);border-radius:13px 14px 15px 12px;pointer-events:none}.fs-lp-card>*{position:relative;z-index:1}.fs-lp-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.fs-lp-label{font-size:13.5px;line-height:1.3;font-weight:650}.fs-lp-help{margin-top:3px;color:var(--lp-muted);font-size:11.5px;line-height:1.45}.fs-lp-summary{color:var(--lp-accent);font-size:10px;line-height:1.3;white-space:nowrap}
    .fs-lp-entry{display:flex;gap:7px;margin-top:12px}.fs-lp-input,.fs-lp-textarea{width:100%;border:1px solid var(--lp-hair);outline:0;background:var(--lp-bg);color:var(--lp-ink);border-radius:10px 11px 9px 10px;font:inherit;font-size:12.5px;transition:border-color .15s,box-shadow .15s,background .15s}.fs-lp-input{height:41px;padding:0 12px}.fs-lp-textarea{min-height:92px;padding:11px 12px;line-height:1.5;resize:vertical}.fs-lp-input:focus,.fs-lp-textarea:focus{border-color:var(--lp-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--lp-accent) 13%,transparent);background:var(--lp-surface)}.fs-lp-add{min-width:76px;height:41px;border:1px solid var(--lp-hair);background:var(--lp-surface);color:var(--lp-ink);border-radius:10px 12px 9px 11px;font:inherit;font-size:11.5px;font-weight:650;cursor:pointer;transition:transform .12s,border-color .15s,color .15s}.fs-lp-add:hover{border-color:var(--lp-accent);color:var(--lp-accent)}.fs-lp-add:active{transform:scale(.97)}
    .fs-lp-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.fs-lp-chip{display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:5px 8px 5px 10px;border:1px solid var(--lp-hair);border-radius:9px 10px 8px 9px;background:var(--lp-soft);color:var(--lp-ink);font-size:11.5px}.fs-lp-chip button{width:18px;height:18px;display:grid;place-items:center;padding:0;border:0;background:transparent;color:var(--lp-muted);font-size:15px;line-height:1;cursor:pointer;border-radius:5px}.fs-lp-chip button:hover{background:color-mix(in srgb,var(--lp-ink) 9%,transparent);color:var(--lp-ink)}
    .fs-lp-style-grid{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.fs-lp-style{min-height:34px;padding:7px 10px;border:1px solid var(--lp-hair);border-radius:9px 11px 8px 10px;background:transparent;color:var(--lp-muted);font:inherit;font-size:11.5px;cursor:pointer;transition:transform .12s,border-color .15s,color .15s,background .15s}.fs-lp-style:hover{transform:translateY(-1px);color:var(--lp-ink);border-color:var(--lp-muted)}.fs-lp-style[aria-pressed="true"]{border-color:var(--lp-accent);background:color-mix(in srgb,var(--lp-accent) 11%,transparent);color:var(--lp-accent)}
    .fs-lp-tone{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.fs-lp-tone button{min-height:41px;padding:7px 10px;border:1px solid var(--lp-hair);border-radius:10px 11px 9px 10px;background:transparent;color:var(--lp-muted);font:inherit;font-size:11px;cursor:pointer;transition:border-color .15s,color .15s,background .15s,transform .12s}.fs-lp-tone button:hover{color:var(--lp-ink)}.fs-lp-tone button[aria-pressed="true"]{border-color:var(--lp-accent);background:color-mix(in srgb,var(--lp-accent) 11%,transparent);color:var(--lp-accent)}.fs-lp-tone button:active{transform:scale(.98)}
    .fs-lp-notes{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fs-lp-switch-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 14px;border:1px solid var(--lp-hair);border-radius:12px 14px 11px 13px;background:var(--lp-surface)}.fs-lp-switch-copy{min-width:0}.fs-lp-switch{position:relative;width:42px;height:24px;flex:0 0 42px}.fs-lp-switch input{position:absolute;opacity:0;pointer-events:none}.fs-lp-switch span{position:absolute;inset:0;border-radius:999px;background:var(--lp-hair);cursor:pointer;transition:background .18s}.fs-lp-switch span:after{content:"";position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:var(--lp-surface);box-shadow:0 1px 4px rgba(0,0,0,.2);transition:transform .18s}.fs-lp-switch input:checked+span{background:var(--lp-accent)}.fs-lp-switch input:checked+span:after{transform:translateX(18px)}.fs-lp-switch input:focus-visible+span{outline:2px solid var(--lp-accent);outline-offset:2px}
    .fs-lp-guard{display:flex;gap:12px;padding:15px 16px;border-radius:13px 15px 12px 14px;background:color-mix(in srgb,var(--lp-accent) 9%,var(--lp-surface));color:var(--lp-ink)}.fs-lp-spark{width:24px;height:24px;flex:0 0 24px;color:var(--lp-accent)}.fs-lp-guard strong{display:block;font-size:12.5px}.fs-lp-guard p{margin:4px 0 0;color:var(--lp-muted);font-size:11px;line-height:1.5}
    .fs-lp-foot{display:flex;align-items:center;gap:12px;padding:16px 26px 20px;border-top:1px solid var(--lp-hair);background:var(--lp-surface);border-radius:0 0 21px 19px}.fs-lp-status{flex:1;min-width:0;color:var(--lp-muted);font-size:11px;line-height:1.35}.fs-lp-status[data-mode="saved"]{color:#2E7D5B}.fs-lp-status[data-mode="error"]{color:#C74440}.fs-lp-reset,.fs-lp-save{min-height:41px;padding:9px 15px;border-radius:10px 12px 9px 11px;font:inherit;font-size:12px;font-weight:650;cursor:pointer;transition:transform .12s,filter .15s,border-color .15s}.fs-lp-reset{border:1px solid var(--lp-hair);background:transparent;color:var(--lp-muted)}.fs-lp-save{min-width:158px;border:1px solid var(--lp-accent);background:var(--lp-accent);color:#FFFEF9}.fs-lp-reset:hover{border-color:var(--lp-muted);color:var(--lp-ink)}.fs-lp-save:hover{filter:brightness(1.06)}.fs-lp-reset:active,.fs-lp-save:active{transform:scale(.98)}.fs-lp-save:disabled{opacity:.55;cursor:wait}
    .fs-lp-overlay button:focus-visible{outline:2px solid var(--lp-accent);outline-offset:2px}@keyframes fs-lp-in{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}@keyframes fs-lp-spin{to{transform:rotate(360deg)}}
    @media(max-width:640px){.fs-lp-overlay{padding:0;place-items:end center}.fs-lp-modal{width:100%;max-height:96vh;border-radius:20px 20px 0 0;border-bottom:0}.fs-lp-modal:after{border-radius:17px 18px 0 0}.fs-lp-head{padding:19px 18px 15px;gap:11px}.fs-lp-mark{width:38px;height:38px;flex-basis:38px}.fs-lp-title{font-size:19px}.fs-lp-intro{font-size:11.5px}.fs-lp-scroll{padding:17px 16px 22px}.fs-lp-card{padding:15px}.fs-lp-card-head{flex-direction:column;gap:5px}.fs-lp-summary{white-space:normal}.fs-lp-notes{grid-template-columns:1fr}.fs-lp-tone{grid-template-columns:1fr}.fs-lp-foot{padding:13px 16px calc(15px + env(safe-area-inset-bottom));flex-wrap:wrap}.fs-lp-status{flex-basis:100%;order:-1}.fs-lp-reset{flex:1}.fs-lp-save{flex:2;min-width:0}}
    @media(prefers-reduced-motion:reduce){.fs-lp-modal,.fs-lp-spinner{animation:none!important}.fs-lp-overlay,.fs-lp-mark svg,.fs-lp-style,.fs-lp-save,.fs-lp-reset{transition-duration:.01ms!important}}
  `;

  const template = `
    <div class="fs-lp-modal" role="dialog" aria-modal="true" aria-labelledby="fs-lp-title" tabindex="-1">
      <header class="fs-lp-head">
        <div class="fs-lp-mark" aria-hidden="true"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3.6l1 2.8 2.7.8 2.5-1.4 2 2.1-1.5 2.5.7 2.8 2.8 1-.1 2.9-2.8.9-.9 2.7 1.4 2.5-2.1 2-2.5-1.5-2.8.8-1 2.7-2.9-.1-.9-2.7-2.8-.9-2.4 1.4-2.1-2 1.4-2.5-.8-2.8-2.7-1 .1-2.9 2.7-.9.9-2.8-1.4-2.4 2.1-2.1 2.4 1.4 2.9-.8 1-2.8z"></path><circle cx="14" cy="14" r="3.6"></circle><path d="M19.8 4.4c1 .5 1.8 1.2 2.5 2.1"></path></svg></div>
        <div style="flex:1;min-width:0"><div class="fs-lp-eyebrow" data-lp-t="eyebrow"></div><h1 class="fs-lp-title" id="fs-lp-title" data-lp-t="title"></h1><p class="fs-lp-intro" data-lp-t="intro"></p></div>
        <button class="fs-lp-close" type="button" data-lp-close aria-label="Close">×</button>
      </header>
      <main class="fs-lp-scroll">
        <div class="fs-lp-loading"><span class="fs-lp-spinner"></span><span data-lp-t="loading"></span></div>
        <form class="fs-lp-form" data-lp-form>
          <div class="fs-lp-switch-row"><div class="fs-lp-switch-copy"><div class="fs-lp-label" data-lp-t="enabled"></div><div class="fs-lp-help" data-lp-t="enabledHelp"></div></div><label class="fs-lp-switch"><input type="checkbox" data-lp-enabled><span></span></label></div>
          <section class="fs-lp-card"><div class="fs-lp-card-head"><div><div class="fs-lp-label" data-lp-t="directors"></div><div class="fs-lp-help" data-lp-t="directorsHelp"></div></div><div class="fs-lp-summary" data-lp-summary></div></div><div class="fs-lp-entry"><input class="fs-lp-input" data-lp-director-input maxlength="240"><button class="fs-lp-add" type="button" data-lp-add="directors" data-lp-t="add"></button></div><div class="fs-lp-chips" data-lp-directors></div></section>
          <section class="fs-lp-card"><div class="fs-lp-label" data-lp-t="films"></div><div class="fs-lp-help" data-lp-t="filmsHelp"></div><div class="fs-lp-entry"><input class="fs-lp-input" data-lp-film-input maxlength="240"><button class="fs-lp-add" type="button" data-lp-add="films" data-lp-t="add"></button></div><div class="fs-lp-chips" data-lp-films></div></section>
          <section class="fs-lp-card"><div class="fs-lp-label" data-lp-t="qualities"></div><div class="fs-lp-help" data-lp-t="qualitiesHelp"></div><div class="fs-lp-style-grid" data-lp-style-grid></div><div class="fs-lp-entry"><input class="fs-lp-input" data-lp-style-input maxlength="120"><button class="fs-lp-add" type="button" data-lp-add="styles" data-lp-t="add"></button></div><div class="fs-lp-chips" data-lp-custom-styles></div></section>
          <section class="fs-lp-card"><div class="fs-lp-label" data-lp-t="feedback"></div><div class="fs-lp-tone"><button type="button" data-lp-tone="direct" data-lp-t="direct"></button><button type="button" data-lp-tone="balanced" data-lp-t="balanced"></button><button type="button" data-lp-tone="gentle" data-lp-t="gentle"></button></div></section>
          <div class="fs-lp-notes"><section class="fs-lp-card"><label class="fs-lp-label" for="fs-lp-protect" data-lp-t="protect"></label><div class="fs-lp-help" data-lp-t="protectHelp"></div><textarea id="fs-lp-protect" class="fs-lp-textarea" data-lp-protect maxlength="800"></textarea></section><section class="fs-lp-card"><label class="fs-lp-label" for="fs-lp-avoid" data-lp-t="avoid"></label><div class="fs-lp-help" data-lp-t="avoidHelp"></div><textarea id="fs-lp-avoid" class="fs-lp-textarea" data-lp-avoid maxlength="800"></textarea></section></div>
          <div class="fs-lp-switch-row"><div class="fs-lp-switch-copy"><div class="fs-lp-label" data-lp-t="surprise"></div><div class="fs-lp-help" data-lp-t="surpriseHelp"></div></div><label class="fs-lp-switch"><input type="checkbox" data-lp-surprise><span></span></label></div>
          <aside class="fs-lp-guard"><svg class="fs-lp-spark" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"><path d="M14 4.2c.6 5.3 2.8 7.5 8.1 8.1-5.3.6-7.5 2.8-8.1 8.1-.6-5.3-2.8-7.5-8.1-8.1 5.3-.6 7.5-2.8 8.1-8.1z"></path><path d="M22.4 4.8v4.1M20.4 6.9h4"></path></svg><div><strong data-lp-t="guardTitle"></strong><p data-lp-t="guardCopy"></p></div></aside>
        </form>
      </main>
      <footer class="fs-lp-foot"><div class="fs-lp-status" data-lp-status aria-live="polite"></div><button class="fs-lp-reset" type="button" data-lp-reset data-lp-t="reset"></button><button class="fs-lp-save" type="button" data-lp-save data-lp-t="save"></button></footer>
    </div>`;

  function mount() {
    if (root) return root;
    const style = document.createElement('style');
    style.id = 'filmscript-lumiere-preferences-style';
    style.textContent = css;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.className = 'fs-lp-overlay';
    root.dataset.open = 'false';
    root.dataset.loading = 'false';
    root.setAttribute('data-i18n-skip', '');
    root.innerHTML = template.replaceAll('Lumière', 'Lumiere');
    document.body.appendChild(root);

    root.addEventListener('click', (event) => {
      if (event.target === root || event.target.closest('[data-lp-close]')) close();
      const add = event.target.closest('[data-lp-add]');
      if (add) addFromInput(add.dataset.lpAdd);
      const remove = event.target.closest('[data-lp-remove]');
      if (remove) removeItem(remove.dataset.lpField, remove.dataset.lpValue);
      const styleButton = event.target.closest('[data-lp-style]');
      if (styleButton) toggleStyle(styleButton.dataset.lpStyle);
      const tone = event.target.closest('[data-lp-tone]');
      if (tone) { current.feedbackTone = tone.dataset.lpTone; markDirty(); renderTone(); }
      if (event.target.closest('[data-lp-reset]')) reset();
      if (event.target.closest('[data-lp-save]')) save();
    });
    root.addEventListener('input', (event) => {
      if (event.target.matches('[data-lp-protect]')) { current.creativePriorities = event.target.value; markDirty(); }
      if (event.target.matches('[data-lp-avoid]')) { current.avoidances = event.target.value; markDirty(); }
      if (event.target.matches('[data-lp-enabled]')) { current.enabled = event.target.checked; markDirty(); }
      if (event.target.matches('[data-lp-surprise]')) { current.surpriseMe = event.target.checked; markDirty(); }
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'Enter' && event.target.matches('[data-lp-director-input],[data-lp-film-input],[data-lp-style-input]')) {
        event.preventDefault();
        const field = event.target.matches('[data-lp-director-input]') ? 'directors' : event.target.matches('[data-lp-film-input]') ? 'films' : 'styles';
        addFromInput(field);
      }
      if (event.key === 'Tab') trapFocus(event);
    });
    window.addEventListener('filmscript:language-change', () => { if (root?.dataset.open === 'true') { applyCopy(); renderAll(false); } });
    return root;
  }

  const q = (selector) => root?.querySelector(selector);
  function applyCopy() {
    root.querySelectorAll('[data-lp-t]').forEach((node) => { node.textContent = t(node.dataset.lpT); });
    q('[data-lp-close]').setAttribute('aria-label', t('close'));
    q('[data-lp-director-input]').placeholder = t('directorsPlaceholder');
    q('[data-lp-film-input]').placeholder = t('filmsPlaceholder');
    q('[data-lp-style-input]').placeholder = t('qualitiesPlaceholder');
    q('[data-lp-protect]').placeholder = t('protectPlaceholder');
    q('[data-lp-avoid]').placeholder = t('avoidPlaceholder');
  }

  function renderSummary() {
    const parts = [];
    if (current.directors.length) parts.push(`${current.directors.length} ${t('directorsCount')}`);
    if (current.films.length) parts.push(`${current.films.length} ${t('filmsCount')}`);
    if (current.styles.length) parts.push(`${current.styles.length} ${t('qualitiesCount')}`);
    q('[data-lp-summary]').textContent = parts.join(' · ') || t('summaryEmpty');
  }

  function renderChips(selector, values, field, filter = () => true) {
    const host = q(selector);
    host.replaceChildren();
    values.filter(filter).forEach((value) => {
      const chip = document.createElement('span');
      chip.className = 'fs-lp-chip';
      const label = document.createElement('span');
      label.textContent = value;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.dataset.lpRemove = '1';
      remove.dataset.lpField = field;
      remove.dataset.lpValue = value;
      remove.setAttribute('aria-label', `${t('remove')} ${value}`);
      chip.append(label, remove);
      host.appendChild(chip);
    });
  }

  function renderStyles() {
    const host = q('[data-lp-style-grid]');
    host.replaceChildren();
    STYLE_OPTIONS.forEach(([value, key]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fs-lp-style';
      button.dataset.lpStyle = value;
      button.textContent = t(key);
      button.setAttribute('aria-pressed', current.styles.includes(value) ? 'true' : 'false');
      host.appendChild(button);
    });
    const presets = new Set(STYLE_OPTIONS.map(([value]) => value));
    renderChips('[data-lp-custom-styles]', current.styles, 'styles', (value) => !presets.has(value));
  }

  function renderTone() {
    root.querySelectorAll('[data-lp-tone]').forEach((button) => button.setAttribute('aria-pressed', button.dataset.lpTone === current.feedbackTone ? 'true' : 'false'));
  }

  function renderAll(setFields = true) {
    renderSummary();
    renderChips('[data-lp-directors]', current.directors, 'directors');
    renderChips('[data-lp-films]', current.films, 'films');
    renderStyles();
    renderTone();
    q('[data-lp-enabled]').checked = current.enabled;
    q('[data-lp-surprise]').checked = current.surpriseMe;
    if (setFields) {
      q('[data-lp-protect]').value = current.creativePriorities;
      q('[data-lp-avoid]').value = current.avoidances;
      q('[data-lp-director-input]').value = '';
      q('[data-lp-film-input]').value = '';
      q('[data-lp-style-input]').value = '';
    }
  }

  function setStatus(mode, message, detail = '') {
    statusMode = mode;
    const node = q('[data-lp-status]');
    node.dataset.mode = mode;
    node.textContent = detail ? `${message} · ${detail}` : message;
  }

  function markDirty() {
    const dirty = comparable(current) !== comparable(saved);
    setStatus(dirty ? 'dirty' : '', dirty ? t('unsaved') : '');
    renderSummary();
  }

  function addFromInput(field) {
    const input = q(field === 'directors' ? '[data-lp-director-input]' : field === 'films' ? '[data-lp-film-input]' : '[data-lp-style-input]');
    const entries = String(input.value || '').split(/[,;\n]+/).map((item) => cleanText(item, field === 'styles' ? 60 : 80)).filter(Boolean);
    if (!entries.length) return;
    current[field] = cleanList([...current[field], ...entries], field === 'styles' ? 60 : 80);
    input.value = '';
    renderAll(false);
    markDirty();
    input.focus();
  }

  function removeItem(field, value) {
    if (!['directors', 'films', 'styles'].includes(field)) return;
    current[field] = current[field].filter((item) => item !== value);
    renderAll(false);
    markDirty();
  }

  function toggleStyle(value) {
    current.styles = current.styles.includes(value) ? current.styles.filter((item) => item !== value) : cleanList([...current.styles, value], 60);
    renderStyles();
    markDirty();
  }

  function reset() {
    current = normalize(DEFAULTS);
    renderAll(true);
    markDirty();
  }

  async function load() {
    loading = true;
    root.dataset.loading = 'true';
    setStatus('', '');
    try {
      const response = window.filmscriptBilling?.getLumierePreferences
        ? await window.filmscriptBilling.getLumierePreferences()
        : await fetch('/api/me/lumiere-preferences', { credentials: 'include' }).then((res) => res.json());
      current = normalize(response?.preferences);
      saved = normalize(current);
      renderAll(true);
    } catch (error) {
      setStatus('error', t('error'));
    } finally {
      loading = false;
      root.dataset.loading = 'false';
    }
  }

  async function save() {
    if (saving || loading) return;
    saving = true;
    const button = q('[data-lp-save]');
    button.disabled = true;
    button.textContent = t('saving');
    setStatus('', t('saving'));
    try {
      const payload = normalize({ ...current, updatedAt: new Date().toISOString() });
      const response = window.filmscriptBilling?.updateLumierePreferences
        ? await window.filmscriptBilling.updateLumierePreferences(payload)
        : await fetch('/api/me/lumiere-preferences', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((res) => res.json());
      if (!response?.preferences) throw new Error('preferences not saved');
      current = normalize(response.preferences);
      saved = normalize(current);
      renderAll(true);
      setStatus('saved', t('saved'), t('savedHelp'));
      window.dispatchEvent(new CustomEvent('filmscript:lumiere-preferences-change', { detail: { preferences: { ...saved } } }));
    } catch (error) {
      setStatus('error', t('error'));
    } finally {
      saving = false;
      button.disabled = false;
      button.textContent = t('save');
    }
  }

  function trapFocus(event) {
    const focusable = Array.from(root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter((node) => node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function open() {
    mount();
    applyCopy();
    lastFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.dataset.open = 'true';
    root.querySelector('.fs-lp-modal').focus();
    await load();
  }

  function close() {
    if (!root || root.dataset.open !== 'true') return;
    root.dataset.open = 'false';
    document.body.style.overflow = previousOverflow;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  window.filmscriptLumierePreferences = Object.freeze({
    open,
    close,
    load,
    get: () => ({ ...saved, directors: [...saved.directors], films: [...saved.films], styles: [...saved.styles] }),
    normalize,
    isConfigured: () => !!(saved.directors.length || saved.films.length || saved.styles.length || saved.creativePriorities || saved.avoidances),
  });
})();
