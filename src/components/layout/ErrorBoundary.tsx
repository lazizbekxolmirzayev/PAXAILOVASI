import { Component, type ReactNode } from 'react';
import { tr } from '../../i18n';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('UI error', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="panel panel-ornate max-w-lg p-6 text-center">
          <h1 className="title-display gold-text text-xl">{tr('The chronicle is torn')}</h1>
          <p className="mt-3 text-sm text-parchment-200">{tr('An unexpected error occurred:')} <code className="text-blood-400">{this.state.error.message}</code></p>
          <p className="mt-2 text-xs text-parchment-300/60">{tr('Your last autosave is kept in My Worlds.')}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="btn-ghost" onClick={() => this.setState({ error: null })}>{tr('Try again')}</button>
            <a className="btn-gold" href="/">{tr('Main menu')}</a>
          </div>
        </div>
      </div>
    );
  }
}
