// Shared FilmScript UI sound effects. Audio is always user-triggered and can be
// muted from the Editor sound control.
(() => {
  const STORAGE_KEY = 'filmscript_sound_effects_on';
  const definitions = {
    brand: { src: './assets/sfx/filmscript-brand-bell.wav', volume: 0.2 },
    profile: { src: './assets/sfx/profile-open-click.mp3', volume: 0.22 },
    profileOption: { src: './assets/sfx/profile-option-select.mp3', volume: 0.22 },
    languageSelect: { src: './assets/sfx/language-select.wav', volume: 0.17 },
    cancelPro: { src: './assets/sfx/stripboard-selection-exit.mp3', volume: 0.22 },
    workMode: { src: './assets/sfx/work-mode-click.mp3', volume: 0.22 },
    stripboardEnter: { src: './assets/sfx/stripboard-enter-dial.mp3', volume: 0.2 },
    stripboardSelectionEnter: { src: './assets/sfx/stripboard-selection-enter.mp3', volume: 0.16 },
    stripboardSelectionToggle: { src: './assets/sfx/stripboard-selection-toggle.mp3', volume: 0.14 },
    stripboardSelectionExit: { src: './assets/sfx/stripboard-selection-exit.mp3', volume: 0.16 },
    stripboardLunchAdded: { src: './assets/sfx/stripboard-lunch-added.mp3', volume: 0.18 },
    castIdHover: { src: './assets/sfx/cast-id-hover.mp3', volume: 0.12 },
    shotlistEnter: { src: './assets/sfx/shotlist-enter-shutter.wav', volume: 0.2 },
    formatControl: { src: './assets/sfx/format-control-pop.wav', volume: 0.18 },
    budgetCount: { src: './assets/sfx/budget-number-ticks.wav', volume: 0.11 },
    budgetEnter: { src: './assets/sfx/budget-enter-coins.mp3', volume: 0.14 },
    calendarEnter: { src: './assets/sfx/calendar-enter-page.wav', volume: 0.16 },
    calendarTaskComplete: { src: './assets/sfx/calendar-task-complete.mp3', volume: 0.18 },
    sceneNavigate: { src: './assets/sfx/scene-navigation-notification.mp3', volume: 0.18 },
    scriptOpen: { src: './assets/sfx/script-open-paper.wav', volume: 0.2 },
    darkModeOn: { src: './assets/sfx/dark-mode-switch-on.wav', volume: 0.18 },
    lightModeOn: { src: './assets/sfx/light-mode-switch-on.wav', volume: 0.18 },
    createNewScript: { src: './assets/sfx/create-new-script.mp3', volume: 0.22 },
    importScript: { src: './assets/sfx/import-script.mp3', volume: 0.22 },
    editorEnter: { src: './assets/sfx/filmscript-brand-bell.wav', volume: 0.2 },
    analysisEnter: { src: './assets/sfx/analysis-enter-open.mp3', volume: 0.2 },
    breakdownEnter: { src: './assets/sfx/import-script.mp3', volume: 0.2 },
    imagineEnter: { src: './assets/sfx/imagine-enter-open.mp3', volume: 0.16 },
    vaultOpen: { src: './assets/sfx/vault-open.wav', volume: 0.16 },
  };
  const players = new Map();
  let enabled = true;

  try { enabled = localStorage.getItem(STORAGE_KEY) !== '0'; } catch (e) {}

  const stopPlayer = (player) => {
    if (!player) return;
    try {
      player.pause();
      player.currentTime = 0;
    } catch (e) {}
  };

  const stopAll = () => players.forEach(stopPlayer);

  const preload = (name) => {
    const definition = definitions[name];
    if (!definition || typeof Audio === 'undefined') return null;
    if (!players.has(name)) {
      const player = new Audio(new URL(definition.src, document.baseURI).href);
      player.preload = 'auto';
      player.volume = definition.volume;
      try { player.load(); } catch (e) {}
      players.set(name, player);
    }
    return players.get(name);
  };

  const play = (name, options = {}) => {
    if (!enabled) return Promise.resolve(false);
    const definition = definitions[name];
    const player = preload(name);
    if (!definition || !player) return Promise.resolve(false);
    stopAll();
    const requestedVolume = Number(options.volume);
    player.volume = Number.isFinite(requestedVolume)
      ? Math.max(0, Math.min(1, requestedVolume))
      : definition.volume;
    try {
      const playback = player.play();
      return playback?.then ? playback.then(() => true).catch(() => false) : Promise.resolve(true);
    } catch (e) { return Promise.resolve(false); }
  };

  const setEnabled = (nextEnabled) => {
    enabled = !!nextEnabled;
    if (!enabled) stopAll();
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch (e) {}
    window.dispatchEvent(new CustomEvent('filmscript:sound-change', { detail: { enabled } }));
    return enabled;
  };

  window.filmscriptSounds = {
    isEnabled: () => enabled,
    play,
    preload,
    preloadAll: () => Object.keys(definitions).forEach(preload),
    setEnabled,
    stop: (name) => stopPlayer(players.get(name)),
    stopAll,
    toggle: () => setEnabled(!enabled),
  };

  let lastBrandPointerAt = 0;
  document.addEventListener('pointerdown', (event) => {
    if (!event.target?.closest?.('[data-filmscript-brand]')) return;
    lastBrandPointerAt = Date.now();
    play('brand');
  }, { capture: true, passive: true });
  document.addEventListener('click', (event) => {
    if (!event.target?.closest?.('[data-filmscript-brand]')) return;
    if (Date.now() - lastBrandPointerAt > 450) play('brand');
  }, true);

  const findProfileOption = (target) => target?.closest?.(
    '[data-filmscript-profile-panel] .fs-menuitem, [data-filmscript-profile-panel] [data-act^="a-"]'
  );
  let lastProfileOptionPointerAt = 0;
  document.addEventListener('pointerdown', (event) => {
    if (event.target?.closest?.('[data-testid="account-avatar"]')) preload('profileOption');
    if (!findProfileOption(event.target)) return;
    lastProfileOptionPointerAt = Date.now();
    play('profileOption');
  }, { capture: true, passive: true });
  document.addEventListener('click', (event) => {
    if (!findProfileOption(event.target)) return;
    if (Date.now() - lastProfileOptionPointerAt > 450) play('profileOption');
  }, true);
})();
