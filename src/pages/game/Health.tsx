import { Link } from 'react-router-dom';
import { RequirePlayer } from './common';
import { Badge, Bar, Panel, Stat } from '../../components/ui';
import { fmtNum, modifierSum } from '../../engine/util';
import { TECHS } from '../../data/technologies';
import { computeCalc } from '../../engine/systems';
import { tr } from '../../i18n';

export default function HealthPage() {
  return (
    <RequirePlayer>{(c, w) => {
      const h = c.health;
      const calc = computeCalc(w, c);
      const protection = Math.min(0.65, h.care / 300 + h.sanitation / 300);
      const deathMod = modifierSum(w, c, 'deathRate');
      const active = w.countries && Object.values(w.countries).filter((x) => x.alive && x.health.epidemic).slice(0, 12);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label={tr('Healthcare')} value={Math.round(h.care)} sub="0–100" />
            <Stat label={tr('Sanitation')} value={Math.round(h.sanitation)} />
            <Stat label={tr('Medical knowledge')} value={Math.round(h.medicine)} />
            <Stat label={tr('Deaths / month')} value={fmtNum(c.pop.deaths)} />
          </div>
          <Panel title={tr('Current health situation')}>
            {h.epidemic ? (
              <div className="rounded-md bg-blood-600/15 p-3 ring-1 ring-blood-400/40">
                <div className="font-semibold text-blood-400">{h.epidemic.name} — severity {Math.round(h.epidemic.severity * 100)}%</div>
                <div className="text-xs text-parchment-200">{tr('Began in')} {w.provinces[h.epidemic.origin]?.name}. ~{h.epidemic.monthsLeft} months remaining. Spreads to neighbours and trade partners; quarantine technology and sanitation reduce spread.</div>
              </div>
            ) : <p className="text-sm text-emerald-300">{tr('No active epidemic.')}</p>}
            <div className="mt-4 space-y-2">
              <Bar label={tr('Protection from disease (healthcare + sanitation)')} value={protection * 100} right={`${Math.round(protection * 100)}%`} color="green" />
              <Bar label={tr('Mortality reduction from medical technology')} value={-deathMod * 100} max={40} right={`${Math.round(-deathMod * 100)}%`} color="blue" />
            </div>
            <p className="mt-2 text-xs text-parchment-300/70">{tr('Health budget effect ×')}{calc.mult.health.toFixed(2)} — <Link to="/game/economy" className="text-gold-300 hover:underline">{tr('adjust budget')}</Link>{tr('. Public works in provinces raise sanitation.')}</p>
          </Panel>
          <Panel title={tr('Medical development')}>
            <div className="flex flex-wrap gap-2">{TECHS.filter((t) => t.category === 'medicine').map((t) => <Badge key={t.id} tone={c.tech.known.includes(t.id) ? 'green' : 'gray'}>{t.name}</Badge>)}</div>
          </Panel>
          <Panel title={tr('Epidemics in the world')}>
            {active.length ? <ul className="space-y-1 text-sm">{active.map((x) => <li key={x.id} className="flex justify-between"><span>{x.name}</span><span className="text-parchment-300/70">{x.health.epidemic!.name} · {Math.round(x.health.epidemic!.severity * 100)}%</span></li>)}</ul> : <p className="text-sm text-parchment-300/60">{tr('No epidemics reported.')}</p>}
          </Panel>
        </div>
      );
    }}</RequirePlayer>
  );
}
