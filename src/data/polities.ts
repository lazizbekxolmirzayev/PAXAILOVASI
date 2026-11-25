import type { FlagDesign, GovernmentId, MacroRegion } from '../types/game';

/** Editorial corrections applied on top of the historical-basemaps dataset where its labels are
 *  known to be coarse. Every correction is shown in-game as an approximation note. */
export interface Correction { key: string; from: string; modern: string[] | '*'; to: string; subjectOf?: string; note: string }
export const CORRECTIONS: Correction[] = [
  { key: '1400', from: 'Great Khanate', modern: ['China', 'Hong Kong S.A.R.', 'Taiwan', 'Macao S.A.R'], to: 'Ming Empire', note: 'Dataset labels China c.1400 as "Great Khanate"; the Ming dynasty ruled China from 1368.' },
  { key: '1400', from: 'Great Khanate', modern: ['Mongolia'], to: 'Northern Yuan', note: 'After 1368 the Yuan court retreated to Mongolia (Northern Yuan).' },
  { key: '1400', from: 'Great Khanate', modern: ['South Korea', 'North Korea'], to: 'Joseon', note: 'Joseon was founded in 1392.' },
  { key: '1400', from: 'Great Khanate', modern: ['Laos'], to: 'Lan Xang', note: 'Lan Xang kingdom (founded 1353).' },
  { key: '1400', from: 'Great Khanate', modern: ['Vietnam'], to: 'Đại Việt', note: 'Northern Vietnam belonged to Đại Việt.' },
  { key: '1400', from: 'English territory', modern: '*', to: 'Kingdom of England', note: 'Renamed for clarity.' },
  { key: '1279', from: 'Great Khanate', modern: ['South Korea', 'North Korea'], to: 'Goryeo', subjectOf: 'Yuan Dynasty', note: 'Goryeo was a Yuan vassal from 1270.' },
  { key: '1279', from: 'Great Khanate', modern: '*', to: 'Yuan Dynasty', note: 'Kublai Khan proclaimed the Yuan dynasty in 1271 and completed the conquest of the Song in 1279.' },
  { key: '1279', from: 'English territory', modern: '*', to: 'Kingdom of England', note: 'Renamed for clarity.' },
];

export interface PolityProfile {
  government?: GovernmentId; color?: string; flag?: FlagDesign; capital?: string; adjective?: string;
  personality?: { aggression: number; diplomacy: number; economy: number; expansion: number };
}
const F = (pattern: FlagDesign['pattern'], c: [string, string, string], emblem: FlagDesign['emblem'] = 'none', emblemColor = '#e8c766'): FlagDesign => ({ pattern, colors: c, emblem, emblemColor });

// Curated look & feel for prominent polities (colours chosen for map legibility, flags simplified).
export const PROFILES: Record<string, PolityProfile> = {
  'Roman Empire': { government: 'empire', color: '#9b2d30', flag: F('border', ['#8e1b1b', '#d4a53c', '#8e1b1b'], 'eagle', '#e9c86a'), capital: 'rome', personality: { aggression: 0.6, diplomacy: 0.4, economy: 0.6, expansion: 0.7 } },
  'Rome': { government: 'republic', color: '#9b2d30', flag: F('border', ['#8e1b1b', '#d4a53c', '#8e1b1b'], 'eagle', '#e9c86a'), capital: 'rome' },
  'Western Roman Empire': { government: 'empire', color: '#a33b35', flag: F('border', ['#8e1b1b', '#d4a53c', '#8e1b1b'], 'eagle', '#e9c86a'), capital: 'milan' },
  'Eastern Roman Empire': { government: 'empire', color: '#7d3c86', flag: F('border', ['#5b1f6a', '#d4a53c', '#5b1f6a'], 'eagle', '#e9c86a'), capital: 'constantinople' },
  'Byzantine Empire': { government: 'empire', color: '#7d3c86', flag: F('quartered', ['#9e1c22', '#e9c86a', '#9e1c22'], 'cross', '#e9c86a'), capital: 'constantinople' },
  'Ottoman Empire': { government: 'empire', color: '#3f7a5a', flag: F('solid', ['#b41f24', '#b41f24', '#b41f24'], 'crescent', '#f5f1e6'), capital: 'bursa', personality: { aggression: 0.7, diplomacy: 0.4, economy: 0.5, expansion: 0.8 } },
  'Timurid Empire': { government: 'khaganate', color: '#9a6a3a', flag: F('solid', ['#1d2a3a', '#1d2a3a', '#1d2a3a'], 'rings', '#e6d3a0'), capital: 'samarkand', personality: { aggression: 0.9, diplomacy: 0.3, economy: 0.4, expansion: 0.9 } },
  'Ming Empire': { government: 'empire', color: '#c9a640', flag: F('solid', ['#c8a02a', '#c8a02a', '#c8a02a'], 'sun', '#9b1b1b'), capital: 'nanjing', personality: { aggression: 0.35, diplomacy: 0.5, economy: 0.8, expansion: 0.3 } },
  'Ming Chinese Empire': { government: 'empire', color: '#c9a640', flag: F('solid', ['#c8a02a', '#c8a02a', '#c8a02a'], 'sun', '#9b1b1b'), capital: 'beijing' },
  'Yuan Dynasty': { government: 'khaganate', color: '#b58f3e', flag: F('solid', ['#2e4f88', '#2e4f88', '#2e4f88'], 'sun', '#f1e3b6'), capital: 'beijing' },
  'Ilkhanate': { government: 'khaganate', color: '#3d7a8f', flag: F('solid', ['#e3d6a8', '#e3d6a8', '#e3d6a8'], 'circle', '#9b1b1b'), capital: 'tabriz' },
  'Khanate of the Golden Horde': { government: 'khaganate', color: '#b5893a', flag: F('solid', ['#c79a2b', '#c79a2b', '#c79a2b'], 'tower', '#5e2a14'), capital: 'sarai' },
  'Chagatai Khanate': { government: 'khaganate', color: '#6f8f3d', flag: F('solid', ['#8c9a4a', '#8c9a4a', '#8c9a4a'], 'circle', '#2b2b1b'), capital: 'samarkand' },
  'Mamluke Sultanate': { government: 'empire', color: '#c4a35a', flag: F('solid', ['#e2c25a', '#e2c25a', '#e2c25a'], 'crescent', '#7a4a10'), capital: 'memphis_cairo' },
  'Holy Roman Empire': { government: 'monarchy', color: '#b4a36a', flag: F('solid', ['#e7c33c', '#e7c33c', '#e7c33c'], 'eagle', '#1b1b1b'), capital: 'prague' },
  'France': { government: 'monarchy', color: '#3b5ba5', flag: F('solid', ['#2b4aa0', '#2b4aa0', '#2b4aa0'], 'crown', '#e9c86a'), capital: 'paris' },
  'Kingdom of England': { government: 'monarchy', color: '#b03a3a', flag: F('quartered', ['#b8262b', '#1d3c8f', '#b8262b'], 'lion', '#e9c86a'), capital: 'london' },
  'United Kingdom of Great Britain and Ireland': { government: 'constitutional_monarchy', color: '#b03a3a', flag: F('saltire', ['#1d3c8f', '#f5f1e6', '#c8102e'], 'cross', '#c8102e'), capital: 'london', personality: { aggression: 0.5, diplomacy: 0.7, economy: 0.9, expansion: 0.6 } },
  'Russian Empire': { government: 'empire', color: '#5f8a4d', flag: F('htri', ['#f5f1e6', '#1f4fa0', '#c8102e']), capital: 'st_petersburg' },
  'Austrian Empire': { government: 'empire', color: '#d3c28a', flag: F('hbi', ['#1b1b1b', '#e7c33c', '#e7c33c']), capital: 'vienna' },
  'Kingdom of Prussia': { government: 'monarchy', color: '#4f5560', flag: F('hbi', ['#1b1b1b', '#f5f1e6', '#f5f1e6'], 'eagle', '#1b1b1b'), capital: 'berlin' },
  'Prussia': { government: 'monarchy', color: '#4f5560', flag: F('hbi', ['#1b1b1b', '#f5f1e6', '#f5f1e6'], 'eagle', '#1b1b1b'), capital: 'berlin' },
  'Spain': { government: 'monarchy', color: '#d0a43c', flag: F('htri', ['#c60b1e', '#ffc400', '#c60b1e']), capital: 'madrid' },
  'Inca Empire': { government: 'empire', color: '#c07a3a', flag: F('stripes', ['#d8452f', '#f0c419', '#3b8f4a'], 'sun', '#f0c419'), capital: 'cusco' },
  'Mughal Empire': { government: 'empire', color: '#3f8f6a', flag: F('solid', ['#2f6b3a', '#2f6b3a', '#2f6b3a'], 'sun', '#e9c86a'), capital: 'agra' },
  'Safavid Empire': { government: 'theocracy', color: '#4d9b8c', flag: F('solid', ['#3a8a4a', '#3a8a4a', '#3a8a4a'], 'lion', '#e9c86a'), capital: 'tabriz' },
  'Manchu Empire': { government: 'empire', color: '#c9a640', flag: F('solid', ['#e7c33c', '#e7c33c', '#e7c33c'], 'sun', '#c8102e'), capital: 'beijing' },
  'USSR': { government: 'one_party_state', color: '#a8423c', flag: F('solid', ['#b5121b', '#b5121b', '#b5121b'], 'star', '#f2c230'), capital: 'moscow' },
  'United States': { government: 'democracy', color: '#4a6fa5', flag: F('stripes', ['#b22234', '#f5f1e6', '#3c3b6e'], 'star', '#f5f1e6'), capital: 'washington' },
  'United States of America': { government: 'democracy', color: '#4a6fa5', flag: F('stripes', ['#b22234', '#f5f1e6', '#3c3b6e'], 'star', '#f5f1e6'), capital: 'washington' },
  'Empire of Japan': { government: 'empire', color: '#c25a5a', flag: F('solid', ['#f5f1e6', '#f5f1e6', '#f5f1e6'], 'circle', '#bc002d'), capital: 'edo_tokyo' },
  'Japan': { government: 'democracy', color: '#c25a5a', flag: F('solid', ['#f5f1e6', '#f5f1e6', '#f5f1e6'], 'circle', '#bc002d'), capital: 'edo_tokyo' },
  'China': { government: 'one_party_state', color: '#c9a640', flag: F('solid', ['#de2910', '#de2910', '#de2910'], 'star', '#ffde00'), capital: 'beijing' },
  'Germany': { government: 'republic', color: '#6b6f78', flag: F('htri', ['#1b1b1b', '#dd0000', '#ffce00']), capital: 'berlin' },
  'Italy': { government: 'republic', color: '#4f9b5c', flag: F('vtri', ['#009246', '#f5f1e6', '#ce2b37']), capital: 'rome' },
  'United Kingdom': { government: 'constitutional_monarchy', color: '#b03a3a', flag: F('saltire', ['#1d3c8f', '#f5f1e6', '#c8102e'], 'cross', '#c8102e'), capital: 'london' },
  'Achaemenid Empire': { government: 'empire', color: '#a06a3a', flag: F('solid', ['#8a2a1a', '#8a2a1a', '#8a2a1a'], 'eagle', '#e9c86a'), capital: 'persepolis_isfahan' },
  'Han': { government: 'empire', color: '#b8433a', flag: F('solid', ['#1b1b1b', '#1b1b1b', '#1b1b1b'], 'sun', '#c8102e'), capital: 'chang_an' },
  'Persia': { government: 'empire', color: '#4d9b8c', flag: F('htri', ['#239f40', '#f5f1e6', '#da0000'], 'lion', '#e9c86a'), capital: 'persepolis_isfahan' },
  'Hunnic Empire': { government: 'khaganate', color: '#7a6a4a', flag: F('solid', ['#3a2a1a', '#3a2a1a', '#3a2a1a'], 'sun', '#d9b65c') },
  'Visigoths': { government: 'tribal', color: '#8a7a5a' },
};

export const PALETTE = [
  '#8f5b4a', '#5b7f8f', '#7d8f5b', '#9a7b3f', '#6a5b8f', '#4f8a7a', '#a0614f', '#5f6f9a', '#8a8f4f', '#9a5f7a',
  '#4f7a5f', '#b08a4f', '#6f4f6f', '#4a8f9a', '#9a8a6a', '#7a4f4f', '#5a8a4f', '#8a6a9a', '#a07a5a', '#4f6a8a',
  '#9f6f3f', '#5f8f6f', '#7f5f3f', '#3f6f7f', '#8f7f9f', '#6f8f8f', '#a8885a', '#7a9a6a',
];

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const FLAG_COLORS = ['#9e1c22', '#1d3c8f', '#2f6b3a', '#e7c33c', '#f5f1e6', '#1b1b1b', '#5b1f6a', '#c66a1a', '#2a7a8a', '#7a1a3a'];
const PATTERNS: FlagDesign['pattern'][] = ['solid', 'hbi', 'htri', 'vtri', 'vbi', 'nordic', 'saltire', 'canton', 'diagonal', 'border', 'quartered'];
const EMBLEMS: FlagDesign['emblem'][] = ['none', 'star', 'crescent', 'sun', 'cross', 'circle', 'crown', 'eagle', 'tower', 'lion', 'wheel'];

export function generatedFlag(name: string): FlagDesign {
  const h = hashString(name);
  const c0 = FLAG_COLORS[h % FLAG_COLORS.length];
  let c1 = FLAG_COLORS[(h >>> 4) % FLAG_COLORS.length];
  if (c1 === c0) c1 = FLAG_COLORS[(h + 3) % FLAG_COLORS.length];
  let c2 = FLAG_COLORS[(h >>> 8) % FLAG_COLORS.length];
  if (c2 === c1) c2 = c0;
  return { pattern: PATTERNS[(h >>> 12) % PATTERNS.length], colors: [c0, c1, c2], emblem: EMBLEMS[(h >>> 16) % EMBLEMS.length], emblemColor: c1 === '#e7c33c' ? '#9e1c22' : '#e7c33c' };
}
export function colorFor(name: string): string { return PROFILES[name]?.color ?? PALETTE[hashString(name) % PALETTE.length]; }

export function guessGovernment(name: string, tribal: boolean, year: number): GovernmentId {
  const n = name.toLowerCase();
  if (tribal) return 'tribal';
  if (/khanate|horde|khaganate|huns|hunnic|mongol/.test(n)) return 'khaganate';
  if (/caliphate|papal|imamate|theocra/.test(n)) return 'theocracy';
  if (/republic|confederation|united provinces|swiss/.test(n)) return year >= 1800 ? 'democracy' : 'republic';
  if (/venice|genoa|hanse|novgorod/.test(n)) return 'merchant_republic';
  if (/empire|sultanate|dynasty|raj/.test(n)) return 'empire';
  if (/ussr|soviet|people's/.test(n)) return 'one_party_state';
  if (year >= 1950) return 'republic';
  if (year >= 1850) return 'constitutional_monarchy';
  return 'monarchy';
}

// Generated ruler names (clearly labelled as generated, not historical people).
const NAME_POOLS: Record<MacroRegion, string[]> = {
  europe: ['Henri', 'Otto', 'Ludwig', 'Isabella', 'Casimir', 'Alfonso', 'Matthias', 'Eleanor', 'Frederick', 'Sigismund', 'Margaret', 'Charles', 'Philip', 'Stefan', 'Ingrid'],
  mena: ['Yusuf', 'Ahmad', 'Shajar', 'Selim', 'Hasan', 'Zubayda', 'Murad', 'Faruk', 'Layla', 'Ismail', 'Kemal', 'Abbas'],
  ssafrica: ['Mansa Kanku', 'Sundiata', 'Amina', 'Ewuare', 'Nzinga', 'Zara Yaqob', 'Askia', 'Idris', 'Shaka', 'Mutapa'],
  southasia: ['Ashoka', 'Rajendra', 'Krishna', 'Lakshmi', 'Prithvi', 'Devaraya', 'Ahilya', 'Ranjit', 'Chandra', 'Akbar'],
  eastasia: ['Zhu', 'Li', 'Wang', 'Yoshimitsu', 'Sejong', 'Wu Zetian', 'Kangxi', 'Tokimune', 'Hong', 'Yongle'],
  seasia: ['Jayavarman', 'Ramkhamhaeng', 'Hayam Wuruk', 'Parameswara', 'Le Loi', 'Anawrahta', 'Suryavarman', 'Gajah'],
  centralasia: ['Toqtamish', 'Ulugh', 'Babur', 'Shaybani', 'Qaidu', 'Esen', 'Abulkhair', 'Altan', 'Duwa', 'Kebek'],
  russia: ['Dmitry', 'Vasily', 'Ivan', 'Olga', 'Yaroslav', 'Alexei', 'Sofia', 'Boris', 'Mikhail', 'Yuri'],
  namerica: ['Tecumseh', 'Hiawatha', 'Pontiac', 'Washington', 'Adams', 'Lincoln', 'Madison', 'Kanatawakhon'],
  latam: ['Pachacuti', 'Moctezuma', 'Atahualpa', 'Nezahualcoyotl', 'Bolívar', 'Túpac', 'Itzcoatl', 'Juárez'],
  oceania: ['Kamehameha', 'Tuʻi', 'Te Rauparaha', 'Pōmare', 'Hongi', 'Taufaʻāhau'],
};
export function generatedRulerName(region: MacroRegion, seed: number): string {
  const pool = NAME_POOLS[region];
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  return `${pool[seed % pool.length]} ${roman[(seed >>> 5) % roman.length]}`;
}
