import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Crown, FlaskConical, HeartPulse, Handshake, Swords, Users, Wheat, Scroll } from 'lucide-react';
import { useGame } from '../../store/game';
import { Badge } from '../ui';
import { ShieldFlag } from '../ui/Flag';
import { fmtDate } from '../../engine/date';
import { EVENT_DEFS } from '../../engine/events';
import { SceneArt, type SceneId } from '../art/SceneArt';
const CAT_SCENE: Record<string, SceneId> = { disaster: 'andes', health: 'postwar', economy: 'byzantium', politics: 'rome', science: 'horde', diplomacy: 'vienna', military: 'battlefield', society: 'steppe' };
import { Filigree, OrnateDivider, WaxSeal } from '../ui/Ornament';
import { sfx } from '../../services/audio';
import { tr } from '../../i18n';

const CAT: Record<string, { hue: number; icon: React.ReactNode; seal: string; label: string }> = {
  disaster: { hue: 20, icon: <Wheat className="h-6 w-6" />, seal: '#7a3a12', label: 'Calamity' },
  health: { hue: 290, icon: <HeartPulse className="h-6 w-6" />, seal: '#4a1f5a', label: 'Pestilence' },
  economy: { hue: 45, icon: <Coins className="h-6 w-6" />, seal: '#7a5a10', label: 'Treasury' },
  politics: { hue: 350, icon: <Crown className="h-6 w-6" />, seal: '#8e1b1b', label: 'Court & State' },
  science: { hue: 200, icon: <FlaskConical className="h-6 w-6" />, seal: '#1d4a6a', label: 'Learning' },
  diplomacy: { hue: 160, icon: <Handshake className="h-6 w-6" />, seal: '#1d5a3a', label: 'Diplomacy' },
  military: { hue: 5, icon: <Swords className="h-6 w-6" />, seal: '#6a1010', label: 'War' },
  society: { hue: 100, icon: <Users className="h-6 w-6" />, seal: '#3a5a1d', label: 'Society' },
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** Shows the oldest pending decision for the active player's country. */
export function EventModal() {
  useGame((s) => s.version);
  const w = useGame((s) => s.world);
  const dispatch = useGame((s) => s.dispatch);
  const pe = w && w.player ? w.events.pending.find((e) => e.country === w.player) : undefined;
  const c = pe && w ? w.countries[pe.country] : null;
  const cat = CAT[EVENT_DEFS.find((d) => d.id === pe?.eventId)?.category ?? 'politics'] ?? CAT.politics;
  const remaining = pe && w ? w.events.pending.filter((e) => e.country === w.player).length - 1 : 0;
  return (
    <AnimatePresence>
      {pe && c && (
        <motion.div key={pe.uid} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div role="dialog" aria-modal aria-label={pe.title} className="panel relative w-full max-w-2xl" initial={{ y: 40, scale: 0.92, rotateX: 12 }} animate={{ y: 0, scale: 1, rotateX: 0 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }} style={{ transformPerspective: 1200 }}>
            <Filigree />
            <div className="relative h-40 overflow-hidden rounded-t-lg">
              <SceneArt scene={CAT_SCENE[EVENT_DEFS.find((d) => d.id === pe.eventId)?.category ?? 'politics'] ?? 'rome'} className="absolute inset-0 h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-950/90" />
              <div className="absolute left-5 top-4 flex items-center gap-2"><ShieldFlag flag={c.flag} className="h-12 w-10" /><div><div className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-gold-200/90">{tr(cat.label)}</div><div className="text-xs text-parchment-100/80">{c.name} · {fmtDate(pe.date)}</div></div></div>
              <div className="absolute right-4 top-4"><Badge tone="purple">{tr('Simulated event')}</Badge></div>
              <h2 className="absolute bottom-3 left-0 right-0 text-center font-deco text-3xl font-bold text-gold-50 [text-shadow:0_2px_10px_rgba(0,0,0,.9)]">{tr(pe.title)}</h2>
            </div>
            <div className="px-6 pb-6 pt-5">
              <div className="parchment relative px-7 py-6" style={{ clipPath: 'polygon(0 2%, 3% 0, 12% 1.5%, 24% 0, 38% 1.2%, 52% 0, 66% 1.6%, 80% 0, 92% 1.4%, 100% 0, 99% 30%, 100% 60%, 99% 100%, 85% 98.5%, 70% 100%, 55% 98.4%, 40% 100%, 25% 98.6%, 10% 100%, 0 98%, 1% 60%, 0 30%)' }}>
                <div className="absolute -right-1 -top-1"><WaxSeal color={cat.seal} className="h-16 w-16">{cat.icon}</WaxSeal></div>
                <Scroll className="float-left mr-3 mt-1 h-9 w-9 text-bronze-500" />
                <p className="pr-12 font-serif text-[18px] leading-relaxed text-ink-900 first-letter:float-left first-letter:mr-1.5 first-letter:font-deco first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.85] first-letter:text-blood-600">{tr(pe.body)}</p>
              </div>
              <OrnateDivider className="my-4" />
              <div className="space-y-2">
                {pe.options.map((o, i) => (
                  <motion.button key={o.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
                    onMouseEnter={() => sfx('hover')} onClick={() => { sfx('select'); void dispatch({ type: 'eventChoice', country: pe.country, uid: pe.uid, option: o.id }); }}
                    className="btn-ghost group !flex w-full !justify-start !gap-3 !px-3 !py-2.5 text-left">
                    <span className="nav-icon !h-9 !w-9 shrink-0 font-deco text-[13px] font-bold group-hover:active">{ROMAN[i]}</span>
                    <span><span className="block font-semibold text-gold-50">{tr(o.label)}</span><span className="block text-xs font-normal text-parchment-300/75">{tr(o.hint)}</span></span>
                  </motion.button>
                ))}
              </div>
              {remaining > 0 && <div className="mt-3 text-center font-display text-[10px] uppercase tracking-[0.25em] text-parchment-300/60">{tr('{n} more decision(s) await', { n: remaining })}</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
