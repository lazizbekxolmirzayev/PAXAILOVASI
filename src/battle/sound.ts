// Procedural battle audio (WebAudio, no assets): steel, bows, black powder, modern arms, explosions, horns and drums.
import { useSettings } from '../services/settings';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let ambience: { stop: () => void } | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      master = ctx.createGain(); master.connect(ctx.destination);
      const len = ctx.sampleRate * 2; noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    master!.gain.value = useSettings.getState().sfxVolume * 0.55;
    return ctx;
  } catch { return null; }
}

function burst(c: AudioContext, t: number, dur: number, gain: number, type: BiquadFilterType, freq: number, q = 1, freqEnd?: number, pan = 0) {
  const src = c.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  src.connect(f).connect(g).connect(p).connect(master!);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function tone(c: AudioContext, t: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType, pan = 0) {
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  o.connect(g).connect(p).connect(master!); o.start(t); o.stop(t + dur + 0.05);
}

export type BSound = 'swing' | 'clang' | 'hit' | 'bow' | 'xbow' | 'sling' | 'throw' | 'arrowhit' | 'blackpowder' | 'pistol' | 'rifle' | 'smg' | 'mg'
  | 'cannon' | 'explosion' | 'whistle' | 'horn' | 'reload' | 'empty' | 'hurt' | 'gallop' | 'shout' | 'block' | 'step'
  | 'parry' | 'kick' | 'whoosh' | 'cheer' | 'fanfare' | 'dirge' | 'plane' | 'heart';

const lastPlayed: Record<string, number> = {};
/** `vol` 0..1 attenuates distant sounds; `pan` -1..1 places them in the stereo field. */
export function bsfx(kind: BSound, vol = 1, pan = 0): void {
  const c = ac(); if (!c || vol < 0.03) return;
  const nowMs = performance.now();
  const minGap = kind === 'smg' || kind === 'mg' ? 30 : kind === 'step' || kind === 'gallop' ? 90 : 18;
  if (nowMs - (lastPlayed[kind] ?? 0) < minGap) return;
  lastPlayed[kind] = nowMs;
  const t = c.currentTime; const v = vol;
  switch (kind) {
    case 'swing': burst(c, t, 0.18, 0.35 * v, 'bandpass', 1800, 2, 500, pan); break;
    case 'clang': tone(c, t, 1900 + Math.random() * 600, 1500, 0.35, 0.18 * v, 'triangle', pan); tone(c, t, 3100, 2600, 0.2, 0.08 * v, 'sine', pan); burst(c, t, 0.05, 0.3 * v, 'highpass', 3000, 1, undefined, pan); break;
    case 'block': tone(c, t, 420, 300, 0.12, 0.3 * v, 'square', pan); burst(c, t, 0.08, 0.3 * v, 'lowpass', 900, 1, undefined, pan); break;
    case 'hit': burst(c, t, 0.12, 0.45 * v, 'lowpass', 700, 1, 200, pan); tone(c, t, 140, 60, 0.12, 0.25 * v, 'sine', pan); break;
    case 'hurt': tone(c, t, 240 + Math.random() * 60, 150, 0.22, 0.12 * v, 'sawtooth', pan); break;
    case 'shout': tone(c, t, 180, 140, 0.5, 0.06 * v, 'sawtooth', pan); tone(c, t, 270, 210, 0.5, 0.04 * v, 'sawtooth', pan); break;
    case 'bow': burst(c, t, 0.12, 0.3 * v, 'bandpass', 900, 3, 300, pan); tone(c, t, 180, 90, 0.18, 0.18 * v, 'triangle', pan); break;
    case 'xbow': tone(c, t, 120, 60, 0.12, 0.35 * v, 'square', pan); burst(c, t, 0.1, 0.35 * v, 'bandpass', 1200, 2, 400, pan); break;
    case 'sling': burst(c, t, 0.25, 0.25 * v, 'bandpass', 600, 4, 1400, pan); break;
    case 'throw': burst(c, t, 0.3, 0.3 * v, 'bandpass', 500, 2, 1600, pan); break;
    case 'arrowhit': burst(c, t, 0.06, 0.3 * v, 'bandpass', 2500, 2, undefined, pan); tone(c, t, 300, 120, 0.08, 0.15 * v, 'triangle', pan); break;
    case 'blackpowder': burst(c, t, 0.9, 0.9 * v, 'lowpass', 2400, 0.7, 180, pan); tone(c, t, 90, 35, 0.5, 0.5 * v, 'sine', pan); break;
    case 'pistol': burst(c, t, 0.25, 0.7 * v, 'lowpass', 4000, 0.8, 400, pan); tone(c, t, 160, 50, 0.15, 0.4 * v, 'sine', pan); break;
    case 'rifle': burst(c, t, 0.6, 0.9 * v, 'lowpass', 5000, 0.7, 250, pan); tone(c, t, 120, 40, 0.3, 0.55 * v, 'sine', pan); burst(c, t + 0.05, 0.5, 0.2 * v, 'bandpass', 600, 1, 200, pan); break;
    case 'smg': burst(c, t, 0.13, 0.55 * v, 'lowpass', 3500, 0.8, 500, pan); tone(c, t, 140, 60, 0.08, 0.3 * v, 'sine', pan); break;
    case 'mg': burst(c, t, 0.15, 0.6 * v, 'lowpass', 3000, 0.8, 400, pan); tone(c, t, 110, 50, 0.09, 0.35 * v, 'sine', pan); break;
    case 'cannon': burst(c, t, 1.6, 1.0 * v, 'lowpass', 1200, 0.7, 60, pan); tone(c, t, 70, 25, 0.9, 0.9 * v, 'sine', pan); break;
    case 'explosion': burst(c, t, 1.8, 1.0 * v, 'lowpass', 1600, 0.6, 50, pan); tone(c, t, 60, 20, 1.2, 1.0 * v, 'sine', pan); burst(c, t + 0.05, 0.4, 0.4 * v, 'highpass', 2000, 0.5, undefined, pan); break;
    case 'whistle': tone(c, t, 1400, 500, 1.1, 0.07 * v, 'sine', pan); break;
    case 'horn': { const g = 0.16 * v; tone(c, t, 147, 147, 1.6, g, 'sawtooth', pan); tone(c, t + 0.4, 196, 196, 1.4, g * 0.9, 'sawtooth', pan); tone(c, t + 0.4, 98, 98, 1.6, g * 0.6, 'sawtooth', pan); break; }
    case 'reload': tone(c, t, 1200, 900, 0.05, 0.15 * v, 'square', pan); tone(c, t + 0.15, 900, 700, 0.06, 0.15 * v, 'square', pan); break;
    case 'empty': tone(c, t, 2000, 1800, 0.03, 0.1 * v, 'square', pan); break;
    case 'gallop': burst(c, t, 0.06, 0.25 * v, 'lowpass', 400, 1, undefined, pan); burst(c, t + 0.09, 0.06, 0.2 * v, 'lowpass', 380, 1, undefined, pan); break;
    case 'step': burst(c, t, 0.05, 0.06 * v, 'lowpass', 500, 1, undefined, pan); break;
    case 'parry': tone(c, t, 2600, 2200, 0.6, 0.22 * v, 'triangle', pan); tone(c, t, 3900, 3300, 0.5, 0.12 * v, 'sine', pan); tone(c, t, 1300, 1100, 0.7, 0.12 * v, 'triangle', pan); burst(c, t, 0.08, 0.5 * v, 'highpass', 2500, 1, undefined, pan); break;
    case 'kick': burst(c, t, 0.1, 0.6 * v, 'lowpass', 500, 1, 120, pan); tone(c, t, 110, 50, 0.15, 0.5 * v, 'sine', pan); break;
    case 'whoosh': burst(c, t, 0.32, 0.4 * v, 'bandpass', 400, 1.5, 2200, pan); break;
    case 'cheer': for (let i = 0; i < 7; i++) { const f = 150 + Math.random() * 130; tone(c, t + Math.random() * 0.15, f, f * (0.85 + Math.random() * 0.1), 0.9 + Math.random() * 0.5, 0.035 * v, 'sawtooth', pan + (Math.random() - 0.5) * 0.6); } burst(c, t, 1.0, 0.12 * v, 'bandpass', 900, 0.7, 600, pan); break;
    case 'fanfare': { const g = 0.13 * v; [[0, 262], [0, 330], [0, 392], [0.35, 349], [0.35, 440], [0.7, 392], [0.7, 523], [0.7, 659]].forEach(([d, f]) => tone(c, t + d, f, f, d >= 0.7 ? 1.8 : 0.4, g, 'sawtooth', 0)); break; }
    case 'dirge': { const g = 0.12 * v; [[0, 220], [0, 262], [0.6, 196], [0.6, 233], [1.2, 175], [1.2, 208]].forEach(([d, f]) => tone(c, t + d, f, f * 0.98, 1.4, g, 'sawtooth', 0)); break; }
    case 'plane': tone(c, t, 95, 80, 5, 0.12 * v, 'sawtooth', -0.8); tone(c, t, 190, 150, 5, 0.05 * v, 'sawtooth', -0.6); burst(c, t, 5, 0.12 * v, 'lowpass', 300, 1, 200, 0); break;
    case 'heart': tone(c, t, 70, 45, 0.15, 0.5 * v, 'sine', 0); tone(c, t + 0.2, 65, 42, 0.15, 0.4 * v, 'sine', 0); break;
  }
}

/** Looping battle bed: war drums (pre-modern) or distant artillery rumble (modern). */
export function startAmbience(modern: boolean): void {
  const c = ac(); if (!c) return;
  stopAmbience();
  let alive = true; let beat = 0;
  const bed = c.createBufferSource(); bed.buffer = noise; bed.loop = true;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = modern ? 140 : 260;
  const g = c.createGain(); g.gain.value = (modern ? 0.22 : 0.1) * useSettings.getState().musicVolume;
  bed.connect(f).connect(g).connect(master!); bed.start();
  const id = window.setInterval(() => {
    if (!alive) return;
    const t = c.currentTime + 0.02;
    const vol = useSettings.getState().musicVolume;
    if (!modern) {
      const pat = [1, 0, 0.5, 0, 1, 0.4, 0.6, 0];
      const a = pat[beat % 8];
      if (a) { tone(c, t, 85, 45, 0.45, 0.35 * a * vol, 'sine'); burst(c, t, 0.1, 0.12 * a * vol, 'lowpass', 300); }
      if (beat % 32 === 0) tone(c, t, 110, 110, 3, 0.03 * vol, 'sawtooth');
    } else if (Math.random() < 0.18) {
      burst(c, t, 2.2, 0.25 * vol, 'lowpass', 160, 0.6, 40, Math.random() * 2 - 1);
    }
    beat++;
  }, 260);
  ambience = { stop: () => { alive = false; clearInterval(id); try { bed.stop(); } catch { /* already stopped */ } } };
}
export function stopAmbience(): void { ambience?.stop(); ambience = null; }
