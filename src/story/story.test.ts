import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SCENARIOS } from '../data/scenarios';
import { buildBeats, isTranslated, narration, tri, LANG_IDX, type Lang } from './script';
import { textHash } from './hash';
import { buildManifest, manifestModuleSource } from './manifest';
import { HOLD_MS, LEAD_MS, LOAD_WAIT_MS, OPEN_MS, StoryEngine, type AudioLike, type ClipInfo, type VoiceSource } from './engine';
import { VoiceBank, resetVoiceFlag } from './voice';
import { voiceUrl } from './useStory';

const LANGS: Lang[] = ['en', 'ru', 'uz'];
const timur = SCENARIOS.find((s) => s.id === 'timur-east')!;

describe('story script', () => {
  it('the Timur storyboard is a lossless sentence split of the documented background', () => {
    const beats = buildBeats(timur);
    for (const lang of LANGS) {
      const i = LANG_IDX[lang];
      const spoken = beats.filter((b) => !b.note).map((b) => b.text[i]).join(' ');
      const documented = timur.background.map((p) => tri(p)[i]).join(' ');
      expect(spoken).toBe(documented);
    }
    // and the last shot is exactly the content note
    const note = beats[beats.length - 1]!;
    expect(note.note).toBe(true);
    expect(note.text).toEqual(tri(timur.sensitivity!));
  });

  it('every built-in scenario is fully translated (otherwise its voice-over would be read in the wrong language)', () => {
    for (const def of SCENARIOS) {
      for (const b of buildBeats(def)) {
        for (const lang of LANGS) expect(isTranslated(b.text, lang), `${def.id} · ${lang} · ${b.text[0].slice(0, 40)}`).toBe(true);
      }
    }
  });

  it('generic scenarios get one shot per paragraph plus the note', () => {
    const def = SCENARIOS.find((s) => s.id === 'waterloo')!;
    const beats = buildBeats(def);
    expect(beats.length).toBe(def.background.length + (def.sensitivity ? 1 : 0));
    expect(beats.map((b) => b.text[0])).toEqual([...def.background, ...(def.sensitivity ? [def.sensitivity] : [])]);
  });

  it('custom scenarios never use a built-in storyboard', () => {
    const beats = buildBeats({ ...timur, custom: true });
    expect(beats.length).toBe(timur.background.length + 1);
  });
});

describe('voice-over whitelist (api/tts.js)', () => {
  it('api/_story-text.js is up to date with the scenario texts', async () => {
    const mod = (await import(/* @vite-ignore */ '../../api/_story-text.js' as string)) as { default: unknown };
    expect(mod.default).toEqual(buildManifest());
    expect(manifestModuleSource()).toContain('"timur-east"');
  });

  it('the client and the server compute the same text hash', async () => {
    const api = (await import(/* @vite-ignore */ '../../api/tts.js' as string)) as { textHash: (s: string) => string };
    for (const s of ['', 'abc', timur.background[0]!, "Samarqandga qaytgan Temur 1402-yilda…", 'Тимур заболел и умер 18 февраля 1405 года']) expect(api.textHash(s)).toBe(textHash(s));
  });

  it('voiceUrl asks for exactly the text the server holds', async () => {
    const mani = buildManifest();
    const beats = buildBeats(timur);
    for (const lang of LANGS) {
      beats.forEach((b, i) => {
        const url = new URL(voiceUrl(timur.id, i, lang, b)!, 'http://x');
        expect(url.pathname).toBe('/api/tts');
        expect(url.searchParams.get('id')).toBe(`timur-east.${i}`);
        expect(url.searchParams.get('lang')).toBe(lang);
        expect(url.searchParams.get('h')).toBe(textHash(mani['timur-east']![lang][i]!));
      });
    }
    expect(narration(timur, 'uz')).toEqual(mani['timur-east']!.uz);
  });
});

// ---------------------------------------------------------------------------------------------
class FakeAudio implements AudioLike {
  src = ''; muted = false; currentTime = 0; duration = NaN;
  playing = false; rejectUnmuted = false; plays = 0;
  private fns: Record<string, Set<() => void>> = { ended: new Set(), error: new Set(), loadedmetadata: new Set() };
  play(): Promise<void> {
    if (this.rejectUnmuted && !this.muted) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    this.plays++; this.playing = true; return Promise.resolve();
  }
  pause(): void { this.playing = false; }
  addEventListener(t: 'ended' | 'error' | 'loadedmetadata', fn: () => void): void { this.fns[t]!.add(fn); }
  removeEventListener(t: 'ended' | 'error' | 'loadedmetadata', fn: () => void): void { this.fns[t]!.delete(fn); }
  emit(t: string): void { this.fns[t]!.forEach((f) => f()); }
  /** simulate `ms` of playback */
  advance(ms: number): void { if (this.playing) this.currentTime += ms / 1000; }
  end(): void { this.playing = false; this.emit('ended'); }
}
class FakeVoice implements VoiceSource {
  status: ClipInfo['status'] = 'ready'; ok = true; requested: number[] = [];
  available(): boolean { return this.ok; }
  request(i: number): void { this.requested.push(i); }
  clip(): ClipInfo { return { status: this.status, url: 'blob:fake' }; }
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
let now = 0;
const clock = () => now;
function mk(opts: { voice?: FakeVoice | null; audio?: FakeAudio | null; lang?: Lang; muted?: boolean; activation?: boolean } = {}) {
  const audio = opts.audio === undefined ? new FakeAudio() : opts.audio;
  const voice = opts.voice === undefined ? null : opts.voice;
  const muteLog: boolean[] = [];
  const eng = new StoryEngine({ beats: buildBeats(timur), lang: opts.lang ?? 'uz', audio, voice, muted: opts.muted, onMutedChange: (m) => muteLog.push(m), hasActivation: () => opts.activation ?? true, clock });
  return { eng, audio, voice, muteLog, snap: () => eng.getSnapshot() };
}
/** run the engine for `ms` of wall time in 16 ms frames (the fake audio follows the same clock) */
function run(eng: StoryEngine, ms: number, audio?: FakeAudio | null) {
  for (let t = 0; t < ms; t += 16) { now += 16; audio?.advance(16); eng.tick(16); }
}
beforeEach(() => { now = 0; resetVoiceFlag(); });

describe('story engine (silent timeline)', () => {
  it('waits for start and for visibility', () => {
    const { eng, snap } = mk();
    run(eng, 5000);
    expect(snap().phase).toBe('idle');
    expect(snap().index).toBe(-1);
    eng.start();
    run(eng, 1000);
    expect(snap().phase).toBe('playing');
    expect(snap().t).toBe(0); // not visible → clock stands still
    eng.setVisible(true);
    run(eng, 1000);
    expect(snap().t).toBeGreaterThan(900);
  });

  it('plays title card → shots → end card on its own, slowly', () => {
    const { eng, snap } = mk();
    eng.setVisible(true); eng.start();
    run(eng, OPEN_MS + 100);
    expect(snap().index).toBe(0);
    const seen = new Set<number>();
    for (let i = 0; i < 4000 && snap().phase !== 'ended'; i++) { run(eng, 160); seen.add(snap().index); }
    expect(snap().phase).toBe('ended');
    expect(snap().index).toBe(snap().count);
    expect([...seen].filter((x) => x >= 0 && x < snap().count).length).toBe(snap().count); // every shot was shown
    expect(now).toBeGreaterThan(60_000); // a proper, unhurried cinematic
  });

  it('reveals the caption progressively and finishes it before the shot ends', () => {
    const { eng, snap } = mk();
    eng.setVisible(true); eng.start(); eng.goTo(1);
    run(eng, LEAD_MS - 50);
    expect(snap().reveal).toBe(0);
    run(eng, 4000);
    const mid = snap().reveal;
    expect(mid).toBeGreaterThan(0.05);
    expect(mid).toBeLessThan(0.9);
    run(eng, snap().total - snap().t - HOLD_MS - 100);
    expect(snap().reveal).toBe(1);
  });

  it('pause freezes the shot, resume continues', () => {
    const { eng, snap } = mk();
    eng.setVisible(true); eng.start(); eng.goTo(0);
    run(eng, 3000);
    eng.pause();
    const t = snap().t;
    run(eng, 5000);
    expect(snap().t).toBe(t);
    expect(snap().phase).toBe('paused');
    eng.resume();
    run(eng, 1000);
    expect(snap().t).toBeGreaterThan(t);
  });

  it('skip jumps straight to the end card; replay starts again from the title card', () => {
    const { eng, snap } = mk();
    eng.setVisible(true); eng.start(); run(eng, 8000);
    eng.skip();
    expect(snap().phase).toBe('ended');
    expect(snap().index).toBe(snap().count);
    eng.replay();
    expect(snap().phase).toBe('playing');
    expect(snap().index).toBe(-1);
  });

  it('next/prev/goTo move between shots; prev restarts a shot that has been running a while', () => {
    const { eng, snap } = mk();
    eng.setVisible(true); eng.start();
    eng.next(); expect(snap().index).toBe(0);
    eng.next(); expect(snap().index).toBe(1);
    eng.prev(); expect(snap().index).toBe(0);
    run(eng, 4000);
    eng.prev(); expect(snap().index).toBe(0); expect(snap().t).toBeLessThan(100);
    eng.goTo(3); expect(snap().index).toBe(3);
    eng.goTo(99); expect(snap().phase).toBe('ended');
  });

  it('works without any audio at all', () => {
    const { eng, snap } = mk({ audio: null, voice: null });
    eng.setVisible(true); eng.start(); run(eng, 30_000);
    expect(snap().voice).toBe('off');
    expect(snap().index).toBeGreaterThanOrEqual(0);
  });
});

describe('story engine (voice-over)', () => {
  it('the voice becomes the clock and the shot follows the length of the clip', async () => {
    const voice = new FakeVoice(); const audio = new FakeAudio(); audio.duration = 8;
    const { eng, snap } = mk({ voice, audio });
    eng.setVisible(true); eng.start(); eng.goTo(1);
    run(eng, LEAD_MS + 100, audio);
    await flush();
    expect(audio.src).toBe('blob:fake');
    expect(audio.playing).toBe(true);
    expect(audio.muted).toBe(false);
    expect(snap().voice).toBe('on');
    audio.emit('loadedmetadata');
    run(eng, 4000, audio);
    expect(snap().t).toBeGreaterThan(LEAD_MS + 3500);
    expect(snap().t).toBeLessThan(LEAD_MS + 4500);
    // narration ends → short hold → next shot
    audio.currentTime = 8; audio.end();
    run(eng, HOLD_MS + 100, audio);
    expect(snap().index).toBe(2);
    expect(voice.requested).toContain(3); // the next clip was fetched ahead of time
  });

  it('pausing pauses the voice too', async () => {
    const voice = new FakeVoice(); const audio = new FakeAudio(); audio.duration = 8;
    const { eng } = mk({ voice, audio });
    eng.setVisible(true); eng.start(); eng.goTo(0);
    run(eng, 1200, audio); await flush();
    expect(audio.playing).toBe(true);
    eng.pause(); expect(audio.playing).toBe(false);
    eng.resume(); await flush(); expect(audio.playing).toBe(true);
    eng.setVisible(false); expect(audio.playing).toBe(false);
  });

  it('waits for a clip that is still downloading, then gives up and carries on silently', () => {
    const voice = new FakeVoice(); voice.status = 'loading';
    const { eng, snap } = mk({ voice });
    eng.setVisible(true); eng.start(); eng.goTo(0);
    run(eng, LEAD_MS + 3000);
    expect(snap().t).toBe(LEAD_MS); // held back
    expect(snap().voice).toBe('loading');
    run(eng, LOAD_WAIT_MS + 500);
    expect(snap().t).toBeGreaterThan(LEAD_MS + 100); // went on without it
  });

  it('a failed clip does not stall the story', () => {
    const voice = new FakeVoice(); voice.status = 'failed';
    const { eng, snap } = mk({ voice });
    eng.setVisible(true); eng.start(); eng.goTo(0);
    run(eng, LEAD_MS + 2000);
    expect(snap().t).toBeGreaterThan(LEAD_MS + 1500);
  });

  it('browser autoplay block → plays muted, asks for a tap, and a tap makes it audible', async () => {
    const voice = new FakeVoice(); const audio = new FakeAudio(); audio.duration = 8; audio.rejectUnmuted = true;
    const { eng, snap } = mk({ voice, audio, activation: false });
    eng.setVisible(true); eng.start(); eng.goTo(0);
    run(eng, LEAD_MS + 100, audio); await flush();
    expect(audio.muted).toBe(true);
    expect(audio.playing).toBe(true);
    expect(snap().voice).toBe('blocked');
    eng.unlock();
    expect(audio.muted).toBe(false);
    expect(snap().voice).toBe('on');
  });

  it('a hard autoplay failure falls back to the silent timeline and a tap restarts the shot with sound', async () => {
    const voice = new FakeVoice(); const audio = new FakeAudio(); audio.duration = 8;
    audio.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    const { eng, snap } = mk({ voice, audio, activation: false });
    eng.setVisible(true); eng.start(); eng.goTo(0);
    run(eng, LEAD_MS + 100, audio); await flush();
    expect(snap().voice).toBe('blocked');
    run(eng, 2000, audio); // the story still moves
    expect(snap().t).toBeGreaterThan(LEAD_MS + 1500);
    audio.play = FakeAudio.prototype.play.bind(audio);
    eng.unlock();
    expect(snap().t).toBeLessThan(100); // the shot restarts so voice and picture line up
    run(eng, LEAD_MS + 100, audio); await flush();
    expect(audio.playing).toBe(true);
    expect(audio.muted).toBe(false);
  });

  it('mute is remembered, silences the voice, and unmuting brings it back', async () => {
    const voice = new FakeVoice(); const audio = new FakeAudio(); audio.duration = 8;
    const { eng, snap, muteLog } = mk({ voice, audio });
    eng.setVisible(true); eng.start(); eng.goTo(0);
    run(eng, LEAD_MS + 100, audio); await flush();
    eng.toggleMute();
    expect(audio.muted).toBe(true);
    expect(snap().voice).toBe('muted');
    eng.toggleMute();
    expect(audio.muted).toBe(false);
    expect(muteLog).toEqual([true, false]);
  });

  it('starting muted never asks for clips', () => {
    const voice = new FakeVoice();
    const { eng, snap } = mk({ voice, muted: true });
    eng.setVisible(true); eng.start(); eng.goTo(0);
    run(eng, 3000);
    expect(voice.requested).toEqual([]);
    expect(snap().voice).toBe('muted');
  });

  it('a voice source that is switched off reads as "off" and the story is silent', () => {
    const voice = new FakeVoice(); voice.ok = false;
    const { eng, snap } = mk({ voice });
    eng.setVisible(true); eng.start(); eng.goTo(0);
    run(eng, 3000);
    expect(snap().voice).toBe('off');
    expect(snap().t).toBeGreaterThan(2500);
  });
});

describe('VoiceBank', () => {
  const mkRes = (ok: boolean, type: string) => ({ ok, status: ok ? 200 : 503, headers: { get: () => type }, blob: async () => new Blob(['x'], { type }) }) as unknown as Response;
  const wait = () => new Promise((r) => setTimeout(r, 10));

  it('downloads clips and exposes object URLs; unknown/out-of-range shots are failed', async () => {
    const f = vi.fn(async () => mkRes(true, 'audio/mpeg'));
    const bank = new VoiceBank((i) => `/api/tts?i=${i}`, 3, f as unknown as typeof fetch);
    expect(bank.clip(0).status).toBe('loading');
    await wait();
    expect(bank.clip(0).status).toBe('ready');
    expect(bank.clip(0).url).toMatch(/^blob:/);
    expect(f).toHaveBeenCalledTimes(1);
    expect(bank.clip(7).status).toBe('failed');
    bank.dispose();
  });

  it('one failure switches the voice off for everyone (no hammering a broken endpoint)', async () => {
    const f = vi.fn(async () => mkRes(false, 'application/json'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bank = new VoiceBank((i) => `/api/tts?i=${i}`, 3, f as unknown as typeof fetch);
    bank.request(0);
    await wait();
    expect(bank.clip(0).status).toBe('failed');
    expect(bank.available()).toBe(false);
    bank.request(1);
    expect(f).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('shots without a URL (untranslated) are silent without disabling the voice', () => {
    const bank = new VoiceBank(() => null, 2, vi.fn() as unknown as typeof fetch);
    expect(bank.clip(0).status).toBe('failed');
    expect(bank.available()).toBe(true);
  });
});
