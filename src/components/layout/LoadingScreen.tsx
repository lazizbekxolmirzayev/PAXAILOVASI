import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { Globe } from '../map/Globe';
import { OrnateDivider } from '../ui/Ornament';
import { tr } from '../../i18n';

// Documented historical facts shown while worlds are generated.
const FACTS = [
  'In 1405 Timur died at Otrar while marching on Ming China — one of history\'s great "what ifs".',
  'The Battle of Waterloo (18 June 1815) was, in Wellington\'s words, "the nearest-run thing you ever saw in your life".',
  'The Eastern Roman Empire outlived the Western Empire by almost a thousand years, until 1453.',
  'At its height the Mongol Empire was the largest contiguous land empire in history.',
  'The Inca road system, the Qhapaq Ñan, stretched roughly 30,000 km along the Andes.',
  'The siege of Vienna in 1683 ended with the largest cavalry charge in history, led by Jan III Sobieski.',
  'The Black Death (1346–1353) killed an estimated 30–50% of Europe\'s population.',
];

export function LoadingScreen() {
  const loading = useGame((s) => s.loading);
  const [i, setI] = useState(() => Math.floor(Math.random() * FACTS.length));
  useEffect(() => { if (!loading) return; const t = setInterval(() => setI((x) => (x + 1) % FACTS.length), 3500); return () => clearInterval(t); }, [loading]);
  if (!loading) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-black p-6">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(40,70,140,.35), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(169,127,42,.25), transparent 60%)' }} />
      <div className="relative"><Globe mapKey="1400" size={300} speed={30} interactive={false} labels={false} /></div>
      <div className="relative mt-6 font-deco gold-shine text-3xl font-bold">{loading}…</div>
      <div className="relative mt-4 h-2 w-80 overflow-hidden rounded-full" style={{ background: 'linear-gradient(#05070c,#0b0f19) padding-box, linear-gradient(90deg,#5e4417,#f3e6bd,#5e4417) border-box', border: '1px solid transparent' }}>
        <motion.div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-gold-200 to-transparent" animate={{ x: ['-100%', '300%'] }} transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }} />
      </div>
      <OrnateDivider className="relative mt-8 w-96" />
      <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative mt-4 max-w-xl text-center font-serif text-xl italic text-parchment-100/85">“{FACTS[i]}”</motion.p>
      <span className="relative mt-2 font-display text-[10px] uppercase tracking-[0.35em] text-sky-300/60">{tr('Documented history')}</span>
    </motion.div>
  );
}
