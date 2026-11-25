import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLang } from '../i18n';
import { markIntroDone, shouldPlayIntro } from './seen';

let clock = Date.parse('2026-01-01T00:00:00Z');

describe('intro memory', () => {
  // every test starts a good while after the previous one, so earlier language switches are long past
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.useFakeTimers(); clock += 100_000; vi.setSystemTime(clock); });
  afterEach(() => { useLang.getState().setLang('en'); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('plays on a fresh visit, and again on the next fresh visit', () => {
    expect(shouldPlayIntro('a', false)).toBe(true);
    markIntroDone('a');
    vi.advanceTimersByTime(60_000); // opening the scenario again later
    expect(shouldPlayIntro('a', false)).toBe(true);
  });

  it('does not replay right after a language switch (the page remounts)', () => {
    expect(shouldPlayIntro('b', false)).toBe(true);
    markIntroDone('b');
    useLang.getState().setLang('ru');
    vi.advanceTimersByTime(400);
    expect(shouldPlayIntro('b', false)).toBe(false);
    expect(shouldPlayIntro('b', false)).toBe(false); // (React strict mode asks twice)
  });

  it('a language switch while the intro is still playing restarts it in the new language', () => {
    expect(shouldPlayIntro('c', false)).toBe(true);
    useLang.getState().setLang('uz');
    vi.advanceTimersByTime(400);
    expect(shouldPlayIntro('c', false)).toBe(true);
  });

  it('does not replay when the app remounts the page right after it was dismissed', () => {
    expect(shouldPlayIntro('e', false)).toBe(true);
    markIntroDone('e');
    vi.advanceTimersByTime(420); // the page transition mounts the page a second time
    expect(shouldPlayIntro('e', false)).toBe(false);
    expect(shouldPlayIntro('e', false)).toBe(false);
    vi.advanceTimersByTime(5_000); // opened again later
    expect(shouldPlayIntro('e', false)).toBe(true);
  });

  it('is never played for people who asked for reduced motion', () => {
    expect(shouldPlayIntro('d', true)).toBe(false);
  });
});
