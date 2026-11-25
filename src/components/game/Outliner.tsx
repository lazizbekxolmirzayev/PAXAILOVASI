import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Handshake, Landmark, Mail, Swords, Footprints } from 'lucide-react';
import { useGame } from '../../store/game';
import { Button } from '../ui';
import { useN, useT } from '../../i18n';
import { rtOf, soldiersOf, battleProgress, answerOffer } from '../../engine/rt';
import { noticeText } from '../../lib/notices';
import { num } from './parts';

/** Live overview: incoming attacks, own marches, battles, offers, wars and loans. */
export function Outliner() {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const select = useGame((s) => s.select);
  const act = useGame((s) => s.act);
  const t = useT();
  const n = useN();
  const [open, setOpen] = useState(true);
  const me = w.player;
  const rt = rtOf(w);
  const incoming = rt.marches.filter((m) => m.kind === 'attack' && me && w.provinces[m.to]?.owner === me && m.owner !== me);
  const mine = rt.marches.filter((m) => m.owner === me);
  const battles = rt.battles.filter((b) => b.attacker === me || b.defender === me || w.provinces[b.province]?.owner === me);
  const offers = rt.offers.filter((o) => o.to === me);
  const wars = w.wars.filter((x) => !x.ended && me && (x.attackers.includes(me) || x.defenders.includes(me)));
  const loans = rt.loans.filter((l) => l.status === 'active' && l.borrower === me);
  const news = rt.notices.filter((x) => x.to === me).slice(-5).reverse();
  const alerts = incoming.length + offers.length + battles.length;
  const goto = (pid: number) => { const p = w.provinces[pid]; select(pid, p.owner); };
  return (
    <div className="panel pointer-events-auto w-full overflow-hidden md:w-[340px]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="title-display text-[11px] text-gold-200">{t('Journal')} {alerts > 0 && <span className="ml-1 rounded-full bg-blood-500 px-1.5 text-[10px] text-white">{alerts}</span>}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gold-300" /> : <ChevronDown className="h-4 w-4 text-gold-300" />}
      </button>
      {open && (
        <div className="scroll-thin max-h-[42vh] space-y-3 overflow-y-auto border-t border-gold-600/20 px-3 py-2 text-xs">
          {incoming.map((m) => {
            const eta = Math.max(0, Math.round(m.arriveT - rt.t));
            const approx = Math.max(10, Math.round(soldiersOf(m.units) / 10) * 10);
            return (
              <button key={m.id} onClick={() => goto(m.to)} className="block w-full rounded border border-blood-500/50 bg-blood-500/10 p-2 text-left">
                <div className="flex items-center gap-1.5 font-semibold text-blood-400"><AlertTriangle className="h-3.5 w-3.5" />{t('Enemy approaching {city}!', { city: n(w.provinces[m.to].name) })}</div>
                <div className="mt-0.5 text-parchment-100">{t('{a} sends about {n} soldiers from {from}. Arrival in {secs} s.', { a: n(w.countries[m.owner]?.name ?? '?'), n: approx, from: n(w.provinces[m.from].name), secs: eta })}</div>
              </button>
            );
          })}
          {battles.map((b) => (
            <button key={b.id} onClick={() => goto(b.province)} className="block w-full rounded border border-gold-600/40 bg-ink-950/50 p-2 text-left">
              <div className="flex items-center gap-1.5 font-semibold text-gold-100"><Swords className="h-3.5 w-3.5" />{t('Battle for {city}', { city: n(w.provinces[b.province].name) })}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-950"><div className="h-full bg-blood-400" style={{ width: `${Math.round(battleProgress(w, b) * 100)}%` }} /></div>
              <div className="mt-0.5 text-[11px] text-parchment-300/70">{n(w.countries[b.attacker]?.name ?? '?')} {num(soldiersOf(b.a))} — {num(soldiersOf(b.d))} {n(w.countries[b.defender]?.name ?? '?')}</div>
            </button>
          ))}
          {mine.length > 0 && (
            <div>
              <div className="label flex items-center gap-1"><Footprints className="h-3 w-3" />{t('Your marches')}</div>
              {mine.map((m) => (
                <button key={m.id} onClick={() => goto(m.to)} className="flex w-full items-center justify-between py-0.5 text-left text-parchment-100 hover:text-gold-100">
                  <span>{m.kind === 'attack' ? '⚔' : '✚'} {n(w.provinces[m.from].name)} → {n(w.provinces[m.to].name)}</span>
                  <span className="stat-num text-parchment-300/70">{num(soldiersOf(m.units))} · {Math.max(0, Math.round(m.arriveT - rt.t))}s</span>
                </button>
              ))}
            </div>
          )}
          {offers.map((o) => (
            <div key={o.id} className="rounded border border-gold-600/40 bg-ink-950/50 p-2">
              <div className="flex items-center gap-1.5 font-semibold text-gold-100"><Mail className="h-3.5 w-3.5" />{t(o.kind === 'peace' ? '{a} proposes peace' : '{a} proposes an alliance', { a: n(w.countries[o.from]?.name ?? '?') })}</div>
              {(o.terms.gold > 0 || o.terms.food > 0 || o.terms.soldiers > 0) && <div className="mt-0.5 text-parchment-200/90">{t(o.terms.reverse ? 'They offer' : 'They demand')}: {num(o.terms.gold)} {t('gold')}, {num(o.terms.food)} {t('food')}, {num(o.terms.soldiers)} {t('soldiers')}</div>}
              <div className="mt-1.5 flex gap-1.5"><Button size="sm" variant="gold" onClick={() => act((ww) => answerOffer(ww, ww.player!, o.id, true))}>{t('Accept')}</Button><Button size="sm" onClick={() => act((ww) => answerOffer(ww, ww.player!, o.id, false))}>{t('Decline')}</Button></div>
            </div>
          ))}
          {wars.length > 0 && (
            <div>
              <div className="label flex items-center gap-1"><Handshake className="h-3 w-3" />{t('Wars')}</div>
              {wars.map((war) => {
                const foe = (war.attackers.includes(me!) ? war.defenders : war.attackers)[0];
                const score = Math.round(war.score * (war.attackers.includes(me!) ? 1 : -1));
                return <button key={war.id} onClick={() => select(null, foe)} className="flex w-full justify-between py-0.5 text-left hover:text-gold-100"><span>{n(w.countries[foe]?.name ?? '?')}</span><span className={`stat-num ${score >= 0 ? 'text-emerald-300' : 'text-blood-400'}`}>{score > 0 ? '+' : ''}{score}</span></button>;
              })}
            </div>
          )}
          {loans.length > 0 && (
            <div>
              <div className="label flex items-center gap-1"><Landmark className="h-3 w-3" />{t('Debts')}</div>
              {loans.map((l) => <div key={l.id} className="flex justify-between py-0.5"><span>{n(w.countries[l.lender]?.name ?? '?')}</span><span className={`stat-num ${l.dueT - rt.t < 60 ? 'text-blood-400' : 'text-parchment-200'}`}>{num(l.owed)} · {Math.max(0, Math.round(l.dueT - rt.t))}s</span></div>)}
            </div>
          )}
          {news.length > 0 && (
            <div>
              <div className="label">{t('Latest news')}</div>
              {news.map((x) => <p key={x.id} className="py-0.5 text-parchment-200/85">{noticeText(w, x)}</p>)}
            </div>
          )}
          {!alerts && !mine.length && !wars.length && !news.length && <p className="text-parchment-300/60">{t('All quiet.')}</p>}
        </div>
      )}
    </div>
  );
}
