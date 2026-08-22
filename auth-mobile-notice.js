// Phone-only experience notice shown after a successful Google handoff.
(() => {
  'use strict';

  if (window.filmscriptMobileAuthNotice) return;

  const COPY = Object.freeze({
    en: Object.freeze({
      loadingTitle: 'Opening your scripts…',
      loadingMessage: 'Securing your FilmScript session.',
      errorMessage: 'We could not finish your sign in. Please try again.',
      retry: 'Try Google sign in again',
      eyebrow: 'FILMSCRIPT EXPERIENCE',
      title: 'FilmScript works best on your computer',
      message: 'We are currently optimizing FilmScript for phones. While we finish, open your account on a computer to enjoy every tool and work more comfortably.',
      note: 'Your session is ready. You can continue here if you need to.',
      continueLabel: 'Continue on this phone',
    }),
    es: Object.freeze({
      loadingTitle: 'Abriendo tus guiones…',
      loadingMessage: 'Protegiendo tu sesión de FilmScript.',
      errorMessage: 'No pudimos completar tu inicio de sesión. Inténtalo de nuevo.',
      retry: 'Volver a iniciar sesión con Google',
      eyebrow: 'EXPERIENCIA FILMSCRIPT',
      title: 'FilmScript se disfruta mejor en tu computadora',
      message: 'Actualmente estamos optimizando FilmScript para teléfono. Mientras terminamos, abre tu cuenta desde una computadora para disfrutar todas las herramientas y trabajar con mayor comodidad.',
      note: 'Tu sesión ya está lista. Puedes continuar aquí si lo necesitas.',
      continueLabel: 'Continuar en este teléfono',
    }),
  });

  const currentLanguage = () => {
    try {
      const saved = String(window.localStorage?.getItem('filmscript_language') || '').toLowerCase();
      if (saved === 'es' || saved === 'en') return saved;
    } catch (error) {}
    return String(window.navigator?.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  };

  const isPhoneDevice = (environment = window) => {
    const navigatorValue = environment.navigator || {};
    try {
      if (navigatorValue.userAgentData?.mobile === true) return true;
    } catch (error) {}

    const userAgent = String(navigatorValue.userAgent || '');
    const platform = String(navigatorValue.platform || '');
    const touchPoints = Number(navigatorValue.maxTouchPoints || 0);

    // iPadOS can identify itself as a touch-enabled Mac when desktop browsing
    // is requested. Keep it out because this notice is intentionally for phones.
    if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent)) return false;
    if (platform === 'MacIntel' && touchPoints > 1) return false;
    if (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) return false;

    return /iPhone|iPod|Windows Phone|IEMobile|BlackBerry|BB10|Opera Mini|Opera Mobi|Mobi|Mobile/i.test(userAgent);
  };

  const text = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  const applyLanguage = () => {
    const language = currentLanguage();
    const copy = COPY[language];
    document.documentElement.lang = language;
    text('auth-loading-title', copy.loadingTitle);
    text('message', copy.loadingMessage);
    text('retry', copy.retry);
    text('phone-notice-eyebrow', copy.eyebrow);
    text('phone-notice-title', copy.title);
    text('phone-notice-message', copy.message);
    text('phone-notice-note', copy.note);
    text('phone-notice-continue', copy.continueLabel);
    return copy;
  };

  const fail = () => {
    const copy = applyLanguage();
    const shell = document.getElementById('auth-shell');
    const loader = document.getElementById('auth-loader');
    const notice = document.getElementById('phone-notice');
    const retry = document.getElementById('retry');
    if (shell) shell.classList.add('is-error');
    if (loader) loader.hidden = true;
    if (notice) notice.hidden = true;
    text('message', copy.errorMessage);
    if (retry) {
      retry.hidden = false;
      window.requestAnimationFrame?.(() => retry.focus());
    }
  };

  const finish = (returnTo = '/App.dc.html') => {
    const destination = String(returnTo || '/App.dc.html');
    if (!isPhoneDevice(window)) {
      window.location.replace(destination);
      return false;
    }

    applyLanguage();
    const shell = document.getElementById('auth-shell');
    const loading = document.getElementById('auth-loading');
    const notice = document.getElementById('phone-notice');
    const continueButton = document.getElementById('phone-notice-continue');
    if (!shell || !loading || !notice || !continueButton) {
      window.location.replace(destination);
      return false;
    }

    let continuing = false;
    const continueToFilmScript = () => {
      if (continuing) return;
      continuing = true;
      continueButton.disabled = true;
      document.removeEventListener('keydown', onKeyDown);
      shell.classList.add('is-continuing');
      window.location.replace(destination);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        continueToFilmScript();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        continueButton.focus();
      }
    };

    loading.hidden = true;
    notice.hidden = false;
    shell.classList.remove('is-error');
    shell.classList.add('is-phone-notice');
    continueButton.addEventListener('click', continueToFilmScript, { once: true });
    document.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame?.(() => continueButton.focus());
    return true;
  };

  applyLanguage();
  window.filmscriptMobileAuthNotice = Object.freeze({
    fail,
    finish,
    isPhoneDevice,
  });
})();
