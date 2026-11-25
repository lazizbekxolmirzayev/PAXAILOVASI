import { useMemo, useState } from 'react';
import { RequirePlayer } from './common';
import { useGame } from '../../store/game';
import { Panel } from '../../components/ui';
import { useN, useT } from '../../i18n';
import { countryStats, cityKind, cityRates, rtOf, soldiersOf, UNIT, UNIT_KINDS } from '../../engine/rt';
import { KV, Res, UnitsGrid, num } from '../../components/game/parts';
import { cityKindLabel } from '../../components/game/SendDialog';

type SortKey = 'name' | 'soldiers' | 'gold' | 'food' | 'income';

export default function CountryPage() {
  return <RequirePlayer>{(c, w) => <Inner id={c.id} w={w} />}</RequirePlayer>;
}

function Inner({ id, w }: { id: string; w: import('../../types/game').World }) {
  const t = useT();
  const n = useN();
  const select = useGame((s) => s.select);
  const [sort, setSort] = useState<SortKey>('soldiers');
  const s = countryStats(w, id);
  const rt = rtOf(w);
  const rows = useMemo(() => {
    const c = w.countries[id];
    return w.provinces.filter((p) => p.owner === id).map((p) => {
      const cs = rt.cities[p.id];
      return { p, cs, soldiers: soldiersOf(cs.garrison), income: cityRates(p, c.military.quality).gold, kind: cityKind(w, p.id) };
    });
  }, [w, id, rt.reports.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = [...rows].sort((a, b) => sort === 'name' ? a.p.name.localeCompare(b.p.name) : sort === 'soldiers' ? b.soldiers - a.soldiers : sort === 'gold' ? b.cs.gold - a.cs.gold : sort === 'food' ? b.cs.food - a.cs.food : b.income - a.income);
  const th = (k: SortKey, label: string, right = true) => <th className={`cursor-pointer px-2 py-1.5 ${right ? 'text-right' : 'text-left'} ${sort === k ? 'text-gold-200' : ''}`} onClick={() => setSort(k)}>{t(label)}</th>;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Overall strength">
          <KV k="Cities" v={s.cities} /><KV k="Population" v={num(s.population)} /><KV k="Soldiers" v={num(s.soldiers)} /><KV k="Fleet" v={num(s.ships)} />
          <KV k="Gold" v={<Res gold={s.gold} />} /><KV k="Food" v={<Res food={s.food} />} />
          <KV k="Income per minute" v={<span>+{num(s.goldPerMin)} {t('gold')} · +{num(s.foodPerMin)} {t('food')}</span>} />
        </Panel>
        <Panel title="Army by unit type">
          <UnitsGrid units={s.units} all />
          <p className="mt-2 text-[11px] text-parchment-300/60">{UNIT_KINDS.filter((k) => k !== 'fleet').map((k) => `${t(UNIT[k].name)}: ${UNIT[k].gold}${t('g')}`).join(' · ')}</p>
        </Panel>
      </div>
      <Panel title="Your cities" subtitle="Click a city to open it on the map.">
        <div className="max-h-[48vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ink-900 text-[10px] uppercase tracking-wider text-parchment-300/70"><tr>{th('name', 'City', false)}<th className="px-2 py-1.5 text-left">{t('Type')}</th>{th('soldiers', 'Soldiers')}{th('gold', 'Gold')}{th('food', 'Food')}{th('income', 'Gold / min')}</tr></thead>
            <tbody>
              {sorted.map(({ p, cs, soldiers, income, kind }) => (
                <tr key={p.id} onClick={() => select(p.id, id)} className="cursor-pointer border-t border-gold-700/10 hover:bg-ink-800">
                  <td className="px-2 py-1 text-parchment-50">{n(p.name)}</td><td className="px-2 py-1 text-parchment-300/70">{t(cityKindLabel(kind))}</td>
                  <td className="stat-num px-2 py-1 text-right">{num(soldiers)}</td><td className="stat-num px-2 py-1 text-right">{num(cs.gold)}</td><td className="stat-num px-2 py-1 text-right">{num(cs.food)}</td><td className="stat-num px-2 py-1 text-right">+{num(income)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
