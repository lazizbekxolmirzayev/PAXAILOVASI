import type { ModifierKey } from '../types/game';

export type TechCategory = 'agriculture' | 'administration' | 'military' | 'commerce' | 'medicine' | 'engineering';
export interface TechDef {
  id: string; name: string; era: number; category: TechCategory; year: number; cost: number;
  description: string; effects: Partial<Record<ModifierKey, number>>; requires: string[];
  unlocks?: string; // human readable
}

const T = (id: string, name: string, era: number, category: TechCategory, year: number, description: string,
  effects: TechDef['effects'], requires: string[] = [], unlocks?: string): TechDef =>
  ({ id, name, era, category, year, cost: Math.round(180 * Math.pow(2.05, era)), description, effects, requires, unlocks });

// `year` = approximate first widespread adoption by the leading societies (used to seed starting knowledge).
export const TECHS: TechDef[] = [
  // Era 0 — Ancient
  T('irrigation', 'Irrigation Canals', 0, 'agriculture', -3000, 'Channelled river water multiplies harvests.', { foodProduction: 0.08 }),
  T('writing', 'Writing & Records', 0, 'administration', -3200, 'Scribes track taxes and laws.', { taxEfficiency: 0.06 }),
  T('ironworking', 'Ironworking', 0, 'military', -1100, 'Cheap, hard iron arms whole levies.', { militaryQuality: 0.08 }),
  T('coinage', 'Coinage', 0, 'commerce', -600, 'Standardised money eases trade.', { tradeIncome: 0.08 }),
  T('herbalism', 'Herbal Medicine', 0, 'medicine', -2000, 'Accumulated remedies reduce mortality slightly.', { deathRate: -0.03 }),
  T('masonry', 'Masonry', 0, 'engineering', -2500, 'Stone walls and monuments.', { stability: 2 }, [], 'Forts level 2'),
  // Era 1 — Classical
  T('crop_rotation2', 'Two-Field Rotation', 1, 'agriculture', -300, 'Fallow cycles keep soils fertile.', { foodProduction: 0.07 }, ['irrigation']),
  T('codified_law', 'Codified Law', 1, 'administration', -450, 'Written legal codes curb arbitrary rule.', { taxEfficiency: 0.06, stability: 2 }, ['writing']),
  T('legions', 'Professional Armies', 1, 'military', -100, 'Paid, drilled standing troops.', { militaryQuality: 0.1, morale: 0.05 }, ['ironworking']),
  T('roads_network', 'Paved Road Networks', 1, 'engineering', -300, 'Roads move armies, grain and tax.', { tradeIncome: 0.05 }, ['masonry'], 'Roads level 3'),
  T('silk_road', 'Long-Distance Trade', 1, 'commerce', -130, 'Caravans link distant markets.', { tradeIncome: 0.1 }, ['coinage']),
  T('aqueducts', 'Aqueducts & Baths', 1, 'medicine', -300, 'Clean water reduces disease.', { deathRate: -0.04 }, ['herbalism', 'masonry']),
  // Era 2 — Medieval
  T('heavy_plough', 'Heavy Plough', 2, 'agriculture', 900, 'Opens heavy clay soils to farming.', { foodProduction: 0.1 }, ['crop_rotation2']),
  T('bureaucracy', 'Merit Bureaucracy', 2, 'administration', 1000, 'Examined officials administer provinces.', { taxEfficiency: 0.08 }, ['codified_law']),
  T('heavy_cavalry', 'Stirrups & Heavy Cavalry', 2, 'military', 800, 'Shock cavalry dominates open battle.', { militaryQuality: 0.1 }, ['legions']),
  T('banking', 'Bills of Exchange', 2, 'commerce', 1200, 'Credit networks lower interest and boost trade.', { tradeIncome: 0.1, inflation: -0.005 }, ['silk_road']),
  T('hospitals', 'Hospitals (Bimaristan)', 2, 'medicine', 900, 'Organised care for the sick.', { deathRate: -0.04 }, ['aqueducts']),
  T('castles', 'Castles', 2, 'engineering', 1050, 'Stone keeps anchor territorial control.', { stability: 2 }, ['roads_network'], 'Forts level 4'),
  // Era 3 — Renaissance
  T('three_field', 'Three-Field System & New Crops', 3, 'agriculture', 1500, 'Columbian crops and rotation feed growing cities.', { foodProduction: 0.12 }, ['heavy_plough']),
  T('printing', 'Printing Press', 3, 'administration', 1460, 'Mass literacy and propaganda.', { research: 0.15 }, ['bureaucracy']),
  T('gunpowder', 'Gunpowder Weapons', 3, 'military', 1450, 'Cannons breach walls; muskets equip infantry.', { militaryQuality: 0.15 }, ['heavy_cavalry']),
  T('joint_stock', 'Joint-Stock Companies', 3, 'commerce', 1600, 'Pooled capital finances oceanic trade.', { tradeIncome: 0.15 }, ['banking']),
  T('quarantine', 'Quarantine', 3, 'medicine', 1450, 'Isolation slows epidemics.', { deathRate: -0.05 }, ['hospitals']),
  T('navigation', 'Ocean Navigation', 3, 'engineering', 1490, 'Carracks and astrolabes cross oceans.', { tradeIncome: 0.08 }, ['castles'], 'Ports level 4, naval reach +'),
  // Era 4 — Industrial
  T('agri_revolution', 'Agricultural Revolution', 4, 'agriculture', 1780, 'Enclosure, seed drills and fertiliser.', { foodProduction: 0.2 }, ['three_field']),
  T('nationalism', 'Modern State & Census', 4, 'administration', 1800, 'Professional ministries and national identity.', { taxEfficiency: 0.12, manpower: 0.15 }, ['printing']),
  T('rifles', 'Rifled Arms & Railways Logistics', 4, 'military', 1850, 'Rifles, artillery and rail mobilisation.', { militaryQuality: 0.2 }, ['gunpowder']),
  T('steam', 'Steam Power & Factories', 4, 'commerce', 1800, 'Industrial production multiplies output.', { tradeIncome: 0.2, research: 0.1 }, ['joint_stock']),
  T('vaccination', 'Vaccination & Germ Theory', 4, 'medicine', 1850, 'Smallpox vaccine, then germ theory.', { deathRate: -0.08 }, ['quarantine']),
  T('railways', 'Railways & Telegraph', 4, 'engineering', 1840, 'Continental logistics and communication.', { tradeIncome: 0.1 }, ['navigation'], 'Roads level 5'),
  // Era 5 — Modern
  T('green_revolution', 'Green Revolution', 5, 'agriculture', 1960, 'High-yield crops, synthetic fertiliser.', { foodProduction: 0.3 }, ['agri_revolution']),
  T('welfare_state', 'Welfare State', 5, 'administration', 1945, 'Pensions, unemployment insurance, public schooling.', { stability: 6, taxEfficiency: 0.1 }, ['nationalism']),
  T('mechanised', 'Mechanised Warfare', 5, 'military', 1935, 'Tanks, aircraft, radio command.', { militaryQuality: 0.3 }, ['rifles']),
  T('electrification', 'Electrification & Mass Production', 5, 'commerce', 1920, 'Electric grids and assembly lines.', { tradeIncome: 0.25, research: 0.1 }, ['steam']),
  T('antibiotics', 'Antibiotics', 5, 'medicine', 1945, 'Penicillin ends many fatal infections.', { deathRate: -0.12 }, ['vaccination']),
  T('computing', 'Computing & Information', 5, 'engineering', 1975, 'Digital computers transform every sector.', { research: 0.25, tradeIncome: 0.1 }, ['railways']),
];
export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));
export const TECH_CATEGORIES: TechCategory[] = ['agriculture', 'administration', 'military', 'commerce', 'medicine', 'engineering'];

/** Fractional technology level 0..6 derived from known techs. */
export function techLevel(known: string[]): number {
  let lvl = 0;
  for (const id of known) { const t = TECH_BY_ID[id]; if (t) lvl += 1 / 6; }
  return lvl;
}
export function techAvailable(known: string[], id: string): boolean {
  const t = TECH_BY_ID[id];
  if (!t || known.includes(id)) return false;
  return t.requires.every((r) => known.includes(r));
}
