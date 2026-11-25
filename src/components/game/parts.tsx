import { Coins, Wheat, Swords, Anchor } from 'lucide-react';
import { UNIT, UNIT_KINDS } from '../../engine/rt';
import type { Units } from '../../types/game';
import { fmtNum } from '../../engine/util';
import { useT } from '../../i18n';
import { cx } from '../ui';

export const num = (n: number): string => fmtNum(Math.round(n));

/** Table of unit counts (only non-empty rows unless `all`). */
export function UnitsGrid({ units, all, className }: { units: Units; all?: boolean; className?: string }) {
  const t = useT();
  const rows = UNIT_KINDS.filter((k) => all || units[k] >= 0.5);
  if (!rows.length) return <p className={cx('text-xs text-parchment-300/60', className)}>{t('No troops.')}</p>;
  return (
    <div className={cx('grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs', className)}>
      {rows.map((k) => (
        <div key={k} className="contents">
          <span className="flex items-center gap-1.5 text-parchment-200/90">{k === 'fleet' ? <Anchor className="h-3 w-3 text-sky-300" /> : <Swords className="h-3 w-3 text-gold-300/70" />}{t(UNIT[k].name)}</span>
          <span className="stat-num text-right text-parchment-50">{num(units[k])}</span>
        </div>
      ))}
    </div>
  );
}

export function Res({ gold, food, className }: { gold?: number; food?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      {gold !== undefined && <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-gold-300" /><b className="stat-num">{num(gold)}</b></span>}
      {food !== undefined && <span className="inline-flex items-center gap-1"><Wheat className="h-3.5 w-3.5 text-emerald-300" /><b className="stat-num">{num(food)}</b></span>}
    </span>
  );
}

export function KV({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'good' | 'bad' }) {
  const t = useT();
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
      <span className="text-parchment-300/75">{t(k)}</span>
      <span className={cx('stat-num font-semibold', tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-blood-400' : 'text-parchment-50')}>{v}</span>
    </div>
  );
}

export function NumberInput({ value, onChange, max, min = 0, className }: { value: number; onChange: (v: number) => void; max?: number; min?: number; className?: string }) {
  return (
    <input type="number" min={min} max={max} value={Number.isFinite(value) ? value : 0} onChange={(e) => { let v = Math.floor(Number(e.target.value) || 0); if (max !== undefined) v = Math.min(max, v); onChange(Math.max(min, v)); }}
      className={cx('stat-num w-24 rounded border border-gold-700/40 bg-ink-950/70 px-2 py-1 text-right text-xs text-parchment-50 outline-none focus:border-gold-400', className)} />
  );
}
