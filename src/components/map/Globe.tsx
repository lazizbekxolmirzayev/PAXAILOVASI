import { useEffect, useRef, useState } from 'react';
import { geoArea, geoCentroid, geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { loadOwners } from '../../services/mapData';
import { CORRECTIONS, colorFor } from '../../data/polities';
import { tr } from '../../i18n';

// Low-resolution province geometry for the cinematic 3D globe (≈2,600 shapes, ~120 KB gzip).
let topoP: Promise<Topology> | null = null;
const loadGlobe = () => (topoP ??= fetch(`${import.meta.env.BASE_URL ?? '/'}maps/globe.topo.json`).then((r) => { if (!r.ok) throw new Error('globe data'); return r.json(); }));

interface Prepared { features: { id: number; f: GeoJSON.Feature; color: string }[]; borders: GeoPermissibleObjects; coast: GeoPermissibleObjects; labels: { name: string; c: [number, number]; size: number }[] }
const TRIBAL = /farmers|nomads|tribes|hunters|pastoral|chiefdoms|gatherers|foragers|peoples|culture/i;

async function prepare(key: string, metaModern?: string[]): Promise<Prepared> {
  const [topo, owners] = await Promise.all([loadGlobe(), loadOwners(key)]);
  const obj = topo.objects.prov as GeometryCollection<{ i: number }>;
  const fc = feature(topo, obj) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { i: number }>;
  const corr = CORRECTIONS.filter((c) => c.key === key && c.modern === '*');
  const nameOf = (i: number) => { const o = owners.owner[i]; if (o === undefined || o < 0) return null; let n = owners.polities[o].name; for (const c of corr) if (c.from === n) n = c.to; return n; };
  void metaModern;
  // heavy simplification can invert ring winding; d3 would then fill the whole sphere
  for (const f of fc.features) {
    if (geoArea(f as GeoPermissibleObjects) > 2 * Math.PI) {
      const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
      if (g.type === 'Polygon') g.coordinates.forEach((r) => r.reverse());
      else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => r.reverse()));
    }
  }
  const features = fc.features.filter((f) => geoArea(f as GeoPermissibleObjects) < 2 * Math.PI).map((f) => {
    const n = nameOf(f.properties.i);
    const color = !n ? '#6f6a55' : TRIBAL.test(n) ? '#7a7560' : colorFor(n);
    return { id: f.properties.i, f: f as GeoJSON.Feature, color };
  });
  const own = (g: unknown) => nameOf((g as { properties: { i: number } }).properties.i);
  const borders = mesh(topo, obj as never, (a, b) => a !== b && own(a) !== own(b)) as GeoPermissibleObjects;
  const coast = mesh(topo, obj as never, (a, b) => a === b) as GeoPermissibleObjects;
  // labels for the largest organised states
  const groups = new Map<string, GeoJSON.Feature[]>();
  for (const x of fc.features) { const n = nameOf(x.properties.i); if (n && !TRIBAL.test(n)) { if (!groups.has(n)) groups.set(n, []); groups.get(n)!.push(x as GeoJSON.Feature); } }
  const labels = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 14)
    .map(([name, fs]) => ({ name, c: geoCentroid({ type: 'FeatureCollection', features: fs } as GeoPermissibleObjects) as [number, number], size: Math.min(15, 6 + Math.sqrt(fs.length) * 0.8) }));
  return { features, borders, coast, labels };
}

export function Globe({ mapKey = '1400', size = 640, speed = 4, interactive = true, labels = true, className = '' }: { mapKey?: string; size?: number; speed?: number; interactive?: boolean; labels?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<Prepared | null>(null);
  const rot = useRef<[number, number]>([-40, -18]);
  const drag = useRef<{ x: number; y: number; r: [number, number] } | null>(null);
  useEffect(() => { let live = true; prepare(mapKey).then((d) => live && setData(d)).catch(() => undefined); return () => { live = false; }; }, [mapKey]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr; canvas.height = size * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const R = size * 0.42, cx = size / 2, cy = size / 2;
    const proj = geoOrthographic().scale(R).translate([cx, cy]).clipAngle(90).precision(0.6);
    const path = geoPath(proj, ctx);
    const grat = geoGraticule10();
    let raf = 0, last = performance.now(), acc = 0;
    const reduce = document.documentElement.classList.contains('reduce-motion');
    const draw = (t: number) => {
      const dt = t - last; last = t; acc += dt;
      if (!drag.current && !reduce) rot.current = [rot.current[0] + (speed * dt) / 1000, rot.current[1]];
      if (acc < 1000 / 45) { raf = requestAnimationFrame(draw); return; }
      acc = 0;
      proj.rotate([rot.current[0], rot.current[1], 0]);
      ctx.clearRect(0, 0, size, size);
      // atmosphere
      const atm = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
      atm.addColorStop(0, 'rgba(120,170,255,.45)'); atm.addColorStop(0.35, 'rgba(90,130,230,.16)'); atm.addColorStop(1, 'rgba(40,60,140,0)');
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2); ctx.fill();
      // ocean
      const oc = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
      oc.addColorStop(0, '#3f6f8f'); oc.addColorStop(0.6, '#1c3a55'); oc.addColorStop(1, '#0b1a2c');
      ctx.fillStyle = oc; ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();
      ctx.strokeStyle = 'rgba(200,220,255,.08)'; ctx.lineWidth = 0.6; ctx.beginPath(); path(grat); ctx.stroke();
      // land
      for (const x of data.features) { ctx.beginPath(); path(x.f); ctx.fillStyle = x.color; ctx.fill(); }
      ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(20,12,5,.7)'; ctx.beginPath(); path(data.borders); ctx.stroke();
      ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(240,225,180,.35)'; ctx.beginPath(); path(data.coast); ctx.stroke();
      // lighting: day/night terminator + specular
      const light = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      light.addColorStop(0, 'rgba(255,240,200,.10)'); light.addColorStop(0.45, 'rgba(0,0,0,0)'); light.addColorStop(0.8, 'rgba(3,6,15,.55)'); light.addColorStop(1, 'rgba(0,2,8,.8)');
      ctx.fillStyle = light; ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();
      const spec = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, 0, cx - R * 0.45, cy - R * 0.5, R * 0.55);
      spec.addColorStop(0, 'rgba(255,255,240,.22)'); spec.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.fillStyle = spec; ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();
      ctx.strokeStyle = 'rgba(243,230,189,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); path({ type: 'Sphere' }); ctx.stroke();
      // labels on the visible hemisphere
      if (labels) {
        const center: [number, number] = [-rot.current[0], -rot.current[1]];
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const boxes: [number, number, number, number][] = [];
        for (const l of data.labels) {
          const d = geoDistance(l.c, center);
          if (d > 1.1) continue;
          const p = proj(l.c); if (!p) continue;
          ctx.font = `700 ${l.size}px Cinzel, Georgia, serif`;
          const wdt = ctx.measureText(l.name.toUpperCase()).width, h = l.size;
          const bx: [number, number, number, number] = [p[0] - wdt / 2 - 4, p[1] - h / 2 - 3, p[0] + wdt / 2 + 4, p[1] + h / 2 + 3];
          if (boxes.some((o) => !(bx[2] < o[0] || bx[0] > o[2] || bx[3] < o[1] || bx[1] > o[3]))) continue;
          boxes.push(bx);
          ctx.globalAlpha = Math.max(0, 1 - d / 1.1);
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(l.name.toUpperCase(), p[0], p[1]);
          ctx.fillStyle = '#f6ecd0'; ctx.fillText(l.name.toUpperCase(), p[0], p[1]);
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data, size, speed, labels]);

  return (
    <canvas ref={ref} style={{ width: size, height: size }} className={`${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
      onPointerDown={(e) => { if (!interactive) return; (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, r: [...rot.current] as [number, number] }; }}
      onPointerMove={(e) => { const d = drag.current; if (!d) return; rot.current = [d.r[0] + (e.clientX - d.x) * 0.3, Math.max(-60, Math.min(60, d.r[1] - (e.clientY - d.y) * 0.3))]; }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      aria-label={tr('Rotating historical globe')} role="img" />
  );
}
