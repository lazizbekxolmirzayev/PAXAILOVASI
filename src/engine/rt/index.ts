// Public API of the real-time layer.
import type { MapStatic, World } from '../../types/game';
import { accrueIncome, ensureRt, rtOf, syncCountries } from './state';
import { processBattles, processMarches } from './war';
import { processLoans } from './dipl';
import { runAi } from './ai';

export * from './units';
export * from './state';
export { sendMarch, campaignAgainst, battleProgress, estimateOdds, routeBetween, defenceFactor, sideOf, findWar, SHIP_CAPACITY, nearestOwned } from './war';
export * from './dipl';
export { enemiesOf } from './ai';

/** Advances the real-time layer by `dt` game-clock seconds (call with the wall-clock delta × game speed). */
export function rtTick(w: World, st: MapStatic, dt: number): void {
  const rt = ensureRt(w);
  let left = Math.min(Math.max(0, dt), 30);
  while (left > 1e-6) {
    const d = Math.min(1, left);
    left -= d;
    rt.t += d;
    accrueIncome(w, d);
    processMarches(w, st);
    processBattles(w, st, d);
    processLoans(w, st);
    runAi(w, st);
    if (Math.floor(rt.t / 5) !== Math.floor((rt.t - d) / 5)) syncCountries(w);
  }
}
export { rtOf };
