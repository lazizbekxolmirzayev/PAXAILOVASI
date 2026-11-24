import type { MacroRegion } from '../types/game';

// Macro-region assignment of Natural Earth admin-1 provinces (by modern country).
const SETS: Record<Exclude<MacroRegion, 'europe' | 'ssafrica' | 'seasia' | 'latam'>, string[]> = {
  mena: ['Turkey', 'Iran', 'Iraq', 'Syria', 'Lebanon', 'Israel', 'Palestine', 'Jordan', 'Saudi Arabia', 'Yemen', 'Oman', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Kuwait', 'Egypt', 'Libya', 'Tunisia', 'Algeria', 'Morocco', 'Western Sahara', 'Armenia', 'Georgia', 'Azerbaijan', 'Cyprus', 'Northern Cyprus', 'Gaza', 'West Bank'],
  southasia: ['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Bhutan', 'Sri Lanka', 'Maldives'],
  eastasia: ['China', 'Hong Kong S.A.R.', 'Macao S.A.R', 'Taiwan', 'Japan', 'North Korea', 'South Korea'],
  centralasia: ['Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Mongolia', 'Afghanistan'],
  russia: ['Russia'],
  namerica: ['United States of America', 'Canada', 'Greenland', 'Bermuda', 'Saint Pierre and Miquelon'],
  oceania: ['Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands', 'Vanuatu', 'New Caledonia', 'Samoa', 'Tonga', 'French Polynesia', 'Kiribati', 'Micronesia', 'Federated States of Micronesia', 'Palau', 'Marshall Islands', 'Nauru', 'Tuvalu', 'Cook Islands', 'Niue', 'Guam', 'Northern Mariana Islands', 'American Samoa', 'Wallis and Futuna'],
};
const LOOKUP = new Map<string, MacroRegion>();
for (const [r, list] of Object.entries(SETS)) for (const c of list) LOOKUP.set(c, r as MacroRegion);

export function regionOf(modern: string, lon: number, lat: number): MacroRegion {
  const hit = LOOKUP.get(modern);
  if (hit) return hit;
  if (lon < -30) return lon < -50 && lat > 24 && lat < 72 && lon > -170 ? (lat > 31 ? 'namerica' : 'latam') : 'latam';
  if (lon > 110 && lat < -8) return 'oceania';
  if (lon > 160 || lon < -150) return 'oceania';
  if (lat < 24 && lon > -20 && lon < 55) return 'ssafrica';
  if (lon > 90 && lat < 28) return 'seasia';
  if (lat >= 34 && lon >= -30 && lon <= 45) return 'europe';
  if (lat > 50 && lon > 45) return 'russia';
  return 'mena';
}

export const REGION_LABEL: Record<MacroRegion, string> = {
  europe: 'Europe', mena: 'Middle East & North Africa', ssafrica: 'Sub-Saharan Africa', southasia: 'South Asia',
  eastasia: 'East Asia', seasia: 'Southeast Asia', centralasia: 'Central Asia', russia: 'Russia & Siberia',
  namerica: 'North America', latam: 'Latin America & Caribbean', oceania: 'Oceania',
};

// Approximate world population (millions) — rounded consensus of McEvedy & Jones (1978),
// Maddison (2001) and UN/HYDE estimates. These are APPROXIMATIONS and are labelled as such in-game.
const WORLD_POP: [number, number][] = [
  [-500, 100], [1, 230], [200, 220], [400, 200], [600, 205], [800, 220], [1000, 275], [1200, 380], [1340, 440],
  [1400, 360], [1500, 450], [1600, 550], [1700, 610], [1800, 980], [1850, 1260], [1900, 1650], [1920, 1860],
  [1940, 2300], [1950, 2525], [1960, 3020], [1980, 4440], [2000, 6140], [2020, 7800],
];
// Regional shares (%) at anchor years, same sources; interpolated linearly.
const SHARES: [number, Record<MacroRegion, number>][] = [
  [-500, { europe: 15, mena: 20, ssafrica: 9, southasia: 25, eastasia: 21, seasia: 3, centralasia: 2, russia: 1.5, namerica: 1, latam: 2.3, oceania: 0.4 }],
  [1, { europe: 14, mena: 14, ssafrica: 6.5, southasia: 30, eastasia: 26, seasia: 3, centralasia: 2, russia: 1.5, namerica: 1, latam: 3, oceania: 0.3 }],
  [1000, { europe: 13, mena: 11, ssafrica: 9, southasia: 27, eastasia: 25, seasia: 5, centralasia: 2, russia: 2.5, namerica: 1, latam: 4.2, oceania: 0.3 }],
  [1500, { europe: 16, mena: 7, ssafrica: 9, southasia: 24, eastasia: 26, seasia: 5, centralasia: 1.5, russia: 3, namerica: 0.6, latam: 8.6, oceania: 0.3 }],
  [1600, { europe: 16.5, mena: 7, ssafrica: 9, southasia: 25, eastasia: 30, seasia: 5, centralasia: 1.5, russia: 3, namerica: 0.4, latam: 2.4, oceania: 0.2 }],
  [1800, { europe: 15, mena: 4.5, ssafrica: 7, southasia: 20, eastasia: 36, seasia: 4, centralasia: 1, russia: 4, namerica: 0.7, latam: 2.4, oceania: 0.2 }],
  [1900, { europe: 19, mena: 3.2, ssafrica: 6, southasia: 18, eastasia: 28, seasia: 6, centralasia: 1, russia: 7, namerica: 5, latam: 4, oceania: 0.4 }],
  [1950, { europe: 15, mena: 3.5, ssafrica: 7, southasia: 18, eastasia: 27, seasia: 7, centralasia: 1, russia: 6, namerica: 6.6, latam: 6.6, oceania: 0.5 }],
  [2000, { europe: 8, mena: 5, ssafrica: 11, southasia: 22, eastasia: 25, seasia: 9, centralasia: 1, russia: 2.4, namerica: 5, latam: 8.5, oceania: 0.5 }],
];

function lerpTable(table: [number, number][], year: number): number {
  if (year <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    const [y0, v0] = table[i - 1];
    if (year <= y1) return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
  }
  return table[table.length - 1][1];
}
export function worldPopulation(year: number): number { return lerpTable(WORLD_POP, year) * 1e6; }
export function regionShares(year: number): Record<MacroRegion, number> {
  const out = {} as Record<MacroRegion, number>;
  const keys = Object.keys(SHARES[0][1]) as MacroRegion[];
  let i = 1;
  while (i < SHARES.length - 1 && SHARES[i][0] < year) i++;
  const [y0, a] = SHARES[i - 1];
  const [y1, b] = SHARES[i];
  const t = Math.max(0, Math.min(1, (year - y0) / (y1 - y0)));
  let sum = 0;
  for (const k of keys) { out[k] = a[k] + (b[k] - a[k]) * t; sum += out[k]; }
  for (const k of keys) out[k] /= sum;
  return out;
}

// Relative technological baseline per region & year (0..1 multiplier of the era frontier).
// A coarse game-model assumption, not a historical measurement.
export function regionTechFactor(region: MacroRegion, year: number): number {
  const base: Record<MacroRegion, number> = {
    europe: 0.92, mena: 0.95, ssafrica: 0.6, southasia: 0.9, eastasia: 1, seasia: 0.75,
    centralasia: 0.8, russia: 0.7, namerica: 0.45, latam: 0.55, oceania: 0.4,
  };
  let f = base[region];
  if (year > 1500 && region === 'europe') f = Math.min(1, f + (year - 1500) / 800);
  if (year > 1700 && region === 'eastasia') f = Math.max(0.75, f - (year - 1700) / 900);
  if (year > 1800 && region === 'namerica') f = Math.min(1, 0.85 + (year - 1800) / 600);
  if (year > 1950) f = Math.max(f, 0.75);
  if (year < 1100 && region === 'mena') f = 1;
  return f;
}
