// Remembers which scenario intros were just watched or skipped, so that a remount of the page does not replay them:
//  - switching the language remounts the page;
//  - the app's own page transition mounts a freshly opened page twice, ~0.35 s apart.
// Opening the scenario again later (or reloading the site) plays the intro again.
import { useLang } from '../i18n';

const LANG_GRACE_MS = 2500;
const REMOUNT_GRACE_MS = 1500;

const doneAt = new Map<string, number>();
let langChangedAt = 0;
useLang.subscribe((state, prev) => { if (state.lang !== prev.lang) langChangedAt = Date.now(); });

const reducedMotion = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Should the intro play now? (not for people who asked for reduced motion) */
export function shouldPlayIntro(id: string, reduceSetting: boolean): boolean {
  if (reduceSetting || reducedMotion()) return false;
  const at = doneAt.get(id);
  if (at === undefined) return true;
  const now = Date.now();
  if (now - at < REMOUNT_GRACE_MS || now - langChangedAt <= LANG_GRACE_MS) return false; // same visit, the page just remounted
  doneAt.delete(id); // a fresh visit
  return true;
}
export const markIntroDone = (id: string): void => { doneAt.set(id, Date.now()); };
