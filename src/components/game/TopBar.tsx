import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Coins, FlaskConical, HeartPulse, Pause, Play, Shield, SkipForward, Users, Wheat, Scale, FastForward, Menu } from 'lucide-react';
import { useGame, type Speed } from '../../store/game';
import { useHotseat, endTurnOnline } from '../../services/multiplayer';
import { ShieldFlag } from '../ui/Flag';
import { cx } from '../ui';
import { fmtDate } from '../../engine/date';
import { fmtNum } from '../../engine/util';
import { techLevel } from '../../data/technologies';
import { tr } from '../../i18n';
import { LangSwitch } from '../ui/LangSwitch';

const MONTH_MS: Record<Exclude<Speed, 0>, number> = { 1: 2000, 2: 1000, 5: 400, 10: 160 };

/** Simulation clock: drives monthly ticks at the selected speed. */
export function useGameClock(): void {
  const speed = useGame((s) => s.speed);
  const acc = useRef(0);
  useEffect(() => {
    if (!speed) return;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      acc.current += t - last; last = t;
      const st = useGame.getState();
      if (!st.busy && st.remote?.mode !== 'online' && acc.current >= MONTH_MS[speed as Exclude<Speed, 0>]) {
        acc.current = 0;
        const w = st.world;
        const blocked = w && w.player && w.events.pending.some((e) => e.country === w.player);
        if (!blocked) st.tick(1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const st = useGame.getState();
      if (e.code === 'Space') { e.preventDefault(); st.setSpeed(st.speed ? 0 : 1); }
      const map: Record<string, Speed> = { Digit1: 1, Digit2: 2, Digit3: 5, Digit4: 10 };
      if (map[e.code]) st.setSpeed(map[e.code]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

function Res({ icon, value, delta, title, tone }: { icon: React.ReactNode; value: string; delta?: string; title: string; tone?: 'good' | 'bad' }) {
  return (
    <div title={title} className="hud-res group">
      <span className="flex h-6 w-6 items-center justify-center rounded-full text-gold-100" style={{ background: 'radial-gradient(circle at 50% 30%, #3b4a72, #0b0f19)', boxShadow: '0 0 0 1.5px #a97f2a, 0 0 0 2.5px #1b1208' }}>{icon}</span>
      <span className="stat-num text-[13px] font-bold text-parchment-50 [text-shadow:0_1px_0_#000]">{value}</span>
      {delta && <span className={cx('stat-num text-[10.5px]', tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-blood-400' : 'text-parchment-300/60')}>{delta}</span>}
    </div>
  );
}

/** Ornate calendar dial: 12 month segments with the current one lit. */
function DateDial({ month }: { month: number }) {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11" aria-hidden>
      <defs><linearGradient id="dd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3c9" /><stop offset=".5" stopColor="#a97f2a" /><stop offset="1" stopColor="#e8d08a" /></linearGradient></defs>
      <circle cx="22" cy="22" r="20.5" fill="#0b0f19" stroke="url(#dd)" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const a0 = ((i * 30 - 90) * Math.PI) / 180, a1 = (((i + 1) * 30 - 92) * Math.PI) / 180;
        const r0 = 12, r1 = 17.5;
        const d = `M${22 + r0 * Math.cos(a0)} ${22 + r0 * Math.sin(a0)} L${22 + r1 * Math.cos(a0)} ${22 + r1 * Math.sin(a0)} A${r1} ${r1} 0 0 1 ${22 + r1 * Math.cos(a1)} ${22 + r1 * Math.sin(a1)} L${22 + r0 * Math.cos(a1)} ${22 + r0 * Math.sin(a1)} A${r0} ${r0} 0 0 0 ${22 + r0 * Math.cos(a0)} ${22 + r0 * Math.sin(a0)} Z`;
        return <path key={i} d={d} fill={i < month ? '#7a5718' : i === month ? '#f3d27a' : '#1c2438'} stroke="#05070c" strokeWidth=".6" />;
      })}
      <circle cx="22" cy="22" r="9.5" fill="url(#dd)" stroke="#1b1208" />
      <path d="M22 15 L24 22 L22 29 L20 22 Z" fill="#1b1208" transform={`rotate(${month * 30 + 15} 22 22)`} />
    </svg>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const advance = useGame((s) => s.advance);
  const busy = useGame((s) => s.busy);
  const remote = useGame((s) => s.remote);
  const c = w.player ? w.countries[w.player] : null;
  const online = remote?.mode === 'online';
  return (
    <div className="hud-bar pointer-events-auto flex flex-wrap items-center gap-2 px-3 py-1.5">
      <button onClick={onMenu} className="nav-icon !h-10 !w-10" aria-label={tr('Game menu')}><Menu className="h-4 w-4" /></button>
      {c ? (
        <Link to="/game/country" className="group -my-1 flex items-center gap-2.5 rounded px-1.5 hover:bg-white/5">
          <ShieldFlag flag={c.flag} className="h-14 w-12 drop-shadow-[0_4px_6px_rgba(0,0,0,.8)] transition group-hover:scale-105" title={c.name} />
          <div className="leading-tight">
            <div className="font-deco max-w-[200px] truncate text-[15px] font-bold text-gold-100 [text-shadow:0_1px_0_#000]">{c.name}</div>
            <div className="text-[10.5px] italic text-parchment-300/70">{tr(c.ruler.title)} {c.ruler.name}</div>
          </div>
        </Link>
      ) : <div className="title-display text-xs text-parchment-300">{tr('Observer mode')}</div>}
      {c && c.alive && (
        <div className="ml-2 flex flex-wrap items-center gap-1.5">
          <Res icon={<Coins className="h-3.5 w-3.5" />} value={fmtNum(c.economy.treasury)} delta={`${c.economy.lastBalance >= 0 ? '+' : ''}${fmtNum(c.economy.lastBalance)}`} tone={c.economy.lastBalance >= 0 ? 'good' : 'bad'} title={tr('Treasury and monthly balance')} />
          <Res icon={<Users className="h-3.5 w-3.5" />} value={fmtNum(c.pop.total)} delta={`${(c.pop.growthRate * 100).toFixed(1)}%`} tone={c.pop.growthRate >= 0 ? 'good' : 'bad'} title={tr('Population and annual growth')} />
          <Res icon={<Wheat className="h-3.5 w-3.5" />} value={`${(c.food.stock / Math.max(1, c.food.consumption)).toFixed(1)}m`} delta={c.food.shortage > 0 ? 'famine' : undefined} tone="bad" title={tr('Food stock in months of consumption')} />
          <Res icon={<Scale className="h-3.5 w-3.5" />} value={`${Math.round(c.stability.value)}`} tone={c.stability.value < 35 ? 'bad' : 'good'} title={tr('Stability (0–100)')} />
          <Res icon={<Shield className="h-3.5 w-3.5" />} value={`${c.military.regiments.toFixed(0)}k`} delta={`${Math.round(c.military.morale * 100)}%`} title={tr('Army (thousands) and morale')} />
          <Res icon={<FlaskConical className="h-3.5 w-3.5" />} value={techLevel(c.tech.known).toFixed(2)} title={tr('Technology level')} />
          {c.health.epidemic && <Res icon={<HeartPulse className="h-3.5 w-3.5" />} value="Epidemic" tone="bad" title={c.health.epidemic.name} />}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2.5">
        <LangSwitch compact />
        {remote && <EndTurn />}
        <div className="hud-res !gap-3 !py-1 !pl-1.5 !pr-3">
          <DateDial month={w.date.m} />
          <div className="leading-tight">
            <div className="font-deco text-[16px] font-bold text-gold-100 [text-shadow:0_1px_0_#000]">{fmtDate(w.date)}</div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-parchment-300/60">{online ? `Turn-based · ${remote?.roomId}` : speed ? <>{tr('Speed')} {[1, 2, 5, 10].map((v) => <span key={v} className={cx('inline-block h-2 w-1.5 rounded-[1px]', speed >= v ? 'bg-gold-300 shadow-[0_0_6px_#f3d27a]' : 'bg-ink-600')} />)}</> : <span className="text-blood-400">{tr('Paused')}</span>}</div>
          </div>
        </div>
        {!online && (
          <div className="flex items-center gap-1">
            <button className={cx('nav-icon !h-9 !w-9', speed === 0 && 'active')} onClick={() => setSpeed(0)} title={tr('Pause (Space)')}><Pause className="h-3.5 w-3.5" /></button>
            {([1, 2, 5, 10] as Speed[]).map((s) => (
              <button key={s} className={cx('nav-icon !h-9 !w-9 stat-num text-[11px] font-bold', speed === s && 'active')} onClick={() => setSpeed(s)} title={`${s}× speed`}>{s === 1 ? <Play className="h-3.5 w-3.5" /> : `${s}×`}</button>
            ))}
            <span className="mx-1 h-7 w-px bg-gradient-to-b from-transparent via-gold-500 to-transparent" />
            <button disabled={busy} className="btn-ghost !px-2 !py-1 !text-[11px]" onClick={() => void advance(1)} title={tr('Advance one month')}><SkipForward className="h-3.5 w-3.5" />1m</button>
            <button disabled={busy} className="btn-ghost !px-2 !py-1 !text-[11px]" onClick={() => void advance(12)} title={tr('Advance one year')}><FastForward className="h-3.5 w-3.5" />1y</button>
            <button disabled={busy} className="btn-ghost !px-2 !py-1 !text-[11px]" onClick={() => void advance(120)} title={tr('Advance a decade')}>10y</button>
          </div>
        )}
      </div>
    </div>
  );
}

function EndTurn() {
  const remote = useGame((s) => s.remote)!;
  const busy = useGame((s) => s.busy);
  const toast = useGame((s) => s.toast);
  const hs = useHotseat();
  const label = remote.mode === 'hotseat' ? `${tr('End turn')} · ${hs.players[hs.current]?.name ?? ''}` : tr('End turn');
  return (
    <button disabled={busy} className="btn-gold !py-1.5 !text-xs" onClick={() => {
      if (remote.mode === 'hotseat') void hs.endTurn();
      else void endTurnOnline(remote.roomId).then((r) => toast(r.advanced ? 'Turn resolved by the server.' : 'Turn submitted — waiting for other players.', 'info')).catch((e) => toast(e.message, 'bad'));
    }}>{label}</button>
  );
}
