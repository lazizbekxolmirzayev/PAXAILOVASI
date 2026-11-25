import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { addVisitor, resumeVisit, retryPending } from '../../services/visitors';

const KEY = 'whatif.me.v2';
const VISIT = 'whatif.visit';
const known = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };

/** Full-screen, mandatory name form shown once per browser. Not shown on /royhat. */
export function NameGate() {
  const { pathname } = useLocation();
  const [done, setDone] = useState(known);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    void retryPending();
    resumeVisit(); // same browser session after a reload: keep measuring play time on the same record
    // Returning visitor: log one more visit per browser session (not for the list page itself).
    try {
      const me = localStorage.getItem(KEY);
      if (me && !sessionStorage.getItem(VISIT) && !pathname.startsWith('/royhat') && !pathname.startsWith('/static')) { sessionStorage.setItem(VISIT, '1'); void addVisitor(me); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (done || pathname.startsWith('/royhat') || pathname.startsWith('/static')) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const f = first.trim(), l = last.trim();
    if (f.length < 2 || l.length < 2) { setErr('Ism va familyani to‘liq yozing'); return; }
    void addVisitor(`${f} ${l}`);
    try { localStorage.setItem(KEY, `${f} ${l}`); sessionStorage.setItem(VISIT, '1'); } catch { /* ignore */ }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink-950/95 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="panel panel-ornate w-full max-w-md p-7">
        <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.45em] text-gold-400">Xush kelibsiz</div>
        <h1 className="title-display gold-text text-center text-5xl font-extrabold leading-none">What If?</h1>
        <div className="divider-gold mx-auto my-5 w-48" />
        <p className="mb-5 text-center font-serif text-lg text-parchment-100/90">Davom etish uchun ism va familyangizni yozing</p>
        <div className="space-y-3">
          <input autoFocus value={first} onChange={(e) => { setFirst(e.target.value); setErr(''); }} maxLength={40} className="input w-full" placeholder="Ism" aria-label="Ism" />
          <input value={last} onChange={(e) => { setLast(e.target.value); setErr(''); }} maxLength={40} className="input w-full" placeholder="Familya" aria-label="Familya" />
          {err && <div className="text-xs text-blood-400">{err}</div>}
          <button type="submit" className="btn-gold w-full py-2.5">Kirish</button>
        </div>
      </motion.form>
    </div>
  );
}
