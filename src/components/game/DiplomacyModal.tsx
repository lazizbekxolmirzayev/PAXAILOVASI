import { useMemo, useState } from 'react';
import { Handshake, HandCoins, Gift, Swords, ShieldCheck } from 'lucide-react';
import { useGame } from '../../store/game';
import { Badge, Button, Modal, Tabs } from '../ui';
import { Flag } from '../ui/Flag';
import { useN, useT } from '../../i18n';
import { countryStats, evaluatePeaceTerms, proposePeace, proposeAlliance, breakAlliance, giftGold, declareWarOn, requestLoan, repayLoan, evaluateLoan, loanLimit, rtOf, truceActive, LOAN_INTEREST, LOAN_SECONDS, findWar } from '../../engine/rt';
import { peekRelation } from '../../engine/util';
import { KV, NumberInput, Res, UnitsGrid, num } from './parts';

type Tab = 'peace' | 'treaty' | 'loan';

function Factors({ factors, total, threshold }: { factors: { label: string; value: number }[]; total: number; threshold: number }) {
  const t = useT();
  return (
    <div className="rounded-md bg-ink-950/60 p-2.5 text-xs ring-1 ring-gold-700/20">
      {factors.map((f) => <div key={f.label} className="flex justify-between py-0.5"><span className="text-parchment-300/80">{t(f.label)}</span><span className={`stat-num ${f.value >= 0 ? 'text-emerald-300' : 'text-blood-400'}`}>{f.value > 0 ? '+' : ''}{f.value}</span></div>)}
      <div className="mt-1 flex justify-between border-t border-gold-700/20 pt-1 font-semibold"><span>{t('Their inclination')}</span><span className={`stat-num ${total >= threshold ? 'text-emerald-300' : 'text-blood-400'}`}>{total} / {threshold}</span></div>
    </div>
  );
}

export function DiplomacyModal({ target, onClose }: { target: string; onClose: () => void }) {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const act = useGame((s) => s.act);
  const t = useT();
  const n = useN();
  const me = w.player!;
  const c = w.countries[target];
  const war = findWar(w, me, target);
  const rel = peekRelation(w, me, target);
  const [tab, setTab] = useState<Tab>(war ? 'peace' : 'treaty');
  const [mode, setMode] = useState<'none' | 'demand' | 'offer'>('none');
  const [gold, setGold] = useState(0);
  const [food, setFood] = useState(0);
  const [soldiers, setSoldiers] = useState(0);
  const [loan, setLoan] = useState(500);
  const [gift, setGift] = useState(200);
  const terms = useMemo(() => ({ gold: mode === 'none' ? 0 : gold, food: mode === 'none' ? 0 : food, soldiers: mode === 'none' ? 0 : soldiers, reverse: mode === 'offer' }), [mode, gold, food, soldiers]);
  if (!c) return null;
  const rt = rtOf(w);
  const ms = countryStats(w, me), ts = countryStats(w, target);
  const peaceEval = war ? evaluatePeaceTerms(w, me, target, terms) : null;
  const loanEval = evaluateLoan(w, me, target, loan);
  const myLoans = rt.loans.filter((l) => l.borrower === me && l.lender === target && l.status === 'active');
  const allied = !!rel?.treaties.alliance;
  const truce = truceActive(w, me, target);
  const tabs = [...(war ? [{ id: 'peace' as Tab, label: 'Peace' }] : []), { id: 'treaty' as Tab, label: 'Relations' }, { id: 'loan' as Tab, label: 'Loans' }];

  return (
    <Modal open onClose={onClose} wide title={<span className="flex items-center gap-2"><Flag flag={c.flag} className="h-5 w-8 rounded-sm" />{n(c.name)}</span>}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        {war ? <Badge tone="red">{t('At war')}</Badge> : allied ? <Badge tone="green">{t('Allied')}</Badge> : truce ? <Badge tone="blue">{t('Truce')}</Badge> : <Badge tone="gray">{t('Peace')}</Badge>}
        <span className="text-parchment-300/70">{t('Opinion of you')}: <b className="stat-num text-parchment-50">{Math.round(rel?.opinion ?? 0)}</b></span>
        <span className="ml-auto text-parchment-300/70">{t('Their soldiers')}: <b className="stat-num text-parchment-50">{num(ts.soldiers)}</b> · {t('Yours')}: <b className="stat-num text-parchment-50">{num(ms.soldiers)}</b></span>
      </div>
      <Tabs<Tab> tabs={tabs.map((x) => ({ ...x, label: t(x.label) }))} value={tab} onChange={setTab} />
      <div className="mt-3">
        {tab === 'peace' && war && peaceEval && (
          <div className="space-y-3">
            <p className="text-xs text-parchment-200/90">{t('Propose peace. You may attach terms, but they are optional. The other side decides from its own situation and does not always agree.')}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {([['none', 'White peace'], ['demand', 'I demand'], ['offer', 'I offer (tribute)']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setMode(id)} className={`rounded-md px-2 py-2 text-xs font-semibold ring-1 ${mode === id ? 'bg-gold-400 text-ink-950 ring-gold-300' : 'bg-ink-950/60 text-parchment-200 ring-gold-700/30 hover:bg-ink-800'}`}>{t(label)}</button>
              ))}
            </div>
            {mode !== 'none' && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="space-y-1"><span className="block text-parchment-300/75">{t('Gold')}</span><NumberInput className="!w-full" value={gold} onChange={setGold} /></label>
                <label className="space-y-1"><span className="block text-parchment-300/75">{t('Food')}</span><NumberInput className="!w-full" value={food} onChange={setFood} /></label>
                <label className="space-y-1"><span className="block text-parchment-300/75">{t('Soldiers')}</span><NumberInput className="!w-full" value={soldiers} onChange={setSoldiers} /></label>
                <p className="col-span-3 text-[11px] text-parchment-300/60">{mode === 'demand' ? t('They hold') : t('You hold')}: <Res gold={mode === 'demand' ? ts.gold : ms.gold} food={mode === 'demand' ? ts.food : ms.food} /> · {num(mode === 'demand' ? ts.soldiers : ms.soldiers)} {t('soldiers')}</p>
                {!peaceEval.affordable && <p className="col-span-3 text-[11px] text-blood-400">{t('These terms exceed what the paying side has.')}</p>}
              </div>
            )}
            <Factors factors={peaceEval.factors} total={peaceEval.total} threshold={peaceEval.threshold} />
            <Button variant="gold" icon={<Handshake className="h-4 w-4" />} onClick={() => { const r = act((ww) => proposePeace(ww, me, target, terms)); if (r.ok) onClose(); }}>{t('Propose peace')}</Button>
          </div>
        )}
        {tab === 'treaty' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-md bg-ink-950/50 p-3 ring-1 ring-gold-700/15">
              <div className="label">{t('Their strength')}</div>
              <KV k="Cities" v={ts.cities} /><KV k="Soldiers" v={num(ts.soldiers)} /><KV k="Fleet" v={num(ts.ships)} /><KV k="Gold" v={num(ts.gold)} /><KV k="Food" v={num(ts.food)} />
              <UnitsGrid units={ts.units} className="border-t border-gold-700/15 pt-2" />
            </div>
            <div className="space-y-2">
              {!war && (allied
                ? <Button className="w-full" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => act((ww) => breakAlliance(ww, me, target))}>{t('Break the alliance')}</Button>
                : <Button className="w-full" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => act((ww) => proposeAlliance(ww, me, target))}>{t('Propose an alliance')}</Button>)}
              <div className="rounded-md bg-ink-950/50 p-2.5 ring-1 ring-gold-700/15">
                <div className="mb-1.5 text-xs text-parchment-200">{t('Gift gold to improve their opinion')}</div>
                <div className="flex items-center gap-2"><NumberInput value={gift} min={1} max={Math.floor(ms.gold)} onChange={setGift} /><Button size="sm" icon={<Gift className="h-3.5 w-3.5" />} onClick={() => act((ww) => giftGold(ww, me, target, gift))}>{t('Send gift')}</Button></div>
              </div>
              {!war && !allied && <Button variant="danger" className="w-full" icon={<Swords className="h-4 w-4" />} onClick={() => { act((ww, st) => declareWarOn(ww, st, me, target)); onClose(); }}>{t('Declare war')}</Button>}
            </div>
          </div>
        )}
        {tab === 'loan' && (
          <div className="space-y-3">
            <p className="text-xs text-parchment-200/90">{t('Borrow gold from this nation. You must repay {pct}% extra within {mins} minutes, or they declare war on you.', { pct: Math.round(LOAN_INTEREST * 100), mins: LOAN_SECONDS / 60 })}</p>
            <div className="flex items-center gap-2 text-xs"><span>{t('Amount')}</span><NumberInput value={loan} min={1} max={loanLimit(w, target)} onChange={setLoan} /><span className="text-parchment-300/60">{t('limit')} {num(loanLimit(w, target))}</span></div>
            <Factors factors={loanEval.factors} total={loanEval.total} threshold={loanEval.threshold} />
            <Button variant="gold" icon={<HandCoins className="h-4 w-4" />} disabled={!!war} onClick={() => act((ww) => requestLoan(ww, me, target, loan))}>{t('Request loan')}</Button>
            {war && <p className="text-[11px] text-blood-400">{t('Nobody lends to an enemy at war.')}</p>}
            {myLoans.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-md bg-ink-950/50 p-2.5 text-xs ring-1 ring-gold-700/20">
                <span>{t('You owe')} <b className="stat-num text-parchment-50">{num(l.owed)}</b> {t('gold')} · {t('due in')} <b className="stat-num">{Math.max(0, Math.round(l.dueT - rt.t))}</b> {t('sec')}</span>
                <Button size="sm" variant="gold" onClick={() => act((ww) => repayLoan(ww, me, l.id))}>{t('Repay')}</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
