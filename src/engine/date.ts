import type { GameDate } from '../types/game';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// UI may localise displayed month names; the simulation itself never depends on them.
let MONTH_NAMES = [...MONTHS];
let BC = 'BC';
export function setDateLocale(months: string[], bc: string): void { MONTH_NAMES = months; BC = bc; }
export const monthIndex = (d: GameDate): number => d.y * 12 + d.m;
export const fromIndex = (i: number): GameDate => ({ y: Math.floor(i / 12), m: ((i % 12) + 12) % 12 });
export const addMonths = (d: GameDate, n: number): GameDate => fromIndex(monthIndex(d) + n);
export const cmpDate = (a: GameDate, b: GameDate): number => monthIndex(a) - monthIndex(b);
export function fmtYear(y: number): string { return y < 0 ? `${-y} ${BC}` : `${y}`; }
export function fmtDate(d: GameDate, short = false): string {
  return short ? `${MONTH_NAMES[d.m].slice(0, 3)} ${fmtYear(d.y)}` : `${MONTH_NAMES[d.m]} ${fmtYear(d.y)}`;
}
