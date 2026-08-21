// Persistent image-credit availability next to the account avatar.
// Kept deliberately small and isolated so it does not add work to editor,
// canvas, or timeline renders.
(() => {
  'use strict';

  const AVATAR_SELECTOR = '[data-testid="account-avatar"]';
  const INDICATOR_CLASS = 'fs-avatar-credit';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RADIUS = 13;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  let refreshTimer = null;
  let refreshInFlight = false;
  let refreshQueued = false;
  let paintQueued = false;
  let lastCreditState = null;
  let lastCredits = null;

  const isSpanish = () => String(window.filmscriptLanguage?.get?.() || document.documentElement.lang || 'en')
    .toLowerCase().startsWith('es');
  const number = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const formatNumber = (value) => {
    try {
      return new Intl.NumberFormat(isSpanish() ? 'es' : 'en').format(value);
    } catch (_) {
      return String(value);
    }
  };
  const tone = (pct) => pct <= 10 ? '#C85A51' : pct <= 30 ? '#C68A2B' : '#5D9976';

  function formatReset(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(isSpanish() ? 'es-GT' : 'en-US', {
        day: 'numeric', month: 'short',
      }).format(date);
    } catch (_) {
      return '';
    }
  }

  function normalizeCredits(credits) {
    // The image object is the current contract. The ring and the account
    // panel derive their fill from real credit counts; FilmScript never
    // sends or displays a %.
    const image = credits?.image && typeof credits.image === 'object'
      ? credits.image
      : credits?.imageCredits && typeof credits.imageCredits === 'object'
        ? credits.imageCredits
        : null;
    const remaining = number(image?.remaining);
    const limit = number(image?.limit);
    const unlimited = image?.unlimited === true;
    const included = unlimited || (limit != null && limit > 0);
    const legacyRemaining = number(credits?.remaining);
    const derivedPct = unlimited ? 100 : remaining != null && limit != null && limit > 0
      ? (remaining / limit) * 100
      : null;
    const pct = clamp(derivedPct ?? 0, 0, 100);
    const count = remaining != null ? Math.max(0, remaining) : legacyRemaining != null ? Math.max(0, legacyRemaining) : null;
    const spanish = isSpanish();
    const noun = image ? (spanish ? 'créditos de imagen' : 'image credits') : (spanish ? 'créditos' : 'credits');
    const label = included && count == null
      ? (spanish ? `${noun[0].toUpperCase()}${noun.slice(1)} incluidos` : `${noun[0].toUpperCase()}${noun.slice(1)} included`)
      : count == null
        ? (spanish ? `${noun[0].toUpperCase()}${noun.slice(1)} no incluidos` : `${noun[0].toUpperCase()}${noun.slice(1)} not included`)
        : (spanish ? `${formatNumber(count)} ${noun} disponibles` : `${formatNumber(count)} ${noun} remaining`);

    const plan = String(image?.plan || credits?.plan || 'free').trim().toLowerCase();
    const cost = Math.max(1, number(image?.costPerImage) || 3);

    return {
      pct,
      color: tone(pct),
      label,
      plan,
      image,
      included,
      unlimited,
      limit,
      count,
      cost,
      resetLabel: formatReset(image?.resetAt),
      signature: `${pct.toFixed(2)}|${label}|${plan}|${cost}|${image?.resetAt || ''}`,
    };
  }

  function installStyles() {
    if (document.getElementById('fs-avatar-credit-style')) return;
    const style = document.createElement('style');
    style.id = 'fs-avatar-credit-style';
    style.textContent = `
      .fs-avatar-credit-host { position: relative; isolation: isolate; }
      .fs-avatar-credit-host > [data-testid="account-avatar"] { position: relative; z-index: 1; box-shadow: none; }
      .${INDICATOR_CLASS} { position: absolute; z-index: 2; inset: -4px; display: block; pointer-events: none; transform-origin: center; animation: fs-credit-in .28s cubic-bezier(.2,.8,.2,1) both; }
      .${INDICATOR_CLASS} svg { display: block; width: 100%; height: 100%; overflow: visible; transform: rotate(-90deg); }
      .${INDICATOR_CLASS} .fs-avatar-credit-track { fill: none; stroke: color-mix(in srgb, var(--surface, #FFFEF9) 42%, var(--chrome, #232322)); stroke-width: 2.4; opacity: .8; }
      .${INDICATOR_CLASS} .fs-avatar-credit-progress { fill: none; stroke: var(--fs-credit-color, #5D9976); stroke-width: 2.4; stroke-linecap: round; transition: stroke-dasharray .48s cubic-bezier(.2,.8,.2,1), stroke .28s ease; }
      .fs-avatar-credit-host:hover .${INDICATOR_CLASS}, .fs-avatar-credit-host:focus-within .${INDICATOR_CLASS} { transform: scale(1.055); }
      .fs-profile-credit { position: relative; isolation: isolate; display: grid; gap: 8px; margin: 9px 0 10px; padding: 10px 11px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--hair, #E7E4DA) 88%, var(--accent, #BA7517)); border-radius: 11px 9px 12px 10px; background: color-mix(in srgb, var(--surface, #FFFEF9) 78%, transparent); -webkit-backdrop-filter: blur(28px) saturate(1.18); backdrop-filter: blur(28px) saturate(1.18); color: var(--ink, #2C2C2A); animation: fs-credit-panel-in .23s cubic-bezier(.2,.8,.2,1) both; }
      .fs-profile-credit::after { content: ""; position: absolute; inset: 3px -2px -2px 3px; z-index: -1; border: 1px solid color-mix(in srgb, var(--hair, #E7E4DA) 68%, transparent); border-radius: 9px 11px 10px 12px; pointer-events: none; }
      .fs-profile-credit-head, .fs-profile-credit-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; min-width: 0; }
      .fs-profile-credit-title { font-size: 11.5px; font-weight: 700; letter-spacing: -.08px; }
      .fs-profile-credit-balance { min-width: 0; overflow: hidden; color: var(--muted, #888780); font-size: 10.5px; white-space: nowrap; text-overflow: ellipsis; }
      .fs-profile-credit-balance strong { color: var(--ink, #2C2C2A); font-weight: 750; }
      .fs-profile-credit-track { height: 5px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--hair, #E7E4DA) 84%, var(--bg, #F5F0E8)); box-shadow: inset 0 1px 1px rgba(35,35,34,.05); }
      .fs-profile-credit-fill { width: 0; height: 100%; border-radius: inherit; background: var(--fs-profile-credit-color, #5D9976); box-shadow: 0 1px 5px color-mix(in srgb, var(--fs-profile-credit-color, #5D9976) 32%, transparent); transition: width .5s cubic-bezier(.2,.8,.2,1), background-color .24s ease; }
      .fs-profile-credit-meta { color: var(--muted, #888780); font-size: 9.5px; line-height: 1.35; }
      .fs-profile-credit-meta > span:last-child { text-align: right; }
      .fs-profile-credit-action { justify-self: start; margin-top: 1px; padding: 0; border: 0; background: transparent; color: var(--accent, #BA7517); font: inherit; font-size: 10.5px; font-weight: 750; line-height: 1.25; cursor: pointer; }
      .fs-profile-credit-action:hover { text-decoration: underline; text-underline-offset: 3px; }
      .fs-profile-credit-action:focus-visible { outline: 2px solid var(--accent, #BA7517); outline-offset: 3px; border-radius: 4px; }
      @keyframes fs-credit-panel-in { from { opacity: 0; transform: translate3d(0, -4px, 0) scale(.985); } to { opacity: 1; transform: none; } }
      @keyframes fs-credit-in { from { opacity: 0; transform: scale(.72); } to { opacity: 1; transform: scale(1); } }
      @media (prefers-reduced-motion: reduce) { .${INDICATOR_CLASS}, .fs-profile-credit { animation: none; transition: none; } .fs-profile-credit-fill { transition: none; } }
      @media (prefers-reduced-transparency: reduce) { .fs-profile-credit { background: var(--surface, #FFFEF9); -webkit-backdrop-filter: none; backdrop-filter: none; } }
    `;
    document.head.appendChild(style);
  }

  function createBadge() {
    const badge = document.createElement('span');
    badge.className = INDICATOR_CLASS;
    badge.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('aria-hidden', 'true');
    const track = document.createElementNS(SVG_NS, 'circle');
    track.setAttribute('class', 'fs-avatar-credit-track');
    track.setAttribute('cx', '16');
    track.setAttribute('cy', '16');
    track.setAttribute('r', String(RADIUS));
    const progress = document.createElementNS(SVG_NS, 'circle');
    progress.setAttribute('class', 'fs-avatar-credit-progress');
    progress.setAttribute('cx', '16');
    progress.setAttribute('cy', '16');
    progress.setAttribute('r', String(RADIUS));
    svg.append(track, progress);
    badge.appendChild(svg);
    return badge;
  }

  function creditPanelCopy(state) {
    const spanish = isSpanish();
    if (state.unlimited) {
      return {
        title: spanish ? 'Créditos de imagen' : 'Image credits',
        balance: spanish ? 'Incluidos' : 'Included',
        detail: spanish ? 'Sin límite de créditos' : 'Unlimited credits',
        reset: spanish ? 'Vista previa' : 'Preview',
        action: spanish ? 'Ver planes' : 'View plans',
      };
    }
    if (!state.included) {
      return {
        title: spanish ? 'Créditos de imagen' : 'Image credits',
        balance: spanish ? 'No incluidos' : 'Not included',
        detail: spanish ? 'Full incluye 1,000 por ciclo' : 'Full includes 1,000 per cycle',
        reset: spanish ? '3 créditos por imagen' : '3 credits per image',
        action: spanish ? 'Conocer Full' : 'Explore Full',
      };
    }
    const balance = state.count == null
      ? (spanish ? 'Incluidos' : 'Included')
      : (spanish ? `${formatNumber(state.count)} disponibles` : `${formatNumber(state.count)} left`);
    return {
      title: spanish ? 'Créditos de imagen' : 'Image credits',
      balance,
      detail: spanish ? `${state.cost} créditos por imagen` : `${state.cost} credits per image`,
      reset: state.resetLabel
        ? (spanish ? `Renueva ${state.resetLabel}` : `Renews ${state.resetLabel}`)
        : (spanish ? 'Ciclo actual' : 'Current cycle'),
      action: spanish ? 'Ver plan y créditos' : 'View plan & credits',
    };
  }

  function createCreditPanel() {
    const card = document.createElement('section');
    card.className = 'fs-profile-credit';
    card.dataset.filmscriptCreditPanel = 'true';
    card.setAttribute('aria-label', isSpanish() ? 'Créditos de imagen' : 'Image credits');
    card.innerHTML = `
      <div class="fs-profile-credit-head">
        <span class="fs-profile-credit-title"></span>
        <span class="fs-profile-credit-balance"></span>
      </div>
      <div class="fs-profile-credit-track" aria-hidden="true"><div class="fs-profile-credit-fill"></div></div>
      <div class="fs-profile-credit-meta"><span></span><span></span></div>
      <button type="button" class="fs-profile-credit-action"></button>
    `;
    card.querySelector('.fs-profile-credit-action').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = new URL('./Pricing.dc.html', window.location.href);
      window.location.href = target.toString();
    });
    return card;
  }

  function decorateProfilePanels(state) {
    if (!state) return;
    document.querySelectorAll('[data-filmscript-profile-panel]').forEach((panel) => {
      let card = panel.querySelector(':scope > [data-filmscript-credit-panel]');
      if (!card) {
        card = createCreditPanel();
        const header = panel.firstElementChild;
        if (header) header.insertAdjacentElement('afterend', card);
        else panel.appendChild(card);
      }
      const copy = creditPanelCopy(state);
      card.style.setProperty('--fs-profile-credit-color', state.color);
      card.querySelector('.fs-profile-credit-title').textContent = copy.title;
      const balance = card.querySelector('.fs-profile-credit-balance');
      const balanceValue = document.createElement('strong');
      balanceValue.textContent = copy.balance;
      balance.replaceChildren(balanceValue);
      card.querySelector('.fs-profile-credit-fill').style.width = `${state.included ? state.pct.toFixed(2) : 0}%`;
      card.querySelector('.fs-profile-credit-meta > span:first-child').textContent = copy.detail;
      card.querySelector('.fs-profile-credit-meta > span:last-child').textContent = copy.reset;
      card.querySelector('.fs-profile-credit-action').textContent = copy.action;
      card.dataset.creditSignature = state.signature;
    });
  }

  function decorateAvatar(credits) {
    const state = normalizeCredits(credits);
    lastCredits = credits;
    lastCreditState = state;
    document.querySelectorAll(AVATAR_SELECTOR).forEach((avatar) => {
      // Never wrap or move the avatar: it belongs to the app's reactive DOM
      // tree. Reparenting it made the editor renderer fight this helper.
      const host = avatar.parentElement;
      if (!host) return;
      host.classList.add('fs-avatar-credit-host');
      host.style.setProperty('--fs-credit-color', state.color);
      avatar.title = state.label;
      avatar.setAttribute('aria-label', state.label);
      let badge = host.querySelector(`:scope > .${INDICATOR_CLASS}`);
      if (!badge) {
        badge = createBadge();
        host.appendChild(badge);
      }
      const progress = badge.querySelector('.fs-avatar-credit-progress');
      if (!progress || badge.dataset.creditSignature === state.signature) return;
      const filled = CIRCUMFERENCE * (state.pct / 100);
      progress.setAttribute('stroke-dasharray', `${filled.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`);
      badge.dataset.creditSignature = state.signature;
    });
    decorateProfilePanels(state);
  }

  async function refresh() {
    if (!window.filmscriptBilling?.credits) return;
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }
    refreshInFlight = true;
    try {
      decorateAvatar(await window.filmscriptBilling.credits());
    } catch (_) {
      // Visitors without a session should not see an invented availability value.
    } finally {
      refreshInFlight = false;
      if (refreshQueued) {
        refreshQueued = false;
        scheduleRefresh(0);
      }
    }
  }

  function scheduleRefresh(delay = 90) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refresh, delay);
  }

  function paintLast() {
    if (!lastCreditState) {
      scheduleRefresh();
      return;
    }
    const avatar = document.querySelector(AVATAR_SELECTOR);
    if (avatar && !avatar.parentElement?.querySelector(`:scope > .${INDICATOR_CLASS}`)) {
      decorateAvatar(lastCredits || lastCreditState);
      return;
    }
    // Account popovers are mounted separately from the avatar. Keep their
    // credit panel in sync without moving or re-rendering the surrounding UI.
    decorateProfilePanels(lastCreditState);
  }

  function queuePaint() {
    if (paintQueued) return;
    paintQueued = true;
    window.requestAnimationFrame(() => {
      paintQueued = false;
      paintLast();
    });
  }

  function start() {
    installStyles();
    scheduleRefresh(0);
    // React only when an avatar is added. Watching every editor mutation used
    // to schedule work while users typed, which made this tiny helper noisy.
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches?.(AVATAR_SELECTOR)
            || node.querySelector?.(AVATAR_SELECTOR)
            || node.matches?.('[data-filmscript-profile-panel]')
            || node.querySelector?.('[data-filmscript-profile-panel]')) {
            queuePaint();
            return;
          }
        }
      }
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
    window.addEventListener('filmscript:credits-updated', () => scheduleRefresh(0));
    window.addEventListener('languagechange', () => lastCreditState && decorateAvatar(lastCredits || lastCreditState));
    window.setInterval(() => scheduleRefresh(0), 90_000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
