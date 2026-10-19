// The WW2 rules: historical weapons and vehicles. Realism is in the ratios, not the numbers
// (time is compressed): small arms bounce off tanks, anti-tank guns are slow but decisive, armour
// is thickest at the front, machine guns pin infantry down. See docs/ww2-design.md.
//
// A WW2 game is one side's arsenal (ww2_<side>.ts) against another side's army; ww2_kit.ts has
// the shared slots and the wave builder.

import type { Ruleset } from './defs';
import { GERMANY, WEHRMACHT_ARMY } from './ww2_de';
import { RED_ARMY, SOVIET_DEFENCE } from './ww2_su';
import { ALLIED_DEFENCE, US_ARMY } from './ww2_us';
import { JAPANESE_DEFENCE, JP_ARMY } from './ww2_jp';
import { SLOTS, assault, type Arsenal, type Army, type Faction } from './ww2_kit';
import { battleById } from './battles';

export type { Faction } from './ww2_kit';

export const FACTIONS: Record<Faction, { name: string; adj: string; foes: Faction[] }> = {
  de: { name: 'Germany', adj: 'German', foes: ['su', 'us'] },
  su: { name: 'Soviet Union', adj: 'Soviet', foes: ['de'] },
  us: { name: 'Western Allies', adj: 'Allied', foes: ['de', 'jp'] },
  jp: { name: 'Japan', adj: 'Japanese', foes: ['us'] },
};

/** Each side as the defender, and as the attacker (undefined until it is ready). */
export const ARSENALS: Partial<Record<Faction, Arsenal>> = { de: GERMANY, su: SOVIET_DEFENCE, us: ALLIED_DEFENCE, jp: JAPANESE_DEFENCE };
export const ARMIES: Partial<Record<Faction, Army>> = { su: RED_ARMY, de: WEHRMACHT_ARMY, us: US_ARMY, jp: JP_ARMY };

export function ww2Ruleset(side: Faction, foe: Faction, battle?: string): Ruleset {
  const a = ARSENALS[side];
  const b = battleById(battle);
  // a battle brings the attacker's units of the period and its doctrine there
  const base = ARMIES[foe];
  const army = base && b ? { ...base, roster: { ...base.roster, ...b.roster }, doctrine: b.doctrine ?? base.doctrine } : base;
  if (!a || !army) throw new Error(`no WW2 matchup ${side} vs ${foe}`);
  a.towers.forEach((t, i) => {
    if (t.slot !== SLOTS[i]) throw new Error(`${side} arsenal: ${t.kind} is in the ${SLOTS[i]} slot`);
  });
  return {
    id: 'ww2',
    side,
    foe,
    towers: a.towers,
    enemies: army.enemies,
    units: a.units,
    combos: a.combos,
    categories: [
      { id: 'basic', name: 'Infantry' },
      { id: 'precision', name: 'Anti-tank' },
      { id: 'fire', name: 'Artillery' },
      { id: 'support', name: 'Support' },
      { id: 'units', name: 'Units' },
      { id: 'maze', name: 'Obstacles' },
      { id: 'super', name: a.superName },
    ],
    ranks: a.ranks,
    look: a.look,
    wave: (n) => assault(n, army),
  };
}

/** For the HUD: how a unit's armour compares to a weapon's penetration. */
export function penVerdict(pen: number, arm: readonly number[] | undefined): 'soft' | 'all' | 'side' | 'rear' | 'none' {
  if (!arm) return 'soft';
  if (pen >= arm[0]) return 'all';
  if (pen >= arm[1]) return 'side';
  if (pen >= arm[2]) return 'rear';
  return 'none';
}

