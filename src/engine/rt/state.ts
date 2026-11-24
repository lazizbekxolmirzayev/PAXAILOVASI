// Real-time layer state: per-city garrisons and stocks, income, recruiting, market, building.
import type { CountryId, CityState, NoticeKind, Province, RealtimeState, UnitKind, Units, World } from '../../types/game';
import { clamp } from '../util';
import { LAND_KINDS, UNIT, UNIT_KINDS, addUnits, emptyUnits, soldiersOf, unitCost } from './units';

export const TRAVEL_ATTACK = 60; // seconds on the road before an attack arrives (defender is warned at departure)
export const TRAVEL_SUPPORT = 45;
export const BATTLE_SECONDS = 30;
export const FOOD_BUY = 1.6; // gold per food when buying
export const FOOD_SELL = 0.7; // gold per food when selling
export const MANPOWER_SHARE = 0.06; // a city can field at most 6% of its people

export interface RtResult { ok: boolean; key: string; params?: Record<string, string | number> }
export const okR = (key: string, params?: RtResult['params']): RtResult => ({ ok: true, key, params });
export const failR = (key: string, params?: RtResult['params']): RtResult => ({ ok: false, key, params });

export function isHuman(w: World, id: CountryId): boolean {
  return id === w.player || Object.values(w.players ?? {}).includes(id);
}

export function nextId(w: World, prefix: string): string { const rt = rtOf(w); rt.counter += 1; return `${prefix}${rt.counter.toString(36)}`; }

export function notify(w: World, to: CountryId, kind: NoticeKind, params: Record<string, string | number>, province?: number): void {
  if (!isHuman(w, to)) return;
  const rt = rtOf(w);
  rt.notices.push({ id: nextId(w, 'n'), t: rt.t, to, kind, params, province });
  if (rt.notices.length > 150) rt.notices.splice(0, rt.notices.length - 150);
}

export function rtOf(w: World): RealtimeState {
  if (!w.rt) initRealtime(w);
  return w.rt!;
}
/** Makes sure the world carries a real-time layer (new games and old saves alike). */
export function ensureRt(w: World): RealtimeState {
  if (!w.rt || w.rt.cities.length !== w.provinces.length) return initRealtime(w);
  const rt = w.rt;
  rt.handled ??= {}; rt.warT ??= {}; rt.aiOfferT ??= {}; rt.truces ??= {}; rt.nextAi ??= {}; rt.offers ??= []; rt.loans ??= []; rt.reports ??= [];
  return rt;
}

// ---------------------------------------------------------------- city rates
export function cityRates(p: Province, quality: number): { gold: number; food: number } {
  const k = Math.max(1, p.pop / 1000);
  const tech = 0.85 + 0.15 * quality;
  const gold = Math.pow(k, 0.85) * (0.12 + p.dev * 0.012) * (1 + p.market * 0.1 + p.port * 0.05 + p.roads * 0.03) * tech;
  const food = Math.pow(k, 0.9) * (0.10 + p.farms * 0.03 + (p.river ? 0.03 : 0)) * (p.desert ? 0.5 : 1) * (0.9 + 0.1 * quality);
  return { gold, food };
}

export type CityKind = 'capital' | 'city' | 'fortress' | 'town' | 'village';
export function cityKind(w: World, pid: number): CityKind {
  const p = w.provinces[pid];
  const cs = rtOf(w).cities[pid];
  const c = p.owner ? w.countries[p.owner] : null;
  if (c && c.capital === pid) return 'capital';
  if (cs.tier === 2) return 'city';
  if (p.fort >= 3) return 'fortress';
  return cs.tier === 1 ? 'town' : 'village';
}

// ---------------------------------------------------------------- initialisation
function mixFor(w: World, cId: CountryId, p: Province, tl: number): number[] {
  // order: spear, archer, cavalry, shield, guard
  const c = w.countries[cId];
  const nomad = c.government === 'khaganate' || (c.tribal && (p.region === 'centralasia' || p.region === 'russia' || p.region === 'mena'));
  if (nomad) return [0.07, 0.33, 0.45, 0.1, 0.05];
  if (tl < 1.2) return [0.46, 0.2, 0.1, 0.19, 0.05];
  if (tl < 3) return [0.36, 0.22, 0.14, 0.21, 0.07];
  return [0.26, 0.24, 0.14, 0.24, 0.12];
}

export function initRealtime(w: World): RealtimeState {
  const owned = w.provinces.filter((p) => p.owner);
  const pops = owned.map((p) => p.pop).sort((a, b) => a - b);
  const q = (f: number) => pops[Math.min(pops.length - 1, Math.floor(pops.length * f))] ?? 0;
  const cityMin = q(0.88), townMin = q(0.6);
  const cities: CityState[] = w.provinces.map((p) => ({ garrison: emptyUnits(), gold: 0, food: 0, tier: (p.pop >= cityMin ? 2 : p.pop >= townMin ? 1 : 0) as 0 | 1 | 2 }));
  const rt: RealtimeState = { t: 0, cities, marches: [], battles: [], reports: [], loans: [], offers: [], notices: [], truces: {}, nextAi: {}, counter: 0, incomeAcc: 0, handled: {}, warT: {}, aiOfferT: {} };
  w.rt = rt;
  const byOwner = new Map<CountryId, Province[]>();
  for (const p of owned) { const l = byOwner.get(p.owner!) ?? []; l.push(p); byOwner.set(p.owner!, l); }
  for (const [id, provs] of byOwner) {
    const c = w.countries[id];
    if (!c) continue;
    const tl = clamp((c.military.quality - 1) / 0.35, 0, 8);
    const weights = provs.map((p) => Math.pow(Math.max(1, p.pop), 0.85) * (1 + p.fort * 0.15) * (p.id === c.capital ? 2.2 : 1));
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    const S = Math.max(c.military.regiments * 1000, provs.length * 18);
    provs.forEach((p, i) => {
      const cs = cities[p.id];
      const share = S * weights[i] / wsum;
      const mix = mixFor(w, id, p, tl);
      const g = cs.garrison;
      LAND_KINDS.slice(0, 5).forEach((kd, j) => { g[kd] = Math.max(0, Math.round(share * mix[j])); });
      if (soldiersOf(g) < 12) g.spear = 12;
      if (p.coastal && p.port > 0 && tl >= 0.8) g.fleet = Math.floor(share / 900 * (1 + p.port * 0.5));
      const r = cityRates(p, c.military.quality);
      cs.gold = Math.round(r.gold * 14 + Math.max(0, c.economy.treasury) * 0.3 * weights[i] / wsum);
      cs.food = Math.round(r.food * 12);
    });
  }
  for (const war of w.wars) if (!war.ended) rt.warT[war.id] = 0;
  return rt;
}

// ---------------------------------------------------------------- aggregates
export interface CountryStats {
  cities: number; units: Units; soldiers: number; ships: number;
  gold: number; food: number; goldPerMin: number; foodPerMin: number; population: number;
}
export function ownedOf(w: World, id: CountryId): number[] {
  const out: number[] = [];
  for (const p of w.provinces) if (p.owner === id) out.push(p.id);
  return out;
}
export function countryStats(w: World, id: CountryId): CountryStats {
  const rt = rtOf(w);
  const c = w.countries[id];
  const s: CountryStats = { cities: 0, units: emptyUnits(), soldiers: 0, ships: 0, gold: 0, food: 0, goldPerMin: 0, foodPerMin: 0, population: 0 };
  for (const p of w.provinces) {
    if (p.owner !== id) continue;
    const cs = rt.cities[p.id];
    s.cities++; s.population += p.pop; s.gold += cs.gold; s.food += cs.food;
    addUnits(s.units, cs.garrison);
    const r = cityRates(p, c?.military.quality ?? 1);
    s.goldPerMin += r.gold; s.foodPerMin += r.food;
  }
  s.soldiers = soldiersOf(s.units); s.ships = s.units.fleet;
  return s;
}
/** Keeps the legacy per-country fields (army size, treasury, province count) in step with the cities. */
export function syncCountries(w: World): void {
  const rt = rtOf(w);
  const sold = new Map<CountryId, { s: number; g: number; n: number; pop: number }>();
  for (const p of w.provinces) {
    if (!p.owner) continue;
    const e = sold.get(p.owner) ?? { s: 0, g: 0, n: 0, pop: 0 };
    const cs = rt.cities[p.id];
    e.s += soldiersOf(cs.garrison); e.g += cs.gold; e.n++; e.pop += p.pop;
    sold.set(p.owner, e);
  }
  for (const c of Object.values(w.countries)) {
    const e = sold.get(c.id);
    if (!e) continue;
    c.military.regiments = e.s / 1000; c.economy.treasury = e.g; c.provinceCount = e.n; c.pop.total = e.pop;
  }
}

// ---------------------------------------------------------------- income
export function accrueIncome(w: World, dt: number): void {
  const rt = rtOf(w);
  rt.incomeAcc += dt;
  if (rt.incomeAcc < 1) return;
  const d = rt.incomeAcc / 60; rt.incomeAcc = 0;
  for (const p of w.provinces) {
    if (!p.owner) continue;
    const c = w.countries[p.owner];
    if (!c) continue;
    const r = cityRates(p, c.military.quality);
    const cs = rt.cities[p.id];
    cs.gold += r.gold * d; cs.food += r.food * d;
  }
}

// ---------------------------------------------------------------- country-wide stock helpers
export function takeGold(w: World, owner: CountryId, amount: number): boolean {
  const rt = rtOf(w);
  const list = ownedOf(w, owner).map((i) => rt.cities[i]);
  if (list.reduce((s, c) => s + c.gold, 0) < amount) return false;
  list.sort((a, b) => b.gold - a.gold);
  let need = amount;
  for (const c of list) { const x = Math.min(c.gold, need); c.gold -= x; need -= x; if (need <= 0) break; }
  return true;
}
export function takeFood(w: World, owner: CountryId, amount: number): boolean {
  const rt = rtOf(w);
  const list = ownedOf(w, owner).map((i) => rt.cities[i]);
  if (list.reduce((s, c) => s + c.food, 0) < amount) return false;
  list.sort((a, b) => b.food - a.food);
  let need = amount;
  for (const c of list) { const x = Math.min(c.food, need); c.food -= x; need -= x; if (need <= 0) break; }
  return true;
}
function homeOf(w: World, owner: CountryId): number {
  const c = w.countries[owner];
  if (c && w.provinces[c.capital]?.owner === owner) return c.capital;
  return ownedOf(w, owner)[0] ?? -1;
}
export function giveStock(w: World, owner: CountryId, gold: number, food: number, near?: number): void {
  const rt = rtOf(w);
  const pid = near !== undefined && w.provinces[near]?.owner === owner ? near : homeOf(w, owner);
  if (pid < 0) return;
  rt.cities[pid].gold += gold; rt.cities[pid].food += food;
}
/** Removes `n` soldiers (proportionally by type, never ships) from the owner's garrisons. */
export function takeSoldiers(w: World, owner: CountryId, n: number): Units {
  const rt = rtOf(w);
  const out = emptyUnits();
  const ids = ownedOf(w, owner);
  const total = ids.reduce((s, i) => s + soldiersOf(rt.cities[i].garrison), 0);
  if (total <= 0 || n <= 0) return out;
  const f = Math.min(1, n / total);
  for (const i of ids) for (const kd of LAND_KINDS) {
    const x = Math.floor(rt.cities[i].garrison[kd] * f);
    rt.cities[i].garrison[kd] -= x; out[kd] += x;
  }
  return out;
}
export function giveUnits(w: World, owner: CountryId, u: Units, near?: number): void {
  const rt = rtOf(w);
  const pid = near !== undefined && w.provinces[near]?.owner === owner ? near : homeOf(w, owner);
  if (pid >= 0) addUnits(rt.cities[pid].garrison, u);
}

// ---------------------------------------------------------------- actions on a city
export function recruit(w: World, owner: CountryId, pid: number, kind: UnitKind, n: number): RtResult {
  const rt = rtOf(w);
  const p = w.provinces[pid], cs = rt.cities[pid];
  n = Math.floor(n);
  if (!p || p.owner !== owner || !cs) return failR('This is not your city.');
  if (!(n > 0)) return failR('Enter a number above zero.');
  if (kind === 'fleet' && !p.coastal) return failR('Fleets can only be built in coastal cities.');
  if (kind !== 'mercenary' && kind !== 'fleet') {
    const cap = Math.max(0, Math.floor(p.pop * MANPOWER_SHARE) - soldiersOf(cs.garrison));
    if (n > cap) return failR('Not enough people to recruit here (max {max}).', { max: cap });
  }
  const cost = unitCost(kind, n);
  if (cs.gold < cost.gold || cs.food < cost.food) return failR('You do not have enough resources: need {gold} gold and {food} food.', cost);
  cs.gold -= cost.gold; cs.food -= cost.food; cs.garrison[kind] += n;
  return okR('Recruited {n} units.', { n });
}
export function maxRecruit(w: World, pid: number, kind: UnitKind): number {
  const rt = rtOf(w);
  const p = w.provinces[pid], cs = rt.cities[pid];
  if (!p || !cs || (kind === 'fleet' && !p.coastal)) return 0;
  const u = UNIT[kind];
  let m = Math.min(Math.floor(cs.gold / u.gold), u.food > 0 ? Math.floor(cs.food / u.food) : Infinity);
  if (kind !== 'mercenary' && kind !== 'fleet') m = Math.min(m, Math.max(0, Math.floor(p.pop * MANPOWER_SHARE) - soldiersOf(cs.garrison)));
  return Math.max(0, m);
}
export function tradeFood(w: World, owner: CountryId, pid: number, amount: number, mode: 'buy' | 'sell'): RtResult {
  const rt = rtOf(w);
  const p = w.provinces[pid], cs = rt.cities[pid];
  amount = Math.floor(amount);
  if (!p || p.owner !== owner || !cs) return failR('This is not your city.');
  if (!(amount > 0)) return failR('Enter a number above zero.');
  if (mode === 'buy') {
    const cost = Math.ceil(amount * FOOD_BUY);
    if (cs.gold < cost) return failR('You do not have enough resources: need {gold} gold and {food} food.', { gold: cost, food: 0 });
    cs.gold -= cost; cs.food += amount;
    return okR('Bought {n} food.', { n: amount });
  }
  if (cs.food < amount) return failR('You do not have enough resources: need {gold} gold and {food} food.', { gold: 0, food: amount });
  cs.food -= amount; cs.gold += Math.floor(amount * FOOD_SELL);
  return okR('Sold {n} food.', { n: amount });
}
export type BuildKind = 'fort' | 'market' | 'farms';
export function buildCost(level: number): number { return Math.round(250 * Math.pow(level + 1, 1.7)); }
export function build(w: World, owner: CountryId, pid: number, what: BuildKind): RtResult {
  const rt = rtOf(w);
  const p = w.provinces[pid], cs = rt.cities[pid];
  if (!p || p.owner !== owner || !cs) return failR('This is not your city.');
  const lvl = p[what];
  if (lvl >= 5) return failR('Already at the maximum level.');
  const cost = buildCost(lvl);
  if (cs.gold < cost) return failR('You do not have enough resources: need {gold} gold and {food} food.', { gold: cost, food: 0 });
  cs.gold -= cost; p[what] = lvl + 1;
  return okR('Built.', {});
}

export function relationKey(a: CountryId, b: CountryId): string { return a < b ? `${a}|${b}` : `${b}|${a}`; }
export function truceActive(w: World, a: CountryId, b: CountryId): boolean {
  const rt = rtOf(w);
  return (rt.truces[relationKey(a, b)] ?? 0) > rt.t;
}
export { UNIT_KINDS };
