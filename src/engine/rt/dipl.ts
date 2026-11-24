// Diplomacy in real time: peace with terms (soldiers / gold / food), alliances, gifts and loans.
import type { AcceptanceBreakdown, CountryId, Loan, MapStatic, RtOffer, War, World } from '../../types/game';
import { declareWar } from '../military';
import { clamp, getRelation, isAtWar, peekRelation } from '../util';
import { countryStats, failR, giveStock, giveUnits, isHuman, nextId, notify, okR, relationKey, rtOf, takeFood, takeGold, takeSoldiers, truceActive, type RtResult } from './state';
import { findWar } from './war';

export interface PeaceTerms { gold: number; food: number; soldiers: number; reverse?: boolean }
export const noTerms = (): PeaceTerms => ({ gold: 0, food: 0, soldiers: 0 });
export const TRUCE_SECONDS = 240;
export const LOAN_SECONDS = 600;
export const LOAN_INTEREST = 0.25;

// ---------------------------------------------------------------- peace
export function evaluatePeaceTerms(w: World, proposer: CountryId, receiver: CountryId, terms: PeaceTerms): AcceptanceBreakdown & { affordable: boolean } {
  const rt = rtOf(w);
  const war = findWar(w, proposer, receiver);
  const factors: { label: string; value: number }[] = [];
  if (!war) return { total: 0, threshold: 0, factors, affordable: false };
  const ps = countryStats(w, proposer), rs = countryStats(w, receiver);
  const sc = war.score * (war.attackers.includes(proposer) ? 1 : -1); // >0: the proposer is winning
  factors.push({ label: 'War score', value: Math.round(sc * 0.6) });
  factors.push({ label: 'Army balance', value: Math.round(Math.log((ps.soldiers + 50) / (rs.soldiers + 50)) * 8) });
  factors.push({ label: 'War weariness', value: Math.min(15, Math.round((rt.t - (rt.warT[war.id] ?? rt.t)) / 60 * 2)) });
  const rel = peekRelation(w, proposer, receiver);
  factors.push({ label: 'Opinion', value: Math.round((rel?.opinion ?? 0) / 12) });
  const payerStats = terms.reverse ? ps : rs;
  const affordable = terms.gold <= payerStats.gold + 1e-6 && terms.food <= payerStats.food + 1e-6 && terms.soldiers <= payerStats.soldiers + 1e-6;
  const burden = terms.gold / Math.max(1, payerStats.gold) * 40 + terms.food / Math.max(1, payerStats.food) * 15 + terms.soldiers / Math.max(1, payerStats.soldiers) * 55;
  if (burden > 0) factors.push(terms.reverse ? { label: 'Tribute offered', value: Math.round(burden * 0.8) } : { label: 'Terms demanded', value: -Math.round(burden) });
  return { total: factors.reduce((s, f) => s + f.value, 0), threshold: 0, factors, affordable };
}

function payTerms(w: World, payer: CountryId, payee: CountryId, t: PeaceTerms): boolean {
  const s = countryStats(w, payer);
  if (t.gold > s.gold + 1e-6 || t.food > s.food + 1e-6 || t.soldiers > s.soldiers + 1e-6) return false;
  if (t.gold > 0) takeGold(w, payer, t.gold);
  if (t.food > 0) takeFood(w, payer, t.food);
  const troops = t.soldiers > 0 ? takeSoldiers(w, payer, t.soldiers) : null;
  giveStock(w, payee, Math.max(0, t.gold), Math.max(0, t.food));
  if (troops) giveUnits(w, payee, troops);
  return true;
}

export function endWarRt(w: World, war: War): void {
  const rt = rtOf(w);
  war.ended = { ...w.date };
  war.result = 'peace';
  for (const a of war.attackers) for (const d of war.defenders) {
    rt.truces[relationKey(a, d)] = rt.t + TRUCE_SECONDS;
    const r = getRelation(w, a, d);
    r.opinion = Math.max(r.opinion, -40); r.trust = Math.max(r.trust, 10);
  }
  for (const id of [...war.attackers, ...war.defenders]) notify(w, id, 'peace', { a: war.attackers[0], d: war.defenders[0] });
  const ended = w.wars.filter((x) => x.ended);
  if (ended.length > 60) { const drop = new Set(ended.slice(0, ended.length - 60).map((x) => x.id)); w.wars = w.wars.filter((x) => !drop.has(x.id)); }
}

function applyPeace(w: World, proposer: CountryId, receiver: CountryId, terms: PeaceTerms): boolean {
  const war = findWar(w, proposer, receiver);
  if (!war) return false;
  const payer = terms.reverse ? proposer : receiver, payee = terms.reverse ? receiver : proposer;
  if (!payTerms(w, payer, payee, terms)) return false;
  endWarRt(w, war);
  return true;
}

export function proposePeace(w: World, from: CountryId, to: CountryId, terms: PeaceTerms): RtResult & { evaluation?: AcceptanceBreakdown } {
  if (!isAtWar(w, from, to)) return failR('You are not at war with this nation.');
  const ev = evaluatePeaceTerms(w, from, to, terms);
  if (!ev.affordable) return { ...failR('The payer cannot afford these terms.'), evaluation: ev };
  if (isHuman(w, to)) {
    const rt = rtOf(w);
    rt.offers.push({ id: nextId(w, 'o'), t: rt.t, from, to, kind: 'peace', terms: { ...terms } });
    notify(w, to, 'offer', { a: from });
    return { ...okR('Your offer was sent.'), evaluation: ev };
  }
  if (ev.total >= ev.threshold) {
    applyPeace(w, from, to, terms);
    return { ...okR('They accept: peace is made.'), evaluation: ev };
  }
  const r = getRelation(w, from, to); r.opinion = Math.max(-200, r.opinion - 2);
  return { ...failR('They refuse your terms.'), evaluation: ev };
}

export function answerOffer(w: World, owner: CountryId, offerId: string, accept: boolean): RtResult {
  const rt = rtOf(w);
  const o = rt.offers.find((x) => x.id === offerId && x.to === owner);
  if (!o) return failR('This offer has expired.');
  rt.offers = rt.offers.filter((x) => x !== o);
  if (!accept) return okR('Offer declined.');
  if (o.kind === 'alliance') { getRelation(w, o.from, o.to).treaties.alliance = { since: { ...w.date } }; return okR('Alliance formed.'); }
  return applyPeace(w, o.from, o.to, o.terms) ? okR('They accept: peace is made.') : failR('The payer cannot afford these terms.');
}

// ---------------------------------------------------------------- alliance, gifts
export function proposeAlliance(w: World, from: CountryId, to: CountryId): RtResult & { evaluation?: AcceptanceBreakdown } {
  if (isAtWar(w, from, to)) return failR('You cannot ally with a nation you are at war with.');
  const rel = getRelation(w, from, to);
  if (rel.treaties.alliance) return failR('You are already allied.');
  if (isHuman(w, to)) {
    const rt = rtOf(w);
    rt.offers.push({ id: nextId(w, 'o'), t: rt.t, from, to, kind: 'alliance', terms: { gold: 0, food: 0, soldiers: 0 } });
    notify(w, to, 'offer', { a: from });
    return okR('Your offer was sent.');
  }
  const factors: { label: string; value: number }[] = [{ label: 'Opinion', value: Math.round(rel.opinion / 8) }, { label: 'Trust', value: Math.round((rel.trust - 30) / 6) }];
  const enemiesOf = (id: CountryId) => w.wars.filter((x) => !x.ended && (x.attackers.includes(id) || x.defenders.includes(id))).flatMap((x) => (x.attackers.includes(id) ? x.defenders : x.attackers));
  const mine = new Set(enemiesOf(from));
  if (enemiesOf(to).some((e) => mine.has(e))) factors.push({ label: 'Common enemy', value: 14 });
  const ps = countryStats(w, from), rs = countryStats(w, to);
  factors.push({ label: 'Army balance', value: Math.round(Math.log((ps.soldiers + 50) / (rs.soldiers + 50)) * 3) });
  const ev = { total: factors.reduce((s, f) => s + f.value, 0), threshold: 8, factors };
  if (ev.total >= ev.threshold) { rel.treaties.alliance = { since: { ...w.date } }; rel.opinion = Math.min(200, rel.opinion + 15); return { ...okR('They accept: you are now allies.'), evaluation: ev }; }
  return { ...failR('They refuse your offer.'), evaluation: ev };
}
export function breakAlliance(w: World, from: CountryId, to: CountryId): RtResult {
  const rel = peekRelation(w, from, to);
  if (!rel?.treaties.alliance) return failR('You are not allied.');
  delete rel.treaties.alliance; rel.opinion -= 20; rel.trust = clamp(rel.trust - 15, 0, 100);
  return okR('Alliance ended.');
}
export function giftGold(w: World, from: CountryId, to: CountryId, gold: number): RtResult {
  gold = Math.floor(gold);
  if (!(gold > 0)) return failR('Enter a number above zero.');
  if (!takeGold(w, from, gold)) return failR('You do not have enough gold.');
  giveStock(w, to, gold, 0);
  const rs = countryStats(w, to);
  const r = getRelation(w, from, to);
  r.opinion = Math.min(200, r.opinion + 2 + Math.min(40, gold / Math.max(50, rs.gold) * 80));
  r.trust = clamp(r.trust + 2, 0, 100);
  return okR('Gift delivered.');
}

export function declareWarOn(w: World, st: MapStatic, from: CountryId, to: CountryId): RtResult {
  if (isAtWar(w, from, to)) return failR('You are already at war.');
  if (peekRelation(w, from, to)?.treaties.alliance) return failR('You are allied with this nation.');
  if (truceActive(w, from, to)) return failR('A truce is in force with this nation.');
  const war = declareWar(w, from, to, 'conquest', st);
  if (!war) return failR('War cannot be declared on this nation.');
  rtOf(w).warT[war.id] = rtOf(w).t;
  notify(w, to, 'war', { a: from });
  return okR('War declared.');
}

// ---------------------------------------------------------------- loans
export function loanLimit(w: World, lender: CountryId): number { return Math.floor(countryStats(w, lender).gold * 0.4); }
export function evaluateLoan(w: World, borrower: CountryId, lender: CountryId, amount: number): AcceptanceBreakdown {
  const rel = getRelation(w, borrower, lender);
  const rt = rtOf(w);
  const factors: { label: string; value: number }[] = [{ label: 'Opinion', value: Math.round(rel.opinion / 5) }, { label: 'Trust', value: Math.round((rel.trust - 30) / 5) }];
  if (rel.treaties.alliance) factors.push({ label: 'Allies', value: 20 });
  const debts = rt.loans.filter((l) => l.borrower === borrower && l.status === 'active').length;
  if (debts) factors.push({ label: 'Existing debts', value: -8 * debts });
  if (rt.loans.some((l) => l.borrower === borrower && l.lender === lender && l.status === 'defaulted')) factors.push({ label: 'Past default', value: -40 });
  const limit = loanLimit(w, lender);
  if (limit > 0) factors.push({ label: 'Size of the loan', value: -Math.round(amount / limit * 6) });
  return { total: factors.reduce((s, f) => s + f.value, 0), threshold: -4, factors };
}
export function requestLoan(w: World, borrower: CountryId, lender: CountryId, amount: number): RtResult & { evaluation?: AcceptanceBreakdown } {
  amount = Math.floor(amount);
  if (!(amount > 0)) return failR('Enter a number above zero.');
  if (borrower === lender || !w.countries[lender]?.alive) return failR('Choose another lender.');
  if (isAtWar(w, borrower, lender)) return failR('Nobody lends to an enemy at war.');
  if (amount > loanLimit(w, lender)) return failR('They cannot lend that much (limit {max} gold).', { max: loanLimit(w, lender) });
  const ev = evaluateLoan(w, borrower, lender, amount);
  if (ev.total < ev.threshold) return { ...failR('They refuse the loan.'), evaluation: ev };
  if (!takeGold(w, lender, amount)) return failR('They cannot lend that much (limit {max} gold).', { max: loanLimit(w, lender) });
  giveStock(w, borrower, amount, 0);
  const rt = rtOf(w);
  rt.loans.push({ id: nextId(w, 'l'), lender, borrower, principal: amount, owed: Math.ceil(amount * (1 + LOAN_INTEREST)), dueT: rt.t + LOAN_SECONDS, status: 'active' });
  return { ...okR('Loan granted: {amount} gold, to be repaid within {mins} minutes.', { amount, mins: LOAN_SECONDS / 60 }), evaluation: ev };
}
export function repayLoan(w: World, owner: CountryId, loanId: string, amount?: number): RtResult {
  const rt = rtOf(w);
  const l = rt.loans.find((x) => x.id === loanId && x.borrower === owner && x.status === 'active');
  if (!l) return failR('This loan no longer exists.');
  const pay = Math.floor(Math.min(amount ?? l.owed, l.owed));
  if (pay < 1) return failR('Enter a number above zero.');
  if (!takeGold(w, owner, pay)) return failR('You do not have enough gold.');
  giveStock(w, l.lender, pay, 0);
  l.owed -= pay;
  if (l.owed < 0.5) { l.owed = 0; l.status = 'repaid'; getRelation(w, owner, l.lender).opinion += 8; return okR('The loan is repaid in full.'); }
  return okR('Repaid {n} gold.', { n: pay });
}
function defaultLoan(w: World, st: MapStatic, l: Loan): void {
  l.status = 'defaulted';
  const rel = getRelation(w, l.lender, l.borrower);
  rel.opinion = -150; delete rel.treaties.alliance;
  notify(w, l.lender, 'loanDefault', { a: l.borrower });
  notify(w, l.borrower, 'loanDefault', { a: l.lender });
  if (!isAtWar(w, l.lender, l.borrower) && w.countries[l.lender]?.alive && w.countries[l.borrower]?.alive) {
    const war = declareWar(w, l.lender, l.borrower, 'conquest', st);
    if (war) rtOf(w).warT[war.id] = rtOf(w).t;
  }
}
export function processLoans(w: World, st: MapStatic): void {
  const rt = rtOf(w);
  for (const l of rt.loans) {
    if (l.status !== 'active') continue;
    if (!w.countries[l.lender]?.alive || !w.countries[l.borrower]?.alive) { l.status = 'repaid'; continue; }
    if (isHuman(w, l.borrower) && rt.t >= l.dueT - 60 && !rt.handled[`${l.id}w`]) { rt.handled[`${l.id}w`] = true; notify(w, l.borrower, 'loanDue', { a: l.lender, n: Math.ceil(l.owed) }); }
    if (rt.t < l.dueT) continue;
    if (!isHuman(w, l.borrower)) { const have = countryStats(w, l.borrower).gold; repayLoan(w, l.borrower, l.id, Math.min(l.owed, have)); }
    if (l.status === 'active') defaultLoan(w, st, l);
  }
  rt.loans = rt.loans.filter((l) => l.status === 'active' || rt.t - l.dueT < 1800);
}
export type { RtOffer };
