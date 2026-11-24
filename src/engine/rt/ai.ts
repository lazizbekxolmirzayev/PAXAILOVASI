// AI countries act in real time: they recruit, defend when warned, march on weak neighbours and make peace.
import type { Country, CountryId, MapStatic, UnitKind, World } from '../../types/game';
import { declareWar } from '../military';
import { isAtWar, peekRelation } from '../util';
import { rand } from '../rng';
import { countryStats, isHuman, maxRecruit, notify, nextId, ownedOf, recruit, rtOf, tradeFood, truceActive } from './state';
import { defenceFactor, qualityOf, sendMarch } from './war';
import { endWarRt, proposePeace } from './dipl';
import { LAND_KINDS, UNIT_KINDS, emptyUnits, soldiersOf } from './units';
import type { RtOffer } from '../../types/game';

const ARMY_MIX: [UnitKind, number][] = [['spear', 0.3], ['shield', 0.25], ['archer', 0.2], ['cavalry', 0.15], ['guard', 0.1]];
const DEFENCE_MIX: [UnitKind, number][] = [['shield', 0.35], ['spear', 0.3], ['archer', 0.2], ['guard', 0.15]];
const AI_WAR_CAP = 45; // maximum simultaneous wars the AI will start

export function enemiesOf(w: World, id: CountryId): Set<CountryId> {
  const out = new Set<CountryId>();
  for (const x of w.wars) {
    if (x.ended) continue;
    if (x.attackers.includes(id)) for (const d of x.defenders) out.add(d);
    else if (x.defenders.includes(id)) for (const a of x.attackers) out.add(a);
  }
  return out;
}

function spend(w: World, owner: CountryId, pid: number, share: number, mix: [UnitKind, number][], frac: number): void {
  const cs = rtOf(w).cities[pid];
  const budget = cs.gold * frac;
  for (const [kind, f] of mix) {
    const unitGold = kind === 'guard' ? 26 : kind === 'cavalry' ? 14 : kind === 'shield' ? 8 : kind === 'archer' ? 6 : 4;
    const n = Math.min(Math.floor(budget * f * share / unitGold), maxRecruit(w, pid, kind));
    if (n >= 1) recruit(w, owner, pid, kind, n);
  }
}

/** Defenders are warned when an army sets out; AI cities scramble: emergency levies plus help from neighbours. */
function reactToMarches(w: World, st: MapStatic): void {
  const rt = rtOf(w);
  for (const m of rt.marches) {
    if (m.kind !== 'attack' || rt.handled[m.id] || rt.t < m.startT + 6) continue;
    rt.handled[m.id] = true;
    const owner = w.provinces[m.to].owner;
    if (!owner || isHuman(w, owner)) continue;
    spend(w, owner, m.to, 1, DEFENCE_MIX, 0.9);
    const seen = new Set<number>([m.to]);
    const ring: number[] = [];
    for (const j of st.adjacency[m.to] ?? []) { seen.add(j); if (w.provinces[j].owner === owner) ring.push(j); }
    for (const j of [...ring]) for (const k of st.adjacency[j] ?? []) { if (!seen.has(k) && w.provinces[k].owner === owner) { seen.add(k); ring.push(k); } }
    for (const j of ring.slice(0, 8)) {
      const cs = rt.cities[j];
      if (soldiersOf(cs.garrison) < 40) continue;
      const border = (st.adjacency[j] ?? []).some((q) => { const o = w.provinces[q].owner; return o && o !== owner && isAtWar(w, owner, o) && q !== m.to; });
      const u = emptyUnits();
      for (const k of UNIT_KINDS) if (k !== 'fleet') u[k] = Math.floor(cs.garrison[k] * (border ? 0.3 : 0.65));
      if (soldiersOf(u) >= 15) sendMarch(w, st, owner, j, m.to, 'support', u);
    }
  }
}

function think(w: World, st: MapStatic, c: Country): void {
  const rt = rtOf(w);
  const ids = ownedOf(w, c.id);
  if (!ids.length) return;
  const enemies = enemiesOf(w, c.id);
  const atWar = enemies.size > 0;
  const isBorder = (pid: number) => (st.adjacency[pid] ?? []).some((j) => { const o = w.provinces[j].owner; return o && o !== c.id; });

  // 1. economy & recruiting (bigger countries only touch a random subset each round)
  const sample = ids.length > 40 ? ids.filter(() => rand(w) < 40 / ids.length) : ids;
  for (const pid of sample) {
    const cs = rt.cities[pid];
    if (cs.gold < 50) continue;
    const border = isBorder(pid);
    const frac = border ? (atWar ? 0.8 : 0.55) : (atWar ? 0.35 : 0.2);
    spend(w, c.id, pid, 1, ARMY_MIX, frac);
    if (atWar && border && cs.gold > 1500) { const n = Math.min(Math.floor(cs.gold * 0.1 / 42), maxRecruit(w, pid, 'mercenary')); if (n >= 1) recruit(w, c.id, pid, 'mercenary', n); }
    if (cs.food < 60 && cs.gold > 250) tradeFood(w, c.id, pid, 100, 'buy');
  }

  // 2. offensive: strike weak enemy neighbours
  if (atWar) {
    let sends = 0;
    const order = [...ids].sort(() => rand(w) - 0.5);
    for (const i of order) {
      if (sends >= 4) break;
      const cs = rt.cities[i];
      const G = soldiersOf(cs.garrison);
      if (G < 80 || rt.marches.some((m) => m.from === i && m.owner === c.id && m.kind === 'attack')) continue;
      let best = -1, bestRatio = 0;
      for (const j of st.adjacency[i] ?? []) {
        const o = w.provinces[j].owner;
        if (!o || !enemies.has(o)) continue;
        const D = soldiersOf(rt.cities[j].garrison) * defenceFactor(w, j) * (qualityOf(w, o) / qualityOf(w, c.id)) + 12;
        const ratio = G * 0.75 / D;
        if (ratio > bestRatio) { bestRatio = ratio; best = j; }
      }
      if (best >= 0 && bestRatio >= 1.4) {
        const u = emptyUnits();
        for (const k of LAND_KINDS) u[k] = Math.floor(cs.garrison[k] * 0.75);
        if (sendMarch(w, st, c.id, i, best, 'attack', u).ok) sends++;
      }
    }
    // reinforce the front from quiet interior cities
    let moves = 0;
    for (const i of order) {
      if (moves >= 3) break;
      const cs = rt.cities[i];
      if (soldiersOf(cs.garrison) < 120) continue;
      const front = (pid: number) => (st.adjacency[pid] ?? []).some((j) => { const o = w.provinces[j].owner; return o && enemies.has(o); });
      if (front(i)) continue;
      const target = (st.adjacency[i] ?? []).find((j) => w.provinces[j].owner === c.id && front(j));
      if (target === undefined) continue;
      const u = emptyUnits();
      for (const k of LAND_KINDS) u[k] = Math.floor(cs.garrison[k] * 0.6);
      if (sendMarch(w, st, c.id, i, target, 'support', u).ok) moves++;
    }
    return;
  }

  // 3. opportunism: attack a clearly weaker neighbour now and then
  if (rt.t < 90 || rand(w) > 0.12) return;
  if (w.wars.filter((x) => !x.ended).length >= AI_WAR_CAP) return;
  const mine = countryStats(w, c.id).soldiers + 30;
  const seen = new Set<CountryId>();
  let target: CountryId | null = null, bestRatio = 0;
  for (const i of ids) for (const j of st.adjacency[i] ?? []) {
    const o = w.provinces[j].owner;
    if (!o || o === c.id || seen.has(o)) continue;
    seen.add(o);
    const oc = w.countries[o];
    if (!oc?.alive) continue;
    const rel = peekRelation(w, c.id, o);
    if (rel?.treaties.alliance || truceActive(w, c.id, o) || c.overlord === o || oc.overlord === c.id || (rel?.opinion ?? 0) > 35) continue;
    const ratio = mine / (countryStats(w, o).soldiers + 30);
    const need = isHuman(w, o) ? 2.4 : 1.8;
    if (ratio >= need && ratio > bestRatio) { bestRatio = ratio; target = o; }
  }
  if (target) {
    const war = declareWar(w, c.id, target, 'conquest', st);
    if (war) { rt.warT[war.id] = rt.t; notify(w, target, 'war', { a: c.id }); }
  }
}

/** AI-vs-AI wars end by themselves; wars against a human end with a peace offer. */
function resolveWars(w: World, st: MapStatic): void {
  const rt = rtOf(w);
  for (const war of [...w.wars]) {
    if (war.ended) continue;
    const A = war.attackers[0], D = war.defenders[0];
    if (!w.countries[A]?.alive || !w.countries[D]?.alive) { endWarRt(w, war); continue; }
    if (rt.warT[war.id] === undefined) rt.warT[war.id] = rt.t;
    const age = rt.t - rt.warT[war.id];
    const humanA = war.attackers.some((id) => isHuman(w, id)), humanD = war.defenders.some((id) => isHuman(w, id));
    const sc = war.score;
    if (!humanA && !humanD) {
      if (age > 180 && (Math.abs(sc) >= 25 || (age > 420 && rand(w) < 0.1))) {
        if (Math.abs(sc) >= 25) {
          const winner = sc > 0 ? A : D, loser = sc > 0 ? D : A;
          proposePeace(w, winner, loser, { gold: Math.floor(countryStats(w, loser).gold * 0.2), food: 0, soldiers: 0 });
        }
        if (!war.ended) endWarRt(w, war);
      }
      continue;
    }
    // war with a human: the AI offers terms from time to time
    const human = humanA ? war.attackers.find((id) => isHuman(w, id))! : war.defenders.find((id) => isHuman(w, id))!;
    const ai = humanA ? D : A;
    if (rt.t - (rt.aiOfferT[war.id] ?? -1e9) < 150 || age < 120) continue;
    if (rt.offers.some((o: RtOffer) => o.from === ai && o.to === human)) continue;
    const aiScore = humanA ? -sc : sc;
    const humanGold = countryStats(w, human).gold;
    if (aiScore <= -20 || age > 480) {
      rt.aiOfferT[war.id] = rt.t;
      rt.offers.push({ id: nextId(w, 'o'), t: rt.t, from: ai, to: human, kind: 'peace', terms: { gold: 0, food: 0, soldiers: 0 } });
      notify(w, human, 'offer', { a: ai });
    } else if (aiScore >= 35) {
      rt.aiOfferT[war.id] = rt.t;
      rt.offers.push({ id: nextId(w, 'o'), t: rt.t, from: ai, to: human, kind: 'peace', terms: { gold: Math.floor(humanGold * 0.2), food: 0, soldiers: 0 } });
      notify(w, human, 'offer', { a: ai });
    }
  }
  rt.offers = rt.offers.filter((o) => rt.t - o.t < 240 && w.countries[o.from]?.alive && w.countries[o.to]?.alive);
  void st;
}

export function runAi(w: World, st: MapStatic): void {
  const rt = rtOf(w);
  reactToMarches(w, st);
  if ((rt.nextAi.__wars ?? 0) <= rt.t) { rt.nextAi.__wars = rt.t + 10; resolveWars(w, st); }
  let budget = 14;
  for (const id of w.countryOrder) {
    const c = w.countries[id];
    if (!c?.alive || isHuman(w, id)) continue;
    const next = rt.nextAi[id];
    if (next === undefined) { rt.nextAi[id] = rt.t + rand(w) * 40; continue; }
    if (next > rt.t) continue;
    rt.nextAi[id] = rt.t + 18 + rand(w) * 22;
    think(w, st, c);
    if (--budget <= 0) break;
  }
}
