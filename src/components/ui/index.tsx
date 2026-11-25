import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Filigree, OrnateDivider } from './Ornament';
import { sfx } from '../../services/audio';
const T = (x: ReactNode): ReactNode => (typeof x === 'string' ? tr(x) : x);
import { tr } from '../../i18n';

export function cx(...c: (string | false | null | undefined)[]): string { return c.filter(Boolean).join(' '); }

export function Panel({ children, className, ornate, title, actions, subtitle }: { children: ReactNode; className?: string; ornate?: boolean; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx('panel', 'p-4', className)}>
      {ornate && <Filigree />}
      {(title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="title-display flex items-center gap-2 text-[13px] text-gold-200"><span className="inline-block h-1.5 w-1.5 rotate-45 bg-gradient-to-br from-gold-100 to-gold-600" />{T(title)}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-parchment-300/60">{T(subtitle)}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'gold' | 'ghost' | 'danger'; icon?: ReactNode; size?: 'sm' | 'md' | 'lg'; loading?: boolean };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'ghost', icon, size = 'md', loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} {...rest} onClick={(e) => { sfx('click'); rest.onClick?.(e); }} disabled={disabled || loading} className={cx(variant === 'gold' ? 'btn-gold' : variant === 'danger' ? 'btn-danger' : 'btn-ghost', size === 'sm' && '!px-2.5 !py-1 !text-xs', size === 'lg' && '!px-6 !py-3 !text-base', className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {T(children)}
    </button>
  );
});

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'neutral'; icon?: ReactNode }) {
  return (
    <div className="hud-res !block !px-3 !py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-parchment-300/60">{icon}{tr(label)}</div>
      <div className={cx('stat-num mt-0.5 text-lg font-semibold', tone === 'good' && 'text-verdigris-400', tone === 'bad' && 'text-blood-400', (!tone || tone === 'neutral') && 'text-parchment-50')}>{value}</div>
      {sub && <div className="text-[11px] text-parchment-300/60">{T(sub)}</div>}
    </div>
  );
}

export function Bar({ value, max = 100, color = 'gold', label, right }: { value: number; max?: number; color?: 'gold' | 'green' | 'red' | 'blue'; label?: ReactNode; right?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bg = { gold: 'from-gold-500 to-gold-200', green: 'from-verdigris-500 to-emerald-300', red: 'from-blood-600 to-blood-400', blue: 'from-sky-700 to-sky-400' }[color];
  return (
    <div>
      {(label || right) && <div className="mb-1 flex justify-between text-[11px] text-parchment-300/70"><span>{T(label)}</span><span className="stat-num">{right}</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-ink-950 ring-1 ring-gold-700/30"><div className={cx('h-full rounded-full bg-gradient-to-r transition-[width] duration-500', bg)} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="hud-res flex flex-wrap gap-1 !p-1">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => { sfx('click'); onChange(t.id); }} className={cx('rounded px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] transition', value === t.id ? 'bg-gradient-to-b from-gold-100 via-gold-300 to-gold-600 text-ink-950 shadow-glow' : 'text-parchment-200/70 hover:text-gold-100 hover:bg-ink-800')}>{T(t.label)}</button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose?: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open || !onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
          <motion.div role="dialog" aria-modal className={cx('panel max-h-[90vh] w-full', wide ? 'max-w-4xl' : 'max-w-xl')} initial={{ y: 30, scale: 0.94, filter: 'blur(6px)' }} animate={{ y: 0, scale: 1, filter: 'blur(0px)' }} exit={{ y: 12, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
            <Filigree />
            <div className="relative flex items-center justify-center border-b border-gold-600/25 px-5 py-3">
              <h2 className="title-display gold-text text-[15px] font-bold">{T(title)}</h2>
              {onClose && <button onClick={onClose} className="nav-icon absolute right-3 !h-7 !w-7" aria-label={tr('Close')}><X className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="scroll-thin max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-gold-600/20 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Slider({ value, min, max, step = 0.01, onChange, format }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-950 accent-gold-400 ring-1 ring-gold-700/40" />
      {format && <span className="stat-num w-14 text-right text-xs text-gold-100">{format(value)}</span>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm text-parchment-100">
      <span>{T(label)}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cx('relative h-5 w-9 rounded-full ring-1 transition', checked ? 'bg-gold-400 ring-gold-200' : 'bg-ink-950 ring-gold-700/50')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-parchment-50 shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Badge({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'red' | 'green' | 'blue' | 'gray' | 'purple' }) {
  const c = { gold: 'bg-gold-500/15 text-gold-200 ring-gold-400/40', red: 'bg-blood-500/15 text-blood-400 ring-blood-400/40', green: 'bg-verdigris-500/15 text-emerald-300 ring-emerald-400/30', blue: 'bg-sky-500/10 text-sky-300 ring-sky-400/30', gray: 'bg-white/5 text-parchment-300 ring-white/10', purple: 'bg-purple-500/10 text-purple-300 ring-purple-400/30' }[tone];
  return <span className={cx('chip', c)}>{T(children)}</span>;
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="text-gold-400/60">{icon}</div>
      <div className="title-display text-sm text-gold-100">{tr(title)}</div>
      {text && <p className="max-w-sm text-sm text-parchment-300/60">{tr(text)}</p>}
      {action}
    </div>
  );
}
export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-3 py-10 text-gold-200"><Loader2 className="h-5 w-5 animate-spin" /><span className="title-display text-xs">{label}…</span></div>;
}
export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-blood-600/15 p-3 text-sm text-blood-400 ring-1 ring-blood-400/40">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{tr(error)}</div>
      {onRetry && <Button size="sm" onClick={onRetry}>{tr('Retry')}</Button>}
    </div>
  );
}
export function SectionTitle({ children, kicker }: { children: ReactNode; kicker?: ReactNode }) {
  return (
    <div className="mb-6">
      {kicker && <div className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.4em] text-gold-400/90">{T(kicker)}</div>}
      <h1 className="font-deco gold-shine text-3xl font-bold tracking-[0.06em] md:text-[42px] md:leading-tight">{T(children)}</h1>
      <OrnateDivider className="mt-3 max-w-md" />
    </div>
  );
}
export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <label className="block">
      <span className="label">{tr(label)}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-parchment-300/50">{tr(hint)}</span>}
      {error && <span className="mt-1 block text-[11px] text-blood-400">{tr(error)}</span>}
    </label>
  );
}
export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cx('input', className)}>
      {options.map((o) => <option key={o.value} value={o.value} className="bg-ink-900">{tr(o.label)}</option>)}
    </select>
  );
}
export function FactBadge({ factual }: { factual: boolean }) {
  return factual ? <Badge tone="blue">{tr('Documented history')}</Badge> : <Badge tone="purple">{tr('Alternative / simulated')}</Badge>;
}
