import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { SCENARIOS } from '/home/claude/whatif/src/data/scenarios';
import { ERAS, GOVERNMENTS } from '/home/claude/whatif/src/data/eras';
import { TECHS, TECH_CATEGORIES } from '/home/claude/whatif/src/data/technologies';
import { EVENT_DEFS } from '/home/claude/whatif/src/engine/events';
import { ACHIEVEMENTS } from '/home/claude/whatif/src/engine/achievements';
import { MAP_MODES } from '/home/claude/whatif/src/lib/mapColors';
import { REGION_LABEL } from '/home/claude/whatif/src/data/regions';
import { MONTHS } from '/home/claude/whatif/src/engine/date';
const out = new Map<string, string>(); // text -> group
const add = (s: string | undefined, g: string) => { if (s && /[A-Za-z]{2}/.test(s) && !out.has(s)) out.set(s, g); };
const files = execSync("grep -rlE \"tr\\(|t\\('\" /home/claude/whatif/src/pages /home/claude/whatif/src/components /home/claude/whatif/src/store").toString().trim().split('\n');
const lit = /\btr?\(\s*'((?:[^'\\]|\\.)*)'/g;
const props = /\b(label|sub|title|text|legend|tag|effect|d|t|l|hint|description|name|native)\s*:\s*'((?:[^'\\]|\\.)*)'/g;
const ternary = /tr\(([^()]*\?[^()]*)\)/g;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(lit)) add(m[1].replace(/\\'/g, "'"), 'ui');
  for (const m of s.matchAll(props)) add(m[2].replace(/\\'/g, "'"), 'ui');
  for (const m of s.matchAll(ternary)) for (const q of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) add(q[1].replace(/\\'/g, "'"), 'ui');
  for (const m of s.matchAll(/\b(title|subtitle|label|kicker|hint)="([^"{}]+)"/g)) add(m[2], 'ui');
}
// extra UI sources
const extra = ['/home/claude/whatif/src/components/layout/LoadingScreen.tsx', '/home/claude/whatif/src/pages/game/Historian.tsx', '/home/claude/whatif/src/engine/diplomacy.ts', '/home/claude/whatif/src/engine/ai.ts', '/home/claude/whatif/src/engine/create.ts', '/home/claude/whatif/src/store/game.ts'];
for (const f of extra) { const s = readFileSync(f, 'utf8');
  if (f.includes('LoadingScreen') || f.includes('Historian')) for (const m of s.matchAll(/^\s*'((?:[^'\\]|\\.)*)',?$/gm)) add(m[1].replace(/\\'/g, "'"), 'ui');
  if (f.includes('Historian')) for (const m of s.matchAll(/const SUGGEST = \[([^\]]*)\]/g)) for (const q of m[1].matchAll(/'([^']*)'/g)) add(q[1], 'ui');
  if (f.includes('diplomacy')) for (const m of s.matchAll(/add\('([^']*)'/g)) add(m[1], 'ui');
  if (f.includes('ai.ts')) for (const m of s.matchAll(/goals\.push\('([^']*)'\)/g)) add(m[1], 'ui');
  if (f.includes('create.ts')) for (const m of s.matchAll(/'(Chief|Khan|Emperor|Head of State|Monarch|Ruler|Founder)'/g)) add(m[1], 'ui');
  if (f.includes('store')) for (const m of s.matchAll(/toast\('([^']*)'/g)) add(m[1], 'ui');
}
for (const x of ['Emir', 'Augustus', 'King', 'Sultan', 'Basileus', 'Great Khan', 'Ilkhan', 'Sapa Inca', 'King & Emperor', 'President', 'General Secretary', 'Prime Minister', 'Chairman', 'Prince', 'Leader', 'Heir', 'Sultan', 'King of Kings', 'War', 'Peace', 'mountains', 'desert', 'river', 'coast', 'plains', 'documented history', 'BC', 'AD', 'start', 'divergence', 'war', 'peace', 'succession', 'collapse', 'founding', 'event', 'technology', 'treaty', 'rebellion', 'disaster', 'economy', 'player', 'historical', 'alliance', 'trade', 'nap', 'guarantee', 'disaster', 'health', 'politics', 'science', 'diplomacy', 'military', 'society', 'Achievement unlocked: {name}', 'Effects:']) add(x, 'ui');
MONTHS.forEach((m) => add(m, 'ui'));
TECH_CATEGORIES.forEach((m) => add(m, 'ui'));
Object.values(REGION_LABEL).forEach((m) => add(m, 'ui'));
MAP_MODES.forEach((m) => { add(m.label, 'ui'); add(m.legend, 'ui'); });
ERAS.forEach((e) => { add(e.name, 'content'); add(e.blurb, 'content'); });
Object.values(GOVERNMENTS).forEach((g) => { add(g.name, 'content'); add(g.description, 'content'); });
TECHS.forEach((x) => { add(x.name, 'content'); add(x.description, 'content'); });
EVENT_DEFS.forEach((e) => { add(e.title, 'content'); e.options.forEach((o) => { add(o.label, 'content'); add(o.hint, 'content'); }); });
add('Succession Crisis', 'content'); ['Convene a council of notables', 'Legitimacy +15; costs 3 months of income.', 'Back the claimant with the army', 'Legitimacy +5; stability −5; 35% chance a rival seizes part of the realm.', 'Divide the realm among claimants', 'A large region breaks away peacefully as a friendly state; stability +10.'].forEach((x) => add(x, 'content'));
ACHIEVEMENTS.forEach((a) => { add(a.name, 'content'); add(a.description, 'content'); });
for (const s of SCENARIOS) {
  [s.title, s.subtitle, s.question, s.sourcesNote, s.sensitivity, ...s.background].forEach((x) => add(x, 'scen'));
  s.characters.forEach((c) => { add(c.role, 'scen'); add(c.bio, 'scen'); });
  s.originalTimeline.forEach((e) => { add(e.title, 'scen'); add(e.text, 'scen'); });
  s.decisions.forEach((d) => { add(d.question, 'scen'); add(d.context, 'scen'); d.options.forEach((o) => { add(o.label, 'scen'); add(o.description, 'scen'); }); });
  s.consequences.forEach((c) => add(c.text, 'scen'));
}
const arr = Array.from(out.entries());
writeFileSync('/tmp/strings.json', JSON.stringify(arr, null, 0));
console.log(arr.length, arr.filter((x) => x[1] === 'ui').length, arr.filter((x) => x[1] === 'content').length, arr.filter((x) => x[1] === 'scen').length);
