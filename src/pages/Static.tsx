import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { EmptyState, Loading, Panel, Stat } from '../components/ui';
import { listVisitors, splitDuration, summarize, type Summary } from '../services/visitors';
import { tr } from '../i18n';

function fmtPlay(sec: number): string {
  const { h, m } = splitDuration(sec);
  if (h) return tr('{h} h {m} min', { h, m });
  if (m) return tr('{m} min', { m });
  return tr('Under 1 min');
}

/** Open statistics page (/royhat): who came in, how many times, and how long they really played. No password. */
export default function StaticPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { setData(summarize(await listVisitors())); setErr(false); } catch { setErr(true); } finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const people = data?.people ?? [];
  const measured = people.some((p) => p.playSec !== null);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="btn-ghost mb-3 inline-flex items-center gap-1.5 !py-1.5"><ArrowLeft className="h-4 w-4" />{tr('Home')}</Link>
      <Panel ornate title="Statistics" actions={<button onClick={() => void load()} disabled={busy} aria-label={tr('Refresh')} title={tr('Refresh')} className="rounded p-1.5 text-gold-300 hover:bg-ink-800 hover:text-gold-100 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></button>}>
        {err && <div className="mb-2 text-xs text-blood-400">{tr('Could not load the data')}</div>}
        {!data && !err && <Loading />}
        {data && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="stats-cards">
              <Stat label="People" value={people.length} />
              <Stat label="Visits" value={data.visits} />
              <div className="col-span-2 sm:col-span-1"><Stat label="Time played" value={measured ? fmtPlay(data.playSec) : '—'} /></div>
            </div>
            {people.length === 0 ? <EmptyState title={tr('No visitors yet')} /> : (
              <ul className="divide-y divide-gold-600/20">
                {people.map((p, i) => (
                  <li key={p.name.toLowerCase()} className="flex items-center gap-3 py-2.5">
                    <span className="w-6 shrink-0 text-xs text-parchment-300/50">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-parchment-50">{p.name}</div>
                      <div className="text-[11px] text-parchment-300/60">{tr('Last visit')}: {p.lastAt > 0 ? new Date(p.lastAt).toLocaleString() : '—'} · {tr('Visits')}: {p.visits}</div>
                    </div>
                    <span className="shrink-0 text-sm text-gold-200" title={tr('Time played')}>{p.playSec === null ? '—' : fmtPlay(p.playSec)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[11px] leading-snug text-parchment-300/50">{tr('Play time is counted while the site is open and in use. Visits from before it was measured show —.')}</p>
          </>
        )}
      </Panel>
    </div>
  );
}
