import { describe, expect, it } from 'vitest';
import { credit, IDLE_MS, startPlayClock, SYNC_MS, TICK_MS, type ClockEnv } from './playtime';

/** A browser with a hand-turned clock: `advance` fires the interval timers in order, like real time passing. */
function fakeBrowser() {
  let t = 1_000_000;
  let vis = true;
  const timers: { ms: number; fn: () => void; next: number }[] = [];
  let input = () => {}, hide = () => {}, show = () => {};
  const env: ClockEnv = {
    now: () => t,
    visible: () => vis,
    listen(i, h, s) { input = i; hide = h; show = s; return () => {}; },
    every(ms, fn) { const timer = { ms, fn, next: t + ms }; timers.push(timer); return () => { timers.splice(timers.indexOf(timer), 1); }; },
  };
  return {
    env,
    advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const due = timers.filter((x) => x.next <= end).sort((a, b) => a.next - b.next)[0];
        if (!due) break;
        t = due.next; due.next += due.ms; due.fn();
      }
      t = end;
    },
    touch() { input(); },
    leave() { vis = false; hide(); },
    back() { vis = true; show(); },
  };
}

describe('credit', () => {
  it('counts a tick only while visible and recently used, and never more than two ticks at once', () => {
    expect(credit(TICK_MS, true, 1_000)).toBe(5);
    expect(credit(TICK_MS, false, 1_000)).toBe(0);
    expect(credit(TICK_MS, true, IDLE_MS + 1)).toBe(0);
    expect(credit(-5, true, 0)).toBe(0);
    expect(credit(3_600_000, true, 0)).toBe(TICK_MS * 2 / 1000); // laptop slept for an hour: at most 10 s
  });
});

describe('play clock', () => {
  it('counts active time and saves about once a minute', () => {
    const b = fakeBrowser();
    const saved: number[] = [];
    const clock = startPlayClock(0, (s) => saved.push(s), b.env);
    for (let i = 0; i < 10; i++) { b.touch(); b.advance(30_000); } // 5 minutes of use
    expect(clock.seconds()).toBe(300);
    expect(saved).toEqual([60, 120, 180, 240, 300]);
    clock.stop();
  });

  it('continues from a saved number (page reload inside the same session)', () => {
    const b = fakeBrowser();
    const clock = startPlayClock(125, () => {}, b.env);
    b.touch(); b.advance(20_000);
    expect(clock.seconds()).toBe(145);
    clock.stop();
  });

  it('stops counting when nobody touches the page for two minutes, and goes on after the next input', () => {
    const b = fakeBrowser();
    const clock = startPlayClock(0, () => {}, b.env);
    b.advance(10 * 60_000); // ten minutes of staring at nothing
    expect(clock.seconds()).toBe(IDLE_MS / 1000);
    b.touch(); b.advance(30_000);
    expect(clock.seconds()).toBe(IDLE_MS / 1000 + 30);
    clock.stop();
  });

  it('adds nothing while the tab is hidden, and saves when it is hidden', () => {
    const b = fakeBrowser();
    const saved: number[] = [];
    const clock = startPlayClock(0, (s) => saved.push(s), b.env);
    b.touch(); b.advance(42_000);
    b.leave();
    expect(saved[saved.length - 1]).toBe(42);
    b.advance(30 * 60_000); // half an hour in another tab
    b.back();
    expect(clock.seconds()).toBe(42);
    b.touch(); b.advance(15_000);
    expect(clock.seconds()).toBe(57);
    clock.stop();
  });

  it('flushes the last seconds on stop', () => {
    const b = fakeBrowser();
    const saved: number[] = [];
    const clock = startPlayClock(0, (s) => saved.push(s), b.env);
    b.touch(); b.advance(SYNC_MS / 2);
    expect(saved).toEqual([]);
    clock.stop();
    expect(saved).toEqual([30]);
  });
});
