import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DICT } from './dict';
import { translateName } from './names';

export type Lang = 'uz' | 'en' | 'ru';
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'uz', label: "O'zbekcha", short: 'UZ' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'ru', label: 'Русский', short: 'RU' },
];

function detect(): Lang {
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  if (n.startsWith('uz')) return 'uz';
  if (n.startsWith('ru')) return 'ru';
  return 'en';
}

interface LangState { lang: Lang; setLang: (l: Lang) => void }
export const useLang = create<LangState>()(persist((set) => ({
  lang: detect(),
  setLang: (lang) => { if (typeof document !== 'undefined') document.documentElement.lang = lang; set({ lang }); },
}), {
  name: 'whatif-lang',
  onRehydrateStorage: () => (s) => { if (s && typeof document !== 'undefined') document.documentElement.lang = s.lang; },
}));

export type Vars = Record<string, string | number>;
function fill(text: string, vars?: Vars): string {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Translate an English source string; `{name}` placeholders are filled from `vars`. Unknown strings fall back to English. */
export function translate(lang: Lang, text: string, vars?: Vars): string {
  if (lang === 'en') return fill(text, vars);
  return fill(DICT[text]?.[lang] ?? text, vars);
}

/** Non-hook translation using the current language (for toasts, data tables). */
export function tr(text: string, vars?: Vars): string { return translate(useLang.getState().lang, text, vars); }
/** Non-hook place / nation name translation. */
export function trName(name: string): string { return translateName(useLang.getState().lang, name); }

/** Hook: returns a `t` function that re-renders the component when the language changes. */
export function useT(): (text: string, vars?: Vars) => string {
  const lang = useLang((s) => s.lang);
  return (text: string, vars?: Vars) => translate(lang, text, vars);
}
/** Hook: translates place and nation names (countries, cities) for the current language. */
export function useN(): (name: string) => string {
  const lang = useLang((s) => s.lang);
  return (name: string) => translateName(lang, name);
}
export { translateName };
