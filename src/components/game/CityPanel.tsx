import { useState } from 'react';
import { Coins, Hammer, Send, Swords, Wheat } from 'lucide-react';
import { useGame } from '../../store/game';
import { Badge, Button, Tabs } from '../ui';
import { useN, useT } from '../../i18n';
import { UNIT, UNIT_KINDS, rtOf, soldiersOf, cityKind, cityRates, maxRecruit, recruit, tradeFood, build, buildCost, unitCost, routeBetween, FOOD_BUY, FOOD_SELL, MANPOWER_SHARE } from '../../engine/rt';
import type { BuildKind } from '../../engine/rt';
import { KV, NumberInput, Res, UnitsGrid, num } from './parts';
import { cityKindLabel } from './SendDialog';

type Tab = 'army' | 'market' | 'build';

export function CityPanel({ pid, onBack }: { pid: number; onBack: () => void }) {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const st = useGame((s) => s.st)!;
  const act = useGame((s) => s.act);
  const startMission = useGame((s) => s.startMission);
  const openSend = useGame((s) => s.openSend);
  const t = useT();
  const n = useN();
  const [tab, setTab] = useState<Tab>('army');
  const p = w.provinces[pid];
  const cs = rtOf(w).cities[pid];
  const me = w.player;
  const mine = p.owner === me;
  const owner = p.owner ? w.countries[p.owner] : null;
  const rate = cityRates(p, owner?.military.quality ?? 1);
  const kind = cityKind(w, pid);
  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <button onClick={onBack} className="text-[11px] text-gold-300 hover:text-gold-100">← {owner ? n(owner.name) : t('Back')}</button>
          <h3 className="title-display text-base text-gold-100">{n(p.name)}</h3>
          <div className="mt-0.5 flex flex-wrap gap-1"><Badge tone="gold">{t(cityKindLabel(kind))}</Badge>{p.coastal && <Badge tone="blue">{t('Coastal')}</Badge>}{p.mountain && <Badge tone="gray">{t('Mountains')}</Badge>}{p.river && <Badge tone="gray">{t('River')}</Badge>}</div>
        </div>
      </div>
      <div className="rounded-md bg-ink-950/50 p-2.5 ring-1 ring-gold-700/20">
        <KV k="Owner" v={owner ? n(owner.name) : t('Unclaimed land')} />
        <KV k="Population" v={num(p.pop)} />
        <KV k="Soldiers" v={num(soldiersOf(cs.garrison))} />
        <KV k="Gold" v={<Res gold={cs.gold} />} />
        <KV k="Food" v={<Res food={cs.food} />} />
        {owner && <KV k="Income per minute" v={<span className="inline-flex gap-2"><span>+{num(rate.gold)} <Coins className="inline h-3 w-3 text-gold-300" /></span><span>+{num(rate.food)} <Wheat className="inline h-3 w-3 text-emerald-300" /></span></span>} />}
        <KV k="Fortification" v={`${p.fort}/5`} />
        <UnitsGrid units={cs.garrison} className="mt-2 border-t border-gold-700/15 pt-2" />
      </div>

      {mine && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="gold" icon={<Swords className="h-4 w-4" />} onClick={() => startMission(pid, 'attack')}>{t('March')}</Button>
            <Button icon={<Send className="h-4 w-4" />} onClick={() => startMission(pid, 'support')}>{t('Send help')}</Button>
          </div>
          <p className="mt-1 text-[11px] text-parchment-300/60">{t('After pressing, click the destination on the map.')}</p>
          <div className="mt-3"><Tabs<Tab> tabs={[{ id: 'army', label: 'Army' }, { id: 'market', label: 'Market' }, { id: 'build', label: 'Build' }]} value={tab} onChange={setTab} /></div>
          <div className="scroll-thin mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
            {tab === 'army' && <Recruit pid={pid} act={act} />}
            {tab === 'market' && <Market pid={pid} act={act} />}
            {tab === 'build' && <Buildings pid={pid} act={act} />}
          </div>
        </>
      )}

      {!mine && owner && me && (
        <AttackFrom pid={pid} onGo={(from) => openSend({ from, to: pid, kind: 'attack' })} routeOk={(from) => routeBetween(w, st, from, pid) !== null} />
      )}
    </div>
  );
}

function AttackFrom({ pid, onGo, routeOk }: { pid: number; onGo: (from: number) => void; routeOk: (from: number) => boolean }) {
  const w = useGame((s) => s.world)!;
  const t = useT();
  const n = useN();
  const rt = rtOf(w);
  const mine = w.provinces.filter((p) => p.owner === w.player && soldiersOf(rt.cities[p.id].garrison) >= 5 && routeOk(p.id)).sort((a, b) => soldiersOf(rt.cities[b.id].garrison) - soldiersOf(rt.cities[a.id].garrison)).slice(0, 40);
  const [from, setFrom] = useState<number | null>(null);
  const cur = from ?? mine[0]?.id ?? null;
  return (
    <div className="mt-3 rounded-md bg-ink-950/50 p-2.5 ring-1 ring-gold-700/20">
      <div className="label">{t('March from')}</div>
      {mine.length === 0 ? <p className="text-xs text-parchment-300/70">{t('None of your cities can reach this city with troops.')}</p> : (
        <>
          <select value={cur ?? ''} onChange={(e) => setFrom(Number(e.target.value))} className="mb-2 w-full rounded border border-gold-700/40 bg-ink-950 px-2 py-1.5 text-xs text-parchment-50">
            {mine.map((p) => <option key={p.id} value={p.id}>{n(p.name)} — {num(soldiersOf(rt.cities[p.id].garrison))} {t('soldiers')}</option>)}
          </select>
          <Button variant="gold" className="w-full" icon={<Swords className="h-4 w-4" />} onClick={() => cur !== null && onGo(cur)}>{t('Prepare march')}</Button>
        </>
      )}
      <p className="mt-1.5 text-[11px] text-parchment-300/60">{t('Tip: you can also press "March" in your own city, then click the target on the map.')}</p>
    </div>
  );
}

function Recruit({ pid, act }: { pid: number; act: ReturnType<typeof useGame.getState>['act'] }) {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const t = useT();
  const p = w.provinces[pid];
  const [qty, setQty] = useState<Record<string, number>>({});
  const cs = rtOf(w).cities[pid];
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-parchment-300/60">{t('Each city can field at most {pct}% of its people. Mercenaries need no recruits, only gold.', { pct: Math.round(MANPOWER_SHARE * 100) })}</p>
      {UNIT_KINDS.filter((k) => k !== 'fleet' || p.coastal).map((k) => {
        const u = UNIT[k];
        const q = qty[k] ?? 10;
        const cost = unitCost(k, q);
        const max = maxRecruit(w, pid, k);
        return (
          <div key={k} className="rounded-md bg-ink-950/50 p-2 ring-1 ring-gold-700/15">
            <div className="flex items-center justify-between text-xs"><b className="text-parchment-50">{t(u.name)}</b><span className="text-parchment-300/70">{u.gold} <Coins className="inline h-3 w-3 text-gold-300" />{u.food > 0 && <> · {u.food} <Wheat className="inline h-3 w-3 text-emerald-300" /></>} / {t('each')}</span></div>
            <div className="mt-0.5 text-[10px] text-parchment-300/55">{t('Attack')} {u.atk} · {t('Defence')} {u.def} · {t('In city')}: {num(cs.garrison[k])}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <NumberInput value={q} min={1} onChange={(v) => setQty({ ...qty, [k]: v })} />
              <Button size="sm" onClick={() => setQty({ ...qty, [k]: Math.max(1, max) })}>{t('Max')} ({num(max)})</Button>
              <Button size="sm" variant="gold" className="ml-auto" onClick={() => act((ww) => recruit(ww, ww.player!, pid, k, q))}>{t('Buy')}</Button>
            </div>
            <div className="mt-1 text-[10px] text-parchment-300/60">{t('Cost')}: <Res gold={cost.gold} food={cost.food} /></div>
          </div>
        );
      })}
    </div>
  );
}

function Market({ pid, act }: { pid: number; act: ReturnType<typeof useGame.getState>['act'] }) {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const t = useT();
  const cs = rtOf(w).cities[pid];
  const [amt, setAmt] = useState(100);
  const pr = { buy: FOOD_BUY, sell: FOOD_SELL };
  return (
    <div className="rounded-md bg-ink-950/50 p-2.5 ring-1 ring-gold-700/15">
      <p className="mb-2 text-xs text-parchment-200/90">{t('Trade food in this city\'s market.')}</p>
      <KV k="Food" v={<Res food={cs.food} />} /><KV k="Gold" v={<Res gold={cs.gold} />} />
      <KV k="Buy price" v={`${pr.buy} ${t('gold per food')}`} /><KV k="Sell price" v={`${pr.sell} ${t('gold per food')}`} />
      <div className="mt-2 flex items-center gap-2"><NumberInput value={amt} min={1} onChange={setAmt} /><span className="text-xs text-parchment-300/70">{t('food')}</span></div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button icon={<Wheat className="h-4 w-4" />} onClick={() => act((ww) => tradeFood(ww, ww.player!, pid, amt, 'buy'))}>{t('Buy')} ({num(Math.ceil(amt * pr.buy))} {t('gold')})</Button>
        <Button icon={<Coins className="h-4 w-4" />} onClick={() => act((ww) => tradeFood(ww, ww.player!, pid, amt, 'sell'))}>{t('Sell')} (+{num(Math.floor(amt * pr.sell))})</Button>
      </div>
    </div>
  );
}

const BUILD: { id: BuildKind; label: string; hint: string }[] = [
  { id: 'fort', label: 'Walls and fortress', hint: 'Defenders fight better behind stronger walls.' },
  { id: 'market', label: 'Market', hint: 'More gold per minute.' },
  { id: 'farms', label: 'Farms', hint: 'More food per minute.' },
];
function Buildings({ pid, act }: { pid: number; act: ReturnType<typeof useGame.getState>['act'] }) {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const t = useT();
  const p = w.provinces[pid];
  return (
    <div className="space-y-2">
      {BUILD.map((b) => (
        <div key={b.id} className="flex items-center justify-between gap-2 rounded-md bg-ink-950/50 p-2.5 ring-1 ring-gold-700/15">
          <div><div className="flex items-center gap-1.5 text-xs font-semibold text-parchment-50"><Hammer className="h-3.5 w-3.5 text-gold-300" />{t(b.label)} <span className="text-parchment-300/60">{p[b.id]}/5</span></div><div className="text-[11px] text-parchment-300/60">{t(b.hint)}</div></div>
          <Button size="sm" variant="gold" disabled={p[b.id] >= 5} onClick={() => act((ww) => build(ww, ww.player!, pid, b.id))}>{p[b.id] >= 5 ? t('Max') : `${num(buildCost(p[b.id]))} ${t('gold')}`}</Button>
        </div>
      ))}
    </div>
  );
}

