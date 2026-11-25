import { useMemo, useState } from 'react';
import { RequirePlayer } from './common';
import { useGame } from '../../store/game';
import { Panel, Badge, Button } from '../../components/ui';
import { Flag } from '../../components/ui/Flag';
import { useN, useT } from '../../i18n';
import { countryStats, findWar, truceActive, rtOf, repayLoan } from '../../engine/rt';
import { peekRelation } from '../../engine/util';
import { DiplomacyModal } from '../../components/game/DiplomacyModal';
import { num } from '../../components/game/parts';
import type { World } from '../../types/game';

export default function DiplomacyPage() {
  return <RequirePlayer>{(c, w) => <Inner me={c.id} w={w} />}</RequirePlayer>;
}

function Inner({ me, w }: { me: string; w: World }) {
  const t = useT();
  const n = useN();
  const select = useGame((s) => s.select);
  const act = useGame((s) => s.act);
  const [target, setTarget] = useState<string | null>(null);
  const rt = rtOf(w);
  const list = useMemo(() => Object.values(w.countries).filter((c) => c.alive && c.id !== me && !c.tribal).map((c) => ({ c, s: countryStats(w, c.id) })).sort((a, b) => b.s.soldiers - a.s.soldiers).slice(0, 80), [w, me, rt.reports.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const debts = rt.loans.filter((l) => l.status === 'active' && l.borrower === me);
  return (
    <div className="space-y-4">
      {debts.length > 0 && (
        <Panel title="Debts" subtitle="Unpaid loans lead to war.">
          {debts.map((l) => (
            <div key={l.id} className="mb-1.5 flex items-center justify-between text-xs"><span>{n(w.countries[l.lender]?.name ?? '?')} — <b className="stat-num">{num(l.owed)}</b> {t('gold')} · {Math.max(0, Math.round(l.dueT - rt.t))} {t('sec')}</span><Button size="sm" variant="gold" onClick={() => act((ww) => repayLoan(ww, me, l.id))}>{t('Repay')}</Button></div>
          ))}
        </Panel>
      )}
      <Panel title="Nations" subtitle="Click a nation to open diplomacy with it.">
        <div className="max-h-[60vh] overflow-auto">
          {list.map(({ c, s }) => {
            const war = findWar(w, me, c.id);
            const rel = peekRelation(w, me, c.id);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-gold-700/10 py-1.5 text-xs">
                <Flag flag={c.flag} className="h-5 w-8 shrink-0 rounded-sm" />
                <button className="min-w-[6.5rem] flex-1 truncate text-left text-parchment-50 hover:text-gold-100" onClick={() => select(null, c.id)}>{n(c.name)}</button>
                <span className="stat-num whitespace-nowrap text-parchment-300/70">{num(s.soldiers)} {t('soldiers')}</span>
                {war ? <Badge tone="red">{t('At war')}</Badge> : rel?.treaties.alliance ? <Badge tone="green">{t('Allied')}</Badge> : truceActive(w, me, c.id) ? <Badge tone="blue">{t('Truce')}</Badge> : <Badge tone="gray">{Math.round(rel?.opinion ?? 0)}</Badge>}
                <Button size="sm" onClick={() => setTarget(c.id)}>{t('Diplomacy')}</Button>
              </div>
            );
          })}
        </div>
      </Panel>
      {target && <DiplomacyModal target={target} onClose={() => setTarget(null)} />}
    </div>
  );
}
