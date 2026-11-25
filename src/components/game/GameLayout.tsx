import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpenText, Bot, Building2, Coins, Crown, FlaskConical, GitCompareArrows, Handshake, HeartPulse, History, Layers, ScrollText, Shield, Users, Wheat, X, Save, LogOut, Settings as SettingsIcon, FolderOpen, Download } from 'lucide-react';
import { useGame } from '../../store/game';
import { GameMap } from './GameMap';
import { TopBar, useGameClock } from './TopBar';
import { CountryPanel } from './CountryPanel';
import { EventModal } from './EventModal';
import { Outliner } from './Outliner';
import { Button, Modal, cx } from '../ui';
import { MAP_MODES } from '../../lib/mapColors';
import { saveWorld, downloadSaveFile } from '../../services/saves';
import { Filigree, CompassRose, Cartouche } from '../ui/Ornament';
import { sfx } from '../../services/audio';
import { fmtYear } from '../../engine/date';
import { tr } from '../../i18n';

export const GAME_NAV = [
  { to: '/game/country', label: 'Country', icon: Crown },
  { to: '/game/economy', label: 'Economy', icon: Coins },
  { to: '/game/population', label: 'Population', icon: Users },
  { to: '/game/food', label: 'Food & Agriculture', icon: Wheat },
  { to: '/game/health', label: 'Health', icon: HeartPulse },
  { to: '/game/technology', label: 'Technology', icon: FlaskConical },
  { to: '/game/infrastructure', label: 'Infrastructure', icon: Building2 },
  { to: '/game/diplomacy', label: 'Diplomacy', icon: Handshake },
  { to: '/game/military', label: 'Military', icon: Shield },
  { to: '/game/events', label: 'Historical Events', icon: ScrollText },
  { to: '/game/timeline', label: 'Timeline', icon: History },
  { to: '/game/compare', label: 'Timeline Comparison', icon: GitCompareArrows },
  { to: '/game/historian', label: 'AI Historian', icon: Bot },
];

const DOCK = ['/game/country', '/game/economy', '/game/military', '/game/diplomacy', '/game/technology', '/game/historian'];

export function GameLayout() {
  useGameClock();
  const world = useGame((s) => s.world);
  const navigate = useNavigate();
  const loc = useLocation();
  const [panel, setPanel] = useState(true);
  const [menu, setMenu] = useState(false);
  const [modes, setModes] = useState(false);
  const mapMode = useGame((s) => s.mapMode);
  const setMapMode = useGame((s) => s.setMapMode);
  const selected = useGame((s) => s.selectedProvince);
  const curYear = useGame((s) => s.world?.date.y ?? 0);
  const subpage = loc.pathname !== '/game' && loc.pathname !== '/game/';

  useEffect(() => { if (!world) navigate('/new', { replace: true }); }, [world, navigate]);
  useEffect(() => { if (selected !== null) setPanel(true); }, [selected]);
  if (!world) return null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink-950">
      <GameMap />
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <TopBar onMenu={() => setMenu(true)} />
        <div className="relative flex min-h-0 flex-1">
          <nav className="pointer-events-auto hidden flex-col gap-1.5 overflow-y-auto p-2 md:flex">
            {GAME_NAV.filter((n) => !DOCK.includes(n.to)).map((n) => (
              <NavLink key={n.to} to={n.to} title={tr(n.label)} onMouseEnter={() => sfx('hover')} onClick={() => sfx('page')} className={({ isActive }) => cx('nav-icon', isActive && 'active')}><n.icon className="h-[18px] w-[18px]" /></NavLink>
            ))}
          </nav>
          <div className="relative flex min-w-0 flex-1 gap-3 p-2 md:p-3">
            <AnimatePresence>
              {subpage && (
                <motion.div key="page" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                  className="panel pointer-events-auto absolute inset-2 z-10 flex flex-col md:inset-auto md:bottom-24 md:left-3 md:top-3 md:w-[min(940px,calc(100%-400px))]">
                  <Filigree />
                  <div className="relative flex items-center justify-center border-b border-gold-600/25 px-5 pb-2.5 pt-3" style={{ background: 'linear-gradient(180deg, rgba(217,182,92,.08), transparent)' }}>
                    <span className="ribbon">{tr(GAME_NAV.find((n) => loc.pathname.startsWith(n.to))?.label ?? '')}</span>
                    <button onClick={() => navigate('/game')} className="nav-icon absolute right-4 !h-8 !w-8" aria-label={tr('Close')}><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="scroll-thin flex-1 overflow-y-auto rounded-b-lg p-5"><Outlet /></div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="ml-auto flex max-h-full flex-col items-end gap-3">
              <Outliner />
              {panel && <div className="min-h-0 flex-1"><CountryPanel onClose={() => setPanel(false)} /></div>}
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 md:block">
          <div className="pointer-events-auto relative flex items-end gap-2 rounded-2xl px-5 pb-2.5 pt-3" style={{ border: '1.5px solid transparent', background: 'var(--noise) padding-box, linear-gradient(180deg,#1d2438,#07090f) padding-box, var(--gold-border) border-box', boxShadow: '0 14px 40px -6px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,240,200,.1)' }}>
            {GAME_NAV.filter((n) => DOCK.includes(n.to)).map((n) => (
              <NavLink key={n.to} to={n.to} onMouseEnter={() => sfx('hover')} onClick={() => sfx('page')} className="group flex flex-col items-center gap-1">
                {({ isActive }) => <>
                  <span className={cx('nav-icon !h-14 !w-14', isActive && 'active')}><n.icon className="h-6 w-6" /></span>
                  <span className={cx('font-display text-[9.5px] font-bold uppercase tracking-[0.12em] transition', isActive ? 'text-gold-50' : 'text-parchment-300/60 group-hover:text-gold-100')}>{n.label === 'AI Historian' ? tr('Historian') : tr(n.label)}</span>
                </>}
              </NavLink>
            ))}
            <span className="mx-1 mb-6 h-10 w-px bg-gradient-to-b from-transparent via-gold-500 to-transparent" />
            <button onClick={() => { sfx('click'); setModes(!modes); }} className="group flex flex-col items-center gap-1">
              <span className={cx('nav-icon !h-14 !w-14', modes && 'active')}><Layers className="h-6 w-6" /></span>
              <span className="font-display text-[9.5px] font-bold uppercase tracking-[0.12em] text-parchment-300/60 group-hover:text-gold-100">{tr('Map modes')}</span>
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-4 left-20 z-0 hidden flex-col items-center gap-1 opacity-90 lg:flex">
          <CompassRose className="h-24 w-24 drop-shadow-[0_4px_10px_rgba(0,0,0,.8)]" />
          <Cartouche title={tr('Orbis Terrarum')} subtitle={`Anno ${fmtYear(curYear)}`} />
        </div>
        <div className="pointer-events-auto flex gap-1 overflow-x-auto px-2 pb-2 md:hidden">
          {GAME_NAV.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('nav-icon shrink-0 !h-10 !w-10', isActive && 'active')}><n.icon className="h-4 w-4" /></NavLink>)}
          <button onClick={() => setModes(!modes)} className="nav-icon shrink-0 !h-10 !w-10"><Layers className="h-4 w-4" /></button>
        </div>
        {modes && (
          <div className="panel pointer-events-auto absolute bottom-16 left-3 z-30 w-80 p-3 md:bottom-28 md:left-1/2 md:-translate-x-1/2">
            <div className="label">{tr('Map mode')}</div>
            <div className="grid grid-cols-3 gap-1">
              {MAP_MODES.map((m) => <button key={m.id} onClick={() => setMapMode(m.id)} className={cx('rounded px-2 py-1.5 text-[11px] font-semibold', mapMode === m.id ? 'bg-gold-400 text-ink-950' : 'bg-ink-950/60 text-parchment-200 hover:bg-ink-800')}>{tr(m.label)}</button>)}
            </div>
            <p className="mt-2 text-[11px] text-parchment-300/70">{tr(MAP_MODES.find((m) => m.id === mapMode)?.legend ?? '')}</p>
            <div className="mt-2 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#7c271f,#b8573a,#d9a55c,#cfc28a,#7fa87a,#3a8371)' }} />
          </div>
        )}
      </div>
      <EventModal />
      <GameMenu open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}

function GameMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const world = useGame((s) => s.world);
  const toast = useGame((s) => s.toast);
  const close = useGame((s) => s.closeGame);
  const remote = useGame((s) => s.remote);
  const [saving, setSaving] = useState(false);
  const quickSave = async () => {
    if (!world) return;
    setSaving(true);
    try { await saveWorld(world, `quick-${world.id}`, `${world.name} — quicksave`); toast('Game saved.', 'good'); } catch (e) { toast(`Save failed: ${(e as Error).message}`, 'bad'); }
    setSaving(false);
  };
  return (
    <Modal open={open} onClose={onClose} title={tr('Game menu')}>
      <div className="grid gap-2">
        <Button variant="gold" icon={<Save className="h-4 w-4" />} loading={saving} disabled={remote?.mode === 'online'} onClick={() => void quickSave()}>{tr('Quick save')}</Button>
        <Button icon={<FolderOpen className="h-4 w-4" />} onClick={() => navigate('/saves')}>{tr('Save / load…')}</Button>
        <Button icon={<Download className="h-4 w-4" />} onClick={() => world && downloadSaveFile(world)}>{tr('Export save file')}</Button>
        <Button icon={<BookOpenText className="h-4 w-4" />} onClick={() => { onClose(); navigate('/game/timeline'); }}>{tr('Chronicle of this world')}</Button>
        <Button icon={<SettingsIcon className="h-4 w-4" />} onClick={() => navigate('/settings')}>{tr('Settings')}</Button>
        <Button variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={() => { if (world) void saveWorld(world, 'autosave', 'Autosave', true); close(); navigate('/'); }}>Exit to main menu (autosaves)</Button>
      </div>
      <p className="mt-3 text-[11px] text-parchment-300/60">Shortcuts: Space = pause/resume · 1–4 = speed 1×/2×/5×/10×</p>
    </Modal>
  );
}
