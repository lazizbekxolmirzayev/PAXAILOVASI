import { memo, useEffect, useRef } from 'react';

export type ParticleKind = 'snow' | 'dust' | 'embers' | 'ash';
interface P { x: number; y: number; z: number; ph: number }
const R = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const COUNT: Record<ParticleKind, number> = { snow: 150, dust: 70, embers: 55, ash: 60 };

/** Ambient particles (snow, dust motes, embers, ash) on one cheap canvas. Static frame when `running` is false. */
export const Particles = memo(function Particles({ kind, running, density = 1 }: { kind: ParticleKind; running: boolean; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ ps: P[]; w: number; h: number; dpr: number; time: number; render: () => void; step: (dt: number) => void } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const n = Math.round(COUNT[kind] * density);
    const ps: P[] = Array.from({ length: n }, (_, i) => ({ x: R(i * 3.1), y: R(i * 7.7), z: 0.3 + R(i * 5.3) * 0.7, ph: R(i * 9.1) * 6.283 }));
    const s = { ps, w: 1, h: 1, dpr, time: 0, render: () => {}, step: (_dt: number) => {} };
    s.render = () => {
      ctx.clearRect(0, 0, s.w, s.h);
      ctx.globalCompositeOperation = kind === 'embers' ? 'lighter' : 'source-over';
      for (const p of s.ps) {
        const x = p.x * s.w, y = p.y * s.h;
        if (kind === 'snow') { ctx.fillStyle = `rgba(232,242,255,${0.28 + p.z * 0.55})`; ctx.beginPath(); ctx.arc(x, y, (0.8 + p.z * 2.1) * dpr, 0, 6.283); ctx.fill(); }
        else if (kind === 'dust') { ctx.fillStyle = `rgba(255,222,170,${0.12 + p.z * 0.32})`; ctx.beginPath(); ctx.arc(x, y, (0.7 + p.z * 1.7) * dpr, 0, 6.283); ctx.fill(); }
        else if (kind === 'embers') { const a = 0.35 + 0.55 * Math.abs(Math.sin(s.time * 2.2 + p.ph)); ctx.fillStyle = `rgba(255,${150 + Math.round(p.z * 70)},70,${a * p.z})`; ctx.beginPath(); ctx.arc(x, y, (0.8 + p.z * 1.6) * dpr, 0, 6.283); ctx.fill(); }
        else { ctx.fillStyle = `rgba(214,204,196,${0.14 + p.z * 0.3})`; ctx.fillRect(x, y, (1 + p.z * 1.8) * dpr, (1 + p.z * 1.2) * dpr); }
      }
    };
    s.step = (dt) => {
      s.time += dt;
      for (const p of s.ps) {
        const t = s.time * 1.2 + p.ph;
        if (kind === 'snow') { p.y += (0.06 + p.z * 0.1) * dt; p.x += (-0.035 - p.z * 0.045 + Math.sin(t) * 0.012) * dt; }
        else if (kind === 'dust') { p.x += (0.012 + p.z * 0.03) * dt; p.y += Math.sin(t) * 0.004 * dt - 0.004 * dt; }
        else if (kind === 'embers') { p.y -= (0.04 + p.z * 0.07) * dt; p.x += Math.sin(t) * 0.02 * dt; }
        else { p.y += (0.018 + p.z * 0.03) * dt; p.x += (0.015 + p.z * 0.02 + Math.sin(t) * 0.006) * dt; }
        if (p.x < -0.02) p.x += 1.04; if (p.x > 1.02) p.x -= 1.04;
        if (p.y < -0.02) p.y += 1.04; if (p.y > 1.02) p.y -= 1.04;
      }
    };
    state.current = s;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      s.w = canvas.width = Math.max(1, Math.round(r.width * dpr));
      s.h = canvas.height = Math.max(1, Math.round(r.height * dpr));
      s.render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    return () => { ro.disconnect(); state.current = null; };
  }, [kind, density]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const s = state.current;
      if (s) { s.step(Math.min(0.05, (now - last) / 1000)); s.render(); }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, kind, density]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
});
