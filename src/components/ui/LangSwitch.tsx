import { Languages } from 'lucide-react';
import { LANGS, useLang } from '../../i18n';
import { cx } from '.';
import { sfx } from '../../services/audio';

/** EN / RU / UZ selector — switching re-renders the whole interface in the chosen language. */
export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  return (
    <div className="hud-res !gap-0.5 !p-0.5" role="group" aria-label="Language">
      {!compact && <Languages className="mx-1 h-3.5 w-3.5 text-gold-300" />}
      {LANGS.map((l) => (
        <button key={l.id} title={l.native} onClick={() => { sfx('click'); setLang(l.id); }}
          className={cx('rounded px-2 py-1 font-display text-[11px] font-bold tracking-[0.1em] transition', lang === l.id ? 'bg-gradient-to-b from-gold-100 via-gold-300 to-gold-600 text-ink-950 shadow-glow' : 'text-parchment-200/70 hover:text-gold-100')}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
