import type { EraId, GovernmentId, ModifierKey } from '../types/game';

export interface EraDef { id: EraId; name: string; range: [number, number]; mapKeys: string[]; blurb: string; hue: number; defaultYear: number }

export const ERAS: EraDef[] = [
  { id: 'ancient', name: 'Ancient Era', range: [-500, -1], mapKeys: ['bc500', 'bc200'], defaultYear: -500, hue: 32, blurb: 'Bronze gives way to iron. Persia, Carthage and the Greek poleis contest the Mediterranean while the Warring States shape China.' },
  { id: 'classical', name: 'Classical Era', range: [1, 600], mapKeys: ['100', '400'], defaultYear: 100, hue: 12, blurb: 'Rome and Han China anchor two ends of the Silk Road. Parthia, Kushan and Gupta India flourish between them.' },
  { id: 'medieval', name: 'Medieval Era', range: [601, 1449], mapKeys: ['800', '1000', '1200', '1279', '1400'], defaultYear: 1200, hue: 205, blurb: 'Caliphates, Byzantium, the Song and the Mongol storm. Feudal Europe slowly consolidates.' },
  { id: 'renaissance', name: 'Renaissance Era', range: [1450, 1749], mapKeys: ['1492', '1530', '1650', '1715'], defaultYear: 1530, hue: 140, blurb: 'Gunpowder empires, oceanic voyages and the printing press. The Ottomans, Mughals, Ming and Habsburgs dominate.' },
  { id: 'industrial', name: 'Industrial Era', range: [1750, 1913], mapKeys: ['1815', '1880'], defaultYear: 1815, hue: 0, blurb: 'Steam, railways and nationalism. Empires industrialise while colonial expansion reshapes the globe.' },
  { id: 'modern', name: 'Modern Era', range: [1914, 2010], mapKeys: ['1914', '1938', '1945', '1960', '2000'], defaultYear: 1945, hue: 220, blurb: 'World wars, decolonisation and the nuclear age. Ideologies collide over a rapidly urbanising planet.' },
];

export const MAP_YEARS: { key: string; year: number }[] = [
  { key: 'bc500', year: -500 }, { key: 'bc200', year: -200 }, { key: '100', year: 100 }, { key: '400', year: 400 },
  { key: '800', year: 800 }, { key: '1000', year: 1000 }, { key: '1200', year: 1200 }, { key: '1279', year: 1279 },
  { key: '1400', year: 1400 }, { key: '1492', year: 1492 }, { key: '1530', year: 1530 }, { key: '1650', year: 1650 },
  { key: '1715', year: 1715 }, { key: '1815', year: 1815 }, { key: '1880', year: 1880 }, { key: '1914', year: 1914 },
  { key: '1938', year: 1938 }, { key: '1945', year: 1945 }, { key: '1960', year: 1960 }, { key: '2000', year: 2000 },
];
export const SUPPORTED_RANGE: [number, number] = [-500, 2010];

/** Nearest dataset at or before `year` (falls back to the earliest one). */
export function mapKeyForYear(year: number): string {
  let best = MAP_YEARS[0];
  for (const m of MAP_YEARS) if (m.year <= year) best = m;
  return best.key;
}
export function eraForYear(year: number): EraId {
  for (const e of ERAS) if (year >= e.range[0] && year <= e.range[1]) return e.id;
  return year < -500 ? 'ancient' : 'modern';
}
let YL = { bc: 'BC', ad: 'AD' };
export function setYearLabels(bc: string, ad: string): void { YL = { bc, ad }; }
export function formatYear(y: number): string { return y < 0 ? `${-y} ${YL.bc}` : y < 1000 ? `${YL.ad} ${y}` : `${y}`; }

export interface GovernmentDef { id: GovernmentId; name: string; description: string; effects: Partial<Record<ModifierKey, number>>; minEra: number }
export const GOVERNMENTS: Record<GovernmentId, GovernmentDef> = {
  tribal: { id: 'tribal', name: 'Tribal Confederation', description: 'Loose kin-based authority. Cheap to run, hard to tax.', effects: { taxEfficiency: -0.35, manpower: 0.25, research: -0.3 }, minEra: 0 },
  monarchy: { id: 'monarchy', name: 'Feudal Monarchy', description: 'Hereditary rule balanced by nobles. Legitimacy rests on the dynasty.', effects: { legitimacy: 5, stability: 2 }, minEra: 0 },
  empire: { id: 'empire', name: 'Imperial Autocracy', description: 'Centralised rule over many peoples. Strong armies, brittle when overstretched.', effects: { militaryQuality: 0.08, taxEfficiency: 0.08, unrest: 3 }, minEra: 0 },
  republic: { id: 'republic', name: 'Republic', description: 'Elected magistrates and assemblies. Rewards trade and administration.', effects: { tradeIncome: 0.1, research: 0.08, legitimacy: -3 }, minEra: 0 },
  theocracy: { id: 'theocracy', name: 'Theocracy', description: 'Religious authority legitimises the state. Stable, conservative.', effects: { stability: 5, research: -0.12 }, minEra: 0 },
  merchant_republic: { id: 'merchant_republic', name: 'Merchant Republic', description: 'Rule by trading houses. Excellent commerce, weak land armies.', effects: { tradeIncome: 0.3, manpower: -0.25 }, minEra: 2 },
  khaganate: { id: 'khaganate', name: 'Steppe Khaganate', description: 'Nomadic horse-archer polity. Formidable cavalry; succession is often contested.', effects: { militaryQuality: 0.18, taxEfficiency: -0.15, legitimacy: -6 }, minEra: 0 },
  constitutional_monarchy: { id: 'constitutional_monarchy', name: 'Constitutional Monarchy', description: 'A crown bound by law and parliament.', effects: { stability: 4, taxEfficiency: 0.1, tradeIncome: 0.08 }, minEra: 3 },
  democracy: { id: 'democracy', name: 'Liberal Democracy', description: 'Universal suffrage and civil liberties. High legitimacy, constrained war-making.', effects: { research: 0.15, legitimacy: 10, manpower: -0.15 }, minEra: 4 },
  one_party_state: { id: 'one_party_state', name: 'One-Party State', description: 'Authoritarian single-party rule. Mobilises resources at the cost of freedom, trust and long-term legitimacy.', effects: { manpower: 0.15, legitimacy: -8, unrest: 4 }, minEra: 4 },
  military_junta: { id: 'military_junta', name: 'Military Junta', description: 'Rule by officers. Militarised, repressive and rarely durable.', effects: { militaryQuality: 0.1, stability: -6, legitimacy: -15 }, minEra: 4 },
};

export function eraIndex(id: EraId): number { return ERAS.findIndex((e) => e.id === id); }
