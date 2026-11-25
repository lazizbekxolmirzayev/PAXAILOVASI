import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FastForward, Pause, Volume2 } from 'lucide-react';
import type { ScenarioDefinition } from '../types/game';
import { cx } from '../components/ui';
import { formatYear } from '../data/eras';
import { MONTHS } from '../engine/date';
import { tr, useLang } from '../i18n';
import { useSettings } from '../services/settings';
import { END_HOLD_MS, OPEN_MS } from './engine';

const START_DELAY_MS = 500;
import { buildBeats, pick, type Beat, type Lang } from './script';
import { ArtScene, RouteOverlay, SCENES } from './scenes';
import { useStory } from './useStory';

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const f = () => setOn(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [query]);
  return on;
}
function useInView(ref: React.RefObject<Element>, threshold: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => setOn(!!e && e.intersectionRatio >= threshold), { threshold: [0, threshold, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return on;
}

// ---------------------------------------------------------------------------------------------
const Caption = memo(function Caption({ text, reveal, overlay }: { text: string; reveal: number; overlay: boolean }) {
  const tokens = useMemo(() => {
    let pos = 0;
    return text.split(/(\s+)/).map((s) => { const t = { s, at: pos }; pos += s.length; return t; });
  }, [text]);
  const upto = reveal * text.length;
  // words that are not spoken yet stay invisible but keep their place, so nothing jumps while the text appears
  const body = (
    <>
      <div className="mb-0.5 font-display text-[9px] uppercase tracking-[0.3em] text-gold-300/85 md:text-[10px]">{tr('Narrator')}</div>
      <p className={cx('font-serif leading-snug text-parchment-50', !overlay && 'text-[16px]')} style={overlay ? { fontSize: 'clamp(12px, 2.4cqw, 28px)', textShadow: '0 1px 4px rgba(0,0,0,.9)' } : undefined}>
        {tokens.map((tk, i) => (tk.s.trim() === '' ? tk.s : <span key={i} className="story-caption-word" style={{ opacity: tk.at <= upto ? 1 : 0 }}>{tk.s}</span>))}
      </p>
    </>
  );
  return overlay
    ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-[4.5%] pb-[7.5%] pt-[10%]" style={{ background: 'linear-gradient(to top, rgba(8,6,14,.9) 0%, rgba(8,6,14,.74) 50%, rgba(8,6,14,0) 100%)' }}>{body}</div>
    : <div className="mt-2 min-h-[9.5rem] w-full rounded-md bg-ink-950/75 px-4 py-3 ring-1 ring-gold-600/30">{body}</div>;
});

function ChapterCard({ beat, lang }: { beat: Beat; lang: Lang }) {
  if (!beat.chapter) return null;
  const shadow = { textShadow: '0 1px 5px rgba(0,0,0,.8)' };
  return (
    <div className="pointer-events-none absolute left-[4.5%] top-[12%] z-10 max-w-[68%]" style={{ animation: 'st-chapter 5.4s ease-out .35s both' }}>
      {beat.chapter.kicker && <div className="font-display uppercase tracking-[0.3em] text-gold-300" style={{ fontSize: 'clamp(9px, 1.5cqw, 14px)', ...shadow }}>{pick(beat.chapter.kicker, lang)}</div>}
      <div className="gold-text title-display leading-tight drop-shadow" style={{ fontSize: 'clamp(15px, 3.4cqw, 40px)' }}>{pick(beat.chapter.title, lang)}</div>
      <div className="mt-1.5 h-px w-28 bg-gradient-to-r from-gold-300 to-transparent" />
    </div>
  );
}

/** One shot: the animated scene under a slow camera move, plus its chapter card. */
const ShotView = memo(function ShotView({ def, beat, lang, total, running }: { def: ScenarioDefinition; beat: Beat; lang: Lang; total: number; running: boolean }) {
  const dur = useRef(total / 1000 + 1.5).current; // fixed at the start of the shot so the camera never jumps
  const Scene = beat.visual === 'art' ? null : SCENES[beat.visual];
  return (
    <div className="absolute inset-0">
      <div className={cx('st-cam', `st-cam-${beat.cam}`)} style={{ animationDuration: `${dur}s` }}>
        {Scene ? <Scene running={running} /> : <ArtScene def={def} running={running} />}
        {beat.route && <RouteOverlayLabelled />}
      </div>
      <ChapterCard beat={beat} lang={lang} />
    </div>
  );
});
const RouteOverlayLabelled = () => <RouteOverlay from={tr('Anatolia')} to={tr('India')} />;

function OpeningCard({ def, quiet }: { def: ScenarioDefinition; quiet: boolean }) {
  return (
    <div className="absolute inset-0">
      <div className="st-cam st-cam-in" style={{ animationDuration: `${OPEN_MS / 1000 + 4}s` }}><ArtScene def={def} running={false} /></div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/55 via-ink-950/35 to-ink-950/70" />
      {!quiet && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
          <div className="font-display text-[10px] uppercase tracking-[0.3em] text-gold-300 md:text-xs" style={{ animation: `st-title ${OPEN_MS / 1000}s ease-out both` }}>{tr(def.subtitle)} · {tr(MONTHS[def.start.m]!)} {formatYear(def.start.y)}</div>
          <h3 className="title-display gold-text mt-2 text-xl leading-tight drop-shadow md:text-5xl" style={{ animation: `st-title ${OPEN_MS / 1000}s ease-out .15s both` }}>{tr(def.title)}</h3>
        </div>
      )}
    </div>
  );
}

/** Closing shot: the "what if?" of the scenario, then the stage hands over to the written text. */
function EndCard({ def }: { def: ScenarioDefinition }) {
  return (
    <div className="absolute inset-0">
      <div className="st-cam st-cam-out" style={{ animationDuration: `${END_HOLD_MS / 1000 + 6}s` }}><ArtScene def={def} running={false} /></div>
      <div className="absolute inset-0 bg-ink-950/70" />
      <div className="st-once pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-5 text-center" style={{ animation: 'st-fade-in 1.2s ease-out both' }}>
        <div className="font-display text-[10px] uppercase tracking-[0.3em] text-gold-300 md:text-xs">{tr('History could have turned here')}</div>
        <p className="mt-2 max-w-3xl font-serif text-[17px] italic leading-snug text-parchment-50 md:text-4xl">{tr(def.question)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
/**
 * The opening cutscene of a scenario, in the manner of a game intro: it starts by itself, fills the picture with
 * animated scenes and narration, and has exactly one button — Skip. When it ends (or is skipped) `onDone` is
 * called and the page shows the written background instead.
 */
export const StoryPlayer = memo(function StoryPlayer({ def, onDone, active = true }: { def: ScenarioDefinition; onDone: () => void; active?: boolean }) {
  const lang = useLang((s) => s.lang);
  const reduced = useSettings((s) => s.reduceMotion);
  const beats = useMemo(() => buildBeats(def), [def]);
  const { engine, snap } = useStory(def, beats, lang);
  const wrapRef = useRef<HTMLDivElement>(null);
  const wide = useMedia('(min-width: 768px)');
  const inView = useInView(wrapRef, 0.4);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    engine.pause(); // stops the voice at once while the stage folds away
    onDone();
  }, [engine, leaving, onDone]);

  // play only while it is on screen (and the page is not being swapped out), and start by itself
  const ready = inView && active && !leaving;
  useEffect(() => {
    const update = () => engine.setVisible(ready && !document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [engine, ready]);
  useEffect(() => {
    if (!ready || snap.phase !== 'idle') return;
    const id = window.setTimeout(() => engine.start(), START_DELAY_MS); // a beat of poster first
    return () => window.clearTimeout(id);
  }, [engine, ready, snap.phase]);

  // browsers keep the sound off until the page has had a tap or a key press: the first one, anywhere, turns it on
  useEffect(() => {
    const unlock = () => engine.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => { window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true); };
  }, [engine]);

  // after the last shot the question stays for a moment, then the written text takes over
  useEffect(() => {
    if (snap.phase !== 'ended') return;
    const id = window.setTimeout(finish, END_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [snap.phase, finish]);

  // no buttons besides Skip — but the keyboard still works
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key.toLowerCase();
    if (e.target instanceof HTMLButtonElement && (k === ' ' || k === 'enter')) return; // let the focused Skip button act
    if (k === ' ' || k === 'k') { if (snap.phase === 'playing') engine.pause(); else engine.resume(); }
    else if (k === 'arrowright') engine.next();
    else if (k === 'arrowleft') engine.prev();
    else if (k === 'm') engine.toggleMute();
    else if (k === 'escape') finish();
    else return;
    e.preventDefault();
  };

  const idx = snap.index;
  const beat = idx >= 0 && idx < beats.length ? beats[idx]! : null;
  const ended = snap.phase === 'ended';
  const userPaused = snap.phase === 'paused' && !leaving;
  const blocked = snap.voice === 'blocked' && !leaving;
  const overall = ended ? 1 : idx < 0 ? 0 : (idx + (snap.total > 0 ? Math.min(1, snap.t / snap.total) : 0)) / snap.count;
  const credit = !def.custom && snap.voice !== 'off';

  return (
    <div
      ref={wrapRef} tabIndex={0} role="region" aria-label={tr(def.title)} onKeyDown={onKey}
      data-story-index={idx} data-story-phase={snap.phase} data-story-voice={snap.voice} data-story-count={snap.count}
      className="story-root rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60"
    >
      <div className={cx('relative aspect-video w-full select-none overflow-hidden rounded-md bg-black ring-1 ring-gold-600/40', !snap.running && 'st-paused')} style={{ containerType: 'inline-size' }}>
        <AnimatePresence initial={false}>
          <motion.div key={idx} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.9, ease: 'easeInOut' }}>
            {idx < 0 ? <OpeningCard def={def} quiet={snap.phase === 'idle'} />
              : beat ? <ShotView def={def} beat={beat} lang={lang} total={snap.total} running={snap.running} />
                : <EndCard def={def} />}
          </motion.div>
        </AnimatePresence>

        {/* cinematic finish: grain, vignette, letterbox bars, and a hairline that shows how much is left */}
        <div className="pointer-events-none absolute inset-0 z-[4] opacity-[.07]" style={{ backgroundImage: 'var(--noise)' }} />
        <div className="pointer-events-none absolute inset-0 z-[4]" style={{ background: 'radial-gradient(ellipse at 50% 55%, transparent 52%, rgba(0,0,0,.55) 100%)' }} />
        <div className="st-once pointer-events-none absolute inset-x-0 top-0 z-[5] bg-black" style={{ height: '5.5%', transformOrigin: 'top', animation: 'st-bars 1.4s ease-out both' }} />
        <div className="st-once pointer-events-none absolute inset-x-0 bottom-0 z-[5] bg-black" style={{ height: '5.5%', transformOrigin: 'bottom', animation: 'st-bars 1.4s ease-out both' }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-[2px] bg-white/10"><div className="h-full bg-gradient-to-r from-gold-400 to-gold-100" style={{ width: `${overall * 100}%` }} /></div>

        {/* paused from the keyboard: a tap on the picture carries on */}
        {userPaused && (
          <>
            <button type="button" aria-label={tr('Resume')} onClick={() => engine.resume()} className="absolute inset-0 z-[7] cursor-pointer" tabIndex={-1} />
            <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-950/75 text-gold-100 ring-2 ring-gold-300/70"><Pause className="h-6 w-6" fill="currentColor" /></span>
            </div>
          </>
        )}

        {/* the only button: Skip (+ a hint, not a button, when the browser is holding the sound back) */}
        {!leaving && (
          <div className="absolute right-2 top-[7%] z-20 flex items-center gap-2 md:right-3">
            {blocked && (
              <span role="status" className="pointer-events-none flex items-center gap-1.5 rounded-full bg-ink-950/75 px-2.5 py-1.5 text-[11px] text-gold-100 ring-1 ring-gold-400/60" style={{ animation: 'st-pulse 1.6s ease-in-out infinite' }}>
                <Volume2 className="h-3.5 w-3.5 text-gold-300" /><span className="hidden sm:inline">{tr('Tap the screen for sound')}</span><span className="sr-only sm:hidden">{tr('Tap the screen for sound')}</span>
              </span>
            )}
            <button type="button" onClick={finish} className="flex items-center gap-1.5 rounded-full bg-ink-950/75 px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.14em] text-parchment-50 ring-1 ring-gold-600/50 transition hover:text-white hover:ring-gold-300 md:text-[11px]">
              <FastForward className="h-3.5 w-3.5" />{tr('Skip')}
            </button>
          </div>
        )}

        {beat && wide && <Caption text={pick(beat.text, lang)} reveal={snap.reveal} overlay />}
      </div>

      {beat && !wide && <Caption text={pick(beat.text, lang)} reveal={snap.reveal} overlay={false} />}

      <p className="mt-2 text-[10.5px] italic leading-snug text-parchment-300/50">
        {tr('Illustrations are artistic and symbolic; the narration follows the documented account.')}{credit && <> · {tr('Voice: ElevenLabs')}</>}
      </p>
    </div>
  );
});
