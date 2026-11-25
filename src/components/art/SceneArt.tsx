import { memo, type ReactNode } from 'react';

// Hand-composed cinematic SVG illustrations (original artwork, no external images).
// Each scene: painted sky → light → far/mid/near layers with atmospheric perspective → haze → grain → vignette.
export type SceneId = 'steppe' | 'battlefield' | 'rome' | 'horde' | 'postwar' | 'byzantium' | 'vienna' | 'andes';
export const SCENE_FOR: Record<string, SceneId> = {
  'timur-east': 'steppe', waterloo: 'battlefield', 'rome-endures': 'rome', 'mongol-unity': 'horde',
  'different-peace-1945': 'postwar', 'byzantium-rises': 'byzantium', 'vienna-1683': 'vienna', 'inca-resists': 'andes',
};
export const SCENE_FOR_ERA: Record<string, SceneId> = { ancient: 'rome', classical: 'rome', medieval: 'steppe', renaissance: 'vienna', industrial: 'battlefield', modern: 'postwar' };

interface Pal { sky: [string, string, string, string]; sun: string; far: string; mid: string; near: string; haze: string; accent: string }
const PAL: Record<SceneId, Pal> = {
  steppe: { sky: ['#140f1f', '#4a2c3a', '#c0623a', '#f3b26a'], sun: '#ffd89a', far: '#6b4a52', mid: '#3c2a30', near: '#120c10', haze: '#e9a06a', accent: '#b8302a' },
  battlefield: { sky: ['#1a1d26', '#4b4a52', '#a07a5a', '#e2c08c'], sun: '#fff0c8', far: '#5c5a58', mid: '#33342f', near: '#0e0f0c', haze: '#c9b494', accent: '#2b4aa0' },
  rome: { sky: ['#0f1730', '#3b3f6a', '#c7785a', '#f6c98a'], sun: '#fff2cc', far: '#6a5a6e', mid: '#3a2f3a', near: '#120d12', haze: '#f0b88a', accent: '#9e1c22' },
  horde: { sky: ['#0b1a33', '#1f4a7a', '#7fb1d6', '#e8e3c8'], sun: '#ffffff', far: '#5a7690', mid: '#2e3e4a', near: '#0c1116', haze: '#bcd6e6', accent: '#c79a2b' },
  postwar: { sky: ['#0d0f14', '#2a2d36', '#6c5f5a', '#b8957a'], sun: '#ffe2b0', far: '#4a4a4e', mid: '#26272b', near: '#0a0a0c', haze: '#8c7f78', accent: '#c8102e' },
  byzantium: { sky: ['#160c24', '#4d2659', '#c25a62', '#f6b77a'], sun: '#ffe3a6', far: '#6b4a6a', mid: '#3a2340', near: '#120a14', haze: '#e8a08a', accent: '#7d3c86' },
  vienna: { sky: ['#10141c', '#3a3540', '#94604a', '#e0a46a'], sun: '#ffdca0', far: '#5e5054', mid: '#302a2c', near: '#0e0b0c', haze: '#c88a64', accent: '#b41f24' },
  andes: { sky: ['#0a1630', '#24507a', '#e08a4a', '#ffd27a'], sun: '#fff4c8', far: '#7a6a8a', mid: '#3c3446', near: '#100c12', haze: '#f0b07a', accent: '#f0c419' },
};

const ridgePath = (y: number, amp: number, freq: number, seed: number, jag = 0.4) => {
  let d = `M0 ${y}`;
  for (let x = 0; x <= 800; x += 10) {
    const v = Math.sin((x + seed * 31) / (40 * freq)) * amp + Math.sin((x + seed * 7) / (13 * freq)) * amp * jag + Math.sin((x + seed) / (5 * freq)) * amp * 0.12;
    d += ` L${x} ${(y - Math.abs(v)).toFixed(1)}`;
  }
  return `${d} L800 400 L0 400 Z`;
};

function Warrior({ x, y, s = 1, spear = true, banner }: { x: number; y: number; s?: number; spear?: boolean; banner?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-4 0 L-3 -14 Q-4 -20 0 -22 Q4 -20 3 -14 L4 0 L1.5 0 L0.5 -8 L-0.5 -8 L-1.5 0 Z" />
      <circle cx="0" cy="-24.5" r="3" />
      <path d="M-3.4 -26 Q0 -31 3.4 -26 Z" />
      {spear && <rect x="5" y="-40" width="1" height="42" />}
      {banner && <path d={`M6 -40 L20 -37 L6 -33 Z`} fill={banner} />}
    </g>
  );
}
function Rider({ x, y, s = 1, banner }: { x: number; y: number; s?: number; banner?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-16 -10 Q-18 -18 -10 -19 L8 -19 Q14 -24 17 -30 L21 -28 L19 -20 Q16 -15 14 -12 L13 0 L10.5 0 L10 -9 L-8 -9 L-10 0 L-12.5 0 L-12 -8 Q-17 -6 -20 -2 L-21 -4 Q-18 -8 -16 -10 Z" />
      <path d="M-4 -19 L-3 -30 Q-2 -35 1 -35 Q4 -34 3 -29 L4 -19 Z" />
      <circle cx="0.5" cy="-37.5" r="2.6" />
      <rect x="6" y="-58" width="0.9" height="44" transform="rotate(12 6 -14)" />
      {banner && <path d="M11 -57 L24 -54 L11 -50 Z" fill={banner} transform="rotate(12 6 -14)" />}
    </g>
  );
}

const SceneLayers: Record<SceneId, (p: Pal, h: string) => ReactNode> = {
  steppe: (p, h) => (<>
    <path d={ridgePath(250, 70, 2.4, 3, 0.6)} fill={p.far} opacity=".75" />
    <path d={ridgePath(285, 30, 3, 9)} fill={p.mid} />
    <g fill={p.mid} opacity=".9">{[120, 160, 200, 600, 650].map((x, i) => <path key={i} d={`M${x} 285 Q${x + 18} 255 ${x + 36} 285 Z`} />)}</g>
    <rect y="290" width="800" height="40" fill={h} />
    <g fill={p.near}>
      <path d="M0 400 L0 330 Q200 312 400 326 T800 320 L800 400 Z" />
      {Array.from({ length: 16 }, (_, i) => <Rider key={i} x={70 + i * 46 + (i % 3) * 6} y={344 + (i % 2) * 8} s={0.85 + (i % 3) * 0.1} banner={i % 4 === 0 ? p.accent : undefined} />)}
      {Array.from({ length: 40 }, (_, i) => <rect key={`s${i}`} x={20 + i * 19} y={300 - (i % 5) * 3} width=".8" height="36" opacity=".55" />)}
    </g>
    <g opacity=".35" fill="#e9b37a">{Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx={100 + i * 120} cy={352} rx={60} ry={9} filter="url(#soft)" />)}</g>
  </>),
  battlefield: (p, h) => (<>
    <path d={ridgePath(260, 24, 5, 4, 0.2)} fill={p.far} opacity=".8" />
    <g fill={p.far} opacity=".9"><rect x="520" y="226" width="60" height="22" /><path d="M515 228 L550 208 L585 228 Z" /><rect x="586" y="232" width="20" height="16" /></g>
    <g filter="url(#soft)" opacity=".38">{[[180, 230, 90], [320, 250, 120], [460, 220, 80], [640, 245, 110], [260, 200, 70]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.45} fill={i % 2 ? '#d8c8b0' : '#bfae98'} />)}</g>
    <path d={ridgePath(300, 18, 6, 11, 0.2)} fill={p.mid} />
    <rect y="280" width="800" height="50" fill={h} />
    <g fill={p.near}>
      <path d="M0 400 L0 334 Q250 320 520 336 T800 330 L800 400 Z" />
      {Array.from({ length: 22 }, (_, i) => <Warrior key={i} x={40 + i * 26} y={346 + (i % 2) * 4} s={0.95} banner={i === 7 ? '#2b4aa0' : i === 15 ? '#c8102e' : undefined} />)}
      <g transform="translate(650 352)"><circle cx="0" cy="0" r="10" fill="none" stroke={p.near} strokeWidth="3" /><path d="M-4 -8 L40 -20 L42 -14 L0 -2 Z" /><path d="M-20 4 L6 4 L4 10 L-18 10 Z" /></g>
    </g>
    <g filter="url(#soft)" opacity=".3"><ellipse cx="700" cy="330" rx="70" ry="18" fill="#e8dcc8" /></g>
  </>),
  rome: (p, h) => (<>
    <path d={ridgePath(250, 50, 3, 2, 0.5)} fill={p.far} opacity=".7" />
    <g fill={p.mid}>
      <path d="M90 300 L90 230 Q170 205 250 230 L250 300 Z" />
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${100 + i * 25} 300 L${100 + i * 25} 262 Q${111 + i * 25} 248 ${122 + i * 25} 262 L${122 + i * 25} 300 Z`} fill={p.far} opacity=".7" />)}
      {Array.from({ length: 6 }, (_, i) => <path key={`u${i}`} d={`M${103 + i * 25} 250 Q${111 + i * 25} 240 ${119 + i * 25} 250 L${119 + i * 25} 258 L${103 + i * 25} 258 Z`} fill={p.far} opacity=".7" />)}
    </g>
    <rect y="270" width="800" height="50" fill={h} />
    <g fill={p.near}>
      <path d="M380 330 L380 300 L700 300 L700 330 Z" />
      <path d="M370 300 L540 236 L710 300 Z" />
      <rect x="378" y="296" width="324" height="6" />
      {Array.from({ length: 8 }, (_, i) => <rect key={i} x={392 + i * 40} y="302" width="13" height="72" />)}
      <rect x="370" y="372" width="340" height="10" /><rect x="360" y="382" width="360" height="18" />
      {[60, 760, 300].map((x, i) => <path key={i} d={`M${x} 400 L${x} 330 Q${x + 6} 280 ${x + 12} 330 L${x + 12} 400 Z`} />)}
      <path d="M0 400 L0 385 Q300 375 800 388 L800 400 Z" />
      <g transform="translate(210 395)"><rect x="-1.2" y="-110" width="2.4" height="110" /><path d="M-14 -112 Q0 -126 14 -112 Q0 -116 -14 -112 Z" /><rect x="-10" y="-102" width="20" height="16" fill={p.accent} /><circle cx="0" cy="-118" r="3" /></g>
    </g>
  </>),
  horde: (p, h) => (<>
    <g filter="url(#soft)" opacity=".55">{[[150, 90, 120, 26], [520, 70, 160, 30], [680, 140, 110, 20], [320, 160, 140, 18]].map(([x, y, rx, ry], i) => <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="#f4f1e6" />)}</g>
    <path d={ridgePath(270, 60, 2, 5, 0.7)} fill={p.far} opacity=".8" />
    <path d={ridgePath(300, 20, 4, 8)} fill={p.mid} />
    <rect y="285" width="800" height="45" fill={h} />
    <g fill={p.near}>
      <path d="M0 400 L0 335 Q400 318 800 335 L800 400 Z" />
      {[90, 160, 230].map((x, i) => <g key={i}><path d={`M${x} 336 L${x} 316 Q${x + 26} 296 ${x + 52} 316 L${x + 52} 336 Z`} /><rect x={x + 24} y="290" width="3" height="10" /></g>)}
      {Array.from({ length: 9 }, (_, i) => <Rider key={i} x={360 + i * 48} y={352 + (i % 2) * 6} s={1.05} banner={i === 2 || i === 6 ? p.accent : undefined} />)}
      <g transform="translate(330 120) scale(1.4)"><path d="M0 0 Q-20 -8 -36 2 Q-20 -2 -6 4 Q0 6 6 4 Q20 -2 36 2 Q20 -8 0 0 Z" opacity=".7" /></g>
    </g>
  </>),
  postwar: (p, h) => (<>
    <g opacity=".35">{[150, 420, 640].map((x, i) => <path key={i} d={`M${x} 330 L${x - 120 + i * 40} 0 L${x - 100 + i * 40} 0 Z`} fill="#fff6d8" />)}</g>
    <g fill={p.far} opacity=".85">{Array.from({ length: 30 }, (_, i) => { const w = 18 + (i * 37) % 26, h = 40 + (i * 53) % 90; const x = i * 27; return <rect key={i} x={x} y={300 - h} width={w} height={h} />; })}</g>
    <g filter="url(#soft)" opacity=".35">{[[200, 200, 60], [520, 180, 80], [680, 230, 50]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 1.4} fill="#5a524e" />)}</g>
    <rect y="260" width="800" height="70" fill={h} />
    <g fill={p.near}>
      {Array.from({ length: 18 }, (_, i) => { const w = 30 + (i * 31) % 30, h = 50 + (i * 71) % 110; const x = i * 46; const broken = i % 3 === 1; return <path key={i} d={broken ? `M${x} 400 L${x} ${400 - h} L${x + w * 0.4} ${400 - h + 14} L${x + w * 0.7} ${400 - h - 6} L${x + w} ${400 - h + 20} L${x + w} 400 Z` : `M${x} 400 L${x} ${400 - h} L${x + w} ${400 - h} L${x + w} 400 Z`} />; })}
      <g transform="translate(560 190)"><rect x="0" y="0" width="4" height="120" /><path d="M0 0 L120 0 L120 4 L0 4 Z" /><path d="M2 4 L60 4 L2 40 Z" opacity=".6" /><rect x="110" y="4" width="1" height="40" /></g>
      {[[160, 70], [210, 60], [260, 78]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l14 -2 l3 -5 l2 5 l14 2 l-14 1 l-2 5 l-3 -5 z`} />)}
    </g>
  </>),
  byzantium: (p, h) => (<>
    <rect y="270" width="800" height="130" fill="#2a1830" />
    <g opacity=".5">{Array.from({ length: 18 }, (_, i) => <rect key={i} x={360 + (i % 6) * 18 - i * 3} y={285 + i * 6} width={60 - i * 2} height="1.5" fill="#ffd89a" />)}</g>
    <path d={ridgePath(270, 30, 3, 6, 0.3)} fill={p.far} opacity=".7" />
    <g fill={p.mid}>
      <path d="M220 270 L220 200 L580 200 L580 270 Z" />
      <path d="M300 200 Q400 70 500 200 Z" />
      <path d="M240 210 Q290 150 340 210 Z" /><path d="M460 210 Q510 150 560 210 Z" />
      {[200, 600].map((x, i) => <g key={i}><rect x={x - 5} y="110" width="10" height="160" /><path d={`M${x - 7} 112 L${x} 80 L${x + 7} 112 Z`} /></g>)}
      {Array.from({ length: 16 }, (_, i) => <rect key={`w${i}`} x={318 + i * 10.5} y="182" width="5" height="9" fill={p.haze} opacity=".55" />)}
    </g>
    <rect y="250" width="800" height="40" fill={h} />
    <g fill={p.near}>
      <path d="M0 400 L0 330 L800 330 L800 400 Z" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 70} 330 L${i * 70} 300 L${i * 70 + 20} 300 L${i * 70 + 20} 292 L${i * 70 + 26} 292 L${i * 70 + 26} 300 L${i * 70 + 32} 300 L${i * 70 + 32} 292 L${i * 70 + 38} 292 L${i * 70 + 38} 330 Z`} />)}
      <g transform="translate(560 318)"><path d="M-60 0 Q0 18 60 0 L50 10 L-50 10 Z" /><rect x="-1" y="-60" width="2" height="60" /><path d="M2 -58 Q30 -40 2 -12 Z" opacity=".8" /></g>
    </g>
  </>),
  vienna: (p, h) => (<>
    <path d={ridgePath(250, 40, 3, 4, 0.5)} fill={p.far} opacity=".7" />
    <g fill={p.mid}>
      <path d="M140 290 L140 220 L560 220 L560 290 Z" />
      <path d="M330 220 L330 120 L345 120 L352 40 L359 120 L374 120 L374 220 Z" />
      {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${150 + i * 30} 220 L${150 + i * 30} ${200 - (i % 3) * 10} L${165 + i * 30} ${190 - (i % 3) * 10} L${180 + i * 30} ${200 - (i % 3) * 10} L${180 + i * 30} 220 Z`} />)}
      <path d="M100 300 L130 260 L570 260 L600 300 Z" />
    </g>
    <g filter="url(#soft)" opacity=".35">{[[200, 250, 70], [480, 240, 90], [340, 270, 60]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.5} fill="#cdb39a" />)}</g>
    <rect y="270" width="800" height="60" fill={h} />
    <g fill={p.near}>
      <path d="M0 400 L0 340 Q400 325 800 342 L800 400 Z" />
      {[60, 150, 650, 730].map((x, i) => <g key={i}><path d={`M${x - 34} 346 L${x} 306 L${x + 34} 346 Z`} /><rect x={x - 1} y="286" width="2" height="22" /><path d={`M${x + 1} 287 L${x + 14} 290 L${x + 1} 294 Z`} fill={p.accent} /></g>)}
      {Array.from({ length: 10 }, (_, i) => <Warrior key={i} x={230 + i * 38} y={356} s={1} banner={i === 4 ? p.accent : undefined} />)}
      <g transform="translate(560 356)"><circle cx="0" cy="0" r="9" fill="none" stroke={p.near} strokeWidth="3" /><path d="M-4 -7 L36 -22 L38 -16 L0 -2 Z" /></g>
    </g>
  </>),
  andes: (p, h) => (<>
    <path d="M0 260 L120 120 L170 170 L260 60 L360 190 L430 110 L520 210 L620 90 L720 200 L800 150 L800 400 L0 400 Z" fill={p.far} opacity=".85" />
    <g fill="#f4efe6" opacity=".85"><path d="M260 60 L240 86 L252 84 L262 96 L272 84 L282 88 Z" /><path d="M620 90 L602 112 L614 110 L622 120 L632 110 L642 114 Z" /><path d="M120 120 L104 140 L118 138 L126 146 L134 138 Z" /></g>
    <path d={ridgePath(290, 60, 2, 12, 0.6)} fill={p.mid} />
    <rect y="260" width="800" height="70" fill={h} />
    <g fill={p.near}>
      {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${0} ${330 + i * 10} L${240 - i * 24} ${330 + i * 10} L${250 - i * 24} ${338 + i * 10} L0 ${338 + i * 10} Z`} />)}
      <path d="M440 330 L440 300 L470 300 L470 285 L520 285 L520 300 L550 300 L550 330 Z" />
      <path d="M0 400 L0 360 Q400 340 800 362 L800 400 Z" />
      {[[640, 352], [690, 356], [600, 358]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l2 -14 l-2 -6 l3 -1 l2 6 l12 0 l2 14 l-2 0 l-1 -8 l-9 0 l-2 8 z`} />)}
    </g>
    <circle cx="560" cy="110" r="22" fill="none" stroke={p.accent} strokeWidth="2" opacity=".7" />
  </>),
};

export const SceneArt = memo(function SceneArt({ scene, className = '', year }: { scene: SceneId; className?: string; year?: string }) {
  const p = PAL[scene];
  const sunX = { steppe: 540, battlefield: 600, rome: 540, horde: 640, postwar: 420, byzantium: 400, vienna: 560, andes: 560 }[scene];
  const sunY = { steppe: 250, battlefield: 200, rome: 240, horde: 90, postwar: 230, byzantium: 250, vienna: 230, andes: 110 }[scene];
  return (
    <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`sk-${scene}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} /><stop offset=".38" stopColor={p.sky[1]} /><stop offset=".72" stopColor={p.sky[2]} /><stop offset="1" stopColor={p.sky[3]} />
        </linearGradient>
        <radialGradient id={`sn-${scene}`}><stop offset="0" stopColor="#fffdf4" /><stop offset=".12" stopColor={p.sun} /><stop offset=".45" stopColor={p.sun} stopOpacity=".35" /><stop offset="1" stopColor={p.sun} stopOpacity="0" /></radialGradient>
        <linearGradient id={`haze-${scene}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.haze} stopOpacity="0" /><stop offset=".6" stopColor={p.haze} stopOpacity=".28" /><stop offset="1" stopColor={p.haze} stopOpacity="0" /></linearGradient>
        <filter id="soft" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id={`grain-${scene}`}><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" /><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .4  0 0 0 .22 0" /></filter>
        <radialGradient id={`vg-${scene}`} cx=".5" cy=".55" r=".75"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".75" /></radialGradient>
      </defs>
      <rect width="800" height="400" fill={`url(#sk-${scene})`} />
      {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 197) % 800} cy={(i * 61) % 130} r={i % 6 === 0 ? 1.1 : 0.5} fill="#fff" opacity={0.25 + (i % 4) * 0.12} />)}
      <g opacity=".25">{Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${sunX} ${sunY} L${sunX - 520 + i * 104} -10 L${sunX - 490 + i * 104} -10 Z`} fill={p.sun} />)}</g>
      <circle cx={sunX} cy={sunY} r="170" fill={`url(#sn-${scene})`} />
      <g filter="url(#soft)" opacity=".5">{[0, 1, 2].map((i) => <ellipse key={i} cx={120 + i * 260} cy={70 + i * 25} rx={150} ry={14} fill={p.sky[2]} />)}</g>
      {SceneLayers[scene](p, `url(#haze-${scene})`)}
      <rect width="800" height="400" filter={`url(#grain-${scene})`} opacity=".55" />
      <rect width="800" height="400" fill={`url(#vg-${scene})`} />
      {year && <text x="28" y="385" fontFamily="Cinzel, serif" fontWeight="800" fontSize="64" fill="#fbf6e6" opacity=".1" letterSpacing="6">{year}</text>}
    </svg>
  );
});

import { ScenarioArt } from './ScenarioArt';
/** Picks the illustrated scene for a scenario/era, falling back to procedural art for custom content. */
export function Banner({ scenarioId, era, hue = 30, year = '', seed = 1, className = '' }: { scenarioId?: string; era?: string; hue?: number; year?: string; seed?: number; className?: string }) {
  const scene = (scenarioId && SCENE_FOR[scenarioId]) || (era && SCENE_FOR_ERA[era]);
  return scene ? <SceneArt scene={scene} year={year} className={className} /> : <ScenarioArt hue={hue} year={year} seed={seed} className={className} />;
}
