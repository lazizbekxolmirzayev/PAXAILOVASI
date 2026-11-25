// Small illustrated parts for the cinematic scenes: horsemen, camels, tents, torches, banners, clouds, ridges.
// Everything is original vector artwork; animation is plain CSS (keyframes live in index.css).
import { memo, useId, type CSSProperties, type ReactNode } from 'react';

type Vars = CSSProperties & Record<`--${string}`, string | number>;
/** Lets inline styles carry CSS custom properties. */
export const css = (v: Vars): CSSProperties => v;
export const useUid = (): string => useId().replace(/[^a-zA-Z0-9]/g, '');
/** Deterministic pseudo-random in [0,1) so scenes never change between renders. */
export const R = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const HARM = [[1, 1], [2, 0.55], [4, 0.3], [9, 0.12]] as const;
function ridgePts(y: number, amp: number, seed: number, peaky: boolean, width: number): [number, number][] {
  const ph = [seed * 1.7, seed * 2.3 + 1, seed * 3.1 + 2, seed * 4.9 + 3];
  const pts: [number, number][] = [];
  for (let x = 0; x <= width; x += 8) {
    let v = 0;
    HARM.forEach(([k, a], i) => { v += a * Math.sin((2 * Math.PI * k * x) / 800 + ph[i]!); });
    const n = peaky ? 1 - Math.abs(v) / 1.97 : (v + 1.97) / 3.94;
    pts.push([x, y - n * amp]);
  }
  return pts;
}
/** Closed hill silhouette. Period is exactly 800 so two copies tile seamlessly (see Scroll). */
export function ridge(y: number, amp: number, seed: number, o: { peaky?: boolean; width?: number; bottom?: number } = {}): string {
  const { peaky = false, width = 800, bottom = 450 } = o;
  const pts = ridgePts(y, amp, seed, peaky, width);
  return `M0 ${bottom} ${pts.map(([x, py]) => `L${x} ${py.toFixed(1)}`).join(' ')} L${width} ${bottom} Z`;
}
/** Just the crest line (for rim lights). */
export function ridgeLine(y: number, amp: number, seed: number, o: { peaky?: boolean; width?: number } = {}): string {
  const pts = ridgePts(y, amp, seed, !!o.peaky, o.width ?? 800);
  return pts.map(([x, py], i) => `${i ? 'L' : 'M'}${x} ${py.toFixed(1)}`).join(' ');
}

/** Endlessly scrolling layer (children are drawn twice, 800 apart): a camera tracking sideways. */
export function Scroll({ dur, children }: { dur: number; children: ReactNode }) {
  return (
    <g style={css({ animation: `st-move ${dur}s linear infinite`, '--x0': '0px', '--x1': '-800px' })}>
      <g>{children}</g>
      <g transform="translate(800 0)">{children}</g>
    </g>
  );
}

/** Soft cloud / smoke bank drifting across; `fillId` is a radialGradient id from the scene's defs. */
export function Cloud({ fillId, y, w = 180, h = 28, dur = 120, delay = 0, o = 1 }: { fillId: string; y: number; w?: number; h?: number; dur?: number; delay?: number; o?: number }) {
  const f = `url(#${fillId})`;
  return (
    <g opacity={o} transform={`translate(0 ${y})`}>
      <g style={css({ animation: `st-move ${dur}s linear ${-delay}s infinite`, '--x0': `${-w - 40}px`, '--x1': '860px' })}>
        <ellipse cx={0} cy={0} rx={w * 0.5} ry={h * 0.5} fill={f} />
        <ellipse cx={w * 0.28} cy={-h * 0.22} rx={w * 0.32} ry={h * 0.42} fill={f} />
        <ellipse cx={-w * 0.26} cy={h * 0.1} rx={w * 0.3} ry={h * 0.38} fill={f} />
      </g>
    </g>
  );
}

/** A waving cloth. Pivot is the pole, at the local origin. */
export function Flag({ x, y, w = 18, h = 9, fill, rings, speed = 0.8, delay = 0 }: { x: number; y: number; w?: number; h?: number; fill: string; rings?: boolean; speed?: number; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={{ animation: `st-flap ${speed}s ease-in-out ${-delay}s infinite alternate` }}>
        <path d={`M0 0 C${w * 0.35} -2 ${w * 0.6} 2 ${w} 0 L${w} ${h} C${w * 0.6} ${h + 2} ${w * 0.35} ${h - 2} 0 ${h} Z`} fill={fill} />
        {rings && [[w * 0.36, h * 0.5], [w * 0.64, h * 0.3], [w * 0.64, h * 0.7]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={h * 0.15} fill="none" stroke="#f5d78c" strokeWidth={0.8} />)}
      </g>
    </g>
  );
}

function Leg({ x, y, a, dur, delay, fill, len = 17.5 }: { x: number; y: number; a: number; dur: number; delay: number; fill: string; len?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={css({ animation: `st-leg ${dur}s ease-in-out ${-(delay + (a < 0 ? dur / 2 : 0))}s infinite`, '--a': `${Math.abs(a)}deg` })}>
        <path d={`M0 0 L2.6 ${len * 0.5} L0.8 ${len}`} stroke={fill} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </g>
  );
}

export interface HorsemanProps {
  x: number; y: number; s?: number; fill: string;
  banner?: string; rings?: boolean; torch?: boolean; flip?: boolean;
  speed?: number; delay?: number; spear?: boolean;
}
/** A galloping rider, side view, facing right (flip to face left). Origin = hooves. */
export const Horseman = memo(function Horseman({ x, y, s = 1, fill, banner, rings, torch, flip, speed = 0.64, delay = 0, spear = true }: HorsemanProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <g style={css({ animation: `st-bob ${speed}s ease-in-out ${-delay}s infinite`, '--bob': '-2.2px', '--rot': '-1.3deg' })}>
        <Leg x={-12} y={-17} a={30} dur={speed} delay={delay} fill={fill} />
        <Leg x={-8} y={-17} a={-30} dur={speed} delay={delay} fill={fill} />
        <path d="M-17 -27 C-26 -27 -29 -19 -27 -9 C-24 -17 -21 -21 -16 -22 Z" fill={fill} />
        <path d="M-17 -23 C-19 -31 -9 -34 0 -33 C8 -34 14 -32 18 -29 L22 -37 C23 -41 27 -42 30 -41 L34 -39 C35 -37 33 -36 32 -35 L27 -27 C25 -22 21 -19 18 -18 C13 -16 7 -15 0 -15 C-8 -15 -14 -16 -17 -23 Z" fill={fill} />
        <Leg x={13} y={-18} a={30} dur={speed} delay={delay} fill={fill} />
        <Leg x={17} y={-18} a={-30} dur={speed} delay={delay} fill={fill} />
        <path d="M-3.4 -33 L-2.2 -45 C-2 -48 2.2 -48 2.6 -45 L4 -33 Z" fill={fill} />
        <circle cx={0.3} cy={-50} r={3.1} fill={fill} />
        <path d="M-3.4 -51 L0.3 -58.5 L4 -51 Z" fill={fill} />
        {(spear || torch) && <path d="M3 -42 L27 -68" stroke={fill} strokeWidth={1.2} strokeLinecap="round" />}
        {banner && !torch && <Flag x={27} y={-69} w={17} h={9} fill={banner} rings={rings} speed={0.7} delay={delay} />}
        {torch && (
          <g transform="translate(27 -68)">
            <circle r={20} fill="url(#st-torch)" style={{ animation: 'st-pulse .9s ease-in-out infinite' }} />
            <path d="M0 0 C-3 -3 -3.5 -8 0 -14 C3.5 -8 3 -3 0 0 Z" fill="#ffb347" style={{ animation: 'st-flicker .5s ease-in-out infinite' }} />
          </g>
        )}
      </g>
    </g>
  );
});

/** Two-humped pack camel, side view facing right. Origin = hooves. */
export const Camel = memo(function Camel({ x, y, s = 1, fill, delay = 0 }: { x: number; y: number; s?: number; fill: string; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g style={css({ animation: `st-bob 1.5s ease-in-out ${-delay}s infinite`, '--bob': '-1.6px', '--rot': '-.5deg' })}>
        <Leg x={-14} y={-24} a={14} dur={1.5} delay={delay} fill={fill} len={24} />
        <Leg x={-9} y={-24} a={-14} dur={1.5} delay={delay} fill={fill} len={24} />
        <Leg x={14} y={-24} a={14} dur={1.5} delay={delay} fill={fill} len={24} />
        <Leg x={19} y={-24} a={-14} dur={1.5} delay={delay} fill={fill} len={24} />
        <path d="M-24 -32 C-24 -41 -16 -44 -11 -40 C-9 -49 -2 -50 0 -42 C2 -50 9 -50 11 -41 C16 -41 20 -38 22 -34 L29 -50 C30 -54 34 -56 37 -54 L41 -52 C41 -50 39 -49 38 -49 L31 -34 C28 -27 22 -24 16 -24 L-14 -24 C-21 -24 -24 -27 -24 -32 Z" fill={fill} />
        <rect x={-13} y={-52} width={22} height={8} rx={2.5} fill={fill} />
        <path d="M-24 -33 C-30 -33 -31 -26 -30 -20 C-27 -26 -25 -28 -22 -29 Z" fill={fill} />
      </g>
    </g>
  );
});

/** A standing guard with a spear. Origin = feet. */
export const Guard = memo(function Guard({ x, y, s = 1, fill, delay = 0 }: { x: number; y: number; s?: number; fill: string; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g style={css({ animation: `st-bob 3.6s ease-in-out ${-delay}s infinite`, '--bob': '-.5px', '--rot': '.3deg' })}>
        <path d="M-4.5 0 L-3.6 -20 C-5 -24 -3 -29 0 -29 C3 -29 5 -24 3.6 -20 L4.5 0 L1.6 0 L0.6 -10 L-0.6 -10 L-1.6 0 Z" fill={fill} />
        <circle cx={0} cy={-33} r={3.6} fill={fill} />
        <path d="M-4 -34 Q0 -41 4 -34 Z" fill={fill} />
        <rect x={6} y={-54} width={1.2} height={54} fill={fill} />
        <path d="M6.6 -54 L4.8 -59 L8.4 -59 Z" fill={fill} />
      </g>
    </g>
  );
});

/** Flickering fire (flame + glow). Needs `<radialGradient id="st-fire">` in the scene defs (see FireDefs). */
export function Fire({ x, y, s = 1, glow = 34, delay = 0 }: { x: number; y: number; s?: number; glow?: number; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r={glow} fill="url(#st-fire)" style={{ animation: `st-pulse 1.1s ease-in-out ${-delay}s infinite` }} />
      <path d="M-5 0 C-9 -6 -4 -12 -2 -19 C0 -13 6 -10 5 0 Z" fill="#ff9d3a" style={{ animation: `st-flicker .55s ease-in-out ${-delay}s infinite` }} />
      <path d="M-2.4 0 C-4 -3 -1.5 -7 0 -11 C1.5 -7 3.6 -4 2.4 0 Z" fill="#ffe08a" style={{ animation: `st-flicker .42s ease-in-out ${-delay}s infinite` }} />
    </g>
  );
}
/** Gradients shared by Fire / torches: put once inside a scene's <defs>. */
export function FireDefs() {
  return (
    <>
      <radialGradient id="st-fire"><stop offset="0" stopColor="#ffb85a" stopOpacity=".75" /><stop offset=".4" stopColor="#ff8a3a" stopOpacity=".28" /><stop offset="1" stopColor="#ff8a3a" stopOpacity="0" /></radialGradient>
      <radialGradient id="st-torch"><stop offset="0" stopColor="#ffc46b" stopOpacity=".8" /><stop offset=".45" stopColor="#ff8a3a" stopOpacity=".25" /><stop offset="1" stopColor="#ff8a3a" stopOpacity="0" /></radialGradient>
    </>
  );
}

/** Round felt tent (yurt/pavilion). Origin = middle of the ground line. */
export function Tent({ x, y, s = 1, body, trim, door, flag }: { x: number; y: number; s?: number; body: string; trim: string; door?: string; flag?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-36 0 L-36 -20 C-36 -24 -26 -30 0 -48 C26 -30 36 -24 36 -20 L36 0 Z" fill={body} />
      <path d="M-36 -19 C-20 -22 20 -22 36 -19 L36 -14 C20 -17 -20 -17 -36 -14 Z" fill={trim} opacity={0.85} />
      <path d="M-7 0 L-7 -13 C-7 -19 7 -19 7 -13 L7 0 Z" fill={door ?? '#0b0710'} />
      <rect x={-0.8} y={-60} width={1.6} height={14} fill={trim} />
      {flag && <Flag x={0.8} y={-60} w={12} h={6} fill={flag} speed={0.9} />}
    </g>
  );
}
