// Real play time: counts the seconds in which the site is open, visible and in use.
// Nothing is estimated or invented — a hidden tab, or no input for IDLE_MS, adds nothing.

export const TICK_MS = 5_000;
export const SYNC_MS = 60_000;
/** No mouse/keyboard/touch for this long = the person is away; stop counting until they are back. */
export const IDLE_MS = 120_000;

/** Seconds to credit for one tick. Never more than two ticks at once (sleeping laptop, throttled background timers). */
export function credit(dtMs: number, visible: boolean, sinceInputMs: number): number {
  if (!visible || dtMs <= 0 || sinceInputMs > IDLE_MS) return 0;
  return Math.min(dtMs, TICK_MS * 2) / 1000;
}

/** Everything the clock needs from the browser — replaceable in tests. */
export interface ClockEnv {
  now(): number;
  visible(): boolean;
  /** Subscribes to user input and to the tab being hidden / shown again; returns the unsubscribe function. */
  listen(onInput: () => void, onHide: () => void, onShow: () => void): () => void;
  /** Repeats `fn` every `ms`; returns the cancel function. */
  every(ms: number, fn: () => void): () => void;
}

const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

export const browserEnv: ClockEnv = {
  now: () => Date.now(),
  visible: () => document.visibilityState === 'visible',
  listen(onInput, onHide, onShow) {
    const vis = () => (document.visibilityState === 'visible' ? onShow() : onHide());
    for (const e of INPUT_EVENTS) window.addEventListener(e, onInput, { passive: true, capture: true });
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', onHide);
    return () => {
      for (const e of INPUT_EVENTS) window.removeEventListener(e, onInput, { capture: true });
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', onHide);
    };
  },
  every(ms, fn) { const id = window.setInterval(fn, ms); return () => window.clearInterval(id); },
};

export interface PlayClock {
  /** Whole seconds counted so far (including `start`). */
  seconds(): number;
  stop(): void;
}

/**
 * Starts counting from `start` seconds. `onSync(seconds)` is called about once a minute while the number is growing,
 * and when the tab is hidden or closed, so the stored value is never more than a minute behind.
 */
export function startPlayClock(start: number, onSync: (seconds: number) => void, env: ClockEnv = browserEnv): PlayClock {
  let sec = Math.max(0, start);
  let last = env.now();
  let lastInput = last;
  let synced = Math.floor(sec);
  let ticks = 0;
  let shown = env.visible();

  const tick = (visible: boolean) => {
    const now = env.now();
    sec += credit(now - last, visible, now - lastInput);
    last = now;
  };
  const sync = () => {
    const whole = Math.floor(sec);
    if (whole !== synced) { synced = whole; onSync(whole); }
  };

  const unlisten = env.listen(
    () => { lastInput = env.now(); },
    () => { if (shown) { tick(true); shown = false; } sync(); },          // leaving: count up to this moment and save
    () => { shown = true; last = env.now(); lastInput = last; },           // back: nothing is credited for the time away
  );
  const cancel = env.every(TICK_MS, () => {
    tick(env.visible());
    if (++ticks % (SYNC_MS / TICK_MS) === 0) sync();
  });

  return {
    seconds: () => { tick(env.visible()); return Math.floor(sec); },
    stop() { tick(env.visible()); sync(); cancel(); unlisten(); },
  };
}
