import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ScenarioDefinition } from '../types/game';
import { StoryEngine, type Snapshot } from './engine';
import { isTranslated, pick, type Beat, type Lang } from './script';
import { textHash } from './hash';
import { VoiceBank } from './voice';

const MUTE_KEY = 'whatif.story.muted';
const readMuted = (): boolean => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };
const writeMuted = (m: boolean): void => { try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ } };

/** URL of one shot's voice-over, or null when it can't be voiced (no translation for this language). */
export const voiceUrl = (scenarioId: string, i: number, lang: Lang, beat: Beat | undefined): string | null => {
  if (!beat || !isTranslated(beat.text, lang)) return null;
  return `/api/tts?id=${encodeURIComponent(scenarioId)}.${i}&lang=${lang}&h=${textHash(pick(beat.text, lang))}`;
};

export function useStory(def: ScenarioDefinition, beats: Beat[], lang: Lang): { engine: StoryEngine; snap: Snapshot } {
  const engine = useMemo(() => {
    const voiceOk = !def.custom && typeof Audio !== 'undefined'; // only built-in scenarios have whitelisted narration
    const audio = voiceOk ? new Audio() : null;
    if (audio) audio.preload = 'auto';
    const voice = voiceOk ? new VoiceBank((i) => voiceUrl(def.id, i, lang, beats[i]), beats.length) : null;
    return new StoryEngine({
      beats, lang, audio, voice, muted: readMuted(), onMutedChange: writeMuted,
      hasActivation: () => !!(typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive),
    });
  }, [def.id, def.custom, beats, lang]);

  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  useEffect(() => { engine.attach(); return () => engine.detach(); }, [engine]);

  // the animation-frame loop only exists while the story is actually running
  useEffect(() => {
    if (!snap.running) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      engine.tick(Math.min(250, now - last)); // real elapsed time, so a slow device doesn't slow the story down
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, snap.running]);

  return { engine, snap };
}
