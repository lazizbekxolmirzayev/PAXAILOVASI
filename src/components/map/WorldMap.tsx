import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { Minus, Plus, Maximize2 } from 'lucide-react';
import { loadPhysical, loadTopology, loadMeta } from '../../services/mapData';
import type { ProvinceMeta } from '../../engine/create';
import { citiesForYear, cityName } from '../../data/cities';
import { useSettings } from '../../services/settings';
import { tr } from '../../i18n';

export const MAP_W = 1600, MAP_H = 820;

interface Geo { topo: Topology; phys: Topology; meta: ProvinceMeta[] }
let geoCache: Geo | null = null;
function useGeo(): { geo: Geo | null; error: string | null } {
  const [geo, setGeo] = useState<Geo | null>(geoCache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (geoCache) return;
    let live = true;
    Promise.all([loadTopology(), loadPhysical(), loadMeta()]).then(([topo, phys, meta]) => { geoCache = { topo, phys, meta }; if (live) setGeo(geoCache); }).catch((e) => live && setError(String(e.message ?? e)));
    return () => { live = false; };
  }, []);
  return { geo, error };
}

const projection = geoNaturalEarth1().scale(290).translate([MAP_W / 2 - 20, MAP_H / 2 + 40]);
const pathGen = geoPath(projection);

interface Prepared {
  ids: number[]; d: string[]; centroids: Record<number, [number, number]>; areas: Record<number, number>;
  rivers: string; lakes: string; deserts: string; mountains: string; graticule: string; sphere: string; coast: string;
}
let prepCache: Prepared | null = null;
function prepare(g: Geo): Prepared {
  if (prepCache) return prepCache;
  const obj = g.topo.objects.prov as GeometryCollection<{ i: number }>;
  const fc = feature(g.topo, obj) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { i: number }>;
  const ids: number[] = [], d: string[] = [];
  const centroids: Record<number, [number, number]> = {}, areas: Record<number, number> = {};
  for (const f of fc.features) {
    const id = f.properties.i;
    ids.push(id); d.push(pathGen(f as GeoPermissibleObjects) ?? '');
    centroids[id] = pathGen.centroid(f as GeoPermissibleObjects) as [number, number];
    areas[id] = pathGen.area(f as GeoPermissibleObjects);
  }
  const po = g.phys.objects as Record<string, GeometryCollection<{ kind?: string; name?: string }>>;
  const regions = feature(g.phys, po.regions) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { kind: string }>;
  const sel = (k: string[]) => pathGen({ type: 'FeatureCollection', features: regions.features.filter((f) => k.includes(f.properties.kind)) } as GeoPermissibleObjects) ?? '';
  prepCache = {
    ids, d, centroids, areas,
    rivers: pathGen(mesh(g.phys, po.rivers as never) as GeoPermissibleObjects) ?? '',
    lakes: pathGen(feature(g.phys, po.lakes) as unknown as GeoPermissibleObjects) ?? '',
    deserts: sel(['Desert']), mountains: sel(['Range/mtn']),
    graticule: pathGen(geoGraticule10()) ?? '', sphere: pathGen({ type: 'Sphere' }) ?? '',
    coast: pathGen(mesh(g.topo, obj as never, (a, b) => a === b) as GeoPermissibleObjects) ?? '',
  };
  return prepCache;
}

export interface MapLabel { owner: string; name: string; color?: string }
export interface WorldMapProps {
  owners: (string | null)[];
  fills: string[];
  fillVersion: number;
  borderVersion: number;
  labels?: MapLabel[];
  occupied?: number[];
  selectedOwner?: string | null;
  selectedProvince?: number | null;
  highlight?: Set<number> | null;
  routes?: [number, number][];
  year: number;
  onProvinceClick?: (id: number, e: React.MouseEvent) => void;
  onHover?: (id: number | null, e?: React.MouseEvent) => void;
  decorative?: boolean;
  focusProvince?: number | null;
  className?: string;
  showControls?: boolean;
  capitals?: { id: number; name: string; player?: boolean; major?: boolean }[];
  battles?: { id: number; fresh: boolean }[];
}

export const WorldMap = memo(function WorldMap(props: WorldMapProps) {
  const { geo, error } = useGeo();
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const pathsRef = useRef<Map<number, SVGPathElement>>(new Map());
  const fillsRef = useRef<string[]>(props.fills);
  fillsRef.current = props.fills;
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [k, setK] = useState(1);
  const settings = useSettings();
  const prep = useMemo(() => (geo ? prepare(geo) : null), [geo]);

  // imperative fill updates (avoids reconciling ~2,600 paths every tick)
  useEffect(() => {
    if (!prep) return;
    for (const [id, el] of pathsRef.current) el.setAttribute('fill', props.fills[id] ?? '#3a3a3a');
  }, [prep, props.fillVersion, props.fills]);

  // borders between different owners + selected country outline
  const borders = useMemo(() => {
    if (!geo) return { country: '', province: '', selected: '' };
    const obj = geo.topo.objects.prov as GeometryCollection<{ i: number }>;
    const own = (g: unknown) => props.owners[(g as { properties: { i: number } }).properties.i] ?? null;
    const country = pathGen(mesh(geo.topo, obj as never, (a, b) => a !== b && own(a) !== own(b)) as GeoPermissibleObjects) ?? '';
    const province = pathGen(mesh(geo.topo, obj as never, (a, b) => a !== b && own(a) === own(b) && own(a) !== null) as GeoPermissibleObjects) ?? '';
    const s = props.selectedOwner;
    const selected = s ? pathGen(mesh(geo.topo, obj as never, (a, b) => (a === b ? own(a) === s : (own(a) === s) !== (own(b) === s))) as GeoPermissibleObjects) ?? '' : '';
    return { country, province, selected };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, props.borderVersion, props.selectedOwner]);

  // country labels at area-weighted centroids
  const labels = useMemo(() => {
    if (!prep || !props.labels) return [];
    const acc = new Map<string, { x: number; y: number; a: number; minx: number; maxx: number }>();
    for (const id of prep.ids) {
      const o = props.owners[id];
      if (!o) continue;
      const c = prep.centroids[id], a = prep.areas[id];
      if (!c || !Number.isFinite(c[0])) continue;
      const e = acc.get(o) ?? { x: 0, y: 0, a: 0, minx: Infinity, maxx: -Infinity };
      e.x += c[0] * a; e.y += c[1] * a; e.a += a; e.minx = Math.min(e.minx, c[0]); e.maxx = Math.max(e.maxx, c[0]);
      acc.set(o, e);
    }
    const cand: { name: string; x: number; y: number; size: number; width: number }[] = [];
    for (const l of props.labels) {
      const e = acc.get(l.owner);
      if (!e || e.a < 40) continue;
      const name = l.name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
      const width = Math.min(e.maxx - e.minx + 20, Math.sqrt(e.a) * 2.2);
      const size = Math.max(4, Math.min(34, Math.sqrt(e.a) / Math.max(4, name.length) * 1.9));
      cand.push({ name, x: e.x / e.a, y: e.y / e.a, size, width });
    }
    // greedy collision culling: larger labels win
    cand.sort((a, b) => b.size - a.size);
    const out: typeof cand = [];
    const boxes: [number, number, number, number][] = [];
    for (const c of cand) {
      const hw = (c.name.length * c.size * 0.82) / 2, hh = c.size * 0.6;
      const b: [number, number, number, number] = [c.x - hw, c.y - hh, c.x + hw, c.y + hh];
      if (boxes.some((o) => !(b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]))) continue;
      boxes.push(b); out.push(c);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep, props.borderVersion, props.labels]);

  const cities = useMemo(() => citiesForYear(props.year).map((c) => { const p = projection([c.lon, c.lat]); return p ? { id: c.id, name: cityName(c, props.year), x: p[0], y: p[1] } : null; }).filter(Boolean) as { id: string; name: string; x: number; y: number }[], [props.year]);

  const routes = useMemo(() => {
    if (!prep || !props.routes?.length || !geo) return '';
    const lines = props.routes.map(([a, b]) => [[geo.meta[a].x, geo.meta[a].y], [geo.meta[b].x, geo.meta[b].y]]);
    return pathGen({ type: 'MultiLineString', coordinates: lines } as GeoPermissibleObjects) ?? '';
  }, [prep, props.routes, geo]);

  const occupiedPaths = useMemo(() => {
    if (!prep || !props.occupied?.length) return [];
    const idx = new Map(prep.ids.map((id, i) => [id, i]));
    return props.occupied.map((id) => ({ id, d: prep.d[idx.get(id) ?? -1] })).filter((x) => x.d);
  }, [prep, props.occupied]);

  // zoom & pan
  useEffect(() => {
    if (!svgRef.current || !gRef.current || props.decorative) return;
    const z = d3zoom<SVGSVGElement, unknown>().scaleExtent([1, 24]).translateExtent([[-200, -100], [MAP_W + 200, MAP_H + 100]])
      .on('zoom', (ev: { transform: ZoomTransform }) => {
        gRef.current!.setAttribute('transform', ev.transform.toString());
        const nk = Math.round(ev.transform.k * 4) / 4;
        setK((old) => (old !== nk ? nk : old));
      });
    zoomRef.current = z;
    select(svgRef.current).call(z).on('dblclick.zoom', null);
    return () => { select(svgRef.current!).on('.zoom', null); };
  }, [prep, props.decorative]);

  useEffect(() => {
    if (props.focusProvince == null || !prep || !svgRef.current || !zoomRef.current) return;
    const c = prep.centroids[props.focusProvince];
    if (!c) return;
    const scale = 3.2;
    const t = zoomIdentity.translate(MAP_W / 2 - c[0] * scale, MAP_H / 2 - c[1] * scale).scale(scale);
    select(svgRef.current).transition().duration(settings.reduceMotion ? 0 : 900).call(zoomRef.current.transform as never, t);
  }, [props.focusProvince, prep, settings.reduceMotion]);

  // stable province layer: rendered once per geometry, recoloured imperatively
  const handlers = useRef({ click: props.onProvinceClick, hover: props.onHover });
  handlers.current = { click: props.onProvinceClick, hover: props.onHover };
  const provinceLayer = useMemo(() => prep && (
    <g onClick={(e) => { const a = (e.target as SVGElement).getAttribute('data-id'); if (a !== null) handlers.current.click?.(Number(a), e); }}
      onMouseMove={(e) => { const a = (e.target as SVGElement).getAttribute('data-id'); handlers.current.hover?.(a === null ? null : Number(a), e); }}
      onMouseLeave={() => handlers.current.hover?.(null)}>
      {prep.ids.map((id, i) => (
        <path key={id} data-id={id} d={prep.d[i]} className="map-province" stroke="none"
          ref={(el) => { if (el) { pathsRef.current.set(id, el); el.setAttribute('fill', fillsRef.current[id] ?? '#3a3a3a'); } else pathsRef.current.delete(id); }} />
      ))}
    </g>
  ), [prep]);

  const zoomBy = (f: number) => { if (svgRef.current && zoomRef.current) select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy as never, f); };
  const reset = () => { if (svgRef.current && zoomRef.current) select(svgRef.current).transition().duration(500).call(zoomRef.current.transform as never, zoomIdentity); };

  if (error) return <div className="flex h-full items-center justify-center text-sm text-blood-400">{tr('Map data failed to load:')} {error}</div>;
  if (!prep) return <div className="flex h-full items-center justify-center"><div className="title-display animate-pulse text-sm text-gold-200">{tr('Charting the known world…')}</div></div>;

  const parchment = settings.parchmentMap;
  const inv = 1 / k;
  return (
    <div className={`relative h-full w-full overflow-hidden ${props.className ?? ''}`}>
      <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full touch-none select-none" style={{ background: parchment ? '#10222c' : '#0a1424' }}>
        <defs>
          <radialGradient id="ocean" cx="50%" cy="45%" r="75%">
            <stop offset="0" stopColor={parchment ? '#2f5864' : '#18304f'} /><stop offset="1" stopColor={parchment ? '#132833' : '#0a1424'} />
          </radialGradient>
          <pattern id="desertPat" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".6" fill="rgba(120,80,30,.45)" /><circle cx="4.5" cy="4.2" r=".5" fill="rgba(120,80,30,.35)" /></pattern>
          <pattern id="mtnPat" width="10" height="8" patternUnits="userSpaceOnUse"><path d="M1 7 L4 2 L7 7" fill="none" stroke="rgba(60,40,20,.45)" strokeWidth=".7" /></pattern>
          <pattern id="wavePat" width="48" height="24" patternUnits="userSpaceOnUse">
            <path d="M0 12 Q6 8 12 12 T24 12 T36 12 T48 12" fill="none" stroke={parchment ? 'rgba(236,223,192,.10)' : 'rgba(150,190,255,.07)'} strokeWidth=".7" />
            <path d="M-12 22 Q-6 18 0 22 T12 22 T24 22" fill="none" stroke={parchment ? 'rgba(236,223,192,.07)' : 'rgba(150,190,255,.05)'} strokeWidth=".6" />
            <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="48 0" dur="18s" repeatCount="indefinite" />
          </pattern>
          <radialGradient id="capGlow"><stop offset="0" stopColor="#fff3c9" stopOpacity=".9" /><stop offset="1" stopColor="#fff3c9" stopOpacity="0" /></radialGradient>
          <pattern id="occPat" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="rgba(150,20,20,.55)" /></pattern>
        </defs>
        <g ref={gRef}>
          <path d={prep.sphere} fill="url(#ocean)" />
          {!props.decorative && <path d={prep.sphere} fill="url(#wavePat)" pointerEvents="none" />}
          <path d={prep.coast} className="map-border" fill="none" stroke={parchment ? 'rgba(190,230,235,.18)' : 'rgba(120,180,255,.12)'} strokeWidth={9} pointerEvents="none" />
          <path d={prep.coast} className="map-border" fill="none" stroke={parchment ? 'rgba(210,240,240,.22)' : 'rgba(140,200,255,.15)'} strokeWidth={4} pointerEvents="none" />
          <path d={prep.graticule} fill="none" stroke={parchment ? 'rgba(236,223,192,.10)' : 'rgba(120,160,220,.08)'} strokeWidth={0.6 * inv} />
          {provinceLayer}
          {settings.showTerrain && <g pointerEvents="none"><path d={prep.deserts} fill="url(#desertPat)" /><path d={prep.mountains} fill="url(#mtnPat)" /></g>}
          {occupiedPaths.map((o) => <path key={o.id} d={o.d} fill="url(#occPat)" pointerEvents="none" />)}
          {props.highlight && prep.ids.filter((id) => props.highlight!.has(id)).map((id) => <path key={`h${id}`} d={prep.d[prep.ids.indexOf(id)]} fill="rgba(243,230,189,.35)" stroke="#f3e6bd" strokeWidth={1.2 * inv} pointerEvents="none" />)}
          {settings.showRivers && <><path d={prep.lakes} fill={parchment ? '#2f5864' : '#18304f'} pointerEvents="none" /><path d={prep.rivers} fill="none" stroke={parchment ? 'rgba(52,96,120,.85)' : 'rgba(70,130,200,.6)'} strokeWidth={0.8 * inv} pointerEvents="none" /></>}
          {k >= 2 && <path d={borders.province} className="map-border" fill="none" stroke="rgba(20,15,10,.35)" strokeWidth={0.4} />}
          <path d={prep.coast} className="map-border" fill="none" stroke={parchment ? 'rgba(40,28,14,.75)' : 'rgba(150,190,240,.35)'} strokeWidth={0.9} />
          <path d={borders.country} className="map-border" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={3.2} />
          <path d={borders.country} className="map-border" fill="none" stroke={parchment ? 'rgba(40,26,10,.9)' : 'rgba(10,10,20,.95)'} strokeWidth={1.2} />
          <path d={borders.country} className="map-border" fill="none" stroke="rgba(255,240,200,.22)" strokeWidth={0.5} transform={`translate(${0.6 * inv} ${0.6 * inv})`} />
          {borders.selected && <>
            <path d={borders.selected} className="map-border selected-glow" fill="none" stroke="rgba(243,214,122,.55)" strokeWidth={7} />
            <path d={borders.selected} className="map-border" fill="none" stroke="#fffaf0" strokeWidth={2} />
          </>}
          {settings.showTradeRoutes && routes && <path d={routes} fill="none" stroke="rgba(233,200,106,.75)" strokeWidth={1.2 * inv} strokeDasharray={`${4 * inv} ${3 * inv}`} pointerEvents="none" />}
          {props.selectedProvince != null && prep.centroids[props.selectedProvince] && (
            <circle cx={prep.centroids[props.selectedProvince][0]} cy={prep.centroids[props.selectedProvince][1]} r={4 * inv} fill="none" stroke="#fbf6e6" strokeWidth={1.5 * inv} pointerEvents="none" />
          )}
          {props.capitals && k >= 1.3 && props.capitals.filter((c) => (c.major || c.player || k >= 2.4) && prep.centroids[c.id]).map((c) => {
            const [x, y] = prep.centroids[c.id];
            const r = (c.player ? 5 : 3.4) * inv;
            return (
              <g key={`cap${c.id}`} pointerEvents="none">
                {c.player && <circle cx={x} cy={y} r={r * 2.6} fill="url(#capGlow)" />}
                <path d={`M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y - r * 0.2} L${x + r * 0.45} ${y + r * 0.25} L${x + r * 0.62} ${y + r} L${x} ${y + r * 0.6} L${x - r * 0.62} ${y + r} L${x - r * 0.45} ${y + r * 0.25} L${x - r} ${y - r * 0.2} L${x - r * 0.3} ${y - r * 0.3} Z`} fill={c.player ? '#f3d27a' : '#e9dbb8'} stroke="#1b1208" strokeWidth={0.7 * inv} />
              </g>
            );
          })}
          {props.battles?.map((b) => {
            const ct = prep.centroids[b.id];
            if (!ct) return null;
            const [x, y] = ct, r = 6 * inv;
            return (
              <g key={`bt${b.id}`} pointerEvents="none">
                {b.fresh && <circle cx={x} cy={y} r={r * 1.4} fill="none" stroke="#ff6b4a" strokeWidth={1.5 * inv} className="pulse-ring" />}
                <circle cx={x} cy={y} r={r} fill="#5a1a14" stroke="#f3d27a" strokeWidth={1 * inv} />
                <path d={`M${x - r * 0.55} ${y - r * 0.55} L${x + r * 0.55} ${y + r * 0.55} M${x + r * 0.55} ${y - r * 0.55} L${x - r * 0.55} ${y + r * 0.55}`} stroke="#fff3c9" strokeWidth={1.3 * inv} strokeLinecap="round" />
              </g>
            );
          })}
          {labels.map((l) => {
            const fs = l.size;
            const visible = fs * k > 7 && fs * k < 90;
            return visible && (
              <text key={l.name} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" className="map-label" fontSize={fs} fill={parchment ? 'rgba(40,26,12,.78)' : 'rgba(243,230,189,.85)'} stroke={parchment ? 'rgba(236,223,192,.35)' : 'rgba(0,0,0,.6)'} strokeWidth={fs * 0.08}>{l.name}</text>
            );
          })}
          {settings.showCityLabels && k >= 1.6 && cities.map((c) => (
            <g key={c.id} pointerEvents="none">
              <circle cx={c.x} cy={c.y} r={1.8 * inv} fill="#fbf6e6" stroke="#1b1208" strokeWidth={0.6 * inv} />
              {k >= 2.6 && <text x={c.x + 3 * inv} y={c.y - 2 * inv} className="map-city" fontSize={9 * inv} fill="#fbf6e6" stroke="rgba(0,0,0,.75)" strokeWidth={2.4 * inv}>{c.name}</text>}
            </g>
          ))}
        </g>
      </svg>
      {parchment && <div className="pointer-events-none absolute inset-0 mix-blend-multiply opacity-60" style={{ backgroundImage: 'var(--noise)' }} />}
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 120px 30px rgba(0,0,0,.65)' }} />
      {props.showControls !== false && !props.decorative && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
          <button className="nav-icon !h-9 !w-9" onClick={() => zoomBy(1.6)} aria-label={tr('Zoom in')}><Plus className="h-4 w-4" /></button>
          <button className="nav-icon !h-9 !w-9" onClick={() => zoomBy(1 / 1.6)} aria-label={tr('Zoom out')}><Minus className="h-4 w-4" /></button>
          <button className="nav-icon !h-9 !w-9" onClick={reset} aria-label={tr('Reset view')}><Maximize2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
});

export function provinceCentroid(id: number): [number, number] | null { return prepCache?.centroids[id] ?? null; }
export { projection };
