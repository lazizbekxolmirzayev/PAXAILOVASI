import { useMemo, useState } from 'react';
import { Handshake, Swords, X } from 'lucide-react';
import { useGame } from '../../store/game';
import { Badge, Button, Slider } from '../ui';
import { Flag } from '../ui/Flag';
import { useN, useT } from '../../i18n';
import { countryStats, rtOf, soldiersOf, cityKind, campaignAgainst, findWar, truceActive } from '../../engine/rt';
import { KV, Res, UnitsGrid, num } from './parts';
import { CityPanel } from './CityPanel';
import { DiplomacyModal } from './DiplomacyModal';
import { cityKindLabel } from './SendDialog';

export function CountryPanel({ onClose }: { onClose: () => void }) {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const cid = useGame((s) => s.selectedCountry);
  const pid = useGame((s) => s.selectedProvince);
  const select = useGame((s) => s.select);
  const t = useT();
  if (pid !== null) {
    return (
      <div className="panel panel-ornate pointer-events-auto flex max-h-full w-full flex-col overflow-hidden p-3 md:w-[340px]">
        <div className="mb-1 flex justify-end"><button onClick={onClose} className="rounded p-1 text-parchment-300 hover:text-gold-100" aria-label={t('Close')}><X className="h-4 w-4" /></button></div>
        <CityPanel pid={pid} onBack={() => select(null, w.provinces[pid]?.owner ?? null)} />
      </div>
    );
  }
  if (!cid || !w.countries[cid]) {
    return (
      <div className="panel pointer-events-auto w-full p-4 text-sm text-parchment-200 md:w-[340px]">
        <div className="mb-1 flex items-center justify-between"><b className="title-display text-gold-200">{t('The world')}</b><button onClick={onClose} aria-label={t('Close')}><X className="h-4 w-4" /></button></div>
        {t('Click a nation on the map to see its full strength. Click it again on one of its cities for the city details.')}
      </div>
    );
  }
  return <Overview cid={cid} onClose={onClose} />;
}

function Overview({ cid, onClose }: { cid: string; onClose: () => void }) {
  const w = useGame((s) => s.world)!;
  const select = useGame((s) => s.select);
  const act = useGame((s) => s.act);
  const t = useT();
  const n = useN();
  const [dipl, setDipl] = useState(false);
  const [frac, setFrac] = useState(0.7);
  const c = w.countries[cid];
  const me = w.player;
  const mine = cid === me;
  const s = countryStats(w, cid);
  const rt = rtOf(w);
  const war = me && !mine ? findWar(w, me, cid) : undefined;
  const truce = me && !mine && truceActive(w, me, cid);
  const cities = useMemo(() => w.provinces.filter((p) => p.owner === cid).sort((a, b) => soldiersOf(rt.cities[b.id].garrison) - soldiersOf(rt.cities[a.id].garrison)), [w, cid, rt.reports.length, w.provinces.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const loans = rt.loans.filter((l) => l.status === 'active' && (l.borrower === cid || l.lender === cid));
  return (
    <div className="panel panel-ornate pointer-events-auto flex max-h-full w-full flex-col overflow-hidden p-3 md:w-[340px]">
      <div className="flex items-start gap-2.5">
        <Flag flag={c.flag} className="h-10 w-14 shrink-0 rounded-sm" title={n(c.name)} />
        <div className="min-w-0 flex-1">
          <h3 className="title-display truncate text-base text-gold-100">{n(c.name)}</h3>
          <div className="text-[11px] text-parchment-300/70">{t(c.ruler.title)} {n(c.ruler.name)}</div>
          <div className="mt-1 flex flex-wrap gap-1">{mine && <Badge tone="gold">{t('Your nation')}</Badge>}{war && <Badge tone="red">{t('At war')}</Badge>}{truce && !war && <Badge tone="blue">{t('Truce')}</Badge>}{!c.alive && <Badge tone="gray">{t('Fallen')}</Badge>}</div>
        </div>
        <button onClick={onClose} className="rounded p-1 text-parchment-300 hover:text-gold-100" aria-label={t('Close')}><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-3 rounded-md bg-ink-950/50 p-2.5 ring-1 ring-gold-700/20">
        <KV k="Cities" v={s.cities} />
        <KV k="Soldiers" v={num(s.soldiers)} />
        <KV k="Fleet" v={num(s.ships)} />
        <KV k="Gold" v={<Res gold={s.gold} />} />
        <KV k="Food" v={<Res food={s.food} />} />
        <KV k="Income per minute" v={<span>+{num(s.goldPerMin)} / +{num(s.foodPerMin)}</span>} />
        <KV k="Population" v={num(s.population)} />
        <UnitsGrid units={s.units} className="mt-2 border-t border-gold-700/15 pt-2" />
      </div>

      {!mine && me && c.alive && (
        <div className="mt-3 space-y-2">
          <Button className="w-full" icon={<Handshake className="h-4 w-4" />} onClick={() => setDipl(true)}>{t('Diplomacy')}</Button>
          <div className="rounded-md bg-ink-950/50 p-2.5 ring-1 ring-gold-700/20">
            <div className="label">{t('Campaign against this nation')}</div>
            <Slider value={frac} min={0.1} max={1} step={0.05} onChange={setFrac} format={(v) => `${Math.round(v * 100)}%`} />
            <Button variant="danger" className="mt-2 w-full" icon={<Swords className="h-4 w-4" />} onClick={() => act((ww, ss) => campaignAgainst(ww, ss, me, cid, frac))}>{t('All cities march out')}</Button>
            <p className="mt-1 text-[11px] text-parchment-300/60">{t('Every border city sends this share of its troops against the weakest neighbouring city. Or open one of their cities below and choose a single target.')}</p>
          </div>
        </div>
      )}

      {mine && loans.length > 0 && <div className="mt-2 text-[11px] text-amber-300">{t('Active loans')}: {loans.length}</div>}

      <div className="label mt-3">{t('Cities')} ({cities.length})</div>
      <div className="scroll-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {cities.slice(0, 120).map((p) => {
          const cs = rt.cities[p.id];
          return (
            <button key={p.id} onClick={() => select(p.id, cid)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-ink-800">
              <span className="min-w-0 truncate text-parchment-50">{n(p.name)} <span className="text-[10px] text-parchment-300/55">{t(cityKindLabel(cityKind(w, p.id)))}</span></span>
              <span className="stat-num shrink-0 text-parchment-300/80">{num(soldiersOf(cs.garrison))} · {num(cs.gold)}</span>
            </button>
          );
        })}
      </div>
      {dipl && <DiplomacyModal target={cid} onClose={() => setDipl(false)} />}
    </div>
  );
}
