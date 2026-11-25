// Unit catalogue and helpers for the real-time layer. Pure data + arithmetic (no DOM, no React).
import type { UnitKind, Units } from '../../types/game';

export const UNIT_KINDS: UnitKind[] = ['spear', 'archer', 'cavalry', 'shield', 'guard', 'mercenary', 'fleet'];
export const LAND_KINDS: UnitKind[] = ['spear', 'archer', 'cavalry', 'shield', 'guard', 'mercenary'];

export interface UnitDef {
  /** English source string, translated with t() in the UI. */
  name: string;
  atk: number; def: number;
  gold: number; food: number;
  /** capacity of soldiers a ship can carry across the sea */
  carries?: number;
}

export const UNIT: Record<UnitKind, UnitDef> = {
  spear: { name: 'Spearmen', atk: 1.0, def: 1.0, gold: 4, food: 1 },
  archer: { name: 'Archers', atk: 1.15, def: 0.7, gold: 6, food: 1 },
  cavalry: { name: 'Cavalry', atk: 1.9, def: 1.2, gold: 14, food: 3 },
  shield: { name: 'Shield infantry', atk: 0.95, def: 1.6, gold: 8, food: 2 },
  guard: { name: 'Royal guard', atk: 2.5, def: 2.4, gold: 26, food: 4 },
  mercenary: { name: 'Mercenaries', atk: 2.3, def: 1.1, gold: 42, food: 0 },
  fleet: { name: 'Fleet', atk: 60, def: 70, gold: 900, food: 150, carries: 150 },
};

/** damage multiplier of attacker kind (row) against defender kind (column) */
const M: Record<UnitKind, Partial<Record<UnitKind, number>>> = {
  spear: { cavalry: 1.7, guard: 0.8, fleet: 0.6 },
  archer: { spear: 1.3, shield: 0.85, cavalry: 0.9, guard: 0.8 },
  cavalry: { archer: 1.7, spear: 0.6, shield: 0.85, fleet: 0.4 },
  shield: { archer: 1.2, cavalry: 1.1 },
  guard: {},
  mercenary: { shield: 1.2, archer: 1.15, guard: 0.9 },
  fleet: { spear: 1.1, archer: 1.1, cavalry: 1.1, shield: 1.1, fleet: 1.0, guard: 0.9 },
};
export const matchup = (a: UnitKind, d: UnitKind): number => M[a][d] ?? 1;

export function emptyUnits(): Units { return { spear: 0, archer: 0, cavalry: 0, shield: 0, guard: 0, mercenary: 0, fleet: 0 }; }
export function cloneUnits(u: Units): Units { return { ...u }; }
export function addUnits(a: Units, b: Partial<Units>, k = 1): void { for (const kd of UNIT_KINDS) a[kd] += (b[kd] ?? 0) * k; }
export function scaleUnits(u: Units, k: number): Units { const o = emptyUnits(); for (const kd of UNIT_KINDS) o[kd] = u[kd] * k; return o; }
export function roundUnits(u: Units): Units { const o = emptyUnits(); for (const kd of UNIT_KINDS) o[kd] = Math.max(0, Math.round(u[kd])); return o; }
/** soldiers on land (everything except ships) */
export function soldiersOf(u: Units): number { let s = 0; for (const kd of LAND_KINDS) s += u[kd]; return s; }
export const shipsOf = (u: Units): number => u.fleet;
export function hasAny(u: Units): boolean { return UNIT_KINDS.some((k) => u[k] >= 0.5); }

/** raw (matchup-free) fighting power; ships count only when `naval` */
export function rawPower(u: Units, naval: boolean): number {
  let p = 0;
  for (const k of UNIT_KINDS) { if (k === 'fleet' && !naval) continue; p += u[k] * (UNIT[k].atk + UNIT[k].def) / 2; }
  return p;
}
/** power of `u` fighting against `enemy`, including rock-paper-scissors matchups and quality */
export function powerAgainst(u: Units, enemy: Units, quality: number, naval: boolean): number {
  const eTotal = rawPower(enemy, naval);
  let p = 0;
  for (const k of UNIT_KINDS) {
    if (!u[k] || (k === 'fleet' && !naval)) continue;
    let m = 0;
    if (eTotal <= 0) m = 1;
    else for (const j of UNIT_KINDS) { if (!enemy[j] || (j === 'fleet' && !naval)) continue; m += (enemy[j] * (UNIT[j].atk + UNIT[j].def) / 2 / eTotal) * matchup(k, j); }
    p += u[k] * (UNIT[k].atk + UNIT[k].def) / 2 * m;
  }
  return p * quality;
}

/** Cost of `n` units of `kind` */
export function unitCost(kind: UnitKind, n: number): { gold: number; food: number } {
  return { gold: Math.ceil(UNIT[kind].gold * n), food: Math.ceil(UNIT[kind].food * n) };
}
