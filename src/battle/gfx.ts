// Small graphics helpers shared by the battle renderer and the scenery painter.
import { shade as shadeRaw } from './sim';

export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export function cnv(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')!];
}
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mixCache = new Map<string, string>();
export function mix(a: string, b: string, t: number): string {
  const key = a + b + t; const hit = mixCache.get(key); if (hit) return hit;
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  const ch = (s: number) => Math.round((((pa >> s) & 255) * (1 - t)) + (((pb >> s) & 255) * t));
  const r = `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
  mixCache.set(key, r); return r;
}
const shadeCache = new Map<string, string>();
export function shade(c: string, f: number): string { const k = c + f; let v = shadeCache.get(k); if (!v) { v = shadeRaw(c, f); shadeCache.set(k, v); } return v; }
const hexCache = new Map<string, [number, number, number]>();
export function hexA(hex: string, a: number): string {
  let c = hexCache.get(hex);
  if (!c) { const n = parseInt(hex.slice(1, 7), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; hexCache.set(hex, c); }
  return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1).toFixed(3)})`;
}

/** Seeded 1D/2D value noise with fractal octaves (used only while painting cached scenery). */
export function makeNoise(seed: number) {
  const r = prng(seed);
  const P = new Float32Array(512); for (let i = 0; i < 512; i++) P[i] = r();
  const sm = (t: number) => t * t * (3 - 2 * t);
  const n1 = (x: number) => { const i = Math.floor(x); const f = x - i; return P[i & 511] * (1 - sm(f)) + P[(i + 1) & 511] * sm(f); };
  const h2 = (x: number, y: number) => P[(x + Math.floor(P[y & 511] * 511)) & 511];
  const n2 = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  };
  return {
    fbm1(x: number, oct = 5): number { let v = 0, amp = 0.5, f = 1; for (let o = 0; o < oct; o++) { v += n1(x * f) * amp; f *= 2.03; amp *= 0.5; } return v; },
    fbm2(x: number, y: number, oct = 4): number { let v = 0, amp = 0.5, f = 1; for (let o = 0; o < oct; o++) { v += n2(x * f, y * f) * amp; f *= 2.01; amp *= 0.5; } return v; },
    n2,
  };
}
