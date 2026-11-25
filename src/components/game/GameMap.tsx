import { useMemo, useState } from 'react';
import { WorldMap } from '../map/WorldMap';
import { useGame } from '../../store/game';
import { computeFills } from '../../lib/mapColors';
import { useSettings } from '../../services/settings';
import { useN, useT } from '../../i18n';
import { cityKind, rtOf, soldiersOf, battleProgress } from '../../engine/rt';
import { num } from './parts';

export function GameMap() {
  const world = useGame((s) => s.world)!;
  const version = useGame((s) => s.version);
  const mapVersion = useGame((s) => s.mapVersion);
  const mode = useGame((s) => s.mapMode);
  const selectedCountry = useGame((s) => s.selectedCountry);
  const selectedProvince = useGame((s) => s.selectedProvince);
  const mission = useGame((s) => s.mission);
  const clickProvince = useGame((s) => s.clickProvince);
  const parchment = useSettings((s) => s.parchmentMap);
  const t = useT();
  const n = useN();
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);

  // political colours change only when borders change; the military overlay refreshes every few seconds
  const refreshKey = mode === 'military' ? Math.floor(version / 8) + mapVersion : mapVersion;
  const fills = useMemo(() => computeFills(world, mode, selectedCountry, parchment),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, mode, selectedCountry, parchment, refreshKey]);
  const owners = useMemo(() => world.provinces.map((p) => p.owner), [world, mapVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const lang = t('Political');
  const labels = useMemo(() => Object.values(world.countries).filter((c) => c.alive && !c.tribal).map((c) => ({ owner: c.id, name: n(c.name) })), [world, mapVersion, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const occupied = useMemo(() => world.provinces.filter((p) => p.owner && p.controller !== p.owner).map((p) => p.id), [world, mapVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const rt = rtOf(world);
  const me = world.player;
  const armies = rt.marches.map((m) => {
    const total = Math.max(1, m.arriveT - m.startT);
    const mine = m.owner === me;
    const to = world.provinces[m.to];
    const heading = to?.owner === me;
    const ally = !mine && m.kind === 'support' && me && world.relations && false;
    return { id: m.id, a: m.from, b: m.to, p: Math.max(0, Math.min(1, (rt.t - m.startT) / total)), tone: (mine ? 'mine' : ally ? 'ally' : 'foe') as 'mine' | 'foe' | 'ally', sea: m.sea, label: mine || heading ? `${num(soldiersOf(m.units))}` : undefined };
  });
  const fights = rt.battles.map((b) => b.province);
  void battleProgress;

  const hp = hover ? world.provinces[hover.id] : null;
  const ho = hp?.owner ? world.countries[hp.owner] : null;
  const hs = hp ? rt.cities[hp.id] : null;
  return (
    <div className={`absolute inset-0 ${mission ? 'cursor-crosshair' : ''}`}>
      <WorldMap owners={owners} fills={fills} fillVersion={refreshKey + (selectedCountry ? selectedCountry.length : 0) + mode.length} borderVersion={mapVersion}
        labels={labels} occupied={occupied} selectedOwner={selectedCountry} selectedProvince={selectedProvince} year={world.date.y}
        armies={armies} fights={fights} missionFrom={mission?.from ?? null}
        onProvinceClick={(id) => clickProvince(id)}
        onHover={(id, e) => setHover(id === null || !e ? null : { id, x: e.clientX, y: e.clientY })} />
      {hp && hover && hs && (
        <div className="pointer-events-none fixed z-30 max-w-xs rounded-md bg-ink-950/95 px-3 py-2 text-xs shadow-panel" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <div className="font-serif text-base font-bold text-gold-100">{n(hp.name)}</div>
          <div className="text-parchment-300/70">{t(cityKind(world, hp.id) === 'capital' ? 'Capital' : cityKind(world, hp.id) === 'city' ? 'City' : cityKind(world, hp.id) === 'fortress' ? 'Castle' : cityKind(world, hp.id) === 'town' ? 'Town' : 'Village')} · {ho ? n(ho.name) : t('Unclaimed land')}</div>
          {ho && <div className="mt-1 text-parchment-100">{t('Soldiers')}: <b className="stat-num">{num(soldiersOf(hs.garrison))}</b> · {t('Gold')}: <b className="stat-num">{num(hs.gold)}</b></div>}
          <div className="mt-1 text-[11px] text-parchment-300/60">{mission ? t(mission.kind === 'attack' ? 'Click to choose this target.' : 'Click to send help here.') : t('Click: nation · click again: city')}</div>
        </div>
      )}
    </div>
  );
}
