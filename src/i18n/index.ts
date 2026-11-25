import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DICT } from './dict';
import { MONTHS, setDateLocale } from '../engine/date';
import { setYearLabels } from '../data/eras';

export type Lang = 'en' | 'ru' | 'uz';
export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: 'uz', label: 'UZ', native: "O'zbekcha" },
  { id: 'ru', label: 'RU', native: 'Русский' },
  { id: 'en', label: 'EN', native: 'English' },
];

export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>()(persist((set) => ({
  lang: (typeof navigator !== 'undefined' && navigator.language?.startsWith('ru') ? 'ru' : typeof navigator !== 'undefined' && navigator.language?.startsWith('uz') ? 'uz' : 'en') as Lang,
  setLang: (lang) => set({ lang }),
}), { name: 'whatif-lang' }));

let index: Map<string, [string, string]> | null = null;
function lookup(): Map<string, [string, string]> {
  if (!index) { index = new Map(); for (const [en, ru, uz] of DICT) index.set(en, [ru, uz]); }
  return index;
}

/** Translate an English source string (the English text is the key). `{name}` placeholders are interpolated. */
export function t(s: string, vars?: Record<string, string | number>): string {
  if (!s) return s;
  const lang = useLang.getState().lang;
  let out = s;
  if (lang !== 'en') {
    let hit = lookup().get(s);
    let pre = '', post = '';
    if (!hit) {
      const core = s.trim();
      hit = lookup().get(core);
      if (hit) { pre = s.slice(0, s.indexOf(core)); post = s.slice(s.indexOf(core) + core.length); }
    }
    if (hit) out = pre + ((lang === 'ru' ? hit[0] : hit[1]) || s.trim()) + post;
  }
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
/** Translate only if a translation exists (for dynamic content such as names). */
export const tx = (s: string | undefined | null): string => (s ? t(s) : '');
export { t as tr };

/** Push localised month names / era labels into the shared formatters. */
export function applyLocale(): void {
  setDateLocale(MONTHS.map((m) => t(m)), t('BC'));
  setYearLabels(t('BC'), t('AD'));
  if (typeof document !== 'undefined') document.documentElement.lang = useLang.getState().lang;
}
applyLocale();
useLang.subscribe(applyLocale);
