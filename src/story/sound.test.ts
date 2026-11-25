import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundBed, moodFor } from './sound';

// A stand-in for the Web Audio API: every node accepts what the synth does to it, and we count what gets started.
const param = () => ({ value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
class FakeNode {
  connect = vi.fn(); start = vi.fn(); stop = vi.fn();
  gain = param(); frequency = param(); detune = param(); Q = param(); threshold = param(); knee = param(); ratio = param(); attack = param(); release = param();
  type = ''; buffer: unknown = null; loop = false;
}
class FakeCtx {
  currentTime = 0; sampleRate = 8000; state: 'running' | 'suspended' | 'closed' = 'running'; destination = {}; onstatechange: (() => void) | null = null;
  nodes: FakeNode[] = [];
  private node = () => { const n = new FakeNode(); this.nodes.push(n); return n; };
  createGain = this.node; createOscillator = this.node; createBufferSource = this.node; createBiquadFilter = this.node; createConvolver = this.node; createDynamicsCompressor = this.node;
  createBuffer = (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) });
  holdBack = false; // pretend the browser is waiting for a tap
  resume = vi.fn(async () => { if (this.holdBack) return; this.state = 'running'; this.onstatechange?.(); });
  suspend = vi.fn(async () => { this.state = 'suspended'; this.onstatechange?.(); });
  close = vi.fn(async () => { this.state = 'closed'; });
  started = () => this.nodes.reduce((n, x) => n + x.start.mock.calls.length, 0);
}
const make = () => { const ctx = new FakeCtx(); const bed = new SoundBed(() => ctx as unknown as AudioContext); return { ctx, bed }; };

describe('mood of a shot', () => {
  it('maps the storyboard to moods', () => {
    expect(moodFor(-1, 7, null)).toBe('title');
    expect(moodFor(7, 7, null)).toBe('question');
    expect(moodFor(1, 7, { visual: 'battle' })).toBe('battle');
    expect(moodFor(2, 7, { visual: 'samarkand' })).toBe('gathering');
    expect(moodFor(3, 7, { visual: 'winter' })).toBe('wind');
    expect(moodFor(4, 7, { visual: 'otrar' })).toBe('sorrow');
    expect(moodFor(5, 7, { visual: 'dawn' })).toBe('dawn');
    expect(moodFor(6, 7, { visual: 'ruins', note: true })).toBe('ruins');
    expect(moodFor(0, 5, { visual: 'art' })).toBe('majestic');
    expect(moodFor(1, 5, { visual: 'art' })).toBe('gathering');
  });
});

describe('soundtrack', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('builds the sound, plays something and does not run away', () => {
    const { ctx, bed } = make();
    expect(bed.getState()).toBe('idle');
    bed.setMood('majestic');
    bed.start();
    expect(bed.getState()).toBe('running');
    const before = ctx.started();
    expect(before).toBeGreaterThan(8); // pad voices, wind, lfos
    bed.pump(30);
    const after = ctx.started();
    expect(after).toBeGreaterThan(before + 10); // drums and phrases were scheduled
    expect(after).toBeLessThan(2500);
    bed.pump(30); // nothing more to schedule up to the same horizon
    expect(ctx.started()).toBe(after);
    bed.dispose();
  });

  it('battle is busier than the ruins', () => {
    const count = (mood: 'battle' | 'ruins') => { const { ctx, bed } = make(); bed.setMood(mood); bed.start(); const b = ctx.started(); bed.pump(40); const n = ctx.started() - b; bed.dispose(); return n; };
    expect(count('battle')).toBeGreaterThan(count('ruins') * 3);
  });

  it('follows mood changes on its timeline', () => {
    const { ctx, bed } = make();
    bed.setMood('ruins');
    bed.start();
    bed.setMood('battle', 10);
    const b = ctx.started();
    bed.pump(9.9);
    const quiet = ctx.started() - b;
    bed.pump(20);
    const busy = ctx.started() - b - quiet;
    expect(busy).toBeGreaterThan(quiet);
    bed.dispose();
  });

  it('reports "blocked" while the browser holds the sound back, and lets it through on unlock', () => {
    const { ctx, bed } = make();
    ctx.state = 'suspended'; ctx.holdBack = true;
    const seen: string[] = [];
    bed.subscribe(() => seen.push(bed.getState()));
    bed.start();
    expect(bed.getState()).toBe('running'); // a context made right after a tap needs a moment
    vi.advanceTimersByTime(900);
    expect(bed.getState()).toBe('blocked');
    ctx.holdBack = false;
    bed.unlock();
    return Promise.resolve().then(() => { expect(bed.getState()).toBe('running'); expect(seen).toContain('blocked'); bed.dispose(); });
  });

  it('a pause is not "blocked"; resume carries on', () => {
    const { ctx, bed } = make();
    bed.start();
    bed.pause();
    expect(ctx.suspend).toHaveBeenCalled();
    ctx.state = 'suspended';
    ctx.onstatechange?.();
    expect(bed.getState()).toBe('running');
    bed.resume();
    expect(ctx.resume).toHaveBeenCalled();
    bed.dispose();
  });

  it('mute silences it and the narrator ducks it', () => {
    const { ctx, bed } = make();
    bed.start();
    const master = ctx.nodes.find((n) => n.gain.setTargetAtTime.mock.calls.length > 0 && n.connect.mock.calls.length > 0)!;
    const last = () => { const c = master.gain.setTargetAtTime.mock.calls; return c[c.length - 1]![0] as number; };
    bed.setDuck(true);
    const ducked = last();
    bed.setDuck(false);
    const full = last();
    expect(ducked).toBeLessThan(full);
    bed.setMuted(true);
    expect(last()).toBe(0);
    bed.dispose();
  });

  it('frees the context after a fade and can be started again', () => {
    const { ctx, bed } = make();
    bed.start();
    bed.dispose();
    expect(bed.getState()).toBe('idle');
    expect(ctx.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(ctx.close).toHaveBeenCalledTimes(1);
    bed.start();
    expect(bed.getState()).toBe('running');
    bed.dispose();
  });

  it('is "unsupported" when there is no Web Audio', () => {
    const bed = new SoundBed(() => { throw new Error('no audio'); });
    bed.start();
    expect(bed.getState()).toBe('unsupported');
    bed.setMood('battle'); bed.pause(); bed.resume(); bed.unlock(); bed.dispose(); // all harmless
    expect(bed.getState()).toBe('unsupported');
  });
});
