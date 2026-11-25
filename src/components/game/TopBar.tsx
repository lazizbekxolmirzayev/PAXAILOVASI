import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Coins, Menu, Pause, Play, Shield, Wheat, Castle } from 'lucide-react';
import { useGame, type Speed } from '../../store/game';
import { Flag } from '../ui/Flag';
import { cx } from '../ui';
import { countryStats, rtOf } from '../../engine/rt';
import { fmtNum } from '../../engine/util';
import { useN, useT } from '../../i18n';

/** Real-time clock: ticks the world ~4 times per wall-clock second, scaled by the chosen speed. */
export function useGameClock(): void {
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(2, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      useGame.getState().step(dt);
    }, 250);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const st = useGame.getState();
      if (e.code === 'Space') { e.preventDefault(); st.setSpeed(st.speed ? 0 : 1); }
      if (e.code === 'Escape') { if (st.mission) st.cancelMission(); }
      const map: Record<string, Speed> = { Digit1: 1, Digit2: 2, Digit3: 5, Digit4: 10 };
      if (map[e.code]) st.setSpeed(map[e.code]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

function Res({ icon, value, delta, title, tone }: { icon: React.ReactNode; value: string; delta?: string; title: string; tone?: 'good' | 'bad' }) {
  return (
    <div title={title} className="flex items-center gap-1.5 rounded bg-ink-950/60 px-2 py-1 ring-1 ring-gold-700/30">
      <span className="text-gold-300">{icon}</span>
      <span className="stat-num text-[13px] font-semibold text-parchment-50">{value}</span>
      {delta && <span className={cx('stat-num text-[11px]', tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-blood-400' : 'text-parchment-300/60')}>{delta}</span>}
    </div>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  useGame((s) => s.version);
  const t = useT();
  const n = useN();
  const w = useGame((s) => s.world)!;
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const c = w.player ? w.countries[w.player] : null;
  const s = c && w.player ? countryStats(w, w.player) : null;
  const sec = Math.floor(rtOf(w).t);
  const clock = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 border-b border-gold-600/30 bg-gradient-to-b from-ink-850/95 to-ink-950/90 px-3 py-2 shadow-panel backdrop-blur">
      <button onClick={onMenu} className="nav-icon !h-9 !w-9" aria-label={t('Game menu')}><Menu className="h-4 w-4" /></button>
      {c ? (
        <Link to="/game/country" className="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-ink-800">
          <Flag flag={c.flag} className="h-7 w-10 rounded-sm" title={n(c.name)} />
          <div className="leading-tight">
            <div className="title-display max-w-[180px] truncate text-[12px] text-gold-100">{n(c.name)}</div>
            <div className="text-[10px] text-parchment-300/60">{t(c.ruler.title)} {n(c.ruler.name)}</div>
          </div>
        </Link>
      ) : <div className="title-display text-xs text-parchment-300">{t('Observer mode')}</div>}
      {s && c?.alive && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Res icon={<Castle className="h-3.5 w-3.5" />} value={fmtNum(s.cities)} title={t('Cities')} />
          <Res icon={<Coins className="h-3.5 w-3.5" />} value={fmtNum(Math.round(s.gold))} delta={`+${fmtNum(Math.round(s.goldPerMin))}/${t('min')}`} tone="good" title={t('Gold and income per minute')} />
          <Res icon={<Wheat className="h-3.5 w-3.5" />} value={fmtNum(Math.round(s.food))} delta={`+${fmtNum(Math.round(s.foodPerMin))}/${t('min')}`} tone="good" title={t('Food and income per minute')} />
          <Res icon={<Shield className="h-3.5 w-3.5" />} value={fmtNum(Math.round(s.soldiers))} title={t('Soldiers')} />
          {s.ships > 0 && <Res icon={<Anchor className="h-3.5 w-3.5" />} value={fmtNum(Math.round(s.ships))} title={t('Fleet')} />}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <div className="text-right leading-tight">
          <div className="title-display text-[13px] text-gold-100">{t('Year')} {w.date.y}</div>
          <div className="stat-num text-[10px] text-parchment-300/60">{clock} · {speed ? `${speed}×` : t('Paused')}</div>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-ink-950/70 p-1 ring-1 ring-gold-700/40">
          <button className={cx('rounded p-1.5', speed === 0 ? 'bg-gold-400 text-ink-950' : 'text-gold-200 hover:bg-ink-800')} onClick={() => setSpeed(0)} title={t('Pause (Space)')}><Pause className="h-3.5 w-3.5" /></button>
          {([1, 2, 5, 10] as Speed[]).map((x) => (
            <button key={x} className={cx('stat-num rounded px-1.5 py-1 text-[11px] font-bold', speed === x ? 'bg-gold-400 text-ink-950' : 'text-gold-200 hover:bg-ink-800')} onClick={() => setSpeed(x)} title={`${x}× ${t('speed')}`}>{x === 1 ? <Play className="h-3.5 w-3.5" /> : `${x}×`}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
