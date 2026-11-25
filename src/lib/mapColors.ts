import type { World } from '../types/game';
import type { MapMode } from '../store/game';
import { emptyUnits, soldiersOf } from '../engine/rt/units';
import { peekRelation } from '../engine/util';

const UNOWNED_P = '#cbb88f', UNOWNED_D = '#3b3a35';
function hexToRgb(h: string): [number, number, number] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r: number, g: number, b: number): string { return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a: string, b: string, t: number): string { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
function desat(h: string, t: number): string { const [r, g, b] = hexToRgb(h); const l = (r + g + b) / 3; return rgbToHex(r + (l - r) * t, g + (l - g) * t, b + (l - b) * t); }
/** Sequential palette: deep red → amber → parchment → verdigris */
export function ramp(t: number): string {
  t = Math.max(0, Math.min(1, t));
  const stops = ['#7c271f', '#b8573a', '#d9a55c', '#cfc28a', '#7fa87a', '#3a8371'];
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  return mix(stops[i], stops[i + 1], t * (stops.length - 1) - i);
}

export function computeFills(w: World, mode: MapMode, selected: string | null, parchment: boolean): string[] {
  const out = new Array<string>(w.provinces.length);
  const unowned = parchment ? UNOWNED_P : UNOWNED_D;
  const rt = w.rt;
  let maxSold = 1;
  if (mode === 'military' && rt) for (const p of w.provinces) if (p.owner) maxSold = Math.max(maxSold, Math.log10(1 + soldiersOf(rt.cities[p.id]?.garrison ?? emptyUnits())));
  for (const p of w.provinces) {
    const c = p.owner ? w.countries[p.owner] : null;
    if (!c) { out[p.id] = mode === 'terrain' ? terrain(p) : unowned; continue; }
    switch (mode) {
      case 'political': {
        let col = c.color;
        if (c.overlord && w.countries[c.overlord]) col = mix(col, w.countries[c.overlord].color, 0.45);
        if (c.tribal) col = desat(mix(col, unowned, 0.45), 0.5);
        out[p.id] = parchment ? mix(col, '#e3d2a8', 0.18) : col;
        break;
      }
      case 'terrain': out[p.id] = terrain(p); break;
      case 'military': out[p.id] = ramp(Math.log10(1 + soldiersOf(rt?.cities[p.id]?.garrison ?? emptyUnits())) / maxSold); break;
      case 'diplomacy': {
        if (!selected) { out[p.id] = desat(c.color, 0.6); break; }
        if (c.id === selected) { out[p.id] = '#e8d08a'; break; }
        const r = peekRelation(w, selected, c.id);
        const atWar = w.wars.some((x) => !x.ended && ((x.attackers.includes(selected) && x.defenders.includes(c.id)) || (x.defenders.includes(selected) && x.attackers.includes(c.id))));
        if (atWar) out[p.id] = '#a3362c';
        else if (r?.treaties.alliance) out[p.id] = '#2f8f6a';
        else out[p.id] = r ? ramp((r.opinion + 100) / 200) : desat(c.color, 0.75);
        break;
      }
    }
  }
  return out;
}
function terrain(p: { desert: boolean; mountain: boolean; river: boolean; lat: number }): string {
  if (Math.abs(p.lat) > 62) return '#dfe6e8';
  if (p.desert) return '#d8b878';
  if (p.mountain) return '#8f8066';
  if (p.river) return '#6f9a5a';
  if (Math.abs(p.lat) < 15) return '#4f8a4a';
  return '#8fae6a';
}

export const MAP_MODES: { id: MapMode; label: string; legend: string }[] = [
  { id: 'political', label: 'Political', legend: 'Countries; vassals tinted toward their overlord; tribal lands muted.' },
  { id: 'terrain', label: 'Terrain', legend: 'Deserts, mountains, river valleys, tropics and polar lands.' },
  { id: 'military', label: 'Military', legend: 'Garrison size of each city (log scale).' },
  { id: 'diplomacy', label: 'Diplomacy', legend: 'Gold = you, red = at war, green = allies, others by opinion.' },
];
