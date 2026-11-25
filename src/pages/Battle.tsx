// Battlefield: the player's ruler fights in person in a real-time 2D battle. Launched from a war
// in the campaign (results feed back into the simulation) or as a standalone historical skirmish.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, Bomb, Crosshair, Flag as FlagIcon, Footprints, Keyboard, Pause, Play, Rocket, RotateCcw, Shield, ShieldHalf, Swords, Target, Trophy, Users, Wind, Zap } from 'lucide-react';
import { useGame } from '../store/game';
import { tr } from '../i18n';
import { BERAS, CULTURE_LABEL, CULTURES, cultureFor, ERA_LABEL, eraOfYear, type BEra, type Culture } from '../battle/data';
import { createBattle, emptyInput, resultOf, step, VIEW_H, VIEW_W, type BattleConfig, type BattleResult, type BattleState, type Input, type Order, type Special, type Terrain } from '../battle/sim';
import { drawLineup, render, setQuality, type Quality } from '../battle/draw';
import { bsfx, startAmbience, stopAmbience } from '../battle/sound';
import { stopMusic } from '../services/audio';
import { committed, frontProvince } from '../engine/military';
import { Filigree, OrnateDivider } from '../components/ui/Ornament';
import { Banner } from '../components/art/SceneArt';
import { cx } from '../components/ui';
import type { World, MapStatic } from '../types/game';

// ------------------------------------------------------------------ presets
interface Preset { id: string; title: string; year: number; era: BEra; terrain: Terrain; time: BattleConfig['time']; a: { name: string; leader: string; color: string; culture: Culture }; b: { name: string; leader: string; color: string; culture: Culture }; ratio: number }
const PRESETS: Preset[] = [
  { id: 'ankara', title: 'Battle of Ankara', year: 1402, era: 'medieval', terrain: 'steppe', time: 'dusk', a: { name: 'Timurid Empire', leader: 'Amir Timur', color: '#3f7fb0', culture: 'steppe' }, b: { name: 'Ottoman Empire', leader: 'Bayezid I', color: '#9c2a24', culture: 'islamic' }, ratio: 1.25 },
  { id: 'gaugamela', title: 'Battle of Gaugamela', year: -331, era: 'ancient', terrain: 'desert', time: 'day', a: { name: 'Macedon', leader: 'Alexander', color: '#8a1f2b', culture: 'mediterranean' }, b: { name: 'Achaemenid Persia', leader: 'Darius III', color: '#c69b2a', culture: 'islamic' }, ratio: 0.8 },
  { id: 'cannae', title: 'Battle of Cannae', year: -216, era: 'classical', terrain: 'plains', time: 'day', a: { name: 'Carthage', leader: 'Hannibal', color: '#6b3a8a', culture: 'african' }, b: { name: 'Roman Republic', leader: 'Varro', color: '#a3241a', culture: 'mediterranean' }, ratio: 0.85 },
  { id: 'vienna', title: 'Battle of Vienna', year: 1683, era: 'renaissance', terrain: 'forest', time: 'dawn', a: { name: 'Poland–Lithuania', leader: 'Jan III Sobieski', color: '#c8303a', culture: 'european' }, b: { name: 'Ottoman Empire', leader: 'Kara Mustafa', color: '#2f6b3a', culture: 'islamic' }, ratio: 1.0 },
  { id: 'cajamarca', title: 'Cajamarca', year: 1532, era: 'renaissance', terrain: 'mountain', time: 'overcast', a: { name: 'Inca Empire', leader: 'Atahualpa', color: '#c7902a', culture: 'american' }, b: { name: 'Spanish expedition', leader: 'Francisco Pizarro', color: '#a3261e', culture: 'european' }, ratio: 1.8 },
  { id: 'waterloo', title: 'Battle of Waterloo', year: 1815, era: 'industrial', terrain: 'plains', time: 'overcast', a: { name: 'French Empire', leader: 'Napoleon', color: '#2b4a9a', culture: 'european' }, b: { name: 'Seventh Coalition', leader: 'Wellington', color: '#b8322a', culture: 'european' }, ratio: 1.0 },
  { id: 'kursk', title: 'Battle of Kursk', year: 1943, era: 'modern', terrain: 'steppe', time: 'overcast', a: { name: 'Soviet Union', leader: 'Rokossovsky', color: '#7a3a2a', culture: 'european' }, b: { name: 'German Reich', leader: 'Model', color: '#5a6066', culture: 'european' }, ratio: 1.15 },
];
const TERRAINS: Terrain[] = ['plains', 'steppe', 'desert', 'forest', 'mountain', 'snow'];
const TIMES: BattleConfig['time'][] = ['day', 'dawn', 'dusk', 'overcast'];
const TERRAIN_LABEL: Record<Terrain, string> = { plains: 'Plains', steppe: 'Steppe', desert: 'Desert', forest: 'Forest', mountain: 'Mountains', snow: 'Snow' };
const TIME_LABEL: Record<BattleConfig['time'], string> = { day: 'Day', dawn: 'Dawn', dusk: 'Dusk', overcast: 'Overcast' };
const SCENE_ERA: Record<BEra, string> = { ancient: 'ancient', classical: 'classical', medieval: 'medieval', renaissance: 'renaissance', industrial: 'industrial', modern: 'modern' };

function presetConfig(p: Preset, swap: boolean, seed: number): BattleConfig {
  const A = { ...p.a, strength: Math.sqrt(p.ratio) }, B = { ...p.b, strength: 1 / Math.sqrt(p.ratio) };
  const [x, y] = swap ? [B, A] : [A, B];
  return { era: p.era, terrain: p.terrain, time: p.time, title: p.title, seed, teams: [x, y] };
}

/** Builds the battle from the live campaign: era, cultures, terrain and army ratio come from the world. */
function campaignConfig(w: World, st: MapStatic, warId: string): BattleConfig | null {
  const war = w.wars.find((x) => x.id === warId && !x.ended);
  if (!war || !w.player) return null;
  const me = w.countries[w.player];
  const isAtt = war.attackers.includes(me.id);
  const enemy = w.countries[isAtt ? war.defenders[0] : war.attackers[0]];
  if (!enemy) return null;
  const mine = isAtt ? war.attackers : war.defenders, theirs = isAtt ? war.defenders : war.attackers;
  const target = frontProvince(w, mine, theirs, st) ?? w.provinces[enemy.capital];
  const year = w.date.y;
  const capA = w.provinces[me.capital], capB = w.provinces[enemy.capital];
  const terrain: Terrain = target?.desert ? 'desert' : target?.mountain ? 'mountain' : target && (Math.abs(target.lat) > 56 || ((w.date.m <= 1 || w.date.m === 11) && Math.abs(target.lat) > 44)) ? 'snow' : target?.region === 'centralasia' || target?.region === 'russia' ? 'steppe' : target && target.lat > 47 && target.region === 'europe' ? 'forest' : 'plains';
  const ratio = Math.max(0.05, committed(w, me, war)) / Math.max(0.05, committed(w, enemy, war));
  const seed = (w.date.y * 13 + w.date.m * 7 + war.battles.length * 31) >>> 0;
  return {
    era: eraOfYear(year), terrain, time: TIMES[seed % TIMES.length], seed,
    title: tr('Battle of {name}', { name: target?.name ?? enemy.name }),
    teams: [
      { name: me.name, color: me.color, culture: capA ? cultureFor(capA.region, year, capA.lat) : 'european', strength: Math.min(1.9, Math.max(0.5, Math.sqrt(ratio))), leader: me.ruler.name, countryId: me.id },
      { name: enemy.name, color: enemy.color === me.color ? '#9c2a24' : enemy.color, culture: capB ? cultureFor(capB.region, year, capB.lat) : 'european', strength: Math.min(1.9, Math.max(0.5, 1 / Math.sqrt(ratio))), leader: enemy.ruler.name, countryId: enemy.id },
    ],
  };
}

// ------------------------------------------------------------------ page
export default function BattlePage() {
  const [params] = useSearchParams();
  const warId = params.get('war');
  const world = useGame((s) => s.world);
  const st = useGame((s) => s.st);
  const navigate = useNavigate();
  const campaign = useMemo(() => (warId && world && st ? campaignConfig(world, st, warId) : null), [warId, world, st]);
  const [cfg, setCfg] = useState<BattleConfig | null>(null);
  const [runId, setRunId] = useState(0);
  useEffect(() => { stopMusic(); return () => stopAmbience(); }, []);
  if (warId && !campaign && !cfg) {
    return <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-ink-950 text-parchment-100"><p>{tr('That war is not active.')}</p><button className="btn btn-gold" onClick={() => navigate('/game/military')}>{tr('Return to the map')}</button></div>;
  }
  if (!cfg) return <BattleSetup campaign={campaign} onStart={(c) => { setCfg(c); setRunId((n) => n + 1); }} onBack={() => navigate(warId ? '/game/military' : '/')} />;
  return <BattleView key={runId} cfg={cfg} campaignWar={campaign ? warId : null} onRestart={() => setRunId((n) => n + 1)} onSetup={() => setCfg(null)} />;
}

// ------------------------------------------------------------------ setup
function Lineup({ cfg, className }: { cfg: BattleConfig; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useMemo(() => createBattle({ ...cfg, seed: cfg.seed || 1 }), [cfg]);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const pick = (team: 0 | 1) => {
      const roles = new Set<string>(); const out = [];
      for (const u of state.units) if (u.team === team && !u.isPlayer && !roles.has(u.role) && u.role !== 'standard') { roles.add(u.role); out.push(u); }
      return out.slice(0, 3);
    };
    const a = [...pick(0).slice(0, 2), state.player];
    const b = [state.units.find((u) => u.team === 1 && u.role === 'general')!, ...pick(1).slice(0, 2)].filter(Boolean).map((u) => ({ ...u, facing: -1 as const }));
    const loop = () => {
      const c = ref.current; if (!c) return;
      const t = (performance.now() - t0) / 1000;
      drawLineup(c, state, [...a.map((u) => ({ ...u, facing: 1 as const })), ...b], t, false);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [state]);
  return <canvas ref={ref} width={900} height={230} className={className} />;
}

function BattleSetup({ campaign, onStart, onBack }: { campaign: BattleConfig | null; onStart: (c: BattleConfig) => void; onBack: () => void }) {
  const [preset, setPreset] = useState<string>('ankara');
  const [swap, setSwap] = useState(false);
  const [custom, setCustom] = useState<BattleConfig | null>(null);
  const [mounted, setMounted] = useState(false);
  const [difficulty, setDifficulty] = useState<NonNullable<BattleConfig['difficulty']>>('normal');
  const presetCfg = useMemo(() => presetConfig(PRESETS.find((p) => p.id === preset)!, swap, 1402), [preset, swap]);
  const base = campaign ?? custom ?? presetCfg;
  const canMount = base.era !== 'industrial' && base.era !== 'modern';
  const cfg = useMemo(() => ({ ...base, heroMounted: canMount && mounted, difficulty }), [base, canMount, mounted, difficulty]);
  const edit = (patch: Partial<BattleConfig>) => setCustom({ ...base, ...patch });
  const editTeam = (i: 0 | 1, patch: Partial<BattleConfig['teams'][0]>) => { const teams = [...base.teams] as BattleConfig['teams']; teams[i] = { ...teams[i], ...patch }; setCustom({ ...base, teams }); };
  const go = () => { bsfx('horn', 0.9); onStart({ ...cfg, seed: campaign ? cfg.seed : Math.floor(Math.random() * 1e9) }); };
  return (
    <div className="fixed inset-0 overflow-y-auto bg-ink-950 text-parchment-100">
      <div className="pointer-events-none absolute inset-0 opacity-50"><Banner era={SCENE_ERA[cfg.era]} hue={30} className="h-full w-full" /></div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/40 via-ink-950/80 to-ink-950" />
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <button onClick={onBack} className="text-xs uppercase tracking-[0.25em] text-gold-300/80 hover:text-gold-100">← {tr(campaign ? 'Return to the map' : 'Main menu')}</button>
        <div className="mt-4 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.45em] text-gold-400/80">{tr(campaign ? 'Lead the battle in person' : 'Battlefield')}</div>
          <h1 className="font-deco mt-2 text-4xl gold-shine md:text-5xl">{campaign ? cfg.title : tr('Take the field yourself')}</h1>
          <OrnateDivider className="mx-auto mt-3 w-72" />
          <p className="mx-auto mt-3 max-w-2xl text-sm text-parchment-200/80">{tr('You are the ruler on the battlefield. Fight with the weapons of your age — swords and bows, muskets and cannon, rifles and grenades — while your army fights around you. Kill the enemy commander or break their morale to win.')}</p>
        </div>

        {!campaign && (
          <div className="mt-6">
            <div className="label mb-2">{tr('Famous battles')}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => { setPreset(p.id); setCustom(null); }} className={cx('panel group relative overflow-hidden p-0 text-left transition hover:-translate-y-0.5', preset === p.id && !custom && 'ring-2 ring-gold-300')}>
                  <Banner era={SCENE_ERA[p.era]} hue={30} className="h-16 w-full" />
                  <div className="p-2"><div className="truncate text-xs font-semibold text-gold-100">{tr(p.title)}</div><div className="text-[10px] text-parchment-300/70">{p.year < 0 ? `${-p.year} ${tr('BC')}` : p.year}</div></div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="panel panel-ornate relative mt-6 p-5">
          <Filigree />
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
            {[0, 1].map((i) => {
              const tm = cfg.teams[i as 0 | 1];
              return (
                <div key={i} className={cx('flex items-center gap-3', i === 1 && 'md:order-3 md:flex-row-reverse md:text-right')}>
                  <div className="flex h-14 w-12 items-center justify-center rounded-b-[45%] rounded-t-md shadow-aaa ring-2 ring-gold-400/60" style={{ background: tm.color }}><Shield className="h-6 w-6 text-white/80" /></div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-gold-400/70">{tr(i === 0 ? 'You command' : 'Enemy')}</div>
                    <div className="title-display truncate text-lg text-gold-100">{tm.name}</div>
                    <div className="text-xs text-parchment-300/80">{tm.leader} · {tr(CULTURE_LABEL[tm.culture])} · {tr('Army')} ×{tm.strength.toFixed(2)}</div>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-col items-center gap-2 md:order-2">
              <Swords className="h-8 w-8 text-gold-300" />
              {!campaign && <button onClick={() => { if (custom) setCustom({ ...base, teams: [base.teams[1], base.teams[0]] }); else setSwap((v) => !v); }} className="flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-gold-300/80 hover:text-gold-100"><ArrowLeftRight className="h-3.5 w-3.5" />{tr('Swap sides')}</button>}
            </div>
          </div>
          <Lineup cfg={cfg} className="mt-3 h-[200px] w-full" />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs">
            <button disabled={!canMount} onClick={() => setMounted((v) => !v)} className={cx('flex items-center gap-2 rounded-full px-4 py-1.5 ring-1 transition disabled:opacity-40', mounted && canMount ? 'bg-gold-500/25 text-gold-100 ring-gold-300' : 'bg-ink-900/70 text-parchment-200 ring-gold-600/30 hover:ring-gold-400')}>🐎 {tr('Fight on horseback')}</button>
            <div className="flex overflow-hidden rounded-full ring-1 ring-gold-600/40">
              {(['easy', 'normal', 'hard'] as const).map((d) => <button key={d} onClick={() => setDifficulty(d)} className={cx('px-3 py-1.5 transition', difficulty === d ? 'bg-gold-500/30 text-gold-50' : 'bg-ink-900/70 text-parchment-300 hover:text-gold-100')}>{tr(d === 'easy' ? 'Easy' : d === 'normal' ? 'Normal' : 'Hard')}</button>)}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-parchment-300/80">
            <span className="rounded-full bg-ink-900/70 px-3 py-1 ring-1 ring-gold-600/30">{tr(ERA_LABEL[cfg.era])}</span>
            <span className="rounded-full bg-ink-900/70 px-3 py-1 ring-1 ring-gold-600/30">{tr(TERRAIN_LABEL[cfg.terrain])}</span>
            <span className="rounded-full bg-ink-900/70 px-3 py-1 ring-1 ring-gold-600/30">{tr(TIME_LABEL[cfg.time])}</span>
          </div>
        </div>

        {!campaign && (
          <details className="panel mt-4 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gold-200">{tr('Custom battle')}</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-xs"><span className="label">{tr('Era')}</span><select className="input" value={cfg.era} onChange={(e) => edit({ era: e.target.value as BEra })}>{BERAS.map((e) => <option key={e} value={e}>{tr(ERA_LABEL[e])}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs"><span className="label">{tr('Terrain')}</span><select className="input" value={cfg.terrain} onChange={(e) => edit({ terrain: e.target.value as Terrain })}>{TERRAINS.map((x) => <option key={x} value={x}>{tr(TERRAIN_LABEL[x])}</option>)}</select></label>
                <label className="text-xs"><span className="label">{tr('Time of day')}</span><select className="input" value={cfg.time} onChange={(e) => edit({ time: e.target.value as BattleConfig['time'] })}>{TIMES.map((x) => <option key={x} value={x}>{tr(TIME_LABEL[x])}</option>)}</select></label>
              </div>
              {[0, 1].map((i) => {
                const tm = cfg.teams[i as 0 | 1];
                return (
                  <div key={i} className="rounded-lg bg-ink-950/50 p-3 ring-1 ring-gold-700/30">
                    <div className="label">{tr(i === 0 ? 'Your army' : 'Enemy army')}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input" value={tm.name} onChange={(e) => editTeam(i as 0 | 1, { name: e.target.value })} />
                      <input className="input" value={tm.leader} onChange={(e) => editTeam(i as 0 | 1, { leader: e.target.value })} />
                      <select className="input" value={tm.culture} onChange={(e) => editTeam(i as 0 | 1, { culture: e.target.value as Culture })}>{CULTURES.map((c) => <option key={c} value={c}>{tr(CULTURE_LABEL[c])}</option>)}</select>
                      <input type="color" className="h-9 w-full cursor-pointer rounded bg-transparent" value={tm.color} onChange={(e) => editTeam(i as 0 | 1, { color: e.target.value })} />
                    </div>
                    <label className="mt-2 block text-xs"><span className="label">{tr('Army size')} ×{tm.strength.toFixed(2)}</span><input type="range" min={0.5} max={1.9} step={0.05} value={tm.strength} onChange={(e) => editTeam(i as 0 | 1, { strength: Number(e.target.value) })} className="w-full accent-amber-400" /></label>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        <Controls className="mt-4" />
        <div className="mt-6 flex justify-center pb-10">
          <button onClick={go} className="btn btn-gold group flex items-center gap-3 px-10 py-4 text-lg"><Swords className="h-5 w-5 transition group-hover:rotate-12" />{tr('To battle!')}</button>
        </div>
      </div>
    </div>
  );
}

function Controls({ className }: { className?: string }) {
  const rows: [string, string][] = [['A / D · W / S', 'Move · step forward / back in the line'], ['Shift', 'Sprint (uses stamina)'], ['Space', 'Dodge roll (invulnerable for a moment)'], ['Left click', 'Attack / fire — hold to charge a heavy blow or draw a bow'], ['Right click (hold)', 'Block with weapon or shield — perfect timing parries; with firearms: aim down sights'], ['F', 'Shield bash / kick — staggers the enemy'], ['1–4 · Q · wheel', 'Switch weapon'], ['R', 'Reload'], ['G', 'Special: archer volley / gun barrage / artillery strike at the cursor'], ['E', 'Rally: horn call, +morale, inspire nearby troops'], ['Z · X · C', 'Orders: charge · hold the line · follow me'], ['Esc', 'Pause']];
  return (
    <div className={cx('panel p-4', className)}>
      <div className="label mb-2 flex items-center gap-2"><Keyboard className="h-3.5 w-3.5" />{tr('Controls')}</div>
      <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {rows.map(([k, v]) => <div key={k} className="flex items-center gap-2"><kbd className="min-w-[88px] rounded bg-ink-900 px-2 py-0.5 text-center font-mono text-[11px] text-gold-200 ring-1 ring-gold-700/40">{k}</kbd><span className="text-parchment-200/80">{tr(v)}</span></div>)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ live battle
interface Hud {
  hp: number; maxHp: number; dead: boolean; weapons: { name: string; kind: string; mag: number; magMax: number; ammo: number }[]; wi: number; reload: number;
  morale: [number, number]; troops: [number, number]; rally: number; kills: number; t: number;
  feed: BattleState['feed']; banner: BattleState['banner']; over: BattleState['over']; overT: number; draw: number;
  stamina: number; special: Special; specialCd: number; order: Order; intro: number; general: string; generalAlive: boolean; streak: number;
}
function snapshot(s: BattleState): Hud {
  const troops = [0, 1].map((tm) => s.units.filter((u) => u.team === tm && !u.dead && !u.routing).length + s.teams[tm].reserve) as [number, number];
  return {
    hp: s.player.hp, maxHp: s.player.maxHp, dead: s.player.dead, wi: s.player.wi, reload: s.player.reloadT > 0 ? 1 - s.player.reloadT / s.player.reloadDur : 0,
    weapons: s.player.weapons.map((w) => ({ name: w.def.name, kind: w.def.kind, mag: w.mag, magMax: w.def.mag ?? 0, ammo: w.ammo })),
    morale: [s.teams[0].morale, s.teams[1].morale], troops, rally: s.rallyCd, kills: s.playerKills, t: s.t,
    feed: [...s.feed], banner: s.banner ? { ...s.banner } : null, over: s.over, overT: s.overT, draw: s.player.draw,
    stamina: s.player.stamina, special: s.special, specialCd: s.specialCd, order: s.order, intro: s.intro, streak: s.streakT > 0 ? s.streak : 0,
    general: s.teams[1].cfg.leader, generalAlive: s.units.some((u) => u.team === 1 && u.role === 'general' && !u.dead),
  };
}
const RES_SCALE: Record<Quality, number> = { 0: 0.62, 1: 0.8, 2: 1 };
const PART_CAP: Record<Quality, number> = { 0: 320, 1: 600, 2: 900 };
const KIND_ICON: Record<string, typeof Swords> = { melee: Swords, bow: Target, crossbow: Target, sling: Wind, throw: Wind, gun: Crosshair, grenade: Bomb };

function BattleView({ cfg, campaignWar, onRestart, onSetup }: { cfg: BattleConfig; campaignWar: string | null; onRestart: () => void; onSetup: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const portraitRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<BattleState>(createBattle(cfg));
  const inputRef = useRef<Input>(emptyInput());
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState<Hud>(() => snapshot(stateRef.current));
  const [submitted, setSubmitted] = useState<null | { ok: boolean; message: string }>(null);
  const [showHelp, setShowHelp] = useState(true);
  const dispatch = useGame((s) => s.dispatch);
  const setSpeed = useGame((s) => s.setSpeed);
  const navigate = useNavigate();

  const setPause = useCallback((p: boolean) => { pausedRef.current = p; setPaused(p); }, []);
  const qualityRef = useRef<Quality>(2);
  const [qualityMode, setQualityMode] = useState<'auto' | Quality>(() => { try { const v = localStorage.getItem('whatif-battle-quality'); return v === '0' || v === '1' || v === '2' ? (Number(v) as Quality) : 'auto'; } catch { return 'auto'; } });
  const qualityModeRef = useRef(qualityMode); qualityModeRef.current = qualityMode;
  const [qualityShown, setQualityShown] = useState<Quality>(2);

  useEffect(() => {
    setSpeed(0);
    bsfx('horn', 0.9);
    startAmbience(cfg.era === 'modern' || cfg.era === 'industrial');
    const tid = window.setTimeout(() => setShowHelp(false), 11000);
    return () => { stopAmbience(); clearTimeout(tid); };
  }, [cfg.era, setSpeed]);

  // input
  useEffect(() => {
    const inp = inputRef.current;
    const keyMap: Record<string, keyof Input> = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', ShiftLeft: 'sprint', ShiftRight: 'sprint' };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { setPause(!pausedRef.current); return; }
      if (stateRef.current.intro > 0) { inp.skip = true; return; }
      if (e.code === 'Space') { inp.dodge = true; e.preventDefault(); }
      if (e.code === 'KeyG') inp.special = true;
      if (e.code === 'KeyZ') inp.order = 'charge';
      if (e.code === 'KeyX') inp.order = 'hold';
      if (e.code === 'KeyC') inp.order = 'follow';
      if (e.code === 'KeyH') { setShowHelp((v) => !v); return; }
      const k = keyMap[e.code];
      if (k) { (inp[k] as boolean) = true; e.preventDefault(); }
      if (e.code === 'KeyR') inp.reload = true;
      if (e.code === 'KeyE') inp.rally = true;
      if (e.code === 'KeyF') inp.meleePressed = true;
      if (e.code === 'KeyQ') inp.cycle = 1;
      if (/^Digit[1-4]$/.test(e.code)) inp.slot = Number(e.code.slice(5)) - 1;
    };
    const up = (e: KeyboardEvent) => { const k = keyMap[e.code]; if (k) (inp[k] as boolean) = false; };
    const toLogical = (e: MouseEvent) => {
      const c = canvasRef.current; if (!c) return;
      const r = c.getBoundingClientRect();
      inp.mouseX = ((e.clientX - r.left) / r.width) * VIEW_W; inp.mouseY = ((e.clientY - r.top) / r.height) * VIEW_H;
    };
    const md = (e: MouseEvent) => { if (pausedRef.current) return; toLogical(e); if (stateRef.current.intro > 0) { inp.skip = true; return; } if (e.button === 0) { inp.fire = true; inp.firePressed = true; } if (e.button === 2) { inp.alt = true; inp.altPressed = true; } };
    const mu = (e: MouseEvent) => { if (e.button === 0) { inp.fire = false; inp.fireReleased = true; } if (e.button === 2) inp.alt = false; };
    const wheel = (e: WheelEvent) => { inp.cycle = e.deltaY > 0 ? 1 : -1; };
    const ctx = (e: MouseEvent) => e.preventDefault();
    const blur = () => { Object.assign(inp, { left: false, right: false, up: false, down: false, fire: false, sprint: false, alt: false }); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('mousemove', toLogical); window.addEventListener('mousedown', md); window.addEventListener('mouseup', mu);
    window.addEventListener('wheel', wheel, { passive: true }); window.addEventListener('contextmenu', ctx); window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('mousemove', toLogical); window.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu);
      window.removeEventListener('wheel', wheel); window.removeEventListener('contextmenu', ctx); window.removeEventListener('blur', blur);
    };
  }, [setPause]);

  // main loop
  useEffect(() => {
    let raf = 0; let last = performance.now(); let hudT = 0; const t0 = last; let beatT = 0; let ema = 16, slowFor = 0, fastFor = 0;
    const c = canvasRef.current!; const g = (c.getContext('2d', { alpha: false, desynchronized: true }) ?? c.getContext('2d'))!;
    const frame = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      const s = stateRef.current; const inp = inputRef.current;
      // adaptive quality: watch the frame time and step resolution / effects up or down
      ema = ema * 0.92 + Math.min(100, dt * 1000) * 0.08;
      if (qualityModeRef.current === 'auto' && !pausedRef.current) {
        const q = qualityRef.current;
        if (ema > 22) { slowFor += dt; fastFor = 0; } else if (ema < 13) { fastFor += dt; slowFor = 0; } else { slowFor = 0; fastFor = 0; }
        if (slowFor > 1 && q > 0) { applyQuality((q - 1) as Quality); slowFor = 0; ema = 16; }
        if (fastFor > 6 && q < 2) { applyQuality((q + 1) as Quality); fastFor = 0; }
      }
      if (!pausedRef.current) step(s, inp, dt);
      inp.firePressed = false; inp.fireReleased = false; inp.meleePressed = false; inp.reload = false; inp.rally = false; inp.slot = null; inp.cycle = 0;
      inp.dodge = false; inp.special = false; inp.order = null; inp.skip = false; inp.altPressed = false;
      // heartbeat at low health
      beatT -= dt; if (!s.player.dead && !s.over && s.player.hp < s.player.maxHp * 0.3 && beatT <= 0) { bsfx('heart', 0.9); beatT = 0.85; }
      g.setTransform(c.width / VIEW_W, 0, 0, c.height / VIEW_H, 0, 0);
      render(g, s, { x: inp.mouseX, y: inp.mouseY }, (now - t0) / 1000);
      hudT -= dt;
      if (hudT <= 0) {
        hudT = 0.12; setHud(snapshot(s));
        const p = portraitRef.current; if (p) drawLineup(p, s, [{ ...s.player, facing: 1, z: 0.5 }], (now - t0) / 1000, false, false);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // fit canvas to the window; internal resolution follows the quality tier
  const fitRef = useRef<() => void>(() => {});
  useEffect(() => {
    const fit = () => {
      const c = canvasRef.current, wrap = wrapRef.current; if (!c || !wrap) return;
      const W = wrap.clientWidth, H = wrap.clientHeight; const k = Math.min(W / VIEW_W, H / VIEW_H);
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const scale = RES_SCALE[qualityRef.current];
      c.style.width = `${VIEW_W * k}px`; c.style.height = `${VIEW_H * k}px`;
      const w = Math.round(VIEW_W * Math.min(k * dpr, 1.6) * scale), h = Math.round(VIEW_H * Math.min(k * dpr, 1.6) * scale);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    };
    fitRef.current = fit;
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const applyQuality = useCallback((q: Quality) => {
    qualityRef.current = q; setQuality(q); stateRef.current.partCap = PART_CAP[q]; setQualityShown(q); fitRef.current();
  }, []);
  useEffect(() => { if (qualityMode !== 'auto') applyQuality(qualityMode); try { localStorage.setItem('whatif-battle-quality', String(qualityMode)); } catch { /* storage unavailable */ } }, [qualityMode, applyQuality]);


  const result: BattleResult | null = hud.over ? resultOf(stateRef.current) : null;
  const finish = async (res: BattleResult) => {
    if (campaignWar && !submitted) {
      const w = useGame.getState().world;
      if (w?.player) {
        const r = await dispatch({ type: 'personalBattle', country: w.player, warId: campaignWar, won: res.won, allyLoss: res.allyLoss, enemyLoss: res.enemyLoss, kills: res.kills, heroFell: res.heroFell });
        setSubmitted({ ok: r.ok, message: r.message });
      }
    }
  };
  useEffect(() => { if (result && hud.overT > 2.5 && campaignWar && !submitted) void finish(result); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hud.overT > 2.5]);
  const retreat = () => {
    const s = stateRef.current;
    if (!s.over) { s.over = { winner: 1, reason: 'retreat' }; s.overT = 3; s.teams[0].fled += Math.round(s.teams[0].reserve * 0.3); }
    setPause(false);
  };

  const wNow = hud.weapons[hud.wi];
  return (
    <div ref={wrapRef} className="fixed inset-0 flex cursor-none select-none items-center justify-center overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block" />
      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 mx-auto flex max-w-[1600px] flex-col justify-between p-4 font-sans">
        {/* top: armies */}
        <div className="flex items-start justify-between gap-4">
          <TeamPlate side={0} name={cfg.teams[0].name} color={cfg.teams[0].color} morale={hud.morale[0]} troops={hud.troops[0]} />
          <div className="flex flex-col items-center pt-1">
            <div className="rounded-full bg-black/50 px-4 py-1 font-mono text-sm text-gold-100 ring-1 ring-gold-500/40">{Math.floor(hud.t / 60)}:{String(Math.floor(hud.t % 60)).padStart(2, '0')}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-gold-200"><Trophy className="h-3.5 w-3.5" />{hud.kills}</div>
          </div>
          <TeamPlate side={1} name={cfg.teams[1].name} color={cfg.teams[1].color} morale={hud.morale[1]} troops={hud.troops[1]} />
        </div>
        {hud.intro <= 0 && !hud.over && (
          <div className="absolute inset-x-0 top-[112px] text-center text-[11px] uppercase tracking-[0.25em] text-parchment-100/85 drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
            <Users className="mr-1 inline h-3 w-3 text-gold-300" />{hud.generalAlive ? tr('Objective: slay {name} or break the enemy morale', { name: hud.general }) : tr('Objective: break the enemy morale')}
          </div>
        )}
        {hud.streak >= 2 && !hud.over && <div className="absolute inset-x-0 top-[38%] text-center"><span className="font-deco text-3xl text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{hud.streak}×</span></div>}
        {hud.intro > 0 && <div className="absolute inset-x-0 bottom-20 text-center text-xs uppercase tracking-[0.3em] text-parchment-200/80 animate-pulse">{tr('Click or press any key to skip')}</div>}
        {/* kill feed */}
        <div className="absolute right-4 top-28 flex w-80 flex-col items-end gap-1">
          <AnimatePresence>{hud.feed.map((f, i) => <motion.div key={f.text + i + (f.vars ? JSON.stringify(f.vars) : '')} initial={{ opacity: 0, x: 30 }} animate={{ opacity: Math.min(1, f.t), x: 0 }} exit={{ opacity: 0 }} className={cx('rounded bg-black/55 px-3 py-1 text-right ring-1 ring-white/10', f.big ? 'text-sm font-semibold' : 'text-xs')} style={{ color: f.color }}>{tr(f.text, f.vars)}</motion.div>)}</AnimatePresence>
        </div>
        {/* banner */}
        <AnimatePresence>
          {hud.banner && !hud.over && (
            <motion.div key={hud.banner.text} initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-[22%] text-center">
              <div className="font-deco text-4xl gold-shine drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] md:text-6xl">{tr(hud.banner.text)}</div>
              <OrnateDivider className="mx-auto my-2 w-80" />
              <div className="font-display text-sm uppercase tracking-[0.35em] text-parchment-100 drop-shadow-[0_2px_6px_rgba(0,0,0,1)]">{tr(hud.banner.sub, hud.banner.vars)}</div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* bottom */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            <div className="relative h-24 w-24 overflow-hidden rounded-full bg-gradient-to-b from-ink-800 to-ink-950 shadow-aaa ring-2 ring-gold-400/80">
              <canvas ref={portraitRef} width={192} height={192} className="absolute -bottom-2 left-1/2 h-[120px] w-[120px] -translate-x-1/2" />
            </div>
            <div className="mb-1 w-64">
              <div className="font-display text-sm text-gold-100 drop-shadow">{cfg.teams[0].leader}</div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-black/60 ring-1 ring-gold-600/50"><div className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500 transition-[width]" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} /></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-gold-600/30"><div className={cx('h-full rounded-full', hud.stamina < 26 ? 'bg-amber-600' : 'bg-gradient-to-r from-lime-500 to-emerald-300')} style={{ width: `${hud.stamina}%` }} /></div>
              {hud.dead && <div className="mt-1 text-[11px] text-red-300">{tr('You have fallen')}</div>}
            </div>
          </div>
          <div className="flex items-end gap-2">
            {hud.weapons.map((w, i) => {
              const Icon = KIND_ICON[w.kind] ?? Swords;
              return (
                <div key={i} className={cx('relative w-28 rounded-lg px-2 py-1.5 ring-1 transition', i === hud.wi ? 'bg-gold-500/20 ring-gold-300 shadow-glow' : 'bg-black/55 ring-white/10')}>
                  <div className="flex items-center gap-1.5"><span className="text-[10px] text-gold-300/70">{i + 1}</span><Icon className="h-4 w-4 text-gold-200" /><span className="truncate text-[11px] text-parchment-100">{tr(w.name)}</span></div>
                  <div className="mt-0.5 text-right font-mono text-xs text-parchment-50">{w.kind === 'melee' ? '∞' : w.magMax ? `${w.mag} / ${w.ammo}` : w.ammo}</div>
                  {i === hud.wi && hud.reload > 0 && <div className="absolute inset-x-1 bottom-0.5 h-0.5 bg-black/50"><div className="h-full bg-amber-400" style={{ width: `${hud.reload * 100}%` }} /></div>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Ability k="E" icon={FlagIcon} label="Rally" cd={hud.rally} max={28} />
              <Ability k="G" icon={hud.special === 'volley' ? Target : hud.special === 'barrage' ? Zap : Rocket} label={hud.special === 'volley' ? 'Arrow volley' : hud.special === 'barrage' ? 'Gun barrage' : 'Artillery strike'} cd={hud.specialCd} max={hud.special === 'volley' ? 26 : 38} />
            </div>
            <div className="flex gap-1">
              {([['Z', 'charge', Swords, 'Charge'], ['X', 'hold', ShieldHalf, 'Hold'], ['C', 'follow', Footprints, 'Follow']] as const).map(([k, o, Icon, l]) => (
                <div key={o} className={cx('flex items-center gap-1 rounded px-2 py-1 text-[10px] uppercase tracking-wider ring-1', hud.order === o ? 'bg-sky-500/25 text-sky-100 ring-sky-300/70' : 'bg-black/50 text-parchment-300/60 ring-white/10')}><span className="font-mono text-gold-300/80">{k}</span><Icon className="h-3 w-3" />{tr(l)}</div>
              ))}
            </div>
            <div className="text-right text-[11px] text-parchment-300/70">{wNow && wNow.magMax > 0 && wNow.mag === 0 && wNow.ammo > 0 ? <span className="text-amber-300">{tr('R — reload')} · </span> : null}{tr('H — controls · Esc — pause')}</div>
          </div>
        </div>
      </div>
      {showHelp && !paused && !hud.over && hud.intro <= 0 && <div className="pointer-events-none absolute left-4 top-28 w-[420px] origin-top-left scale-[0.85] opacity-85"><Controls /></div>}
      {/* pause */}
      <AnimatePresence>
        {paused && !hud.over && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex cursor-default items-center justify-center bg-black/65 backdrop-blur-sm">
            <div className="panel panel-ornate relative w-[420px] p-6 text-center">
              <Filigree />
              <Pause className="mx-auto h-8 w-8 text-gold-300" />
              <h2 className="font-deco mt-2 text-3xl gold-shine">{tr('Paused')}</h2>
              <div className="mt-5 flex flex-col gap-2">
                <button className="btn btn-gold flex items-center justify-center gap-2" onClick={() => setPause(false)}><Play className="h-4 w-4" />{tr('Resume')}</button>
                <button className="btn btn-ghost flex items-center justify-center gap-2" onClick={() => { setPause(false); onRestart(); }}><RotateCcw className="h-4 w-4" />{tr('Restart battle')}</button>
                <button className="btn btn-ghost flex items-center justify-center gap-2" onClick={retreat}><FlagIcon className="h-4 w-4" />{tr('Sound the retreat')}</button>
                <div className="mt-3 text-left"><div className="label">{tr('Graphics quality')}</div>
                  <div className="flex overflow-hidden rounded-md ring-1 ring-gold-600/40">
                    {(['auto', 2, 1, 0] as const).map((q) => <button key={String(q)} onClick={() => setQualityMode(q)} className={cx('flex-1 px-2 py-1.5 text-xs transition', qualityMode === q ? 'bg-gold-500/30 text-gold-50' : 'bg-ink-900/70 text-parchment-300 hover:text-gold-100')}>{tr(q === 'auto' ? 'Auto' : q === 2 ? 'High' : q === 1 ? 'Medium' : 'Low')}</button>)}
                  </div>
                  {qualityMode === 'auto' && <div className="mt-1 text-[10px] text-parchment-300/60">{tr('Current')}: {tr(qualityShown === 2 ? 'High' : qualityShown === 1 ? 'Medium' : 'Low')}</div>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* result */}
      <AnimatePresence>
        {result && hud.overT > 2.2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex cursor-default items-center justify-center bg-black/70 backdrop-blur-[2px]">
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} className="panel panel-ornate relative w-[560px] max-w-[92vw] p-8 text-center">
              <Filigree />
              <div className="text-[11px] uppercase tracking-[0.45em] text-gold-400/80">{cfg.title}</div>
              <h2 className={cx('font-deco mt-2 text-5xl', result.won ? 'gold-shine' : 'text-red-300')}>{tr(result.won ? 'Victory' : 'Defeat')}</h2>
              <OrnateDivider className="mx-auto my-3 w-64" />
              <div className="grid grid-cols-2 gap-3 text-left text-sm sm:grid-cols-4">
                <Stat label="Slain by your hand" value={String(result.kills)} />
                <Stat label="Our losses" value={`${Math.round(result.allyLoss * 100)}%`} />
                <Stat label="Enemy losses" value={`${Math.round(result.enemyLoss * 100)}%`} />
                <Stat label="Accuracy" value={`${Math.round(result.accuracy * 100)}%`} />
              </div>
              {result.heroFell && <p className="mt-3 text-xs text-red-300">{tr('You were struck down — your ruler is badly wounded.')}</p>}
              {campaignWar && <p className="mt-3 text-xs text-parchment-200/80">{submitted ? tr(submitted.message) : tr('Reporting to the war council…')}</p>}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {campaignWar
                  ? <button className="btn btn-gold" disabled={!submitted} onClick={() => navigate('/game/military')}>{tr('Return to the campaign')}</button>
                  : <>
                    <button className="btn btn-gold flex items-center gap-2" onClick={onRestart}><RotateCcw className="h-4 w-4" />{tr('Fight again')}</button>
                    <button className="btn btn-ghost" onClick={onSetup}>{tr('Choose another battle')}</button>
                    <button className="btn btn-ghost" onClick={() => navigate('/')}>{tr('Main menu')}</button>
                  </>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Ability({ k, icon: Icon, label, cd, max }: { k: string; icon: typeof Swords; label: string; cd: number; max: number }) {
  const ready = cd <= 0;
  const pct = ready ? 100 : (1 - cd / max) * 100;
  return (
    <div className={cx('relative flex w-24 flex-col items-center overflow-hidden rounded-lg px-2 py-1.5 ring-1', ready ? 'bg-gold-500/20 ring-gold-300/80 shadow-glow' : 'bg-black/55 ring-white/10')}>
      <div className="absolute inset-x-0 bottom-0 bg-gold-400/15" style={{ height: `${pct}%` }} />
      <div className="relative flex items-center gap-1"><span className="font-mono text-[10px] text-gold-300/80">{k}</span><Icon className={cx('h-4 w-4', ready ? 'text-gold-100' : 'text-parchment-300/50')} /></div>
      <div className="relative truncate text-[10px] text-parchment-100">{ready ? tr(label) : `${Math.ceil(cd)}s`}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-ink-950/60 p-2 ring-1 ring-gold-700/30"><div className="text-[10px] uppercase tracking-wider text-parchment-300/70">{tr(label)}</div><div className="font-display text-xl text-gold-100">{value}</div></div>;
}

function TeamPlate({ side, name, color, morale, troops }: { side: 0 | 1; name: string; color: string; morale: number; troops: number }) {
  return (
    <div className={cx('flex w-[380px] max-w-[40vw] items-center gap-3', side === 1 && 'flex-row-reverse text-right')}>
      <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded-b-[45%] rounded-t-md shadow-aaa ring-2 ring-gold-400/70" style={{ background: color }}><Shield className="h-5 w-5 text-white/80" /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm text-gold-100 drop-shadow">{name}</div>
        <div className={cx('mt-1 h-2.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-gold-600/40', side === 1 && 'rotate-180')}>
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${morale}%`, background: morale > 50 ? 'linear-gradient(90deg,#b8862b,#f6d37a)' : morale > 22 ? 'linear-gradient(90deg,#9a5a1a,#e0a040)' : 'linear-gradient(90deg,#7a1a1a,#ef4444)' }} />
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-parchment-300/80">{tr('Morale')} {Math.round(morale)} · {tr('Troops')} {troops}</div>
      </div>
    </div>
  );
}
