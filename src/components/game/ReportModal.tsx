import { Trophy, Skull } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGame } from '../../store/game';
import { Button, Modal } from '../ui';
import { useN, useT } from '../../i18n';
import { rtOf } from '../../engine/rt';
import type { BattleReport } from '../../types/game';
import { KV, num } from './parts';

/** Shows the report of each finished battle involving the player (30 s after the armies meet). */
export function ReportModal() {
  useGame((s) => s.version);
  const w = useGame((s) => s.world);
  const [shown, setShown] = useState<string | null>(null);
  const setSpeed = useGame((s) => s.setSpeed);
  const t = useT();
  const n = useN();
  const me = w?.player;
  const rep: BattleReport | undefined = w && me ? rtOf(w).reports.find((r) => !r.seen && (r.attacker === me || r.defender === me)) : undefined;
  useEffect(() => { if (rep && rep.id !== shown) setShown(rep.id); }, [rep, shown]);
  if (!w || !me || !rep) return null;
  const mineAtt = rep.attacker === me;
  const won = rep.winner === me;
  const city = n(w.provinces[rep.province]?.name ?? '?');
  const my = mineAtt ? { start: rep.aStart, killed: rep.aKilled, fled: rep.aFled } : { start: rep.dStart, killed: rep.dKilled, fled: rep.dFled };
  const foe = mineAtt ? { start: rep.dStart, killed: rep.dKilled, fled: rep.dFled } : { start: rep.aStart, killed: rep.aKilled, fled: rep.aFled };
  const foeName = n(w.countries[mineAtt ? rep.defender : rep.attacker]?.name ?? '?');
  const close = () => { rep.seen = true; useGame.getState().bump(); setShown(null); setSpeed(useGame.getState().speed); };
  return (
    <Modal open onClose={close} title={<span className="flex items-center gap-2">{won ? <Trophy className="h-5 w-5 text-gold-300" /> : <Skull className="h-5 w-5 text-blood-400" />}{t(won ? 'Victory at {city}' : 'Defeat at {city}', { city })}</span>}
      footer={<Button variant="gold" onClick={close}>{t('Continue')}</Button>}>
      <p className="mb-3 text-xs text-parchment-300/80">{t('{a} attacked {d}.', { a: n(w.countries[rep.attacker]?.name ?? '?'), d: n(w.countries[rep.defender]?.name ?? '?') })}{rep.captured && ` ${t('The city changed hands.')}`}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-ink-950/60 p-3 ring-1 ring-gold-700/25">
          <div className="label">{t('Your side')}</div>
          <KV k="Soldiers before battle" v={num(my.start)} /><KV k="Killed" v={num(my.killed)} tone="bad" /><KV k="Fled" v={num(my.fled)} />
        </div>
        <div className="rounded-md bg-ink-950/60 p-3 ring-1 ring-gold-700/25">
          <div className="label">{foeName}</div>
          <KV k="Soldiers before battle" v={num(foe.start)} /><KV k="Killed" v={num(foe.killed)} tone="good" /><KV k="Fled" v={num(foe.fled)} />
        </div>
      </div>
      <div className="mt-3 rounded-md bg-ink-950/60 p-3 ring-1 ring-gold-700/25">
        <KV k="Prisoners taken" v={num(rep.prisoners)} />
        <KV k="Gold captured" v={num(rep.lootGold)} />
        <KV k="Food captured" v={num(rep.lootFood)} />
      </div>
    </Modal>
  );
}
