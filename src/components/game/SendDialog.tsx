import { useEffect, useMemo, useState } from 'react';
import { Anchor, Clock, Swords, Send } from 'lucide-react';
import { useGame } from '../../store/game';
import { Button, Modal, Slider, Badge } from '../ui';
import { useN, useT } from '../../i18n';
import { UNIT, UNIT_KINDS, LAND_KINDS, emptyUnits, soldiersOf, rtOf, sendMarch, estimateOdds, routeBetween, cityKind, TRAVEL_ATTACK, TRAVEL_SUPPORT, SHIP_CAPACITY, countryStats } from '../../engine/rt';
import type { Units } from '../../types/game';
import { KV, NumberInput, Res, UnitsGrid, num } from './parts';

/** Choose which troops / supplies to send from one city to another (attack or help). */
export function SendDialog() {
  const send = useGame((s) => s.send);
  const close = useGame((s) => s.closeSend);
  useGame((s) => s.version);
  const w = useGame((s) => s.world);
  const st = useGame((s) => s.st);
  const act = useGame((s) => s.act);
  const t = useT();
  const n = useN();
  const [sel, setSel] = useState<Units>(emptyUnits());
  const [gold, setGold] = useState(0);
  const [food, setFood] = useState(0);
  const key = send ? `${send.from}-${send.to}-${send.kind}` : '';
  useEffect(() => {
    if (!send || !w) return;
    const g = rtOf(w).cities[send.from].garrison;
    const u = emptyUnits();
    for (const k of UNIT_KINDS) u[k] = send.kind === 'attack' ? Math.floor(g[k] * (k === 'fleet' ? 0 : 0.7)) : 0;
    setSel(u); setGold(0); setFood(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const info = useMemo(() => {
    if (!send || !w || !st) return null;
    const rt = rtOf(w);
    return { from: w.provinces[send.from], to: w.provinces[send.to], fs: rt.cities[send.from], ts: rt.cities[send.to], route: routeBetween(w, st, send.from, send.to) };
  }, [send, w, st, key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!send || !w || !st || !info) return null;
  const me = w.player!;
  const { from, to, fs, ts, route } = info;
  const attack = send.kind === 'attack';
  const targetOwner = to.owner ? w.countries[to.owner] : null;
  const sold = soldiersOf(sel);
  const odds = attack ? estimateOdds(w, to.id, me, sel) : 0;
  const capacity = sel.fleet * SHIP_CAPACITY;
  const seaProblem = route === 'sea' && sold > capacity;
  const secs = attack ? TRAVEL_ATTACK : TRAVEL_SUPPORT;
  const setK = (k: keyof Units, v: number) => setSel({ ...sel, [k]: Math.max(0, Math.min(Math.floor(fs.garrison[k]), Math.floor(v))) });
  const preset = (f: number) => { const u = emptyUnits(); for (const k of UNIT_KINDS) u[k] = Math.floor(fs.garrison[k] * f); setSel(u); };
  const verdict = !attack ? null : odds >= 1.6 ? { tone: 'green' as const, text: 'Strong advantage' } : odds >= 1.05 ? { tone: 'gold' as const, text: 'Slight advantage' } : odds >= 0.7 ? { tone: 'red' as const, text: 'Risky' } : { tone: 'red' as const, text: 'Likely defeat' };

  const go = () => {
    const r = act((ww, ss) => sendMarch(ww, ss, me, from.id, to.id, send.kind, sel, gold, food));
    if (r.ok) close();
  };
  const kinds = route === 'sea' || true ? UNIT_KINDS : LAND_KINDS;

  return (
    <Modal open onClose={close} wide title={attack ? t('March against {city}', { city: n(to.name) }) : t('Send help to {city}', { city: n(to.name) })}
      footer={<><Button onClick={close}>{t('Cancel')}</Button><Button variant="gold" icon={attack ? <Swords className="h-4 w-4" /> : <Send className="h-4 w-4" />} disabled={sold < 1 && sel.fleet < 1 && gold < 1 && food < 1} onClick={go}>{attack ? t('March!') : t('Send')}</Button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="label">{t('From')}: {n(from.name)}</div>
          <p className="mb-2 text-[11px] text-parchment-300/70">{t('Choose units to send:')}</p>
          <div className="mb-2 flex gap-1.5">
            <Button size="sm" onClick={() => preset(0)}>{t('None')}</Button><Button size="sm" onClick={() => preset(0.5)}>50%</Button><Button size="sm" onClick={() => preset(0.8)}>80%</Button><Button size="sm" onClick={() => preset(1)}>{t('All')}</Button>
          </div>
          <div className="space-y-2">
            {kinds.filter((k) => fs.garrison[k] >= 1).map((k) => (
              <div key={k}>
                <div className="flex items-center justify-between text-xs"><span className="text-parchment-100">{t(UNIT[k].name)} <span className="text-parchment-300/60">/ {num(fs.garrison[k])}</span></span><NumberInput value={sel[k]} max={Math.floor(fs.garrison[k])} onChange={(v) => setK(k, v)} /></div>
                <Slider value={sel[k]} min={0} max={Math.max(1, Math.floor(fs.garrison[k]))} step={1} onChange={(v) => setK(k, v)} />
              </div>
            ))}
            {!kinds.some((k) => fs.garrison[k] >= 1) && <p className="text-xs text-blood-400">{t('There are no troops in this city.')}</p>}
          </div>
          {!attack && (
            <div className="mt-3 space-y-2 border-t border-gold-700/20 pt-3">
              <div className="flex items-center justify-between text-xs"><span>{t('Gold')} <span className="text-parchment-300/60">/ {num(fs.gold)}</span></span><NumberInput value={gold} max={Math.floor(fs.gold)} onChange={setGold} /></div>
              <div className="flex items-center justify-between text-xs"><span>{t('Food')} <span className="text-parchment-300/60">/ {num(fs.food)}</span></span><NumberInput value={food} max={Math.floor(fs.food)} onChange={setFood} /></div>
            </div>
          )}
        </div>
        <div>
          <div className="label">{t('Target')}: {n(to.name)}</div>
          <div className="rounded-md bg-ink-950/60 p-3 ring-1 ring-gold-700/25">
            <div className="mb-1 flex items-center justify-between"><b className="text-gold-100">{targetOwner ? n(targetOwner.name) : t('Unclaimed land')}</b><Badge tone="gray">{t(cityKindLabel(cityKind(w, to.id)))}</Badge></div>
            {to.owner && <><KV k="Soldiers" v={num(soldiersOf(ts.garrison))} /><UnitsGrid units={ts.garrison} className="my-1.5 border-y border-gold-700/15 py-1.5" /><KV k="Gold" v={num(ts.gold)} /><KV k="Food" v={num(ts.food)} /><KV k="Fortification" v={`${to.fort}/5`} /></>}
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-parchment-200"><Clock className="h-3.5 w-3.5 text-gold-300" />{t('Travel time')}: <b className="stat-num">{secs} {t('sec')}</b>{attack && <span className="text-parchment-300/60"> + {t('battle')} 30 {t('sec')}</span>}</div>
            {route === 'sea' && <div className={`flex items-center gap-1.5 ${seaProblem || sel.fleet < 1 ? 'text-blood-400' : 'text-sky-300'}`}><Anchor className="h-3.5 w-3.5" />{t('Sea route: ships carry {n} soldiers each. Selected: {s} ships ({c} soldiers).', { n: SHIP_CAPACITY, s: num(sel.fleet), c: num(capacity) })}</div>}
            {route === null && <div className="text-blood-400">{t('There is no land or sea route to this city.')}</div>}
            {attack && (
              <div className="rounded-md bg-ink-950/60 p-2.5 ring-1 ring-gold-700/25">
                <div className="mb-1 flex items-center justify-between"><span className="text-parchment-300/75">{t('Sending')}: <b className="stat-num text-parchment-50">{num(sold)}</b> {t('soldiers')}</span>{verdict && <Badge tone={verdict.tone}>{t(verdict.text)}</Badge>}</div>
                <p className="text-[11px] text-parchment-300/60">{t('The defenders will be warned the moment you set out and may bring reinforcements.')}</p>
                {targetOwner && !wars(w, me, targetOwner.id) && <p className="mt-1 text-[11px] text-amber-300">{t('This will declare war on {c}.', { c: n(targetOwner.name) })}</p>}
              </div>
            )}
            <div className="text-parchment-300/60">{t('Your total')}: <Res gold={countryStats(w, me).gold} food={countryStats(w, me).food} /></div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function wars(w: import('../../types/game').World, a: string, b: string): boolean { return w.wars.some((x) => !x.ended && ((x.attackers.includes(a) && x.defenders.includes(b)) || (x.attackers.includes(b) && x.defenders.includes(a)))); }
export function cityKindLabel(k: string): string { return k === 'capital' ? 'Capital' : k === 'city' ? 'City' : k === 'fortress' ? 'Castle' : k === 'town' ? 'Town' : 'Village'; }
