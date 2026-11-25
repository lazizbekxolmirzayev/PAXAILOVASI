import { useMemo, useState } from 'react';
import { WorldMap } from '../map/WorldMap';
import { useGame } from '../../store/game';
import { computeFills } from '../../lib/mapColors';
import { useSettings } from '../../services/settings';
import { fmtNum } from '../../engine/util';
import { REGION_LABEL } from '../../data/regions';
import { tr } from '../../i18n';

export function GameMap({ onProvinceClick, highlight }: { onProvinceClick?: (id: number) => void; highlight?: Set<number> | null }) {
  const world = useGame((s) => s.world)!;
  const version = useGame((s) => s.version);
  const mapVersion = useGame((s) => s.mapVersion);
  const mode = useGame((s) => s.mapMode);
  const selectedCountry = useGame((s) => s.selectedCountry);
  const selectedProvince = useGame((s) => s.selectedProvince);
  const select = useGame((s) => s.select);
  const parchment = useSettings((s) => s.parchmentMap);
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);

  // recolour political maps only when borders change; data overlays refresh every quarter
  const refreshKey = mode === 'political' || mode === 'terrain' ? mapVersion : Math.floor(version / 3);
  const fills = useMemo(() => computeFills(world, mode, selectedCountry, parchment),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, mode, selectedCountry, parchment, refreshKey]);
  const owners = useMemo(() => world.provinces.map((p) => p.owner), [world, mapVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const labels = useMemo(() => Object.values(world.countries).filter((c) => c.alive && !c.tribal).map((c) => ({ owner: c.id, name: c.name })), [world, mapVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const occupied = useMemo(() => world.provinces.filter((p) => p.owner && p.controller !== p.owner).map((p) => p.id), [world, mapVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const routes = useMemo(() => {
    const out: [number, number][] = [];
    const focus = selectedCountry;
    for (const [k, r] of Object.entries(world.relations)) {
      if (!r.treaties.trade) continue;
      const [a, b] = k.split('|');
      if (focus && a !== focus && b !== focus) continue;
      const ca = world.countries[a], cb = world.countries[b];
      if (ca?.alive && cb?.alive && ca.capital >= 0 && cb.capital >= 0) out.push([ca.capital, cb.capital]);
    }
    return focus ? out : out.slice(0, 60);
  }, [world, selectedCountry, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const capitals = useMemo(() => Object.values(world.countries).filter((c) => c.alive && !c.tribal && c.capital >= 0).map((c) => ({ id: c.capital, name: c.name, player: c.id === world.player, major: c.pop.total > 4e6 })), [world, mapVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const battles = useMemo(() => {
    const now = world.date.y * 12 + world.date.m;
    const seen = new Map<number, boolean>();
    for (const war of world.wars) if (!war.ended) for (const b of war.battles) { const age = now - (b.date.y * 12 + b.date.m); if (age <= 6) seen.set(b.province, (seen.get(b.province) ?? false) || age <= 1); }
    return Array.from(seen.entries()).slice(-40).map(([id, fresh]) => ({ id, fresh }));
  }, [world, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const hp = hover ? world.provinces[hover.id] : null;
  const ho = hp?.owner ? world.countries[hp.owner] : null;
  const hc = hp?.controller && hp.controller !== hp.owner ? world.countries[hp.controller] : null;
  return (
    <div className="absolute inset-0">
      <WorldMap owners={owners} fills={fills} fillVersion={refreshKey + (selectedCountry ? selectedCountry.length : 0)} borderVersion={mapVersion}
        labels={labels} occupied={occupied} selectedOwner={selectedCountry} selectedProvince={selectedProvince} highlight={highlight} routes={routes} capitals={capitals} battles={battles} year={world.date.y}
        onProvinceClick={(id) => (onProvinceClick ? onProvinceClick(id) : select(id))}
        onHover={(id, e) => setHover(id === null || !e ? null : { id, x: e.clientX, y: e.clientY })} />
      {hp && hover && (
        <div className="panel pointer-events-none fixed z-30 max-w-xs px-3 py-2 text-xs" style={{ left: hover.x + 16, top: hover.y + 16 }}>
          <div className="font-serif text-base font-bold text-gold-100">{hp.name}</div>
          <div className="text-parchment-300/70">{tr(REGION_LABEL[hp.region])} · {tr('modern')} {hp.modern}</div>
          <div className="mt-1 text-parchment-100">{ho ? ho.name : tr('Unclaimed land')}{hc && <span className="text-blood-400"> · {tr('occupied by')} {hc.name}</span>}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 text-parchment-200/80">
            <span>{tr('Population')}</span><span className="stat-num text-right">{fmtNum(hp.pop)}</span>
            <span>{tr('Development')}</span><span className="stat-num text-right">{hp.dev}</span>
            <span>{tr('Unrest')}</span><span className="stat-num text-right">{Math.round(hp.unrest)}%</span>
            <span>{tr('Terrain')}</span><span className="text-right">{[hp.mountain && 'mountains', hp.desert && 'desert', hp.river && 'river', hp.coastal && 'coast'].filter(Boolean).map((x) => tr(x as string)).join(', ') || tr('plains')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
