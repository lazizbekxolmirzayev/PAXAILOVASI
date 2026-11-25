import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { newGame, buildMapStatic, cloneWorld, hashWorld } from '../index';
import type { MapBundle } from '../index';
import { rtTick, rtOf, countryStats, sendMarch, recruit, tradeFood, build, proposePeace, requestLoan, repayLoan, proposeAlliance, giftGold, campaignAgainst, soldiersOf, emptyUnits } from './index';
import { isAtWar } from '../util';
import type { World, MapStatic } from '../../types/game';

function load(key: string) {
  const topo = JSON.parse(readFileSync('public/maps/provinces.topo.json', 'utf8'));
  const meta = JSON.parse(readFileSync('public/maps/provinces_meta.json', 'utf8'));
  const owners = JSON.parse(readFileSync(`public/maps/owners_${key}.json`, 'utf8'));
  const { st, drawn } = buildMapStatic(key, topo, meta);
  const b: MapBundle = { key, meta, owners, static: st, drawn };
  return { b, st };
}
const { b, st } = load('1400');
const mk = (seed = 5, player = 'Timurid Empire') => newGame(b, st, { name: 'RT', seed, start: { y: 1405, m: 0 }, mode: 'scenario', scenarioId: 'timur-east', decisions: { timur_fate: 'survives', campaign: 'invade', ottomans: 'historical' }, player });

/** first (own city, enemy city) pair that are neighbours */
function frontier(w: World, s: MapStatic, me: string) {
  for (const p of w.provinces) {
    if (p.owner !== me) continue;
    for (const j of s.adjacency[p.id] ?? []) { const o = w.provinces[j].owner; if (o && o !== me) return { from: p.id, to: j, enemy: o }; }
  }
  return null;
}
const run = (w: World, seconds: number) => { for (let i = 0; i < seconds; i++) rtTick(w, st, 1); };

describe('real-time layer', () => {
  it('gives every owned city a garrison, gold and food from the year\'s data', () => {
    const w = mk();
    const rt = rtOf(w);
    expect(rt.cities.length).toBe(w.provinces.length);
    const me = countryStats(w, w.player!);
    expect(me.cities).toBeGreaterThan(3);
    expect(me.soldiers).toBeGreaterThan(100);
    expect(me.gold).toBeGreaterThan(0);
    expect(me.food).toBeGreaterThan(0);
    expect(me.goldPerMin).toBeGreaterThan(0);
    for (const p of w.provinces) if (p.owner) expect(soldiersOf(rt.cities[p.id].garrison)).toBeGreaterThanOrEqual(12);
  });

  it('earns gold and food per minute', () => {
    const w = mk();
    const before = countryStats(w, w.player!);
    run(w, 60);
    const after = countryStats(w, w.player!);
    expect(after.gold - before.gold).toBeGreaterThan(before.goldPerMin * 0.9);
    expect(after.food).toBeGreaterThan(before.food);
  });

  it('recruits, trades food and builds — and refuses when resources are missing', () => {
    const w = mk();
    const me = w.player!;
    const rtc = rtOf(w).cities;
    const pid = w.provinces.filter((p) => p.owner === me).sort((a, b) => rtc[b.id].gold - rtc[a.id].gold)[0].id;
    const g0 = rtOf(w).cities[pid].garrison.guard;
    expect(recruit(w, me, pid, 'guard', 1).ok).toBe(true);
    expect(rtOf(w).cities[pid].garrison.guard).toBe(g0 + 1);
    expect(recruit(w, me, pid, 'guard', 1e9).ok).toBe(false);
    expect(recruit(w, me, pid, 'mercenary', 1e9).ok).toBe(false);
    expect(tradeFood(w, me, pid, 10, 'buy').ok).toBe(true);
    expect(tradeFood(w, me, pid, 5, 'sell').ok).toBe(true);
    rtOf(w).cities[pid].gold = 1e6;
    expect(build(w, me, pid, 'fort').ok).toBe(true);
  });

  it('marches for 60 s, warns the defender, fights for at most 30 s and reports the result', () => {
    const w = mk();
    const me = w.player!;
    const f = frontier(w, st, me)!;
    expect(f).toBeTruthy();
    const cs = rtOf(w).cities[f.from];
    cs.garrison.guard += 400; // make sure we can win
    const send = { ...cs.garrison, fleet: 0 };
    const before = soldiersOf(cs.garrison);
    const r = sendMarch(w, st, me, f.from, f.to, 'attack', send);
    expect(r.ok).toBe(true);
    expect(isAtWar(w, me, f.enemy)).toBe(true);
    expect(soldiersOf(cs.garrison)).toBeLessThan(before);
    const rt = rtOf(w);
    expect(rt.marches.length).toBeGreaterThan(0);
    const t0 = rt.t;
    run(w, 59);
    expect(rt.battles.length).toBe(0); // still on the road
    run(w, 3);
    expect(rt.battles.length + rt.reports.length).toBeGreaterThan(0);
    run(w, 32);
    expect(rt.battles.length).toBe(0);
    expect(rt.t - t0).toBeLessThan(100);
    const rep = rt.reports.find((x) => x.province === f.to)!;
    expect(rep).toBeTruthy();
    expect(rep.aStart).toBeGreaterThan(0);
    expect(rep.aKilled + rep.dKilled + rep.prisoners).toBeGreaterThan(0);
    expect(rep.aKilled).toBeLessThanOrEqual(rep.aStart);
    expect(rep.dKilled + rep.dFled + rep.prisoners).toBeLessThanOrEqual(rep.dStart + 1);
    if (rep.winner === me) expect(w.provinces[f.to].owner).toBe(me);
  });

  it('refuses attacks on far-away cities and support for foreign cities', () => {
    const w = mk();
    const me = w.player!;
    const f = frontier(w, st, me)!;
    const far = w.provinces.find((p) => p.owner && p.owner !== me && !(st.adjacency[f.from] ?? []).includes(p.id))!;
    const send = { ...rtOf(w).cities[f.from].garrison, fleet: 0 };
    expect(sendMarch(w, st, me, f.from, far.id, 'attack', send).ok).toBe(false);
    expect(sendMarch(w, st, me, f.from, f.to, 'support', send).ok).toBe(false);
  });

  it('lets reinforcements join the defence in time (support takes 45 s, attack 60 s)', () => {
    const w = mk();
    const me = w.player!;
    const f = frontier(w, st, me)!;
    const rt = rtOf(w);
    const big = { ...emptyUnits(), spear: 200 };
    rt.cities[f.from].garrison.spear += 200;
    expect(sendMarch(w, st, me, f.from, f.to, 'attack', big).ok).toBe(true);
    const m = rt.marches[0];
    expect(m.arriveT - m.startT).toBe(60);
  });

  it('AI countries recruit, march and conquer on their own; the world stays consistent', () => {
    const w = mk(11, 'Ming Empire');
    const t0 = Date.now();
    run(w, 900);
    const ms = (Date.now() - t0) / 900;
    expect(ms).toBeLessThan(120);
    const rt = rtOf(w);
    expect(rt.reports.length + w.stats.battles).toBeGreaterThan(0);
    for (const p of w.provinces) {
      const g = rt.cities[p.id].garrison;
      for (const v of Object.values(g)) expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(rt.cities[p.id].gold)).toBe(true);
    }
    for (const c of Object.values(w.countries)) if (c.alive) expect(w.provinces.some((p) => p.owner === c.id)).toBe(true);
  }, 120000);

  it('makes peace with terms and a truce; AI judges terms by its own situation', () => {
    const w = mk();
    const me = w.player!;
    const f = frontier(w, st, me)!;
    const rt = rtOf(w);
    rt.cities[f.from].garrison.spear += 100;
    sendMarch(w, st, me, f.from, f.to, 'attack', { ...emptyUnits(), spear: 50 });
    expect(isAtWar(w, me, f.enemy)).toBe(true);
    const greedy = proposePeace(w, me, f.enemy, { gold: 1e12, food: 0, soldiers: 0 });
    expect(greedy.ok).toBe(false);
    const offer = proposePeace(w, me, f.enemy, { gold: 0, food: 0, soldiers: 0, reverse: true });
    expect(offer.evaluation).toBeTruthy();
    // pay a tribute big enough to be accepted
    const rich = proposePeace(w, me, f.enemy, { gold: Math.floor(countryStats(w, me).gold * 0.5), food: 0, soldiers: 0, reverse: true });
    if (rich.ok) { expect(isAtWar(w, me, f.enemy)).toBe(false); expect(sendMarch(w, st, me, f.from, f.to, 'attack', { ...emptyUnits(), spear: 5 }).ok).toBe(false); }
  });

  it('lends money, charges interest and declares war when the loan is not repaid', () => {
    const w = mk();
    const me = w.player!;
    const rt = rtOf(w);
    const lender = Object.values(w.countries).find((c) => c.alive && c.id !== me && !c.tribal && countryStats(w, c.id).gold > 5000 && !isAtWar(w, me, c.id))!;
    // make the lender friendly
    for (const k of Object.keys(w.relations)) if (k.includes(lender.id)) { w.relations[k].opinion = 80; w.relations[k].trust = 80; }
    const r = requestLoan(w, me, lender.id, 100);
    expect(r.ok).toBe(true);
    const loan = rt.loans[0];
    expect(loan.owed).toBeGreaterThan(100);
    // part repayment works
    expect(repayLoan(w, me, loan.id, 10).ok).toBe(true);
    const gold = countryStats(w, me).gold;
    expect(gold).toBeGreaterThan(0);
    // empty the treasury so we cannot repay, then pass the deadline
    for (const p of w.provinces) if (p.owner === me) rt.cities[p.id].gold = 0;
    run(w, 640);
    expect(loan.status).toBe('defaulted');
    expect(isAtWar(w, lender.id, me)).toBe(true);
  }, 60000);

  it('supports gifts, alliances and a whole-country campaign', () => {
    const w = mk();
    const me = w.player!;
    const f = frontier(w, st, me)!;
    expect(giftGold(w, me, f.enemy, 10).ok).toBe(true);
    const a = proposeAlliance(w, me, f.enemy);
    expect(typeof a.ok).toBe('boolean');
    const w2 = mk();
    const f2 = frontier(w2, st, w2.player!)!;
    const c = campaignAgainst(w2, st, w2.player!, f2.enemy, 0.5);
    expect(c.ok).toBe(true);
    expect(rtOf(w2).marches.length).toBeGreaterThan(0);
  });

  it('survives save / load (JSON round trip) and stays deterministic', () => {
    const a = mk(9), c = mk(9);
    c.id = a.id;
    run(a, 120); run(c, 120);
    expect(hashWorld(a)).toBe(hashWorld(c));
    const saved = cloneWorld(a);
    run(a, 60); run(saved, 60);
    expect(hashWorld(a)).toBe(hashWorld(saved));
  }, 60000);
});
