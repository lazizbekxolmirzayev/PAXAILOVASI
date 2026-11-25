// Fetches the voice-over clips (one per shot) from /api/tts and hands them to the engine as object URLs.
import type { ClipInfo, VoiceSource } from './engine';

let off = false; // the endpoint failed once: stop asking until the page is reloaded (a reload retries)
export const resetVoiceFlag = (): void => { off = false; };

export class VoiceBank implements VoiceSource {
  private clips = new Map<number, ClipInfo>();
  private ctrl = new AbortController();
  constructor(
    private readonly urlFor: (i: number) => string | null,
    private readonly count: number,
    private readonly doFetch: typeof fetch = (...a) => fetch(...a),
  ) {}

  available(): boolean { return !off; }

  request(i: number): void {
    if (off || i < 0 || i >= this.count || this.clips.has(i)) return;
    const url = this.urlFor(i);
    if (!url) { this.clips.set(i, { status: 'failed' }); return; } // text without a translation: stay silent, nothing to report
    this.clips.set(i, { status: 'loading' });
    const signal = this.ctrl.signal;
    this.doFetch(url, { signal })
      .then(async (r) => {
        if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('audio/')) throw new Error(`HTTP ${r.status}`);
        const blob = await r.blob();
        if (signal.aborted) return;
        this.clips.set(i, { status: 'ready', url: URL.createObjectURL(blob) });
      })
      .catch((e: unknown) => {
        if (signal.aborted) return;
        this.clips.set(i, { status: 'failed' });
        off = true;
        console.warn('[story] voice-over unavailable:', e instanceof Error ? e.message : e);
      });
  }

  clip(i: number): ClipInfo {
    this.request(i);
    return this.clips.get(i) ?? { status: 'failed' };
  }

  /** Cancels downloads and frees the clips; the bank can be used again afterwards. */
  dispose(): void {
    this.ctrl.abort();
    this.ctrl = new AbortController();
    for (const c of this.clips.values()) if (c.url) URL.revokeObjectURL(c.url);
    this.clips.clear();
  }
}
