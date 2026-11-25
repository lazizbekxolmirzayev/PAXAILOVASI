import { Component, type ReactNode } from 'react';

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
