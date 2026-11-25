// Animated illustrated scenes for the story cinematic. Each is a full-bleed 16:9 SVG (+ an optional particle canvas).
// The camera move is applied by the player around the scene, so scenes only animate what lives inside the picture.
import { memo, type ComponentType, type ReactNode } from 'react';
import { Banner, SCENE_FOR, SCENE_FOR_ERA, type SceneId } from '../components/art/SceneArt';
import type { ScenarioDefinition } from '../types/game';
import { Camel, Cloud, Fire, FireDefs, Flag, Guard, Horseman, R, Scroll, Tent, css, ridge, ridgeLine, useUid } from './art';
import { Particles, type ParticleKind } from './particles';
import type { VisualKey } from './script';

const SVG_PROPS = { viewBox: '0 0 800 450', preserveAspectRatio: 'xMidYMid slice', className: 'absolute inset-0 h-full w-full', 'aria-hidden': true } as const;
const Frame = ({ children }: { children: ReactNode }) => <div className="absolute inset-0">{children}</div>;
const Stars = ({ n = 36, h = 170, twinkle = 8 }: { n?: number; h?: number; twinkle?: number }) => (
  <g fill="#fff">
    {Array.from({ length: n }, (_, i) => (
      <circle key={i} cx={(i * 197 + 31) % 800} cy={(i * 61 + 11) % h} r={i % 6 === 0 ? 1.3 : 0.7} opacity={0.35 + (i % 4) * 0.15}
        style={i < twinkle ? { animation: `st-twinkle ${2.4 + (i % 5) * 0.7}s ease-in-out ${-i * 0.6}s infinite` } : undefined} />
    ))}
  </g>
);
const Birds = ({ ys, color = '#24161f', dur = 30 }: { ys: number[]; color?: string; dur?: number }) => (
  <g>
    {ys.map((y, i) => (
      <g key={i} transform={`translate(0 ${y})`}>
        <g style={css({ animation: `st-move ${dur + i * 3}s linear ${-i * 9}s infinite`, '--x0': '-30px', '--x1': '850px', '--y1': `${-18 - i * 5}px` })}>
          <g style={{ animation: `st-wing ${0.5 + i * 0.07}s ease-in-out infinite` }}>
            <path d="M-6 0 Q-3 -3.5 0 0 Q3 -3.5 6 0" stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" />
          </g>
        </g>
      </g>
    ))}
  </g>
);
const Smoke = ({ x, y, fillId, n = 4, dur = 9 }: { x: number; y: number; fillId: string; n?: number; dur?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    {Array.from({ length: n }, (_, i) => (
      <ellipse key={i} rx={20} ry={14} fill={`url(#${fillId})`} style={css({ animation: `st-rise ${dur}s ease-out ${-(i * dur) / n}s infinite`, '--dx': `${14 + i * 3}px` })} />
    ))}
  </g>
);

// ---------------------------------------------------------------------------------------------
/** Generic: the scenario's painted scene + drifting haze + ambient particles. */
export const ArtScene = memo(function ArtScene({ def, running }: { def: ScenarioDefinition; running: boolean }) {
  const u = useUid();
  const scene: SceneId | undefined = SCENE_FOR[def.id] ?? SCENE_FOR_ERA[def.era];
  const kind: ParticleKind = scene === 'battlefield' || scene === 'postwar' || scene === 'vienna' ? 'ash' : scene === 'byzantium' ? 'embers' : 'dust';
  return (
    <Frame>
      <Banner scenarioId={def.id} era={def.era} hue={def.artHue} seed={def.id.length} className="absolute inset-0 h-full w-full" />
      <svg {...SVG_PROPS}>
        <defs>
          <radialGradient id={`${u}-cl`}><stop offset="0" stopColor="#ffe9cc" stopOpacity=".34" /><stop offset="1" stopColor="#ffe9cc" stopOpacity="0" /></radialGradient>
        </defs>
        <Cloud fillId={`${u}-cl`} y={250} w={320} h={46} dur={150} delay={20} />
        <Cloud fillId={`${u}-cl`} y={330} w={260} h={36} dur={110} delay={70} o={0.8} />
        <Cloud fillId={`${u}-cl`} y={170} w={220} h={30} dur={190} delay={100} o={0.6} />
      </svg>
      <Particles kind={kind} running={running} />
    </Frame>
  );
});

/** Stylised route Anatolia → India drawn over the first shot (a sketch, not a map). */
export const RouteOverlay = memo(function RouteOverlay({ from, to }: { from: string; to: string }) {
  const d = 'M150 262 C240 196 330 276 420 226 S600 170 668 198';
  const label = { fontFamily: 'Cinzel, serif', fontSize: 15, letterSpacing: 3, fill: '#f3e6bd', stroke: '#1b1208', strokeWidth: 3.5, paintOrder: 'stroke' } as const;
  return (
    <svg {...SVG_PROPS}>
      <path d={d} pathLength={1} fill="none" stroke="#ffd989" strokeOpacity={0.22} strokeWidth={9} strokeLinecap="round" style={css({ strokeDasharray: 1, strokeDashoffset: 1, animation: 'st-draw 7s ease-in-out .9s forwards' })} />
      <path d={d} pathLength={1} fill="none" stroke="#ffe7ab" strokeWidth={2.4} strokeLinecap="round" style={css({ strokeDasharray: 1, strokeDashoffset: 1, animation: 'st-draw 7s ease-in-out .9s forwards' })} />
      <g style={{ animation: 'st-fade-in 1s ease-out .4s both' }}>
        <circle cx={150} cy={262} r={13} fill="#ffd989" opacity={0.25} /><circle cx={150} cy={262} r={5.5} fill="#fff1c8" stroke="#6b4a14" strokeWidth={1.5} />
        <text x={150} y={290} textAnchor="middle" {...label}>{from}</text>
      </g>
      <g style={{ animation: 'st-fade-in 1s ease-out 7s both' }}>
        <circle cx={668} cy={198} r={13} fill="#ffd989" opacity={0.25} /><circle cx={668} cy={198} r={5.5} fill="#fff1c8" stroke="#6b4a14" strokeWidth={1.5} />
        <text x={668} y={226} textAnchor="middle" {...label}>{to}</text>
      </g>
    </svg>
  );
});

// ---------------------------------------------------------------------------------------------
export const BattleScene = memo(function BattleScene({ running }: { running: boolean }) {
  const u = useUid();
  const dark = '#150a10';
  const darker = '#1d1018';
  const arrows = Array.from({ length: 9 }, (_, i) => ({ x: 190 + R(i * 2.3) * 120, y: 330 + R(i * 5.1) * 26, d: R(i * 7.7) * 3.4, a: 120 + R(i * 3.3) * 60 }));
  return (
    <Frame>
      <svg {...SVG_PROPS}>
        <defs>
          <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#190f1f" /><stop offset=".38" stopColor="#5a2a38" /><stop offset=".72" stopColor="#c8663c" /><stop offset="1" stopColor="#f6b86a" /></linearGradient>
          <radialGradient id={`${u}-sun`}><stop offset="0" stopColor="#fff3cf" /><stop offset=".14" stopColor="#ffd08a" /><stop offset=".5" stopColor="#ff9a58" stopOpacity=".32" /><stop offset="1" stopColor="#ff9a58" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-cl`}><stop offset="0" stopColor="#f6c9a2" stopOpacity=".55" /><stop offset="1" stopColor="#f6c9a2" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-sm`}><stop offset="0" stopColor="#3a2430" stopOpacity=".7" /><stop offset="1" stopColor="#3a2430" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-dust`}><stop offset="0" stopColor="#e8b27c" stopOpacity=".9" /><stop offset=".6" stopColor="#c98a5a" stopOpacity=".5" /><stop offset="1" stopColor="#c98a5a" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-flash`}><stop offset="0" stopColor="#fff6dc" stopOpacity=".95" /><stop offset="1" stopColor="#ffd08a" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${u}-haze`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2a56a" stopOpacity="0" /><stop offset=".6" stopColor="#f2a56a" stopOpacity=".32" /><stop offset="1" stopColor="#f2a56a" stopOpacity="0" /></linearGradient>
          <linearGradient id={`${u}-gr`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a1f2a" /><stop offset="1" stopColor="#0f070c" /></linearGradient>
        </defs>
        <rect width="800" height="450" fill={`url(#${u}-sky)`} />
        <circle cx="560" cy="292" r="220" fill={`url(#${u}-sun)`} />
        <Cloud fillId={`${u}-cl`} y={90} w={300} h={40} dur={170} delay={30} />
        <Cloud fillId={`${u}-cl`} y={160} w={240} h={32} dur={130} delay={90} o={0.8} />
        <Cloud fillId={`${u}-sm`} y={215} w={360} h={54} dur={200} delay={10} o={0.9} />
        <path d={ridge(322, 44, 3)} fill="#6a3d4e" opacity=".85" />
        {/* the armies in the distance */}
        <g opacity=".72" stroke="#2a1824">
          <rect x="30" y="318" width="230" height="9" fill="#2a1824" stroke="none" /><rect x="540" y="318" width="240" height="9" fill="#2a1824" stroke="none" />
          {Array.from({ length: 56 }, (_, i) => { const x = i < 28 ? 34 + i * 8.2 : 544 + (i - 28) * 8.4; const h = 14 + R(i * 3.7) * 12; return <line key={i} x1={x} y1={320} x2={x + (i < 28 ? 1.5 : -1.5)} y2={320 - h} strokeWidth={1} />; })}
        </g>
        <rect y="296" width="800" height="62" fill={`url(#${u}-haze)`} />
        <Smoke x={118} y={324} fillId={`${u}-sm`} /><Smoke x={690} y={326} fillId={`${u}-sm`} dur={11} />
        <path d={ridge(350, 14, 8)} fill="#341c28" />
        <rect y="346" width="800" height="104" fill={`url(#${u}-gr)`} />
        {/* arrows in flight */}
        <g stroke={dark} strokeWidth={1.2} strokeLinecap="round">
          {arrows.map((a, i) => (
            <g key={i} transform={`translate(${a.x} ${a.y})`}>
              <g style={css({ animation: `st-arrow 3.4s linear ${-a.d}s infinite`, '--ax': `${a.a}px` })}><path d="M0 0 L12 0 M12 0 L9 -2 M12 0 L9 2" fill="none" /></g>
            </g>
          ))}
        </g>
        {/* Timurid charge (left → right) */}
        <g style={css({ animation: 'st-move 11s cubic-bezier(.35,0,.5,1) .8s both', '--x0': '-250px', '--x1': '150px' })}>
          {[[280, 376, 1.1, true], [226, 366, 1, false], [176, 380, 1.18, true], [128, 370, 1.05, false], [84, 384, 1.22, false], [30, 372, 1.1, true], [250, 392, 1.32, false]].map(([x, y, s, b], i) => (
            <Horseman key={i} x={x as number} y={y as number} s={s as number} fill={dark} banner={b ? '#b8302a' : undefined} rings={!!b} delay={i * 0.17} speed={0.62 + (i % 3) * 0.04} />
          ))}
        </g>
        {/* the opposing line (right → left), horsetail standard falls at the end */}
        <g style={css({ animation: 'st-move 11s cubic-bezier(.35,0,.5,1) .8s both', '--x0': '250px', '--x1': '-150px' })}>
          {[[520, 374, 1.12, '#2f7a52'], [572, 364, 1, ''], [624, 380, 1.18, '#2f7a52'], [676, 370, 1.05, ''], [722, 386, 1.22, ''], [770, 372, 1.1, '#2f7a52'], [548, 392, 1.3, '']].map(([x, y, s, b], i) => (
            <Horseman key={i} x={x as number} y={y as number} s={s as number} fill={darker} flip banner={(b as string) || undefined} delay={i * 0.21} speed={0.66 + (i % 3) * 0.04} />
          ))}
          <g transform="translate(600 352)">
            <g style={{ animation: 'st-fall 3.2s cubic-bezier(.5,0,.9,.6) 11.4s both' }}>
              <rect x={-1.1} y={-112} width={2.2} height={112} fill={darker} />
              <circle cy={-114} r={4.5} fill="#8a6a2a" />
              <g style={{ animation: 'st-flap 1.1s ease-in-out infinite alternate' }}>
                {[-5, -2.5, 0, 2.5, 5].map((dx, i) => <path key={i} d={`M${dx} -110 C${dx - 4} -96 ${dx + 5} -88 ${dx + 1} -72`} stroke="#7a1f1f" strokeWidth={1.6} fill="none" strokeLinecap="round" />)}
              </g>
            </g>
          </g>
        </g>
        {/* the clash */}
        <g transform="translate(402 372)">
          <ellipse rx={150} ry={36} fill={`url(#${u}-dust)`} style={{ animation: 'st-burst 5s ease-out 9.6s both' }} />
          <circle r={46} fill={`url(#${u}-flash)`} style={{ animation: 'st-flashpop 1.6s ease-out 10.4s both' }} />
        </g>
        {/* foreground: the Timurid banner and spears */}
        <g fill="#0d060a">
          <path d="M0 450 L0 424 Q200 410 420 420 T800 416 L800 450 Z" />
          <rect x={58} y={176} width={3} height={280} />
          <rect x={742} y={240} width={2} height={220} transform="rotate(5 742 450)" /><rect x={770} y={262} width={2} height={200} transform="rotate(9 770 450)" />
        </g>
        <Flag x={61} y={176} w={78} h={38} fill="#7a1c1a" rings speed={1.2} />
      </svg>
      <Particles kind="dust" running={running} density={0.9} />
    </Frame>
  );
});

// ---------------------------------------------------------------------------------------------
export const SamarkandScene = memo(function SamarkandScene({ running }: { running: boolean }) {
  const u = useUid();
  const ribs = [-50, -38, -26, -13, 0, 13, 26, 38, 50];
  const Minaret = ({ x, h }: { x: number; h: number }) => (
    <g transform={`translate(${x} 0)`}>
      <path d={`M-9 0 L-7 ${-h} L7 ${-h} L9 0 Z`} fill={`url(#${u}-brick)`} />
      {[0.34, 0.62, 0.86].map((k, i) => <rect key={i} x={-8 + k * 1.2} y={-h * k - 4} width={16 - k * 2.4} height={7} fill="#2fb3be" opacity=".9" />)}
      <rect x={-10.5} y={-h - 4} width={21} height={5} fill="#2a8aa0" />
      <path d={`M-8 ${-h - 4} Q0 ${-h - 28} 8 ${-h - 4} Z`} fill={`url(#${u}-dome)`} />
      <rect x={-0.7} y={-h - 40} width={1.4} height={14} fill="#d9b65c" />
      <path d={`M-7 0 L-6 ${-h} L-3 ${-h} L-4 0 Z`} fill="#ffe2b0" opacity=".16" />
    </g>
  );
  const lit = [[-26, -52], [-8, -52], [10, -52], [26, -52], [-17, -30], [17, -30]];
  const cavalry = [[60, 396, 1.15, '#b8302a', true], [120, 388, 1.05, '', false], [178, 400, 1.2, '', false], [236, 390, 1.08, '#b8302a', true], [296, 398, 1.18, '', false], [350, 388, 1.05, '', false]] as const;
  return (
    <Frame>
      <svg {...SVG_PROPS}>
        <defs>
          <FireDefs />
          <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0e1a35" /><stop offset=".4" stopColor="#2f4b7a" /><stop offset=".74" stopColor="#d68a62" /><stop offset="1" stopColor="#f9d08f" /></linearGradient>
          <radialGradient id={`${u}-sun`}><stop offset="0" stopColor="#fff4d2" /><stop offset=".13" stopColor="#ffd592" /><stop offset=".5" stopColor="#ff9f62" stopOpacity=".3" /><stop offset="1" stopColor="#ff9f62" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-cl`}><stop offset="0" stopColor="#ffd7ae" stopOpacity=".5" /><stop offset="1" stopColor="#ffd7ae" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${u}-dome`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#58dbe0" /><stop offset=".5" stopColor="#1fa3b6" /><stop offset="1" stopColor="#0a6580" /></linearGradient>
          <linearGradient id={`${u}-brick`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#c58b5c" /><stop offset="1" stopColor="#6e4430" /></linearGradient>
          <linearGradient id={`${u}-haze`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6b073" stopOpacity="0" /><stop offset=".6" stopColor="#f6b073" stopOpacity=".34" /><stop offset="1" stopColor="#f6b073" stopOpacity="0" /></linearGradient>
          <linearGradient id={`${u}-gr`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1823" /><stop offset="1" stopColor="#0d070b" /></linearGradient>
        </defs>
        <rect width="800" height="450" fill={`url(#${u}-sky)`} />
        <Stars n={22} h={120} twinkle={6} />
        <circle cx="150" cy="316" r="230" fill={`url(#${u}-sun)`} />
        <Cloud fillId={`${u}-cl`} y={110} w={260} h={34} dur={160} delay={20} />
        <Cloud fillId={`${u}-cl`} y={190} w={330} h={44} dur={210} delay={120} o={0.8} />
        <path d={ridge(312, 30, 6)} fill="#7a4c5e" opacity=".7" />
        {/* far city */}
        <g fill="#5a3846" opacity=".85">
          <rect x="0" y="306" width="800" height="26" />
          {Array.from({ length: 36 }, (_, i) => <rect key={i} x={i * 23 + 4} y={298 + (i % 3) * 3} width={9} height={9} />)}
          {[70, 210, 690, 760].map((x, i) => <g key={i}><path d={`M${x - 14} 306 Q${x} 276 ${x + 14} 306 Z`} fill="#3d7f92" /><rect x={x - 1} y={266} width={2} height={12} /></g>)}
        </g>
        <rect y="290" width="800" height="56" fill={`url(#${u}-haze)`} />
        {/* the great mosque / mausoleum group */}
        <g transform="translate(470 330)">
          <Minaret x={-150} h={160} /><Minaret x={150} h={150} />
          <rect x={-118} y={-96} width={236} height={96} fill={`url(#${u}-brick)`} />
          <rect x={-118} y={-98} width={236} height={5} fill="#2fb3be" />
          <g transform="translate(0 -96)">
            <rect x={-56} y={-34} width={112} height={34} fill="#2a8aa0" />
            {[-48, -36, -24, -12, 0, 12, 24, 36, 48].map((x, i) => <rect key={i} x={x - 2} y={-30} width={4} height={26} fill="#1b6f87" opacity=".55" />)}
            <rect x={-56} y={-35} width={112} height={4} fill="#e8c36a" />
            <g transform="translate(0 -34)">
              <path d="M-66 0 C-66 -56 -36 -98 0 -110 C36 -98 66 -56 66 0 Z" fill={`url(#${u}-dome)`} />
              {ribs.map((x, i) => <path key={i} d={`M${x} 0 Q${x * 0.82} -62 0 -110`} stroke="#07566b" strokeWidth={0.9} fill="none" opacity=".55" />)}
              <path d="M-62 -4 C-62 -52 -34 -92 -2 -106" stroke="#aef7f4" strokeWidth={2} fill="none" opacity=".4" />
              <rect x={-0.9} y={-134} width={1.8} height={26} fill="#d9b65c" /><circle cy={-138} r={3.4} fill="#e8c36a" />
            </g>
          </g>
          <path d="M-46 0 L-46 -78 Q0 -118 46 -78 L46 0 Z" fill="#a8744c" />
          <path d="M-46 -78 Q0 -118 46 -78" stroke="#2fb3be" strokeWidth={5} fill="none" />
          <path d="M-30 0 L-30 -56 Q0 -90 30 -56 L30 0 Z" fill="#241520" />
          <path d="M-22 0 L-22 -50 Q0 -76 22 -50 L22 0 Z" fill="#ffb454" opacity=".85" style={{ animation: 'st-flicker 3.4s ease-in-out infinite' }} />
          {lit.map(([x, y], i) => <rect key={i} x={x! - 3} y={y! - 6} width={6} height={10} rx={3} fill="#ffc46b" opacity=".85" style={{ animation: `st-flicker ${2.6 + (i % 3) * 0.9}s ease-in-out ${-i * 0.7}s infinite` }} />)}
          <rect x={-118} y={-96} width={236} height={96} fill="#2a0f2a" opacity=".1" />
        </g>
        <Birds ys={[90, 130, 62, 150, 110]} color="#3a2230" dur={34} />
        <path d={ridge(352, 10, 2)} fill="#241520" />
        <rect y="346" width="800" height="104" fill={`url(#${u}-gr)`} />
        {/* the army camp and the column riding in */}
        <Tent x={86} y={400} s={1.6} body="#6b4a3a" trim="#c99c3b" door="#ffb454" flag="#b8302a" />
        <Tent x={706} y={410} s={1.4} body="#5d4034" trim="#c99c3b" door="#ffb454" flag="#b8302a" />
        <Fire x={188} y={414} s={1.1} /><Fire x={620} y={420} s={1.1} delay={0.4} />
        <g style={css({ animation: 'st-move 42s linear 0s both', '--x0': '-420px', '--x1': '780px' })}>
          {cavalry.map(([x, y, s, b, r], i) => <Horseman key={i} x={x} y={y} s={s} fill="#120a10" banner={b || undefined} rings={r} torch={i % 3 === 1} delay={i * 0.2} speed={0.8} />)}
        </g>
        <g fill="#0b0609"><path d="M0 450 L0 430 Q260 418 520 430 T800 426 L800 450 Z" /></g>
      </svg>
      <Particles kind="dust" running={running} density={0.7} />
    </Frame>
  );
});

// ---------------------------------------------------------------------------------------------
export const WinterScene = memo(function WinterScene({ running }: { running: boolean }) {
  const u = useUid();
  const dark = '#070d19';
  const tufts = Array.from({ length: 26 }, (_, i) => { const x = i * 31 + R(i) * 14; const h = 10 + R(i * 4.4) * 18; return `M${x} 450 L${x + 3} ${450 - h} L${x + 6} 450 M${x + 4} 450 L${x + 8} ${450 - h * 0.7} L${x + 11} 450`; }).join(' ');
  const column: [number, number, number, boolean?, boolean?][] = [[90, 392, 1.2, true], [190, 384, 1.1], [270, 410, 1.32, false, true], [380, 380, 1.0], [470, 400, 1.24, true], [570, 386, 1.08], [660, 408, 1.3], [740, 382, 1.02, true], [330, 372, 0.86]];
  return (
    <Frame>
      <svg {...SVG_PROPS}>
        <defs>
          <FireDefs />
          <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#040815" /><stop offset=".45" stopColor="#0d2038" /><stop offset=".78" stopColor="#2b4b6f" /><stop offset="1" stopColor="#8fb1c9" /></linearGradient>
          <radialGradient id={`${u}-moon`}><stop offset="0" stopColor="#f3f8ff" stopOpacity=".95" /><stop offset=".18" stopColor="#dfeaff" stopOpacity=".5" /><stop offset="1" stopColor="#8fb1ff" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-cl`}><stop offset="0" stopColor="#b8cfe8" stopOpacity=".28" /><stop offset="1" stopColor="#b8cfe8" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${u}-snow`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7f9bb6" /><stop offset=".5" stopColor="#3c5675" /><stop offset="1" stopColor="#17233a" /></linearGradient>
          <linearGradient id={`${u}-mist`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8d2ea" stopOpacity="0" /><stop offset=".6" stopColor="#b8d2ea" stopOpacity=".26" /><stop offset="1" stopColor="#b8d2ea" stopOpacity="0" /></linearGradient>
        </defs>
        <rect width="800" height="450" fill={`url(#${u}-sky)`} />
        <Stars n={48} h={190} twinkle={12} />
        <circle cx="610" cy="112" r="130" fill={`url(#${u}-moon)`} />
        <circle cx="610" cy="112" r="24" fill="#f4f8ff" />
        <circle cx="601" cy="106" r="5" fill="#cddcf2" opacity=".6" /><circle cx="619" cy="120" r="3.4" fill="#cddcf2" opacity=".5" />
        <Cloud fillId={`${u}-cl`} y={118} w={300} h={22} dur={130} delay={40} />
        <Scroll dur={190}>
          <path d={ridge(318, 130, 4, { peaky: true })} fill="#34506f" />
          <path d={ridgeLine(318, 130, 4, { peaky: true })} stroke="#cfe3f5" strokeWidth={1.3} fill="none" opacity=".55" />
        </Scroll>
        <rect y="262" width="800" height="90" fill={`url(#${u}-mist)`} />
        <Scroll dur={90}><path d={ridge(352, 44, 7)} fill="#1f3550" /></Scroll>
        <rect y="346" width="800" height="104" fill={`url(#${u}-snow)`} />
        <Scroll dur={11}>
          <g stroke="#dcebfa" strokeWidth={1.1} strokeLinecap="round" opacity=".3">
            {Array.from({ length: 16 }, (_, i) => { const x = R(i * 2.9) * 700; const y = 360 + R(i * 6.1) * 80; return <path key={i} d={`M${x} ${y} h${30 + R(i) * 70}`} />; })}
          </g>
        </Scroll>
        {/* the column, seen from a camera that rides along with it */}
        <g>
          {column.map(([x, y, s, banner, torch], i) => <Horseman key={i} x={x} y={y} s={s} fill={dark} banner={banner ? '#b8302a' : undefined} rings={!!banner} torch={!!torch || i === 3} delay={i * 0.23} speed={0.78 + (i % 3) * 0.05} />)}
          <Camel x={230} y={398} s={1.18} fill={dark} delay={0.3} />
          <Camel x={540} y={392} s={1.08} fill={dark} delay={0.9} />
        </g>
        <Scroll dur={4.5}><path d={tufts} stroke="#05080f" strokeWidth={3} strokeLinecap="round" fill="none" /></Scroll>
        <rect y="432" width="800" height="18" fill="#05080f" />
      </svg>
      <Particles kind="snow" running={running} density={1.25} />
    </Frame>
  );
});

// ---------------------------------------------------------------------------------------------
export const OtrarScene = memo(function OtrarScene({ running }: { running: boolean }) {
  const u = useUid();
  const dark = '#06090f';
  return (
    <Frame>
      <svg {...SVG_PROPS}>
        <defs>
          <FireDefs />
          <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#03050c" /><stop offset=".5" stopColor="#0b1322" /><stop offset=".85" stopColor="#1a2a46" /><stop offset="1" stopColor="#2f4666" /></linearGradient>
          <radialGradient id={`${u}-moon`}><stop offset="0" stopColor="#f4f8ff" stopOpacity=".9" /><stop offset=".2" stopColor="#d7e4ff" stopOpacity=".4" /><stop offset="1" stopColor="#8fb1ff" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-cl`}><stop offset="0" stopColor="#9fb7d8" stopOpacity=".3" /><stop offset="1" stopColor="#9fb7d8" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-sm`}><stop offset="0" stopColor="#8fa0b8" stopOpacity=".5" /><stop offset="1" stopColor="#8fa0b8" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${u}-snow`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2d405c" /><stop offset=".5" stopColor="#16233a" /><stop offset="1" stopColor="#0a101c" /></linearGradient>
          <linearGradient id={`${u}-ice`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#a9c3de" stopOpacity=".05" /><stop offset=".3" stopColor="#c7dbf0" stopOpacity=".42" /><stop offset=".7" stopColor="#c7dbf0" stopOpacity=".3" /><stop offset="1" stopColor="#a9c3de" stopOpacity=".05" /></linearGradient>
          <radialGradient id={`${u}-glow`}><stop offset="0" stopColor="#ffc56e" stopOpacity=".85" /><stop offset=".35" stopColor="#ff9a48" stopOpacity=".38" /><stop offset="1" stopColor="#ff8a3a" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${u}-tent`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#f0b25c" /><stop offset=".55" stopColor="#8a5130" /><stop offset="1" stopColor="#2a1a22" /></linearGradient>
        </defs>
        <rect width="800" height="450" fill={`url(#${u}-sky)`} />
        <Stars n={54} h={200} twinkle={14} />
        <circle cx="168" cy="112" r="150" fill={`url(#${u}-moon)`} />
        <circle cx="168" cy="112" r="30" fill="#f4f8ff" />
        <circle cx="157" cy="104" r="6" fill="#cddcf2" opacity=".55" /><circle cx="178" cy="124" r="4" fill="#cddcf2" opacity=".45" />
        <Cloud fillId={`${u}-cl`} y={108} w={260} h={18} dur={110} delay={10} />
        <Cloud fillId={`${u}-cl`} y={150} w={340} h={22} dur={170} delay={70} o={0.7} />
        <path d={ridge(336, 26, 9)} fill="#0e1828" />
        {/* the frozen Syr Darya */}
        <path d="M0 346 Q200 334 400 346 T800 340 L800 366 Q600 374 400 364 T0 372 Z" fill={`url(#${u}-ice)`} />
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={40 + i * 86 + R(i) * 30} y={350 + (i % 3) * 5} width={14 + R(i * 3) * 14} height={1.2} fill="#f2f8ff" style={{ animation: `st-twinkle ${2 + (i % 4) * 0.8}s ease-in-out ${-i * 0.5}s infinite` }} />)}
        <rect y="368" width="800" height="82" fill={`url(#${u}-snow)`} />
        {/* the camp */}
        <g fill="#0b121f">
          <Tent x={236} y={402} s={1.35} body="#162338" trim="#2a3a58" door="#d9964a" />
          <Tent x={742} y={408} s={1.5} body="#142034" trim="#2a3a58" door="#d9964a" />
        </g>
        {/* the glow of the lit pavilion, which fades by the end of the shot */}
        <g style={css({ animation: 'st-fade-to 7s ease-in 4.6s both', '--to': 0.22 })}>
          <ellipse cx="500" cy="392" rx="210" ry="86" fill={`url(#${u}-glow)`} style={{ animation: 'st-pulse 3.4s ease-in-out infinite' }} />
        </g>
        <g transform="translate(500 408) scale(2.35)">
          <path d="M-36 0 L-36 -20 C-36 -24 -26 -30 0 -48 C26 -30 36 -24 36 -20 L36 0 Z" fill={`url(#${u}-tent)`} />
          <path d="M-36 -19 C-20 -22 20 -22 36 -19 L36 -14 C20 -17 -20 -17 -36 -14 Z" fill="#c99c3b" opacity=".8" />
          <path d="M-7 0 L-7 -13 C-7 -19 7 -19 7 -13 L7 0 Z" fill="#ffd58a" style={{ animation: 'st-flicker 2.6s ease-in-out infinite' }} />
          <rect x={-0.8} y={-60} width={1.6} height={14} fill="#c99c3b" /><circle cy={-61} r={1.8} fill="#e8c36a" />
        </g>
        {/* the standard of the emir */}
        <g transform="translate(606 410)" fill={dark}>
          <rect x={-1} y={-118} width={2} height={118} /><circle cy={-120} r={4} fill="#8a6a2a" />
          <g style={{ animation: 'st-flap 1.4s ease-in-out infinite alternate' }}>{[-4, -1.5, 1, 3.5].map((dx, i) => <path key={i} d={`M${dx} -116 C${dx - 4} -100 ${dx + 5} -92 ${dx + 1} -76`} stroke="#7a1f1f" strokeWidth={1.7} fill="none" strokeLinecap="round" />)}</g>
        </g>
        <Fire x={420} y={420} s={0.9} glow={30} /><Fire x={584} y={426} s={0.9} glow={30} delay={0.5} /><Fire x={330} y={430} s={0.8} glow={26} delay={0.9} />
        <Smoke x={420} y={410} fillId={`${u}-sm`} n={3} dur={7} />
        {[[466, 424, 1.6], [535, 424, 1.6], [388, 436, 1.35], [640, 438, 1.4], [292, 432, 1.2]].map(([x, y, s], i) => <Guard key={i} x={x!} y={y!} s={s!} fill={dark} delay={i * 0.7} />)}
        <path d="M0 450 L0 438 Q240 430 480 440 T800 434 L800 450 Z" fill="#04060b" />
      </svg>
      <Particles kind="snow" running={running} density={0.8} />
    </Frame>
  );
});

// ---------------------------------------------------------------------------------------------
export const DawnScene = memo(function DawnScene({ running }: { running: boolean }) {
  const u = useUid();
  const dark = '#1a0f1c';
  const groups: { id: string; x1: number; y1: number; s0: number; s1: number; flip?: boolean; banner: string; n: number }[] = [
    { id: 'l', x1: -520, y1: -6, s0: 0.46, s1: 0.4, flip: true, banner: '#b8302a', n: 3 },
    { id: 'r', x1: 520, y1: -6, s0: 0.46, s1: 0.4, banner: '#2c5fb0', n: 3 },
    { id: 'fl', x1: -520, y1: 104, s0: 0.5, s1: 1.45, flip: true, banner: '#2f7a52', n: 2 },
    { id: 'fr', x1: 520, y1: 104, s0: 0.5, s1: 1.45, banner: '#c79a2b', n: 2 },
  ];
  return (
    <Frame>
      <svg {...SVG_PROPS}>
        <defs>
          <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1f3d" /><stop offset=".38" stopColor="#4d4180" /><stop offset=".7" stopColor="#e08a74" /><stop offset="1" stopColor="#ffd9a2" /></linearGradient>
          <radialGradient id={`${u}-sun`}><stop offset="0" stopColor="#fffbe6" /><stop offset=".12" stopColor="#ffe0a0" /><stop offset=".5" stopColor="#ffa86a" stopOpacity=".34" /><stop offset="1" stopColor="#ffa86a" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-cl`}><stop offset="0" stopColor="#ffd2b0" stopOpacity=".5" /><stop offset="1" stopColor="#ffd2b0" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-dust`}><stop offset="0" stopColor="#f0c090" stopOpacity=".55" /><stop offset="1" stopColor="#f0c090" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${u}-gr`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9906f" /><stop offset=".25" stopColor="#6d4a5a" /><stop offset="1" stopColor="#1e1224" /></linearGradient>
          <linearGradient id={`${u}-haze`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffc89a" stopOpacity="0" /><stop offset=".6" stopColor="#ffc89a" stopOpacity=".4" /><stop offset="1" stopColor="#ffc89a" stopOpacity="0" /></linearGradient>
        </defs>
        <rect width="800" height="450" fill={`url(#${u}-sky)`} />
        <Stars n={20} h={110} twinkle={4} />
        <g style={css({ animation: 'st-move 26s ease-out 0s both', '--y0': '70px', '--y1': '-22px' })}>
          <circle cx="400" cy="336" r="250" fill={`url(#${u}-sun)`} />
          <circle cx="400" cy="336" r="32" fill="#fffbe6" />
        </g>
        <Cloud fillId={`${u}-cl`} y={120} w={280} h={32} dur={150} delay={30} />
        <Cloud fillId={`${u}-cl`} y={200} w={340} h={40} dur={200} delay={110} o={0.8} />
        <path d={ridge(326, 56, 3)} fill="#765a86" opacity=".8" />
        <rect y="300" width="800" height="60" fill={`url(#${u}-haze)`} />
        <path d={ridge(352, 18, 5)} fill="#4a3050" />
        <rect y="344" width="800" height="106" fill={`url(#${u}-gr)`} />
        {/* the empty camp */}
        <Tent x={400} y={352} s={1.1} body="#2a1a2c" trim="#6b4a3a" door="#0b0710" />
        <Guard x={438} y={354} s={0.9} fill={dark} />
        {/* everybody rides away in a different direction */}
        {groups.map((g, gi) => (
          <g key={g.id} transform="translate(400 354)">
            <g style={css({ animation: `st-move 17s cubic-bezier(.5,0,.7,1) ${1.2 + gi * 0.5}s both`, '--x0': '0px', '--y0': '0px', '--x1': `${g.x1}px`, '--y1': `${g.y1}px`, '--s0': g.s0, '--s1': g.s1 })}>
              <ellipse cx={g.flip ? 60 : -60} cy={2} rx={90} ry={10} fill={`url(#${u}-dust)`} />
              {Array.from({ length: g.n }, (_, i) => <Horseman key={i} x={(g.flip ? -1 : 1) * i * 38} y={i * 6} s={1.1 - i * 0.06} fill={dark} flip={g.flip} banner={i === 0 ? g.banner : undefined} delay={i * 0.25} speed={0.7} />)}
            </g>
          </g>
        ))}
        <Birds ys={[96, 140, 70]} color="#4a3050" dur={36} />
        <g fill="#0c0610"><path d="M0 450 L0 432 Q260 422 520 434 T800 430 L800 450 Z" /></g>
      </svg>
      <Particles kind="dust" running={running} density={0.7} />
    </Frame>
  );
});

// ---------------------------------------------------------------------------------------------
export const RuinsScene = memo(function RuinsScene({ running }: { running: boolean }) {
  const u = useUid();
  const jag = (x0: number, w: number, top: number, seed: number) => {
    let d = `M${x0} 450 L${x0} ${top}`;
    const n = Math.max(3, Math.round(w / 14));
    for (let i = 1; i <= n; i++) d += ` L${(x0 + (w * i) / n).toFixed(1)} ${(top - R(seed + i * 3.1) * 26 + (i % 2 ? 6 : -4)).toFixed(1)}`;
    return `${d} L${x0 + w} 450 Z`;
  };
  return (
    <Frame>
      <svg {...SVG_PROPS}>
        <defs>
          <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a090f" /><stop offset=".42" stopColor="#241b24" /><stop offset=".78" stopColor="#5b4540" /><stop offset="1" stopColor="#9a7a62" /></linearGradient>
          <radialGradient id={`${u}-sun`}><stop offset="0" stopColor="#ffb070" stopOpacity=".85" /><stop offset=".4" stopColor="#d9743f" stopOpacity=".25" /><stop offset="1" stopColor="#d9743f" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-sm`}><stop offset="0" stopColor="#4a3a3c" stopOpacity=".75" /><stop offset="1" stopColor="#4a3a3c" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${u}-cl`}><stop offset="0" stopColor="#8a6a5c" stopOpacity=".35" /><stop offset="1" stopColor="#8a6a5c" stopOpacity="0" /></radialGradient>
          <linearGradient id={`${u}-haze`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b08a6e" stopOpacity="0" /><stop offset=".6" stopColor="#b08a6e" stopOpacity=".3" /><stop offset="1" stopColor="#b08a6e" stopOpacity="0" /></linearGradient>
        </defs>
        <rect width="800" height="450" fill={`url(#${u}-sky)`} />
        <circle cx="560" cy="290" r="190" fill={`url(#${u}-sun)`} />
        <circle cx="560" cy="290" r="30" fill="#ffb27a" opacity=".55" />
        <Cloud fillId={`${u}-cl`} y={120} w={340} h={44} dur={190} delay={30} />
        <Cloud fillId={`${u}-sm`} y={210} w={420} h={60} dur={240} delay={150} o={0.9} />
        <path d={ridge(330, 26, 5)} fill="#4a3a42" opacity=".8" />
        <rect y="290" width="800" height="70" fill={`url(#${u}-haze)`} />
        {/* what is left of a city */}
        <g fill="#1a1319">
          <path d={jag(30, 120, 318, 1)} /><path d={jag(190, 90, 300, 2)} /><path d={jag(330, 140, 326, 3)} /><path d={jag(520, 100, 296, 4)} /><path d={jag(660, 120, 320, 5)} />
          <path d="M420 330 L420 276 Q450 236 480 276 L480 330 L466 330 L466 282 Q450 258 434 282 L434 330 Z" />
          <path d="M250 330 L246 214 L262 214 L266 262 L258 330 Z" />
        </g>
        <Smoke x={90} y={318} fillId={`${u}-sm`} n={5} dur={11} /><Smoke x={236} y={300} fillId={`${u}-sm`} n={4} dur={9} /><Smoke x={402} y={326} fillId={`${u}-sm`} n={5} dur={12} /><Smoke x={566} y={300} fillId={`${u}-sm`} n={4} dur={10} /><Smoke x={720} y={322} fillId={`${u}-sm`} n={5} dur={13} />
        <g fill="#0d090d">
          <path d="M0 450 L0 388 Q160 372 330 392 T800 384 L800 450 Z" />
          <path d={jag(0, 70, 396, 8)} /><path d={jag(700, 100, 392, 9)} />
          <rect x={612} y={290} width={3} height={170} transform="rotate(14 612 460)" />
        </g>
        <Flag x={620} y={296} w={36} h={20} fill="#3a1614" speed={1.8} />
      </svg>
      <Particles kind="ash" running={running} density={1.1} />
    </Frame>
  );
});

export const SCENES: Record<Exclude<VisualKey, 'art'>, ComponentType<{ running: boolean }>> = {
  battle: BattleScene, samarkand: SamarkandScene, winter: WinterScene, otrar: OtrarScene, dawn: DawnScene, ruins: RuinsScene,
};
