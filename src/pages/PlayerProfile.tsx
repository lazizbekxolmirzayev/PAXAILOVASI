import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, UserPlus } from 'lucide-react';
import { useProfile, syncProfile } from '../services/profile';
import { signIn, signOut, signUp } from '../services/auth';
import { cloudEnabled } from '../services/supabase';
import { listCustom } from '../services/scenarios';
import { listSaves } from '../services/saves';
import { Badge, Button, ErrorBox, Field, Panel, SectionTitle, Stat, Tabs } from '../components/ui';
import { ACHIEVEMENTS } from '../engine/achievements';
import { SCENARIO_BY_ID } from '../data/scenarios';
import { tr } from '../i18n';

export default function PlayerProfile() {
  const p = useProfile();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ scenarios: 0, worlds: 0 });
  useEffect(() => { void Promise.all([listCustom(), listSaves()]).then(([s, w]) => setCounts({ scenarios: s.length, worlds: w.length })).catch(() => undefined); }, []);
  const submit = async () => {
    setErr(null); setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Enter a valid email.'); return; }
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setBusy(true);
    try { if (mode === 'up') { await signUp(email, pw, p.displayName); setMsg('Account created — check your inbox to confirm your email.'); } else { await signIn(email, pw); setMsg('Signed in.'); } }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div>
      <SectionTitle kicker={tr('Player profile')}>{p.displayName}</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label={tr('Games started')} value={p.stats.gamesStarted} />
            <Stat label={tr('Years simulated')} value={Math.floor(p.stats.monthsSimulated / 12)} />
            <Stat label={tr('Wars fought')} value={p.stats.warsFought} />
            <Stat label={tr('Achievements')} value={`${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}`} />
            <Stat label={tr('Saved worlds')} value={counts.worlds} />
            <Stat label={tr('Custom scenarios')} value={counts.scenarios} />
            <Stat label={tr('Worlds created')} value={p.stats.worldsCreated} />
            <Stat label={tr('Favourites')} value={p.favorites.length} />
          </div>
          <Panel title={tr('Favourite scenarios')}>
            {p.favorites.length ? <div className="flex flex-wrap gap-2">{p.favorites.map((f) => <Link key={f} to={`/scenarios/${f}`}><Badge>{SCENARIO_BY_ID[f]?.title ?? f}</Badge></Link>)}</div> : <p className="text-sm text-parchment-300/60">{tr('Mark scenarios with the heart icon.')}</p>}
          </Panel>
          <Panel title={tr('Recent achievements')}>
            {Object.entries(p.achievements).slice(-6).reverse().map(([id, at]) => <div key={id} className="flex justify-between text-sm"><span>{ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id}</span><span className="text-xs text-parchment-300/60">{new Date(at).toLocaleDateString()}</span></div>)}
            {!Object.keys(p.achievements).length && <p className="text-sm text-parchment-300/60">{tr('None yet.')} <Link to="/achievements" className="text-gold-300">{tr('See all')}</Link></p>}
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title={tr('Identity')}>
            <Field label={tr('Display name')}><input className="input" value={p.displayName} maxLength={32} onChange={(e) => p.setIdentity({ displayName: e.target.value })} onBlur={() => void syncProfile()} /></Field>
            <p className="mt-2 text-xs text-parchment-300/60">{p.userId ? <>{tr('Signed in as')} <b>{p.email}</b>{tr('. Saves, achievements and shared scenarios sync to the cloud.')}</> : 'Guest profile — stored on this device.'}</p>
          </Panel>
          <Panel title={tr('Account')}>
            {!cloudEnabled ? <ErrorBox error="Accounts need Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Everything else works offline as a guest." /> : p.userId ? (
              <Button icon={<LogOut className="h-4 w-4" />} onClick={() => void signOut()}>{tr('Sign out')}</Button>
            ) : (
              <div className="space-y-3">
                <Tabs value={mode} onChange={setMode} tabs={[{ id: 'in', label: 'Sign in' }, { id: 'up', label: 'Create account' }]} />
                <Field label={tr('Email')}><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label={tr('Password')} hint={tr('At least 8 characters')}><input className="input" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
                {err && <ErrorBox error={err} />}
                {msg && <p className="text-sm text-emerald-300">{msg}</p>}
                <Button variant="gold" className="w-full" loading={busy} icon={mode === 'up' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />} onClick={() => void submit()}>{mode === 'up' ? 'Create account' : 'Sign in'}</Button>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
