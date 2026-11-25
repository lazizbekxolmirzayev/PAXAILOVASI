import { RequirePlayer } from './common';
import { useGame } from '../../store/game';
import { Panel, Button, EmptyState } from '../../components/ui';
import { useN, useT } from '../../i18n';
import { rtOf, soldiersOf, battleProgress } from '../../engine/rt';
import { UnitsGrid, num } from '../../components/game/parts';
import type { World } from '../../types/game';

export default function MilitaryPage() {
  return <RequirePlayer>{(c, w) => <Inner me={c.id} w={w} />}</RequirePlayer>;
}

function Inner({ me, w }: { me: string; w: World }) {
  const t = useT();
  const n = useN();
  const select = useGame((s) => s.select);
  const rt = rtOf(w);
  const marches = rt.marches.filter((m) => m.owner === me || w.provinces[m.to]?.owner === me);
  const battles = rt.battles.filter((b) => b.attacker === me || b.defender === me);
  const reports = rt.reports.filter((r) => r.attacker === me || r.defender === me).slice(-10).reverse();
  const goto = (pid: number) => select(pid, w.provinces[pid].owner);
  return (
    <div className="space-y-4">
      <Panel title="Armies on the road" subtitle="Marches take 1 minute; defenders are warned the moment you set out.">
        {!marches.length ? <EmptyState title="No armies are marching." text="Open one of your cities, press March, and click a target on the map." /> : marches.map((m) => (
          <div key={m.id} className="mb-2 rounded-md bg-ink-950/50 p-2.5 text-xs ring-1 ring-gold-700/20">
            <div className="flex items-center justify-between"><b className={m.owner === me ? 'text-gold-100' : 'text-blood-400'}>{m.owner === me ? (m.kind === 'attack' ? '⚔' : '✚') : '⚠'} {n(w.provinces[m.from].name)} → {n(w.provinces[m.to].name)}</b><span className="stat-num text-parchment-300/70">{Math.max(0, Math.round(m.arriveT - rt.t))} {t('sec')}</span></div>
            <div className="mt-1 text-parchment-300/70">{m.owner === me ? <UnitsGrid units={m.units} /> : t('About {n} soldiers from {c}', { n: Math.max(10, Math.round(soldiersOf(m.units) / 10) * 10), c: n(w.countries[m.owner]?.name ?? '?') })}</div>
            <Button size="sm" className="mt-1.5" onClick={() => goto(m.to)}>{t('Show on map')}</Button>
          </div>
        ))}
      </Panel>
      <Panel title="Battles">
        {!battles.length ? <p className="text-xs text-parchment-300/70">{t('No battles right now.')}</p> : battles.map((b) => (
          <div key={b.id} className="mb-2 text-xs"><b className="text-gold-100">{n(w.provinces[b.province].name)}</b> · {Math.round(battleProgress(w, b) * 100)}% · {num(soldiersOf(b.a))} vs {num(soldiersOf(b.d))}</div>
        ))}
      </Panel>
      <Panel title="Recent battle reports">
        {!reports.length ? <p className="text-xs text-parchment-300/70">{t('No reports yet.')}</p> : reports.map((r) => (
          <div key={r.id} className="mb-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-gold-700/10 pb-1.5 text-xs">
            <span><b className={r.winner === me ? 'text-emerald-300' : 'text-blood-400'}>{t(r.winner === me ? 'Victory' : 'Defeat')}</b> · {n(w.provinces[r.province].name)}</span>
            <span className="text-parchment-300/70">{t('Killed')}: {num(r.aKilled + r.dKilled)} · {t('Fled')}: {num(r.aFled + r.dFled)} · {t('Prisoners')}: {num(r.prisoners)} · {t('Gold')}: {num(r.lootGold)} · {t('Food')}: {num(r.lootFood)}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
