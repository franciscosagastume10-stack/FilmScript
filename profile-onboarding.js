// Personal profile onboarding and birthday greeting.
// This file is intentionally page-level: it shares the authenticated account API
// without coupling the prompt to the Editor or Scripts dashboard state machines.
(() => {
  if (window.__filmscriptProfileOnboarding) return;

  const page = decodeURIComponent(window.location.pathname.split('/').pop() || '');
  if (!/^(App|Editor v5|Subscription)\.dc(?:\.html)?$/i.test(page)) return;

  const state = {
    account: null,
    overlay: null,
    toast: null,
    busy: false,
  };

  const safeSession = (action, fallback = null) => {
    try { return action(window.sessionStorage); } catch { return fallback; }
  };
  const sessionKey = (prefix, id) => `filmscript_${prefix}_${id || 'account'}`;
  const accountName = () => state.account?.name || state.account?.email?.split('@')[0] || 'filmmaker';

  const addStyles = () => {
    if (document.getElementById('filmscript-profile-onboarding-styles')) return;
    const style = document.createElement('style');
    style.id = 'filmscript-profile-onboarding-styles';
    style.textContent = `
      .fs-profile-onboarding {
        position: fixed; inset: 0; z-index: 9990; display: grid; place-items: center;
        padding: 22px; background: rgba(35,35,34,.25); backdrop-filter: blur(5px);
        animation: fs-profile-fade .2s ease both;
      }
      .fs-profile-onboarding__sheet {
        width: min(440px, 100%); color: var(--ink, #2c2c2a);
        background: var(--surface, #fffef9); border: 1px solid var(--hair, #e7e4da);
        border-radius: 19px 16px 21px 15px; padding: 28px;
        box-shadow: 0 22px 58px rgba(35,35,34,.22), 4px 5px 0 rgba(35,35,34,.07);
        animation: fs-profile-rise .28s cubic-bezier(.2,.8,.2,1) both;
      }
      .fs-profile-onboarding__kicker { color: var(--accent, #ba7517); font-size: 10px; font-weight: 750; letter-spacing: 1.7px; text-transform: uppercase; }
      .fs-profile-onboarding__title { margin: 8px 0 0; font-size: 26px; line-height: 1.05; letter-spacing: -.65px; }
      .fs-profile-onboarding__copy { margin: 11px 0 22px; color: var(--muted, #888780); font-size: 13px; line-height: 1.55; }
      .fs-profile-onboarding__field { display: grid; gap: 7px; margin-top: 15px; }
      .fs-profile-onboarding__label { color: var(--muted, #888780); font-size: 11px; font-weight: 700; letter-spacing: .3px; }
      .fs-profile-onboarding__control { width: 100%; min-height: 42px; box-sizing: border-box; padding: 10px 12px; color: var(--ink, #2c2c2a); background: var(--bg, #f5f0e8); border: 1px solid var(--hair, #e7e4da); border-radius: 10px 8px 11px 9px; font: inherit; font-size: 13px; outline: none; transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease; }
      .fs-profile-onboarding__control:focus { border-color: var(--accent, #ba7517); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #ba7517) 15%, transparent); transform: translateY(-1px); }
      .fs-profile-onboarding__hint { margin-top: 8px; color: var(--muted, #888780); font-size: 11px; line-height: 1.45; }
      .fs-profile-onboarding__error { min-height: 17px; margin-top: 13px; color: #a33e34; font-size: 12px; }
      .fs-profile-onboarding__actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 7px; }
      .fs-profile-onboarding__button { min-height: 39px; padding: 9px 15px; border: 1px solid var(--hair, #e7e4da); border-radius: 10px 8px 11px 9px; color: var(--ink, #2c2c2a); background: transparent; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; transition: transform .16s ease, box-shadow .16s ease, background-color .16s ease; }
      .fs-profile-onboarding__button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(35,35,34,.1); }
      .fs-profile-onboarding__button--primary { border-color: var(--ink, #2c2c2a); color: var(--surface, #fffef9); background: var(--ink, #2c2c2a); }
      .fs-profile-onboarding__button:disabled { opacity: .55; cursor: wait; transform: none; }
      .fs-profile-birthday-toast { position: fixed; right: 22px; bottom: 22px; z-index: 9995; width: min(360px, calc(100vw - 44px)); padding: 15px 17px; color: var(--ink, #2c2c2a); background: var(--surface, #fffef9); border: 1px solid var(--accent, #ba7517); border-radius: 14px 12px 15px 11px; box-shadow: 0 14px 34px rgba(35,35,34,.18), 3px 4px 0 color-mix(in srgb, var(--accent, #ba7517) 18%, transparent); animation: fs-profile-toast .35s cubic-bezier(.2,.8,.2,1) both; }
      .fs-profile-birthday-toast__kicker { color: var(--accent, #ba7517); font-size: 10px; font-weight: 750; letter-spacing: 1.4px; text-transform: uppercase; }
      .fs-profile-birthday-toast__message { margin-top: 5px; font-size: 14px; line-height: 1.35; }
      .fs-profile-birthday-toast__close { float: right; border: 0; padding: 0 0 0 10px; color: var(--muted, #888780); background: transparent; font-size: 18px; line-height: 1; cursor: pointer; }
      @keyframes fs-profile-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes fs-profile-rise { from { opacity: 0; transform: translateY(10px) scale(.985) } to { opacity: 1; transform: translateY(0) scale(1) } }
      @keyframes fs-profile-toast { from { opacity: 0; transform: translateY(12px) rotate(-.4deg) } to { opacity: 1; transform: translateY(0) rotate(0) } }
      @media (prefers-reduced-motion: reduce) { .fs-profile-onboarding, .fs-profile-onboarding__sheet, .fs-profile-birthday-toast { animation: none !important; } }
    `;
    document.head.appendChild(style);
  };

  const removeOverlay = () => {
    if (!state.overlay) return;
    state.overlay.remove();
    state.overlay = null;
    state.busy = false;
  };

  const showBirthdayGreeting = () => {
    const profile = state.account?.profile;
    const birthDate = profile?.birthDate;
    if (!birthDate || !state.account?.id) return;
    const today = new Date();
    const [year, month, day] = birthDate.split('-').map(Number);
    if (month !== today.getMonth() + 1 || day !== today.getDate()) return;
    const key = sessionKey('birthday_greeted', `${state.account.id}_${today.getFullYear()}`);
    if (safeSession((storage) => storage.getItem(key), null)) return;
    safeSession((storage) => storage.setItem(key, '1'));

    const toast = document.createElement('aside');
    toast.className = 'fs-profile-birthday-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    const close = document.createElement('button');
    close.className = 'fs-profile-birthday-toast__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss birthday message');
    close.textContent = '×';
    close.addEventListener('click', () => toast.remove());
    const kicker = document.createElement('div');
    kicker.className = 'fs-profile-birthday-toast__kicker';
    kicker.textContent = 'A note from FilmScript';
    const message = document.createElement('div');
    message.className = 'fs-profile-birthday-toast__message';
    message.textContent = `Happy birthday, ${accountName()}! 🎉 Wishing you a brilliant day and a year full of great stories.`;
    toast.append(close, kicker, message);
    document.body.appendChild(toast);
    state.toast = toast;
    window.setTimeout(() => { if (toast.isConnected) toast.remove(); }, 9000);
  };

  const showProfile = (force = false) => {
    if (!state.account || state.overlay) return;
    const profile = state.account.profile || {};
    if (!force && profile.completed) return;
    if (!force && safeSession((storage) => storage.getItem(sessionKey('profile_skipped', state.account.id)), null)) return;
    addStyles();
    const overlay = document.createElement('div');
    overlay.className = 'fs-profile-onboarding';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'fs-profile-onboarding-title');
    overlay.innerHTML = `
      <form class="fs-profile-onboarding__sheet" novalidate>
        <div class="fs-profile-onboarding__kicker">Make it yours</div>
        <h2 class="fs-profile-onboarding__title" id="fs-profile-onboarding-title">A little about you</h2>
        <p class="fs-profile-onboarding__copy">Help us make FilmScript feel more personal. This stays private to your account and is completely optional.</p>
        <div class="fs-profile-onboarding__field">
          <label class="fs-profile-onboarding__label" for="fs-profile-gender">How should we refer to you?</label>
          <select class="fs-profile-onboarding__control" id="fs-profile-gender" name="gender">
            <option value="">Choose an option…</option>
            <option value="man">Man</option>
            <option value="woman">Woman</option>
            <option value="unspecified">Prefer not to say</option>
          </select>
        </div>
        <div class="fs-profile-onboarding__field">
          <label class="fs-profile-onboarding__label" for="fs-profile-birthday">When is your birthday?</label>
          <input class="fs-profile-onboarding__control" id="fs-profile-birthday" name="birthDate" type="date" min="1900-01-01" />
          <div class="fs-profile-onboarding__hint">We’ll use the date only to send you a small birthday note inside FilmScript.</div>
        </div>
        <div class="fs-profile-onboarding__error" role="alert" aria-live="polite"></div>
        <div class="fs-profile-onboarding__actions">
          <button class="fs-profile-onboarding__button" type="button" data-profile-skip>Not now</button>
          <button class="fs-profile-onboarding__button fs-profile-onboarding__button--primary" type="submit">Save profile</button>
        </div>
      </form>
    `;
    document.body.appendChild(overlay);
    state.overlay = overlay;
    const form = overlay.querySelector('form');
    const gender = overlay.querySelector('[name="gender"]');
    const birthDate = overlay.querySelector('[name="birthDate"]');
    const error = overlay.querySelector('[role="alert"]');
    if (profile.gender) gender.value = profile.gender;
    if (profile.birthDate) birthDate.value = profile.birthDate;
    birthDate.max = new Date().toISOString().slice(0, 10);
    const closeForNow = () => {
      safeSession((storage) => storage.setItem(sessionKey('profile_skipped', state.account.id), '1'));
      removeOverlay();
    };
    overlay.querySelector('[data-profile-skip]').addEventListener('click', closeForNow);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeForNow(); });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.busy) return;
      error.textContent = '';
      if (!gender.value) { error.textContent = 'Choose an option, or use “Not now” to skip.'; gender.focus(); return; }
      if (!birthDate.value) { error.textContent = 'Add your birthday, or use “Not now” to skip.'; birthDate.focus(); return; }
      state.busy = true;
      form.querySelector('[type="submit"]').disabled = true;
      try {
        // Some already-deployed API versions still validate `name` whenever a
        // profile is saved. This sheet deliberately has no name field, so use
        // the Google account name we already have instead of ever submitting a
        // blank value (which made a completed optional profile look broken).
        const savedName = String(state.account?.name || state.account?.email?.split('@')[0] || 'FilmScript Writer')
          .replace(/\s+/g, ' ')
          .trim();
        const name = savedName.length >= 2 && savedName.length <= 80 ? savedName : 'FilmScript Writer';
        const account = await window.filmscriptBilling.updateProfile({ name, gender: gender.value, birthDate: birthDate.value });
        state.account = account;
        safeSession((storage) => storage.removeItem(sessionKey('profile_skipped', state.account.id)));
        removeOverlay();
        window.dispatchEvent(new CustomEvent('filmscript:profile-updated', { detail: account }));
        showBirthdayGreeting();
      } catch (submissionError) {
        state.busy = false;
        form.querySelector('[type="submit"]').disabled = false;
        error.textContent = submissionError?.message || 'Could not save your profile. Try again.';
      }
    });
    requestAnimationFrame(() => gender.focus());
  };

  const refresh = async () => {
    try {
      if (window.filmscriptScriptsAccess?.ready) await window.filmscriptScriptsAccess.ready;
      const account = await window.filmscriptBilling?.me?.();
      if (!account?.authenticated) return;
      state.account = account;
      showProfile(false);
      if (account.profile?.completed) showBirthdayGreeting();
    } catch { /* The page's own auth guard handles account failures. */ }
  };

  const openFromProfileMenu = (event) => {
    if (event.target.closest?.('[data-filmscript-open-profile]')) {
      event.preventDefault();
      showProfile(true);
    }
  };
  document.addEventListener('click', openFromProfileMenu);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.overlay) removeOverlay(); });
  window.addEventListener('filmscript:profile-open', () => showProfile(true));

  window.filmscriptProfileOnboarding = {
    open: () => showProfile(true),
    refresh,
  };

  const boot = () => window.setTimeout(refresh, 120);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
