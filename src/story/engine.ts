// Timeline engine of the story cinematic: which shot is on, how far its caption is revealed, and how the voice-over
// (if any) drives the clock. Framework-free so it can be unit-tested with a fake clock and a fake <audio>.
import { LANG_IDX, type Beat, type Lang } from './script';

export const OPEN_MS = 4200; // title card
export const END_HOLD_MS = 5200; // the closing question stays this long before the written text takes over
export const LEAD_MS = 900; // picture first, then the voice
export const HOLD_MS = 1600; // breathing room after the last word
export const MIN_SPEAK_MS = 5000;
export const MS_PER_CHAR = 72; // slow reading pace for the silent timeline
export const LOAD_WAIT_MS = 7000; // how long a shot waits for its voice clip before going on silently
const EMIT_EVERY_MS = 66;

export type Phase = 'idle' | 'playing' | 'paused' | 'ended';
/** off: no voice-over here · muted: user choice · blocked: browser needs a tap · loading: clip on its way · on: audible */
export type VoiceState = 'off' | 'loading' | 'on' | 'blocked' | 'muted';
type AudioPhase = 'none' | 'starting' | 'playing' | 'done' | 'skipped';

export interface AudioLike {
  src: string;
  muted: boolean;
  currentTime: number;
  readonly duration: number;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: 'ended' | 'error' | 'loadedmetadata', fn: () => void): void;
  removeEventListener(type: 'ended' | 'error' | 'loadedmetadata', fn: () => void): void;
}
export interface ClipInfo { status: 'loading' | 'ready' | 'failed'; url?: string }
export interface VoiceSource {
  available(): boolean;
  request(i: number): void;
  clip(i: number): ClipInfo;
  dispose?(): void;
}

export interface Snapshot {
  /** -1 = title card, 0..count-1 = shots, count = end card */
  index: number;
  count: number;
  phase: Phase;
  running: boolean;
  t: number;
  total: number;
  reveal: number;
  voice: VoiceState;
  muted: boolean;
}

export interface EngineOptions {
  beats: Beat[];
  lang: Lang;
  audio?: AudioLike | null;
  voice?: VoiceSource | null;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  hasActivation?: () => boolean;
  clock?: () => number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export class StoryEngine {
  readonly count: number;
  private readonly beats: Beat[];
  private readonly lang: Lang;
  private readonly audio: AudioLike | null;
  private readonly voice: VoiceSource | null;
  private readonly opts: EngineOptions;
  private readonly clock: () => number;

  private index = -1;
  private t = 0;
  private phase: Phase = 'idle';
  private visible = false;
  private muted: boolean;
  private gestured = false;
  private blocked = false;
  private audioPhase: AudioPhase = 'none';
  private audioMs = 0;
  private waited = 0;
  private token = 0;
  private wasRunning = false;
  private lastEmit = -1e9;
  private snap: Snapshot;
  private readonly listeners = new Set<() => void>();

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.beats = opts.beats;
    this.count = opts.beats.length;
    this.lang = opts.lang;
    this.audio = opts.audio ?? null;
    this.voice = opts.voice ?? null;
    this.muted = !!opts.muted;
    this.clock = opts.clock ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.snap = this.build();
    this.attach();
  }

  // ---- external-store plumbing (useSyncExternalStore) -----------------------------------------
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  getSnapshot = (): Snapshot => this.snap;

  private readonly onEnded = () => {
    if (this.audioPhase !== 'playing') return;
    this.audioPhase = 'done';
    this.t = LEAD_MS + this.speak();
    this.emit(true);
  };
  private readonly onError = () => {
    if (this.audioPhase === 'starting' || this.audioPhase === 'playing') { this.audioPhase = 'skipped'; this.emit(true); }
  };
  private readonly onMeta = () => {
    const d = this.audio?.duration;
    if (d && Number.isFinite(d) && d > 0) this.audioMs = d * 1000;
  };
  /** (Re)connect the audio element — safe to call again after detach() (React strict mode re-runs effects). */
  attach(): void {
    this.audio?.addEventListener('ended', this.onEnded);
    this.audio?.addEventListener('error', this.onError);
    this.audio?.addEventListener('loadedmetadata', this.onMeta);
  }
  detach(): void {
    this.audio?.removeEventListener('ended', this.onEnded);
    this.audio?.removeEventListener('error', this.onError);
    this.audio?.removeEventListener('loadedmetadata', this.onMeta);
    this.token++;
    this.stopAudio();
    this.audioPhase = 'none';
    this.voice?.dispose?.();
  }

  // ---- timeline ---------------------------------------------------------------------------------
  private get running(): boolean { return this.phase === 'playing' && this.visible; }
  private text(i: number): string { return this.beats[i]!.text[LANG_IDX[this.lang]]; }
  private estimate(i: number): number { return Math.max(MIN_SPEAK_MS, this.text(i).length * MS_PER_CHAR); }
  private speak(): number { return this.audioMs > 0 ? this.audioMs : this.estimate(this.index); }
  private total(): number { return this.index < 0 ? OPEN_MS : LEAD_MS + this.speak() + HOLD_MS; }
  private voiceWanted(i: number): boolean { return !!this.voice && !!this.audio && !this.muted && this.voice.available() && i >= 0 && i < this.count; }
  private canSound(): boolean { return this.gestured || !!this.opts.hasActivation?.(); }

  private enter(i: number): void {
    this.token++;
    this.stopAudio();
    this.index = i;
    this.t = 0;
    this.audioPhase = 'none';
    this.audioMs = 0;
    this.waited = 0;
    if (i >= this.count) this.phase = 'ended';
    else if (this.voiceWanted(i)) { this.voice!.request(i); this.voice!.request(i + 1); }
    this.syncRunning();
    this.emit(true);
  }

  /** Advance the clock by dt ms (called every animation frame while running). */
  tick(dt: number): void {
    if (!this.running || this.index >= this.count) return;
    if (this.index < 0) {
      this.t += dt;
      if (this.t >= OPEN_MS) this.enter(0);
      else this.emit(false);
      return;
    }
    const i = this.index;
    if (this.audioPhase === 'playing' && this.audio) {
      // while the voice plays it is the clock, so picture and words follow what is actually heard
      this.t = LEAD_MS + this.audio.currentTime * 1000;
    } else {
      this.t += dt;
      if (this.audioPhase === 'none' && this.t >= LEAD_MS && this.voiceWanted(i)) {
        const c = this.voice!.clip(i);
        if (c.status === 'ready' && c.url) this.startAudio(c.url);
        else if (c.status === 'loading') {
          this.t = LEAD_MS; // wait for the clip rather than racing ahead of it
          this.waited += dt;
          if (this.waited >= LOAD_WAIT_MS) this.audioPhase = 'skipped';
        } else this.audioPhase = 'skipped';
      }
    }
    if (this.t >= this.total()) this.enter(i + 1);
    else this.emit(false);
  }

  // ---- voice ------------------------------------------------------------------------------------
  private startAudio(url: string): void {
    const a = this.audio!;
    const tok = this.token;
    this.audioPhase = 'starting';
    try { a.src = url; a.currentTime = 0; } catch { /* ignore */ }
    a.muted = this.muted || !this.canSound();
    const playing = () => {
      if (tok !== this.token) return;
      this.audioPhase = 'playing';
      this.blocked = a.muted && !this.muted;
      this.emit(true);
    };
    const failed = () => {
      if (tok !== this.token) return;
      this.audioPhase = 'skipped';
      this.blocked = true;
      this.emit(true);
    };
    a.play().then(playing).catch(() => {
      if (tok !== this.token) return;
      if (!a.muted) { a.muted = true; a.play().then(playing).catch(failed); } else failed(); // muted playback is always allowed
    });
  }
  private stopAudio(): void { try { this.audio?.pause(); } catch { /* ignore */ } }
  private pauseAudio(): void { if (this.audioPhase === 'playing') this.stopAudio(); }
  private resumeAudio(): void { if (this.audioPhase === 'playing' && this.audio) this.audio.play().catch(() => { this.blocked = true; this.emit(true); }); }

  /** Call from any user gesture inside the player: lets a muted-by-the-browser voice become audible. */
  unlock(): void {
    this.gestured = true;
    if (!this.blocked) return;
    this.blocked = false;
    if (this.audio && this.audioPhase === 'playing') this.audio.muted = this.muted;
    else if (this.audioPhase === 'skipped' && this.voiceWanted(this.index)) this.restartShot();
    this.emit(true);
  }
  toggleMute(): void {
    this.muted = !this.muted;
    this.opts.onMutedChange?.(this.muted);
    if (this.muted) {
      if (this.audio) this.audio.muted = true;
    } else {
      this.gestured = true;
      this.blocked = false;
      if (this.audio && this.audioPhase === 'playing') this.audio.muted = false;
      else if (this.voiceWanted(this.index)) { this.voice!.request(this.index); this.voice!.request(this.index + 1); this.restartShot(); }
    }
    this.emit(true);
  }
  private restartShot(): void {
    this.token++;
    this.stopAudio();
    this.t = 0;
    this.audioPhase = 'none';
    this.audioMs = 0;
    this.waited = 0;
  }

  // ---- controls ---------------------------------------------------------------------------------
  setVisible(v: boolean): void { this.visible = v; this.syncRunning(); this.emit(true); }
  start(): void {
    if (this.phase === 'ended') { this.replay(); return; }
    if (this.phase !== 'idle') return;
    this.phase = 'playing';
    if (this.voiceWanted(0)) { this.voice!.request(0); this.voice!.request(1); } // fetch while the title card plays
    this.syncRunning();
    this.emit(true);
  }
  pause(): void { if (this.phase === 'playing') { this.phase = 'paused'; this.syncRunning(); this.emit(true); } }
  resume(): void { if (this.phase === 'paused') { this.phase = 'playing'; this.syncRunning(); this.emit(true); } }
  togglePlay(): void {
    if (this.phase === 'idle') this.start();
    else if (this.phase === 'ended') this.replay();
    else if (this.phase === 'playing') this.pause();
    else this.resume();
  }
  goTo(i: number): void {
    if (i >= this.count) { this.skip(); return; }
    if (this.phase === 'idle' || this.phase === 'ended') this.phase = 'playing';
    this.enter(Math.max(-1, i));
  }
  next(): void { this.goTo(this.index + 1); }
  prev(): void {
    if (this.index >= 0 && this.t > 2500) { this.restartShot(); this.emit(true); } else this.goTo(this.index - 1);
  }
  skip(): void { this.enter(this.count); }
  replay(): void {
    this.phase = 'playing';
    this.enter(-1);
    if (this.voiceWanted(0)) { this.voice!.request(0); this.voice!.request(1); }
  }

  private syncRunning(): void {
    const r = this.running;
    if (r === this.wasRunning) return;
    this.wasRunning = r;
    if (r) this.resumeAudio(); else this.pauseAudio();
  }

  // ---- snapshot ---------------------------------------------------------------------------------
  private voiceState(): VoiceState {
    if (!this.voice || !this.audio || !this.voice.available()) return 'off';
    if (this.muted) return 'muted';
    if (this.blocked) return 'blocked';
    if (this.audioPhase === 'none' && this.waited > 0) return 'loading';
    return 'on';
  }
  private build(): Snapshot {
    const i = this.index;
    const inShot = i >= 0 && i < this.count;
    const total = i >= this.count ? 0 : this.total();
    return {
      index: i,
      count: this.count,
      phase: this.phase,
      running: this.running,
      t: this.t,
      total,
      reveal: inShot ? clamp01((this.t - LEAD_MS) / Math.max(500, this.speak() - 350)) : 0,
      voice: this.voiceState(),
      muted: this.muted,
    };
  }
  private emit(force: boolean): void {
    const now = this.clock();
    if (!force && now - this.lastEmit < EMIT_EVERY_MS) return;
    this.lastEmit = now;
    this.snap = this.build();
    this.listeners.forEach((fn) => fn());
  }
}
