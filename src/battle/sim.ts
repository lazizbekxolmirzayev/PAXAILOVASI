// Real-time 2.5D battle simulation: the player's hero fights inside a battle line of AI soldiers.
// Action layer: light/heavy attacks, block & parry, dodge roll, stamina, shield bash, aim-down-sights,
// era-specific special strikes, troop orders, mounted heroes. Presentation layer hooks: cinematic intro,
// zoom camera, kill-cam slow motion, hit-stop, hit markers and damage indicators.
import { armyKit, skinFor, WEAPONS, type ArmyKit, type BEra, type Culture, type Look, type ProjKind, type Role, type UnitTemplate, type WeaponDef } from './data';
import { bsfx, type BSound } from './sound';

export const VIEW_W = 1280, VIEW_H = 720;
export const WORLD_W = 3600;
export const GROUND_TOP = 452, GROUND_BOT = 700;
export const GRAVITY = 1500;
export const groundY = (z: number): number => GROUND_TOP + z * (GROUND_BOT - GROUND_TOP);
export const depthScale = (z: number): number => 0.9 + 0.48 * z;

export type Terrain = 'plains' | 'desert' | 'steppe' | 'mountain' | 'snow' | 'forest';
export type Order = 'charge' | 'hold' | 'follow';
export type Special = 'volley' | 'barrage' | 'artillery';
export interface TeamCfg { name: string; color: string; culture: Culture; strength: number; leader: string; countryId?: string }
export interface BattleConfig { era: BEra; teams: [TeamCfg, TeamCfg]; title: string; terrain: Terrain; time: 'day' | 'dusk' | 'dawn' | 'overcast'; seed: number; heroMounted?: boolean; difficulty?: 'easy' | 'normal' | 'hard' }

export interface WeaponState { def: WeaponDef; mag: number; ammo: number }
export interface Unit {
  id: number; team: 0 | 1; role: Role; tpl: UnitTemplate; isPlayer: boolean; name: string;
  x: number; z: number; h: number; vx: number; vz: number; vh: number;
  hp: number; maxHp: number; armor: number;
  facing: 1 | -1; aim: number;
  weapons: WeaponState[]; wi: number; melee: WeaponDef; meleeMode: boolean;
  atkT: number; atkDur: number; atkKind: 'melee' | 'heavy' | 'bash' | 'shoot' | 'throw' | 'none'; hitDone: boolean;
  cd: number; reloadT: number; reloadDur: number; drawing: boolean; draw: number; recoil: number;
  walk: number; hitT: number; deadT: number; dead: boolean; routing: boolean;
  horse: boolean; shield: boolean; look: Look; color: string; trim: string;
  target: number | null; thinkT: number; inspiredT: number; kills: number; seed: number;
  passT: number; regenT: number; blockT: number; strafe: number;
  // action layer
  blocking: boolean; blockStart: number; stunT: number; knockT: number; dodgeT: number; spin: number; fallDir: 1 | -1;
  stamina: number; staminaT: number; charge: number; charging: boolean; ads: boolean; hScale: number; slot: number;
}
export interface Projectile {
  id: number; kind: ProjKind; team: 0 | 1 | 2; owner: number;
  x: number; z: number; h: number; vx: number; vz: number; vh: number; dmg: number;
  life: number; stuck: boolean; hitIds: number[]; fuse: number; bounces: number; whistled: boolean; safeTeam: -1 | 0 | 1;
}
export type PKind = 'smoke' | 'spark' | 'dust' | 'blood' | 'fire' | 'debris' | 'flash' | 'ring' | 'ember' | 'muzzle' | 'leaf' | 'slash';
export interface Particle { kind: PKind; x: number; z: number; h: number; vx: number; vz: number; vh: number; life: number; max: number; size: number; color: string; rot: number }
export interface Decal { kind: 'crater' | 'scorch' | 'blood'; x: number; z: number; r: number; life: number; rot: number }
export interface Feed { text: string; vars?: Record<string, string | number>; color: string; t: number; big?: boolean }
export interface Banner { text: string; sub: string; vars?: Record<string, string | number>; t: number }
export interface Strike { kind: Special; x: number; z: number; t: number; fired: number; total: number }
export interface Plane { x: number; y: number; vx: number; t: number }

export interface Input {
  left: boolean; right: boolean; up: boolean; down: boolean; dodge: boolean; sprint: boolean;
  fire: boolean; firePressed: boolean; fireReleased: boolean; meleePressed: boolean; alt: boolean; altPressed: boolean;
  reload: boolean; rally: boolean; special: boolean; order: Order | null; slot: number | null; cycle: number; skip: boolean;
  mouseX: number; mouseY: number;
}
export const emptyInput = (): Input => ({ left: false, right: false, up: false, down: false, dodge: false, sprint: false, fire: false, firePressed: false, fireReleased: false, meleePressed: false, alt: false, altPressed: false, reload: false, rally: false, special: false, order: null, slot: null, cycle: 0, skip: false, mouseX: VIEW_W / 2, mouseY: VIEW_H / 2 });

export interface TeamState { cfg: TeamCfg; kit: ArmyKit; morale: number; reserve: number; deployed: number; dead: number; fled: number; spawnT: number; artT: number; routedAnnounced: boolean }
export interface BattleState {
  cfg: BattleConfig; t: number; units: Unit[]; proj: Projectile[]; parts: Particle[]; decals: Decal[]; feed: Feed[];
  teams: [TeamState, TeamState]; player: Unit; camX: number; shake: number; uid: number; rng: () => number;
  over: null | { winner: 0 | 1; reason: string }; overT: number; rallyCd: number; rallyFx: number;
  playerKills: number; shots: number; hits: number; timeScale: number; banner: Banner | null;
  fieldMax: number; heroFell: boolean; wind: number;
  /** Particle budget, set by the quality tier in the Battle page (defaults to 1000). */
  partCap?: number;
  // presentation
  zoom: number; pivotX: number; pivotY: number; intro: number; slowT: number; hitStop: number; focus: { x: number; z: number; t: number } | null;
  hitMark: { t: number; kill: boolean; head: boolean }; dmgInd: { side: -1 | 1; t: number }[]; strikes: Strike[]; planes: Plane[];
  order: Order; holdX: number; specialCd: number; special: Special; streak: number; streakT: number; parryFx: number; difficulty: number;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const shade = (hex: string, f: number): string => {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255), g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255), b = clamp(Math.round((n & 255) * f), 0, 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

function ws(id: string, ai: boolean): WeaponState {
  const def = WEAPONS[id];
  return { def, mag: def.mag ?? 0, ammo: ai ? 999 : (def.ammo ?? 0) };
}
export function specialFor(era: BEra, c: Culture): Special {
  if (era === 'modern') return 'artillery';
  if ((era === 'renaissance' || era === 'industrial') && c !== 'american' && c !== 'african') return 'barrage';
  return 'volley';
}

function makeUnit(s: BattleState, team: 0 | 1, tpl: UnitTemplate, x: number, z: number, isPlayer = false): Unit {
  const T = s.teams[team];
  const look: Look = { ...T.kit.look(tpl.role), skin: skinFor(T.cfg.culture, s.uid) };
  if (tpl.role === 'general' || isPlayer) Object.assign(look, T.kit.hero.look);
  if (team === 1 && s.teams[0].cfg.culture === T.cfg.culture && look.helmet === 'helmet_flared') look.helmet = 'helmet_round';
  const weapons = isPlayer ? T.kit.hero.weapons.map((w) => ws(w, false)) : [ws(tpl.weapon, true), ...(tpl.side ? [ws(tpl.side, true)] : [])];
  const meleeDef = weapons.find((w) => w.def.kind === 'melee')?.def ?? WEAPONS[tpl.side && WEAPONS[tpl.side].kind === 'melee' ? tpl.side : 'knife'];
  const mountedHero = isPlayer && !!s.cfg.heroMounted && s.cfg.era !== 'modern' && s.cfg.era !== 'industrial';
  const u: Unit = {
    id: s.uid++, team, role: isPlayer ? 'general' : tpl.role, tpl, isPlayer, name: isPlayer || tpl.role === 'general' ? T.cfg.leader : '',
    x, z, h: 0, vx: 0, vz: 0, vh: 0, hp: isPlayer ? 340 : tpl.hp, maxHp: isPlayer ? 340 : tpl.hp, armor: isPlayer ? 0.45 : tpl.armor,
    facing: team === 0 ? 1 : -1, aim: 0, weapons, wi: 0, melee: meleeDef, meleeMode: false,
    atkT: 0, atkDur: 0, atkKind: 'none', hitDone: true, cd: isPlayer ? 0 : s.rng() * 0.8, reloadT: 0, reloadDur: 1, drawing: false, draw: 0, recoil: 0,
    walk: s.rng() * 10, hitT: 0, deadT: 0, dead: false, routing: false,
    horse: isPlayer ? mountedHero || T.kit.hero.horse : !!tpl.horse, shield: !!tpl.shield && look.shieldShape !== 'none', look,
    color: T.cfg.color, trim: shade(T.cfg.color, 0.55), target: null, thinkT: s.rng() * 0.3, inspiredT: 0, kills: 0, seed: Math.floor(s.rng() * 1e6),
    passT: 0, regenT: 0, blockT: 0, strafe: s.rng() * 2 - 1,
    blocking: false, blockStart: 0, stunT: 0, knockT: 0, dodgeT: 0, spin: 0, fallDir: -1, stamina: 100, staminaT: 0, charge: 0, charging: false, ads: false,
    hScale: isPlayer || tpl.role === 'general' ? 1.06 : 0.93 + s.rng() * 0.13, slot: 0,
  };
  if (isPlayer && T.kit.units[0].shield && look.shieldShape !== 'none') u.shield = true;
  s.units.push(u);
  T.deployed++;
  return u;
}

function pickTemplate(s: BattleState, team: 0 | 1): UnitTemplate {
  const list = s.teams[team].kit.units.filter((u) => u.role !== 'general' && u.role !== 'standard');
  const tot = list.reduce((a, b) => a + b.weight, 0);
  let r = s.rng() * tot;
  for (const u of list) { r -= u.weight; if (r <= 0) return u; }
  return list[0];
}

export function createBattle(cfg: BattleConfig): BattleState {
  const rng = mulberry(cfg.seed);
  const mk = (c: TeamCfg): TeamState => ({ cfg: c, kit: armyKit(cfg.era, c.culture), morale: 100, reserve: 0, deployed: 0, dead: 0, fled: 0, spawnT: 2, artT: 8 + rng() * 6, routedAnnounced: false });
  const teams: [TeamState, TeamState] = [mk(cfg.teams[0]), mk(cfg.teams[1])];
  const s = {
    cfg, t: 0, units: [], proj: [], parts: [], decals: [], feed: [], teams, player: null as unknown as Unit, camX: 0, shake: 0, uid: 1, rng,
    over: null, overT: 0, rallyCd: 0, rallyFx: 0, playerKills: 0, shots: 0, hits: 0, timeScale: 1,
    banner: { text: cfg.title, sub: '{a} — {b}', vars: { a: cfg.teams[0].name, b: cfg.teams[1].name }, t: 4.2 }, fieldMax: 18, heroFell: false, wind: rng() * 40 - 20,
    zoom: 1, pivotX: VIEW_W / 2, pivotY: GROUND_TOP + 120, intro: 3.6, slowT: 0, hitStop: 0, focus: null,
    hitMark: { t: 0, kill: false, head: false }, dmgInd: [], strikes: [], planes: [],
    order: 'charge', holdX: 0, specialCd: 6, special: specialFor(cfg.era, cfg.teams[0].culture), streak: 0, streakT: 0, parryFx: 0,
    difficulty: cfg.difficulty === 'easy' ? 0.7 : cfg.difficulty === 'hard' ? 1.35 : 1,
  } as BattleState;
  const total = (st: number) => Math.round(clamp(38 * st, 18, 80));
  for (const team of [0, 1] as const) {
    const T = teams[team];
    const tot = total(cfg.teams[team].strength);
    const dir = team === 0 ? 1 : -1;
    const front = team === 0 ? 700 : WORLD_W - 700;
    const n0 = Math.min(s.fieldMax - 2, tot - 2);
    for (let i = 0; i < n0; i++) {
      const tpl = pickTemplate(s, team);
      const ranged = ['ranged', 'gunner', 'mg', 'horsearcher', 'grenadier'].includes(tpl.role);
      const back = ranged ? 160 + rng() * 120 : rng() * 120;
      makeUnit(s, team, tpl, front - dir * back - dir * (i % 3) * 30, 0.08 + ((i * 0.37) % 1) * 0.84);
    }
    const sb = T.kit.units.find((u) => u.role === 'standard')!;
    makeUnit(s, team, sb, front - dir * 120, 0.5);
    if (team === 1) makeUnit(s, 1, T.kit.units.find((u) => u.role === 'general')!, front - dir * 380, 0.45);
    T.reserve = Math.max(0, tot - T.deployed - (team === 0 ? 1 : 0));
  }
  s.player = makeUnit(s, 0, teams[0].kit.units.find((u) => u.role === 'general')!, 520, 0.55, true);
  teams[0].deployed--; // the hero is not part of the levy count
  s.camX = WORLD_W - VIEW_W - 300; // the intro pans from the enemy host to the hero
  s.holdX = s.player.x;
  return s;
}

// ---------------------------------------------------------------- helpers
function part(s: BattleState, kind: PKind, x: number, z: number, h: number, vx: number, vz: number, vh: number, life: number, size: number, color: string) {
  if (s.parts.length > (s.partCap ?? 1000)) s.parts.shift();
  s.parts.push({ kind, x, z, h, vx, vz, vh, life, max: life, size, color, rot: s.rng() * 6.28 });
}
function soundAt(s: BattleState, kind: BSound, x: number, vol = 1) {
  const cx = s.camX + VIEW_W / 2;
  const d = Math.abs(x - cx);
  bsfx(kind, vol * clamp(1.15 - d / 1700, 0, 1), clamp((x - cx) / 900, -1, 1));
}
function feed(s: BattleState, text: string, color: string, big = false, vars?: Record<string, string | number>) { s.feed.unshift({ text, vars, color, t: big ? 6 : 4, big }); if (s.feed.length > 6) s.feed.pop(); }
const handPos = (u: Unit) => { const sc = depthScale(u.z) * u.hScale; return { x: u.x + u.facing * 8 * sc, h: u.h + (u.horse ? 62 : 40) * sc }; };
export const unitHeight = (u: Unit) => (u.horse ? 92 : 60) * depthScale(u.z) * u.hScale;
const alive = (u: Unit) => !u.dead;
const fighting = (u: Unit) => !u.dead && !u.routing;
export const curWeapon = (u: Unit): WeaponState => u.weapons[clamp(u.wi, 0, u.weapons.length - 1)];
const disabled = (u: Unit) => u.stunT > 0 || u.knockT > 0;
/** Converts a pointer position on the zoomed view to unzoomed scene coordinates. */
export function toScene(s: BattleState, mx: number, my: number): { x: number; y: number } {
  return { x: (mx - s.pivotX) / s.zoom + s.pivotX, y: (my - s.pivotY) / s.zoom + s.pivotY };
}
function useStamina(u: Unit, amt: number): boolean {
  if (!u.isPlayer) return true;
  if (u.stamina < amt) return false;
  u.stamina -= amt; u.staminaT = 0.9; return true;
}

// ---------------------------------------------------------------- damage
type DmgKind = 'melee' | 'heavy' | 'arrow' | 'bullet' | 'blast' | 'bash';
function damage(s: BattleState, v: Unit, amount: number, from: Unit | null, kind: DmgKind, dirX: number, head = false) {
  if (v.dead) return;
  if (v.dodgeT > 0.08 && kind !== 'blast') return; // i-frames while rolling
  const facingThreat = Math.sign(dirX) === -v.facing;
  // the hero's raised guard: perfect parries stun melee attackers
  if (v.isPlayer && v.blocking && facingThreat && kind !== 'blast') {
    const perfect = s.t - v.blockStart < 0.22 && (kind === 'melee' || kind === 'heavy');
    if (perfect && from) {
      from.stunT = 1.1; from.atkT = 0; from.vx = -from.facing * 160;
      s.parryFx = 0.35; s.hitStop = Math.max(s.hitStop, 0.09);
      soundAt(s, 'parry', v.x, 1);
      for (let i = 0; i < 14; i++) part(s, 'spark', v.x + v.facing * 16, v.z, v.h + 40 * depthScale(v.z), (s.rng() - 0.5) * 420, 0, 60 + s.rng() * 300, 0.35, 2, '#fff0b0');
      feed(s, 'Perfect parry!', '#fde68a');
      return;
    }
    if (v.shield || kind === 'melee' || kind === 'heavy' || kind === 'bash') {
      const cost = amount * (v.shield ? 0.35 : 0.6) * (kind === 'heavy' ? 2 : 1);
      if (v.stamina >= cost) {
        v.stamina -= cost; v.staminaT = 0.9; v.blockT = 0.2;
        soundAt(s, kind === 'arrow' || kind === 'bullet' ? 'block' : 'clang', v.x, 0.9);
        for (let i = 0; i < 6; i++) part(s, 'spark', v.x + v.facing * 14, v.z, v.h + 36 * depthScale(v.z), (s.rng() - 0.5) * 300, 0, 100 + s.rng() * 200, 0.3, 2, '#ffd27a');
        v.vx += dirX * 60;
        if (kind === 'bullet' && !v.shield) amount *= 0.6; else return;
      } else { v.blocking = false; v.stunT = 0.7; feed(s, 'Guard broken!', '#f87171'); }
    }
  }
  // shields stop missiles and many cuts when raised toward the threat
  if (!v.isPlayer && v.shield && kind !== 'blast' && kind !== 'heavy' && v.atkT <= 0 && facingThreat && !disabled(v) && s.rng() < (kind === 'arrow' ? 0.62 : kind === 'melee' ? 0.3 : kind === 'bash' ? 0.1 : 0.12)) {
    amount *= 0.12; v.blockT = 0.25;
    soundAt(s, kind === 'melee' ? 'clang' : 'block', v.x, 0.8);
    for (let i = 0; i < 5; i++) part(s, 'spark', v.x + v.facing * 12, v.z, v.h + 34 * depthScale(v.z), (s.rng() - 0.5) * 300, 0, 100 + s.rng() * 200, 0.3, 2, '#ffd27a');
  }
  const armorF = kind === 'bullet' ? 0.35 : kind === 'blast' ? 0.2 : kind === 'arrow' ? 0.9 : 0.75;
  let dmg = amount * (1 - v.armor * armorF);
  if (from?.inspiredT && from.inspiredT > 0) dmg *= 1.25;
  if (v.isPlayer) dmg *= 0.55 * s.difficulty;
  else if (!from?.isPlayer) dmg *= 0.28; // soldier-vs-soldier fights last longer than the hero's blows
  v.hp -= dmg; v.hitT = 0.16; v.regenT = 5;
  v.vx += dirX * (kind === 'blast' ? 300 : kind === 'heavy' ? 220 : kind === 'bash' ? 180 : 70);
  if (kind === 'bash' && !v.dead) { v.stunT = Math.max(v.stunT, 0.9); v.atkT = 0; }
  if ((kind === 'heavy' || kind === 'blast') && v.hp > 0 && !v.isPlayer && !v.horse) { v.knockT = 1.1; v.atkT = 0; v.drawing = false; }
  if (kind === 'blast' && v.isPlayer && v.hp > 0 && !v.horse) { v.knockT = 0.8; }
  if (v.isPlayer) { s.dmgInd.push({ side: (dirX > 0 ? -1 : 1) as -1 | 1, t: 0.8 }); if (s.dmgInd.length > 4) s.dmgInd.shift(); s.shake = Math.max(s.shake, 4); }
  if (dmg > 8) {
    const sc = depthScale(v.z);
    for (let i = 0; i < 4; i++) part(s, 'blood', v.x, v.z, v.h + 36 * sc, dirX * (60 + s.rng() * 160), (s.rng() - 0.5) * 0.1, 40 + s.rng() * 160, 0.6, 2 + s.rng() * 2, '#6e0e0e');
    if (s.rng() < 0.5) { s.decals.push({ kind: 'blood', x: v.x + dirX * (8 + s.rng() * 20), z: v.z + (s.rng() - 0.5) * 0.03, r: 3 + s.rng() * 5, life: 45, rot: s.rng() * 3 }); if (s.decals.length > 140) s.decals.shift(); }
    if (s.rng() < 0.35) soundAt(s, 'hurt', v.x, 0.5);
  }
  if (from?.isPlayer) { s.hits++; s.hitMark = { t: 0.25, kill: false, head }; }
  if (v.hp <= 0) kill(s, v, from, kind, dirX);
}

function kill(s: BattleState, v: Unit, from: Unit | null, kind: DmgKind, dirX: number) {
  v.dead = true; v.hp = 0; v.deadT = 0; v.atkT = 0; v.drawing = false; v.blocking = false;
  v.fallDir = (Math.sign(dirX) === v.facing ? 1 : -1) as 1 | -1; // falls away from the blow
  if (kind === 'blast') { v.vh = 380 + s.rng() * 220; v.vx = dirX * (180 + s.rng() * 200); v.spin = dirX * (6 + s.rng() * 6); }
  else if (kind === 'heavy') { v.vh = 160; v.vx = dirX * 200; }
  const T = s.teams[v.team];
  T.dead++;
  if (from) { from.kills++; }
  if (from?.isPlayer) {
    s.playerKills++; s.hitMark = { t: 0.4, kill: true, head: s.hitMark.head };
    s.hitStop = Math.max(s.hitStop, kind === 'heavy' ? 0.08 : 0.04);
    s.streak = s.streakT > 0 ? s.streak + 1 : 1; s.streakT = 3.2;
    if (s.streak >= 3) feed(s, '{n}× kill streak!', '#fbbf24', s.streak >= 5, { n: s.streak });
  }
  const perDeath = 95 / Math.max(20, T.deployed + T.reserve);
  T.morale = clamp(T.morale - perDeath * (v.role === 'general' ? 0 : 1), 0, 100);
  if (v.role === 'standard') { T.morale = clamp(T.morale - 15, 0, 100); feed(s, '{name}: the standard has fallen', v.team === 0 ? '#f87171' : '#fbbf24', false, { name: T.cfg.name }); }
  if (v.isPlayer) {
    s.heroFell = true; T.morale = clamp(T.morale - 25, 0, 100);
    s.banner = { text: 'You have fallen', sub: 'The battle rages on without you…', t: 3.5 };
    s.timeScale = 1.8; s.focus = { x: v.x, z: v.z, t: 2 }; s.slowT = 1.2;
  } else if (v.role === 'general') {
    T.morale = clamp(T.morale - 40, 0, 100);
    s.banner = { text: 'The enemy commander has fallen!', sub: '{name}', vars: { name: v.name }, t: 3.5 };
    feed(s, from?.isPlayer ? '{name} slain by your hand' : '{name} slain', '#fbbf24', true, { name: v.name });
    soundAt(s, 'horn', v.x, 0.7); soundAt(s, 'cheer', v.x, 0.8);
    s.slowT = 1.8; s.focus = { x: v.x, z: v.z, t: 2.2 };
  }
}

// ---------------------------------------------------------------- attacks
function launch(s: BattleState, u: Unit, def: WeaponDef, angle: number, targetZ: number | null, power = 1) {
  const hp = handPos(u);
  const sp = (def.speed ?? 800) * (0.45 + 0.55 * power);
  const spreadMul = (u.isPlayer ? (u.ads ? 0.3 : 1) : 2.2) * (u.routing ? 3 : 1) * (u.isPlayer && Math.abs(u.vx) > 120 ? 1.6 : 1);
  const a = angle + (s.rng() - 0.5) * 2 * (def.spread ?? 0) * spreadMul;
  const vx = Math.cos(a) * sp * u.facing, vh = Math.sin(a) * sp;
  let vz = 0;
  if (targetZ !== null) { const dist = Math.max(60, Math.abs(vx) * 0.6); vz = (targetZ - u.z) / (dist / Math.abs(vx || 1)); }
  const kind = def.proj ?? 'arrow';
  s.proj.push({ id: s.uid++, kind, team: u.team, owner: u.id, x: hp.x + u.facing * 14, z: u.z, h: hp.h + 4, vx, vz: clamp(vz, -1.5, 1.5), vh, dmg: def.dmg * (0.4 + 0.6 * power), life: kind === 'grenade' ? 6 : 4, stuck: false, hitIds: [], fuse: kind === 'grenade' ? 2.2 : 0, bounces: 0, whistled: false, safeTeam: -1 });
  if (u.isPlayer) s.shots++;
  const sc = depthScale(u.z);
  if (def.kind === 'gun') {
    const mx = hp.x + u.facing * (def.twoHanded ? 34 : 18) * sc;
    part(s, 'muzzle', mx, u.z, hp.h + 3, 0, 0, 0, 0.07, def.smoke ? 18 : 12, '#ffd27a');
    const n = def.smoke ? 10 : 2;
    for (let i = 0; i < n; i++) part(s, 'smoke', mx, u.z, hp.h + 3, u.facing * (30 + s.rng() * 80) + s.wind, 0, 10 + s.rng() * 30, def.smoke ? 2.8 + s.rng() * 1.4 : 0.8, def.smoke ? 10 + s.rng() * 10 : 5, def.smoke ? '#d9d4c7' : '#bdbab2');
    u.recoil = 1;
    if (u.isPlayer) s.shake = Math.max(s.shake, def.smoke ? 3.5 : def.auto ? 1.2 : 2.2);
    soundAt(s, def.smoke ? 'blackpowder' : def.look === 'smg' ? 'smg' : def.look === 'mg' ? 'mg' : def.look === 'pistol' || def.look === 'revolver' ? 'pistol' : 'rifle', u.x, u.isPlayer ? 1 : 0.55);
    if (!def.smoke && def.look !== 'pistol') part(s, 'debris', hp.x, u.z, hp.h, -u.facing * 60, 0, 120, 0.6, 1.5, '#d4a94a');
  } else if (def.kind === 'bow') soundAt(s, 'bow', u.x, u.isPlayer ? 0.9 : 0.4);
  else if (def.kind === 'crossbow') soundAt(s, 'xbow', u.x, u.isPlayer ? 0.9 : 0.4);
  else if (def.kind === 'sling') soundAt(s, 'sling', u.x, 0.5);
  else soundAt(s, 'throw', u.x, 0.6);
}

/** Begins an attack with the current weapon. Returns false if it could not fire. */
function attack(s: BattleState, u: Unit, angle: number, targetZ: number | null, power = 1, forceMelee = false, style: 'melee' | 'heavy' | 'bash' = 'melee'): boolean {
  if (u.cd > 0 || u.reloadT > 0 || u.atkT > 0 || u.dead || disabled(u) || u.dodgeT > 0) return false;
  const w = curWeapon(u);
  const def = forceMelee || u.meleeMode ? u.melee : w.def;
  if (style === 'bash') {
    if (!useStamina(u, 15)) return false;
    u.atkT = u.atkDur = 0.32; u.atkKind = 'bash'; u.hitDone = false; u.cd = 0.45;
    soundAt(s, 'swing', u.x, 0.6);
    return true;
  }
  if (def.kind === 'melee') {
    const heavy = style === 'heavy';
    if (heavy && !useStamina(u, 25)) return false;
    u.atkT = u.atkDur = heavy ? 0.55 : Math.max(0.28, def.cd * 0.85); u.atkKind = heavy ? 'heavy' : 'melee'; u.hitDone = false;
    u.cd = heavy ? 0.7 : def.cd * (u.isPlayer ? 1 : 1.5 + s.rng() * 0.8);
    soundAt(s, heavy ? 'whoosh' : 'swing', u.x, u.isPlayer ? 0.9 : 0.3);
    if (u.isPlayer && (heavy || s.rng() < 0.2)) soundAt(s, 'shout', u.x, 0.45);
    return true;
  }
  if (def.mag) {
    if (w.mag <= 0) { if (u.isPlayer) bsfx('empty'); startReload(s, u); return false; }
    w.mag--;
  } else if (def.ammo !== undefined) {
    if (w.ammo <= 0) { if (u.isPlayer) bsfx('empty'); return false; }
    w.ammo--;
  }
  launch(s, u, def, angle, targetZ, power);
  u.atkT = u.atkDur = def.kind === 'gun' ? 0.12 : 0.3; u.atkKind = def.kind === 'gun' || def.kind === 'bow' || def.kind === 'crossbow' ? 'shoot' : 'throw';
  u.cd = def.cd * (u.isPlayer ? 1 : 1.4 + s.rng() * (def.auto ? 0.4 : 1.6));
  if (def.mag && w.mag <= 0 && w.ammo > 0 && !u.isPlayer) startReload(s, u);
  return true;
}
function startReload(s: BattleState, u: Unit) {
  const w = curWeapon(u);
  if (!w.def.mag || w.mag >= w.def.mag || w.ammo <= 0 || u.reloadT > 0) return;
  u.reloadT = u.reloadDur = (w.def.reload ?? 1) * (u.isPlayer ? 1 : 1.25);
  if (u.isPlayer) bsfx('reload', 0.8);
}
function finishReload(u: Unit) {
  const w = curWeapon(u);
  if (!w.def.mag) return;
  const need = w.def.mag - w.mag; const take = Math.min(need, w.ammo);
  w.mag += take; w.ammo -= take;
}

function meleeHit(s: BattleState, u: Unit) {
  const heavy = u.atkKind === 'heavy', bash = u.atkKind === 'bash';
  const def = u.meleeMode || curWeapon(u).def.kind !== 'melee' ? u.melee : curWeapon(u).def;
  const sc = depthScale(u.z);
  const reach = (bash ? 30 : (def.reach ?? 40) * (heavy ? 1.15 : 1)) * sc * (u.horse ? 1.25 : 1);
  let hits = 0;
  if (u.isPlayer && !bash) part(s, 'slash', u.x + u.facing * reach * 0.55, u.z, u.h + 36 * sc, u.facing, 0, 0, 0.18, reach, heavy ? '#ffe7a8' : '#ffffff');
  for (const v of s.units) {
    if (v.dead || v.team === u.team) continue;
    const dx = (v.x - u.x) * u.facing;
    if (dx < -10 - (heavy ? 18 : 0) || dx > reach + 10) continue;
    if (Math.abs(v.z - u.z) > (heavy ? 0.13 : 0.09)) continue;
    if (Math.abs(v.h - u.h) > 50) continue;
    let dmg = bash ? 14 : def.dmg * (u.horse && Math.abs(u.vx) > 150 ? 1.6 : 1) * (heavy ? 2.3 : 1);
    if (u.isPlayer) dmg *= 1.6;
    if (v.stunT > 0 || v.knockT > 0) dmg *= 1.35; // punish the staggered
    damage(s, v, dmg, u, bash ? 'bash' : heavy ? 'heavy' : 'melee', u.facing);
    hits++;
    if (!u.isPlayer && !def.twoHanded) break;
    if (hits >= (heavy ? 5 : 3)) break;
  }
  if (hits) {
    soundAt(s, bash ? 'kick' : s.rng() < 0.5 ? 'clang' : 'hit', u.x, u.isPlayer ? 1 : 0.45);
    if (u.isPlayer) { s.shake = Math.max(s.shake, heavy ? 8 : 3); s.hitStop = Math.max(s.hitStop, heavy ? 0.07 : 0.03); }
  }
}

// ---------------------------------------------------------------- explosions, artillery, specials
function explode(s: BattleState, x: number, z: number, h: number, radius: number, dmg: number, owner: Unit | null, safeTeam: -1 | 0 | 1 = -1) {
  soundAt(s, 'explosion', x, 1);
  const d = Math.abs(x - (s.camX + VIEW_W / 2));
  s.shake = Math.max(s.shake, clamp(18 - d / 90, 2, 18));
  for (let i = 0; i < 28; i++) { const a = s.rng() * Math.PI; const sp = 120 + s.rng() * 460; part(s, 'debris', x, z, h, Math.cos(a) * sp, (s.rng() - 0.5) * 0.4, Math.sin(a) * sp, 1 + s.rng(), 2 + s.rng() * 3, s.rng() < 0.5 ? '#3b2f22' : '#5a4a36'); }
  for (let i = 0; i < 16; i++) part(s, 'fire', x + (s.rng() - 0.5) * 34, z, h + s.rng() * 20, (s.rng() - 0.5) * 130, 0, 40 + s.rng() * 170, 0.5 + s.rng() * 0.45, 16 + s.rng() * 22, '#ffb347');
  for (let i = 0; i < 8; i++) part(s, 'ember', x, z, h + 10, (s.rng() - 0.5) * 300, 0, 200 + s.rng() * 300, 1.4 + s.rng(), 3, '#ffcf6a');
  for (let i = 0; i < 14; i++) part(s, 'smoke', x + (s.rng() - 0.5) * 50, z, h + s.rng() * 30, (s.rng() - 0.5) * 60 + s.wind, 0, 30 + s.rng() * 70, 3.4 + s.rng() * 2, 26 + s.rng() * 28, '#4a4640');
  part(s, 'ring', x, z, h, 0, 0, 0, 0.35, radius, '#fff2c4');
  part(s, 'flash', x, z, h + 20, 0, 0, 0, 0.14, radius * 1.5, '#ffe7a8');
  s.decals.push({ kind: 'crater', x, z, r: radius * 0.45, life: 60, rot: 0 });
  if (s.decals.length > 140) s.decals.shift();
  for (const v of s.units) {
    if (v.dead || v.team === safeTeam) continue;
    const dz = (v.z - z) * 420; const dx = v.x - x; const dist = Math.hypot(dx, dz);
    if (dist < radius) damage(s, v, dmg * (1 - dist / radius), owner, 'blast', Math.sign(dx) || 1);
  }
}

function artillery(s: BattleState, team: 0 | 1, dt: number) {
  const T = s.teams[team];
  if (T.kit.artillery === 'none' || s.over || s.intro > 0) return;
  T.artT -= dt;
  if (T.artT > 0) return;
  const kind = T.kit.artillery;
  T.artT = (kind === 'howitzer' ? 6.5 : kind === 'cannon' ? 7.5 : kind === 'ballista' ? 8 : 12) + s.rng() * 6;
  const enemies = s.units.filter((u) => u.team !== team && fighting(u));
  if (!enemies.length) return;
  const tgt = enemies[Math.floor(s.rng() * enemies.length)];
  const err = kind === 'howitzer' ? 160 : kind === 'trebuchet' ? 220 : 160;
  const tx = tgt.x + (s.rng() - 0.5) * err * 2, tz = clamp(tgt.z + (s.rng() - 0.5) * 0.4, 0.02, 0.98);
  fireHeavy(s, kind, team, tx, tz, -1);
}
function fireHeavy(s: BattleState, kind: 'howitzer' | 'trebuchet' | 'cannon' | 'ballista' | 'shell', team: 0 | 1, tx: number, tz: number, safeTeam: -1 | 0 | 1) {
  const fromX = team === 0 ? s.camX - 300 : s.camX + VIEW_W + 300;
  const dir = team === 0 ? 1 : -1;
  const P = (p: Partial<Projectile>): Projectile => ({ id: s.uid++, kind: 'shell', team: 2, owner: -1, x: 0, z: tz, h: 0, vx: 0, vz: 0, vh: 0, dmg: 100, life: 5, stuck: false, hitIds: [], fuse: 0, bounces: 0, whistled: false, safeTeam, ...p });
  if (kind === 'howitzer' || kind === 'shell') s.proj.push(P({ kind: 'shell', x: tx - dir * 260, h: 900, vx: dir * 260, vh: -900, dmg: 150, life: 4 }));
  else if (kind === 'trebuchet') { const flight = 2.6; s.proj.push(P({ kind: 'boulder', x: fromX, vx: (tx - fromX) / flight, vh: 0.5 * GRAVITY * flight, dmg: 120 })); soundAt(s, 'throw', fromX, 0.5); }
  else if (kind === 'cannon') { const flight = 1.1; s.proj.push(P({ kind: 'cannonball', x: fromX, h: 30, vx: (tx - fromX) / flight, vh: 0.5 * GRAVITY * flight * 0.6, dmg: 110, life: 4 })); soundAt(s, 'cannon', clamp(fromX, s.camX, s.camX + VIEW_W), 0.75); }
  else { s.proj.push(P({ kind: 'bolt', team, x: fromX, h: 40, vx: dir * 1400, vh: 60, dmg: 90, life: 3 })); soundAt(s, 'xbow', clamp(fromX, s.camX, s.camX + VIEW_W), 0.6); }
}

function triggerSpecial(s: BattleState, inp: Input) {
  const u = s.player;
  if (s.specialCd > 0 || u.dead) return false;
  const m = toScene(s, inp.mouseX, inp.mouseY);
  const x = clamp(m.x + s.camX, 60, WORLD_W - 60);
  const z = clamp((m.y - GROUND_TOP) / (GROUND_BOT - GROUND_TOP), 0.05, 0.95);
  const total = s.special === 'volley' ? 34 : s.special === 'barrage' ? 5 : 7;
  s.strikes.push({ kind: s.special, x, z, t: s.special === 'volley' ? 0.9 : 1.6, fired: 0, total });
  s.specialCd = s.special === 'volley' ? 26 : 38;
  feed(s, s.special === 'volley' ? 'Archers — loose!' : s.special === 'barrage' ? 'Guns — fire!' : 'Artillery strike incoming!', '#fde68a', true);
  soundAt(s, s.special === 'volley' ? 'horn' : 'shout', u.x, 0.8);
  if (s.special === 'artillery') { s.planes.push({ x: -200, y: 90 + s.rng() * 60, vx: 520, t: 6 }); bsfx('plane', 0.8); }
  return true;
}
function stepStrikes(s: BattleState, dt: number) {
  for (const k of s.strikes) {
    k.t -= dt;
    if (k.t > 0) continue;
    const every = k.kind === 'volley' ? 0.035 : 0.38;
    while (k.fired < k.total && k.t <= -k.fired * every) {
      const tx = k.x + (s.rng() - 0.5) * (k.kind === 'volley' ? 260 : 300), tz = clamp(k.z + (s.rng() - 0.5) * 0.45, 0.02, 0.98);
      if (k.kind === 'volley') {
        const flight = 1.25; const fromX = tx - 700 + s.rng() * 80;
        s.proj.push({ id: s.uid++, kind: 'arrow', team: 0, owner: s.player.id, x: fromX, z: tz, h: 60, vx: (tx - fromX) / flight, vz: 0, vh: (0.5 * GRAVITY * 0.75 * flight * flight - 60) / flight, dmg: 44, life: 4, stuck: false, hitIds: [], fuse: 0, bounces: 0, whistled: false, safeTeam: -1 });
        if (k.fired % 6 === 0) soundAt(s, 'bow', tx - 400, 0.5);
      } else if (k.kind === 'barrage') {
        s.proj.push({ id: s.uid++, kind: 'shell', team: 2, owner: s.player.id, x: tx - 180, z: tz, h: 700, vx: 180, vz: 0, vh: -800, dmg: 130, life: 4, stuck: false, hitIds: [], fuse: 0, bounces: 0, whistled: true, safeTeam: 0 });
        soundAt(s, 'cannon', s.camX + 40, 0.6);
      } else fireHeavy(s, 'shell', 0, tx, tz, 0);
      k.fired++;
    }
  }
  s.strikes = s.strikes.filter((k) => k.fired < k.total || k.t > -2);
  for (const p of s.planes) { p.x += p.vx * dt; p.t -= dt; }
  s.planes = s.planes.filter((p) => p.t > 0);
}

// ---------------------------------------------------------------- projectile physics
function stepProjectiles(s: BattleState, dt: number) {
  for (const p of s.proj) {
    p.life -= dt;
    if (p.stuck) continue;
    const g = p.kind === 'bullet' ? 60 : p.kind === 'ball' ? 160 : p.kind === 'shell' ? 0 : GRAVITY * (p.kind === 'arrow' || p.kind === 'bolt' ? 0.75 : 1);
    p.vh -= g * dt;
    if (p.kind === 'arrow' || p.kind === 'bolt') p.vx += s.wind * 0.3 * dt;
    p.x += p.vx * dt; p.h += p.vh * dt; p.z = clamp(p.z + p.vz * dt, -0.05, 1.05);
    if (p.kind === 'shell' && !p.whistled && p.h < 700) { p.whistled = true; soundAt(s, 'whistle', p.x, 1); }
    if (p.kind === 'grenade') {
      p.fuse -= dt;
      if (p.h <= 0) { p.h = 0; if (Math.abs(p.vh) > 120) { p.vh = -p.vh * 0.35; p.vx *= 0.5; p.vz *= 0.5; } else { p.vh = 0; p.vx *= 0.85; p.vz *= 0.85; } }
      if (p.fuse <= 0) { explode(s, p.x, p.z, 0, 150, p.dmg, s.units.find((u) => u.id === p.owner) ?? null); p.life = -1; }
      continue;
    }
    if (p.kind === 'boulder' || p.kind === 'shell') {
      if (p.h <= 0) { explode(s, p.x, p.z, 0, p.kind === 'shell' ? 190 : 140, p.dmg, p.owner === s.player.id ? s.player : null, p.safeTeam); p.life = -1; }
      continue;
    }
    if (p.kind === 'cannonball') {
      if (p.h <= 0) {
        p.h = 0; p.bounces++;
        for (let i = 0; i < 8; i++) part(s, 'dust', p.x, p.z, 0, (s.rng() - 0.5) * 200, 0, 60 + s.rng() * 140, 1, 10 + s.rng() * 10, '#8a7a5c');
        s.shake = Math.max(s.shake, 4);
        if (p.bounces > 3) { p.life = -1; continue; }
        p.vh = Math.abs(p.vh) * 0.45; p.vx *= 0.75;
      }
      for (const v of s.units) {
        if (v.dead || p.hitIds.includes(v.id) || Math.abs(v.z - p.z) > 0.07 || Math.abs(v.x - p.x) > 18 || p.h > unitHeight(v) + v.h) continue;
        p.hitIds.push(v.id); damage(s, v, p.dmg, null, 'blast', Math.sign(p.vx));
      }
      continue;
    }
    // arrows, bolts, javelins, stones, balls, bullets
    let hit = false;
    for (const v of s.units) {
      if (v.dead || v.team === p.team || p.hitIds.includes(v.id)) continue;
      const sc = depthScale(v.z);
      if (Math.abs(v.z - p.z) > 0.05 + (v.horse ? 0.02 : 0)) continue;
      if (Math.abs(v.x - p.x) > (v.horse ? 28 : 12) * sc + Math.abs(p.vx) * dt * 0.5) continue;
      if (p.h < v.h - 2 || p.h > v.h + unitHeight(v)) continue;
      p.hitIds.push(v.id);
      const owner = s.units.find((u) => u.id === p.owner) ?? null;
      const head = p.h > v.h + unitHeight(v) * 0.82;
      damage(s, v, p.dmg * (head ? 1.7 : 1), owner, p.kind === 'bullet' || p.kind === 'ball' ? 'bullet' : 'arrow', Math.sign(p.vx), head);
      if (head && owner?.isPlayer && v.dead) feed(s, 'Headshot!', '#fca5a5');
      soundAt(s, p.kind === 'bullet' || p.kind === 'ball' ? 'hit' : 'arrowhit', v.x, 0.5);
      hit = true;
      break;
    }
    if (hit) { p.life = -1; continue; }
    if (p.h <= 0) {
      if (p.kind === 'arrow' || p.kind === 'bolt' || p.kind === 'javelin') { p.stuck = true; p.h = 0; p.life = 14; }
      else {
        for (let i = 0; i < 3; i++) part(s, 'dust', p.x, p.z, 0, (s.rng() - 0.5) * 120, 0, 40 + s.rng() * 80, 0.6, 4 + s.rng() * 5, '#9a8a6a');
        p.life = -1;
      }
    }
    if (p.x < -200 || p.x > WORLD_W + 200) p.life = -1;
  }
  s.proj = s.proj.filter((p) => p.life > 0);
  if (s.proj.length > 300) s.proj = s.proj.filter((p, i) => !p.stuck || i > s.proj.length - 220);
}

// ---------------------------------------------------------------- AI
function nearestEnemy(s: BattleState, u: Unit): Unit | null {
  let best: Unit | null = null, bd = Infinity;
  for (const v of s.units) {
    if (v.team === u.team || !fighting(v)) continue;
    let d = Math.abs(v.x - u.x) + Math.abs(v.z - u.z) * 500;
    if (v.isPlayer) d *= 0.8; // the hero draws attention
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
function ballisticAngle(dx: number, speed: number, g: number): number {
  const k = (g * Math.abs(dx)) / (speed * speed);
  return k >= 1 ? Math.PI / 4 : 0.5 * Math.asin(k);
}

function think(s: BattleState, u: Unit, dt: number) {
  u.thinkT -= dt;
  const T = s.teams[u.team];
  const dir = u.team === 0 ? 1 : -1;
  if (disabled(u)) { u.vx *= 0.85; u.vz = 0; return; }
  if (u.routing) {
    u.vx = -dir * (u.horse ? 300 : 170); u.vz = 0; u.facing = (-dir) as 1 | -1;
    if (u.x < -60 || u.x > WORLD_W + 60) { u.dead = true; u.deadT = 999; T.fled++; }
    return;
  }
  if (u.thinkT <= 0) {
    u.thinkT = 0.25 + s.rng() * 0.2;
    const t = nearestEnemy(s, u); u.target = t ? t.id : null;
    if (T.morale < 22 && s.rng() < (T.morale <= 0 ? 0.5 : 0.04) && u.role !== 'general') { u.routing = true; u.atkT = 0; return; }
  }
  const tgt = u.target !== null ? s.units.find((v) => v.id === u.target) : null;
  const base = u.horse ? 230 : 95;
  const ordered = u.team === 0 ? s.order : 'charge';
  const speed = base * (u.inspiredT > 0 ? 1.2 : 1) * (ordered === 'charge' && u.team === 0 ? 1.1 : 1);
  // troop orders from the hero
  if (u.team === 0 && ordered === 'follow' && !s.player.dead) {
    const px = s.player.x - dir * (70 + (u.seed % 5) * 28), pz = clamp(s.player.z + ((u.seed % 7) - 3) * 0.07, 0.05, 0.95);
    const near = tgt && fighting(tgt) && Math.abs(tgt.x - u.x) < 150 && Math.abs(tgt.z - u.z) < 0.2;
    if (!near && Math.abs(px - u.x) > 40) { u.vx = clamp((px - u.x) * 2, -speed * 1.3, speed * 1.3); u.vz = clamp((pz - u.z) * 2, -0.4, 0.4); u.facing = (u.vx >= 0 ? 1 : -1) as 1 | -1; return; }
  }
  if (!tgt || !fighting(tgt)) { u.vx = dir * speed * 0.5; u.vz = 0; u.facing = dir as 1 | -1; if (u.team === 0 && ordered === 'hold' && u.x * dir > s.holdX * dir) u.vx = 0; return; }
  const dx = tgt.x - u.x, dz = tgt.z - u.z, adx = Math.abs(dx);
  const w = curWeapon(u);
  const ranged = w.def.kind !== 'melee';
  // generals hold back until the line thins
  if (u.role === 'general' && !u.isPlayer) {
    const own = s.units.filter((v) => v.team === u.team && fighting(v) && !v.isPlayer).length;
    if (own > 6 && T.morale > 55 && adx > 160) { u.vx = 0; u.vz = (0.5 - u.z) * 0.5; u.facing = Math.sign(dx) as 1 | -1; return; }
  }
  if (u.role === 'standard') {
    const own = s.units.filter((v) => v.team === u.team && fighting(v) && v.role !== 'standard');
    const cx = own.length ? own.reduce((a, b) => a + b.x, 0) / own.length - dir * 90 : u.x;
    u.vx = clamp((cx - u.x) * 1.5, -speed, speed); u.vz = (0.5 - u.z) * 0.6; u.facing = dir as 1 | -1;
    if (adx < 60) attack(s, u, 0, null, 1, true);
    return;
  }
  u.facing = (dx >= 0 ? 1 : -1) as 1 | -1;
  u.meleeMode = ranged && adx < (u.horse ? 0 : 70) && Math.abs(dz) < 0.12;
  const holdLine = (v: number) => (u.team === 0 && ordered === 'hold' && v * dir > 0 && u.x * dir > s.holdX * dir - 10 ? 0 : v);
  if (ranged && !u.meleeMode) {
    const pref = u.role === 'mg' ? 520 : u.role === 'horsearcher' ? 380 : w.def.kind === 'throw' || w.def.kind === 'grenade' ? 260 : 460;
    const engaged = adx < pref + 120;
    if (u.role === 'horsearcher') { if (adx < 260) u.vx = -Math.sign(dx) * speed; else if (adx > pref + 100) u.vx = Math.sign(dx) * speed; else u.vx = Math.sign(dx) * speed * 0.15; }
    else if (adx > pref + 80) u.vx = Math.sign(dx) * speed; else if (adx < pref * 0.5 && u.role !== 'mg') u.vx = -Math.sign(dx) * speed * 0.6; else u.vx = 0;
    u.vx = holdLine(u.vx);
    u.vz = clamp(dz * 0.5 + u.strafe * 0.02, -0.3, 0.3);
    if (engaged && u.reloadT <= 0) {
      const sp = w.def.speed ?? 900;
      const g = w.def.proj === 'bullet' ? 60 : w.def.proj === 'ball' ? 160 : w.def.proj === 'grenade' || w.def.proj === 'javelin' || w.def.proj === 'stone' ? GRAVITY : GRAVITY * 0.75;
      let ang = ballisticAngle(adx, sp, g);
      const hp = handPos(u);
      ang += Math.atan2((tgt.h + unitHeight(tgt) * 0.55) - hp.h, adx) * 0.6;
      u.aim = ang;
      if (u.cd <= 0) attack(s, u, ang, tgt.z);
    }
    if (w.def.mag && w.mag <= 0) startReload(s, u);
    if (u.role === 'grenadier' && adx < 300 && adx > 120 && s.rng() < dt * 0.15 && u.weapons[1]) {
      const prev = u.wi; u.wi = 1; u.cd = 0; attack(s, u, ballisticAngle(adx, 620, GRAVITY) + 0.15, tgt.z); u.wi = prev;
    }
    return;
  }
  const reach = (u.meleeMode ? u.melee.reach : w.def.reach ?? 40)! * depthScale(u.z) * (u.horse ? 1.2 : 1);
  if (u.horse && u.role === 'cavalry') {
    if (u.passT > 0) { u.passT -= dt; u.vx = u.facing * speed; return; }
    u.vx = holdLine(Math.sign(dx) * speed); u.vz = clamp(dz * 2, -0.5, 0.5);
    if (adx < reach && Math.abs(dz) < 0.08) { attack(s, u, 0, null, 1, true); u.passT = 0.7 + s.rng() * 0.4; }
    return;
  }
  if (adx > reach * 0.8) u.vx = holdLine(Math.sign(dx) * speed); else u.vx = adx < reach * 0.35 ? -Math.sign(dx) * speed * 0.4 : 0;
  u.vz = clamp(dz * 2.2, -0.45, 0.45);
  // veterans and generals sometimes wind up heavy blows against the hero
  const heavy = tgt.isPlayer && (u.role === 'general' || s.rng() < 0.12 * s.difficulty);
  if (adx < reach + 6 && Math.abs(dz) < 0.08 && u.cd <= 0) attack(s, u, 0, null, 1, u.meleeMode, heavy ? 'heavy' : 'melee');
}

// ---------------------------------------------------------------- player
function playerControl(s: BattleState, u: Unit, inp: Input, dt: number) {
  if (u.dead) return;
  // orders, rally and specials work even mid-swing
  if (inp.order && inp.order !== s.order) {
    s.order = inp.order; if (inp.order === 'hold') s.holdX = u.x + u.facing * 40;
    feed(s, inp.order === 'charge' ? 'Order: Charge!' : inp.order === 'hold' ? 'Order: Hold the line!' : 'Order: Follow me!', '#93c5fd');
    soundAt(s, inp.order === 'charge' ? 'cheer' : 'shout', u.x, 0.8);
  }
  if (inp.special) triggerSpecial(s, inp);
  if (inp.rally && s.rallyCd <= 0) {
    s.rallyCd = 28; s.rallyFx = 1.2;
    const T = s.teams[0]; T.morale = clamp(T.morale + 18, 0, 100);
    for (const v of s.units) if (v.team === 0 && !v.dead && Math.abs(v.x - u.x) < 420) { v.inspiredT = 9; v.routing = false; }
    bsfx('horn', 1); soundAt(s, 'cheer', u.x, 0.7);
    feed(s, 'Rally! Nearby troops are inspired', '#fde68a');
  }
  if (disabled(u)) { u.vx *= Math.pow(0.02, dt); u.vz = 0; u.blocking = false; u.charging = false; u.charge = 0; return; }
  const w = curWeapon(u);
  const rangedW = w.def.kind !== 'melee';
  // guard / aim-down-sights on the alternate button
  const wantsBlock = inp.alt && (!rangedW || u.shield) && !(rangedW && !u.shield);
  if (wantsBlock && !u.blocking && u.atkT <= 0) { u.blocking = true; u.blockStart = s.t; }
  if (!inp.alt || u.atkT > 0) u.blocking = false;
  u.ads = inp.alt && rangedW && !u.blocking;
  const sprinting = inp.sprint && u.stamina > 2 && !u.blocking && !u.ads;
  const run = sprinting ? 1.6 : 1;
  const speed = (u.horse ? 270 : 180) * run;
  let mx = 0, mz = 0;
  if (inp.left) mx -= 1; if (inp.right) mx += 1; if (inp.up) mz -= 1; if (inp.down) mz += 1;
  if (sprinting && (mx || mz)) { u.stamina = Math.max(0, u.stamina - 16 * dt); u.staminaT = 0.6; }
  // dodge roll (or a horse's sidestep)
  if (inp.dodge && u.dodgeT <= 0 && useStamina(u, 26)) {
    u.dodgeT = u.horse ? 0.35 : 0.42; u.atkT = 0; u.drawing = false; u.blocking = false; u.charging = false;
    const dirx = mx || u.facing;
    u.vx = dirx * (u.horse ? 520 : 470); u.vz = mz * 0.9;
    soundAt(s, 'whoosh', u.x, 0.7);
    for (let i = 0; i < 6; i++) part(s, 'dust', u.x, u.z, 0, -dirx * (40 + s.rng() * 80), 0, 20 + s.rng() * 40, 0.8, 8, '#a69373');
  }
  if (u.dodgeT > 0) { u.dodgeT -= dt; u.vx *= Math.pow(0.15, dt); return; }
  const maxV = speed * ((u.atkKind === 'melee' || u.atkKind === 'heavy') && u.atkT > 0 ? 0.5 : 1) * (u.drawing || u.ads ? 0.45 : 1) * (u.blocking ? 0.5 : 1) * (u.reloadT > 0 ? 0.6 : 1) * (u.charging ? 0.6 : 1);
  if (mx) u.vx = clamp(u.vx + mx * speed * 7 * dt, -maxV, maxV); else u.vx *= Math.pow(0.0005, dt);
  if (Math.abs(u.vx) > maxV) u.vx *= Math.pow(0.02, dt);
  u.vz = mz * 0.42 * run;
  // aim at the cursor (scene space)
  const m = toScene(s, inp.mouseX, inp.mouseY);
  const hp = handPos(u);
  const hx = hp.x - s.camX, hy = groundY(u.z) - hp.h;
  const dx = m.x - hx, dy = hy - m.y;
  if (u.atkT <= 0 || u.atkKind === 'shoot') u.facing = (dx >= 0 ? 1 : -1) as 1 | -1;
  u.aim = clamp(Math.atan2(dy, Math.abs(dx)), -0.9, 1.3);
  // weapon selection
  if (inp.slot !== null && inp.slot < u.weapons.length && inp.slot !== u.wi && u.reloadT <= 0) { u.wi = inp.slot; u.drawing = false; u.draw = 0; u.charging = false; bsfx('reload', 0.4); }
  if (inp.cycle) { u.wi = (u.wi + inp.cycle + u.weapons.length) % u.weapons.length; u.drawing = false; u.draw = 0; u.charging = false; bsfx('reload', 0.4); }
  if (inp.reload) startReload(s, u);
  // assisted lane targeting: the enemy closest to the cursor
  let tz: number | null = null; let bd = 140;
  for (const v of s.units) {
    if (v.team === u.team || v.dead) continue;
    const vx = v.x - s.camX, vy = groundY(v.z) - v.h - unitHeight(v) * 0.5;
    const d = Math.hypot(vx - m.x, vy - m.y);
    if (d < bd && Math.sign(v.x - u.x) === u.facing) { bd = d; tz = v.z; }
  }
  if (tz === null) tz = clamp(u.z + ((m.y - hy) / (GROUND_BOT - GROUND_TOP)) * 0.25, 0, 1);
  if (inp.meleePressed) attack(s, u, 0, null, 1, true, u.shield || w.def.kind !== 'melee' ? 'bash' : 'melee');
  const cur = curWeapon(u).def;
  if (u.blocking) return;
  if (cur.kind === 'melee') {
    // tap = light strike, hold = charged heavy blow
    if (inp.firePressed && u.atkT <= 0 && u.cd <= 0) { u.charging = true; u.charge = 0; }
    if (u.charging && inp.fire) u.charge = Math.min(1, u.charge + dt / 0.7);
    if (u.charging && (inp.fireReleased || !inp.fire)) {
      u.charging = false;
      attack(s, u, 0, null, 1, false, u.charge > 0.35 ? 'heavy' : 'melee');
      u.charge = 0;
    }
  } else if (cur.charge) {
    if (inp.fire && u.cd <= 0 && curWeapon(u).ammo > 0) { u.drawing = true; u.draw = clamp(u.draw + dt / 0.75, 0, 1); }
    if (inp.fireReleased && u.drawing) { if (u.draw > 0.15) attack(s, u, u.aim, tz, u.draw); u.drawing = false; u.draw = 0; }
  } else if (cur.auto ? inp.fire : inp.firePressed) attack(s, u, u.aim, tz);
}

// ---------------------------------------------------------------- main step
export function step(s: BattleState, inp: Input, rawDt: number): void {
  rawDt = Math.min(0.05, rawDt);
  // banners & feeds run on real time
  if (s.banner) { s.banner.t -= rawDt; if (s.banner.t <= 0) s.banner = null; }
  for (const f of s.feed) f.t -= rawDt;
  s.feed = s.feed.filter((f) => f.t > 0);
  s.hitMark.t = Math.max(0, s.hitMark.t - rawDt);
  for (const d of s.dmgInd) d.t -= rawDt;
  s.dmgInd = s.dmgInd.filter((d) => d.t > 0);
  s.parryFx = Math.max(0, s.parryFx - rawDt);
  s.shake = Math.max(0, s.shake - rawDt * 30);
  // cinematic intro: pan from the enemy host to the hero, then hand over control
  if (s.intro > 0) {
    s.intro -= rawDt;
    if (inp.skip) s.intro = 0;
    const target = clamp(s.player.x - VIEW_W * 0.42, 0, WORLD_W - VIEW_W);
    const k = 1 - clamp(s.intro / 3.6, 0, 1);
    const e = k * k * (3 - 2 * k);
    s.camX = (WORLD_W - VIEW_W - 300) * (1 - e) + target * e;
    s.zoom = 1 + 0.08 * (1 - e);
    s.pivotX = VIEW_W / 2; s.pivotY = GROUND_TOP + 120;
    if (s.intro <= 0) { soundAt(s, 'cheer', s.player.x, 1); bsfx('horn', 0.9); s.teams[0].spawnT = 1; s.teams[1].spawnT = 1; }
    for (const u of s.units) { u.walk += Math.sin(s.t + u.seed) * 0.002; }
    s.t += 0; return;
  }
  // hit-stop freezes the simulation for a few frames to sell impacts
  if (s.hitStop > 0) { s.hitStop -= rawDt; camera(s, inp, rawDt); return; }
  if (s.slowT > 0) s.slowT -= rawDt;
  const slow = s.slowT > 0 ? 0.3 : 1;
  const dt = rawDt * s.timeScale * slow;
  s.t += dt;
  s.rallyCd = Math.max(0, s.rallyCd - dt); s.rallyFx = Math.max(0, s.rallyFx - dt);
  s.specialCd = Math.max(0, s.specialCd - dt);
  s.streakT = Math.max(0, s.streakT - dt);

  playerControl(s, s.player, inp, dt);

  for (const u of s.units) {
    if (u.dead) {
      u.deadT += dt;
      // bodies thrown by blasts tumble and slide
      if (u.h > 0 || u.vh > 0) { u.vh -= GRAVITY * dt; u.h = Math.max(0, u.h + u.vh * dt); u.x += u.vx * dt; if (u.h <= 0) { u.vh = 0; u.vx *= 0.3; u.spin = 0; } }
      else { u.x += u.vx * dt; u.vx *= Math.pow(0.01, dt); }
      continue;
    }
    if (!u.isPlayer) think(s, u, dt);
    // timers
    u.cd = Math.max(0, u.cd - dt); u.hitT = Math.max(0, u.hitT - dt); u.inspiredT = Math.max(0, u.inspiredT - dt); u.blockT = Math.max(0, u.blockT - dt);
    u.stunT = Math.max(0, u.stunT - dt); u.knockT = Math.max(0, u.knockT - dt);
    u.recoil = Math.max(0, u.recoil - dt * 8);
    if (u.reloadT > 0) { u.reloadT -= dt; if (u.reloadT <= 0) { u.reloadT = 0; finishReload(u); } }
    if (u.atkT > 0) {
      u.atkT -= dt;
      const hitAt = u.atkKind === 'heavy' ? 0.42 : 0.55;
      if ((u.atkKind === 'melee' || u.atkKind === 'heavy' || u.atkKind === 'bash') && !u.hitDone && u.atkT <= u.atkDur * hitAt) { u.hitDone = true; meleeHit(s, u); }
      if (u.atkT <= 0) { u.atkT = 0; u.atkKind = 'none'; }
    }
    if (u.isPlayer) {
      u.regenT -= dt; if (u.regenT <= 0 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 14 * dt);
      u.staminaT -= dt; if (u.staminaT <= 0 && !u.blocking) u.stamina = Math.min(100, u.stamina + 30 * dt);
    }
    // movement
    u.x += u.vx * dt; u.z = clamp(u.z + u.vz * dt, 0.02, 0.98);
    if (!u.routing) u.x = clamp(u.x, 30, WORLD_W - 30);
    u.vh -= GRAVITY * dt; u.h = Math.max(0, u.h + u.vh * dt); if (u.h <= 0) u.vh = 0;
    if (!u.isPlayer && disabled(u)) u.vx *= Math.pow(0.05, dt);
    const moving = Math.abs(u.vx) > 12 || Math.abs(u.vz) > 0.02;
    if (moving) u.walk += (Math.abs(u.vx) + Math.abs(u.vz) * 300) * dt * (u.horse ? 0.045 : 0.07);
    if (u.horse && moving && Math.abs(u.vx) > 150 && s.rng() < dt * 6) soundAt(s, 'gallop', u.x, 0.35);
    if (moving && s.rng() < dt * (u.horse ? 6 : 1.2)) part(s, 'dust', u.x - u.facing * 6, u.z, 0, -u.vx * 0.1 + s.wind * 0.2, 0, 20 + s.rng() * 30, 0.8, u.horse ? 10 : 5, '#a69373');
  }
  // keep soldiers from stacking
  const live = s.units.filter(alive);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    if ((a.isPlayer && a.dodgeT > 0) || (b.isPlayer && b.dodgeT > 0)) continue;
    const dx = b.x - a.x, dz = (b.z - a.z) * 300;
    const min = (a.horse || b.horse ? 30 : 16);
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 0.0001) {
      const d = Math.sqrt(d2); const push = (min - d) * 0.5 / d;
      const pa = a.isPlayer ? 0.3 : 1, pb = b.isPlayer ? 0.3 : 1;
      a.x -= dx * push * pa; b.x += dx * push * pb;
      a.z = clamp(a.z - (dz * push / 300) * pa, 0.02, 0.98); b.z = clamp(b.z + (dz * push / 300) * pb, 0.02, 0.98);
    }
  }
  stepProjectiles(s, dt);
  stepStrikes(s, dt);
  artillery(s, 0, dt); artillery(s, 1, dt);
  // particles
  for (const p of s.parts) {
    p.life -= dt;
    if (p.kind === 'smoke') { p.vx *= 0.97; p.vh *= 0.97; p.size += dt * 9; }
    else if (p.kind === 'fire') { p.size *= 0.96; p.vh += 30 * dt; }
    else if (p.kind === 'ember') { p.vh -= 200 * dt; p.vx *= 0.98; }
    else if (p.kind !== 'ring' && p.kind !== 'flash' && p.kind !== 'muzzle' && p.kind !== 'slash') p.vh -= GRAVITY * 0.6 * dt;
    p.x += p.vx * dt; p.h += p.vh * dt; p.z += p.vz * dt; p.rot += dt * 4;
    if (p.h < 0 && (p.kind === 'debris' || p.kind === 'blood' || p.kind === 'spark' || p.kind === 'dust' || p.kind === 'ember')) { p.h = 0; p.vh = 0; p.vx *= 0.6; if (p.kind === 'spark' || p.kind === 'ember') p.life = Math.min(p.life, 0.2); }
  }
  s.parts = s.parts.filter((p) => p.life > 0);
  for (const d of s.decals) d.life -= dt;
  s.decals = s.decals.filter((d) => d.life > 0);
  // reinforcements
  for (const team of [0, 1] as const) {
    const T = s.teams[team];
    T.spawnT -= dt;
    const onField = s.units.filter((u) => u.team === team && fighting(u) && !u.isPlayer).length;
    if (T.reserve > 0 && onField < s.fieldMax && T.spawnT <= 0 && T.morale > 15 && !s.over) {
      T.spawnT = 1.1 + s.rng() * 0.8; T.reserve--;
      const own = s.units.filter((u) => u.team === team && fighting(u));
      const rear = own.length ? (team === 0 ? Math.min(...own.map((u) => u.x)) - 160 : Math.max(...own.map((u) => u.x)) + 160) : (team === 0 ? 200 : WORLD_W - 200);
      let edge = team === 0 ? Math.min(rear, s.camX - 80) : Math.max(rear, s.camX + VIEW_W + 80);
      if (edge < 40 || edge > WORLD_W - 40) edge = clamp(rear, 40, WORLD_W - 40);
      makeUnit(s, team, pickTemplate(s, team), edge, 0.05 + s.rng() * 0.9);
    }
    const fieldNow = s.units.filter((u) => u.team === team && fighting(u)).length;
    if (!T.routedAnnounced && T.morale < 22 && fieldNow > 0) { T.routedAnnounced = true; s.banner = { text: team === 1 ? 'The enemy line is breaking!' : 'Our line is wavering!', sub: team === 1 ? 'Press the attack' : 'Rally your troops [E]', t: 3 }; }
  }
  if (s.units.length > 140) s.units = s.units.filter((u) => !u.dead || u.deadT < 30 || u.isPlayer);
  camera(s, inp, rawDt);
  // victory / defeat
  if (!s.over) {
    for (const team of [0, 1] as const) {
      const T = s.teams[team];
      const field = s.units.filter((u) => u.team === team && fighting(u)).length;
      if (field === 0 && T.reserve === 0) { s.over = { winner: team === 0 ? 1 : 0, reason: T.fled > T.dead * 0.3 ? 'routed' : 'destroyed' }; break; }
      if (T.morale <= 0 && s.units.filter((u) => u.team === team && !u.dead && !u.routing).length <= 1) { s.over = { winner: team === 0 ? 1 : 0, reason: 'routed' }; break; }
    }
    if (!s.over && s.t > 480) s.over = { winner: s.teams[0].morale >= s.teams[1].morale ? 0 : 1, reason: 'time' };
    if (s.over) {
      s.timeScale = 1; s.overT = 0; s.slowT = 1.6;
      if (!s.player.dead) s.focus = { x: s.player.x, z: s.player.z, t: 3 };
      s.banner = { text: s.over.winner === 0 ? 'Victory' : 'Defeat', sub: s.over.winner === 0 ? (s.over.reason === 'routed' ? '{name} flees the field' : '{name} is shattered') : '{name} is driven from the field', vars: { name: s.teams[s.over.winner === 0 ? 1 : 0].cfg.name }, t: 99 };
      bsfx(s.over.winner === 0 ? 'fanfare' : 'dirge', 1);
      if (s.over.winner === 0) soundAt(s, 'cheer', s.player.x, 1);
    }
  } else s.overT += rawDt;
}

function camera(s: BattleState, inp: Input, rawDt: number) {
  if (s.focus) { s.focus.t -= rawDt; if (s.focus.t <= 0) s.focus = null; }
  const p = s.player;
  const focusUnit = p.dead ? (s.units.find((u) => u.team === 0 && fighting(u)) ?? p) : p;
  const fx = s.focus ? s.focus.x : focusUnit.x;
  const lead = !s.focus && focusUnit.isPlayer ? (inp.mouseX - VIEW_W / 2) * (p.ads ? 0.5 : 0.25) : 0;
  const target = clamp(fx - VIEW_W * 0.45 + lead, 0, WORLD_W - VIEW_W);
  s.camX += (target - s.camX) * Math.min(1, rawDt * (s.focus ? 6 : 4));
  // zoom: tighter in close combat, aiming and kill-cams
  let zt = 1;
  if (!p.dead) {
    const close = s.units.some((u) => u.team === 1 && fighting(u) && Math.abs(u.x - p.x) < 220 && Math.abs(u.z - p.z) < 0.3);
    if (close) zt = 1.1;
    if (p.ads) zt = 1.22;
  }
  if (s.focus) zt = 1.32;
  s.zoom += (zt - s.zoom) * Math.min(1, rawDt * 3);
  const fz = s.focus ? s.focus.z : focusUnit.z;
  const px = (s.focus ? s.focus.x : focusUnit.x) - s.camX, py = groundY(fz) - 40;
  s.pivotX += (clamp(px, 200, VIEW_W - 200) - s.pivotX) * Math.min(1, rawDt * 5);
  s.pivotY += (clamp(py, GROUND_TOP, VIEW_H - 60) - s.pivotY) * Math.min(1, rawDt * 5);
}

export interface BattleResult { won: boolean; kills: number; allyLoss: number; enemyLoss: number; heroFell: boolean; duration: number; accuracy: number }
export function resultOf(s: BattleState): BattleResult {
  const lossFrac = (T: TeamState) => {
    const total = T.deployed + T.reserve;
    return clamp((T.dead + T.fled * 0.4) / Math.max(1, total), 0, 1);
  };
  return { won: s.over?.winner === 0, kills: s.playerKills, allyLoss: lossFrac(s.teams[0]), enemyLoss: lossFrac(s.teams[1]), heroFell: s.heroFell, duration: s.t, accuracy: s.shots ? s.hits / s.shots : 0 };
}
