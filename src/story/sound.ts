// The cutscene's soundtrack, played with no audio files, no network and no API key: a drone pad, drums, a ney-like lead on a
// D-Hijaz scale, wind, a bell and a horn, all synthesised with the Web Audio API. It follows the "mood" of the shot that is
// on screen, ducks under the narrator when a voice-over is playing, and can be rendered offline (see sound.test.ts).
import type { Beat } from './script';

export type Mood = 'title' | 'majestic' | 'gathering' | 'battle' | 'wind' | 'sorrow' | 'dawn' | 'ruins' | 'question';
/** idle: not started · running: audible (or paused by the cutscene) · blocked: the browser waits for a tap · unsupported: no Web Audio */
export type BedState = 'idle' | 'running' | 'blocked' | 'unsupported';

type Phrase = ReadonlyArray<readonly [note: number, beats: number]>;
interface Spec {
  tempo: number;
  /** pad notes (Hz), up to four */
  pad: readonly number[];
  /** 16 steps: X boom · x drum · r rim shot · . rest */
  drums: string;
  level: { pad: number; drums: number; lead: number; wind: number };
  lead?: readonly Phrase[];
  leadRest?: number;
  bell?: number;
  clash?: number;
  horn?: number;
}

// A3 Bb3 C4 D4 Eb4 F#4 G4 A4 Bb4 C5 D5 — the D-Hijaz scale (the augmented second between Eb and F# is its colour)
const SCALE = [220.0, 233.08, 261.63, 293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33];
const PH: Record<string, Phrase> = {
  hail: [[3, 2], [5, 1], [6, 1], [7, 3], [5, 1], [4, 1], [3, 4]],
  rise: [[7, 2], [9, 1], [10, 3], [9, 1], [7, 1], [6, 1], [5, 2], [3, 4]],
  march: [[7, 1.5], [6, 0.5], [5, 1], [4, 1], [3, 2], [4, 1], [5, 1], [6, 2], [7, 2]],
  lone: [[7, 7]],
  lament: [[10, 3], [9, 1], [7, 3], [6, 1], [5, 2], [4, 2], [3, 6]],
  dawn: [[3, 2], [6, 2], [7, 2], [9, 2], [10, 4]],
  ask: [[7, 6], [8, 2], [7, 4]],
};
// D2 Eb2 F2 G2 A2 Bb2 C3 D3 Eb3 F3 F#3 G3 (Hz)
const SPECS: Record<Mood, Spec> = {
  title: { tempo: 60, pad: [73.42, 110, 146.83], drums: '..X.............', level: { pad: 0.5, drums: 1, lead: 0, wind: 0.3 } },
  majestic: { tempo: 62, pad: [73.42, 110, 146.83, 185], drums: 'X.......x..r....', level: { pad: 0.6, drums: 0.7, lead: 0.7, wind: 0.08 }, lead: [PH.hail!, PH.rise!], leadRest: 2, horn: 0.25 },
  gathering: { tempo: 84, pad: [73.42, 98, 146.83], drums: 'X..r..x.x..r..x.', level: { pad: 0.5, drums: 0.9, lead: 0.7, wind: 0.08 }, lead: [PH.march!], leadRest: 1 },
  battle: { tempo: 118, pad: [73.42, 77.78, 110], drums: 'X.xrX.xrX.xrX.xx', level: { pad: 0.5, drums: 0.9, lead: 0, wind: 0.12 }, clash: 0.5, horn: 0.2 },
  wind: { tempo: 52, pad: [73.42, 110], drums: 'X.........x.....', level: { pad: 0.55, drums: 0.4, lead: 0.6, wind: 1 }, lead: [PH.lone!], leadRest: 3 },
  sorrow: { tempo: 48, pad: [73.42, 87.31, 110, 130.81], drums: '................', level: { pad: 0.8, drums: 0, lead: 0.75, wind: 0.4 }, lead: [PH.lament!], leadRest: 2, bell: 0.7 },
  dawn: { tempo: 70, pad: [116.54, 146.83, 174.61, 73.42], drums: 'X.......x.......', level: { pad: 0.55, drums: 0.5, lead: 0.7, wind: 0.1 }, lead: [PH.dawn!], leadRest: 2, horn: 0.35 },
  ruins: { tempo: 44, pad: [73.42, 77.78, 155.56], drums: 'X.........x.....', level: { pad: 0.8, drums: 0.35, lead: 0, wind: 0.6 } },
  question: { tempo: 50, pad: [73.42, 98, 130.81, 196], drums: '................', level: { pad: 0.6, drums: 0, lead: 0.5, wind: 0.08 }, lead: [PH.ask!], leadRest: 4 },
};

/** Which mood belongs to the shot that is on screen (-1 = title card, count = closing question). */
export function moodFor(index: number, count: number, beat: Pick<Beat, 'visual' | 'note'> | null): Mood {
  if (index < 0) return 'title';
  if (index >= count || !beat) return 'question';
  if (beat.note) return 'ruins';
  switch (beat.visual) {
    case 'battle': return 'battle';
    case 'samarkand': return 'gathering';
    case 'winter': return 'wind';
    case 'otrar': return 'sorrow';
    case 'dawn': return 'dawn';
    case 'ruins': return 'ruins';
    default: return index % 2 === 0 ? 'majestic' : 'gathering';
  }
}

const LOOKAHEAD = 0.4;
const MASTER = 0.5;
const DUCKED = 0.5;
const PAD_GAIN = 0.2;
const DRUM_GAIN = 0.85;
const LEAD_GAIN = 0.32;
const WIND_GAIN = 0.22;
const FX_GAIN = 0.55;
const FLOOR = 0.0001;
const GRACE_MS = 700;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function defaultContext(): AudioContext {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const C = w.AudioContext ?? w.webkitAudioContext;
  if (!C) throw new Error('Web Audio is not available');
  return new C();
}

interface Graph {
  master: GainNode;
  pad: GainNode;
  drums: GainNode;
  lead: GainNode;
  wind: GainNode;
  fx: GainNode;
  noise: AudioBuffer;
  voices: { oscs: OscillatorNode[]; gain: GainNode; base: number; last: number }[];
}

export class SoundBed {
  private ctx: AudioContext | null = null;
  private g: Graph | null = null;
  private timer: ReturnType<typeof setInterval> | 0 = 0;
  private readonly listeners = new Set<() => void>();
  private state: BedState = 'idle';
  private moods: { at: number; mood: Mood }[] = [];
  private pending: Mood = 'title';
  private muted = false;
  private duck = false;
  private paused = false;
  private graceUntil = 0;
  private rand = rng(7);
  private stepAt = 0;
  private stepNo = 0;
  private cur: Mood | null = null;
  private leadAt = 0;
  private leadQueue: Array<readonly [number, number]> = [];

  constructor(private readonly create: () => AudioContext = defaultContext) {}

  // ---- external-store plumbing ---------------------------------------------------------------
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = (): BedState => this.state;
  private sync(): void {
    const c = this.ctx;
    let next: BedState = !c ? (this.state === 'unsupported' ? 'unsupported' : 'idle') : c.state === 'running' || this.paused ? 'running' : 'blocked';
    if (next === 'blocked' && this.state !== 'blocked' && Date.now() < this.graceUntil) { // a context made right after a tap needs a moment to say "running"
      next = 'running';
      setTimeout(() => this.sync(), this.graceUntil - Date.now() + 30);
    }
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((fn) => fn());
  }

  // ---- life cycle ------------------------------------------------------------------------------
  /** Builds the sound (once). It starts silent if the browser is still waiting for a tap; unlock() then lets it through. */
  start(): void {
    if (this.ctx || this.state === 'unsupported') return;
    let ctx: AudioContext;
    try { ctx = this.create(); } catch { this.state = 'unsupported'; this.listeners.forEach((fn) => fn()); return; }
    this.ctx = ctx;
    this.rand = rng(7);
    this.g = this.build(ctx);
    this.moods = [{ at: 0, mood: this.pending }];
    this.cur = null;
    this.stepNo = 0;
    this.stepAt = ctx.currentTime + 0.05;
    this.leadAt = this.stepAt + 1.2;
    this.leadQueue = [];
    this.graceUntil = Date.now() + GRACE_MS;
    this.applyLevels(this.pending, ctx.currentTime, true);
    this.applyMaster(0.25);
    ctx.onstatechange = () => this.sync();
    this.timer = setInterval(() => this.pump(), 120);
    this.pump();
    if (!this.paused) this.kick();
    this.sync();
  }
  private kick(): void { try { void this.ctx?.resume()?.catch(() => { /* the browser wants a tap first */ }); } catch { /* ignore */ } }

  /** Call from a tap or key press: lets a context the browser was holding back start. */
  unlock(): void { if (this.ctx && !this.paused && this.ctx.state !== 'running') this.kick(); }
  pause(): void {
    this.paused = true;
    try { void this.ctx?.suspend()?.catch(() => { /* ignore */ }); } catch { /* ignore */ }
    this.sync();
  }
  resume(): void {
    this.paused = false;
    this.graceUntil = Date.now() + GRACE_MS;
    if (this.ctx) this.kick();
    this.sync();
  }
  setMuted(m: boolean): void { this.muted = m; this.applyMaster(0.15); }
  /** Lower the music while the narrator speaks. */
  setDuck(d: boolean): void { this.duck = d; this.applyMaster(0.35); }
  setMood(m: Mood, at?: number): void {
    this.pending = m;
    const ctx = this.ctx;
    if (!ctx || !this.g) return;
    const when = at ?? ctx.currentTime + 0.05;
    this.moods.push({ at: when, mood: m });
    if (this.moods.length > 16) this.moods.splice(0, this.moods.length - 16);
    this.applyLevels(m, when, false);
    this.leadQueue = []; // the phrase that is ringing finishes its note, the next shot brings its own
  }
  /** Fades out and frees the audio context. The bed can be started again afterwards. */
  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
    const ctx = this.ctx;
    const g = this.g;
    this.ctx = null;
    this.g = null;
    this.moods = [];
    this.leadQueue = [];
    this.paused = false;
    if (ctx) {
      ctx.onstatechange = null;
      try { g?.master.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } catch { /* ignore */ }
      setTimeout(() => { try { void ctx.close().catch(() => { /* ignore */ }); } catch { /* ignore */ } }, 500);
    }
    if (this.state !== 'unsupported') this.state = 'idle';
    this.listeners.forEach((fn) => fn());
  }

  private applyMaster(tc: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.g) return;
    this.g.master.gain.setTargetAtTime(this.muted ? 0 : this.duck ? MASTER * DUCKED : MASTER, ctx.currentTime, tc);
  }
  private applyLevels(m: Mood, at: number, first: boolean): void {
    const g = this.g!;
    const s = SPECS[m];
    const tc = first ? 0.01 : 0.9;
    g.pad.gain.setTargetAtTime(s.level.pad * PAD_GAIN, at, tc);
    g.drums.gain.setTargetAtTime(s.level.drums * DRUM_GAIN, at, first ? 0.01 : 0.4);
    g.lead.gain.setTargetAtTime(s.level.lead * LEAD_GAIN, at, first ? 0.01 : 0.6);
    g.wind.gain.setTargetAtTime(s.level.wind * WIND_GAIN, at, first ? 0.01 : 1.4);
    g.voices.forEach((v, i) => {
      const f = s.pad[i];
      if (f !== undefined) { v.last = f; v.oscs.forEach((o) => o.frequency.setTargetAtTime(f, at, first ? 0.01 : 0.8)); }
      v.gain.gain.setTargetAtTime(f !== undefined ? v.base : 0, at, first ? 0.01 : 0.8);
    });
  }

  // ---- graph -----------------------------------------------------------------------------------
  private build(ctx: AudioContext): Graph {
    const sr = ctx.sampleRate;
    const r = rng(11);
    const gain = (v: number): GainNode => { const n = ctx.createGain(); n.gain.value = v; return n; };

    const master = gain(0);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 3.5; comp.attack.value = 0.012; comp.release.value = 0.28;
    master.connect(comp); comp.connect(ctx.destination);

    // a small synthetic hall
    const len = Math.floor(sr * 2.6);
    const ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let prev = 0;
      for (let i = 0; i < len; i++) { const x = (r() * 2 - 1) * Math.pow(1 - i / len, 3.1); prev = prev * 0.45 + x * 0.55; d[i] = prev; }
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    const verbOut = gain(0.55);
    verb.connect(verbOut); verbOut.connect(master);
    const bus = (level: number, send: number): GainNode => { const b = gain(level); b.connect(master); const s = gain(send); b.connect(s); s.connect(verb); return b; };
    const pad = bus(0, 0.5);
    const drums = bus(0, 0.16);
    const lead = bus(0, 0.45);
    const wind = bus(0, 0.2);
    const fx = bus(FX_GAIN, 0.6);

    const noise = ctx.createBuffer(1, sr * 2, sr);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;

    // pad: four voices through one slowly breathing low-pass
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass'; padFilter.frequency.value = 540; padFilter.Q.value = 0.4;
    padFilter.connect(pad);
    const breathe = ctx.createOscillator(); breathe.frequency.value = 0.06;
    const breatheAmt = gain(170);
    breathe.connect(breatheAmt); breatheAmt.connect(padFilter.frequency); breathe.start();
    const voices = [0, 1, 2, 3].map((i) => {
      const vg = gain(0);
      vg.connect(padFilter);
      const oscs = [-5, 5].map((cents) => {
        const o = ctx.createOscillator();
        o.type = i === 3 ? 'triangle' : 'sawtooth';
        o.frequency.value = 110; o.detune.value = cents;
        o.connect(vg); o.start();
        return o;
      });
      return { oscs, gain: vg, base: i === 3 ? 0.35 : 0.3, last: 110 };
    });

    // wind: looped noise through a wandering band-pass
    const ws = ctx.createBufferSource();
    ws.buffer = noise; ws.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 520; wf.Q.value = 0.6;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.13;
    const wla = gain(260);
    wl.connect(wla); wla.connect(wf.frequency);
    ws.connect(wf); wf.connect(wind); ws.start(); wl.start();

    return { master, pad, drums, lead, wind, fx, noise, voices };
  }

  // ---- sequencer -------------------------------------------------------------------------------
  private moodAt(t: number): Mood {
    for (let i = this.moods.length - 1; i >= 0; i--) if (this.moods[i]!.at <= t) return this.moods[i]!.mood;
    return this.moods[0]?.mood ?? this.pending;
  }
  /** Schedules everything up to `horizon` (seconds on the context's clock). Called by a timer; tests call it with a far horizon. */
  pump(horizon?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.g) return;
    const until = horizon ?? ctx.currentTime + LOOKAHEAD;
    let guard = 0;
    while (this.stepAt < until && guard++ < 4000) {
      const m = this.moodAt(this.stepAt);
      if (m !== this.cur) { this.cur = m; this.stepNo = 0; }
      const spec = SPECS[m];
      this.step(spec, m, this.stepAt, this.stepNo);
      this.stepNo++;
      this.stepAt += 60 / spec.tempo / 4;
    }
    guard = 0;
    while (this.leadAt < until && guard++ < 400) this.leadStep();
  }
  private step(spec: Spec, m: Mood, t: number, n: number): void {
    const idx = n % 16;
    const c = spec.drums[idx];
    const jitter = () => (this.rand() - 0.5) * 0.012;
    if (c === 'X') this.drum(t + jitter(), spec.level.drums, m === 'title' ? 'boom' : 'low');
    else if (c === 'x') this.drum(t + jitter(), spec.level.drums, 'mid');
    else if (c === 'r') this.rim(t + jitter(), 0.7);
    const bar = Math.floor(n / 16);
    if (idx === 0 && spec.bell && this.rand() < spec.bell) this.bell(t + 0.03);
    if (idx === 0 && spec.horn && bar % 2 === 0 && n > 0 && this.rand() < spec.horn) this.horn(t);
    if (spec.clash && idx % 4 === 0 && this.rand() < spec.clash * 0.45) this.clash(t + 0.02 + this.rand() * 0.05);
  }
  private leadStep(): void {
    const spec = SPECS[this.moodAt(this.leadAt)];
    if (!spec.lead) { this.leadAt += 0.4; this.leadQueue = []; return; }
    if (this.leadQueue.length === 0) {
      const ph = spec.lead[Math.floor(this.rand() * spec.lead.length)]!;
      this.leadQueue = [...ph];
    }
    const [note, beats] = this.leadQueue.shift()!;
    const beat = 60 / spec.tempo;
    this.note(this.leadAt, SCALE[note]!, beats * beat);
    this.leadAt += beats * beat;
    if (this.leadQueue.length === 0) this.leadAt += (spec.leadRest ?? 2) * 4 * beat * (0.8 + this.rand() * 0.5);
  }

  // ---- voices of the orchestra -------------------------------------------------------------------
  private env(node: GainNode, t: number, peak: number, attack: number, end: number): void {
    node.gain.setValueAtTime(FLOOR, t);
    node.gain.exponentialRampToValueAtTime(Math.max(FLOOR * 2, peak), t + attack);
    node.gain.exponentialRampToValueAtTime(FLOOR, t + end);
  }
  private noiseBurst(t: number, dest: AudioNode, o: { type: BiquadFilterType; freq: number; q?: number; level: number; dur: number; hp?: number }): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.g!.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.type; f.frequency.value = o.freq; f.Q.value = o.q ?? 1;
    const e = ctx.createGain();
    this.env(e, t, o.level, 0.003, o.dur);
    s.connect(f);
    let tail: AudioNode = f;
    if (o.hp) { const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = o.hp; f.connect(h); tail = h; }
    tail.connect(e); e.connect(dest);
    s.start(t, this.rand() * 1.5);
    s.stop(t + o.dur + 0.05);
  }
  private drum(t: number, level: number, kind: 'boom' | 'low' | 'mid'): void {
    const ctx = this.ctx!; const g = this.g!;
    const [f0, f1, dec, peak] = kind === 'boom' ? [105, 36, 1.6, 1] : kind === 'low' ? [150, 52, 0.6, 0.9] : [205, 92, 0.32, 0.6];
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.17);
    const e = ctx.createGain();
    this.env(e, t, peak * (0.5 + 0.5 * level), 0.004, dec);
    o.connect(e); e.connect(g.drums);
    o.start(t); o.stop(t + dec + 0.05);
    this.noiseBurst(t, g.drums, { type: 'bandpass', freq: 650, q: 0.9, level: 0.3 * peak, dur: 0.06 });
  }
  private rim(t: number, level: number): void { this.noiseBurst(t, this.g!.drums, { type: 'bandpass', freq: 3000, q: 1.2, level: 0.16 * level, dur: 0.08, hp: 1500 }); }
  private clash(t: number): void {
    const ctx = this.ctx!; const g = this.g!;
    this.noiseBurst(t, g.fx, { type: 'highpass', freq: 2200, level: 0.1, dur: 0.28 });
    [1250, 1870, 2630].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f * (1 + (this.rand() - 0.5) * 0.08);
      const e = ctx.createGain();
      this.env(e, t, 0.03, 0.002, 0.24);
      o.connect(e); e.connect(g.fx);
      o.start(t); o.stop(t + 0.3);
    });
  }
  private bell(t: number): void {
    const ctx = this.ctx!; const g = this.g!;
    ([[1, 1, 4.4], [2, 0.55, 3.2], [2.76, 0.4, 2.3], [5.4, 0.18, 1.3], [8.93, 0.09, 0.8]] as const).forEach(([ratio, amp, dec]) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = 293.66 * ratio;
      const e = ctx.createGain();
      this.env(e, t, 0.11 * amp, 0.006, dec);
      o.connect(e); e.connect(g.fx);
      o.start(t); o.stop(t + dec + 0.1);
    });
  }
  private horn(t: number): void {
    const ctx = this.ctx!; const g = this.g!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(240, t);
    f.frequency.exponentialRampToValueAtTime(1000, t + 1.5);
    f.frequency.exponentialRampToValueAtTime(260, t + 3.4);
    const e = ctx.createGain();
    this.env(e, t, 0.17, 1.2, 3.6);
    f.connect(e); e.connect(g.fx);
    ([73.42, 73.42 * 1.004, 110.0] as const).forEach((hz, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz;
      const og = ctx.createGain(); og.gain.value = i === 2 ? 0.45 : 1;
      o.connect(og); og.connect(f);
      o.start(t); o.stop(t + 3.7);
    });
  }
  /** One note of the ney-like lead: a soft triangle with a late vibrato and a little breath. */
  private note(t: number, hz: number, dur: number): void {
    const ctx = this.ctx!; const g = this.g!;
    const len = dur + 0.5;
    const out = ctx.createGain();
    out.gain.setValueAtTime(FLOOR, t);
    out.gain.exponentialRampToValueAtTime(1, t + 0.16);
    out.gain.setValueAtTime(1, t + Math.max(0.2, dur - 0.1));
    out.gain.exponentialRampToValueAtTime(FLOOR, t + len);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    lp.connect(out); out.connect(g.lead);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.3;
    const vibAmt = ctx.createGain();
    vibAmt.gain.setValueAtTime(0, t);
    vibAmt.gain.linearRampToValueAtTime(7, t + Math.min(1.2, dur * 0.7)); // the vibrato blooms
    vib.connect(vibAmt);
    ([[hz, 'triangle', 1], [hz * 2, 'sine', 0.2]] as const).forEach(([f, type, amp]) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      vibAmt.connect(o.detune);
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(lp);
      o.start(t); o.stop(t + len + 0.05);
    });
    vib.start(t); vib.stop(t + len + 0.05);
    const breath = ctx.createBufferSource();
    breath.buffer = g.noise;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass'; bf.frequency.value = Math.min(4200, hz * 5); bf.Q.value = 1.6;
    const bg = ctx.createGain(); bg.gain.value = 0.05;
    breath.connect(bf); bf.connect(bg); bg.connect(lp);
    breath.start(t, this.rand() * 1.5); breath.stop(t + len + 0.05);
  }
}
