import { memo, type ReactNode } from 'react';

const GoldDefs = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fff3c9" /><stop offset=".35" stopColor="#d9b65c" /><stop offset=".6" stopColor="#7a5718" /><stop offset="1" stopColor="#e8d08a" />
    </linearGradient>
  </defs>
);

/** Gilded filigree for one corner (top-left orientation; others are mirrored). */
function Corner({ className, flip }: { className: string; flip: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`pointer-events-none absolute h-12 w-12 ${className}`} style={{ transform: flip }} aria-hidden>
      <GoldDefs id="fg" />
      <g fill="none" stroke="url(#fg)" strokeLinecap="round">
        <path d="M3 40 V10 Q3 3 10 3 H40" strokeWidth="2.4" />
        <path d="M8 30 V13 Q8 8 13 8 H30" strokeWidth="1.1" opacity=".8" />
        <path d="M14 14 C22 14 26 18 26 24 C26 29 21 31 18 28 C15 25 18 21 21 23" strokeWidth="1.4" />
        <path d="M3 46 C6 50 6 54 3 58" strokeWidth="1.2" opacity=".7" />
        <path d="M46 3 C50 6 54 6 58 3" strokeWidth="1.2" opacity=".7" />
      </g>
      <circle cx="10" cy="10" r="3" fill="url(#fg)" stroke="#2a1d08" strokeWidth=".8" />
      <path d="M10 5.5 L11.4 10 L10 14.5 L8.6 10 Z" fill="#fffaf0" opacity=".6" />
    </svg>
  );
}
export const Filigree = memo(function Filigree({ inset = -6 }: { inset?: number }) {
  const s = { margin: inset } as React.CSSProperties;
  return (
    <>
      <div style={s} className="pointer-events-none absolute inset-0 z-[1]">
        <Corner className="left-0 top-0" flip="none" />
        <Corner className="right-0 top-0" flip="scaleX(-1)" />
        <Corner className="bottom-0 left-0" flip="scaleY(-1)" />
        <Corner className="bottom-0 right-0" flip="scale(-1,-1)" />
      </div>
    </>
  );
});

export function OrnateDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} aria-hidden>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/70 to-gold-300" />
      <svg viewBox="0 0 40 12" className="h-3 w-10"><GoldDefs id="dv" /><path d="M0 6 H12 M28 6 H40" stroke="url(#dv)" /><path d="M20 0 L26 6 L20 12 L14 6 Z" fill="url(#dv)" /><circle cx="20" cy="6" r="1.6" fill="#1b1208" /></svg>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/70 to-gold-300" />
    </div>
  );
}

/** Wax seal with an emblem letter/icon. */
export function WaxSeal({ children, color = '#8e1b1b', className = 'h-16 w-16' }: { children?: ReactNode; color?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_4px_6px_rgba(0,0,0,.6)]" aria-hidden>
        <defs><radialGradient id={`ws${color}`} cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset=".3" stopColor={color} /><stop offset="1" stopColor="#2a0505" /></radialGradient></defs>
        <path d="M50 4 C62 6 66 2 74 10 C82 16 92 20 92 34 C96 44 98 54 92 64 C90 78 82 84 72 90 C62 96 54 98 44 94 C30 96 20 88 14 78 C6 70 2 58 6 46 C4 32 10 20 22 12 C32 6 40 2 50 4 Z" fill={`url(#ws${color})`} />
        <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="3" />
        <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(255,200,180,.25)" strokeWidth="1" transform="translate(-1 -1)" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[#f6d9c9] drop-shadow-[0_1px_0_rgba(0,0,0,.6)]">{children}</div>
    </div>
  );
}

export const CompassRose = memo(function CompassRose({ className = 'h-28 w-28' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <GoldDefs id="cr" />
      <circle cx="60" cy="60" r="54" fill="rgba(7,9,15,.35)" stroke="url(#cr)" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="47" fill="none" stroke="url(#cr)" strokeWidth=".6" strokeDasharray="2 3" />
      {Array.from({ length: 32 }, (_, i) => <line key={i} x1="60" y1="8" x2="60" y2={i % 4 === 0 ? 15 : 11} stroke="url(#cr)" strokeWidth=".8" transform={`rotate(${i * 11.25} 60 60)`} />)}
      {[45, 135, 225, 315].map((r) => <path key={r} d="M60 60 L64 46 L60 26 L56 46 Z" fill="#5e4417" stroke="url(#cr)" strokeWidth=".6" transform={`rotate(${r} 60 60)`} />)}
      {[0, 90, 180, 270].map((r) => <g key={r} transform={`rotate(${r} 60 60)`}><path d="M60 60 L66 44 L60 12 Z" fill="#f3e6bd" /><path d="M60 60 L54 44 L60 12 Z" fill="#a97f2a" /></g>)}
      <circle cx="60" cy="60" r="4" fill="url(#cr)" stroke="#1b1208" />
      <text x="60" y="7" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="9" fontWeight="700" fill="#f3e6bd">N</text>
    </svg>
  );
});

export function Cartouche({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="relative px-10 py-2 text-center">
      <svg viewBox="0 0 300 70" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <GoldDefs id="ca" />
        <path d="M20 8 H280 C292 8 296 20 288 35 C296 50 292 62 280 62 H20 C8 62 4 50 12 35 C4 20 8 8 20 8 Z" fill="rgba(233,219,184,.92)" stroke="url(#ca)" strokeWidth="2.5" />
        <path d="M26 14 H274 C282 14 285 24 280 35 C285 46 282 56 274 56 H26 C18 56 15 46 20 35 C15 24 18 14 26 14 Z" fill="none" stroke="#7a5718" strokeWidth=".8" />
        <path d="M2 35 C10 28 10 42 2 35 Z M298 35 C290 28 290 42 298 35 Z" fill="url(#ca)" />
      </svg>
      <div className="relative">
        <div className="font-deco text-[15px] font-bold leading-tight tracking-[0.08em] text-ink-900">{title}</div>
        {subtitle && <div className="font-serif text-[11px] italic text-ink-700">{subtitle}</div>}
      </div>
    </div>
  );
}
