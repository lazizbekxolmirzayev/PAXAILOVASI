import { memo } from 'react';

/** Procedural cinematic banner (no copyrighted imagery): painted sky, sun & god rays, clouds,
 *  layered ridges, a city skyline with domes, towers and spires, banners, mist and the year. */
export const ScenarioArt = memo(function ScenarioArt({ hue, year, seed = 1, className = '' }: { hue: number; year: string; seed?: number; className?: string }) {
  const h = hue, s = seed, id = `a${h}_${s}`;
  const rnd = (k: number) => { const x = Math.sin(s * 999 + k * 77.7) * 10000; return x - Math.floor(x); };
  const ridge = (y: number, amp: number, k: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x <= 400; x += 16) d += ` L${x} ${y - Math.abs(Math.sin((x + s * 37) / (k * 13)) * amp + Math.sin((x + s * 11) / (k * 5)) * amp * 0.4)}`;
    return d + ' L400 220 L0 220 Z';
  };
  // skyline
  let sky = 'M0 220 L0 196';
  let x = 0, k = 0;
  const spires: JSX.Element[] = [];
  while (x < 400) {
    const w = 10 + rnd(k) * 22, hgt = 8 + rnd(k + 1) * 26, type = Math.floor(rnd(k + 2) * 5);
    const base = 196;
    sky += ` L${x} ${base - hgt}`;
    if (type === 0) sky += ` Q${x + w / 2} ${base - hgt - w * 0.75} ${x + w} ${base - hgt}`; // dome
    else if (type === 1) { sky += ` L${x + w * 0.45} ${base - hgt} L${x + w * 0.5} ${base - hgt - 22} L${x + w * 0.55} ${base - hgt}`; } // spire
    else if (type === 2) { for (let i = 0; i < 3; i++) sky += ` L${x + (w / 3) * i} ${base - hgt - 4} L${x + (w / 3) * i + w / 6} ${base - hgt - 4} L${x + (w / 3) * i + w / 6} ${base - hgt}`; } // crenellations
    sky += ` L${x + w} ${base - hgt} L${x + w} ${base - 4}`;
    if (type === 3 && rnd(k + 3) > 0.4) spires.push(<rect key={k} x={x + w / 2 - 1.5} y={base - hgt - 30} width="3" height="30" />);
    x += w + rnd(k + 4) * 6; k += 5;
  }
  sky += ' L400 196 L400 220 Z';
  const sunX = 230 + (s % 5) * 25;
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 50% 9%)`} /><stop offset=".45" stopColor={`hsl(${(h + 15) % 360} 55% 24%)`} /><stop offset=".8" stopColor={`hsl(${(h + 30) % 360} 70% 48%)`} /><stop offset="1" stopColor={`hsl(${(h + 40) % 360} 80% 62%)`} />
        </linearGradient>
        <radialGradient id={`sun${id}`}><stop offset="0" stopColor="#fffaf0" /><stop offset=".25" stopColor="#ffe6a8" stopOpacity=".95" /><stop offset="1" stopColor="#f3c86a" stopOpacity="0" /></radialGradient>
        <linearGradient id={`mist${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={`hsl(${(h + 30) % 360} 60% 70%)`} stopOpacity="0" /><stop offset="1" stopColor={`hsl(${(h + 30) % 360} 60% 75%)`} stopOpacity=".35" /></linearGradient>
        <filter id={`blur${id}`}><feGaussianBlur stdDeviation="4" /></filter>
        <linearGradient id={`vig${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".35" /><stop offset=".5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".55" /></linearGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#sky${id})`} />
      {Array.from({ length: 34 }, (_, i) => <circle key={i} cx={(i * 97 + s * 13) % 400} cy={(i * 53) % 80} r={i % 5 === 0 ? 0.9 : 0.45} fill="#fff" opacity=".55" />)}
      <g opacity=".22">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${sunX} 128 L${sunX - 260 + i * 65} 0 L${sunX - 230 + i * 65} 0 Z`} fill="#fff3c9" />)}</g>
      <circle cx={sunX} cy="128" r="80" fill={`url(#sun${id})`} />
      <g filter={`url(#blur${id})`} opacity=".55">
        {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={(rnd(i + 40) * 400)} cy={40 + rnd(i + 50) * 60} rx={50 + rnd(i + 60) * 60} ry={7 + rnd(i + 70) * 6} fill={`hsl(${(h + 25) % 360} 50% ${55 + i * 5}%)`} />)}
      </g>
      <path d={ridge(160, 32, 3)} fill={`hsl(${h} 30% 22%)`} opacity=".85" />
      <path d={ridge(178, 22, 2)} fill={`hsl(${h} 35% 14%)`} />
      <rect y="150" width="400" height="70" fill={`url(#mist${id})`} />
      <g fill={`hsl(${h} 45% 5%)`}>
        <path d={sky} />
        {spires}
        {[30, 70, 330, 365].map((bx, i) => <g key={i} transform={`translate(${bx + (s % 3) * 6} ${190 - (i % 2) * 8})`}><rect x="-0.8" y="-30" width="1.6" height="34" /><path d="M0.8 -30 Q8 -27 17 -25 Q8 -22 0.8 -19 Z" fill={`hsl(${(h + 180) % 360} 65% 42%)`} /></g>)}
        <path d="M0 205 Q100 198 200 206 T400 204 L400 220 L0 220 Z" />
      </g>
      <text x="20" y="205" fontFamily="Cinzel, serif" fontWeight="800" fontSize="44" fill="#fbf6e6" opacity=".12" letterSpacing="4">{year}</text>
      <rect width="400" height="220" fill={`url(#vig${id})`} />
    </svg>
  );
});
