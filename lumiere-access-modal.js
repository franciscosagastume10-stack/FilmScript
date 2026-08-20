// A single, account-safe presentation layer for server-confirmed Lumiere
// entitlement failures. Billing and credit enforcement remain on the API; this
// file only explains a response the server has already rejected.
(() => {
  const MODAL_ID = 'fs-lumiere-access-modal';
  const STYLE_ID = 'fs-lumiere-access-modal-style';
  const entitlementErrors = new Set([
    'filmscript_creator_required',
    'filmscript_pro_required',
    'image_generation_plan_required',
    'image_credits_exhausted',
    'lumiere_credits_exhausted',
    'insufficient_credits',
    'paid_plan_required',
    'full_plan_required',
  ]);

  let lastTrigger = null;
  let previouslyFocused = null;

  const isSpanish = () => {
    const language = String(window.filmscriptLanguage?.get?.() || document.documentElement.lang || 'en').toLowerCase();
    return language.startsWith('es');
  };

  const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const copyFor = (detail = {}) => {
    const spanish = isSpanish();
    const error = String(detail.error || '');
    const requiredTier = String(detail.requiredTier || detail.upgrade || '').toLowerCase();
    const tier = requiredTier === 'full' || error === 'image_generation_plan_required' || error === 'full_plan_required'
      ? (spanish ? 'FilmScript Full' : 'FilmScript Full')
      : (spanish ? 'FilmScript Creator o Full' : 'FilmScript Creator or Full');
    const standard = {
      eyebrow: spanish ? 'Acceso a Lumiere' : 'Lumiere access',
      title: spanish ? `Esta función requiere ${tier}` : `This feature requires ${tier}`,
      description: spanish
        ? 'Tu guion y tu trabajo manual siguen disponibles. Elige un plan cuando quieras continuar con esta función de Lumiere.'
        : 'Your screenplay and manual work remain available. Choose a plan whenever you are ready to continue with this Lumiere feature.',
      back: spanish ? 'Volver' : 'Back',
      pricing: spanish ? 'Ver planes' : 'View plans',
      note: spanish ? 'No se hicieron cambios en tu proyecto.' : 'No changes were made to your project.',
    };
    if (error === 'lumiere_credits_exhausted') {
      const exhaustedPlan = String(detail.plan || detail.credits?.plan || '').toLowerCase();
      if (exhaustedPlan === 'full') {
        return {
          ...standard,
          eyebrow: spanish ? 'Límite de Lumiere alcanzado' : 'Lumiere limit reached',
          title: spanish ? 'Tus usos se renovarán con el plan' : 'Your uses will renew with your plan',
          description: spanish
            ? 'Ya consumiste los usos de Lumiere incluidos en esta ventana de FilmScript Full. Se renuevan automáticamente; no se hizo ningún cargo adicional.'
            : 'You have used the Lumiere uses included in this FilmScript Full window. They renew automatically; no extra charge was made.',
        };
      }
      if (exhaustedPlan === 'creator') {
        return {
          ...standard,
          eyebrow: spanish ? 'Límite de Lumiere alcanzado' : 'Lumiere limit reached',
          title: spanish ? 'Ya usaste los usos de Creator' : 'You have used your Creator uses',
          description: spanish
            ? 'Cada acción de Lumiere consume un uso. Puedes esperar la renovación de tu ventana actual o cambiar a FilmScript Full; antes verás el ajuste exacto del plan.'
            : 'Each Lumiere action uses one use. You can wait for this window to renew or move to FilmScript Full; you will see the exact plan adjustment first.',
        };
      }
      return {
        ...standard,
        eyebrow: spanish ? 'Límite de Lumiere alcanzado' : 'Lumiere limit reached',
        title: spanish ? 'Ya usaste tus usos de Lumiere' : 'You have used your Lumiere uses',
        description: spanish
          ? 'Cada acción de Lumiere consume un uso, incluyendo Title Room, clichés, personajes y análisis. Ya usaste los usos incluidos; actualiza tu plan para continuar sin interrumpir tu proyecto.'
          : 'Each Lumiere action uses one use, including Title Room, clichés, characters, and analysis. You have used the included uses; upgrade your plan to continue without interrupting your project.',
      };
    }
    if (error === 'image_credits_exhausted') {
      return {
        ...standard,
        eyebrow: spanish ? 'Créditos de imagen agotados' : 'Image credits used',
        title: spanish ? 'No quedan créditos de imagen' : 'There are no image credits left',
        description: spanish
          ? 'El siguiente ciclo de tu plan renueva los créditos de imagen. Puedes revisar los planes para cambiar tu capacidad cuando quieras.'
          : 'Your next plan cycle renews image credits. You can review plans to change your capacity whenever you are ready.',
      };
    }
    if (error === 'insufficient_credits') {
      return {
        ...standard,
        eyebrow: spanish ? 'Créditos insuficientes' : 'Not enough credits',
        title: spanish ? 'No tienes suficientes créditos' : 'You do not have enough credits',
        description: spanish
          ? 'Esta acción necesita más créditos de los que están disponibles actualmente. Revisa un plan para continuar.'
          : 'This action needs more credits than are currently available. Review a plan to continue.',
      };
    }
    return standard;
  };

  const creditLine = (detail = {}) => {
    const required = number(detail.requiredCredits ?? detail.required);
    const available = number(detail.availableCredits ?? detail.available ?? detail.credits?.remaining);
    if (required == null || available == null) return '';
    const formatter = new Intl.NumberFormat(isSpanish() ? 'es-GT' : 'en-US');
    return isSpanish()
      ? `${formatter.format(available)} de ${formatter.format(required)} créditos disponibles`
      : `${formatter.format(available)} of ${formatter.format(required)} credits available`;
  };

  const installStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html[data-fs-lumiere-access-open] { overflow: hidden; }
      .fs-lumiere-access-backdrop {
        position: fixed; inset: 0; z-index: 2200; display: grid; place-items: center;
        padding: max(22px, env(safe-area-inset-top)) 22px max(22px, env(safe-area-inset-bottom));
        background: rgba(20, 20, 19, .34);
        backdrop-filter: blur(64px) saturate(1.38) brightness(.78);
        -webkit-backdrop-filter: blur(64px) saturate(1.38) brightness(.78);
        animation: fs-lumiere-access-fade .22s ease both;
      }
      .fs-lumiere-access-card {
        position: relative; isolation: isolate; width: min(448px, 100%); overflow: hidden;
        padding: 25px; border: 1px solid color-mix(in srgb, rgba(255,255,255,.92) 70%, var(--glass-border, rgba(255,255,255,.46)));
        border-radius: 28px 24px 29px 25px;
        background: rgba(255, 254, 249, .9);
        background: linear-gradient(135deg, color-mix(in srgb, var(--surface, #FFFEF9) 84%, transparent), color-mix(in srgb, var(--surface-secondary, #F3F0EA) 64%, transparent));
        color: var(--text-primary, var(--ink, #2C2C2A));
        box-shadow: 0 30px 88px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.72), inset 0 -1px 0 rgba(255,255,255,.16);
        backdrop-filter: blur(40px) saturate(1.28);
        -webkit-backdrop-filter: blur(40px) saturate(1.28);
        animation: fs-lumiere-access-rise .34s cubic-bezier(.2,.86,.25,1.12) both;
      }
      .fs-lumiere-access-card::before {
        content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
        background: radial-gradient(circle at 92% 3%, color-mix(in srgb, var(--accent, #BA7517) 17%, transparent), transparent 34%), linear-gradient(125deg, rgba(255,255,255,.38), transparent 42%);
      }
      .fs-lumiere-access-dismiss {
        position: absolute; top: 14px; right: 14px; width: 34px; height: 34px; padding: 0;
        display: grid; place-items: center; border: 1px solid color-mix(in srgb, var(--glass-border, rgba(34,34,32,.18)) 82%, rgba(255,255,255,.4));
        border-radius: 50%; background: color-mix(in srgb, var(--surface, #FFFEF9) 62%, transparent);
        color: var(--text-secondary, var(--muted, #77756e)); font: 500 22px/1 system-ui, sans-serif; cursor: pointer;
        transition: transform .16s ease, background-color .16s ease, color .16s ease;
      }
      .fs-lumiere-access-dismiss:hover { transform: scale(1.06); background: color-mix(in srgb, var(--accent, #BA7517) 13%, var(--surface, #FFFEF9)); color: var(--accent, #BA7517); }
      .fs-lumiere-access-mark {
        width: 46px; height: 46px; display: grid; place-items: center; margin-bottom: 18px;
        border: 1px solid color-mix(in srgb, var(--accent, #BA7517) 36%, rgba(255,255,255,.72)); border-radius: 16px 14px 17px 15px;
        background: color-mix(in srgb, var(--accent, #BA7517) 12%, transparent); color: var(--accent, #BA7517);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.62);
      }
      .fs-lumiere-access-mark svg { width: 24px; height: 24px; }
      .fs-lumiere-access-eyebrow { color: var(--accent, #BA7517); font-size: 10px; font-weight: 800; letter-spacing: 1.3px; text-transform: uppercase; }
      .fs-lumiere-access-title { max-width: 350px; margin: 8px 0 0; color: var(--text-primary, var(--ink, #2C2C2A)); font-size: clamp(21px, 5vw, 26px); font-weight: 800; letter-spacing: -.62px; line-height: 1.08; }
      .fs-lumiere-access-copy { max-width: 370px; margin: 11px 0 0; color: var(--text-secondary, var(--muted, #77756e)); font-size: 13px; line-height: 1.58; }
      .fs-lumiere-access-credit { margin: 15px 0 0; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--accent, #BA7517) 22%, rgba(255,255,255,.44)); border-radius: 14px; background: color-mix(in srgb, var(--accent, #BA7517) 8%, transparent); color: var(--text-primary, var(--ink, #2C2C2A)); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .fs-lumiere-access-actions { display: flex; gap: 9px; margin-top: 22px; }
      .fs-lumiere-access-action { min-height: 44px; border-radius: 14px; padding: 0 16px; border: 1px solid color-mix(in srgb, var(--glass-border, rgba(34,34,32,.2)) 86%, rgba(255,255,255,.44)); font: 750 13px/1 var(--fs-font-text, system-ui, sans-serif); cursor: pointer; transition: transform .17s ease, box-shadow .17s ease, background-color .17s ease; }
      .fs-lumiere-access-action:hover { transform: translateY(-1px); }
      .fs-lumiere-access-back { flex: 0 0 auto; color: var(--text-primary, var(--ink, #2C2C2A)); background: color-mix(in srgb, var(--surface, #FFFEF9) 64%, transparent); }
      .fs-lumiere-access-pricing { min-width: 146px; margin-left: auto; color: #fff; border-color: color-mix(in srgb, var(--accent, #BA7517) 74%, rgba(255,255,255,.68)); background: linear-gradient(135deg, color-mix(in srgb, var(--accent, #BA7517) 92%, #fff), var(--accent, #BA7517)); box-shadow: 0 8px 20px color-mix(in srgb, var(--accent, #BA7517) 30%, transparent), inset 0 1px 0 rgba(255,255,255,.28); }
      .fs-lumiere-access-pricing:hover { box-shadow: 0 11px 24px color-mix(in srgb, var(--accent, #BA7517) 40%, transparent), inset 0 1px 0 rgba(255,255,255,.34); }
      .fs-lumiere-access-note { margin: 15px 0 0; color: var(--text-secondary, var(--muted, #77756e)); font-size: 10.5px; line-height: 1.45; }
      .fs-lumiere-access-action:focus-visible, .fs-lumiere-access-dismiss:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent, #BA7517) 58%, white); outline-offset: 3px; }
      @keyframes fs-lumiere-access-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fs-lumiere-access-rise { from { opacity: 0; transform: translateY(14px) scale(.975); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @media (max-width: 460px) { .fs-lumiere-access-backdrop { padding: 16px; } .fs-lumiere-access-card { padding: 22px 20px 20px; border-radius: 24px 21px 25px 22px; } .fs-lumiere-access-actions { flex-direction: column-reverse; } .fs-lumiere-access-action { width: 100%; } .fs-lumiere-access-pricing { margin-left: 0; } }
      @media (prefers-reduced-transparency: reduce) { .fs-lumiere-access-backdrop { background: rgba(20,20,19,.72); backdrop-filter: none; -webkit-backdrop-filter: none; } .fs-lumiere-access-card { background: var(--surface, #FFFEF9); backdrop-filter: none; -webkit-backdrop-filter: none; } }
      @media (prefers-reduced-motion: reduce) { .fs-lumiere-access-backdrop, .fs-lumiere-access-card { animation: none; } .fs-lumiere-access-action, .fs-lumiere-access-dismiss { transition: none; } }
    `;
    document.head.append(style);
  };

  const eligible = (detail = {}) => {
    const status = Number(detail.status);
    return detail?.serverValidated === true
      && [402, 403, 429].includes(status)
      && entitlementErrors.has(String(detail.error || ''));
  };

  const close = () => {
    const root = document.getElementById(MODAL_ID);
    if (!root) return;
    root.remove();
    document.documentElement.removeAttribute('data-fs-lumiere-access-open');
    document.removeEventListener('keydown', onKeydown, true);
    const focusTarget = previouslyFocused;
    previouslyFocused = null;
    if (focusTarget && document.contains(focusTarget) && typeof focusTarget.focus === 'function') focusTarget.focus();
  };

  const focusable = (root) => [...root.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hasAttribute('hidden'));

  const onKeydown = (event) => {
    const root = document.getElementById(MODAL_ID);
    if (!root) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusable(root);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const goToPricing = () => {
    const page = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target = new URL('./Pricing.dc.html', window.location.href);
    target.searchParams.set('returnTo', page);
    window.location.assign(target.toString());
  };

  const present = (detail) => {
    if (!eligible(detail)) return;
    installStyles();
    lastTrigger = detail;
    close();
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const copy = copyFor(detail);
    const credits = creditLine(detail);
    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.className = 'fs-lumiere-access-backdrop';
    root.dataset.error = String(detail.error || '');
    root.innerHTML = `
      <section class="fs-lumiere-access-card" role="dialog" aria-modal="true" aria-labelledby="fs-lumiere-access-title" aria-describedby="fs-lumiere-access-copy" tabindex="-1">
        <button type="button" class="fs-lumiere-access-dismiss" aria-label="${copy.back}">×</button>
        <div class="fs-lumiere-access-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.8 1.65 5.55L19.2 11l-5.55 1.65L12 18.2l-1.65-5.55L4.8 11l5.55-1.65L12 3.8Z"></path><path d="m18.5 16 .65 2.15L21.3 18.8l-2.15.65L18.5 21.6l-.65-2.15-2.15-.65 2.15-.65L18.5 16Z"></path></svg></div>
        <div class="fs-lumiere-access-eyebrow">${copy.eyebrow}</div>
        <h2 id="fs-lumiere-access-title" class="fs-lumiere-access-title">${copy.title}</h2>
        <p id="fs-lumiere-access-copy" class="fs-lumiere-access-copy">${copy.description}</p>
        ${credits ? `<div class="fs-lumiere-access-credit">${credits}</div>` : ''}
        <div class="fs-lumiere-access-actions"><button type="button" class="fs-lumiere-access-action fs-lumiere-access-back">${copy.back}</button><button type="button" class="fs-lumiere-access-action fs-lumiere-access-pricing">${copy.pricing}</button></div>
        <p class="fs-lumiere-access-note">${copy.note}</p>
      </section>`;
    const dialog = root.querySelector('[role="dialog"]');
    const dismiss = root.querySelector('.fs-lumiere-access-dismiss');
    const back = root.querySelector('.fs-lumiere-access-back');
    const pricing = root.querySelector('.fs-lumiere-access-pricing');
    root.addEventListener('click', (event) => { if (event.target === root) close(); });
    dismiss.addEventListener('click', close);
    back.addEventListener('click', close);
    pricing.addEventListener('click', goToPricing);
    document.documentElement.setAttribute('data-fs-lumiere-access-open', '');
    document.body.append(root);
    document.addEventListener('keydown', onKeydown, true);
    window.requestAnimationFrame(() => dialog?.focus());
  };

  window.addEventListener('filmscript:upgrade-required', (event) => present(event?.detail || {}));
  window.addEventListener('filmscript:language-change', () => {
    if (lastTrigger && document.getElementById(MODAL_ID)) present(lastTrigger);
  });
  window.filmscriptLumiereAccessModal = Object.freeze({ present, close, get lastTrigger() { return lastTrigger; } });
})();
