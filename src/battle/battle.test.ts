import { describe, expect, it } from 'vitest';
import { BERAS, CULTURES, armyKit, WEAPONS } from './data';
import { createBattle, emptyInput, resultOf, step, type BattleConfig } from './sim';

const cfg = (era: BattleConfig['era'], a: BattleConfig['teams'][0]['culture'], b: BattleConfig['teams'][0]['culture']): BattleConfig => ({
  era, terrain: 'plains', time: 'day', title: 'Test', seed: 42,
  teams: [{ name: 'A', leader: 'Hero', color: '#3366aa', culture: a, strength: 1 }, { name: 'B', leader: 'Foe', color: '#aa3333', culture: b, strength: 1 }],
});

describe('battle kits', () => {
  it('every era/culture has valid weapons for all units and the hero', () => {
    for (const era of BERAS) for (const c of CULTURES) {
      const k = armyKit(era, c);
      for (const u of k.units) { expect(WEAPONS[u.weapon], `${era}/${c}/${u.weapon}`).toBeTruthy(); if (u.side) expect(WEAPONS[u.side]).toBeTruthy(); }
      for (const w of k.hero.weapons) expect(WEAPONS[w], `${era}/${c} hero ${w}`).toBeTruthy();
    }
  });
  it('gives bows to Timur-era steppe armies and firearms to the modern era', () => {
    expect(armyKit('medieval', 'steppe').hero.weapons).toContain('compbow');
    expect(armyKit('modern', 'european').hero.weapons).toEqual(expect.arrayContaining(['pistol', 'rifle', 'smg', 'grenade']));
  });
});

describe('battle simulation', () => {
  for (const era of BERAS) {
    it(`${era}: AI armies fight to a decision`, () => {
      const s = createBattle(cfg(era, 'european', era === 'medieval' ? 'steppe' : 'islamic'));
      const inp = emptyInput();
      let n = 0;
      while (!s.over && n < 30000) { step(s, inp, 1 / 30); n++; }
      expect(s.over).not.toBeNull();
      const r = resultOf(s);
      expect(r.allyLoss).toBeGreaterThanOrEqual(0); expect(r.allyLoss).toBeLessThanOrEqual(1);
      expect(Number.isFinite(r.enemyLoss)).toBe(true);
    });
  }
  it('the hero can kill with a melee strike', () => {
    const s = createBattle(cfg('medieval', 'steppe', 'european')); s.intro = 0;
    const foe = s.units.find((u) => u.team === 1 && !u.horse)!;
    foe.x = s.player.x + 30; foe.z = s.player.z; foe.hp = 10; foe.shield = false; s.player.cd = 0;
    const inp = emptyInput(); inp.mouseX = 1200; inp.meleePressed = true;
    for (let i = 0; i < 20; i++) { step(s, inp, 1 / 60); inp.meleePressed = false; }
    expect(foe.dead).toBe(true);
    expect(s.playerKills).toBe(1);
  });
});
