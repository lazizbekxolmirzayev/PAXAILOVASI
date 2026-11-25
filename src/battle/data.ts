// Era- and culture-specific arsenals, unit templates and looks for the 2D battle mode.
import type { MacroRegion } from '../types/game';

export type BEra = 'ancient' | 'classical' | 'medieval' | 'renaissance' | 'industrial' | 'modern';
export type Culture = 'european' | 'mediterranean' | 'islamic' | 'steppe' | 'eastasian' | 'southasian' | 'american' | 'african';
export const BERAS: BEra[] = ['ancient', 'classical', 'medieval', 'renaissance', 'industrial', 'modern'];
export const CULTURES: Culture[] = ['european', 'mediterranean', 'islamic', 'steppe', 'eastasian', 'southasian', 'american', 'african'];

export type WeaponKind = 'melee' | 'bow' | 'crossbow' | 'sling' | 'throw' | 'gun' | 'grenade';
export type WeaponLook =
  | 'sword' | 'gladius' | 'sabre' | 'dao' | 'spear' | 'halberd' | 'club' | 'axe' | 'knife' | 'lance' | 'rapier'
  | 'bow' | 'longbow' | 'crossbow' | 'sling' | 'javelin'
  | 'arquebus' | 'musket' | 'flintpistol' | 'revolver' | 'rifle' | 'smg' | 'mg' | 'pistol' | 'grenade';
export type ProjKind = 'arrow' | 'bolt' | 'javelin' | 'stone' | 'ball' | 'bullet' | 'grenade' | 'shell' | 'cannonball' | 'boulder';

export interface WeaponDef {
  id: string; name: string; kind: WeaponKind; look: WeaponLook;
  dmg: number;
  cd: number;            // seconds between attacks / shots
  reach?: number;        // melee reach in px
  speed?: number;        // projectile speed px/s
  spread?: number;       // radians
  mag?: number;          // rounds per magazine (guns)
  reload?: number;       // seconds
  ammo?: number;         // reserve (arrows, javelins, grenades, spare rounds)
  auto?: boolean;        // hold to fire
  charge?: boolean;      // hold to draw (bows)
  proj?: ProjKind;
  smoke?: boolean;       // black-powder smoke
  twoHanded?: boolean;
}

export const WEAPONS: Record<string, WeaponDef> = {
  sword:      { id: 'sword', name: 'Sword', kind: 'melee', look: 'sword', dmg: 34, cd: 0.55, reach: 46 },
  gladius:    { id: 'gladius', name: 'Gladius', kind: 'melee', look: 'gladius', dmg: 32, cd: 0.42, reach: 38 },
  sabre:      { id: 'sabre', name: 'Sabre', kind: 'melee', look: 'sabre', dmg: 36, cd: 0.5, reach: 48 },
  dao:        { id: 'dao', name: 'Dao', kind: 'melee', look: 'dao', dmg: 35, cd: 0.5, reach: 46 },
  rapier:     { id: 'rapier', name: 'Rapier', kind: 'melee', look: 'rapier', dmg: 30, cd: 0.38, reach: 54 },
  spear:      { id: 'spear', name: 'Spear', kind: 'melee', look: 'spear', dmg: 30, cd: 0.7, reach: 70, twoHanded: true },
  halberd:    { id: 'halberd', name: 'Halberd', kind: 'melee', look: 'halberd', dmg: 46, cd: 0.95, reach: 72, twoHanded: true },
  club:       { id: 'club', name: 'Macuahuitl', kind: 'melee', look: 'club', dmg: 38, cd: 0.6, reach: 44 },
  axe:        { id: 'axe', name: 'Battle axe', kind: 'melee', look: 'axe', dmg: 42, cd: 0.75, reach: 44 },
  knife:      { id: 'knife', name: 'Combat knife', kind: 'melee', look: 'knife', dmg: 40, cd: 0.4, reach: 32 },
  lance:      { id: 'lance', name: 'Lance', kind: 'melee', look: 'lance', dmg: 60, cd: 1.1, reach: 84, twoHanded: true },
  bow:        { id: 'bow', name: 'Bow', kind: 'bow', look: 'bow', dmg: 34, cd: 0.55, speed: 900, spread: 0.03, ammo: 40, charge: true, proj: 'arrow' },
  compbow:    { id: 'compbow', name: 'Composite bow', kind: 'bow', look: 'bow', dmg: 40, cd: 0.45, speed: 1050, spread: 0.025, ammo: 50, charge: true, proj: 'arrow' },
  longbow:    { id: 'longbow', name: 'Longbow', kind: 'bow', look: 'longbow', dmg: 46, cd: 0.7, speed: 1100, spread: 0.025, ammo: 40, charge: true, proj: 'arrow' },
  crossbow:   { id: 'crossbow', name: 'Crossbow', kind: 'crossbow', look: 'crossbow', dmg: 70, cd: 0.3, speed: 1300, spread: 0.015, mag: 1, reload: 2.2, ammo: 24, proj: 'bolt' },
  sling:      { id: 'sling', name: 'Sling', kind: 'sling', look: 'sling', dmg: 26, cd: 0.8, speed: 850, spread: 0.05, ammo: 40, proj: 'stone' },
  javelin:    { id: 'javelin', name: 'Javelin', kind: 'throw', look: 'javelin', dmg: 60, cd: 0.9, speed: 760, spread: 0.03, ammo: 5, proj: 'javelin' },
  pilum:      { id: 'pilum', name: 'Pilum', kind: 'throw', look: 'javelin', dmg: 70, cd: 0.9, speed: 740, spread: 0.03, ammo: 3, proj: 'javelin' },
  arquebus:   { id: 'arquebus', name: 'Arquebus', kind: 'gun', look: 'arquebus', dmg: 80, cd: 0.4, speed: 1700, spread: 0.06, mag: 1, reload: 3.4, ammo: 30, proj: 'ball', smoke: true, twoHanded: true },
  musket:     { id: 'musket', name: 'Flintlock musket', kind: 'gun', look: 'musket', dmg: 85, cd: 0.4, speed: 1900, spread: 0.045, mag: 1, reload: 2.6, ammo: 40, proj: 'ball', smoke: true, twoHanded: true },
  flintpistol:{ id: 'flintpistol', name: 'Flintlock pistol', kind: 'gun', look: 'flintpistol', dmg: 60, cd: 0.3, speed: 1500, spread: 0.08, mag: 1, reload: 2.2, ammo: 20, proj: 'ball', smoke: true },
  revolver:   { id: 'revolver', name: 'Revolver', kind: 'gun', look: 'revolver', dmg: 48, cd: 0.32, speed: 1900, spread: 0.05, mag: 6, reload: 2.4, ammo: 36, proj: 'bullet', smoke: true },
  rifle:      { id: 'rifle', name: 'Bolt-action rifle', kind: 'gun', look: 'rifle', dmg: 90, cd: 0.9, speed: 2600, spread: 0.012, mag: 5, reload: 2.2, ammo: 60, proj: 'bullet', twoHanded: true },
  smg:        { id: 'smg', name: 'Submachine gun', kind: 'gun', look: 'smg', dmg: 22, cd: 0.085, speed: 2200, spread: 0.07, mag: 32, reload: 2.0, ammo: 160, auto: true, proj: 'bullet', twoHanded: true },
  mg:         { id: 'mg', name: 'Machine gun', kind: 'gun', look: 'mg', dmg: 26, cd: 0.07, speed: 2400, spread: 0.06, mag: 100, reload: 4.5, ammo: 400, auto: true, proj: 'bullet', twoHanded: true },
  pistol:     { id: 'pistol', name: 'Pistol', kind: 'gun', look: 'pistol', dmg: 38, cd: 0.2, speed: 2000, spread: 0.04, mag: 8, reload: 1.5, ammo: 48, proj: 'bullet' },
  grenade:    { id: 'grenade', name: 'Grenade', kind: 'grenade', look: 'grenade', dmg: 140, cd: 1.0, speed: 620, spread: 0.02, ammo: 4, proj: 'grenade' },
};

export type Role = 'melee' | 'spear' | 'ranged' | 'cavalry' | 'horsearcher' | 'gunner' | 'mg' | 'grenadier' | 'standard' | 'general';
export interface UnitTemplate { role: Role; weapon: string; side?: string; shield?: boolean; horse?: boolean; hp: number; armor: number; weight: number }

export type Helmet =
  | 'none' | 'crested' | 'galea' | 'pileus' | 'spangen' | 'greathelm' | 'kettle' | 'turbanhelm' | 'turban' | 'fur' | 'kabuto' | 'conical'
  | 'feather' | 'headband' | 'morion' | 'tricorne' | 'shako' | 'fez' | 'kepi' | 'helmet_round' | 'helmet_flared' | 'cap' | 'crown' | 'peaked';
export type Armor = 'tunic' | 'linen' | 'mail' | 'lamellar' | 'plate' | 'segmentata' | 'robe' | 'coat' | 'uniform' | 'quilted';
export interface Look { helmet: Helmet; armor: Armor; skin: string; beard: boolean; cape: boolean; plume: string | null; gold: boolean; shieldShape: 'round' | 'scutum' | 'kite' | 'oval' | 'none' }

export interface ArmyKit { units: UnitTemplate[]; hero: { weapons: string[]; look: Partial<Look>; horse: boolean }; look: (role: Role) => Look; artillery: 'none' | 'ballista' | 'trebuchet' | 'cannon' | 'howitzer' }

const SKIN: Record<Culture, string[]> = {
  european: ['#e9c3a0', '#e2b48f', '#d9a982'], mediterranean: ['#d7a679', '#c99666', '#ddb089'], islamic: ['#c98f61', '#b97f52', '#d39f74'],
  steppe: ['#c99a6c', '#d2a476', '#b98b5e'], eastasian: ['#e6bf92', '#dcb185', '#d4a77a'], southasian: ['#a8714a', '#9a643e', '#b57d55'],
  american: ['#b07a4e', '#a36d43', '#bd8658'], african: ['#6e4428', '#5e3a22', '#7c4c2e'],
};
export const skinFor = (c: Culture, i: number): string => SKIN[c][Math.abs(i) % 3];

const u = (role: Role, weapon: string, hp: number, armor: number, weight: number, extra: Partial<UnitTemplate> = {}): UnitTemplate => ({ role, weapon, hp, armor, weight, ...extra });

/** Builds the army composition, hero arsenal and look for a culture in an era. */
export function armyKit(era: BEra, culture: Culture): ArmyKit {
  const asian = culture === 'steppe' || culture === 'islamic' || culture === 'southasian';
  let units: UnitTemplate[] = [];
  let hero: ArmyKit['hero'] = { weapons: ['sword', 'bow'], look: {}, horse: false };
  let artillery: ArmyKit['artillery'] = 'none';
  let base: (role: Role) => Look;
  const L = (helmet: Helmet, armor: Armor, o: Partial<Look> = {}): Look => ({ helmet, armor, skin: '', beard: false, cape: false, plume: null, gold: false, shieldShape: 'round', ...o });

  switch (era) {
    case 'ancient': {
      units = [u('spear', 'spear', 100, 0.25, 4, { shield: true }), u('melee', culture === 'mediterranean' || culture === 'european' ? 'sword' : 'axe', 100, 0.2, 2, { shield: true }), u('ranged', culture === 'mediterranean' ? 'sling' : 'bow', 70, 0.05, 3), u('cavalry', 'spear', 140, 0.2, 1, { horse: true })];
      hero = { weapons: ['sword', 'javelin', 'bow'], look: { helmet: culture === 'mediterranean' || culture === 'european' ? 'crested' : culture === 'eastasian' ? 'conical' : 'crown', gold: true, cape: true, plume: '#b3261e' }, horse: false };
      base = (r) => culture === 'mediterranean' || culture === 'european'
        ? L(r === 'ranged' ? 'pileus' : 'crested', r === 'ranged' ? 'tunic' : 'linen', { shieldShape: 'round', plume: r === 'spear' || r === 'melee' ? '#7b1d16' : null, beard: true })
        : culture === 'eastasian' ? L('conical', r === 'ranged' ? 'robe' : 'lamellar', { shieldShape: 'oval' })
        : L(asian ? 'turban' : 'headband', r === 'ranged' ? 'robe' : 'quilted', { shieldShape: 'oval', beard: true });
      artillery = culture === 'mediterranean' ? 'ballista' : 'none';
      break;
    }
    case 'classical': {
      const roman = culture === 'mediterranean' || culture === 'european';
      units = roman
        ? [u('melee', 'gladius', 120, 0.35, 5, { shield: true, side: 'pilum' }), u('ranged', 'bow', 70, 0.1, 2), u('cavalry', 'spear', 140, 0.25, 1, { horse: true })]
        : [u('spear', 'spear', 100, 0.2, 3, { shield: true }), u('ranged', asian ? 'compbow' : 'bow', 70, 0.05, 3), u(asian ? 'horsearcher' : 'cavalry', asian ? 'compbow' : 'spear', 130, 0.2, 2, { horse: true })];
      hero = { weapons: roman ? ['gladius', 'pilum', 'bow'] : ['sword', asian ? 'compbow' : 'bow', 'javelin'], look: { helmet: roman ? 'galea' : 'crown', gold: true, cape: true, plume: roman ? '#c0271b' : '#d9a22b' }, horse: false };
      base = (r) => roman ? L(r === 'ranged' ? 'pileus' : 'galea', r === 'ranged' ? 'tunic' : 'segmentata', { shieldShape: 'scutum', plume: r === 'melee' ? '#a3241a' : null })
        : culture === 'eastasian' ? L('conical', 'lamellar', { shieldShape: 'oval' })
        : L(asian ? 'turbanhelm' : 'headband', asian ? 'mail' : 'quilted', { shieldShape: 'round', beard: true });
      artillery = roman ? 'ballista' : 'none';
      break;
    }
    case 'medieval': {
      if (culture === 'steppe' || culture === 'islamic' || culture === 'southasian') {
        units = [u('melee', 'sabre', 110, 0.3, 3, { shield: true }), u('spear', 'spear', 110, 0.3, 2, { shield: true }), u('ranged', 'compbow', 80, 0.15, 3), u('horsearcher', 'compbow', 140, 0.25, 2, { horse: true }), u('cavalry', 'lance', 160, 0.4, 1, { horse: true })];
        hero = { weapons: ['sabre', 'compbow', 'javelin'], look: { helmet: 'turbanhelm', gold: true, cape: true, plume: '#f2e3b3', armor: 'lamellar' }, horse: false };
        base = (r) => L(r === 'ranged' || r === 'horsearcher' ? (culture === 'steppe' ? 'fur' : 'turban') : 'turbanhelm', r === 'ranged' ? 'quilted' : r === 'cavalry' ? 'lamellar' : 'mail', { shieldShape: 'round', beard: true });
        artillery = 'trebuchet';
      } else if (culture === 'eastasian') {
        units = [u('spear', 'spear', 110, 0.3, 3, { shield: true }), u('melee', 'dao', 110, 0.3, 2, { shield: true }), u('ranged', 'crossbow', 80, 0.15, 3), u('cavalry', 'lance', 150, 0.35, 1, { horse: true })];
        hero = { weapons: ['dao', 'compbow', 'crossbow'], look: { helmet: 'kabuto', gold: true, cape: true, plume: '#c62f2f', armor: 'lamellar' }, horse: false };
        base = (r) => L(r === 'ranged' ? 'conical' : 'kabuto', 'lamellar', { shieldShape: 'oval' });
        artillery = 'trebuchet';
      } else if (culture === 'american' || culture === 'african') {
        units = [u('melee', culture === 'american' ? 'club' : 'axe', 100, 0.15, 4, { shield: true }), u('spear', 'spear', 100, 0.15, 3, { shield: true }), u('ranged', culture === 'american' ? 'sling' : 'bow', 70, 0.05, 3)];
        hero = { weapons: [culture === 'american' ? 'club' : 'axe', 'javelin', culture === 'american' ? 'sling' : 'bow'], look: { helmet: 'feather', gold: true, cape: true, plume: '#2aa37a' }, horse: false };
        base = (r) => L(culture === 'american' ? 'feather' : 'headband', 'quilted', { shieldShape: 'round', plume: culture === 'american' && r !== 'ranged' ? '#d8a02c' : null });
      } else {
        units = [u('melee', 'sword', 120, 0.4, 3, { shield: true }), u('spear', 'spear', 110, 0.3, 2, { shield: true }), u('ranged', culture === 'european' ? 'crossbow' : 'bow', 80, 0.2, 3), u('cavalry', 'lance', 180, 0.55, 1, { horse: true })];
        hero = { weapons: ['sword', 'crossbow', 'javelin'], look: { helmet: 'greathelm', gold: true, cape: true, plume: '#e8e0c8', armor: 'plate' }, horse: false };
        base = (r) => L(r === 'cavalry' ? 'greathelm' : r === 'ranged' ? 'kettle' : 'spangen', r === 'ranged' ? 'quilted' : 'mail', { shieldShape: 'kite' });
        artillery = 'trebuchet';
      }
      break;
    }
    case 'renaissance': {
      if (culture === 'american' || culture === 'african') {
        units = [u('melee', culture === 'american' ? 'club' : 'axe', 105, 0.15, 4, { shield: true }), u('spear', 'spear', 100, 0.15, 3, { shield: true }), u('ranged', culture === 'american' ? 'sling' : 'bow', 70, 0.05, 3), u('ranged', 'javelin', 80, 0.1, 1)];
        hero = { weapons: [culture === 'american' ? 'club' : 'axe', 'javelin', culture === 'american' ? 'sling' : 'bow'], look: { helmet: culture === 'american' ? 'feather' : 'crown', gold: true, cape: true, plume: '#2aa37a' }, horse: false };
        base = (r) => L(culture === 'american' ? 'feather' : 'headband', 'quilted', { shieldShape: 'round', plume: culture === 'american' && r !== 'ranged' ? '#d8a02c' : null });
        break;
      }
      const east = culture === 'islamic' || culture === 'steppe' || culture === 'southasian';
      units = [u('spear', culture === 'european' || culture === 'mediterranean' ? 'halberd' : 'spear', 120, 0.35, 3), u('gunner', 'arquebus', 90, 0.15, 4), u('melee', east ? 'sabre' : culture === 'eastasian' ? 'dao' : 'rapier', 110, 0.3, 2, { shield: east }), u(east ? 'horsearcher' : 'cavalry', east ? 'compbow' : 'sabre', 150, 0.35, 1, { horse: true })];
      hero = { weapons: [east ? 'sabre' : culture === 'eastasian' ? 'dao' : 'rapier', 'arquebus', east ? 'compbow' : 'flintpistol'], look: { helmet: east ? 'turbanhelm' : culture === 'eastasian' ? 'kabuto' : 'morion', gold: true, cape: true, plume: east ? '#f2e3b3' : '#c0271b', armor: east ? 'lamellar' : 'plate' }, horse: false };
      base = (r) => east ? L(r === 'gunner' ? 'turban' : 'turbanhelm', r === 'gunner' ? 'robe' : 'mail', { beard: true, shieldShape: 'round' })
        : culture === 'eastasian' ? L(r === 'gunner' ? 'conical' : 'kabuto', 'lamellar')
        : L(r === 'gunner' ? 'kettle' : 'morion', r === 'gunner' ? 'coat' : 'plate', { plume: r === 'spear' ? '#d9d2bd' : null, shieldShape: 'none' });
      artillery = 'cannon';
      break;
    }
    case 'industrial': {
      const h: Helmet = culture === 'islamic' || culture === 'steppe' ? 'fez' : culture === 'eastasian' ? 'kepi' : culture === 'southasian' ? 'turban' : culture === 'american' ? 'kepi' : 'shako';
      units = [u('gunner', 'musket', 100, 0.05, 6, { side: 'knife' }), u('cavalry', 'sabre', 150, 0.15, 1, { horse: true }), u('melee', 'sabre', 100, 0.05, 1)];
      hero = { weapons: ['sabre', 'revolver', 'musket'], look: { helmet: 'peaked', gold: true, cape: true, plume: null, armor: 'coat' }, horse: false };
      base = (r) => L(h, 'coat', { plume: r === 'gunner' && h === 'shako' ? '#e8e0c8' : null, shieldShape: 'none', beard: r === 'cavalry' });
      artillery = 'cannon';
      break;
    }
    case 'modern': {
      units = [u('gunner', 'rifle', 100, 0.1, 6, { side: 'knife' }), u('gunner', 'smg', 100, 0.1, 3, { side: 'knife' }), u('mg', 'mg', 110, 0.1, 1), u('grenadier', 'rifle', 100, 0.1, 1, { side: 'grenade' })];
      hero = { weapons: ['pistol', 'smg', 'rifle', 'grenade'], look: { helmet: 'peaked', gold: true, cape: false, plume: null, armor: 'uniform' }, horse: false };
      const hm: Helmet = culture === 'european' ? 'helmet_flared' : culture === 'eastasian' ? 'cap' : 'helmet_round';
      base = () => L(hm, 'uniform', { shieldShape: 'none' });
      artillery = 'howitzer';
      break;
    }
  }
  units.push(u('standard', units[0].weapon, 120, 0.2, 0.6, { shield: units[0].shield }));
  units.push(u('general', hero.weapons[0], 420, 0.45, 0, { horse: era !== 'modern' && era !== 'industrial' ? true : false, shield: units[0].shield }));
  return { units, hero, artillery, look: base };
}

export function cultureFor(region: MacroRegion, year: number, lat: number): Culture {
  switch (region) {
    case 'europe': return year < 700 && lat < 46 ? 'mediterranean' : year < 400 ? 'mediterranean' : 'european';
    case 'mena': return year < 630 ? 'mediterranean' : 'islamic';
    case 'centralasia': return year < 1500 ? 'steppe' : 'islamic';
    case 'russia': return year < 1480 ? 'steppe' : 'european';
    case 'eastasia': case 'seasia': return 'eastasian';
    case 'southasia': return 'southasian';
    case 'namerica': case 'latam': return year < 1550 ? 'american' : 'european';
    case 'ssafrica': return 'african';
    default: return year > 1800 ? 'european' : 'african';
  }
}

export function eraOfYear(y: number): BEra {
  return y < 1 ? 'ancient' : y <= 600 ? 'classical' : y < 1450 ? 'medieval' : y < 1750 ? 'renaissance' : y < 1914 ? 'industrial' : 'modern';
}

export const ERA_LABEL: Record<BEra, string> = { ancient: 'Ancient Era', classical: 'Classical Era', medieval: 'Medieval Era', renaissance: 'Renaissance Era', industrial: 'Industrial Era', modern: 'Modern Era' };
export const CULTURE_LABEL: Record<Culture, string> = { european: 'European', mediterranean: 'Mediterranean', islamic: 'Islamic world', steppe: 'Steppe & Turan', eastasian: 'East Asian', southasian: 'South Asian', american: 'Americas', african: 'African' };
export const ERA_YEAR: Record<BEra, number> = { ancient: -480, classical: 100, medieval: 1400, renaissance: 1530, industrial: 1815, modern: 1944 };
