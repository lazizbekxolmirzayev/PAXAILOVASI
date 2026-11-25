import { Component, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FastForward } from 'lucide-react';
import { tr } from '../i18n';

/**
 * The cutscene is an extra: if anything in it fails (the lazy chunk can't load, an old browser lacks an API, a scene
 * throws), the page quietly shows the written background instead of an error screen.
 */
export class IntroGuard extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidCatch(error: unknown): void {
    console.warn('[story] cutscene failed, showing the written text instead:', error);
    this.props.onFail();
  }
  render(): ReactNode { return this.state.failed ? null : this.props.children; }
}

/**
 * What the screen shows while the cutscene's code is still arriving: plain black, so the hand-over to the player is
 * seamless. If the wait drags on, a Skip button appears so nobody is ever stuck behind a black screen.
 */
export function StoryBlackout({ active, onSkip }: { active: boolean; onSkip: () => void }): ReactNode {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setLate(true), 1200);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip(); };
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(id); window.removeEventListener('keydown', onKey); };
  }, [active, onSkip]);
  if (!active) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black" role="status" aria-label={tr('Loading…')}>
      {late && (
        <button type="button" onClick={onSkip} className="absolute flex items-center gap-1.5 rounded-full bg-ink-950/80 px-4 py-2 font-display text-[11px] uppercase tracking-[0.14em] text-parchment-50 ring-1 ring-gold-600/50 transition hover:text-white hover:ring-gold-300 md:text-xs" style={{ top: 'max(0.75rem, env(safe-area-inset-top))', right: 'max(0.75rem, env(safe-area-inset-right))' }}>
          <FastForward className="h-4 w-4" />{tr('Skip')}
        </button>
      )}
    </div>,
    document.body,
  );
}
