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
    pending: true,
    resolved: false,
    returnFocus: null,
    inerted: [],
    birthdayListener: false,
    dismiss: null,
  };

  const safeSession = (action, fallback = null) => {
    try { return action(window.sessionStorage); } catch { return fallback; }
  };
  const safeLocal = (action, fallback = null) => {
    try { return action(window.localStorage); } catch { return fallback; }
  };
  const sessionKey = (prefix, id) => `filmscript_${prefix}_${id || 'account'}`;
  const profileCompleteKey = (id) => sessionKey('profile_completed', id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
  const splitName = (value) => {
    const parts = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    return { firstName: parts[0] || '', lastName: parts.length >= 2 ? parts.slice(1).join(' ') : '' };
  };
  const accountIdentity = () => {
    const fallback = splitName(state.account?.name);
    return {
      firstName: String(state.account?.firstName || state.account?.profile?.firstName || fallback.firstName || '').trim(),
      lastName: String(state.account?.lastName || state.account?.profile?.lastName || fallback.lastName || '').trim(),
    };
  };
  const accountName = () => accountIdentity().firstName || 'FilmScript';
  const chosenLanguage = () => window.filmscriptLanguage?.get?.() === 'es' ? 'es' : 'en';
  const hasChosenLanguage = () => Boolean(window.filmscriptLanguage?.hasStoredLanguage?.());
  const profileCopy = () => {
    if (!hasChosenLanguage()) return {
      kicker: 'WELCOME · BIENVENIDO',
      title: 'A little about you / Un poco sobre ti',
      intro: 'Add your name so FilmScript can address you personally. Your email comes securely from Google. After this, you will choose the interface language. / Agrega tu nombre para que FilmScript pueda dirigirse a ti. Tu correo llega de forma segura desde Google. Después elegirás el idioma de la interfaz.',
      firstNameLabel: 'First name / Nombre', lastNameLabel: 'Last name / Apellido', emailLabel: 'Email / Correo',
      firstNameError: 'Add your first name. / Agrega tu nombre.', lastNameError: 'Add your last name. / Agrega tu apellido.',
      genderLabel: 'How should we refer to you? / ¿Cómo debemos referirnos a ti?',
      choose: 'Choose an option… / Elige una opción…',
      man: 'Man / Hombre',
      woman: 'Woman / Mujer',
      unspecified: 'Prefer not to say / Prefiero no decirlo',
      birthdayLabel: 'When is your birthday? / ¿Cuándo es tu cumpleaños?',
      birthdayHint: 'Used only for a small birthday note inside FilmScript. / Se usa únicamente para una pequeña felicitación dentro de FilmScript.',
      skip: 'Not now / Ahora no',
      submit: 'Continue / Continuar',
      genderError: 'Choose an option, or use “Not now”. / Elige una opción o usa “Ahora no”.',
      birthdayError: 'Add your birthday, or use “Not now”. / Agrega tu cumpleaños o usa “Ahora no”.',
      saveError: 'Could not save your profile. Try again. / No se pudo guardar tu perfil. Inténtalo de nuevo.',
    };
    if (chosenLanguage() === 'es') return {
      kicker: 'HAZLO TUYO', title: 'Un poco sobre ti', intro: 'Confirma tu nombre para personalizar FilmScript. Tu correo viene de Google y no se puede modificar aquí.',
      firstNameLabel: 'Nombre', lastNameLabel: 'Apellido', emailLabel: 'Correo', firstNameError: 'Agrega tu nombre.', lastNameError: 'Agrega tu apellido.',
      genderLabel: '¿Cómo debemos referirnos a ti?', choose: 'Elige una opción…', man: 'Hombre', woman: 'Mujer', unspecified: 'Prefiero no decirlo',
      birthdayLabel: '¿Cuándo es tu cumpleaños?', birthdayHint: 'Usaremos la fecha únicamente para enviarte una pequeña felicitación dentro de FilmScript.',
      skip: 'Ahora no', submit: 'Guardar perfil', genderError: 'Elige una opción o usa “Ahora no”.', birthdayError: 'Agrega tu cumpleaños o usa “Ahora no”.', saveError: 'No se pudo guardar tu perfil. Inténtalo de nuevo.',
    };
    return {
      kicker: 'MAKE IT YOURS', title: 'A little about you', intro: 'Confirm your name to personalize FilmScript. Your email comes from Google and cannot be changed here.',
      firstNameLabel: 'First name', lastNameLabel: 'Last name', emailLabel: 'Email', firstNameError: 'Add your first name.', lastNameError: 'Add your last name.',
      genderLabel: 'How should we refer to you?', choose: 'Choose an option…', man: 'Man', woman: 'Woman', unspecified: 'Prefer not to say',
      birthdayLabel: 'When is your birthday?', birthdayHint: 'We use the date only to send you a small birthday note inside FilmScript.',
      skip: 'Not now', submit: 'Save profile', genderError: 'Choose an option, or use “Not now”.', birthdayError: 'Add your birthday, or use “Not now”.', saveError: 'Could not save your profile. Try again.',
    };
  };

  const resolveProfileOnboarding = (reason) => {
    state.pending = false;
    if (state.resolved) return;
    state.resolved = true;
    window.dispatchEvent(new CustomEvent('filmscript:profile-onboarding-resolved', { detail: { reason } }));
  };

  const addStyles = () => {
    if (document.getElementById('filmscript-profile-onboarding-styles')) return;
    const style = document.createElement('style');
    style.id = 'filmscript-profile-onboarding-styles';
    style.textContent = `
      .fs-profile-onboarding {
        position: fixed; inset: 0; z-index: 9990; display: grid; place-items: center;
        box-sizing: border-box; padding: 22px; overflow: auto; background: rgba(24,24,22,.34);
        backdrop-filter: blur(28px) saturate(1.18); -webkit-backdrop-filter: blur(28px) saturate(1.18);
        animation: fs-profile-fade .18s ease both;
      }
      .fs-profile-onboarding__sheet {
        position: relative; width: min(480px, 100%); max-height: calc(100dvh - 44px); overflow: auto;
        box-sizing: border-box; color: var(--ink, #2c2c2a);
        background: linear-gradient(145deg, color-mix(in srgb, var(--surface, #fffef9) 82%, transparent), color-mix(in srgb, var(--surface, #fffef9) 68%, transparent));
        border: 1px solid color-mix(in srgb, var(--ink, #2c2c2a) 18%, rgba(255,255,255,.72));
        border-radius: 24px; padding: 30px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.72), 0 24px 72px rgba(20,20,18,.28);
        backdrop-filter: blur(38px) saturate(1.36); -webkit-backdrop-filter: blur(38px) saturate(1.36);
        animation: fs-profile-rise .24s cubic-bezier(.2,.82,.22,1) both;
      }
      .fs-profile-onboarding__sheet::before { content: ''; position: absolute; inset: 4px; pointer-events: none; border: 1px solid color-mix(in srgb, var(--ink, #2c2c2a) 9%, transparent); border-radius: 20px; }
      .fs-profile-onboarding__sheet > * { position: relative; z-index: 1; }
      .fs-profile-onboarding__kicker { color: var(--accent, #ba7517); font-size: 10px; font-weight: 750; letter-spacing: 1.7px; text-transform: uppercase; }
      .fs-profile-onboarding__title { margin: 8px 0 0; font-size: 26px; line-height: 1.05; letter-spacing: -.65px; }
      .fs-profile-onboarding__copy { margin: 11px 0 22px; color: var(--muted, #888780); font-size: 13px; line-height: 1.55; }
      .fs-profile-onboarding__field { display: grid; gap: 7px; margin-top: 15px; }
      .fs-profile-onboarding__identity { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .fs-profile-onboarding__label { color: var(--muted, #888780); font-size: 11px; font-weight: 700; letter-spacing: .3px; }
      .fs-profile-onboarding__control { width: 100%; min-height: 46px; box-sizing: border-box; padding: 11px 13px; color: var(--ink, #2c2c2a); background: color-mix(in srgb, var(--surface, #fffef9) 62%, transparent); border: 1px solid color-mix(in srgb, var(--ink, #2c2c2a) 17%, transparent); border-radius: 14px; font: inherit; font-size: 13px; outline: none; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); transition: border-color .14s ease, box-shadow .14s ease, transform .14s cubic-bezier(.2,.8,.2,1), background-color .14s ease; }
      .fs-profile-onboarding__control:focus { border-color: var(--accent, #ba7517); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #ba7517) 15%, transparent); transform: translateY(-1px); }
      .fs-profile-onboarding__hint { margin-top: 8px; color: var(--muted, #888780); font-size: 11px; line-height: 1.45; }
      .fs-profile-onboarding__error { min-height: 17px; margin-top: 13px; color: #a33e34; font-size: 12px; }
      .fs-profile-onboarding__actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 7px; }
      .fs-profile-onboarding__button { min-height: 44px; padding: 10px 17px; border: 1px solid color-mix(in srgb, var(--ink, #2c2c2a) 17%, transparent); border-radius: 999px; color: var(--ink, #2c2c2a); background: color-mix(in srgb, var(--surface, #fffef9) 46%, transparent); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); transition: transform .14s cubic-bezier(.2,.8,.2,1), box-shadow .14s ease, background-color .14s ease; }
      .fs-profile-onboarding__button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(35,35,34,.1); }
      .fs-profile-onboarding__button--primary { border-color: color-mix(in srgb, var(--accent, #ba7517) 66%, var(--ink, #2c2c2a)); color: #fff; background: linear-gradient(135deg, color-mix(in srgb, var(--accent, #ba7517) 92%, #fff), var(--accent, #ba7517)); box-shadow: inset 0 1px 0 rgba(255,255,255,.34), 0 8px 22px color-mix(in srgb, var(--accent, #ba7517) 26%, transparent); }
      .fs-profile-onboarding__button:disabled { opacity: .55; cursor: wait; transform: none; }
      .fs-profile-birthday-toast { position: fixed; right: 22px; bottom: 22px; z-index: 9995; width: min(360px, calc(100vw - 44px)); padding: 15px 17px; color: var(--ink, #2c2c2a); background: var(--surface, #fffef9); border: 1px solid var(--accent, #ba7517); border-radius: 14px 12px 15px 11px; box-shadow: 0 14px 34px rgba(35,35,34,.18), 3px 4px 0 color-mix(in srgb, var(--accent, #ba7517) 18%, transparent); animation: fs-profile-toast .35s cubic-bezier(.2,.8,.2,1) both; }
      .fs-profile-birthday-toast__kicker { color: var(--accent, #ba7517); font-size: 10px; font-weight: 750; letter-spacing: 1.4px; text-transform: uppercase; }
      .fs-profile-birthday-toast__message { margin-top: 5px; font-size: 14px; line-height: 1.35; }
      .fs-profile-birthday-toast__close { float: right; border: 0; padding: 0 0 0 10px; color: var(--muted, #888780); background: transparent; font-size: 18px; line-height: 1; cursor: pointer; }
      @keyframes fs-profile-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes fs-profile-rise { from { opacity: 0; transform: translateY(10px) scale(.985) } to { opacity: 1; transform: translateY(0) scale(1) } }
      @keyframes fs-profile-toast { from { opacity: 0; transform: translateY(12px) rotate(-.4deg) } to { opacity: 1; transform: translateY(0) rotate(0) } }
      @media (max-width: 520px) { .fs-profile-onboarding { padding: 12px; align-items: end; } .fs-profile-onboarding__sheet { max-height: calc(100dvh - 24px); padding: 25px 20px calc(22px + env(safe-area-inset-bottom)); border-radius: 24px 24px 20px 20px; } .fs-profile-onboarding__identity { grid-template-columns: 1fr; gap: 0; } .fs-profile-onboarding__actions { display: grid; grid-template-columns: 1fr 1fr; } .fs-profile-onboarding__button { width: 100%; } }
      @media (prefers-reduced-transparency: reduce) { .fs-profile-onboarding { background: rgba(24,24,22,.74); backdrop-filter: none; -webkit-backdrop-filter: none; } .fs-profile-onboarding__sheet, .fs-profile-onboarding__control, .fs-profile-onboarding__button { background: var(--surface, #fffef9); backdrop-filter: none; -webkit-backdrop-filter: none; } .fs-profile-onboarding__button--primary { background: var(--accent, #ba7517); } }
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .fs-profile-onboarding__sheet, .fs-profile-onboarding__control, .fs-profile-onboarding__button { background: var(--surface, #fffef9); } .fs-profile-onboarding__button--primary { background: var(--accent, #ba7517); } }
      @media (prefers-reduced-motion: reduce) { .fs-profile-onboarding, .fs-profile-onboarding__sheet, .fs-profile-onboarding__control, .fs-profile-onboarding__button, .fs-profile-birthday-toast { animation: none !important; transition-duration: .01ms !important; } }
    `;
    document.head.appendChild(style);
  };

  const removeOverlay = () => {
    if (!state.overlay) return;
    state.overlay.remove();
    state.overlay = null;
    state.busy = false;
    state.inerted.forEach((element) => { element.inert = false; });
    state.inerted = [];
    if (state.returnFocus?.isConnected) state.returnFocus.focus({ preventScroll: true });
    state.returnFocus = null;
    state.dismiss = null;
  };

  const showBirthdayGreeting = () => {
    if (!hasChosenLanguage()) {
      if (!state.birthdayListener) {
        state.birthdayListener = true;
        window.addEventListener('filmscript:initial-language-choice', () => {
          state.birthdayListener = false;
          showBirthdayGreeting();
        }, { once: true });
      }
      return;
    }
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
    close.setAttribute('aria-label', chosenLanguage() === 'es' ? 'Cerrar felicitación de cumpleaños' : 'Dismiss birthday message');
    close.textContent = '×';
    close.addEventListener('click', () => toast.remove());
    const kicker = document.createElement('div');
    kicker.className = 'fs-profile-birthday-toast__kicker';
    kicker.textContent = chosenLanguage() === 'es' ? 'Una nota de FilmScript' : 'A note from FilmScript';
    const message = document.createElement('div');
    message.className = 'fs-profile-birthday-toast__message';
    message.textContent = chosenLanguage() === 'es'
      ? `¡Feliz cumpleaños, ${accountName()}! 🎉 Que tengas un día brillante y un año lleno de grandes historias.`
      : `Happy birthday, ${accountName()}! 🎉 Wishing you a brilliant day and a year full of great stories.`;
    toast.append(close, kicker, message);
    document.body.appendChild(toast);
    state.toast = toast;
    window.setTimeout(() => { if (toast.isConnected) toast.remove(); }, 9000);
  };

  const showProfile = (force = false) => {
    if (!state.account || state.overlay) return false;
    const profile = state.account.profile || {};
    const identity = accountIdentity();
    const identityComplete = Boolean(identity.firstName && identity.lastName);
    const completedLocally = Boolean(safeLocal((storage) => storage.getItem(profileCompleteKey(state.account.id)), null));
    if (!force && (profile.completed || (completedLocally && identityComplete))) { resolveProfileOnboarding('profile-complete'); return false; }
    if (!force && identityComplete && safeSession((storage) => storage.getItem(sessionKey('profile_skipped', state.account.id)), null)) { resolveProfileOnboarding('profile-skipped'); return false; }
    addStyles();
    const copy = profileCopy();
    const overlay = document.createElement('div');
    overlay.className = 'fs-profile-onboarding';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'fs-profile-onboarding-title');
    overlay.setAttribute('aria-describedby', 'fs-profile-onboarding-copy');
    overlay.setAttribute('data-i18n-skip', '');
    overlay.innerHTML = `
      <form class="fs-profile-onboarding__sheet" novalidate>
        <div class="fs-profile-onboarding__kicker">${copy.kicker}</div>
        <h2 class="fs-profile-onboarding__title" id="fs-profile-onboarding-title">${copy.title}</h2>
        <p class="fs-profile-onboarding__copy" id="fs-profile-onboarding-copy">${copy.intro}</p>
        <div class="fs-profile-onboarding__identity">
          <div class="fs-profile-onboarding__field">
            <label class="fs-profile-onboarding__label" for="fs-profile-first-name">${copy.firstNameLabel}</label>
            <input class="fs-profile-onboarding__control" id="fs-profile-first-name" name="firstName" type="text" minlength="1" maxlength="60" autocomplete="given-name" required />
          </div>
          <div class="fs-profile-onboarding__field">
            <label class="fs-profile-onboarding__label" for="fs-profile-last-name">${copy.lastNameLabel}</label>
            <input class="fs-profile-onboarding__control" id="fs-profile-last-name" name="lastName" type="text" minlength="1" maxlength="60" autocomplete="family-name" required />
          </div>
        </div>
        <div class="fs-profile-onboarding__field">
          <label class="fs-profile-onboarding__label" for="fs-profile-email">${copy.emailLabel}</label>
          <input class="fs-profile-onboarding__control" id="fs-profile-email" type="email" value="${escapeHtml(state.account.email || '')}" autocomplete="email" readonly />
        </div>
        <div class="fs-profile-onboarding__field">
          <label class="fs-profile-onboarding__label" for="fs-profile-gender">${copy.genderLabel}</label>
          <select class="fs-profile-onboarding__control" id="fs-profile-gender" name="gender">
            <option value="">${copy.choose}</option>
            <option value="man">${copy.man}</option>
            <option value="woman">${copy.woman}</option>
            <option value="unspecified">${copy.unspecified}</option>
          </select>
        </div>
        <div class="fs-profile-onboarding__field">
          <label class="fs-profile-onboarding__label" for="fs-profile-birthday">${copy.birthdayLabel}</label>
          <input class="fs-profile-onboarding__control" id="fs-profile-birthday" name="birthDate" type="date" min="1900-01-01" />
          <div class="fs-profile-onboarding__hint">${copy.birthdayHint}</div>
        </div>
        <div class="fs-profile-onboarding__error" role="alert" aria-live="polite"></div>
        <div class="fs-profile-onboarding__actions">
          <button class="fs-profile-onboarding__button" type="button" data-profile-skip${identityComplete ? '' : ' hidden'}>${copy.skip}</button>
          <button class="fs-profile-onboarding__button fs-profile-onboarding__button--primary" type="submit">${copy.submit}</button>
        </div>
      </form>
    `;
    state.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.appendChild(overlay);
    state.overlay = overlay;
    state.pending = true;
    state.inerted = [...document.body.children].filter((element) => element !== overlay && element instanceof HTMLElement && !element.inert);
    state.inerted.forEach((element) => { element.inert = true; });
    const form = overlay.querySelector('form');
    const firstName = overlay.querySelector('[name="firstName"]');
    const lastName = overlay.querySelector('[name="lastName"]');
    const gender = overlay.querySelector('[name="gender"]');
    const birthDate = overlay.querySelector('[name="birthDate"]');
    const error = overlay.querySelector('[role="alert"]');
    firstName.value = identity.firstName;
    lastName.value = identity.lastName;
    if (profile.gender) gender.value = profile.gender;
    if (profile.birthDate) birthDate.value = profile.birthDate;
    birthDate.max = new Date().toISOString().slice(0, 10);
    const closeForNow = () => {
      if (!identityComplete) return;
      safeSession((storage) => storage.setItem(sessionKey('profile_skipped', state.account.id), '1'));
      removeOverlay();
      resolveProfileOnboarding('profile-skipped');
    };
    state.dismiss = closeForNow;
    overlay.querySelector('[data-profile-skip]').addEventListener('click', closeForNow);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeForNow(); });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (state.busy) return;
      error.textContent = '';
      if (!firstName.value.trim()) { error.textContent = copy.firstNameError; firstName.focus(); return; }
      if (!lastName.value.trim()) { error.textContent = copy.lastNameError; lastName.focus(); return; }
      if (!gender.value) { error.textContent = copy.genderError; gender.focus(); return; }
      if (!birthDate.value) { error.textContent = copy.birthdayError; birthDate.focus(); return; }
      state.busy = true;
      form.querySelector('[type="submit"]').disabled = true;
      try {
        const account = await window.filmscriptBilling.updateProfile({
          firstName: firstName.value.trim(),
          lastName: lastName.value.trim(),
          gender: gender.value,
          birthDate: birthDate.value,
        });
        state.account = account;
        // The profile endpoint was added after some API releases. Persist the
        // completed optional prompt on this device too, so an older response
        // that does not yet echo profile fields never asks the same person
        // again after a successful save.
        safeLocal((storage) => storage.setItem(profileCompleteKey(state.account.id), '1'));
        safeSession((storage) => storage.removeItem(sessionKey('profile_skipped', state.account.id)));
        removeOverlay();
        resolveProfileOnboarding('profile-saved');
        window.dispatchEvent(new CustomEvent('filmscript:profile-updated', { detail: account }));
        showBirthdayGreeting();
      } catch (submissionError) {
        state.busy = false;
        form.querySelector('[type="submit"]').disabled = false;
        error.textContent = hasChosenLanguage() && submissionError?.message
          ? window.filmscriptLanguage?.t?.(submissionError.message, chosenLanguage()) || copy.saveError
          : copy.saveError;
      }
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = [...overlay.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    requestAnimationFrame(() => (identity.firstName ? identity.lastName ? gender : lastName : firstName).focus());
    return true;
  };

  const refresh = async () => {
    try {
      if (window.filmscriptScriptsAccess?.ready) await window.filmscriptScriptsAccess.ready;
      const account = await window.filmscriptBilling?.me?.();
      if (!account?.authenticated) { resolveProfileOnboarding('not-authenticated'); return; }
      state.account = account;
      await window.filmscriptLanguage?.hydrateAccount?.(account);
      if (account.profile?.completed) safeLocal((storage) => storage.setItem(profileCompleteKey(account.id), '1'));
      const opened = showProfile(false);
      if (account.profile?.completed) showBirthdayGreeting();
      if (!opened && !state.resolved) resolveProfileOnboarding('profile-not-required');
    } catch { resolveProfileOnboarding('profile-unavailable'); /* The page's own auth guard handles account failures. */ }
  };

  const openFromProfileMenu = (event) => {
    if (event.target.closest?.('[data-filmscript-open-profile]')) {
      event.preventDefault();
      showProfile(true);
    }
  };
  document.addEventListener('click', openFromProfileMenu);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.overlay) state.dismiss?.(); });
  window.addEventListener('filmscript:profile-open', () => showProfile(true));

  window.filmscriptProfileOnboarding = {
    open: () => showProfile(true),
    refresh,
    isPending: () => state.pending,
  };

  const boot = () => window.setTimeout(refresh, 120);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
