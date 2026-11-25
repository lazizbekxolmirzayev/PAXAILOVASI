import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Anchor, Castle, Coins, Crown, Gift, Handshake, Hammer, HeartHandshake, MapPin, Shield, Swords, Tractor, Users, X, Landmark, ScrollText, Store, Route } from 'lucide-react';
import { useGame } from '../../store/game';
import { ShieldFlag } from '../ui/Flag';
import { Filigree } from '../ui/Ornament';
import { Badge, Bar, Button, Modal, cx } from '../ui';
import { fmtNum, isAtWar, peekRelation, militaryPower } from '../../engine/util';
import { GOVERNMENTS } from '../../data/eras';
import { techLevel } from '../../data/technologies';
import { REGION_LABEL } from '../../data/regions';
import type { BuildingKind, DiploAction } from '../../types/game';
import { maxBuildingLevel, colonizeCost, improveCost } from '../../engine/commands';
import { buildCost } from '../../engine/ai';
import { evaluateProposal } from '../../engine/diplomacy';
import { useSettings } from '../../services/settings';
import { tr } from '../../i18n';

const BUILD: { key: BuildingKind; label: string; icon: React.ReactNode; effect: string }[] = [
  { key: 'farms', label: 'Farms', icon: <Tractor className="h-3.5 w-3.5" />, effect: '+12% food capacity' },
  { key: 'roads', label: 'Roads', icon: <Route className="h-3.5 w-3.5" />, effect: 'Output, logistics' },
  { key: 'market', label: 'Market', icon: <Store className="h-3.5 w-3.5" />, effect: '+6% output, urbanisation' },
  { key: 'buildings', label: 'Public works', icon: <Landmark className="h-3.5 w-3.5" />, effect: 'Sanitation, storage, calm' },
  { key: 'port', label: 'Port', icon: <Anchor className="h-3.5 w-3.5" />, effect: 'Trade, naval reach' },
  { key: 'fort', label: 'Fortress', icon: <Castle className="h-3.5 w-3.5" />, effect: 'Defence, slower sieges' },
];

export function CountryPanel({ onClose }: { onClose: () => void }) {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const st = useGame((s) => s.st)!;
  const cid = useGame((s) => s.selectedCountry);
  const pid = useGame((s) => s.selectedProvince);
  const dispatch = useGame((s) => s.dispatch);
  const confirmWar = useSettings((s) => s.confirmWar);
  const [warConfirm, setWarConfirm] = useState(false);
  const c = cid ? w.countries[cid] : null;
  const p = pid !== null ? w.provinces[pid] : null;
  const me = w.player ? w.countries[w.player] : null;
  const isMe = !!c && c.id === w.player;
  const rel = c && me && !isMe ? peekRelation(w, me.id, c.id) : undefined;
  const atWar = c && me ? isAtWar(w, me.id, c.id) : false;
  const diplo = (action: DiploAction) => me && c && dispatch({ type: 'diplo', country: me.id, target: c.id, action });
  const preview = (action: DiploAction) => (me && c ? evaluateProposal(w, me, c, action, st) : null);

  return (
    <aside className="panel pointer-events-auto flex max-h-full w-full flex-col md:w-[360px]">
      <Filigree />
      <div className="flex items-start gap-3 border-b border-gold-600/25 p-4" style={{ background: c ? `linear-gradient(180deg, ${c.color}33, transparent)` : undefined }}>
        {c ? <ShieldFlag flag={c.flag} className="h-16 w-14 shrink-0 drop-shadow-[0_4px_6px_rgba(0,0,0,.8)]" title={c.name} /> : <MapPin className="h-8 w-8 text-gold-300" />}
        <div className="min-w-0 flex-1">
          <h2 className="font-deco truncate text-[17px] font-bold text-gold-100">{c ? c.name : p ? p.name : tr('Unclaimed')}</h2>
          {c && <div className="text-[11px] text-parchment-300/70">{tr(GOVERNMENTS[c.government].name)}{c.overlord && w.countries[c.overlord] ? ` · ${tr('vassal of')} ${w.countries[c.overlord].name}` : ''}</div>}
          {c && <div className="mt-1 flex flex-wrap gap-1">{isMe && <Badge>{tr('Your nation')}</Badge>}{!c.alive && <Badge tone="red">{tr('Collapsed')}</Badge>}{c.tribal && <Badge tone="gray">{tr('Tribal / non-state')}</Badge>}{!c.historical && <Badge tone="purple">{tr('Created in this timeline')}</Badge>}{atWar && <Badge tone="red">{tr('At war with you')}</Badge>}{rel?.treaties.alliance && <Badge tone="green">{tr('Ally')}</Badge>}</div>}
        </div>
        <button onClick={onClose} className="nav-icon !h-7 !w-7 shrink-0" aria-label={tr('Close panel')}><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
        {c && c.alive && (
          <>
            <div className="text-xs text-parchment-200/80"><Crown className="mr-1 inline h-3.5 w-3.5 text-gold-300" />{tr(c.ruler.title)} {c.ruler.name} <span className="text-parchment-300/50">({tr(c.ruler.historical ? 'historical figure' : 'generated')}, {tr('age')} {w.date.y - c.ruler.born})</span></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info label={tr('Population')} value={fmtNum(c.pop.total)} />
              <Info label={tr('GDP / yr')} value={fmtNum(c.economy.gdp)} />
              <Info label={tr('Treasury')} value={fmtNum(c.economy.treasury)} />
              <Info label={tr('Food')} value={`${fmtNum(c.food.production)} / ${fmtNum(c.food.consumption)}`} />
              <Info label={tr('Army')} value={`${c.military.regiments.toFixed(1)}k · q${c.military.quality.toFixed(2)}`} />
              <Info label={tr('Technology')} value={techLevel(c.tech.known).toFixed(2)} />
              <Info label={tr('Provinces')} value={String(c.provinceCount)} />
              <Info label={tr('Power')} value={militaryPower(c).toFixed(0)} />
            </div>
            <Bar label={tr('Stability')} value={c.stability.value} right={Math.round(c.stability.value)} color={c.stability.value < 35 ? 'red' : 'green'} />
            <Bar label={tr('Legitimacy')} value={c.stability.legitimacy} right={Math.round(c.stability.legitimacy)} />
            {!isMe && me && me.alive && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="label !mb-0">{tr('Relations with you')}</span>
                  <span className="stat-num text-parchment-100">{tr('opinion')} {Math.round(rel?.opinion ?? 0)} · trust {Math.round(rel?.trust ?? 30)}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1">{Object.keys(rel?.treaties ?? {}).map((t) => <Badge key={t} tone="blue">{t}</Badge>)}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" icon={<HeartHandshake className="h-3.5 w-3.5" />} onClick={() => diplo('improve')} title={`Costs ${fmtNum(improveCost(me))}`}>{tr('Improve')}</Button>
                  <Button size="sm" icon={<Gift className="h-3.5 w-3.5" />} onClick={() => diplo('gift')}>{tr('Send gift')}</Button>
                  {!atWar && <>
                    <Button size="sm" icon={<Handshake className="h-3.5 w-3.5" />} onClick={() => diplo(rel?.treaties.alliance ? 'breakAlliance' : 'alliance')} title={odds(preview('alliance'))}>{tr(rel?.treaties.alliance ? 'Break alliance' : 'Alliance')}</Button>
                    <Button size="sm" icon={<Coins className="h-3.5 w-3.5" />} onClick={() => diplo(rel?.treaties.trade ? 'cancelTrade' : 'trade')} title={odds(preview('trade'))}>{tr(rel?.treaties.trade ? 'End trade' : 'Trade deal')}</Button>
                    {!rel?.treaties.nap && <Button size="sm" icon={<Shield className="h-3.5 w-3.5" />} onClick={() => diplo('nap')} title={odds(preview('nap'))}>{tr('Non-aggression')}</Button>}
                    {c.overlord !== me.id ? <Button size="sm" icon={<Crown className="h-3.5 w-3.5" />} onClick={() => diplo('vassalize')} title={odds(preview('vassalize'))}>{tr('Demand vassalage')}</Button> : <Button size="sm" onClick={() => diplo('releaseVassal')}>{tr('Release vassal')}</Button>}
                    <Button size="sm" variant="danger" icon={<Swords className="h-3.5 w-3.5" />} onClick={() => (confirmWar ? setWarConfirm(true) : diplo('declareWar'))}>{tr('Declare war')}</Button>
                  </>}
                  {atWar && <>
                    <Button size="sm" onClick={() => diplo('peaceWhite')}>{tr('Offer white peace')}</Button>
                    <Button size="sm" variant="gold" onClick={() => diplo('peaceDemand')}>{tr('Demand territory')}</Button>
                  </>}
                </div>
                <Link to="/game/diplomacy" className="mt-2 block text-[11px] text-gold-300 hover:underline">{tr('Open diplomacy screen →')}</Link>
              </div>
            )}
            {isMe && <div className="grid grid-cols-2 gap-1.5">{[['Economy', '/game/economy'], ['Military', '/game/military'], ['Technology', '/game/technology'], ['Diplomacy', '/game/diplomacy']].map(([l, to]) => <Link key={to} to={to} className="btn-ghost !py-1.5 !text-xs">{tr(l)}</Link>)}</div>}
          </>
        )}
        {c && !c.alive && <p className="text-sm text-parchment-300/80">{c.name} no longer exists in this timeline{c.collapsed ? ` (collapsed ${c.collapsed.y})` : ''}. <Link className="text-gold-300 hover:underline" to="/game/historian">{tr('Ask the AI Historian why →')}</Link></p>}

        {p && (
          <div className="rounded-md bg-ink-950/50 p-3 ring-1 ring-gold-700/30">
            <div className="flex items-center justify-between"><div className="font-serif text-lg font-bold text-gold-100">{p.name}</div><span className="text-[10px] text-parchment-300/60">{tr(REGION_LABEL[p.region])}</span></div>
            <div className="mb-2 text-[11px] text-parchment-300/60">{tr('Province in modern')} {p.modern} · {fmtNum(p.area)} km² {p.id === c?.capital && `· ${tr('capital')}`}</div>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <Info label={tr('Pop')} value={fmtNum(p.pop)} /><Info label={tr('Dev')} value={String(p.dev)} /><Info label={tr('Unrest')} value={`${Math.round(p.unrest)}%`} />
            </div>
            {me && p.owner === me.id && (
              <div className="mt-3 space-y-1">
                <div className="label">Build & invest</div>
                {BUILD.filter((b) => b.key !== 'port' || p.coastal).map((b) => {
                  const lvl = p[b.key];
                  const max = maxBuildingLevel(me, b.key);
                  const cost = buildCost(w, me, lvl);
                  return (
                    <div key={b.key} className="flex items-center gap-2 text-xs">
                      <span className="text-gold-300">{b.icon}</span>
                      <span className="w-24 text-parchment-100">{tr(b.label)}</span>
                      <span className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => <span key={i} className={cx('h-1.5 w-3 rounded-sm', i < lvl ? 'bg-gold-300' : i < max ? 'bg-ink-700' : 'bg-ink-950')} />)}</span>
                      <button disabled={lvl >= max || me.economy.treasury < cost} onClick={() => dispatch({ type: 'build', country: me.id, province: p.id, building: b.key })} className="ml-auto rounded px-1.5 py-0.5 text-[11px] text-gold-200 ring-1 ring-gold-600/40 hover:bg-ink-700 disabled:opacity-30" title={tr(b.effect)}><Hammer className="mr-1 inline h-3 w-3" />{fmtNum(cost)}</button>
                    </div>
                  );
                })}
                {p.id !== me.capital && <button className="mt-1 text-[11px] text-gold-300 hover:underline" onClick={() => dispatch({ type: 'moveCapital', country: me.id, province: p.id })}>{tr('Move capital here')}</button>}
              </div>
            )}
            {me && !p.owner && <Button size="sm" className="mt-3 w-full" icon={<Users className="h-3.5 w-3.5" />} onClick={() => dispatch({ type: 'colonize', country: me.id, province: p.id })}>Settle this land ({fmtNum(colonizeCost(me))})</Button>}
          </div>
        )}
        {!c && !p && <p className="text-sm text-parchment-300/70"><ScrollText className="mr-1 inline h-4 w-4" />{tr('Select a province on the map.')}</p>}
      </div>
      <Modal open={warConfirm} onClose={() => setWarConfirm(false)} title={tr('Declare war?')} footer={<><Button onClick={() => setWarConfirm(false)}>{tr('Cancel')}</Button><Button variant="danger" onClick={() => { setWarConfirm(false); diplo('declareWar'); }}>{tr('Declare war')}</Button></>}>
        {c && me && (() => {
          const r = peekRelation(w, me.id, c.id) ?? { opinion: 0, treaties: {} as Record<string, unknown> };
          return <div className="space-y-2 text-sm text-parchment-100">
            <p>{tr('You are about to declare war on')} <b>{c.name}</b>.</p>
            <ul className="list-disc space-y-1 pl-5 text-parchment-200/80">
              <li>{tr('Their allies with sufficient trust will join the war.')}</li>
              {!!(r.treaties as Record<string, unknown>).nap && <li className="text-blood-400">{tr('You have a non-aggression pact — breaking it costs legitimacy and trust worldwide.')}</li>}
              {r.opinion > -25 && <li className="text-blood-400">Without a grievance (opinion above −25, no claims) the war is unjustified: −8 stability, −6 legitimacy for 5 years.</li>}
              <li>{tr('Your power')} {militaryPower(me).toFixed(0)} vs theirs {militaryPower(c).toFixed(0)} (before allies, logistics and terrain).</li>
            </ul>
          </div>;
        })()}
      </Modal>
    </aside>
  );
}

function odds(ev: { total: number; threshold: number } | null): string { return ev ? `AI acceptance: ${ev.total} vs required ${ev.threshold}` : ''; }
function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-ink-950/50 px-2 py-1 ring-1 ring-gold-700/20"><div className="text-[9px] uppercase tracking-wider text-parchment-300/50">{label}</div><div className="stat-num truncate text-parchment-50">{value}</div></div>;
}
