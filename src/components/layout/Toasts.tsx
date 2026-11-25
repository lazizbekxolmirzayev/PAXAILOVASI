import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, ScrollText } from 'lucide-react';
import { useGame } from '../../store/game';
import { cx } from '../ui';

const ICON = { good: CheckCircle2, bad: AlertTriangle, info: Info, event: ScrollText };
export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const I = ICON[t.tone];
          return (
            <motion.button key={t.id} onClick={() => dismiss(t.id)} layout initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="panel pointer-events-auto flex items-center gap-3 overflow-hidden py-2.5 pl-2.5 pr-4 text-left text-sm">
              <span className={cx('absolute inset-y-0 left-0 w-1', t.tone === 'good' ? 'bg-emerald-400' : t.tone === 'bad' ? 'bg-blood-400' : 'bg-gold-300')} />
              <span className={cx('nav-icon !h-8 !w-8 shrink-0', t.tone === 'bad' && '!text-blood-400', t.tone === 'good' && '!text-emerald-300')}><I className="h-4 w-4" /></span>
              <span className={cx('leading-snug', t.tone === 'bad' ? 'text-parchment-50' : 'text-parchment-100')}>{t.text}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
