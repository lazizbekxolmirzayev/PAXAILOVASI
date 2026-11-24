// Marches, battles and conquest in real time.
//  • an army spends TRAVEL_ATTACK seconds on the road; the defender is warned at departure
//  • on arrival a battle lasts at most BATTLE_SECONDS; reinforcements may join either side while it runs
//  • afterwards a report lists soldiers killed, fled, taken prisoner and the food/gold looted
import type { CountryId, MapStatic, RtBattle, Units, War, World, March } from '../../types/game';
import { declareWar, transferProvince } from '../military';
import { isAtWar, peekRelation, clamp } from '../util';
import { rand } from '../rng';
import { BATTLE_SECONDS, TRAVEL_ATTACK, TRAVEL_SUPPORT, failR, giveStock, nextId, notify, okR, rtOf, truceActive, type RtResult } from './state';
import { UNIT, UNIT_KINDS, addUnits, cloneUnits, emptyUnits, hasAny, powerAgainst, rawPower, roundUnits, soldiersOf } from './units';

export const SHIP_CAPACITY = UNIT.fleet.carries ?? 150;
const LANCHESTER_K = 0.035; // equal armies lose about 65% in 30 s
const ROUT_AT = 0.18; // a side routs when its strength falls below 18% of what it started with

export function qualityOf(w: World, id: CountryId): number {
  const c = w.countries[id];
  return c ? c.military.quality * (1 + c.ruler.skill.military * 0.02) : 1;
}
export function routeBetween(w: World, st: MapStatic, from: number, to: number): 'land' | 'sea' | null {
  if (st.adjacency[from]?.includes(to)) return 'land';
  if (w.provinces[from]?.coastal && w.provinces[to]?.coastal && st.seaLinks[from]?.includes(to)) return 'sea';
  return null;
}
export function findWar(w: World, a: CountryId, b: CountryId): War | undefined {
  return w.wars.find((x) => !x.ended && ((x.attackers.includes(a) && x.defenders.includes(b)) || (x.attackers.includes(b) && x.defenders.includes(a))));
}
/** Defender's multiplier from fortifications and terrain. */
export function defenceFactor(w: World, pid: number): number {
  const p = w.provinces[pid];
  return 1 + p.fort * 0.12 + (p.mountain ? 0.25 : 0) + (p.river ? 0.08 : 0) + 0.1;
}

export function nearestOwned(w: World, st: MapStatic, owner: CountryId, start: number): number {
  const seen = new Set<number>([start]);
  let frontier = [start];
  for (let depth = 0; depth < 10 && frontier.length; depth++) {
    const next: number[] = [];
    for (const i of frontier) for (const j of st.adjacency[i] ?? []) {
      if (seen.has(j)) continue;
      seen.add(j);
      if (w.provinces[j].owner === owner) return j;
      next.push(j);
    }
    frontier = next;
  }
  const c = w.countries[owner];
  if (c && w.provinces[c.capital]?.owner === owner) return c.capital;
  return w.provinces.find((p) => p.owner === owner)?.id ?? -1;
}

function bumpScore(w: World, attacker: CountryId, defender: CountryId, delta: number): void {
  const war = findWar(w, attacker, defender);
  if (war) war.score = clamp(war.score + (war.attackers.includes(attacker) ? delta : -delta), -100, 100);
}

// ---------------------------------------------------------------- sending armies and supplies
export function sendMarch(w: World, st: MapStatic, owner: CountryId, from: number, to: number, kind: 'attack' | 'support', units: Units, gold = 0, food = 0): RtResult {
  const rt = rtOf(w);
  const pf = w.provinces[from], pt = w.provinces[to];
  const cs = rt.cities[from];
  if (!pf || !pt || pf.owner !== owner) return failR('This is not your city.');
  if (from === to) return failR('Choose a different destination.');
  const u = emptyUnits();
  for (const k of UNIT_KINDS) u[k] = Math.max(0, Math.floor(units[k] ?? 0));
  gold = Math.max(0, Math.floor(gold)); food = Math.max(0, Math.floor(food));
  for (const k of UNIT_KINDS) if (u[k] > cs.garrison[k] + 1e-6) return failR('There are not enough troops in this city.');
  if (gold > cs.gold + 1e-6 || food > cs.food + 1e-6) return failR('There are not enough supplies in this city.');
  const soldiers = soldiersOf(u);
  if (soldiers < 1 && u.fleet < 1 && gold < 1 && food < 1) return failR('Send at least one unit or some supplies.');
  let sea = false;
  if (kind === 'attack') {
    const defender = pt.owner;
    if (!defender || defender === owner) return failR('You can only attack cities of other nations.');
    if (soldiers < 1) return failR('Send at least one unit or some supplies.');
    const route = routeBetween(w, st, from, to);
    if (!route) return failR('This city is out of reach: only neighbouring cities, or ports across the sea, can be attacked.');
    sea = route === 'sea';
    if (sea) {
      const need = Math.ceil(soldiers / SHIP_CAPACITY);
      if (u.fleet < need) return failR('Crossing the sea needs {ships} ships.', { ships: need });
    }
    if (!isAtWar(w, owner, defender)) {
      if (peekRelation(w, owner, defender)?.treaties.alliance) return failR('You are allied with this nation.');
      if (truceActive(w, owner, defender)) return failR('A truce is in force with this nation.');
      const war = declareWar(w, owner, defender, 'conquest', st);
      if (!war) return failR('War cannot be declared on this nation.');
      rt.warT[war.id] = rt.t;
      notify(w, defender, 'war', { a: owner });
      notify(w, owner, 'war', { a: owner, d: defender });
    }
    gold = 0; food = 0;
  } else if (pt.owner !== owner) return failR('Support can only be sent to your own cities.');
  for (const k of UNIT_KINDS) cs.garrison[k] -= u[k];
  cs.gold -= gold; cs.food -= food;
  const m: March = { id: nextId(w, 'm'), owner, from, to, kind, units: u, gold, food, startT: rt.t, arriveT: rt.t + (kind === 'attack' ? TRAVEL_ATTACK : sea ? TRAVEL_ATTACK : TRAVEL_SUPPORT), sea };
  rt.marches.push(m);
  if (kind === 'attack') {
    const approx = Math.max(10, Math.round(soldiers * (0.85 + rand(w) * 0.3) / 10) * 10);
    notify(w, pt.owner!, 'incoming', { a: owner, from, n: approx, secs: TRAVEL_ATTACK }, to);
  }
  return okR(kind === 'attack' ? 'The army marches! It arrives in about {secs} seconds.' : 'Reinforcements are on their way ({secs} s).', { secs: Math.round(m.arriveT - rt.t) });
}

/** Sends `fraction` of the units (not ships) of every border city of `owner` that touches `enemy` at the weakest neighbouring enemy city. */
export function campaignAgainst(w: World, st: MapStatic, owner: CountryId, enemy: CountryId, fraction: number): RtResult {
  const rt = rtOf(w);
  let sent = 0;
  for (const p of w.provinces) {
    if (p.owner !== owner) continue;
    const cs = rt.cities[p.id];
    if (soldiersOf(cs.garrison) < 20) continue;
    let best = -1, bestDef = Infinity;
    for (const j of st.adjacency[p.id] ?? []) {
      if (w.provinces[j].owner !== enemy) continue;
      const d = soldiersOf(rt.cities[j].garrison) * defenceFactor(w, j);
      if (d < bestDef) { bestDef = d; best = j; }
    }
    if (best < 0) continue;
    const u = emptyUnits();
    for (const k of UNIT_KINDS) if (k !== 'fleet') u[k] = Math.floor(cs.garrison[k] * fraction);
    if (soldiersOf(u) < 10) continue;
    const r = sendMarch(w, st, owner, p.id, best, 'attack', u);
    if (r.ok) sent++;
    else if (r.key.startsWith('A truce') || r.key.startsWith('You are allied')) return r;
  }
  return sent ? okR('{n} armies marched out.', { n: sent }) : failR('None of your cities borders this nation with enough troops.');
}

// ---------------------------------------------------------------- retreat
export function retreat(w: World, st: MapStatic, owner: CountryId, fromPid: number, units: Units, prefer?: number): void {
  const rt = rtOf(w);
  const u = roundUnits(units);
  if (!hasAny(u)) return;
  const dest = prefer !== undefined && w.provinces[prefer]?.owner === owner ? prefer : nearestOwned(w, st, owner, fromPid);
  if (dest < 0) return;
  rt.marches.push({ id: nextId(w, 'm'), owner, from: fromPid, to: dest, kind: 'retreat', units: u, gold: 0, food: 0, startT: rt.t, arriveT: rt.t + TRAVEL_SUPPORT, sea: false });
}

// ---------------------------------------------------------------- arrivals
export function sideOf(w: World, b: RtBattle, id: CountryId): 'a' | 'd' | null {
  if (id === b.attacker) return 'a';
  if (id === b.defender) return 'd';
  const war = findWar(w, b.attacker, b.defender);
  if (war) { if (war.attackers.includes(id)) return 'a'; if (war.defenders.includes(id)) return 'd'; }
  return null;
}
function joinBattle(w: World, b: RtBattle, side: 'a' | 'd', u: Units): void {
  const naval = w.provinces[b.province].coastal;
  const q = qualityOf(w, side === 'a' ? b.attacker : b.defender);
  if (side === 'a') { addUnits(b.a, u); addUnits(b.aStart, u); b.aPower0 += rawPower(u, naval) * q; b.a0 += soldiersOf(u); b.routedA = false; }
  else { addUnits(b.d, u); addUnits(b.dStart, u); b.dPower0 += rawPower(u, naval) * q; b.d0 += soldiersOf(u); b.routedD = false; }
}

function startBattle(w: World, m: March): void {
  const rt = rtOf(w);
  const p = w.provinces[m.to], cs = rt.cities[m.to];
  const defender = p.owner!;
  const d = cloneUnits(cs.garrison);
  cs.garrison = emptyUnits();
  const a = cloneUnits(m.units);
  const naval = p.coastal;
  const qa = qualityOf(w, m.owner), qd = qualityOf(w, defender);
  const empty = soldiersOf(d) + (naval ? d.fleet : 0) < 1;
  rt.battles.push({
    id: nextId(w, 'b'), province: m.to, attacker: m.owner, defender, from: m.from, startT: rt.t, endT: rt.t + (empty ? 5 : BATTLE_SECONDS),
    a, d, a0: soldiersOf(a), d0: soldiersOf(d), aPower0: rawPower(a, naval) * qa, dPower0: rawPower(d, naval) * qd,
    aStart: cloneUnits(a), dStart: cloneUnits(d), routedA: false, routedD: false, luckA: 0.92 + rand(w) * 0.16, luckD: 0.92 + rand(w) * 0.16,
  });
}

function arrive(w: World, st: MapStatic, m: March): void {
  const rt = rtOf(w);
  const p = w.provinces[m.to], cs = rt.cities[m.to];
  const b = rt.battles.find((x) => x.province === m.to);
  if (m.kind === 'attack') {
    if (p.owner === m.owner) { m.kind = 'support'; }
    else if (p.owner && isAtWar(w, m.owner, p.owner)) {
      if (b) {
        const side = sideOf(w, b, m.owner);
        if (side) { joinBattle(w, b, side, m.units); return; }
        m.arriveT = rt.t + 5; rt.marches.push(m); return; // a third army waits for the fight to end
      }
      startBattle(w, m); return;
    } else { retreat(w, st, m.owner, m.to, m.units, m.from); return; } // peace was made on the road
  }
  if (p.owner === m.owner) {
    cs.gold += m.gold; cs.food += m.food;
    if (b && sideOf(w, b, m.owner) === 'd') joinBattle(w, b, 'd', m.units);
    else addUnits(cs.garrison, m.units);
    if (m.kind === 'support') notify(w, m.owner, 'support', { n: Math.round(soldiersOf(m.units)) }, m.to);
  } else {
    // the destination changed hands while the column marched: try the nearest friendly city
    const dest = nearestOwned(w, st, m.owner, m.to);
    if (dest >= 0 && dest !== m.to) {
      rt.marches.push({ ...m, from: m.to, to: dest, kind: 'retreat', startT: rt.t, arriveT: rt.t + TRAVEL_SUPPORT });
    }
  }
}

export function processMarches(w: World, st: MapStatic): void {
  const rt = rtOf(w);
  if (!rt.marches.length) return;
  const due = rt.marches.filter((m) => m.arriveT <= rt.t).sort((a, b) => a.arriveT - b.arriveT);
  if (!due.length) return;
  rt.marches = rt.marches.filter((m) => m.arriveT > rt.t);
  for (const m of due) arrive(w, st, m);
  for (const id of Object.keys(rt.handled)) if (!rt.marches.some((m) => m.id === id)) delete rt.handled[id];
}

// ---------------------------------------------------------------- battles
function pool(u: Units, q: number, naval: boolean): number { return rawPower(u, naval) * q; }
function scaleSide(u: Units, f: number, naval: boolean): void {
  for (const k of UNIT_KINDS) { if (k === 'fleet' && !naval) continue; u[k] *= f; }
}

function stepBattle(w: World, b: RtBattle, dt: number): void {
  const p = w.provinces[b.province];
  const naval = p.coastal;
  const qa = qualityOf(w, b.attacker), qd = qualityOf(w, b.defender);
  const poolA = pool(b.a, qa, naval), poolD = pool(b.d, qd, naval);
  if (poolA <= 0 || poolD <= 0) return;
  const pa = b.routedA ? 0 : powerAgainst(b.a, b.d, qa, naval) * b.luckA;
  const pd = b.routedD ? 0 : powerAgainst(b.d, b.a, qd, naval) * b.luckD;
  const T = defenceFactor(w, b.province);
  const fracD = Math.min(1, (LANCHESTER_K * pa * dt / T) / poolD);
  const fracA = Math.min(1, (LANCHESTER_K * pd * dt) / poolA);
  scaleSide(b.d, 1 - fracD, naval);
  scaleSide(b.a, 1 - fracA, naval);
  if (pool(b.a, qa, naval) < b.aPower0 * ROUT_AT) b.routedA = true;
  if (pool(b.d, qd, naval) < b.dPower0 * ROUT_AT) b.routedD = true;
}

export function processBattles(w: World, st: MapStatic, dt: number): void {
  const rt = rtOf(w);
  if (!rt.battles.length) return;
  for (const b of [...rt.battles]) {
    const naval = w.provinces[b.province].coastal;
    stepBattle(w, b, dt);
    const elapsed = rt.t - b.startT;
    const aLeft = soldiersOf(b.a) + (naval ? b.a.fleet : 0), dLeft = soldiersOf(b.d) + (naval ? b.d.fleet : 0);
    const decided = aLeft < 1 || dLeft < 1 || ((b.routedA || b.routedD) && elapsed >= 12);
    if (rt.t >= b.endT || decided && elapsed >= Math.min(6, b.endT - b.startT)) finishBattle(w, st, b);
  }
}

/** Fraction of a battle completed (0..1) for UI progress bars. */
export function battleProgress(w: World, b: RtBattle): number {
  const rt = rtOf(w);
  return clamp((rt.t - b.startT) / Math.max(1, b.endT - b.startT), 0, 1);
}

function finishBattle(w: World, st: MapStatic, b: RtBattle): void {
  const rt = rtOf(w);
  rt.battles = rt.battles.filter((x) => x !== b);
  const p = w.provinces[b.province], cs = rt.cities[b.province];
  const naval = p.coastal;
  const qa = qualityOf(w, b.attacker), qd = qualityOf(w, b.defender);
  const aAlive = soldiersOf(b.a) + (naval ? b.a.fleet : 0) >= 1, dAlive = soldiersOf(b.d) + (naval ? b.d.fleet : 0) >= 1;
  let attackersWin: boolean;
  if (!dAlive && aAlive) attackersWin = true;
  else if (!aAlive) attackersWin = false;
  else if (b.routedD && !b.routedA) attackersWin = true;
  else if (b.routedA && !b.routedD) attackersWin = false;
  else attackersWin = pool(b.a, qa, naval) / Math.max(1, b.aPower0) > pool(b.d, qd, naval) / Math.max(1, b.dPower0);
  const aLeft = roundUnits(b.a), dLeft = roundUnits(b.d);
  const aStartS = soldiersOf(b.aStart), dStartS = soldiersOf(b.dStart);
  const aRem = soldiersOf(aLeft), dRem = soldiersOf(dLeft);
  let aKilled = Math.max(0, aStartS - aRem), dKilled = Math.max(0, dStartS - dRem);
  let aFled = 0, dFled = 0, prisoners = 0;
  if (attackersWin) { prisoners = Math.round(dKilled * 0.25); dKilled -= prisoners; dFled = dRem; }
  else { prisoners = Math.round(aKilled * 0.25); aKilled -= prisoners; aFled = aRem; }
  const hostile = isAtWar(w, b.attacker, b.defender) && p.owner === b.defender;
  let captured = false, lootGold = 0, lootFood = 0;
  const wasCapital = w.countries[b.defender]?.capital === b.province;

  if (attackersWin && hostile) {
    captured = true;
    lootGold = Math.floor(cs.gold * 0.5); lootFood = Math.floor(cs.food * 0.5);
    cs.gold -= lootGold; cs.food -= lootFood;
    transferProvince(w, b.province, b.attacker);
    cs.garrison = emptyUnits(); addUnits(cs.garrison, aLeft);
    giveStock(w, b.attacker, lootGold, lootFood, b.from);
    const old = w.countries[b.defender];
    if (old?.alive && wasCapital) {
      let best = -1, pop = -1;
      for (const q of w.provinces) if (q.owner === old.id && q.pop > pop) { pop = q.pop; best = q.id; }
      if (best >= 0) old.capital = best;
    }
    retreat(w, st, b.defender, b.province, dLeft);
    bumpScore(w, b.attacker, b.defender, wasCapital ? 24 : 12);
    notify(w, b.attacker, 'captured', { d: b.defender }, b.province);
    notify(w, b.defender, 'lost', { a: b.attacker }, b.province);
  } else {
    addUnits(cs.garrison, dLeft);
    retreat(w, st, b.attacker, b.province, aLeft, b.from);
    if (hostile) bumpScore(w, b.attacker, b.defender, attackersWin ? 3 : -6);
  }

  const winner = attackersWin && hostile ? b.attacker : attackersWin ? b.attacker : b.defender;
  rt.reports.push({
    id: nextId(w, 'r'), t: rt.t, province: b.province, attacker: b.attacker, defender: b.defender, winner,
    aStart: aStartS, dStart: dStartS, aKilled, dKilled, aFled, dFled, prisoners, lootGold, lootFood, captured, seen: false,
  });
  if (rt.reports.length > 40) rt.reports.splice(0, rt.reports.length - 40);
  w.stats.battles++;
  const youWon = (id: CountryId) => id === winner;
  notify(w, b.attacker, youWon(b.attacker) ? 'battleWon' : 'battleLost', { a: b.attacker, d: b.defender }, b.province);
  notify(w, b.defender, youWon(b.defender) ? 'battleWon' : 'battleLost', { a: b.attacker, d: b.defender }, b.province);
}

/** estimate of how well `units` would do against a garrison (for UI hints): >1 favours the attacker */
export function estimateOdds(w: World, pid: number, attacker: CountryId, units: Units): number {
  const rt = rtOf(w);
  const p = w.provinces[pid];
  if (!p.owner) return 0;
  const d = rt.cities[pid].garrison;
  const qa = qualityOf(w, attacker), qd = qualityOf(w, p.owner);
  const pa = powerAgainst(units, d, qa, p.coastal), pd = powerAgainst(d, units, qd, p.coastal) * defenceFactor(w, pid);
  if (pd <= 0) return 99;
  return pa / pd;
}
