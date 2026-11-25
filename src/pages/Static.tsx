import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { EmptyState, Loading, Panel, Stat } from '../components/ui';
import { listVisitors, summarize, type Summary } from '../services/visitors';
import { tr } from '../i18n';

/** Open statistics page (/royhat): who came in and how many times. No password. */
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
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="btn-ghost mb-3 inline-flex items-center gap-1.5 !py-1.5"><ArrowLeft className="h-4 w-4" />{tr('Home')}</Link>
      <Panel ornate title="Statistics" actions={<button onClick={() => void load()} disabled={busy} aria-label={tr('Refresh')} title={tr('Refresh')} className="rounded p-1.5 text-gold-300 hover:bg-ink-800 hover:text-gold-100 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></button>}>
        {err && <div className="mb-2 text-xs text-blood-400">{tr('Could not load the data')}</div>}
        {!data && !err && <Loading />}
        {data && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2" data-testid="stats-cards">
              <Stat label="People" value={people.length} />
              <Stat label="Visits" value={data.visits} />
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
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
