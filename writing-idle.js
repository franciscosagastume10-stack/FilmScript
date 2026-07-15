// Detects a genuine writing pause without coupling the timer to the editor UI.
// A pause is armed only by explicit writing activity and fires once. The writer
// must type again before another suggestion can appear.
(() => {
  'use strict';

  const DEFAULT_DELAY_MS = 2 * 60 * 1000;

  class WritingIdleController {
    constructor(options = {}) {
      this.delayMs = Math.max(0, Number(options.delayMs) || DEFAULT_DELAY_MS);
      this.onIdle = typeof options.onIdle === 'function' ? options.onIdle : () => {};
      this.canShow = typeof options.canShow === 'function' ? options.canShow : () => true;
      this.setTimer = typeof options.setTimer === 'function' ? options.setTimer : window.setTimeout.bind(window);
      this.clearTimer = typeof options.clearTimer === 'function' ? options.clearTimer : window.clearTimeout.bind(window);
      this.timer = null;
      this.armed = false;
      this.destroyed = false;
      this.generation = 0;
    }

    activity() {
      if (this.destroyed) return;
      this._clear();
      this.armed = true;
      const generation = ++this.generation;
      this.timer = this.setTimer(() => {
        this.timer = null;
        if (this.destroyed || !this.armed || generation !== this.generation) return;
        this.armed = false;
        if (this.canShow()) this.onIdle();
      }, this.delayMs);
    }

    pause() {
      this._clear();
      this.armed = false;
      this.generation += 1;
    }

    destroy() {
      this.pause();
      this.destroyed = true;
    }

    _clear() {
      if (this.timer == null) return;
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  window.filmscriptWritingIdle = Object.freeze({
    DEFAULT_DELAY_MS,
    create: (options) => new WritingIdleController(options),
  });
})();
