import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Music, Settings, User, VolumeX } from 'lucide-react';
import { useGame } from '../store/game';
import { latestSave, loadWorld, type SaveMeta } from '../services/saves';
import { SCENARIOS } from '../data/scenarios';
import { useSettings } from '../services/settings';
import { sfx, startMusic, stopMusic } from '../services/audio';
import { Globe } from '../components/map/Globe';
import { Flag } from '../components/ui/Flag';
import { OrnateDivider } from '../components/ui/Ornament';
import { useProfile } from '../services/profile';
import { formatYear, MAP_YEARS } from '../data/eras';
import { cx } from '../components/ui';
import { tr } from '../i18n';
import { LangSwitch } from '../components/ui/LangSwitch';

const GLOBE_ERAS = ['1400', '100', '1815', '1200', '1530', '1914', 'bc500', '1715'];

export function Starfield() {
  const stars = useMemo(() => Array.from({ length: 160 }, (_, i) => ({ x: (i * 97.13) % 100, y: (i * 53.7 + (i % 7) * 13) % 100, s: i % 9 === 0 ? 2 : 1, o: 0.25 + ((i * 37) % 70) / 100 })), []);
  const dust = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ left: (i * 37) % 100, dur: 14 + (i % 7) * 4, delay: -(i * 2.3) })), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 45%, rgba(40,70,140,.35), transparent 55%), radial-gradient(ellipse at 15% 80%, rgba(120,70,20,.22), transparent 50%), radial-gradient(ellipse at 50% 120%, rgba(169,127,42,.18), transparent 60%), #04060b' }} />
      {stars.map((s, i) => <span key={i} className="absolute rounded-full bg-white" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o }} />)}
      {dust.map((d, i) => <span key={`d${i}`} className="dust" style={{ left: `${d.left}%`, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }} />)}
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 220px 60px rgba(0,0,0,.9)' }} />
    </div>
  );
}

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const h = () => onDone();
    window.addEventListener('keydown', h); window.addEventListener('pointerdown', h);
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('pointerdown', h); };
  }, [onDone]);
  return (
    <motion.div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black" exit={{ opacity: 0, transition: { duration: 1.1 } }}>
      <motion.div initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 1, letterSpacing: '0.35em' }} transition={{ duration: 2.4, ease: 'easeOut' }} className="font-display text-[11px] uppercase text-gold-300/80">{tr('An alternative history chronicle')}</motion.div>
      <motion.h1 initial={{ opacity: 0, scale: 1.15, filter: 'blur(14px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 2.2, delay: 0.6, ease: [0.2, 0.7, 0.2, 1] }} className="font-deco gold-shine mt-6 text-7xl font-black md:text-[140px]">What If?</motion.h1>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 }} className="mt-4 w-80"><OrnateDivider /></motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.35, 1] }} transition={{ delay: 3, duration: 2.6, repeat: Infinity, repeatType: 'reverse' }} className="absolute bottom-16 font-display text-xs uppercase tracking-[0.4em] text-parchment-200/80">{tr('Press any key to begin')}</motion.div>
    </motion.div>
  );
}

export default function MainMenu() {
  const navigate = useNavigate();
  const world = useGame((s) => s.world);
  const setWorld = useGame((s) => s.setWorld);
  const toast = useGame((s) => s.toast);
  const name = useProfile((s) => s.displayName);
  const [last, setLast] = useState<SaveMeta | null>(null);
  const [splash, setSplash] = useState(() => !sessionStorage.getItem('whatif-splash'));
  const [eraIdx, setEraIdx] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [featured, setFeatured] = useState(0);
  const musicOn = useSettings((s) => s.musicOn);
  const set = useSettings((s) => s.set);
  const [size, setSize] = useState(() => Math.min(window.innerHeight * 0.82, window.innerWidth * 0.5, 820));
  useEffect(() => { void latestSave().then(setLast).catch(() => setLast(null)); }, []);
  useEffect(() => { const r = () => setSize(Math.max(300, Math.min(window.innerHeight * 0.82, window.innerWidth < 1024 ? window.innerWidth * 0.9 : window.innerWidth * 0.5, 820))); r(); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  useEffect(() => { const t = setInterval(() => setEraIdx((i) => (i + 1) % GLOBE_ERAS.length), 22000); const f = setInterval(() => setFeatured((i) => (i + 1) % SCENARIOS.length), 7000); return () => { clearInterval(t); clearInterval(f); }; }, []);

  const endSplash = () => { sessionStorage.setItem('whatif-splash', '1'); setSplash(false); if (useSettings.getState().musicOn) startMusic(); };
  const cont = async () => {
    if (world) { navigate('/game'); return; }
    if (!last) return;
    try { await setWorld(await loadWorld(last.slot)); navigate('/game'); } catch (e) { toast(`Could not load: ${(e as Error).message}`, 'bad'); }
  };
  const toggleMusic = () => { if (musicOn) { stopMusic(); set({ musicOn: false }); } else { startMusic(); set({ musicOn: true }); } };
  const items: { label: string; sub: string; action: () => void; disabled?: boolean; primary?: boolean }[] = [
    { label: 'New Game', sub: 'Choose your path through history', action: () => navigate('/new'), primary: true },
    { label: 'Continue', sub: world ? world.name : last ? `${last.name} · ${last.date}` : 'No campaign yet', action: () => void cont(), disabled: !world && !last },
    { label: 'Load Game', sub: 'Your saved universes', action: () => navigate('/saves') },
    { label: 'What If History', sub: 'Rewrite pivotal moments', action: () => navigate('/scenarios') },
    { label: 'Battlefield', sub: 'Fight in person with the weapons of your age', action: () => navigate('/battle') },
    { label: 'Imperial Sandbox', sub: 'Forge your own empire', action: () => navigate('/sandbox') },
    { label: 'World Explorer', sub: '2,500 years of borders', action: () => navigate('/explorer') },
    { label: 'Multiplayer', sub: 'Shared turn-based worlds', action: () => navigate('/multiplayer') },
    { label: 'Scenario Library', sub: 'Curated, custom & community', action: () => navigate('/library') },
  ];
  const key = GLOBE_ERAS[eraIdx];
  const year = MAP_YEARS.find((m) => m.key === key)!.year;
  const sc = SCENARIOS[featured];

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <Starfield />
      <AnimatePresence>{splash && <Splash onDone={endSplash} />}</AnimatePresence>

      {/* globe */}
      <div className="absolute inset-y-0 right-0 flex w-full items-center justify-center lg:w-[58%]">
        <AnimatePresence mode="wait">
          <motion.div key={key} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 1.6 }} className="relative opacity-40 lg:opacity-100">
            <Globe mapKey={key} size={size} speed={5} />
          </motion.div>
        </AnimatePresence>
        <div className="pointer-events-none absolute bottom-[7%] hidden text-center lg:block">
          <div className="font-display text-[10px] uppercase tracking-[0.45em] text-gold-300/70">{tr('The known world')}</div>
          <AnimatePresence mode="wait"><motion.div key={year} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="font-deco gold-text text-3xl font-bold">{formatYear(year)}</motion.div></AnimatePresence>
          <div className="mt-1 text-[11px] text-parchment-300/50">{tr('Documented borders · drag to rotate')}</div>
        </div>
      </div>

      {/* left column */}
      <div className="absolute inset-y-0 left-0 z-10 flex w-full flex-col justify-center px-6 sm:px-12 lg:w-[46%] lg:px-20" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.6) 60%, transparent 100%)' }}>
        <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: splash ? 0 : 1, x: splash ? -40 : 0 }} transition={{ duration: 1.1, delay: 0.2 }}>
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.5em] text-gold-400/90">{tr('Alternative History Grand Strategy')}</div>
          <h1 className="font-deco gold-shine mt-2 text-7xl font-black leading-none md:text-[104px]">What If?</h1>
          <OrnateDivider className="mt-4 max-w-sm" />
          <nav className="mt-8 flex flex-col">
            {items.map((it, i) => (
              <motion.button key={it.label} disabled={it.disabled} initial={{ opacity: 0, x: -20 }} animate={{ opacity: splash ? 0 : 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}
                onMouseEnter={() => { if (!it.disabled) { setHover(i); sfx('hover'); } }} onMouseLeave={() => setHover(null)} onClick={() => { sfx('select'); it.action(); }}
                className="group relative flex items-center gap-4 py-2 text-left disabled:opacity-35">
                <span className={cx('h-2.5 w-2.5 rotate-45 border transition-all duration-300', hover === i ? 'scale-125 border-gold-100 bg-gold-300 shadow-[0_0_12px_rgba(243,214,122,.9)]' : 'border-gold-600/70 bg-transparent')} />
                <span>
                  <span className={cx('block font-display font-bold uppercase tracking-[0.18em] transition-all duration-300', it.primary ? 'text-2xl' : 'text-lg', hover === i ? 'translate-x-1 text-gold-50 [text-shadow:0_0_18px_rgba(243,214,122,.6)]' : it.primary ? 'text-gold-200' : 'text-parchment-100/85')}>{tr(it.label)}</span>
                  <span className={cx('block overflow-hidden text-xs text-parchment-300/60 transition-all duration-300', hover === i ? 'max-h-5 opacity-100' : 'max-h-0 opacity-0')}>{tr(it.sub)}</span>
                </span>
                <span className={cx('absolute -bottom-px left-7 h-px bg-gradient-to-r from-gold-300 to-transparent transition-all duration-500', hover === i ? 'w-72' : 'w-0')} />
              </motion.button>
            ))}
          </nav>
        </motion.div>
      </div>

      {/* featured scenario */}
      <AnimatePresence mode="wait">
        {!splash && (
          <motion.div key={sc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.6 }} className="absolute bottom-20 right-6 z-10 hidden w-80 xl:block">
            <Link to={`/scenarios/${sc.id}`} className="panel block p-4 transition hover:shadow-glow">
              <div className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-gold-400">{tr('Featured scenario')}</div>
              <div className="title-display mt-1 text-sm text-gold-50">{tr(sc.title)}</div>
              <div className="mt-1 font-serif text-[15px] italic leading-snug text-parchment-100/90">{tr(sc.question)}</div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* bottom bar */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-gold-600/20 bg-black/60 px-4 py-2.5 backdrop-blur sm:px-8">
        <Link to="/profile" className="flex items-center gap-2 text-sm text-parchment-100 hover:text-gold-100"><span className="nav-icon !h-9 !w-9"><User className="h-4 w-4" /></span><span className="hidden sm:inline">{name}</span></Link>
        {last?.playerFlag && <span className="hidden items-center gap-2 text-xs text-parchment-300/70 md:flex"><Flag flag={last.playerFlag} className="h-4 w-6" />{tr('Last:')} {last.playerName} · {last.date}</span>}
        <div className="ml-auto flex items-center gap-2">
          <LangSwitch />
          <button onClick={toggleMusic} className="nav-icon !h-9 !w-9" title={tr(musicOn ? 'Music on' : 'Music off')}>{musicOn ? <Music className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
          <Link to="/achievements" className="nav-icon !h-9 !w-9" title={tr('Achievements')}><Award className="h-4 w-4" /></Link>
          <Link to="/settings" className="nav-icon !h-9 !w-9" title={tr('Settings')}><Settings className="h-4 w-4" /></Link>
          <span className="ml-2 hidden font-mono text-[10px] text-parchment-300/40 sm:inline">v1.1 · borders: historical-basemaps (GPL-3.0)</span>
        </div>
      </div>
    </div>
  );
}
