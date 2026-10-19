// The WW2 rules: historical weapons and vehicles. Realism is in the ratios, not the numbers
// (time is compressed): small arms bounce off tanks, anti-tank guns are slow but decisive, armour
// is thickest at the front, machine guns pin infantry down. See docs/ww2-design.md.
//
// A WW2 game is one side's arsenal (ww2_<side>.ts) against another side's army; ww2_kit.ts has
// the shared slots and the wave builder.

import type { EnemyDef, Ruleset } from './defs';
import { GERMANY, WEHRMACHT_ARMY } from './ww2_de';
import { RED_ARMY, SOVIET_DEFENCE } from './ww2_su';
import { ALLIED_DEFENCE, US_ARMY } from './ww2_us';
import { JAPANESE_DEFENCE, JP_ARMY } from './ww2_jp';
import { SLOTS, assault, type Arsenal, type Army, type Faction, type Slot, type UnitHelp } from './ww2_kit';
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
    enemies: [...army.enemies, ...garrison(foe)],
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

/**
 * The attacker's base, built from its own arsenal: the headquarters (destroy it to win) and the
 * machine-gun nests and anti-tank guns guarding it. Appended to the army's units in this order.
 */
function garrison(foe: Faction): EnemyDef[] {
  const a = ARSENALS[foe]!;
  const gun = (slot: Slot) => a.towers.find((t) => t.slot === slot)!;
  const base = (lv: number) => `${a.look.base}${lv}`;
  const adj = FACTIONS[foe].adj;
  return [
    { name: `${adj} Headquarters`, hp: 6000, speed: 0, reward: 0, armor: 0, air: false, radius: 20, lives: 0, tex: gun('hq').turret!, bio: 0,
      arm: [100, 100, 100, 70], fixed: 'hq', base: base(7), spot: 220, gun: { dmg: 3, range: 150, rate: 6, pen: 8, supp: 0.05, fx: 'mg' } },
    { name: gun('mg').name, hp: 260, speed: 0, reward: 12, armor: 0, air: false, radius: 9, lives: 0, tex: gun('mg').turret!, bio: 0.5,
      arm: [25, 25, 25, 12], fixed: 'mg', base: base(3), spot: 180, gun: { dmg: 3, range: 140, rate: 8, pen: 8, supp: 0.07, fx: 'mg' } },
    { name: gun('atgun').name, hp: 320, speed: 0, reward: 18, armor: 0, air: false, radius: 11, lives: 0, tex: gun('atgun').turret!, bio: 0.5,
      arm: [40, 30, 30, 12], fixed: 'at', base: base(3), spot: 200, gun: { dmg: 60, range: 220, rate: 0.3, pen: 110, supp: 0.3, halt: 0.6, splash: 10, fx: 'tank' } },
  ];
}

/** Help for the positions of the enemy's base, in `garrison()` order. */
export const GARRISON_HELP: UnitHelp[] = [
  { text: 'The enemy\'s headquarters, in concrete. Destroy it to win: the waves keep coming until one side\'s headquarters falls. Its garrison machine-guns anything close, and their engineers repair it whenever it is left alone for a few seconds: it takes a sustained attack.',
    counter: 'Heavy guns: tanks and anti-tank guns through the walls, heavy artillery, bombers and the super-weapon from above. Machine guns and rifles do nothing.' },
  { text: 'A machine-gun nest guarding the enemy\'s base. Destroyed positions are rebuilt after a while.',
    counter: 'Mortars and artillery, tanks, or infantry assaulting from cover.' },
  { text: 'An anti-tank gun guarding the enemy\'s base: it goes through the front of most tanks. Destroyed positions are rebuilt after a while.',
    counter: 'Artillery and mortars, or infantry: it can\'t do much against soldiers.' },
];

/** For the HUD: how a unit's armour compares to a weapon's penetration. */
export function penVerdict(pen: number, arm: readonly number[] | undefined): 'soft' | 'all' | 'side' | 'rear' | 'none' {
  if (!arm) return 'soft';
  if (pen >= arm[0]) return 'all';
  if (pen >= arm[1]) return 'side';
  if (pen >= arm[2]) return 'rear';
  return 'none';
}

