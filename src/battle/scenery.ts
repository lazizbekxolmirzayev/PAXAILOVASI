// Painted battle scenery: sky, volumetric clouds, lit mountain ranges, era & culture architecture,
// detailed vegetation, war camps, textured ground and depth-sorted props. Everything here is
// rendered once per battle into cached canvases, so it can afford far more detail than per-frame art.
import type { BEra, Culture } from './data';
import { GROUND_TOP, VIEW_H, VIEW_W, WORLD_W, type BattleState, type Terrain } from './sim';
import { clamp, cnv, hexA, makeNoise, mix, prng, shade, TAU, type Ctx } from './gfx';

// ------------------------------------------------------------------------------ palette
export interface Pal {
  skyTop: string; skyMid: string; skyLow: string; sun: string; sunY: number; sunX: number; haze: string;
  far: string; mid: string; near: string; ground: string; ground2: string; grass: string; light: string; shadow: string; grade: string; gradeA: number; night: number;
}
export function palette(time: BattleState['cfg']['time'], terrain: Terrain, era: BEra): Pal {
  const T: Record<string, Pick<Pal, 'skyTop' | 'skyMid' | 'skyLow' | 'sun' | 'sunY' | 'sunX' | 'haze' | 'light' | 'shadow' | 'grade' | 'gradeA' | 'night'>> = {
    day: { skyTop: '#2f5f9c', skyMid: '#7eaad3', skyLow: '#e6dcc0', sun: '#fff6d8', sunY: 0.15, sunX: 0.74, haze: '#d6d0bc', light: '#fff1cf', shadow: '#2c3550', grade: '#ffe6b0', gradeA: 0.06, night: 0 },
    dusk: { skyTop: '#1f1a44', skyMid: '#a4404a', skyLow: '#f3ae58', sun: '#ffcf72', sunY: 0.52, sunX: 0.76, haze: '#e08f58', light: '#ffae6a', shadow: '#2a1a3a', grade: '#ff8a3d', gradeA: 0.12, night: 0.25 },
    dawn: { skyTop: '#2c3c66', skyMid: '#c48288', skyLow: '#f6d3a0', sun: '#fff0c8', sunY: 0.45, sunX: 0.7, haze: '#e5c0a4', light: '#ffdcb0', shadow: '#2f3352', grade: '#ffc0a0', gradeA: 0.08, night: 0.12 },
    overcast: { skyTop: '#454b54', skyMid: '#767b82', skyLow: '#adaba3', sun: '#e8e4da', sunY: 0.2, sunX: 0.72, haze: '#98968e', light: '#d8d6d0', shadow: '#30343c', grade: '#6c7a80', gradeA: 0.1, night: 0.05 },
  };
  const G: Record<Terrain, Pick<Pal, 'far' | 'mid' | 'near' | 'ground' | 'ground2' | 'grass'>> = {
    plains: { far: '#7d8fa0', mid: '#5f7457', near: '#3e5236', ground: '#6f7a45', ground2: '#56603a', grass: '#8a9a52' },
    desert: { far: '#b8a18a', mid: '#b48c5c', near: '#9a7146', ground: '#c9a46a', ground2: '#ae8a55', grass: '#a89058' },
    steppe: { far: '#8f97a2', mid: '#8f8655', near: '#6f6a3e', ground: '#a8955a', ground2: '#8c7b47', grass: '#c4b06a' },
    mountain: { far: '#7a8796', mid: '#5f6b6a', near: '#4a5148', ground: '#77735e', ground2: '#5f5c4a', grass: '#8a8e5c' },
    snow: { far: '#a6b6c8', mid: '#8a9aa8', near: '#6c7884', ground: '#dfe6ea', ground2: '#c3ccd2', grass: '#b6c0b0' },
    forest: { far: '#5f7487', mid: '#3e5a40', near: '#2b4029', ground: '#5a6a3a', ground2: '#46552e', grass: '#6f8a42' },
  };
  const p = { ...T[time], ...G[terrain] } as Pal;
  if (era === 'modern') { p.ground = mix(p.ground, '#5a5046', 0.45); p.ground2 = mix(p.ground2, '#3f3730', 0.5); p.haze = mix(p.haze, '#8a8680', 0.4); p.skyLow = mix(p.skyLow, '#a49c90', 0.35); }
  return p;
}

// ------------------------------------------------------------------------------ backdrop
export interface Fire { x: number; y: number; s: number; layer: 'near' | 'mid' }
export type PropKind = 'rock' | 'bush' | 'tuft' | 'stakes' | 'wheel' | 'barrels' | 'shield' | 'sandbags' | 'wire' | 'stump' | 'cactus' | 'spears' | 'helmet' | 'snowdrift';
export interface Prop { x: number; z: number; kind: PropKind; sprite: HTMLCanvasElement; ox: number; oy: number; w: number; h: number }
export interface Backdrop {
  sky: HTMLCanvasElement; far: HTMLCanvasElement; mid: HTMLCanvasElement; near: HTMLCanvasElement; fg: HTMLCanvasElement;
  groundTile: CanvasPattern | null; groundShade: HTMLCanvasElement; grain: HTMLCanvasElement; vignette: HTMLCanvasElement; redEdge: HTMLCanvasElement; dmgEdge: HTMLCanvasElement;
  clouds: { sprite: HTMLCanvasElement; x: number; y: number; s: number; v: number; a: number; layer: number }[];
  fires: Fire[]; props: Prop[]; pal: Pal; birds: { x: number; y: number; v: number; ph: number }[];
}
export const PAR = { far: 0.12, mid: 0.35, near: 0.62, fg: 1.25 };

/** Draws `fn` into an offscreen copy and composites it back blurred (cheap: done once at build). */
function blurInto(dst: Ctx, src: HTMLCanvasElement, px: number) {
  dst.save(); dst.filter = `blur(${px}px)`; dst.drawImage(src, 0, 0); dst.restore();
}

function cloudSprite(rnd: () => number, pal: Pal, w: number, h: number): HTMLCanvasElement {
  const [c, g] = cnv(w, h);
  const puffs: [number, number, number][] = [];
  const n = 26 + Math.floor(rnd() * 16);
  for (let i = 0; i < n; i++) {
    const t = i / n; const x = w * (0.12 + 0.76 * t) + (rnd() - 0.5) * w * 0.12;
    const r = h * (0.16 + 0.22 * Math.sin(Math.PI * t) + rnd() * 0.08);
    puffs.push([x, h * 0.66 - r * 0.45 - rnd() * h * 0.1, r]);
  }
  const base = mix(pal.skyMid, '#ffffff', 0.35), dark = mix(pal.shadow, pal.skyMid, 0.55);
  g.filter = 'blur(3px)';
  for (const [x, y, r] of puffs) { g.fillStyle = hexA(dark, 0.55); g.beginPath(); g.arc(x, y + r * 0.25, r, 0, TAU); g.fill(); }
  for (const [x, y, r] of puffs) { g.fillStyle = hexA(base, 0.8); g.beginPath(); g.arc(x - r * 0.08, y - r * 0.08, r * 0.92, 0, TAU); g.fill(); }
  for (const [x, y, r] of puffs) { g.fillStyle = hexA(pal.light, 0.55); g.beginPath(); g.arc(x + r * 0.22, y - r * 0.3, r * 0.6, 0, TAU); g.fill(); }
  g.filter = 'none';
  // flatten the base so clouds sit on an air layer
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createLinearGradient(0, h * 0.62, 0, h); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade; g.fillRect(0, 0, w, h);
  return c;
}

/** A lit mountain range: column-shaded by slope toward the sun, snow on peaks, mist at the base. */
function range(g: Ctx, w: number, baseY: number, amp: number, freq: number, seed: number, lit: string, dark: string, opts: { snow?: number; mist?: string; rough?: number } = {}) {
  const N = makeNoise(seed);
  const hAt = (x: number) => baseY - (N.fbm1(x * freq, 6) * 1.6 - 0.25) * amp - Math.pow(Math.max(0, N.fbm1(x * freq * 0.37 + 17, 3) - 0.45), 2) * amp * 3 * (opts.rough ?? 1);
  for (let x = 0; x < w; x += 2) {
    const y = hAt(x); const slope = (hAt(x - 8) - hAt(x + 8)) / 16;
    const k = clamp(0.5 - slope * 1.6, 0, 1);
    g.fillStyle = mix(dark, lit, k); g.fillRect(x, y, 2, GROUND_TOP + 40 - y);
    if (opts.snow !== undefined && y < opts.snow) { const depth = Math.min(40, (opts.snow - y) * 0.9 + 6); g.fillStyle = mix('#c7d2de', '#ffffff', k); g.fillRect(x, y, 2, depth * (0.5 + 0.5 * N.fbm1(x * 0.05 + 3, 2))); }
  }
  // strata & erosion streaks
  g.globalAlpha = 0.04; g.strokeStyle = dark; g.lineWidth = 1;
  for (let x = 0; x < w; x += 9) { const y = hAt(x); g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x - 6, y + 40 + N.fbm1(x * 0.1, 2) * 50); g.stroke(); }
  g.globalAlpha = 1;
  if (opts.mist) { const m = g.createLinearGradient(0, baseY - amp * 0.4, 0, GROUND_TOP + 30); m.addColorStop(0, hexA(opts.mist, 0)); m.addColorStop(1, hexA(opts.mist, 0.75)); g.fillStyle = m; g.fillRect(0, baseY - amp * 0.4, w, GROUND_TOP + 30 - baseY + amp * 0.4); }
}

// ----- architecture (lit faces, openings, tiles)
interface ArchStyle { lit: string; dark: string; tile: string; gold: string; window: string }
function box(g: Ctx, x: number, y: number, w: number, h: number, st: ArchStyle, depth = 8) {
  g.fillStyle = st.dark; g.fillRect(x, y - h, w, h);
  g.fillStyle = st.lit; g.fillRect(x + w - depth, y - h, depth, h); // sunlit side
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let yy = y - h + 6; yy < y; yy += 7) g.fillRect(x, yy, w - depth, 1); // masonry courses
}
function windows(g: Ctx, x: number, y: number, w: number, h: number, st: ArchStyle, n: number, arched = true) {
  g.fillStyle = st.window;
  for (let i = 0; i < n; i++) {
    const wx = x + (w / (n + 1)) * (i + 1) - 2.5, wy = y - h * 0.72;
    g.fillRect(wx, wy, 5, 9);
    if (arched) { g.beginPath(); g.arc(wx + 2.5, wy, 2.5, Math.PI, 0); g.fill(); }
  }
}
function dome(g: Ctx, x: number, y: number, r: number, st: ArchStyle, tiled: boolean) {
  g.fillStyle = tiled ? st.tile : st.dark;
  g.beginPath(); g.moveTo(x - r, y); g.bezierCurveTo(x - r, y - r * 1.25, x - r * 0.2, y - r * 1.45, x, y - r * 1.62); g.bezierCurveTo(x + r * 0.2, y - r * 1.45, x + r, y - r * 1.25, x + r, y); g.closePath(); g.fill();
  g.save(); g.clip();
  // lit half and ribs
  g.fillStyle = tiled ? mix(st.tile, '#ffffff', 0.25) : st.lit; g.fillRect(x + r * 0.1, y - r * 1.7, r, r * 1.7);
  if (tiled) {
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 0.8;
    for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(x + (i / 4.4) * r, y); g.quadraticCurveTo(x + (i / 8) * r, y - r * 1.2, x, y - r * 1.6); g.stroke(); }
    g.fillStyle = 'rgba(10,40,70,0.25)'; for (let yy = y - 6; yy > y - r * 1.5; yy -= 6) for (let xx = x - r; xx < x + r; xx += 6) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 3, yy - 3); g.lineTo(xx + 6, yy); g.lineTo(xx + 3, yy + 3); g.fill(); }
  }
  g.restore();
  g.fillStyle = st.dark; g.fillRect(x - r * 1.06, y, r * 2.12, r * 0.38); // drum
  g.fillStyle = st.tile; g.fillRect(x - r * 1.06, y + r * 0.08, r * 2.12, 2.5);
  g.fillStyle = st.gold; g.fillRect(x - 0.8, y - r * 2, 1.6, r * 0.42); g.beginPath(); g.arc(x, y - r * 1.68, 2, 0, TAU); g.fill();
}
function minaret(g: Ctx, x: number, y: number, h: number, w: number, st: ArchStyle) {
  g.fillStyle = st.dark; g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = st.lit; g.fillRect(x + w * 0.1, y - h, w * 0.4, h);
  g.fillStyle = st.tile; for (let k = 0.2; k < 0.9; k += 0.11) g.fillRect(x - w / 2, y - h * k, w, 2.5);
  g.fillStyle = 'rgba(0,0,0,0.2)'; for (let k = 0.22; k < 0.9; k += 0.06) { g.fillRect(x - w / 2 + 1, y - h * k, 1, 3); }
  g.fillStyle = st.dark; g.fillRect(x - w * 0.85, y - h * 0.8, w * 1.7, 4); // balcony
  g.fillStyle = st.tile; g.beginPath(); g.moveTo(x - w * 0.6, y - h); g.lineTo(x, y - h - w * 2.4); g.lineTo(x + w * 0.6, y - h); g.fill();
  g.fillStyle = st.gold; g.fillRect(x - 0.6, y - h - w * 2.9, 1.2, w * 0.6);
}
function tower(g: Ctx, x: number, y: number, h: number, w: number, st: ArchStyle, roof: 'crenel' | 'cone') {
  box(g, x - w / 2, y, w, h, st, w * 0.35);
  windows(g, x - w / 2, y, w, h, st, 1);
  if (roof === 'crenel') { g.fillStyle = st.dark; for (let k = 0; k < 4; k++) g.fillRect(x - w / 2 + k * (w / 3.5), y - h - 6, w / 6, 6); }
  else { g.fillStyle = shade(st.tile, 0.8); g.beginPath(); g.moveTo(x - w * 0.62, y - h); g.lineTo(x, y - h - w * 1.6); g.lineTo(x + w * 0.62, y - h); g.fill(); g.fillStyle = st.tile; g.beginPath(); g.moveTo(x, y - h - w * 1.6); g.lineTo(x + w * 0.62, y - h); g.lineTo(x + w * 0.1, y - h); g.fill(); }
}
function pagoda(g: Ctx, x: number, y: number, tiers: number, w0: number, st: ArchStyle) {
  for (let k = 0; k < tiers; k++) {
    const w = w0 - k * (w0 / (tiers + 1.5)), yy = y - k * 28;
    box(g, x - w / 2 + 8, yy, w - 16, 20, st, 6);
    windows(g, x - w / 2 + 8, yy, w - 16, 20, { ...st, window: 'rgba(255,190,110,0.45)' }, Math.max(1, Math.floor(w / 26)), false);
    g.fillStyle = st.tile; g.beginPath(); g.moveTo(x - w / 2 - 14, yy - 16); g.quadraticCurveTo(x - w / 4, yy - 22, x, yy - 30); g.quadraticCurveTo(x + w / 4, yy - 22, x + w / 2 + 14, yy - 16); g.lineTo(x + w / 2 - 2, yy - 22); g.lineTo(x - w / 2 + 2, yy - 22); g.fill();
    g.fillStyle = shade(st.tile, 1.3); g.fillRect(x, yy - 28, w / 2, 3);
  }
  g.fillStyle = st.gold; g.fillRect(x - 1, y - tiers * 28 - 18, 2, 16);
}

function landmarks(g: Ctx, w: number, base: number, era: BEra, culture: Culture, st: ArchStyle, rnd: () => number, count: number, fires: Fire[] | null, layer: Fire['layer']) {
  for (let i = 0; i < count; i++) {
    const x = w * ((i + 0.5) / count) + (rnd() - 0.5) * (w / count) * 0.5;
    const y = base + 6;
    if (era === 'modern') {
      for (let b = 0; b < 8; b++) {
        const bw = 30 + rnd() * 44, bh = 50 + rnd() * 100, bx = x - 150 + b * 40;
        box(g, bx, y, bw, bh, st, 8);
        g.fillStyle = 'rgba(10,10,12,0.55)'; for (let r = 0; r < bh / 14 - 1; r++) for (let c = 0; c < bw / 10 - 1; c++) if (rnd() < 0.7) g.fillRect(bx + 4 + c * 10, y - bh + 6 + r * 14, 5, 7);
        if (rnd() < 0.55) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(bx + bw * 0.2, y - bh - 2); g.lineTo(bx + bw + 2, y - bh - 2); g.lineTo(bx + bw + 2, y - bh * (0.4 + rnd() * 0.4)); g.lineTo(bx + bw * 0.55, y - bh * 0.75); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over'; }
        if (fires && rnd() < 0.3) fires.push({ x: bx + bw / 2, y: y - bh * 0.5, s: 0.8 + rnd(), layer });
      }
      continue;
    }
    if (era === 'industrial') {
      if (i % 2 === 0) {
        for (let k = 0; k < 5; k++) { const bx = x - 110 + k * 44; box(g, bx, y, 36, 28, st, 8); g.fillStyle = st.tile; g.beginPath(); g.moveTo(bx - 4, y - 28); g.lineTo(bx + 18, y - 46); g.lineTo(bx + 40, y - 28); g.fill(); g.fillStyle = 'rgba(255,200,120,0.35)'; g.fillRect(bx + 8, y - 20, 5, 7); }
        tower(g, x + 140, y, 64, 22, st, 'cone');
        g.save(); g.translate(x - 160, y - 64); g.rotate(rnd()); g.fillStyle = st.dark; for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.fillRect(-2, 0, 4, 44); g.fillStyle = st.lit; g.fillRect(2, 8, 9, 32); g.fillStyle = st.dark; } g.restore();
        g.fillStyle = st.dark; g.beginPath(); g.moveTo(x - 176, y); g.lineTo(x - 168, y - 64); g.lineTo(x - 152, y - 64); g.lineTo(x - 144, y); g.fill();
      } else {
        box(g, x - 80, y, 160, 56, st, 14); windows(g, x - 80, y, 160, 56, { ...st, window: 'rgba(255,190,110,0.4)' }, 8, false);
        for (const cx of [-60, -20, 30]) { box(g, x + cx, y - 56, 12, 90 + rnd() * 40, st, 5); }
      }
      continue;
    }
    if (culture === 'islamic' || culture === 'steppe' || culture === 'southasian') {
      if (era === 'ancient' || era === 'classical') { for (let k = 0; k < 4; k++) box(g, x - 90 + k * 22, y - k * 24, 180 - k * 44, 24, st, 14); g.fillStyle = st.gold; g.fillRect(x - 6, y - 118, 12, 14); continue; }
      // Timurid / Persian ensemble: pishtaq portal, ribbed turquoise domes, minarets
      box(g, x - 80, y, 160, 62, st, 18);
      box(g, x - 34, y, 68, 112, st, 14);
      g.fillStyle = st.tile; g.fillRect(x - 34, y - 112, 68, 6); g.fillRect(x - 30, y - 104, 3, 100); g.fillRect(x + 27, y - 104, 3, 100);
      g.fillStyle = shade(st.dark, 0.6); g.beginPath(); g.moveTo(x - 20, y); g.lineTo(x - 20, y - 74); g.quadraticCurveTo(x, y - 98, x + 20, y - 74); g.lineTo(x + 20, y); g.fill();
      g.fillStyle = hexA(st.tile, 0.6); for (let yy = y - 70; yy < y - 4; yy += 8) g.fillRect(x - 16, yy, 32, 2); // muqarnas hint
      windows(g, x - 80, y, 60, 62, st, 3); windows(g, x + 20, y, 60, 62, st, 3);
      dome(g, x + 76, y - 62, 32, st, true);
      dome(g, x - 70, y - 62, 18, st, true);
      minaret(g, x - 100, y, 160, 12, st); minaret(g, x + 128, y, 140, 11, st);
      continue;
    }
    if (culture === 'eastasian') {
      pagoda(g, x, y, era === 'renaissance' ? 4 : 5, 130, st);
      box(g, x - 170, y, 340, 26, st, 10);
      g.fillStyle = st.tile; g.fillRect(x - 176, y - 30, 352, 5);
      continue;
    }
    if (culture === 'american') { for (let k = 0; k < 6; k++) box(g, x - 96 + k * 16, y - k * 20, 192 - k * 32, 20, st, 12); box(g, x - 16, y - 120, 32, 34, st, 10); g.fillStyle = st.window; g.fillRect(x - 6, y - 140, 12, 14); g.fillStyle = mix(st.lit, '#d8a02c', 0.4); g.fillRect(x - 3, y - 118, 6, 118); continue; }
    if (culture === 'african') { for (let k = 0; k < 6; k++) { const hx = x - 125 + k * 50; box(g, hx - 16, y, 32, 24, st, 8); g.fillStyle = shade(st.tile, 0.9); g.beginPath(); g.moveTo(hx - 22, y - 24); g.lineTo(hx, y - 54); g.lineTo(hx + 22, y - 24); g.fill(); g.fillStyle = st.tile; g.beginPath(); g.moveTo(hx, y - 54); g.lineTo(hx + 22, y - 24); g.lineTo(hx + 4, y - 24); g.fill(); } continue; }
    // European / Mediterranean
    if (era === 'ancient' || era === 'classical') {
      box(g, x - 90, y, 180, 16, st, 30);
      for (let k = 0; k < 9; k++) { const cx = x - 82 + k * 20; g.fillStyle = st.dark; g.fillRect(cx, y - 74, 9, 58); g.fillStyle = st.lit; g.fillRect(cx + 5, y - 74, 4, 58); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(cx + 2, y - 74, 1, 58); }
      g.fillStyle = st.dark; g.fillRect(x - 94, y - 82, 188, 9);
      g.beginPath(); g.moveTo(x - 96, y - 82); g.lineTo(x, y - 112); g.lineTo(x + 96, y - 82); g.fill();
      g.fillStyle = st.lit; g.beginPath(); g.moveTo(x, y - 112); g.lineTo(x + 96, y - 82); g.lineTo(x, y - 86); g.fill();
      if (era === 'classical') { for (let k = 0; k < 7; k++) { const ax = x + 130 + k * 34; box(g, ax, y, 9, 76, st, 4); g.fillStyle = st.dark; g.beginPath(); g.arc(ax + 21, y - 58, 13, Math.PI, 0); g.lineTo(ax + 34, y - 76); g.lineTo(ax + 9, y - 76); g.fill(); } g.fillStyle = st.dark; g.fillRect(x + 126, y - 90, 248, 14); }
      continue;
    }
    if (era === 'renaissance' && culture === 'mediterranean') { box(g, x - 80, y, 160, 74, st, 22); windows(g, x - 80, y, 160, 74, st, 6); dome(g, x, y - 74, 48, st, false); continue; }
    // castle with keep, curtain wall and banners
    box(g, x - 100, y, 200, 58, st, 20);
    g.fillStyle = st.dark; for (let k = 0; k < 14; k++) g.fillRect(x - 100 + k * 14.5, y - 64, 8, 6);
    tower(g, x - 104, y, 96 + rnd() * 18, 30, st, rnd() < 0.5 ? 'cone' : 'crenel');
    tower(g, x + 80, y, 92 + rnd() * 18, 30, st, rnd() < 0.5 ? 'cone' : 'crenel');
    tower(g, x - 18, y, 140, 42, st, 'cone');
    g.fillStyle = shade(st.dark, 0.5); g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x - 14, y - 26); g.arc(x, y - 26, 14, Math.PI, 0); g.lineTo(x + 14, y); g.fill();
    if (fires) fires.push({ x: x - 22, y: y - 14, s: 0.6, layer }), fires.push({ x: x + 22, y: y - 14, s: 0.6, layer });
  }
}

// ----- vegetation
function treeSprite(kind: 'round' | 'pine' | 'palm' | 'dead' | 'birch', s: number, lit: string, dark: string, rnd: () => number): HTMLCanvasElement {
  const W = 90 * s, H = 120 * s;
  const [c, g] = cnv(W, H);
  const bx = W / 2, by = H - 2;
  const trunk = kind === 'birch' ? '#d8d4c8' : '#4a3424';
  g.fillStyle = trunk; g.beginPath(); g.moveTo(bx - 3 * s, by); g.lineTo(bx - 1.5 * s, by - 46 * s); g.lineTo(bx + 1.5 * s, by - 46 * s); g.lineTo(bx + 3 * s, by); g.fill();
  if (kind === 'birch') { g.fillStyle = '#222'; for (let k = 0; k < 6; k++) g.fillRect(bx - 1.5 * s, by - (8 + k * 7) * s, 3 * s, 1.2 * s); }
  if (kind === 'pine') {
    for (let k = 0; k < 5; k++) {
      const yy = by - (18 + k * 17) * s, ww = (34 - k * 6) * s;
      g.fillStyle = dark; g.beginPath(); g.moveTo(bx - ww, yy + 6 * s); g.quadraticCurveTo(bx - ww * 0.4, yy - 6 * s, bx, yy - 24 * s); g.quadraticCurveTo(bx + ww * 0.4, yy - 6 * s, bx + ww, yy + 6 * s); g.closePath(); g.fill();
      g.fillStyle = lit; g.beginPath(); g.moveTo(bx, yy - 24 * s); g.quadraticCurveTo(bx + ww * 0.4, yy - 6 * s, bx + ww, yy + 6 * s); g.lineTo(bx + ww * 0.3, yy + 2 * s); g.closePath(); g.fill();
    }
  } else if (kind === 'palm') {
    g.strokeStyle = trunk; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + 10 * s, by - 50 * s, bx + 4 * s, by - 80 * s); g.stroke();
    for (let k = 0; k < 8; k++) { g.save(); g.translate(bx + 4 * s, by - 80 * s); g.rotate(-Math.PI / 2 + (k - 3.5) * 0.42); g.fillStyle = k % 2 ? lit : dark; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(18 * s, -6 * s, 36 * s, 6 * s); g.quadraticCurveTo(18 * s, 2 * s, 0, 0); g.fill(); g.restore(); }
  } else if (kind === 'dead') {
    g.strokeStyle = '#3a2c20'; g.lineCap = 'round';
    const branch = (x: number, y: number, a: number, len: number, d: number) => { if (d > 4) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = Math.max(0.6, (4 - d) * s); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); branch(x2, y2, a - 0.4 - rnd() * 0.3, len * 0.7, d + 1); branch(x2, y2, a + 0.35 + rnd() * 0.3, len * 0.65, d + 1); };
    branch(bx, by - 30 * s, -Math.PI / 2, 22 * s, 0);
  } else {
    const blobs: [number, number, number][] = [];
    for (let k = 0; k < 14; k++) blobs.push([bx + (rnd() - 0.5) * 50 * s, by - (48 + rnd() * 44) * s, (10 + rnd() * 10) * s]);
    for (const [x, y, r] of blobs) { g.fillStyle = dark; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    for (const [x, y, r] of blobs) { g.fillStyle = lit; g.beginPath(); g.arc(x + r * 0.35, y - r * 0.35, r * 0.6, 0, TAU); g.fill(); }
    for (const [x, y, r] of blobs) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.arc(x - r * 0.4, y + r * 0.4, r * 0.4, 0, TAU); g.fill(); }
  }
  return c;
}
function tent(g: Ctx, x: number, y: number, s: number, cloth: string, banner: string, round: boolean) {
  const dark = shade(cloth, 0.62);
  if (round) {
    g.fillStyle = dark; g.beginPath(); g.moveTo(x - 32 * s, y); g.lineTo(x - 32 * s, y - 20 * s); g.quadraticCurveTo(x, y - 52 * s, x + 32 * s, y - 20 * s); g.lineTo(x + 32 * s, y); g.fill();
    g.fillStyle = cloth; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 36 * s); g.quadraticCurveTo(x + 20 * s, y - 32 * s, x + 32 * s, y - 20 * s); g.lineTo(x + 32 * s, y); g.fill();
    g.strokeStyle = banner; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(x - 32 * s, y - 14 * s); g.quadraticCurveTo(x, y - 20 * s, x + 32 * s, y - 14 * s); g.stroke();
  } else {
    g.fillStyle = dark; g.beginPath(); g.moveTo(x - 36 * s, y); g.lineTo(x, y - 42 * s); g.lineTo(x + 36 * s, y); g.fill();
    g.fillStyle = cloth; g.beginPath(); g.moveTo(x, y - 42 * s); g.lineTo(x + 36 * s, y); g.lineTo(x + 4 * s, y); g.fill();
    g.fillStyle = hexA(banner, 0.55); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 2 * s, y - 42 * s); g.lineTo(x + k * 14 * s - 3 * s, y); g.lineTo(x + k * 14 * s + 3 * s, y); g.fill(); }
  }
  g.fillStyle = '#140e0a'; g.beginPath(); g.moveTo(x - 6 * s, y); g.lineTo(x, y - 20 * s); g.lineTo(x + 6 * s, y); g.fill();
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.5 * s; g.beginPath(); g.moveTo(x, y - (round ? 46 : 42) * s); g.lineTo(x, y - 74 * s); g.stroke();
  g.fillStyle = banner; g.beginPath(); g.moveTo(x, y - 74 * s); g.quadraticCurveTo(x + 12 * s, y - 72 * s, x + 24 * s, y - 70 * s); g.lineTo(x, y - 62 * s); g.fill();
}

// ----- props placed in the world and depth-sorted with soldiers
function propSprite(kind: PropKind, pal: Pal, rnd: () => number, era: BEra): { c: HTMLCanvasElement; ox: number; oy: number } {
  const R = 1.6; // supersample for crispness when zoomed
  const box_ = (w: number, h: number) => cnv(w * R, h * R);
  switch (kind) {
    case 'rock': {
      const [c, g] = box_(60, 34); g.scale(R, R);
      const pts: [number, number][] = []; const n = 9; for (let i = 0; i < n; i++) { const a = Math.PI + (i / (n - 1)) * Math.PI; const r = 18 + rnd() * 9; pts.push([30 + Math.cos(a) * r * 1.2, 32 + Math.sin(a) * r * 0.9]); }
      const base = mix(pal.ground2, '#6e6a62', 0.6);
      g.fillStyle = shade(base, 0.7); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
      g.fillStyle = base; g.beginPath(); g.moveTo(pts[3][0], pts[3][1]); for (let i = 4; i < n; i++) g.lineTo(pts[i][0], pts[i][1]); g.lineTo(30, 32); g.closePath(); g.fill();
      g.fillStyle = hexA(pal.light, 0.35); g.beginPath(); g.moveTo(pts[5][0], pts[5][1]); g.lineTo(pts[6][0], pts[6][1]); g.lineTo(pts[6][0] - 4, pts[6][1] + 8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(26, 20); g.lineTo(31, 27); g.lineTo(28, 32); g.stroke();
      return { c, ox: 30, oy: 32 };
    }
    case 'bush': case 'tuft': case 'snowdrift': {
      const big = kind === 'bush';
      const [c, g] = box_(big ? 56 : 34, big ? 36 : 22); g.scale(R, R);
      const W = big ? 56 : 34, H = big ? 36 : 22;
      if (kind === 'snowdrift') { g.fillStyle = '#e8eef2'; g.beginPath(); g.ellipse(W / 2, H, W / 2, H * 0.5, 0, Math.PI, 0); g.fill(); g.fillStyle = '#c4d0d8'; g.beginPath(); g.ellipse(W / 2 - 4, H, W / 2.4, H * 0.25, 0, Math.PI, 0); g.fill(); return { c, ox: W / 2, oy: H }; }
      for (let i = 0; i < (big ? 70 : 26); i++) {
        const x = W / 2 + (rnd() - 0.5) * W * 0.8, len = (big ? 14 : 9) + rnd() * (big ? 18 : 10);
        g.strokeStyle = rnd() < 0.4 ? pal.grass : rnd() < 0.5 ? shade(pal.grass, 0.65) : mix(pal.grass, pal.light, 0.35);
        g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + (rnd() - 0.5) * 6, H - len * 0.6, x + (rnd() - 0.5) * 10, H - len); g.stroke();
      }
      if (big) for (let i = 0; i < 8; i++) { g.fillStyle = rnd() < 0.5 ? shade(pal.mid, 0.9) : mix(pal.mid, pal.light, 0.3); g.beginPath(); g.arc(W / 2 + (rnd() - 0.5) * 30, H - 12 - rnd() * 12, 6 + rnd() * 5, 0, TAU); g.fill(); }
      return { c, ox: W / 2, oy: H };
    }
    case 'stakes': case 'spears': {
      const [c, g] = box_(70, 44); g.scale(R, R);
      for (let i = 0; i < 5; i++) { const x = 8 + i * 13; g.strokeStyle = '#5a3f26'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, 44); g.lineTo(x + (kind === 'stakes' ? 14 : 4), kind === 'stakes' ? 10 : 2); g.stroke(); g.fillStyle = kind === 'spears' ? '#b9bec6' : '#c9a36a'; g.beginPath(); g.moveTo(x + (kind === 'stakes' ? 14 : 4), kind === 'stakes' ? 10 : 2); g.lineTo(x + (kind === 'stakes' ? 11 : 1), kind === 'stakes' ? 16 : 10); g.lineTo(x + (kind === 'stakes' ? 16 : 7), kind === 'stakes' ? 15 : 10); g.fill(); }
      if (kind === 'stakes') { g.strokeStyle = '#4a3420'; g.lineWidth = 3; g.beginPath(); g.moveTo(2, 36); g.lineTo(68, 30); g.stroke(); }
      return { c, ox: 35, oy: 44 };
    }
    case 'wheel': {
      const [c, g] = box_(60, 40); g.scale(R, R);
      g.fillStyle = '#5a3f26'; g.fillRect(4, 30, 52, 6); g.fillStyle = '#6e4e30'; g.fillRect(4, 30, 52, 2);
      g.strokeStyle = '#4a3420'; g.lineWidth = 3; g.beginPath(); g.ellipse(22, 26, 14, 12, 0.3, 0, TAU); g.stroke();
      g.lineWidth = 1.5; for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.beginPath(); g.moveTo(22, 26); g.lineTo(22 + Math.cos(a) * 13, 26 + Math.sin(a) * 11); g.stroke(); }
      return { c, ox: 30, oy: 38 };
    }
    case 'barrels': {
      const [c, g] = box_(54, 36); g.scale(R, R);
      for (const [x, y] of [[14, 34], [36, 34], [25, 16]] as const) { g.fillStyle = '#6e4a2c'; g.fillRect(x - 9, y - 18, 18, 18); g.fillStyle = '#8a5e36'; g.fillRect(x - 1, y - 18, 8, 18); g.fillStyle = '#3a3a3e'; g.fillRect(x - 9, y - 15, 18, 2); g.fillRect(x - 9, y - 5, 18, 2); }
      return { c, ox: 27, oy: 34 };
    }
    case 'shield': case 'helmet': {
      const [c, g] = box_(30, 14); g.scale(R, R);
      if (kind === 'shield') { g.fillStyle = '#6a4a2e'; g.beginPath(); g.ellipse(15, 10, 13, 4, 0, 0, TAU); g.fill(); g.fillStyle = '#a08a5a'; g.beginPath(); g.ellipse(15, 9.5, 3, 1.2, 0, 0, TAU); g.fill(); }
      else { g.fillStyle = era === 'modern' ? '#4d5a3a' : '#9aa0a8'; g.beginPath(); g.ellipse(15, 10, 8, 5, 0, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(12, 6, 4, 1.5); }
      return { c, ox: 15, oy: 12 };
    }
    case 'sandbags': {
      const [c, g] = box_(80, 30); g.scale(R, R);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6 - r; k++) { const x = 6 + r * 6 + k * 12, y = 28 - r * 8; g.fillStyle = r % 2 ? '#8a7a5a' : '#7a6a4c'; g.beginPath(); g.ellipse(x + 6, y - 4, 7, 4.5, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 2, y - 7, 6, 1.5); }
      return { c, ox: 40, oy: 28 };
    }
    case 'wire': {
      const [c, g] = box_(90, 30); g.scale(R, R);
      g.strokeStyle = '#4a3a2a'; g.lineWidth = 2; for (const x of [10, 45, 80]) { g.beginPath(); g.moveTo(x - 8, 28); g.lineTo(x + 8, 6); g.moveTo(x + 8, 28); g.lineTo(x - 8, 6); g.stroke(); }
      g.strokeStyle = '#5a5a5e'; g.lineWidth = 0.8; for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x <= 90; x += 3) g.lineTo(x, 12 + k * 5 + Math.sin(x * 0.7 + k) * 3); g.stroke(); }
      return { c, ox: 45, oy: 28 };
    }
    case 'stump': {
      const [c, g] = box_(30, 24); g.scale(R, R);
      g.fillStyle = '#4a3424'; g.fillRect(8, 6, 14, 18); g.fillStyle = '#6a4e34'; g.fillRect(15, 6, 7, 18); g.fillStyle = '#a08060'; g.beginPath(); g.ellipse(15, 6, 7, 2.5, 0, 0, TAU); g.fill();
      return { c, ox: 15, oy: 23 };
    }
    case 'cactus': {
      const [c, g] = box_(30, 48); g.scale(R, R);
      g.fillStyle = '#5a7a3a'; g.fillRect(12, 6, 7, 42); g.fillRect(4, 18, 5, 14); g.fillRect(4, 28, 10, 4); g.fillRect(22, 12, 5, 16); g.fillRect(17, 24, 8, 4);
      g.fillStyle = '#7a9a52'; g.fillRect(16, 6, 3, 42);
      return { c, ox: 15, oy: 47 };
    }
  }
}

export function buildBackdrop(s: BattleState): Backdrop {
  const { era, terrain, time, seed } = s.cfg;
  const pal = palette(time, terrain, era);
  const rnd = prng(seed * 7 + 3);
  const H = GROUND_TOP + 40;
  const fires: Fire[] = [];
  // ---- sky
  const [sky, sg] = cnv(VIEW_W, VIEW_H);
  const grad = sg.createLinearGradient(0, 0, 0, GROUND_TOP + 20);
  grad.addColorStop(0, pal.skyTop); grad.addColorStop(0.55, pal.skyMid); grad.addColorStop(1, pal.skyLow);
  sg.fillStyle = grad; sg.fillRect(0, 0, VIEW_W, VIEW_H);
  if (pal.night > 0.1) { for (let i = 0; i < 120; i++) { sg.fillStyle = `rgba(255,255,255,${(rnd() * 0.6 * pal.night).toFixed(3)})`; sg.fillRect(rnd() * VIEW_W, rnd() * VIEW_H * 0.35, 1.2, 1.2); } }
  const sx = VIEW_W * pal.sunX, sy = VIEW_H * pal.sunY;
  const sun = sg.createRadialGradient(sx, sy, 0, sx, sy, 460);
  sun.addColorStop(0, pal.sun); sun.addColorStop(0.045, pal.sun); sun.addColorStop(0.06, hexA(pal.sun, 0.75)); sun.addColorStop(0.2, hexA(pal.sun, 0.3)); sun.addColorStop(1, hexA(pal.sun, 0));
  sg.fillStyle = sun; sg.fillRect(0, 0, VIEW_W, VIEW_H);
  // horizon glow & high cirrus streaks
  const hg = sg.createLinearGradient(0, GROUND_TOP - 160, 0, GROUND_TOP); hg.addColorStop(0, hexA(pal.skyLow, 0)); hg.addColorStop(1, hexA(pal.light, 0.35));
  sg.fillStyle = hg; sg.fillRect(0, GROUND_TOP - 160, VIEW_W, 160);
  sg.save(); sg.filter = 'blur(4px)';
  for (let i = 0; i < 14; i++) { sg.fillStyle = hexA(pal.light, 0.08 + rnd() * 0.1); sg.beginPath(); sg.ellipse(rnd() * VIEW_W, 40 + rnd() * 140, 120 + rnd() * 200, 3 + rnd() * 4, -0.05, 0, TAU); sg.fill(); }
  sg.restore();
  // crepuscular rays
  sg.save(); sg.globalCompositeOperation = 'lighter'; sg.globalAlpha = time === 'overcast' ? 0.03 : 0.065;
  for (let i = 0; i < 11; i++) { const a = Math.PI * (0.52 + i * 0.045) + rnd() * 0.03; sg.fillStyle = pal.light; sg.beginPath(); sg.moveTo(sx, sy); sg.lineTo(sx + Math.cos(a) * 1600, sy + Math.sin(a) * 1600); sg.lineTo(sx + Math.cos(a + 0.022) * 1600, sy + Math.sin(a + 0.022) * 1600); sg.fill(); }
  sg.restore();
  if (era === 'modern' || era === 'industrial') {
    sg.save(); sg.filter = 'blur(6px)';
    for (let i = 0; i < (era === 'modern' ? 5 : 2); i++) { const x = rnd() * VIEW_W; for (let k = 0; k < 16; k++) { sg.fillStyle = `rgba(40,38,36,${(0.1 - k * 0.005).toFixed(3)})`; sg.beginPath(); sg.arc(x + k * 10 + Math.sin(k) * 8, GROUND_TOP - 40 - k * 22, 16 + k * 4.5, 0, TAU); sg.fill(); } }
    sg.restore();
  }
  // ---- clouds (volumetric sprites)
  const clouds = Array.from({ length: time === 'overcast' ? 12 : 7 }, (_, i) => {
    const w = 260 + rnd() * 260, h = w * (0.32 + rnd() * 0.1);
    return { sprite: cloudSprite(rnd, pal, w, h), x: rnd() * VIEW_W * 1.6, y: 20 + rnd() * 190, s: 1, v: 3 + rnd() * 8, a: time === 'overcast' ? 0.85 : 0.7 + rnd() * 0.3, layer: i % 2 };
  });
  // ---- far ranges with atmospheric perspective
  const fw = VIEW_W + (WORLD_W - VIEW_W) * PAR.far + 40;
  const [farRaw, frg] = cnv(fw, H);
  const high = terrain === 'mountain' || terrain === 'snow';
  const farLit = mix(mix(pal.far, pal.light, 0.25), pal.skyLow, 0.35), farDark = mix(mix(pal.far, pal.shadow, 0.35), pal.skyLow, 0.35);
  range(frg, fw, GROUND_TOP - (high ? 200 : 120), high ? 150 : 80, 0.004, seed + 1, farLit, farDark, { snow: high ? GROUND_TOP - 250 : terrain === 'steppe' ? GROUND_TOP - 300 : undefined, mist: pal.haze });
  range(frg, fw, GROUND_TOP - 70, high ? 70 : 40, 0.009, seed + 2, mix(pal.far, pal.light, 0.15), mix(pal.far, pal.shadow, 0.3), { mist: pal.haze });
  const farSt: ArchStyle = { lit: mix(mix(pal.far, pal.light, 0.35), pal.haze, 0.35), dark: mix(mix(pal.far, '#2a2a34', 0.35), pal.haze, 0.3), tile: mix('#2f7fae', pal.haze, 0.35), gold: mix('#e2b340', pal.haze, 0.3), window: 'rgba(20,20,28,0.35)' };
  landmarks(frg, fw, GROUND_TOP - 52, era, s.cfg.teams[1].culture, farSt, rnd, 3, null, 'mid');
  const hz = frg.createLinearGradient(0, GROUND_TOP - 220, 0, H); hz.addColorStop(0, hexA(pal.haze, 0)); hz.addColorStop(1, hexA(pal.haze, 0.6));
  frg.fillStyle = hz; frg.fillRect(0, 0, fw, H);
  const [far, fg2] = cnv(fw, H); blurInto(fg2, farRaw, 1.2);
  // ---- mid hills, towns and woods
  const mw = VIEW_W + (WORLD_W - VIEW_W) * PAR.mid + 40;
  const [mid, mg] = cnv(mw, H);
  range(mg, mw, GROUND_TOP - 24, 30, 0.006, seed + 3, mix(pal.mid, pal.light, 0.25), mix(pal.mid, pal.shadow, 0.25), { rough: 0.3 });
  const midSt: ArchStyle = { lit: mix(pal.mid, pal.light, 0.55), dark: shade(mix(pal.mid, '#3a3a44', 0.35), 0.85), tile: mix('#2f7fae', pal.mid, 0.2), gold: '#d8a83a', window: pal.night > 0.1 ? 'rgba(255,190,110,0.8)' : 'rgba(20,18,24,0.6)' };
  landmarks(mg, mw * 0.42, GROUND_TOP - 14, era, s.cfg.teams[0].culture, midSt, rnd, 2, fires, 'mid');
  const kinds: Record<Terrain, ('round' | 'pine' | 'palm' | 'dead' | 'birch')[]> = { plains: ['round', 'round', 'birch'], forest: ['pine', 'pine', 'round'], desert: ['palm'], steppe: ['dead', 'round'], mountain: ['pine', 'pine', 'dead'], snow: ['pine', 'dead'] };
  const trees: HTMLCanvasElement[] = [];
  for (let i = 0; i < 6; i++) { const k = kinds[terrain][i % kinds[terrain].length]; trees.push(treeSprite(k, 0.8 + rnd() * 0.3, mix(pal.mid, pal.light, 0.3), shade(pal.mid, 0.72), rnd)); }
  const nTrees = terrain === 'forest' ? 70 : terrain === 'desert' || terrain === 'steppe' ? 10 : 30;
  for (let i = 0; i < nTrees; i++) { const tr = trees[i % trees.length]; const x = rnd() * mw, y = GROUND_TOP - 10 + rnd() * 10; mg.drawImage(tr, x - tr.width / 2, y - tr.height); }
  const mh = mg.createLinearGradient(0, GROUND_TOP - 120, 0, H); mh.addColorStop(0, hexA(pal.haze, 0)); mh.addColorStop(1, hexA(pal.haze, 0.45));
  mg.fillStyle = mh; mg.fillRect(0, 0, mw, H);
  // ---- near: camps, war engines, hedges
  const nw = VIEW_W + (WORLD_W - VIEW_W) * PAR.near + 40;
  const [near, ng] = cnv(nw, H);
  range(ng, nw, GROUND_TOP + 6, 10, 0.01, seed + 4, mix(pal.near, pal.light, 0.2), shade(pal.near, 0.8), { rough: 0.1 });
  const nearTrees = Array.from({ length: 4 }, (_, i) => treeSprite(kinds[terrain][i % kinds[terrain].length], 1.1 + rnd() * 0.3, mix(pal.near, pal.light, 0.3), shade(pal.near, 0.75), rnd));
  for (let i = 0; i < 18; i++) { const tr = nearTrees[i % 4]; const x = rnd() * nw; ng.drawImage(tr, x - tr.width / 2, GROUND_TOP + 8 - tr.height); }
  const round = (c: Culture) => c === 'steppe' || c === 'islamic';
  if (era !== 'modern') {
    for (let i = 0; i < 7; i++) { const x = 50 + i * 66 + rnd() * 30; tent(ng, x, GROUND_TOP + 10, 0.9 + rnd() * 0.3, i % 2 ? '#d8cdb0' : mix(s.cfg.teams[0].color, '#d8cdb0', 0.55), s.cfg.teams[0].color, round(s.cfg.teams[0].culture)); if (i % 3 === 1) fires.push({ x: x + 30, y: GROUND_TOP + 8, s: 1, layer: 'near' }); }
    for (let i = 0; i < 7; i++) { const x = nw - 70 - i * 66 - rnd() * 30; tent(ng, x, GROUND_TOP + 10, 0.9 + rnd() * 0.3, i % 2 ? '#d8cdb0' : mix(s.cfg.teams[1].color, '#d8cdb0', 0.55), s.cfg.teams[1].color, round(s.cfg.teams[1].culture)); if (i % 3 === 1) fires.push({ x: x - 30, y: GROUND_TOP + 8, s: 1, layer: 'near' }); }
  } else {
    ng.fillStyle = shade(pal.near, 0.55);
    for (let i = 0; i < 30; i++) { const x = rnd() * nw; ng.fillRect(x, GROUND_TOP - 46 + rnd() * 10, 3, 54); if (rnd() < 0.5) ng.fillRect(x - 8, GROUND_TOP - 40, 19, 2); }
    for (let i = 0; i < 6; i++) { const x = rnd() * nw; ng.fillStyle = '#2e3028'; ng.fillRect(x, GROUND_TOP - 14, 64, 18); ng.fillRect(x + 12, GROUND_TOP - 28, 32, 14); ng.fillRect(x + 40, GROUND_TOP - 23, 44, 3); ng.fillStyle = '#1c1d18'; for (let k = 0; k < 5; k++) { ng.beginPath(); ng.arc(x + 8 + k * 12, GROUND_TOP + 4, 5, 0, TAU); ng.fill(); } fires.push({ x: x + 30, y: GROUND_TOP - 16, s: 1.3, layer: 'near' }); }
  }
  // ---- ground texture tile (fbm colour variation, grass strokes, pebbles)
  const T = 384;
  const [tile, tg] = cnv(T, T);
  const N = makeNoise(seed + 9);
  const img = tg.createImageData(T, T);
  const c1 = parseInt(pal.ground.slice(1), 16), c2 = parseInt(pal.ground2.slice(1), 16), c3 = parseInt(pal.grass.slice(1), 16);
  const ch = (c: number, sh: number) => (c >> sh) & 255;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // tileable noise by wrapping on a torus-like blend
    const u = x / T, v = y / T;
    const n = (N.fbm2(u * 8, v * 8, 3) * (1 - u) * (1 - v) + N.fbm2((u - 1) * 8, v * 8, 3) * u * (1 - v) + N.fbm2(u * 8, (v - 1) * 8, 3) * (1 - u) * v + N.fbm2((u - 1) * 8, (v - 1) * 8, 3) * u * v);
    const g2 = clamp((n - 0.35) * 2.2, 0, 1);
    const g40 = N.n2(u * 40, v * 40) * (1 - u) * (1 - v) + N.n2((u - 1) * 40, v * 40) * u * (1 - v) + N.n2(u * 40, (v - 1) * 40) * (1 - u) * v + N.n2((u - 1) * 40, (v - 1) * 40) * u * v;
    const gr = clamp((g40 - 0.55) * 3, 0, 1) * 0.35;
    const i = (y * T + x) * 4;
    for (let k = 0; k < 3; k++) { const sh = 16 - k * 8; img.data[i + k] = ch(c1, sh) * (1 - g2) + ch(c2, sh) * g2 + (ch(c3, sh) - ch(c1, sh)) * gr + (rnd() - 0.5) * 10; }
    img.data[i + 3] = 255;
  }
  tg.putImageData(img, 0, 0);
  { const [tmp, tmg] = cnv(T, T); tmg.drawImage(tile, 0, 0); tg.clearRect(0, 0, T, T); for (const [dx, dy] of [[0, 0], [-T, 0], [T, 0], [0, -T], [0, T]]) { tg.save(); tg.filter = 'blur(1.4px)'; tg.drawImage(tmp, dx, dy); tg.restore(); } }
  for (let i = 0; i < 900; i++) { tg.strokeStyle = rnd() < 0.5 ? pal.grass : rnd() < 0.5 ? shade(pal.grass, 0.7) : mix(pal.grass, pal.light, 0.3); tg.globalAlpha = 0.55; tg.lineWidth = 1; const x = rnd() * T, y = rnd() * T; tg.beginPath(); tg.moveTo(x, y); tg.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 6); tg.stroke(); }
  tg.globalAlpha = 1;
  for (let i = 0; i < 70; i++) { const x = rnd() * T, y = rnd() * T, r = 1 + rnd() * 2.5; tg.fillStyle = 'rgba(40,34,28,0.35)'; tg.beginPath(); tg.ellipse(x + 0.8, y + 0.8, r, r * 0.6, 0, 0, TAU); tg.fill(); tg.fillStyle = mix(pal.ground2, '#b0a890', 0.6); tg.beginPath(); tg.ellipse(x, y, r, r * 0.6, 0, 0, TAU); tg.fill(); }
  if (terrain === 'snow') { tg.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 300; i++) tg.fillRect(rnd() * T, rnd() * T, 2, 1); }
  const groundTile = tg.createPattern(tile, 'repeat');
  // ---- foreground grass silhouettes (two-tone)
  const fgw = VIEW_W + (WORLD_W - VIEW_W) * PAR.fg + 40;
  const [fgc, fgg] = cnv(fgw, 120);
  const fgDark = shade(pal.ground2, 0.38), fgLit = shade(pal.grass, 0.55);
  for (let x = 0; x < fgw; x += 3) {
    const hh = 10 + Math.abs(Math.sin(x * 0.013)) * 30 * (0.5 + 0.5 * Math.sin(x * 0.0031)) + rnd() * 16;
    const lean = (rnd() - 0.5) * 8;
    fgg.fillStyle = rnd() < 0.7 ? fgDark : fgLit; fgg.beginPath(); fgg.moveTo(x, 120); fgg.quadraticCurveTo(x + lean * 0.3, 120 - hh * 0.6, x + 1.5 + lean, 120 - hh); fgg.lineTo(x + 3, 120); fgg.fill();
  }
  // ---- props in the world
  const props: Prop[] = [];
  const americas = s.cfg.teams.some((t) => t.culture === 'american');
  const pool: PropKind[] = terrain === 'snow' ? ['rock', 'snowdrift', 'snowdrift', 'stump', 'tuft', 'rock'] : terrain === 'desert' ? ['rock', 'rock', 'tuft', 'tuft', 'rock', ...(americas ? ['cactus' as PropKind] : [])] : ['rock', 'bush', 'tuft', 'tuft', 'tuft', 'stump', 'rock', 'bush'];
  if (era === 'modern') pool.push('sandbags', 'wire', 'helmet');
  else if (era === 'industrial') pool.push('wheel', 'barrels');
  else pool.push('stakes', 'shield', 'helmet');
  const spriteFor = new Map<PropKind, { c: HTMLCanvasElement; ox: number; oy: number }[]>();
  for (const k of new Set(pool)) spriteFor.set(k, [0, 1, 2].map(() => propSprite(k, pal, rnd, era)));
  for (let i = 0; i < 60; i++) {
    const kind = pool[Math.floor(rnd() * pool.length)];
    const v = spriteFor.get(kind)![Math.floor(rnd() * 3)];
    props.push({ x: rnd() * WORLD_W, z: rnd(), kind, sprite: v.c, ox: v.ox, oy: v.oy, w: v.c.width / 1.6, h: v.c.height / 1.6 });
  }
  // ---- post layers
  const [grain, gg] = cnv(VIEW_W + 256, VIEW_H + 256);
  const id = gg.createImageData(VIEW_W + 256, VIEW_H + 256);
  for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 16; }
  gg.putImageData(id, 0, 0);
  const [vig, vg] = cnv(VIEW_W, VIEW_H);
  vg.fillStyle = hexA(pal.grade, pal.gradeA * 1.2); vg.fillRect(0, 0, VIEW_W, VIEW_H);
  const vgr = vg.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.75);
  vgr.addColorStop(0, 'rgba(0,0,0,0)'); vgr.addColorStop(1, 'rgba(8,5,2,0.72)');
  vg.fillStyle = vgr; vg.fillRect(0, 0, VIEW_W, VIEW_H);
  const [groundShade, gsg] = cnv(4, 256);
  const shadeG = gsg.createLinearGradient(0, 0, 0, 256);
  shadeG.addColorStop(0, hexA(pal.haze, 0.6)); shadeG.addColorStop(0.2, hexA(pal.haze, 0.08)); shadeG.addColorStop(0.45, hexA(pal.ground, 0)); shadeG.addColorStop(1, 'rgba(0,0,0,0.32)');
  gsg.fillStyle = shadeG; gsg.fillRect(0, 0, 4, 256);
  const [redEdge, rg] = cnv(VIEW_W, VIEW_H);
  const rgr = rg.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
  rgr.addColorStop(0, 'rgba(120,0,0,0)'); rgr.addColorStop(1, 'rgba(140,0,0,0.55)'); rg.fillStyle = rgr; rg.fillRect(0, 0, VIEW_W, VIEW_H);
  const [dmgEdge, dg] = cnv(90, 64);
  const dgr = dg.createLinearGradient(0, 0, 90, 0); dgr.addColorStop(0, 'rgba(200,20,20,1)'); dgr.addColorStop(1, 'rgba(200,20,20,0)'); dg.fillStyle = dgr; dg.fillRect(0, 0, 90, 64);
  const birds = era === 'modern' ? [] : Array.from({ length: 7 }, () => ({ x: rnd() * VIEW_W, y: 80 + rnd() * 120, v: 18 + rnd() * 10, ph: rnd() * 6 }));
  return { sky, far, mid, near, fg: fgc, groundTile, groundShade, grain, vignette: vig, redEdge, dmgEdge, clouds, fires, props, pal, birds };
}
