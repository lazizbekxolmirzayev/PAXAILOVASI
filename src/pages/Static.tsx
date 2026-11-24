import { useState } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import { Button, EmptyState, Panel } from '../components/ui';
import { fmtMinutes, listVisitors, removeVisitor, type Visitor } from '../services/visitors';

const PIN = '1234';

export default function StaticPage() {
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);
  const [rows, setRows] = useState<Visitor[]>([]);
  const [err, setErr] = useState(false);
  const load = async () => { try { setRows(await listVisitors(PIN)); setErr(false); } catch { setErr(true); } };

  if (!ok) {
    return (
      <div className="mx-auto max-w-sm py-16">
        <Panel ornate title="PIN">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (pin === PIN) { setOk(true); void load(); } else { setBad(true); setPin(''); } }}>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-400" />
              <input autoFocus type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => { setPin(e.target.value); setBad(false); }} className="input pl-9 tracking-[0.5em]" placeholder="PIN" />
            </div>
            {bad && <div className="text-xs text-blood-400">PIN noto‘g‘ri</div>}
            <Button variant="gold" type="submit" className="w-full">OK</Button>
          </form>
        </Panel>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl py-8">
      <Panel ornate title="Statistika" subtitle={`${rows.length}`}>
        {err && <div className="mb-2 text-xs text-blood-400">Ma‘lumot olinmadi</div>}
        {rows.length === 0 ? <EmptyState title="Hozircha ro‘yxat bo‘sh" /> : (
          <ul className="divide-y divide-gold-600/20">
            {rows.map((v, i) => (
              <li key={v.id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-xs text-parchment-300/50">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-parchment-50">{v.name}</div>
                  <div className="text-[11px] text-parchment-300/60">{new Date(v.at).toLocaleString()}</div>
                </div>
                <span className="text-sm text-gold-200">{fmtMinutes(v.minutes)}</span>
                <button aria-label="O‘chirish" title="O‘chirish" onClick={() => { void removeVisitor(v.id, PIN).then(load); }} className="rounded p-1.5 text-parchment-300/70 hover:bg-blood-500/20 hover:text-blood-400"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
