import { create } from 'zustand';
import type { MapStatic, ScenarioDefinition, World } from '../types/game';
import { newGame, type CreateOptions, hashWorld, rtTick, ensureRt, checkAchievements } from '../engine';
import type { RtResult } from '../engine/rt';
import { loadBundle, loadStatic } from '../services/mapData';
import { saveWorld } from '../services/saves';
import { useSettings } from '../services/settings';
import { useProfile } from '../services/profile';
import { sfx } from '../services/audio';
import { ACHIEVEMENTS } from '../engine/achievements';
import { tr } from '../i18n';
import { noticeText, noticeTone } from '../lib/notices';

export type MapMode = 'political' | 'terrain' | 'military' | 'diplomacy';
export type Speed = 0 | 1 | 2 | 5 | 10;
export interface Toast { id: number; text: string; tone: 'info' | 'good' | 'bad' | 'event' }
/** pick-a-target mode: the player pressed "March" / "Send help" in a city and now clicks the destination on the map */
export interface Mission { from: number; kind: 'attack' | 'support' }
export interface SendDraft { from: number; to: number; kind: 'attack' | 'support' }

interface GameStore {
  world: World | null; st: MapStatic | null;
  version: number; mapVersion: number; ownerSig: string;
  speed: Speed; selectedProvince: number | null; selectedCountry: string | null; mapMode: MapMode;
  toasts: Toast[]; loading: string | null; error: string | null; lastAutosave: number;
  mission: Mission | null; send: SendDraft | null; lastNotice: string; lastReport: string; lastCheck: number;
  startGame: (key: string, opts: CreateOptions, custom?: ScenarioDefinition | null) => Promise<World>;
  setWorld: (w: World) => Promise<void>;
  closeGame: () => void;
  /** advance the real-time layer by `wallSeconds` of wall-clock time (scaled by the game speed) */
  step: (wallSeconds: number) => void;
  setSpeed: (s: Speed) => void;
  select: (province: number | null, country?: string | null) => void;
  clickProvince: (id: number) => void;
  setMapMode: (m: MapMode) => void;
  act: <T extends RtResult>(fn: (w: World, st: MapStatic) => T) => T;
  startMission: (from: number, kind: Mission['kind']) => void;
  cancelMission: () => void;
  openSend: (d: SendDraft) => void;
  closeSend: () => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
  bump: () => void;
}

let toastId = 0;
function sig(w: World): string {
  let h = 2166136261;
  for (const p of w.provinces) { const s = (p.owner ?? '') + (p.controller ?? ''); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 124; }
  return (h >>> 0).toString(36) + w.countryOrder.length;
}

export const useGame = create<GameStore>((set, get) => ({
  world: null, st: null, version: 0, mapVersion: 0, ownerSig: '',
  speed: 0, selectedProvince: null, selectedCountry: null, mapMode: 'political',
  toasts: [], loading: null, error: null, lastAutosave: 0,
  mission: null, send: null, lastNotice: '', lastReport: '', lastCheck: 0,

  async startGame(key, opts, custom) {
    set({ loading: 'Forging the world', error: null });
    try {
      const { bundle, st } = await loadBundle(key);
      const w = newGame(bundle, st, opts, custom);
      useProfile.getState().bump({ gamesStarted: 1, worldsCreated: 1 });
      set({ world: w, st, version: 1, mapVersion: 1, ownerSig: sig(w), speed: 1, selectedCountry: w.player, selectedProvince: null, loading: null, lastAutosave: 0, mission: null, send: null, lastNotice: '', lastReport: '', lastCheck: 0 });
      return w;
    } catch (e) {
      set({ loading: null, error: (e as Error).message });
      throw e;
    }
  },
  async setWorld(w) {
    set({ loading: 'Restoring the world' });
    const { st } = await loadStatic();
    const rt = ensureRt(w);
    set({ world: w, st, version: get().version + 1, mapVersion: get().mapVersion + 1, ownerSig: sig(w), speed: 0, selectedCountry: w.player, selectedProvince: null, loading: null, lastAutosave: rt.t, mission: null, send: null, lastNotice: rt.notices[rt.notices.length - 1]?.id ?? '', lastReport: rt.reports[rt.reports.length - 1]?.id ?? '', lastCheck: 0 });
  },
  closeGame() { set({ world: null, speed: 0, selectedCountry: null, selectedProvince: null, mission: null, send: null }); },

  step(wall) {
    const { world: w, st, speed } = get();
    if (!w || !st || !speed) return;
    const rt = ensureRt(w);
    rtTick(w, st, wall * speed);
    const patch: Partial<GameStore> = { version: get().version + 1 };
    const lastReport = rt.reports[rt.reports.length - 1]?.id ?? '';
    if (lastReport !== get().lastReport) { patch.lastReport = lastReport; const s = sig(w); if (s !== get().ownerSig) { patch.ownerSig = s; patch.mapVersion = get().mapVersion + 1; } }
    set(patch);

    // notices addressed to the player: toast, sound, optional auto-pause
    const all = rt.notices;
    const idx = get().lastNotice ? all.findIndex((n) => n.id === get().lastNotice) : -1;
    const fresh = idx >= 0 ? all.slice(idx + 1) : get().lastNotice ? all.slice(-12) : all;
    if (all.length) set({ lastNotice: all[all.length - 1].id });
    const settings = useSettings.getState();
    for (const n of fresh) {
      if (n.to !== w.player) continue;
      get().toast(noticeText(w, n), noticeTone(n.kind));
      if (n.kind === 'incoming' || n.kind === 'war' || n.kind === 'loanDefault') { sfx('war'); if (settings.autoPauseWar && n.kind !== 'incoming') set({ speed: 0 }); }
      if (n.kind === 'war' && n.params.d === w.player) useProfile.getState().bump({ warsFought: 1 });
      if (n.kind === 'captured') sfx('success');
    }

    if (rt.t - get().lastCheck >= 20) {
      set({ lastCheck: rt.t });
      if (w.player) {
        let n = 0; for (const p of w.provinces) if (p.owner === w.player) n++;
        if (n > w.stats.maxProvinces) w.stats.maxProvinces = n;
        const ach = checkAchievements(w);
        if (ach.length) { useProfile.getState().unlock(ach); for (const id of ach) get().toast(`${tr('Achievement unlocked')}: ${tr(ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id)}`, 'good'); sfx('success'); }
        if (!w.countries[w.player]?.alive) { set({ speed: 0 }); get().toast(tr('Your nation has fallen. You may keep observing the world.'), 'bad'); }
      }
    }
    const every = settings.autosaveMonths * 60; // the setting is in minutes
    if (every > 0 && rt.t - get().lastAutosave >= every) {
      set({ lastAutosave: rt.t });
      void saveWorld(w, 'autosave', 'Autosave', true).catch(() => undefined);
    }
  },

  setSpeed(s) { set({ speed: s }); },
  select(province, country) {
    const w = get().world;
    const c = country !== undefined ? country : province !== null && w ? w.provinces[province]?.owner ?? null : null;
    set({ selectedProvince: province, selectedCountry: c });
  },
  /** first click on a nation selects the nation, a second click on one of its cities opens that city */
  clickProvince(id) {
    const { world: w, mission, selectedCountry, selectedProvince } = get();
    if (!w) return;
    const p = w.provinces[id];
    if (!p) return;
    if (mission) {
      if (mission.kind === 'support') {
        if (p.owner === w.player && id !== mission.from) set({ send: { from: mission.from, to: id, kind: 'support' }, mission: null });
        else get().toast(tr('Choose one of your own cities.'), 'bad');
      } else if (p.owner && p.owner !== w.player) set({ send: { from: mission.from, to: id, kind: 'attack' }, mission: null, selectedCountry: p.owner, selectedProvince: id });
      else get().toast(tr('Choose a city of another nation to attack.'), 'bad');
      return;
    }
    if (p.owner && p.owner === selectedCountry && selectedProvince !== id) set({ selectedProvince: id });
    else if (p.owner && p.owner === selectedCountry) set({ selectedProvince: id });
    else set({ selectedCountry: p.owner, selectedProvince: p.owner ? null : id });
  },
  setMapMode(m) { set({ mapMode: m }); },

  act(fn) {
    const { world: w, st } = get();
    if (!w || !st) return { ok: false, key: 'No game loaded.' } as never;
    const r = fn(w, st);
    const s = sig(w);
    set({ version: get().version + 1, ...(s !== get().ownerSig ? { ownerSig: s, mapVersion: get().mapVersion + 1 } : {}) });
    get().toast(tr(r.key, r.params), r.ok ? 'good' : 'bad');
    if (r.ok) sfx('click');
    return r;
  },
  startMission(from, kind) { set({ mission: { from, kind } }); },
  cancelMission() { set({ mission: null }); },
  openSend(d) { set({ send: d, mission: null }); },
  closeSend() { set({ send: null }); },
  toast(text, tone = 'info') {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-4), { id, text, tone }] });
    setTimeout(() => get().dismiss(id), 5500);
  },
  dismiss(id) { set({ toasts: get().toasts.filter((t) => t.id !== id) }); },
  bump() { const w = get().world; set({ version: get().version + 1, ...(w ? { ownerSig: sig(w), mapVersion: get().mapVersion + 1 } : {}) }); },
}));

export function useWorld(): World | null {
  useGame((s) => s.version);
  return useGame((s) => s.world);
}
export function worldHash(): string { const w = useGame.getState().world; return w ? hashWorld(w) : ''; }
