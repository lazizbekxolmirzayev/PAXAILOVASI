// Writes api/_story-text.js — run with `npm run gen:story` whenever scenario background text or the storyboard changes.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { manifestModuleSource } from '../src/story/manifest';

const out = fileURLToPath(new URL('../api/_story-text.js', import.meta.url));
writeFileSync(out, manifestModuleSource());
console.log('wrote', out);
