import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FastForward, Pause, Volume2 } from 'lucide-react';
import type { ScenarioDefinition } from '../types/game';
import { cx } from '../components/ui';
import { formatYear } from '../data/eras';
import { MONTHS } from '../engine/date';
import { tr, useLang } from '../i18n';
import { useSettings } from '../services/settings';
import { END_HOLD_MS, OPEN_MS } from './engine';
import { buildBeats, pick, type Beat, type Lang } from './script';
import { ArtScene, RouteOverlay, SCENES } from './scenes';
import { SoundBed, moodFor } from './sound';
import { useStory } from './useStory';

const START_DELAY_MS = 500;

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

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
      <p className="font-serif leading-snug text-parchment-50" style={overlay ? { fontSize: 'clamp(12px, 2.3cqw, 32px)', textShadow: '0 1px 4px rgba(0,0,0,.9)' } : { fontSize: 'clamp(16px, 3.2vw, 26px)' }}>
        {tokens.map((tk, i) => (tk.s.trim() === '' ? tk.s : <span key={i} className="story-caption-word" style={{ opacity: tk.at <= upto ? 1 : 0 }}>{tk.s}</span>))}
      </p>
    </>
  );
  return overlay
    ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-[4.5%] pb-[7.5%] pt-[10%]" style={{ background: 'linear-gradient(to top, rgba(8,6,14,.9) 0%, rgba(8,6,14,.74) 50%, rgba(8,6,14,0) 100%)' }}>{body}</div>
    : <div className="w-full px-5 pt-3" style={{ minHeight: '12rem' }}>{body}</div>;
});

function ChapterCard({ beat, lang }: { beat: Beat; lang: Lang }) {
  if (!beat.chapter) return null;
  const shadow = { textShadow: '0 1px 5px rgba(0,0,0,.8)' };
  return (
    <div className="pointer-events-none absolute left-[4.5%] top-[12%] z-10 max-w-[68%]" style={{ animation: 'st-chapter 5.4s ease-out .35s both' }}>
      {beat.chapter.kicker && <div className="font-display uppercase tracking-[0.3em] text-gold-300" style={{ fontSize: 'clamp(9px, 1.5cqw, 20px)', ...shadow }}>{pick(beat.chapter.kicker, lang)}</div>}
      <div className="gold-text title-display leading-tight drop-shadow" style={{ fontSize: 'clamp(15px, 3.4cqw, 54px)' }}>{pick(beat.chapter.title, lang)}</div>
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
          <div className="font-display uppercase tracking-[0.3em] text-gold-300" style={{ fontSize: 'clamp(10px, 1.4cqw, 20px)', animation: `st-title ${OPEN_MS / 1000}s ease-out both` }}>{tr(def.subtitle)} · {tr(MONTHS[def.start.m]!)} {formatYear(def.start.y)}</div>
          <h3 className="title-display gold-text mt-2 leading-tight drop-shadow" style={{ fontSize: 'clamp(22px, 5.4cqw, 88px)', animation: `st-title ${OPEN_MS / 1000}s ease-out .15s both` }}>{tr(def.title)}</h3>
        </div>
      )}
    </div>
  );
}

/** Closing shot: the "what if?" of the scenario, then the screen hands over to the written text. */
function EndCard({ def }: { def: ScenarioDefinition }) {
  return (
    <div className="absolute inset-0">
      <div className="st-cam st-cam-out" style={{ animationDuration: `${END_HOLD_MS / 1000 + 6}s` }}><ArtScene def={def} running={false} /></div>
      <div className="absolute inset-0 bg-ink-950/70" />
      <div className="st-once pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-5 text-center" style={{ animation: 'st-fade-in 1.2s ease-out both' }}>
        <div className="font-display uppercase tracking-[0.3em] text-gold-300" style={{ fontSize: 'clamp(10px, 1.4cqw, 20px)' }}>{tr('History could have turned here')}</div>
        <p className="mt-2 max-w-[80%] font-serif italic leading-snug text-parchment-50" style={{ fontSize: 'clamp(17px, 3.6cqw, 58px)' }}>{tr(def.question)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
/**
 * The opening cutscene of a scenario, in the manner of a game intro: it takes over the whole screen (and the browser's
 * full-screen mode when the browser allows it), starts by itself with animated scenes, music and narration, and has
 * exactly one button — Skip. When it ends (or is skipped) `onDone` is called and the page shows the written background.
 *
 * It is drawn into <body> through a portal so that nothing in the page (the route transition's transform/filter, a
 * stacking context) can shrink it or keep it from covering the screen.
 */
export const StoryPlayer = memo(function StoryPlayer({ def, onDone, active = true }: { def: ScenarioDefinition; onDone: () => void; active?: boolean }) {
  const lang = useLang((s) => s.lang);
  const reduced = useSettings((s) => s.reduceMotion);
  const beats = useMemo(() => buildBeats(def), [def]);
  const { engine, snap } = useStory(def, beats, lang);
  const bed = useMemo(() => new SoundBed(), []);
  const bedState = useSyncExternalStore(bed.subscribe, bed.getState);
  const rootRef = useRef<HTMLDivElement>(null);
  const roomBelow = useMedia('(max-aspect-ratio: 13/10)'); // portrait-ish screens have black room under the picture: the caption goes there
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    engine.pause(); // stops the voice at once while the screen fades back to the page
    onDone();
  }, [engine, leaving, onDone]);
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; });

  // `live`: the cutscene is on screen and in charge. (A page the app is still swapping out never is: it stays silent and invisible.)
  const live = active && !leaving;

  // play only while the tab is showing, and start by itself
  useEffect(() => {
    const update = () => engine.setVisible(live && !document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [engine, live]);
  useEffect(() => {
    if (!live || snap.phase !== 'idle') return;
    const id = window.setTimeout(() => engine.start(), START_DELAY_MS); // a beat of poster first
    return () => window.clearTimeout(id);
  }, [engine, live, snap.phase]);

  // take over the screen: the page underneath neither scrolls nor takes focus
  useEffect(() => {
    if (!live) return;
    const html = document.documentElement;
    const app = document.getElementById('root');
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    app?.setAttribute('inert', '');
    app?.setAttribute('aria-hidden', 'true');
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      html.style.overflow = prev;
      app?.removeAttribute('inert');
      app?.removeAttribute('aria-hidden');
    };
  }, [live]);

  // the browser's own full-screen mode, when it allows one (only right after a click or tap). Leaving it counts as Skip.
  useEffect(() => {
    if (!live) return;
    const el = rootRef.current as FsEl | null;
    if (!el) return;
    const doc = document as FsDoc;
    const current = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
    let entered = false;
    const onChange = () => {
      if (current() === el) entered = true;
      else if (entered) { entered = false; finishRef.current(); }
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    if (navigator.userActivation?.isActive) {
      try {
        const asked = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
        void Promise.resolve(asked).catch(() => { /* the browser said no: the overlay still fills the window */ });
      } catch { /* ignore */ }
    }
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      if (current() === el) { try { void Promise.resolve(doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.()).catch(() => { /* ignore */ }); } catch { /* ignore */ } }
    };
  }, [live]);

  const idx = snap.index;
  const beat = idx >= 0 && idx < beats.length ? beats[idx]! : null;
  const ended = snap.phase === 'ended';

  // the soundtrack: starts with the story, follows the shot, ducks under the narrator, pauses with the picture
  useEffect(() => { bed.setMood(moodFor(idx, snap.count, beat)); }, [bed, idx, snap.count, beat]);
  const musicOn = snap.running || (ended && live);
  useEffect(() => {
    if (musicOn) { bed.start(); bed.resume(); } else bed.pause();
  }, [bed, musicOn]);
  useEffect(() => { bed.setMuted(snap.muted); }, [bed, snap.muted]);
  useEffect(() => { bed.setDuck(snap.voice === 'on' || snap.voice === 'loading'); }, [bed, snap.voice]);
  useEffect(() => { if (leaving) bed.dispose(); }, [bed, leaving]);
  useEffect(() => () => bed.dispose(), [bed]);

  // browsers keep the sound off until the page has had a tap or a key press: the first one, anywhere, turns it on
  useEffect(() => {
    const unlock = () => { engine.unlock(); bed.unlock(); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => { window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true); };
  }, [engine, bed]);

  // after the last shot the question stays for a moment, then the written text takes over
  useEffect(() => {
    if (snap.phase !== 'ended') return;
    const id = window.setTimeout(finish, END_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [snap.phase, finish]);

  // no buttons besides Skip — but the keyboard still works
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
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
  const keyRef = useRef(onKey);
  useEffect(() => { keyRef.current = onKey; });
  useEffect(() => {
    if (!live) return;
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [live]);

  if (!active) return null;

  const userPaused = snap.phase === 'paused' && !leaving;
  const blocked = !leaving && !snap.muted && (snap.voice === 'blocked' || bedState === 'blocked');
  const overall = ended ? 1 : idx < 0 ? 0 : (idx + (snap.total > 0 ? Math.min(1, snap.t / snap.total) : 0)) / snap.count;
  const credit = !def.custom && snap.voice !== 'off';

  return createPortal(
    <motion.div
      ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tr(def.title)}
      data-story-index={idx} data-story-phase={snap.phase} data-story-voice={snap.voice} data-story-sound={bedState} data-story-count={snap.count}
      className="story-root fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-black outline-none"
      style={{ touchAction: 'none' }}
      exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.7, ease: 'easeInOut' }}
    >
      <div className={cx('st-stage relative aspect-video select-none overflow-hidden bg-black', !snap.running && 'st-paused')} style={{ containerType: 'inline-size' }}>
        <AnimatePresence initial={false}>
          <motion.div key={idx} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.9, ease: 'easeInOut' }}>
            {idx < 0 ? <OpeningCard def={def} quiet={snap.phase === 'idle'} />
              : beat ? <ShotView def={def} beat={beat} lang={lang} total={snap.total} running={snap.running} />
                : <EndCard def={def} />}
          </motion.div>
        </AnimatePresence>

        {/* cinematic finish: grain, vignette and letterbox bars */}
        <div className="pointer-events-none absolute inset-0 z-[4] opacity-[.07]" style={{ backgroundImage: 'var(--noise)' }} />
        <div className="pointer-events-none absolute inset-0 z-[4]" style={{ background: 'radial-gradient(ellipse at 50% 55%, transparent 52%, rgba(0,0,0,.55) 100%)' }} />
        <div className="st-once pointer-events-none absolute inset-x-0 top-0 z-[5] bg-black" style={{ height: '5.5%', transformOrigin: 'top', animation: 'st-bars 1.4s ease-out both' }} />
        <div className="st-once pointer-events-none absolute inset-x-0 bottom-0 z-[5] bg-black" style={{ height: '5.5%', transformOrigin: 'bottom', animation: 'st-bars 1.4s ease-out both' }} />

        {beat && !roomBelow && <Caption text={pick(beat.text, lang)} reveal={snap.reveal} overlay />}
      </div>

      {beat && roomBelow && <Caption text={pick(beat.text, lang)} reveal={snap.reveal} overlay={false} />}

      {/* paused from the keyboard: a tap anywhere carries on */}
      {userPaused && (
        <>
          <button type="button" aria-label={tr('Resume')} onClick={() => engine.resume()} className="absolute inset-0 z-[7] cursor-pointer" tabIndex={-1} />
          <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-950/75 text-gold-100 ring-2 ring-gold-300/70"><Pause className="h-7 w-7" fill="currentColor" /></span>
          </div>
        </>
      )}

      {/* the only button: Skip (+ a hint, not a button, when the browser is holding the sound back) */}
      {!leaving && (
        <div className="absolute z-20 flex items-center gap-2" style={{ top: 'max(0.75rem, env(safe-area-inset-top))', right: 'max(0.75rem, env(safe-area-inset-right))' }}>
          {blocked && (
            <span role="status" className="pointer-events-none flex items-center gap-1.5 rounded-full bg-ink-950/80 px-3 py-2 text-[11px] text-gold-100 ring-1 ring-gold-400/60" style={{ animation: 'st-pulse 1.6s ease-in-out infinite' }}>
              <Volume2 className="h-3.5 w-3.5 text-gold-300" /><span className="hidden sm:inline">{tr('Tap the screen for sound')}</span><span className="sr-only sm:hidden">{tr('Tap the screen for sound')}</span>
            </span>
          )}
          <button type="button" onClick={finish} className="flex items-center gap-1.5 rounded-full bg-ink-950/80 px-4 py-2 font-display text-[11px] uppercase tracking-[0.14em] text-parchment-50 ring-1 ring-gold-600/50 transition hover:text-white hover:ring-gold-300 md:text-xs">
            <FastForward className="h-4 w-4" />{tr('Skip')}
          </button>
        </div>
      )}

      {/* a hairline shows how much is left; underneath it the usual note about the artwork */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-[3px] bg-white/10"><div className="h-full bg-gradient-to-r from-gold-400 to-gold-100" style={{ width: `${overall * 100}%` }} /></div>
      <p className="pointer-events-none absolute inset-x-0 bottom-[3px] z-[6] px-4 text-center text-[10.5px] italic leading-snug text-parchment-300/55" style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>
        {tr('Illustrations are artistic and symbolic; the narration follows the documented account.')}{credit && <> · {tr('Voice: ElevenLabs')}</>}
      </p>
    </motion.div>,
    document.body,
  );
});
